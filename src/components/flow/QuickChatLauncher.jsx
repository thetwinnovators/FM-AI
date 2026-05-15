import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Send, X, Loader2, Mic, MicOff, Square, ChevronDown, Check, PanelRight, Minimize2 } from 'lucide-react'
import { renderInlineText } from '../chat/ChatMessage.jsx'
import { setChatPanelState } from '../../lib/chatPanelState.js'
import { useStore } from '../../store/useStore.js'
import { useSeed } from '../../store/useSeed.js'
import { streamChat } from '../../lib/llm/ollama.js'
import { OLLAMA_CONFIG, setOllamaModel } from '../../lib/llm/ollamaConfig.js'
import { retrieveDocuments, buildSystemMessage, classifyIntent } from '../../lib/chat/retrieve.js'
import { VOICE_CONFIG, setVoiceEnabled } from '../../lib/voice/voiceConfig.js'
import { playTtsForReply, stopVoice, subscribeVoicePlaying } from '../../lib/voice/player.js'
import { startRecording, transcribeBlob } from '../../lib/voice/stt.js'
import { getActiveMCPTools, buildToolSystemBlock, processToolCalls } from '../../lib/chat/mcpTools.js'
import { fetchDaemonTools, buildDaemonToolMap, daemonToolToMCPShape } from '../../lib/chat/daemonTools.js'

