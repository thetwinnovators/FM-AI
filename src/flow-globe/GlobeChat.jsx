import { useState, useEffect, useRef } from 'react'
import { Send, Bot, Loader2, Globe2, Trash2 } from 'lucide-react'
import { streamChat } from '../lib/llm/ollama.js'
import { fetchDaemonTools, buildDaemonToolMap, daemonToolToMCPShape } from '../lib/chat/daemonTools.js'
import { getActiveMCPTools, buildToolSystemBlock, processToolCalls } from '../lib/chat/mcpTools.js'

// ── Globe block parsing ───────────────────────────────────────────────────────

const GLOBE_PINS_RE = /<globe-pins>([\s\S]*?)<\/globe-pins>/g
const GLOBE_ARCS_RE = /<globe-arcs>([\s\S]*?)<\/globe-arcs>/g

function parseGlobeBlocks(text, addPins, addArcs) {
  let cleaned = text
  // Extract and process pins
  GLOBE_PINS_RE.lastIndex = 0
  let m
  while ((m = GLOBE_PINS_RE.exec(text)) !== null) {
    try {
      const pins = JSON.parse(m[1].trim())
      if (Array.isArray(pins)) addPins(pins)
    } catch {}
    cleaned = cleaned.replace(m[0], '')
  }
  // Extract and process arcs
  GLOBE_ARCS_RE.lastIndex = 0
  while ((m = GLOBE_ARCS_RE.exec(text)) !== null) {
    try {
      const arcs = JSON.parse(m[1].trim())
      if (Array.isArray(arcs)) addArcs(arcs)
    } catch {}
    cleaned = cleaned.replace(m[0], '')
  }
  return cleaned.trim()
}

// ── Text helpers ──────────────────────────────────────────────────────────────

function sanitize(raw) {
  if (!raw) return ''
  return raw
    .replace(/```(?:[^\n`]*)?\n?([\s\S]*?)```/g, (_, inner) => inner.trim())
    .replace(/```[^\n]*\n?[\s\S]*$/, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\s][^*]*)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderText(text) {
  return text.split('\n').map((line, i, arr) => (
    <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
  ))
}

// ── System prompt ─────────────────────────────────────────────────────────────

const GLOBE_BASE_SYSTEM = `You control an interactive 3D globe inside FlowMap. When the user asks about
places, companies, routes, or anything geographic, call the appropriate
Google Maps MCP tool. After getting results, emit a <globe-pins> or
<globe-arcs> block so the globe updates automatically. Keep replies to 2-3
sentences unless the user asks for more detail. Never use markdown code blocks.`

