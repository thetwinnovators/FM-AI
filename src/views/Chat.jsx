import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { Plus, Send, MessageSquare, Sparkles, Loader2, Trash2, FileText, AlertCircle, Copy, Check, ChevronUp, ChevronDown, ChevronRight, Pencil, NotebookPen, Compass, Pin, PinOff, Mic, MicOff, Square } from 'lucide-react'
import { useMicTranscription } from '../lib/voice/useMicTranscription.js'
import { useStore } from '../store/useStore.js'
import { useSeed } from '../store/useSeed.js'
import { OLLAMA_CONFIG, setOllamaModel } from '../lib/llm/ollamaConfig.js'
import { streamChat, probeOllama } from '../lib/llm/ollama.js'
import { retrieveDocuments, buildSystemMessage, classifyIntent, retrieveWithPipeline } from '../lib/chat/retrieve.js'
import { localSignalsStorage } from '../signals/storage/localSignalsStorage.js'
import { useConfirm } from '../components/ui/ConfirmProvider.jsx'
import { VOICE_CONFIG } from '../lib/voice/voiceConfig.js'
import { playTtsForReply, stopVoice, subscribeVoicePlaying } from '../lib/voice/player.js'
import { generateFollowUps } from '../flow-ai/services/followUpService.js'
import SuggestedPrompts from '../components/chat/SuggestedPrompts.jsx'
import StarterPromptGrid from '../components/chat/StarterPromptGrid.jsx'
import ChatMessage from '../components/chat/ChatMessage.jsx'
import AgentRunTimeline from '../components/chat/AgentRunTimeline.jsx'
import { runAgentLoop } from '../flow-ai/services/agentLoopService.js'