// "Talk to FlowMap" launcher — a fixed pill at the bottom-center of the
// FlowMap page that expands into an inline chat panel. Ephemeral by design
// (no sidebar conversation entry) so quick "what is this node?" / "tell me
// about my Claude topic" probes don't clutter the persistent chat list.
//
// Reuses the same pipeline as /chat: retrieve docs → build system prompt
// (memory + topics + excerpts) → stream from Ollama → auto-speak via TTS.
// That means everything tied to that pipeline (graph edge glow, captions
// panel) lights up here too.
export default function QuickChatLauncher() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [micError, setMicError] = useState(null)
  // Conversation mode = mic stays open, every utterance auto-sends on the
  // user pausing, and the mic auto-pauses while the AI is speaking. Toggled
  // on by clicking the launcher pill (instead of just opening the chat).
  const [conversationMode, setConversationMode] = useState(false)
  const [voicePlaying, setVoicePlaying] = useState(false)
  const [panelMode, setPanelMode] = useState('floating') // 'floating' | 'side'
  const [sideWidth, setSideWidth] = useState(480)
  const [model, setModel] = useState(OLLAMA_CONFIG.model)
  const [availableModels, setAvailableModels] = useState([])
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const modelPickerRef = useRef(null)
  const abortRef = useRef(null)
  const daemonToolMapRef = useRef(new Map())
  const pendingInjectRef = useRef(null)   // message injected from another page (VS "Enhance with Flow.AI")
  const sendRef = useRef(null)            // mirror of send() so effects can call it without stale closure
  const inputRef = useRef(null)
  const scrollRef = useRef(null)
  const atBottomRef = useRef(true) // true while the scroll container is near the bottom
  const recorderRef = useRef(null)            // MediaRecorder controller from stt.js
  const transcribingRef = useRef(false)
  const micBaseTextRef = useRef('')           // draft contents when mic was activated
  const autoSendAfterTranscribeRef = useRef(false) // set by Enter-while-listening for hands-free send
  const conversationModeRef = useRef(false)   // mirror for use inside SR callbacks
  const pendingSendRef = useRef('')           // utterance to flush on `onend`
  conversationModeRef.current = conversationMode

  // STT support check — we use MediaRecorder + a local Whisper container
  // (whisper-asr-webservice on :9000, proxied via /api/stt). The only thing
  // that needs to exist client-side is MediaRecorder + getUserMedia.
  const speechSupported = typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && !!navigator?.mediaDevices?.getUserMedia

  const {
    documents, documentContents,
    memoryEntries, isMemoryDismissed,
    userTopics, isFollowing,
    userNotes,
  } = useStore()
  const { seedMemory, topics: seedTopics, contentById } = useSeed()

  const allDocs = useMemo(() => Object.values(documents || {}), [documents])

  // Auto-focus the input when the panel opens; auto-scroll to bottom on
  // each new chunk during streaming — but only when the user hasn't scrolled up.
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])
  useEffect(() => {
    if (atBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streaming])

  function onScrollMessages(e) {
    const el = e.currentTarget
    // Consider "at bottom" when within 100 px of the end (covers rounding/sub-pixel gaps).
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }

  // Subscribe to TTS playing state so the Stop button can react to voice-only
  // activity (e.g. a finished stream that's still being read aloud).
  useEffect(() => subscribeVoicePlaying(setVoicePlaying), [])

  // Load Docker MCP tools from the daemon once on mount so the model can call
  // them via <tool_call> instead of hallucinating <fm-action> fetch blocks.
  const [daemonMCPTools, setDaemonMCPTools] = useState([])
  useEffect(() => {
    fetchDaemonTools().then((tools) => {
      setDaemonMCPTools(tools)
      daemonToolMapRef.current = buildDaemonToolMap(tools)
    }).catch(() => {})
  }, [])

  // Discover pulled Ollama models for the inline model picker.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/ollama/api/tags')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const names = (json?.models || []).map((m) => m.name).sort()
        setAvailableModels(names)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open])

  // Close model picker on outside click.
  useEffect(() => {
    if (!modelPickerOpen) return
    function onDoc(e) { if (!modelPickerRef.current?.contains(e.target)) setModelPickerOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [modelPickerOpen])

  function onChangeModel(name) {
    setOllamaModel(name)
    setModel(name)
    setModelPickerOpen(false)
  }

  // Global keyboard shortcuts (panel must be open):
  //   Escape          → stop generation/voice, or close panel
  //   Ctrl+T          → toggle mic on/off
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') {
        if (busy || voicePlaying) {
          if (busy && abortRef.current) abortRef.current.abort()
          stopVoice()
        } else {
          setOpen(false)
        }
        return
      }
      if (e.key === 't' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        if (!busy && !transcribing) toggleMic()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, voicePlaying, listening, transcribing])

  function stopAll() {
    if (busy && abortRef.current) {
      try { abortRef.current.abort() } catch {}
    }
    stopVoice()
  }

  async function send(overrideText) {
    const text = String(overrideText ?? draft).trim()
    if (!text || busy) return

    if (listening) stopMic()
    const nextHistory = [...messages, { role: 'user', content: text }]
    setMessages(nextHistory)
    setDraft('')
    micBaseTextRef.current = ''
    atBottomRef.current = true // always follow new messages the user sends
    setBusy(true)
    setStreaming('')

    // Same retrieval inputs as Chat.jsx — keeps prompt shape identical so the
    // model behaves the same here as in the persistent chat.
    const retrieved = retrieveDocuments(text, allDocs, documentContents, 5)
    const allMemory = [
      ...(seedMemory || []).filter((m) => !isMemoryDismissed(m.id)),
      ...Object.values(memoryEntries || {}),
    ]
    const allTopics = [
      ...(seedTopics || []).map((t) => ({
        id: t.id, name: t.name, summary: t.summary || t.description, isUser: false, followed: isFollowing(t.id),
      })),
      ...Object.values(userTopics || {}).map((t) => ({
        id: t.id, name: t.name, summary: t.summary, isUser: true, followed: !!t.followed,
      })),
    ]
    const allNotes = []
    for (const [itemId, raw] of Object.entries(userNotes || {})) {
      const entries = Array.isArray(raw) ? raw : (raw?.content ? [raw] : [])
      if (entries.length === 0) continue
      const item = (contentById && contentById(itemId)) || documents?.[itemId] || null
      const title = item?.title || `item ${itemId}`
      const type = item?.type || ''
      for (const n of entries) {
        if (n?.content && String(n.content).trim()) {
          allNotes.push({ title, type, content: n.content })
        }
      }
    }
    // QuickChat is ephemeral — no persistent conversation, no recentMessages.
    // Pass allDocs so the model sees the document library index.
    // Classify the intent so casual chat ("Hi", "How are you") gets the lighter
    // CASUAL_SYSTEM_MESSAGE instead of the full retrieval prompt with ACTIONS
    // instructions — without this, the small model hallucinates "I've noted
    // that..." style confirmations for every greeting.
    const intent = classifyIntent(text)
    const baseSystemMessage = buildSystemMessage(retrieved, text, allMemory, allTopics, allNotes, intent, {}, null, allDocs)
    // Append MCP tool descriptions so the model knows what tools it can call.
    const mcpTools = [
      ...getActiveMCPTools(),
      ...daemonMCPTools.map(daemonToolToMCPShape),
    ]
    const toolBlock = buildToolSystemBlock(mcpTools)
    const systemMessage = toolBlock ? `${baseSystemMessage}\n\n${toolBlock}` : baseSystemMessage

    const llmMessages = [
      { role: 'system', content: systemMessage },
      ...nextHistory.map((m) => ({ role: m.role, content: m.content })),
    ]

    const ctrl = new AbortController()
    abortRef.current = ctrl
    let assistantText = ''
    try {
      for await (const chunk of streamChat(llmMessages, { signal: ctrl.signal })) {
        assistantText += chunk
        setStreaming(assistantText)
      }
    } catch { /* logged inside streamChat */ }

    // ── Tool call execution round ──────────────────────────────────────────
    // If the model emitted any <tool_call> blocks, run them and do one
    // follow-up stream so the final reply incorporates the results.
    if (mcpTools.length > 0 && !ctrl.signal.aborted && assistantText.includes('<tool_call>')) {
      setStreaming('') // clear while tools run
      try {
        const { hasToolCalls, processedText, toolResultBlock } = await processToolCalls(assistantText, daemonToolMapRef.current)
        if (hasToolCalls) {
          const ctrl2 = new AbortController()
          abortRef.current = ctrl2
          const followUp = [
            ...llmMessages,
            { role: 'assistant', content: processedText },
            { role: 'user', content: `${toolResultBlock}\n\nPlease answer using the tool results above.` },
          ]
          let followUpText = ''
          try {
            for await (const chunk of streamChat(followUp, { signal: ctrl2.signal })) {
              followUpText += chunk
              setStreaming(followUpText)
            }
          } catch {}
          assistantText = followUpText || processedText
        }
      } catch { /* tool execution errors are non-fatal */ }
    }

    setBusy(false)
    setStreaming('')

    // Strip hallucinated confirmations the small model emits without an
    // accompanying <fm-action> block (Quick Chat doesn't queue actions —
    // any "Done — I've created..." line here is a hallucination). Also
    // strip forbidden "I don't have a saved doc on the exact topic" phrasing
    // that the model emits despite explicit prompt-level prohibition.
    // Tightened from views/Chat.jsx: removed the "/I've ... that/" pattern
    // because it false-positively eats legitimate replies like "I've noted
    // that you asked..." Only obvious hallucinated confirmations are stripped.
    const cleaned = assistantText
      // Strip <fm-action>...</fm-action> AND malformed variants the small model
      // emits: [fm-action]...</fm-action>, [fm-action]...[/fm-action], etc.
      .replace(/[<\[(]\s*fm-action\s*[>\])][\s\S]*?[<\[(]\s*\/\s*fm-action\s*[>\])]/gi, '')
      .replace(/^\s*Done\s*.{0,6}I.{0,2}ve (?:added|created|saved|updated|noted)\b[^\n]*/gim, '')
      .replace(/^\s*The new topic is now available[^\n]*/gim, '')
      .replace(/^\s*I.{0,2}ve (?:added|created|saved|noted) (?:a new topic|the fact)\b[^\n]*/gim, '')
      // Forbidden "I don't have a saved doc on the exact topic of X" — model
      // ignores the FORBIDDEN list in the system prompt. Rewrite to neutral
      // language so the user doesn't see the explicitly banned phrase.
      .replace(
        /I don'?t have (?:a )?saved doc(?:ument)? on the exact topic of\s+["“']?([^"”'.\n!?]+)["”'.!?]?/gi,
        "I don't have $1 saved yet — drop in a link or paste the content and I'll take it from there.",
      )
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (cleaned) {
      setMessages((m) => [...m, { role: 'assistant', content: cleaned }])
      if (VOICE_CONFIG.enabled) {
        playTtsForReply(cleaned).catch(() => {})
      }
    } else if (assistantText.trim()) {
      // Strip removed everything. If the raw text contains <fm-action> blocks the
      // model hallucinated (e.g. fake "fetch" actions it can't actually run), don't
      // show them — that would expose raw XML syntax to the user. Only fall back to
      // raw text when the response is clean prose that the strip over-eagerly removed.
      const rawHasActionBlocks = /[<\[(]\s*fm-action\s*[>\]]/.test(assistantText)
      if (!rawHasActionBlocks) {
        setMessages((m) => [...m, { role: 'assistant', content: assistantText.trim() }])
      }
      // (If only action blocks were present and nothing else, silently discard —
      //  the action was either processed or was a hallucination.)
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (listening) {
        // Hands-free: set flag so stopMic() auto-sends once Whisper finishes.
        autoSendAfterTranscribeRef.current = true
        stopMic()
      } else if (!transcribing) {
        send()
      }
    }
  }

  // ─── Speech-to-text (mic dictation) ────────────────────────────────────
  // Records mic audio with MediaRecorder, then ships the blob to the local
  // Whisper container via /api/stt for transcription. Replaces the browser's
  // Google-dependent SpeechRecognition. UX: click mic to start, click again
  // to stop — the transcript appears once Whisper finishes (typically <1s on
  // GPU). The textarea content is preserved; the transcript is appended.
  async function startMic() {
    if (!speechSupported || listening || transcribingRef.current) return
    setMicError(null)
    micBaseTextRef.current = draft
    try {
      const ctl = await startRecording()
      recorderRef.current = ctl
      setListening(true)
    } catch (err) {
      // getUserMedia rejection — usually permission denied or no device.
      const msg = /denied|not allowed/i.test(String(err?.message))
        ? 'Mic permission denied — allow it in the browser.'
        : (err?.message || 'mic init failed')
      setMicError(msg)
    }
  }

  async function stopMic() {
    const ctl = recorderRef.current
    if (!ctl) { setListening(false); return }
    recorderRef.current = null
    setListening(false)
    transcribingRef.current = true
    setTranscribing(true)
    setMicError(null)
    try {
      const blob = await ctl.stop()
      const text = await transcribeBlob(blob)
      if (text) {
        const base = micBaseTextRef.current
        const sep = base && !/\s$/.test(base) ? ' ' : ''
        const next = base + sep + text
        setDraft(next)
        micBaseTextRef.current = next
        // Hands-free: if Enter triggered the stop, send immediately after transcription.
        if (autoSendAfterTranscribeRef.current) {
          autoSendAfterTranscribeRef.current = false
          send(next)
        }
      } else {
        autoSendAfterTranscribeRef.current = false
      }
    } catch (err) {
      autoSendAfterTranscribeRef.current = false
      const msg = err?.status === 502 || err?.status === 503
        ? 'Whisper container unreachable. Is the docker service running on :9000?'
        : `Transcription failed: ${err?.message || err}`
      setMicError(msg)
    } finally {
      transcribingRef.current = false
      setTranscribing(false)
    }
  }

  function cancelMic() {
    const ctl = recorderRef.current
    if (ctl) {
      try { ctl.cancel() } catch {}
      recorderRef.current = null
    }
    setListening(false)
  }

  function toggleMic() {
    if (listening) stopMic()
    else startMic()
  }

  // Make sure the mic is released when the panel closes / unmounts.
  useEffect(() => () => cancelMic(), [])
  useEffect(() => { if (!open && listening) cancelMic() }, [open, listening])

  function reset() {
    if (busy) abortRef.current?.abort()
    stopMic()
    stopVoice()
    setMessages([])
    setStreaming('')
    setDraft('')
    setBusy(false)
  }

  function close() {
    reset()
    setOpen(false)
  }

  // Broadcast open/mode/width so BackToTop can shift out of the way
  useEffect(() => {
    setChatPanelState({ open, mode: panelMode, sideWidth })
  }, [open, panelMode, sideWidth])

  // Listen for messages injected from other pages (e.g. Venture Scope "Enhance with Flow.AI")
  useEffect(() => {
    function handleInject(e) {
      pendingInjectRef.current = e.detail?.message ?? ''
      setOpen(true)
    }
    window.addEventListener('fm-chat-inject', handleInject)
    return () => window.removeEventListener('fm-chat-inject', handleInject)
  }, [])

  // When the panel opens, flush any pending injected message and auto-send
  useEffect(() => {
    if (!open || !pendingInjectRef.current) return
    const text = pendingInjectRef.current
    pendingInjectRef.current = null
    const timer = setTimeout(() => sendRef.current?.(text), 200)
    return () => clearTimeout(timer)
  }, [open])

  // Resize handle for side panel mode — drag left edge to adjust width
  function onResizePointerDown(e) {
    e.preventDefault()
    const startX = e.clientX
    const startW = sideWidth
    function onMove(ev) {
      // dragging left (negative delta) = wider; dragging right = narrower
      const delta = startX - ev.clientX
      setSideWidth(Math.max(400, Math.min(720, startW + delta)))
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  sendRef.current = send

  // Rendered inline as an absolute child — the host (network section in
  // FlowMap.jsx) provides `position: relative`. The wrapper covers the canvas
  // area but uses `pointer-events-none` so graph drag/click still passes
  // through; the button itself opts back in.
  if (!open) {
    return (
      <>
        <style>{`
          @keyframes qcl-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
          @keyframes qcl-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
          .qcl-in{animation:qcl-in 0.5s cubic-bezier(.22,1,.36,1) both}
          .qcl-float{animation:qcl-float 4s ease-in-out infinite}
        `}</style>
        <div className="fixed bottom-4 right-4 z-[9999] pointer-events-none">
          {/* Speech bubble — positioned above the launcher button */}
          <div className="qcl-in absolute right-0" style={{ bottom: 'calc(100% + 14px)' }}>
            <div
              className="qcl-float relative rounded-2xl rounded-br-sm px-4 py-3 w-[280px]"
              style={{
                background:
                  'linear-gradient(160deg, rgba(20,184,166,0.14) 0%, rgba(99,102,241,0.10) 50%, rgba(217,70,239,0.14) 100%),' +
                  'rgba(8,10,22,0.92)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow:
                  '0 8px 32px rgba(0,0,0,0.50),' +
                  'inset 0 1px 0 rgba(255,255,255,0.12)',
              }}
            >
              <p className="text-[12.5px] leading-relaxed text-white/80">
                Good day, Sir. I am here to assist you whenever you&apos;re ready.
              </p>
              {/* Arrow tail — downward, aligned to button centre (right: 24px) */}
              <span aria-hidden style={{
                position:'absolute', bottom:-9, right:15,
                width:0, height:0,
                borderLeft:'9px solid transparent',
                borderRight:'9px solid transparent',
                borderTop:'9px solid rgba(255,255,255,0.15)',
              }} />
              <span aria-hidden style={{
                position:'absolute', bottom:-7, right:16,
                width:0, height:0,
                borderLeft:'8px solid transparent',
                borderRight:'8px solid transparent',
                borderTop:'8px solid rgba(8,10,22,0.92)',
              }} />
            </div>
          </div>
          <button
          onClick={() => setOpen(true)}
          className="pointer-events-auto group relative inline-flex items-center justify-center w-12 h-12 rounded-full text-white transition-transform hover:-translate-y-[2px] hover:scale-[1.04]"
          style={{
            background:
              'linear-gradient(135deg, rgba(20,184,166,0.22) 0%, rgba(99,102,241,0.22) 50%, rgba(217,70,239,0.22) 100%),' +
              'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(28px) saturate(200%)',
            WebkitBackdropFilter: 'blur(28px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.22)',
            boxShadow:
              '0 12px 32px rgba(0,0,0,0.45),' +
              '0 1px 0 rgba(255,255,255,0.18) inset,' +
              '0 -8px 16px rgba(20,184,166,0.12) inset',
          }}
          title="Talk to FlowMap (Esc to close)"
          aria-label="Talk to FlowMap"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(120% 60% at 50% -10%, rgba(255,255,255,0.40) 0%, rgba(255,255,255,0) 60%)',
            }}
          />
          <Mic size={18} className="relative drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" />
        </button>
        </div>
      </>
    )
  }

  const isSide = panelMode === 'side'

  return (
    <div
      style={isSide
        ? { position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'stretch' }
        : { position: 'fixed', bottom: 16, right: 16, zIndex: 9999 }
      }
    >
      {isSide && (
        <div
          onPointerDown={onResizePointerDown}
          className="w-1 flex-shrink-0 cursor-col-resize group relative"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-indigo-400/20 transition-colors" />
        </div>
      )}
    <div
      id="quick-chat-panel"
      className={`flex flex-col overflow-hidden${isSide ? '' : ' w-[min(420px,calc(100vw-2rem))] rounded-2xl'}`}
      style={isSide
        ? {
            width: sideWidth,
            background:
              'linear-gradient(160deg, rgba(20,184,166,0.10) 0%, rgba(99,102,241,0.07) 50%, rgba(217,70,239,0.10) 100%),' +
              'rgba(8,10,22,0.92)',
            backdropFilter: 'blur(8px) saturate(140%)',
            WebkitBackdropFilter: 'blur(8px) saturate(140%)',
            borderLeft: '1px solid rgba(255,255,255,0.13)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.45)',
          }
        : {
            maxHeight: 'min(60vh, 600px)',
            background:
              'linear-gradient(160deg, rgba(20,184,166,0.10) 0%, rgba(99,102,241,0.07) 50%, rgba(217,70,239,0.10) 100%),' +
              'rgba(8,10,22,0.78)',
            backdropFilter: 'blur(8px) saturate(140%)',
            WebkitBackdropFilter: 'blur(8px) saturate(140%)',
            border: '1px solid rgba(255,255,255,0.13)',
            boxShadow:
              '0 24px 80px rgba(0,0,0,0.55),' +
              '0 1px 0 rgba(255,255,255,0.14) inset,' +
              '0 -1px 0 rgba(0,0,0,0.4) inset',
          }
      }
    >
      <header
        className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.08] flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <Sparkles size={14} className="text-[color:var(--color-creator)]" />
        <span className="text-sm font-medium text-white">Ask Flow.AI</span>
        <span className="ml-auto inline-flex items-center gap-1">
          {messages.length > 0 ? (
            <button
              onClick={reset}
              className="text-[11px] text-white/50 hover:text-white px-2 py-1 rounded-lg hover:bg-white/[0.06]"
              title="Clear this thread"
            >
              Clear
            </button>
          ) : null}
          <button
            onClick={() => setPanelMode(isSide ? 'floating' : 'side')}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08]"
            aria-label={isSide ? 'Float panel' : 'Dock to side'}
            title={isSide ? 'Float panel' : 'Dock to side panel'}
          >
            {isSide ? <Minimize2 size={14} /> : <PanelRight size={14} />}
          </button>
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08]"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </span>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-4 py-3 space-y-3 min-h-[80px]"
        onScroll={onScrollMessages}
        onWheel={(e) => e.stopPropagation()}
      >
        {messages.length === 0 && !streaming ? (
          <p className="text-[13px] text-white/45">
            Ask anything about your topics, documents, or memory. Replies use the same retrieval as the main chat — and will speak aloud if Voice responses is on.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.content} />
        ))}
        {streaming ? <Bubble role="assistant" text={streaming} streaming /> : null}
        {busy && !streaming ? (
          <div className="inline-flex items-center gap-2 text-[12px] text-white/45">
            <Loader2 size={11} className="animate-spin" /> thinking…
          </div>
        ) : null}
      </div>

      <footer className="px-3 py-3 border-t border-white/[0.06] flex flex-col gap-1.5 flex-shrink-0">
        {micError ? (
          <p className="text-[11px] text-amber-300/80 px-1">{micError}</p>
        ) : null}

        {/* ── Voice status bar ──────────────────────────────────────── */}
        {(listening || transcribing) && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-rose-500/25 bg-rose-500/10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400" />
              </span>
              <span className="text-[11px] font-medium text-rose-200">
                {listening ? 'Listening…' : 'Transcribing…'}
              </span>
            </div>
            {listening && (
              <div className="flex items-center gap-3 text-[10px] text-rose-300/55 font-mono">
                <span>Enter → stop & send</span>
                <span className="text-rose-300/30">·</span>
                <span>Ctrl+T → stop only</span>
              </div>
            )}
          </div>
        )}

        {/* Unified input box — textarea + buttons inside one container */}
        <div className={`flex flex-col rounded-lg bg-white/[0.05] transition-all border ${
          listening
            ? 'border-rose-500/40 bg-rose-500/[0.04] shadow-[0_0_0_2px_rgba(244,63,94,0.08)]'
            : 'border-white/[0.07] focus-within:bg-white/[0.07] focus-within:border-white/[0.12]'
        }`}>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); micBaseTextRef.current = e.target.value }}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={
              listening    ? 'Listening… Enter to stop & send · Ctrl+T to stop only'
              : transcribing ? 'Transcribing with Whisper…'
              : 'Ask FlowMap… · Ctrl+T to dictate'
            }
            className="w-full text-[13px] leading-relaxed text-white/90 bg-transparent px-3 pt-3 pb-1 outline-none placeholder:text-white/25 resize-none"
          />
          <div className="flex items-center justify-between gap-1 px-2 pb-2">
            {/* Model picker — bottom left */}
            <div ref={modelPickerRef} className="relative">
              <button
                type="button"
                onClick={() => availableModels.length > 0 && setModelPickerOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60 transition-colors"
                title={availableModels.length === 0 ? 'No models discovered' : 'Switch model'}
              >
                <Sparkles size={9} className="flex-shrink-0" />
                <span className="truncate max-w-[120px]">{model}</span>
                {availableModels.length > 1 && <ChevronDown size={9} className={`flex-shrink-0 transition-transform ${modelPickerOpen ? 'rotate-180' : ''}`} />}
              </button>
              {modelPickerOpen && availableModels.length > 0 && (
                <div
                  className="absolute left-0 bottom-full mb-1 z-50 min-w-[180px] rounded-lg border border-white/10 py-1 overflow-auto max-h-[200px]"
                  style={{
                    background: 'linear-gradient(160deg, rgba(15,17,28,0.97) 0%, rgba(8,10,18,0.99) 100%)',
                    backdropFilter: 'blur(40px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                >
                  {availableModels.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onChangeModel(m)}
                      className={`w-full px-3 py-1.5 text-[11px] text-left flex items-center gap-2 hover:bg-white/[0.06] transition-colors ${
                        m === model ? 'text-[color:var(--color-creator)]' : 'text-white/80'
                      }`}
                    >
                      <Check size={10} className={m === model ? 'opacity-100' : 'opacity-0'} />
                      <span className="truncate">{m}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Right-side buttons */}
            <div className="flex items-center gap-1">
            {speechSupported ? (
              <button
                onClick={toggleMic}
                disabled={busy || transcribing}
                className={`p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  listening
                    ? 'bg-rose-500/25 text-rose-200 hover:bg-rose-500/35'
                    : 'text-white/40 hover:text-white hover:bg-white/[0.08]'
                }`}
                aria-label={listening ? 'Stop recording' : 'Start dictation (Ctrl+T)'}
                title={listening ? 'Stop recording — Ctrl+T (review) · Enter (send)' : 'Dictate (Ctrl+T)'}
              >
                {listening ? (
                  <span className="relative inline-flex">
                    <Mic size={13} />
                    <span className="absolute -inset-1 rounded-full bg-rose-400/40 animate-ping" />
                  </span>
                ) : transcribing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Mic size={13} />
                )}
              </button>
            ) : (
              <button
                disabled
                className="p-1.5 rounded-md text-white/20 cursor-not-allowed"
                aria-label="Mic unavailable"
                title="This browser doesn't support speech recognition"
              >
                <MicOff size={13} />
              </button>
            )}
            {busy || voicePlaying ? (
              <button
                onClick={stopAll}
                className="p-1.5 rounded-md text-rose-100 bg-rose-500/25 hover:bg-rose-500/35 transition-colors"
                aria-label="Stop"
                title={busy ? 'Stop generating (Esc)' : 'Stop voice (Esc)'}
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!draft.trim()}
                className="btn btn-primary px-2.5 py-1.5 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Send"
                title="Send (Enter)"
              >
                <Send size={12} />
              </button>
            )}
            </div>
          </div>
        </div>
      </footer>
    </div>
    </div>
  )
}