// ── Message component ─────────────────────────────────────────────────────────

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const isNotice = msg.role === 'system-notice'

  if (isNotice) {
    return (
      <div className="mx-2 my-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300/80 leading-relaxed">
        {msg.content}
      </div>
    )
  }

  return (
    <div className={`flex gap-2 px-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center mt-0.5">
          <Bot size={11} className="text-teal-400" />
        </div>
      )}
      <div className={`max-w-[85%] text-[12px] leading-relaxed rounded-xl px-3 py-2 ${
        isUser
          ? 'bg-emerald-500/[0.15] text-white/85 rounded-br-sm'
          : 'bg-white/[0.04] text-white/70 rounded-bl-sm'
      }`}>
        {isUser
          ? (msg.content || <span className="opacity-40">...</span>)
          : (msg.content ? renderText(sanitize(msg.content)) : <span className="opacity-40">...</span>)
        }
      </div>
    </div>
  )
}

// ── GlobeChat component ───────────────────────────────────────────────────────

export function GlobeChat({ addPins, addArcs, flyTo, autoQuery, onAutoQueryConsumed }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const daemonToolMapRef = useRef(null)
  const [systemPrompt, setSystemPrompt] = useState(GLOBE_BASE_SYSTEM)
  const bottomRef = useRef(null)
  const abortRef  = useRef(null)
  const inputRef  = useRef(null)
  const sendMessageRef = useRef(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load daemon + MCP tools on mount and build system prompt
  useEffect(() => {
    let cancelled = false
    async function loadTools() {
      const daemonTools = await fetchDaemonTools()
      if (cancelled) return

      const dMap = buildDaemonToolMap(daemonTools)
      daemonToolMapRef.current = dMap

      const daemonShaped = daemonTools.map(daemonToolToMCPShape)
      const mcpTools = getActiveMCPTools()
      const allTools = [...daemonShaped, ...mcpTools]

      const toolBlock = buildToolSystemBlock(allTools)
      setSystemPrompt(GLOBE_BASE_SYSTEM + (toolBlock ? '\n' + toolBlock : ''))
    }
    loadTools()
    return () => { cancelled = true }
  }, [])

  // ── Core sendMessage ────────────────────────────────────────────────────────

  async function sendMessage(text, auto = false) {
    const content = (text ?? input).trim()
    if (!content || streaming) return
    if (!auto) setInput('')

    const userMsg = { role: 'user', content }
    setMessages((prev) => [...prev, userMsg])
    setStreaming(true)

    const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
    let chatMessages = [
      { role: 'system', content: systemPrompt },
      ...history,
      userMsg,
    ]

    const assistantMsg = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, assistantMsg])

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      // ── First streaming pass ──────────────────────────────────────────────
      for await (const token of streamChat(chatMessages, { signal: ctrl.signal, temperature: 0.4 })) {
        if (ctrl.signal.aborted) break
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: updated[updated.length - 1].content + token,
          }
          return updated
        })
      }

      if (ctrl.signal.aborted) return

      // Capture the completed first reply text
      let firstReplyText = ''
      setMessages((prev) => {
        firstReplyText = prev[prev.length - 1]?.content ?? ''
        return prev
      })
      // Flush — let React drain the setState queue so firstReplyText is current
      await new Promise((resolve) => setTimeout(resolve, 0))
      setMessages((prev) => {
        firstReplyText = prev[prev.length - 1]?.content ?? ''
        return prev
      })

      // ── Tool call processing ──────────────────────────────────────────────
      const { hasToolCalls, processedText, toolResultBlock } = await processToolCalls(
        firstReplyText,
        daemonToolMapRef.current,
      )

      if (hasToolCalls) {
        // Strip raw tool_call tags and parse globe blocks from processed text
        const cleanedAfterGlobe = parseGlobeBlocks(processedText, addPins, addArcs)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: cleanedAfterGlobe }
          return updated
        })

        // Follow-up round with tool results injected
        chatMessages = [
          ...chatMessages,
          { role: 'assistant', content: firstReplyText },
          { role: 'user', content: toolResultBlock },
        ]

        const followUpMsg = { role: 'assistant', content: '' }
        setMessages((prev) => [...prev, followUpMsg])

        for await (const token of streamChat(chatMessages, { signal: ctrl.signal, temperature: 0.4 })) {
          if (ctrl.signal.aborted) break
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              role: 'assistant',
              content: updated[updated.length - 1].content + token,
            }
            return updated
          })
        }

        if (ctrl.signal.aborted) return

        // Parse globe blocks from follow-up reply
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            const cleaned = parseGlobeBlocks(last.content, addPins, addArcs)
            updated[updated.length - 1] = { role: 'assistant', content: cleaned }
          }
          return updated
        })
      } else {
        // No tool calls — parse globe blocks directly from the single reply
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant') {
            const cleaned = parseGlobeBlocks(last.content, addPins, addArcs)
            updated[updated.length - 1] = { role: 'assistant', content: cleaned }
          }
          return updated
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  // Keep sendMessageRef current every render so the autoQuery effect always
  // calls the latest sendMessage (avoids stale closure over messages/streaming).
  sendMessageRef.current = sendMessage

  // ── autoQuery effect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoQuery) return
    sendMessageRef.current?.(autoQuery, true)
    onAutoQueryConsumed?.()
  }, [autoQuery, onAutoQueryConsumed])

  // ── Abort on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // ── Clear ───────────────────────────────────────────────────────────────────
  function clearMessages() {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setMessages([])
    setStreaming(false)
    flyTo?.(null)
  }

  // ── Key handler ─────────────────────────────────────────────────────────────
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Globe2 size={13} className="text-teal-400/70" />
          <span className="text-[11px] font-medium text-white/50 tracking-wide uppercase">Globe AI</span>
        </div>
        <button
          onClick={clearMessages}
          className="p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          title="Clear conversation"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center px-4">
            <Globe2 size={22} className="text-white/15" />
            <div className="text-[11px] text-white/25 leading-relaxed">
              Ask about places, companies, routes, or anything geographic — I'll pin it on the globe.
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <Message key={i} msg={msg} />)
        )}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-2 px-2">
            <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center mt-0.5 flex-shrink-0">
              <Loader2 size={11} className="text-teal-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] p-2 flex gap-1.5 flex-shrink-0">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          placeholder="Ask about places, routes, or locations..."
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-white/20 disabled:opacity-40"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || streaming}
          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/50 hover:text-white/80 disabled:opacity-30 transition-colors"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