function relativeDate(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.floor((Date.now() - t) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Collapsible context panel rendered below assistant messages — shows
// exactly what the model received in its system prompt for that turn:
// document excerpts (with title + snippet), active memory entries, and
// topics from the user's library. Lets the user audit "where did the
// answer come from?" without diving into devtools.
function MessageContextPanel({ context }) {
  const [open, setOpen] = useState(false)
  if (!context) return null
  const retrieved = context.retrieved || []
  const memory = context.memory || []
  const topics = context.topics || []
  const notes = context.notes || []
  const total = retrieved.length + memory.length + topics.length + notes.length
  if (total === 0) return null

  const summary = [
    retrieved.length ? `${retrieved.length} excerpt${retrieved.length === 1 ? '' : 's'}` : null,
    memory.length ? `${memory.length} memory` : null,
    topics.length ? `${topics.length} topic${topics.length === 1 ? '' : 's'}` : null,
    notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="max-w-[75%] mt-1 mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] text-slate-400 hover:text-slate-700 inline-flex items-center gap-1 transition-colors"
        aria-expanded={open}
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        Context · {summary}
      </button>
      {open ? (
        <div className="mt-2 p-3 rounded-lg bg-slate-100 border border-slate-200 text-[12px] space-y-3">
          {memory.length ? (
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
                <NotebookPen size={10} /> Memory
              </div>
              <ul className="space-y-1">
                {memory.map((m, i) => (
                  <li key={i} className="text-slate-600 leading-relaxed">
                    <span className="text-slate-400 mr-1">[{String(m.category || 'note').replace(/_/g, ' ')}]</span>
                    {m.content}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {topics.length ? (
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
                <Compass size={10} /> Topics
              </div>
              <ul className="space-y-1">
                {topics.map((t, i) => (
                  <li key={i} className="text-slate-600 leading-relaxed">
                    <span className="font-medium text-slate-800">{t.name}</span>
                    {t.isUser ? <span className="text-teal-600 text-[10px] ml-1.5">· saved</span> : t.followed ? <span className="text-teal-600 text-[10px] ml-1.5">· followed</span> : null}
                    {t.summary ? <span className="text-slate-400"> — {t.summary}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {notes.length ? (
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
                <NotebookPen size={10} className="text-amber-500" /> My notes
              </div>
              <ul className="space-y-1">
                {notes.map((n, i) => (
                  <li key={i} className="text-slate-600 leading-relaxed">
                    <span className="text-white/40 mr-1">on [{n.type ? `${n.type}: ` : ''}{n.title}]:</span>
                    {n.content}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {retrieved.length ? (
            <div>
              <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
                <FileText size={10} /> Document excerpts
              </div>
              <ul className="space-y-2">
                {retrieved.map((r, i) => (
                  <li key={i}>
                    <Link
                      to={`/documents/${r.id}`}
                      className="font-medium text-teal-700 hover:underline"
                    >
                      {r.title}
                    </Link>
                    <div className="text-slate-500 italic mt-0.5">{r.snippet}</div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// Parse [label](url), bare https:// URLs, and bare internal paths into
// React elements. The bare-path branch is defense-in-depth: small models
// often skip the markdown wrapper and just emit "/documents/doc_xyz" inline,
// and we still want those to navigate. Whitelisted to known FlowMap routes
// so we don't false-match arbitrary slashes.
function renderContent(text) {
  if (!text) return null
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>"')\]]+)|(\/(?:topics|documents|discover|memory|chat|education|search)(?:\/[A-Za-z0-9_-]+)?|\/topic\/[A-Za-z0-9_-]+)/g
  const parts = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] != null) {
      // Markdown link [label](url)
      const label = m[1]
      const href = m[2]
      if (href.startsWith('/')) {
        parts.push(
          <Link key={key++} to={href} onClick={(e) => e.stopPropagation()}
            className="underline text-[color:var(--color-article)] hover:text-white transition-colors">
            {label}
          </Link>
        )
      } else {
        parts.push(
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer"
            className="underline text-[color:var(--color-creator)] hover:text-white transition-colors">
            {label}
          </a>
        )
      }
    } else if (m[3] != null) {
      // Bare external URL
      const href = m[3]
      parts.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer"
          className="underline text-[color:var(--color-creator)]/70 hover:text-[color:var(--color-creator)] transition-colors break-all">
          {href}
        </a>
      )
    } else {
      // Bare internal path — render as SPA <Link>
      const href = m[4]
      parts.push(
        <Link key={key++} to={href} onClick={(e) => e.stopPropagation()}
          className="underline text-[color:var(--color-article)]/80 hover:text-[color:var(--color-article)] transition-colors break-all">
          {href}
        </Link>
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? parts : text
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const text = message.content || ''
    // Try Clipboard API first; if it throws (permission denied, document not
    // focused, non-HTTPS dev context), immediately fall through to execCommand.
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = text
        el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      } catch { /* truly blocked — still show feedback */ }
    }
    // Always show the visual confirmation regardless of which path ran.
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const CopyButton = (
    <button
      onClick={handleCopy}
      className={`self-end mb-1 rounded-lg flex items-center gap-1 transition-all flex-shrink-0
        ${copied
          ? 'px-2 py-1 bg-emerald-500/15 border border-emerald-400/25 text-emerald-600 opacity-100'
          : 'p-1.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
        }`}
      title={copied ? 'Copied!' : 'Copy message'}
      aria-label="Copy message"
    >
      {copied ? (
        <>
          <Check
            size={12}
            className="text-emerald-400"
            style={{ animation: 'copiedPop 0.2s cubic-bezier(0.34,1.56,0.64,1) both' }}
          />
          <span
            className="text-[11px] font-medium leading-none"
            style={{ animation: 'copiedFade 0.2s ease both' }}
          >
            Copied
          </span>
        </>
      ) : (
        <Copy size={13} />
      )}
    </button>
  )

  return (
    <div className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`group flex items-end gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {isUser ? CopyButton : null}
        <div
          className={`max-w-[75%] rounded-2xl px-4 py-2.5 leading-relaxed ${
            isUser
              ? 'text-[14px] whitespace-pre-wrap bg-slate-200 text-slate-800'
              : ''
          }`}
        >
          {isUser
            ? (message.content ? renderContent(message.content) : <span className="text-white/40 italic">empty</span>)
            : (message.content ? <ChatMessage content={message.content} /> : <span className="text-white/40 italic">empty</span>)
          }
        </div>
        {!isUser ? CopyButton : null}
      </div>
      {!isUser && message.context ? <MessageContextPanel context={message.context} /> : null}
    </div>
  )
}

function Sidebar({ activeId, onNew }) {
  const navigate = useNavigate()
  const { allConversationsSorted, updateConversation, deleteConversation } = useStore()
  const confirm = useConfirm()
  const conversations = allConversationsSorted()

  function togglePin(e, c) {
    e.preventDefault()
    e.stopPropagation()
    updateConversation(c.id, { pinned: !c.pinned })
  }

  async function askDelete(e, c) {
    e.preventDefault()
    e.stopPropagation()
    const ok = await confirm({
      title: `Delete "${c.title}"?`,
      message: 'This deletes the conversation and all its messages. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    deleteConversation(c.id)
    if (activeId === c.id) navigate('/chat', { replace: true })
  }

  return (
    <aside
      className="w-[260px] flex-shrink-0 border-r border-[color:var(--color-border-subtle)] flex flex-col"
      style={{ background: 'linear-gradient(160deg, #0d0f1c 0%, #07090f 100%)' }}
    >
      <div className="p-3">
        <button onClick={onNew} className="btn btn-primary text-sm w-full justify-center">
          <Plus size={13} /> New conversation
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-3 space-y-1">
        {conversations.length === 0 ? (
          <p className="text-[12px] text-[color:var(--color-text-tertiary)] px-2 py-3">
            No conversations yet. Start one with the button above.
          </p>
        ) : conversations.map((c) => (
          <Link
            key={c.id}
            to={`/chat/${c.id}`}
            className={`group relative block pl-3 pr-2 py-2 rounded-lg text-sm transition-colors ${
              activeId === c.id
                ? 'bg-white/[0.06] text-white'
                : 'text-[color:var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-1.5 pr-14">
              {c.pinned ? (
                <Pin size={11} className="text-[color:var(--color-creator)] flex-shrink-0 -rotate-45" />
              ) : null}
              <div className="truncate">{c.title}</div>
            </div>
            <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">{relativeDate(c.updatedAt)}</div>
            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              <button
                onClick={(e) => togglePin(e, c)}
                className="p-1 rounded-lg text-[color:var(--color-text-tertiary)] hover:text-white hover:bg-white/[0.08]"
                aria-label={c.pinned ? 'Unpin conversation' : 'Pin conversation'}
                title={c.pinned ? 'Unpin' : 'Pin to top'}
              >
                {c.pinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
              <button
                onClick={(e) => askDelete(e, c)}
                className="p-1 rounded-lg text-[color:var(--color-text-tertiary)] hover:text-rose-300 hover:bg-rose-500/10"
                aria-label="Delete conversation"
                title="Delete conversation"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </Link>
        ))}
      </div>
    </aside>
  )
}

// Custom drop-UP picker — native <select> can't be forced to open upward,
// and the chat composer sits at the bottom of the viewport, so options are
// always rendered above the trigger.
function ModelPicker({ value, options, disabled, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const isEmpty = options.length === 0

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && !isEmpty && setOpen((v) => !v)}
        disabled={disabled || isEmpty}
        className="inline-flex items-center gap-1.5 px-3 h-10 rounded-lg border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-input)] text-xs text-white/85 hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title={isEmpty ? 'No models discovered — pull one with `docker exec ollama ollama pull …`' : 'Model used for the next message'}
      >
        <Sparkles size={11} className="text-[color:var(--color-text-tertiary)] flex-shrink-0" />
        <span className="truncate max-w-[200px]">{value}</span>
        <ChevronUp size={11} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !isEmpty ? (
        <div
          role="listbox"
          className="absolute left-0 bottom-full mb-1 z-30 min-w-[200px] max-h-[240px] overflow-auto rounded-lg border border-white/10 py-1"
          style={{
            background: 'linear-gradient(160deg, rgba(15,17,28,0.96) 0%, rgba(8,10,18,0.98) 100%)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {options.map((m) => {
            const active = m === value
            return (
              <button
                key={m}
                onClick={() => { onChange(m); setOpen(false) }}
                className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-white/[0.06] transition-colors ${
                  active ? 'text-[color:var(--color-creator)]' : 'text-white/85'
                }`}
              >
                <Check size={11} className={active ? 'opacity-100' : 'opacity-0'} />
                <span className="truncate">{m}</span>
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function Composer({ onSend, onStop, disabled, busy, voicePlaying }) {
  const [text, setText] = useState('')
  const [model, setModel] = useState(OLLAMA_CONFIG.model)
  const [availableModels, setAvailableModels] = useState([])
  const ref = useRef(null)

  // Local Whisper STT — same pipeline as QuickChatLauncher, hook-shared.
  const mic = useMicTranscription({
    getDraft: () => text,
    setDraft: setText,
  })

  // Discover what's pulled in Ollama so the user can swap models per-message.
  // Re-fetches when the disabled state flips (i.e. when Ollama gets toggled on).
  useEffect(() => {
    if (disabled) return
    let cancelled = false
    fetch('/api/ollama/api/tags')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled) return
        const names = (json?.models || []).map((m) => m.name).sort()
        setAvailableModels(names)
      })
      .catch(() => { /* offline — picker shows just the configured model */ })
    return () => { cancelled = true }
  }, [disabled])

  function onChangeModel(name) {
    setOllamaModel(name)
    setModel(name)
  }

  function submit() {
    const t = text.trim()
    if (!t || busy) return
    if (mic.listening) mic.cancelMic()
    onSend(t)
    setText('')
    mic.rebase('')
  }

  function onKey(e) {
    // Enter sends, Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  useEffect(() => { ref.current?.focus() }, [])

  return (
    <div className="p-4">
      {mic.error ? (
        <p className="mb-2 text-[11px] text-amber-300/80">{mic.error}</p>
      ) : null}
      <div className="relative">
        {/* Gradient glow behind the input */}
        <div
          className="absolute -inset-2 rounded-2xl blur-2xl pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 80%, rgba(99,102,241,0.28) 0%, rgba(217,70,239,0.18) 45%, transparent 75%)',
            opacity: 0.85,
          }}
        />
        {/* Unified input box — textarea + toolbar inside one glass container */}
        <div className="relative glass-input p-0 flex flex-col focus-within:border-[color:var(--color-border-strong)] transition-colors" style={{ background: 'rgba(6,8,16,0.82)' }}>
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => { setText(e.target.value); mic.rebase(e.target.value) }}
            onKeyDown={onKey}
            placeholder={
              disabled ? 'Enable Ollama in the gear menu to chat.'
              : mic.listening ? 'Listening… click mic again to transcribe'
              : mic.transcribing ? 'Transcribing with Whisper…'
              : 'Ask anything about your knowledge base… (Enter to send, Shift+Enter for newline)'
            }
            disabled={disabled}
            rows={4}
            className="w-full bg-transparent text-sm resize-none disabled:opacity-50 px-3.5 pt-3.5 pb-2 outline-none placeholder:text-white/25"
          />
          {/* Toolbar row */}
          <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
            <ModelPicker
              value={model}
              options={availableModels}
              disabled={disabled}
              onChange={onChangeModel}
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              {mic.supported ? (
                <button
                  onClick={mic.toggleMic}
                  disabled={disabled || busy || mic.transcribing}
                  className={`h-10 w-10 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    mic.listening
                      ? 'bg-rose-500/25 text-rose-200 hover:bg-rose-500/35'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.08]'
                  }`}
                  aria-label={mic.listening ? 'Stop dictation' : 'Start dictation'}
                  title={mic.listening ? 'Stop dictation' : 'Speak to type (local Whisper)'}
                >
                  {mic.listening ? (
                    <span className="relative inline-flex">
                      <Mic size={14} />
                      <span className="absolute -inset-1 rounded-full bg-rose-400/40 animate-ping" />
                    </span>
                  ) : mic.transcribing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Mic size={14} />
                  )}
                </button>
              ) : (
                <button
                  disabled
                  className="h-10 w-10 flex items-center justify-center rounded-lg text-white/30 cursor-not-allowed"
                  aria-label="Mic unavailable"
                  title="This browser doesn't support MediaRecorder"
                >
                  <MicOff size={14} />
                </button>
              )}
              {busy || voicePlaying ? (
                <button
                  onClick={onStop}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-rose-100 bg-rose-500/25 hover:bg-rose-500/35 transition-colors"
                  title={busy ? 'Stop generating (Esc)' : 'Stop voice (Esc)'}
                  aria-label="Stop"
                >
                  <Square size={13} fill="currentColor" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={submit}
                  disabled={disabled || !text.trim()}
                  className="btn btn-primary disabled:opacity-40 disabled:cursor-not-allowed h-10 w-10 p-0"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CitedDocsHint({ retrieved }) {
  if (!retrieved || retrieved.length === 0) return null
  return (
    <div className="text-[11px] text-[color:var(--color-text-tertiary)] mb-3 inline-flex items-center gap-2 flex-wrap">
      <Sparkles size={11} /> Grounded in:
      {retrieved.map((r) => (
        <Link
          key={r.meta.id}
          to={`/documents/${r.meta.id}`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/80"
        >
          <FileText size={10} /> {r.meta.title.slice(0, 40)}
        </Link>
      ))}
    </div>
  )
}

export default function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const confirm = useConfirm()
  const {
    documents, documentContents, folders,
    manualContent, saves,
    memoryEntries, isMemoryDismissed,
    userTopics, isFollowing,
    userNotes,
    createConversation, updateConversation, deleteConversation, addChatMessage, patchChatMessage,
    conversationById, chatMessagesFor,
    addMemory, addUserTopic,
    recentSearches,
  } = useStore()
  const { seedMemory, topics: seedTopics, contentById } = useSeed()

  const conversation = id ? conversationById(id) : null
  const messages = id ? chatMessagesFor(id) : []
  const allDocs = useMemo(() => Object.values(documents || {}), [documents])
  const allUserTopics = useMemo(() => Object.values(userTopics || {}), [userTopics])
  const starterSearches = useMemo(() => recentSearches(6), [recentSearches])
  const starterSignals = useMemo(() => localSignalsStorage.listSignals(), [])

  // Normalized pool of non-document saved content for retrieval scoring.
  // Includes manually added URLs and bookmarked items (saves with stored snapshots).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const contentPool = useMemo(() => {
    const pool = []
    const seenIds = new Set()
    for (const entry of Object.values(manualContent || {})) {
      const it = entry.item
      if (!it?.id || seenIds.has(it.id)) continue
      seenIds.add(it.id)
      pool.push({ id: it.id, title: it.title || '', summary: it.summary || it.excerpt || '', url: it.url || null, type: it.type || 'article', _kind: 'content' })
    }
    for (const [sid, entry] of Object.entries(saves || {})) {
      if (seenIds.has(sid)) continue
      seenIds.add(sid)
      const it = entry.item || contentById?.(sid) || null
      if (!it) continue
      pool.push({ id: it.id || sid, title: it.title || '', summary: it.summary || it.excerpt || '', url: it.url || null, type: it.type || 'article', _kind: 'content' })
    }
    return pool
  }, [manualContent, saves]) // contentById is stable seed data — safe to omit

  const searchablePool = useMemo(() => [...allDocs, ...contentPool], [allDocs, contentPool])

  const [streamingText, setStreamingText] = useState('')
  const [busy, setBusy] = useState(false)
  const [retrievedHint, setRetrievedHint] = useState([])
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  // Track whether ElevenLabs TTS is currently speaking — drives the Stop
  // button and Esc hotkey when there's no active stream but voice is alive.
  const [voicePlaying, setVoicePlaying] = useState(false)
  useEffect(() => subscribeVoicePlaying(setVoicePlaying), [])
  const [suggestions, setSuggestions] = useState(null)
  // Ref so the action handler can read the latest assistant text without stale closure
  const latestAssistantRef = useRef('')
  const abortRef = useRef(null)
  const scrollRef = useRef(null)

  const [agentSteps, setAgentSteps] = useState([])
  const [pendingApproval, setPendingApproval] = useState(null)
  const approvalResolveRef = useRef(null)

  // Probe Ollama on mount (and whenever enabled flips) so we can surface a
  // helpful banner early rather than waiting for a send to fail.
  // 'ok' | 'no-instance' | 'no-model' | 'disabled' | null (probing)
  const [ollamaProbe, setOllamaProbe] = useState(null)
  useEffect(() => {
    if (!OLLAMA_CONFIG.enabled) { setOllamaProbe('disabled'); return }
    setOllamaProbe(null) // probing
    probeOllama().then(setOllamaProbe).catch(() => setOllamaProbe('no-instance'))
  }, []) // run once on mount; re-runs if user reloads after toggling

  function onApproveHandler() {
    approvalResolveRef.current?.approve()
    approvalResolveRef.current = null
    setPendingApproval(null)
  }

  function onDenyHandler() {
    approvalResolveRef.current?.deny()
    approvalResolveRef.current = null
    setPendingApproval(null)
  }

  // Single-shot interrupt — cancels the in-flight Ollama stream (whatever
  // text was generated so far stays in the chat) and silences any TTS.
  function stopAll() {
    if (abortRef.current) {
      try { abortRef.current.abort() } catch {}
      abortRef.current = null
    }
    stopVoice()
  }

  // Esc hotkey at the chat root — only active while there's actually
  // something to stop. Doesn't interfere with the textarea otherwise.
  useEffect(() => {
    if (!busy && !voicePlaying) return
    function onKey(e) { if (e.key === 'Escape') stopAll() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, voicePlaying])

  // Sync the title draft whenever the active conversation changes (or its
  // title changes externally — e.g. when the auto-title from the first message
  // lands).
  useEffect(() => {
    setTitleDraft(conversation?.title || '')
    setEditingTitle(false)
  }, [conversation?.id, conversation?.title])

  function commitTitle() {
    if (!conversation) { setEditingTitle(false); return }
    const next = titleDraft.trim()
    if (!next) { setTitleDraft(conversation.title); setEditingTitle(false); return }
    if (next !== conversation.title) updateConversation(conversation.id, { title: next })
    setEditingTitle(false)
  }

  // Reset visible streaming state when switching conversation. Crucially we
  // DON'T abort the in-flight request here — when handleSend auto-creates a
  // conversation it triggers an id change milliseconds after kicking off the
  // stream, and aborting it would cancel the answer we just asked for. Any
  // in-flight stream finishes and writes to the conversation it started in.
  useEffect(() => {
    setStreamingText('')
    setRetrievedHint([])
    // Only clear `busy` if the stream was tied to the previous conversation;
    // when we auto-navigate to a new convo mid-send, busy should stay true.
  }, [id])

  // Abort any in-flight stream only when the Chat view unmounts (e.g. user
  // navigates to a different page). Same-page id changes do NOT abort.
  useEffect(() => () => abortRef.current?.abort(), [])

  // Auto-scroll on new messages or streamed text
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, streamingText])

  function newConversation() {
    abortRef.current?.abort()
    const conv = createConversation()
    navigate(`/chat/${conv.id}`)
  }

  async function askDelete() {
    if (!conversation) return
    const ok = await confirm({
      title: `Delete "${conversation.title}"?`,
      message: 'This deletes the conversation and all its messages.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) {
      deleteConversation(conversation.id)
      navigate('/chat')
    }
  }

  // ── FlowMap action runner ─────────────────────────────────────────────────
  // Parses <fm-action>{...}</fm-action> blocks from the AI reply, runs each
  // action against the store/router, and returns the cleaned display text.
  function runAssistantActions(rawText) {
    const re = /<fm-action>([\s\S]*?)<\/fm-action>/gi
    let m
    while ((m = re.exec(rawText)) !== null) {
      let action
      try { action = JSON.parse(m[1].trim()) } catch { continue }
      try {
        if (action.type === 'add_topic' && action.name) {
          addUserTopic({
            name:    String(action.name).trim(),
            summary: action.summary ? String(action.summary).trim() : 'Added via FlowMap AI.',
            source:  'chat-ai',
            query:   String(action.name).trim(),
          })
        } else if (action.type === 'save_memory' && action.content) {
          addMemory({
            category: action.category || 'research_note',
            content:  String(action.content).trim(),
            source:   'chat-ai',
          })
        } else if (action.type === 'navigate' && action.path) {
          setTimeout(() => navigate(String(action.path)), 800)
        }
      } catch { /* action failed silently */ }
    }
    return rawText.replace(/<fm-action>[\s\S]*?<\/fm-action>/gi, '').replace(/\n{3,}/g, '\n\n').trim()
  }

  async function handleSend(text) {
    let convId = id
    // Auto-create conversation on first message
    if (!convId) {
      const conv = createConversation()
      convId = conv.id
      navigate(`/chat/${conv.id}`, { replace: true })
    }
    addChatMessage(convId, { role: 'user', content: text })

    // Classify intent first — skip retrieval entirely for casual chat so the
    // model never responds to "hey" with retrieval-failure language.
    const intent = classifyIntent(text)

    // Create the abort controller early — shared across pipeline retrieval and
    // the Ollama stream so Esc / Stop cancels both at once.
    const ctrl = new AbortController()
    abortRef.current = ctrl

    // ── Retrieval ─────────────────────────────────────────────────────────────
    // Try the flow-ai hybrid pipeline first (semantic + keyword + multi-signal
    // reranking). Falls back to keyword-only when Ollama is off, the pipeline
    // errors, or it finds nothing above the relevance threshold.
    // Clear suggestions from the previous last assistant message so they don't
    // linger once the user has moved on to a new query.
    const prevMessages = chatMessagesFor(convId || id)
    const prevLast = prevMessages.length ? prevMessages[prevMessages.length - 1] : null
    if (prevLast?.role === 'assistant' && prevLast?.followUpSuggestions) {
      patchChatMessage(convId || id, prevLast.id, { followUpSuggestions: null })
    }
    setSuggestions(null)
    latestAssistantRef.current = ''

    // ── Agent loop (tool_use intent) ────────────────────────────────────────
    if (intent === 'tool_use') {
      const agentMemory = [
        ...(seedMemory || []).filter((m) => !isMemoryDismissed(m.id)),
        ...Object.values(memoryEntries || {}),
      ]
        .filter((m) => (m.status || 'active') === 'active' && m.content)
        .map((m) => ({ category: String(m.category || 'note'), content: String(m.content) }))

      setBusy(true)
      setAgentSteps([])
      setPendingApproval(null)

      const onAgentEvent = (event) => {
        if (event.type === 'awaiting_approval') {
          setPendingApproval(event.pendingApproval)
          approvalResolveRef.current = { approve: event.approve, deny: event.deny }
          return
        }
        setAgentSteps((prev) => [...prev, event])
      }

      try {
        const { steps, finalAnswer } = await runAgentLoop(text, {
          ctrl,
          memoryContext: agentMemory,
          onEvent: onAgentEvent,
        })
        addChatMessage(convId, { role: 'assistant', content: finalAnswer, agentSteps: steps })
      } finally {
        setBusy(false)
        setPendingApproval(null)
        approvalResolveRef.current = null
        abortRef.current = null
      }
      return
    }
    // ── Normal retrieval path continues ─────────────────────────────────────

    let pipelineResult = null
    let retrieved = []

    if (intent !== 'casual_chat') {
      pipelineResult = await retrieveWithPipeline(
        {
          query:            text,
          documents,
          documentContents,
          memoryEntries,
          saves,
          views:            {},           // TODO: wire useStore.views when available
          userTopics,
          seedTopics,
          signals:          localSignalsStorage.listSignals(),
          userNotes,
        },
        ctrl.signal,
      )

      if (pipelineResult) {
        // Map the doc/save results to the { meta, snippet } shape that CitedDocsHint
        // and the addChatMessage context block expect.
        retrieved = pipelineResult.legacyRetrieved.map((r) => ({
          meta: { id: r.id, title: r.title },
          snippet: r.snippet,
        }))
      } else {
        // Keyword-only fallback — used when Ollama is off or pipeline returned nothing.
        retrieved = retrieveDocuments(text, searchablePool, documentContents, 7)
      }
    }

    setRetrievedHint(retrieved)
    const allMemory = [
      ...(seedMemory || []).filter((m) => !isMemoryDismissed(m.id)),
      ...Object.values(memoryEntries || {}),
    ]
    const allTopics = [
      ...(seedTopics || []).map((t) => ({
        id: t.id, name: t.name, slug: t.slug, summary: t.summary || t.description, isUser: false, followed: isFollowing(t.id),
      })),
      ...Object.values(userTopics || {}).map((t) => ({
        id: t.id, name: t.name, slug: t.slug, summary: t.summary, isUser: true, followed: !!t.followed,
      })),
    ]
    // Per-item notes — flatten the userNotes map and resolve each itemId
    // back to a display title so the model knows what the note is about.
    // Falls back to the raw id when no item is found (deleted seeds, etc).
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
    // Compute allRecent BEFORE buildSystemMessage so we can pass recentMessages
    const allRecent = chatMessagesFor(convId) // includes the user msg we just added
    const systemMessage = buildSystemMessage(
      retrieved, text, allMemory, allTopics, allNotes, intent, folders,
      pipelineResult?.contextText ?? null,
      allDocs,
      allRecent.slice(-4, -1),
    )

    // Construct the message array for Ollama: system + recent history + new user msg.
    // Cap history at MAX_HISTORY to keep total prompt within small-model context windows
    // (~4k tokens). The system message alone can be 2–3k tokens (memory, topics, docs,
    // excerpts), so we only have room for the last few turns of dialogue.
    const MAX_HISTORY = 12 // 6 user+assistant pairs
    const recent = allRecent.length > MAX_HISTORY ? allRecent.slice(-MAX_HISTORY) : allRecent
    const llmMessages = [
      { role: 'system', content: systemMessage },
      ...recent.map((m) => ({ role: m.role, content: m.content })),
    ]

    setBusy(true)
    setStreamingText('')
    let assistantText = ''
    try {
      try {
        for await (const chunk of streamChat(llmMessages, { signal: ctrl.signal })) {
          assistantText += chunk
          setStreamingText(assistantText)
        }
      } catch { /* devWarn already fired in adapter */ }

      if (assistantText.trim()) {
        // Parse + run any <fm-action> blocks; get back clean prose for display.
        const displayText = runAssistantActions(assistantText)
        addChatMessage(convId, {
          role: 'assistant',
          content: displayText,
          citedDocumentIds: retrieved.map((r) => r.meta.id),
          context: {
            retrieved: retrieved.map((r) => ({ id: r.meta.id, title: r.meta.title, snippet: r.snippet })),
            memory: allMemory
              .filter((m) => (m.status || 'active') === 'active' && m.content)
              .map((m) => ({ category: m.category, content: m.content })),
            topics: allTopics.map((t) => ({ name: t.name, summary: t.summary, isUser: t.isUser, followed: t.followed })),
            notes: allNotes,
          },
        })
        if (VOICE_CONFIG.enabled) {
          playTtsForReply(displayText).catch(() => { /* logged inside */ })
        }
      } else {
        addChatMessage(convId, {
          role: 'assistant',
          content: '_No response from Ollama. Make sure the container is running and the configured model is pulled — check the dev console for details._',
        })
      }
    } finally {
      // Always reset busy — even if an unexpected error occurs above,
      // so the Composer never gets permanently locked.
      setStreamingText('')
      setBusy(false)
      abortRef.current = null
    }

    // Generate follow-up suggestions and persist them on the assistant message
    // so they survive page reloads. Cleared when user sends another message or clicks one.
    if (assistantText.trim()) {
      const cleanedForSuggestions = assistantText.replace(/<fm-action>[\s\S]*?<\/fm-action>/gi, '').trim()
      latestAssistantRef.current = cleanedForSuggestions
      const latestMessages = chatMessagesFor(convId)
      const assistantMsg = latestMessages[latestMessages.length - 1]
      generateFollowUps(text, cleanedForSuggestions, intent).then((result) => {
        setSuggestions(result)
        if (assistantMsg?.id && result) {
          patchChatMessage(convId, assistantMsg.id, { followUpSuggestions: result })
        }
      }).catch(() => {})
    }
  }

  // Auto-send when arriving from "Enhance with FlowAI" on Opportunity Radar
  const autoSendFiredRef = useRef(false)
  useEffect(() => {
    const msg = location.state?.autoSend
    if (!msg || !id || autoSendFiredRef.current) return
    autoSendFiredRef.current = true
    // Clear state so back-navigation doesn't re-trigger
    navigate(location.pathname, { replace: true, state: {} })
    handleSend(msg)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function handleSuggestionAction(action) {
    if (action === 'save-as-note') {
      const text = latestAssistantRef.current.trim()
      if (!text) return
      addMemory({
        category: 'research_note',
        content: text.slice(0, 600),
        source: 'chat-ai',
      })
      setSuggestions(null)
      return
    }
    const FOLLOW_UP_TEXT = {
      'generate-summary':       'Generate a summary of this',
      'generate-content-ideas': 'Generate content ideas based on this',
    }
    const followUpText = FOLLOW_UP_TEXT[action]
    if (followUpText) {
      setSuggestions(null)
      handleSend(followUpText)
    }
  }

  const ollamaOff = !OLLAMA_CONFIG.enabled

  return (
    // viewport - TopBar height - main's m-3 margins. Calc lets the composer
    // sit exactly at the bottom of the visible content area; flex-col below
    // pins it there while the messages list scrolls.
    <div className="flex" style={{ height: 'calc(100vh - 100px)' }}>
      <Sidebar activeId={id} onNew={newConversation} />

      <main className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-[color:var(--color-border-subtle)] px-6 py-3 flex items-center gap-3">
          <Sparkles size={16} className="text-[color:var(--color-text-tertiary)]" />
          {editingTitle && conversation ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
                if (e.key === 'Escape') { setTitleDraft(conversation.title); setEditingTitle(false) }
              }}
              className="glass-input text-base font-semibold tracking-tight flex-1"
            />
          ) : (
            <div className="group/title flex-1 min-w-0 flex items-center gap-1.5">
              <h1
                onDoubleClick={() => conversation && setEditingTitle(true)}
                className="text-base font-semibold tracking-tight truncate cursor-text min-w-0"
                title={conversation ? 'Double-click to rename — drag to select text' : ''}
              >
                {conversation?.title || 'Ask Flow.AI'}
              </h1>
              {conversation ? (
                <>
                  <button
                    onClick={async () => {
                      try { await navigator.clipboard.writeText(conversation.title || '') } catch { /* ignore */ }
                    }}
                    className="opacity-0 group-hover/title:opacity-100 p-1 rounded-lg hover:bg-white/[0.06] text-[color:var(--color-text-tertiary)] hover:text-white transition-opacity flex-shrink-0"
                    aria-label="Copy title"
                    title="Copy title"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={() => setEditingTitle(true)}
                    className="opacity-0 group-hover/title:opacity-100 p-1 rounded-lg hover:bg-white/[0.06] text-[color:var(--color-text-tertiary)] hover:text-white transition-opacity flex-shrink-0"
                    aria-label="Rename"
                    title="Rename"
                  >
                    <Pencil size={12} />
                  </button>
                </>
              ) : null}
            </div>
          )}
          {conversation ? (
            <button onClick={askDelete} className="btn text-xs text-rose-300 hover:text-rose-200 hover:border-rose-400/40">
              <Trash2 size={13} /> Delete
            </button>
          ) : null}
        </header>

        {ollamaOff ? (
          <div className="m-4 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-200/90 text-[12px] inline-flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              Ollama is off — open the gear menu (⚙ top right) to enable it. You'll also need a running container: <code className="text-white/70">docker run -d -p 11434:11434 -v ollama:/root/.ollama --name ollama ollama/ollama</code>
            </span>
          </div>
        ) : ollamaProbe === 'no-instance' ? (
          <div className="m-4 px-4 py-3 rounded-lg border border-rose-500/30 bg-rose-500/5 text-rose-200/90 text-[12px] inline-flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              Ollama is enabled but the container isn't reachable on port 11434.
              Start it: <code className="text-white/70">docker start ollama</code> (or <code className="text-white/70">docker run -d -p 11434:11434 -v ollama:/root/.ollama --name ollama ollama/ollama</code> if first run).
            </span>
          </div>
        ) : ollamaProbe === 'no-model' ? (
          <div className="m-4 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-200/90 text-[12px] inline-flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>
              Ollama is running but model <code className="text-white/70">{OLLAMA_CONFIG.model}</code> isn't pulled.
              Run: <code className="text-white/70">docker exec -it ollama ollama pull {OLLAMA_CONFIG.model}</code>
            </span>
          </div>
        ) : null}

        {(!conversation && messages.length === 0) ? (
          /* ── Centered empty state ──────────────────────────────────────── */
          <div
            className="flex-1 flex flex-col items-center justify-center px-6 overflow-auto"
            style={{ background: 'radial-gradient(ellipse 40% 30% at 50% 30%, rgba(20,184,166,0.07) 0%, transparent 70%), linear-gradient(160deg, #0d0f1c 0%, #07090f 100%)' }}
          >
            <div className="w-full max-w-[780px] flex flex-col items-center gap-5 pb-10">
              {/* Branding */}
              <div className="flex flex-col items-center gap-2 mb-2">
                <h1 className="text-4xl font-light tracking-tight">What would you like to learn?</h1>
                <p className="text-sm text-[color:var(--color-text-tertiary)] text-center max-w-lg">
                  Ask anything across your documents, topics, signals, and saved content.
                </p>
              </div>

              {/* Composer — centered */}
              <div className="w-full">
                <Composer
                  onSend={handleSend}
                  onStop={stopAll}
                  disabled={ollamaOff}
                  busy={busy}
                  voicePlaying={voicePlaying}
                />
              </div>

              {/* Starter prompts */}
              <StarterPromptGrid
                docs={allDocs}
                userTopics={allUserTopics}
                searches={starterSearches}
                signals={starterSignals}
                onSend={handleSend}
              />

              {allDocs.length === 0 ? (
                <p className="text-[12px] text-[color:var(--color-text-tertiary)]">
                  Add documents first via the <Link to="/documents" className="underline text-white">Documents page</Link>.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          /* ── Conversation mode ─────────────────────────────────────────── */
          <>
            <div
              ref={scrollRef}
              className="flex-1 overflow-auto py-6"
              style={{ background: '#f8fafc' }}
            >
              <div className="max-w-3xl mx-auto px-6">
              {messages.map((m, i) => (
                <React.Fragment key={m.id}>
                  <MessageBubble message={m} />
                  {m.role === 'assistant' && m.agentSteps?.length > 0 ? (
                    <AgentRunTimeline
                      steps={m.agentSteps}
                      pendingApproval={null}
                      onApprove={() => {}}
                      onDeny={() => {}}
                    />
                  ) : null}
                  {m.role === 'assistant' && (m.followUpSuggestions || (i === messages.length - 1 && suggestions)) ? (
                    <SuggestedPrompts
                      questions={(m.followUpSuggestions || suggestions)?.questions}
                      actions={(m.followUpSuggestions || suggestions)?.actions}
                      onSend={(q) => {
                        patchChatMessage(id, m.id, { followUpSuggestions: null })
                        setSuggestions(null)
                        handleSend(q)
                      }}
                      onAction={handleSuggestionAction}
                    />
                  ) : null}
                </React.Fragment>
              ))}
              {/* Live agent run — shown while the loop is executing */}
              {busy && agentSteps.length > 0 ? (
                <AgentRunTimeline
                  steps={agentSteps}
                  pendingApproval={pendingApproval}
                  onApprove={onApproveHandler}
                  onDeny={onDenyHandler}
                  isRunning={true}
                />
              ) : null}
              {streamingText ? <MessageBubble message={{ role: 'assistant', content: streamingText }} /> : null}
              {busy && !streamingText && agentSteps.length === 0 ? (
                <div className="flex justify-start mb-4">
                  <div className="rounded-2xl px-4 py-3 bg-slate-200/70">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot" style={{ animationDelay: '180ms' }} />
                      <span className="w-2 h-2 rounded-full bg-slate-400 typing-dot" style={{ animationDelay: '360ms' }} />
                    </div>
                  </div>
                </div>
              ) : null}
              {retrievedHint.length > 0 && (busy || streamingText) ? <CitedDocsHint retrieved={retrievedHint} /> : null}
              </div>
            </div>

            <div className="max-w-3xl mx-auto w-full">
              <Composer
                onSend={handleSend}
                onStop={stopAll}
                disabled={ollamaOff}
                busy={busy}
                voicePlaying={voicePlaying}
              />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