// Strip any fake absolute FlowMap URLs the model generates despite instructions.
// e.g. https://flowmap.com/discover → /discover
// FlowMap is a local app with no hosted domain — all internal links are relative paths.
function normalizeFlowMapUrls(text) {
  return text.replace(/https?:\/\/flowmap\.[a-z]+(\.[a-z]+)?(\/[^)\s"']*)?/gi, (_, _tld, path) => path || '/')
}

function Bubble({ role, text, streaming }) {
  const isUser = role === 'user'
  if (!text) {
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${isUser ? 'bg-[rgba(94,234,212,0.18)] text-white' : 'bg-white/[0.05] text-white/90'}`}>
          {streaming ? <span className="text-white/40 italic">…</span> : null}
        </div>
      </div>
    )
  }

  // User messages: plain text, no markdown parsing needed
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap bg-[rgba(94,234,212,0.18)] text-white">
          {text}
        </div>
      </div>
    )
  }

  // Assistant messages: normalize fake URLs, then render inline markdown
  // (bold, italic, code, links) preserving line breaks.
  const normalized = normalizeFlowMapUrls(text)
  const lines = normalized.split('\n')
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed bg-white/[0.05] text-white/90">
        {lines.map((line, i) => (
          <span key={i}>
            {renderInlineText(line)}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  )
}
