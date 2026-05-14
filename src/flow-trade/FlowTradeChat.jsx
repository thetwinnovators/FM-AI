import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Bot, Loader2, Globe } from 'lucide-react'
import { streamChat } from '../lib/llm/ollama.js'
import { useFlowTradeSSE } from './useFlowTradeSSE.js'

const URL_REGEX = /https?:\/\/[^\s]+/g

async function fetchPageContent(url) {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { Accept: 'text/plain' },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  const text = await res.text()
  return text.slice(0, 8000) // cap to keep context window sane
}

const SYSTEM = `You are a day trading assistant inside Flow Trade, a paper trading workspace.

Setup types the scanner detects:
- MOMENTUM BREAKOUT: price breaks above/below the 5-bar high/low with 1.5× average volume
- VWAP RECLAIM: price drops below VWAP for 3+ bars then crosses back above with 1.3× volume (long only)
- ORB (Opening Range Breakout): price breaks above/below the 9:30–9:45 AM range with 1.5× volume

When explaining a signal, cover: what triggered it, how clean the setup looks, the key levels to watch, and the main risk.

Keep responses concise — 3–5 sentences max unless the user asks for more detail. Be direct and practical. Never use markdown code blocks or backticks in your responses.`

// Strip markdown syntax so raw code/formatting never appears during streaming
function sanitize(raw) {
  if (!raw) return ''
  return raw
    // Complete code fences — keep inner text
    .replace(/```(?:[^\n`]*)?\n?([\s\S]*?)```/g, (_, inner) => inner.trim())
    // Incomplete trailing code fence (mid-stream) — drop the fence + everything after
    .replace(/```[^\n]*\n?[\s\S]*$/, '')
    // Inline code — strip backticks, keep content
    .replace(/`([^`\n]+)`/g, '$1')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Italic
    .replace(/\*([^*\s][^*]*)\*/g, '$1')
    // Heading hashes
    .replace(/^#{1,6}\s+/gm, '')
    // Collapse 3+ blank lines → 2
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function renderText(text) {
  return text.split('\n').map((line, i, arr) => (
    <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
  ))
}

function formatSignalContext(sig) {
  const dir = sig.direction?.toUpperCase() ?? ''
  const setup = (sig.setup_type ?? '').replace(/_/g, ' ').toUpperCase()
  return `New signal fired — ${sig.symbol} ${setup} ${dir}: entry $${sig.entry_zone_low?.toFixed(2)}–$${sig.entry_zone_high?.toFixed(2)}, stop $${sig.stop_level?.toFixed(2)}, target $${sig.target_level?.toFixed(2)}, R/R ${sig.risk_reward}:1. Rationale: "${sig.rationale}"`
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system-notice'

  if (isSystem) {
    return (
      <div className="mx-2 my-1 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300/80 leading-relaxed">
        {msg.content}
      </div>
    )
  }

  return (
    <div className={`flex gap-2 px-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center mt-0.5">
          <Bot size={11} className="text-violet-400" />
        </div>
      )}
      <div className={`max-w-[85%] text-[12px] leading-relaxed rounded-xl px-3 py-2 ${
        isUser
          ? 'bg-white/[0.08] text-white/80 rounded-br-sm'
          : 'bg-white/[0.04] text-white/70 rounded-bl-sm'
      }`}>
        {isUser
          ? (msg.content || <span className="opacity-40">…</span>)
          : (msg.content ? renderText(sanitize(msg.content)) : <span className="opacity-40">…</span>)
        }
      </div>
    </div>
  )
}

export function FlowTradeChat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState(null)
  const bottomRef = useRef(null)
  const abortRef  = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSSE = useCallback((event) => {
    if (event.type !== 'signal' && event.type !== 'signal_blocked') return
    const sig = event.data
    if (!sig) return

    const notice = formatSignalContext(sig)
    setMessages((prev) => [
      ...prev,
      { role: 'system-notice', content: `Signal: ${sig.symbol} ${(sig.setup_type ?? '').replace(/_/g, ' ').toUpperCase()} ${sig.direction?.toUpperCase()} — ${sig.rationale}` },
    ])

    // Auto-ask the AI to brief the signal
    sendMessage(`Briefly explain this signal: ${notice}`, true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useFlowTradeSSE(handleSSE)

  async function sendMessage(text, auto = false) {
    const content = (text ?? input).trim()
    if (!content || streaming || fetchingUrl) return
    if (!auto) setInput('')

    // Detect URLs and fetch page content via Jina Reader
    const urls = [...(content.match(URL_REGEX) ?? [])]
    let enrichedContent = content
    if (urls.length > 0) {
      const url = urls[0]
      setFetchingUrl(url)
      setMessages((prev) => [
        ...prev,
        { role: 'system-notice', content: `Reading page: ${url}` },
      ])
      try {
        const pageText = await fetchPageContent(url)
        enrichedContent = `[Page content from ${url}]:\n${pageText}\n\n---\n\n${content}`
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'system-notice', content: `Couldn't fetch ${url} — answering without it` },
        ])
      }
      setFetchingUrl(null)
    }

    const userMsg = { role: 'user', content: enrichedContent }
    const displayMsg = { role: 'user', content }           // show original text in chat
    setMessages((prev) => [...prev, displayMsg])
    setStreaming(true)

    const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
    const chatMessages = [
      { role: 'system', content: SYSTEM },
      ...history,
      userMsg,  // enriched (with page text) goes to LLM
    ]

    const assistantMsg = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, assistantMsg])

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      for await (const token of streamChat(chatMessages, { signal: ctrl.signal, temperature: 0.4, num_ctx: 8192 })) {
        if (ctrl.signal.aborted) break
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: updated[updated.length - 1].content + token }
          return updated
        })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center px-4">
            <Bot size={22} className="text-white/15" />
            <div className="text-[11px] text-white/25 leading-relaxed">
              Ask anything about signals, setups, or risk — or wait for a signal to fire and I'll brief it automatically.
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <Message key={i} msg={msg} />)
        )}
        {fetchingUrl && (
          <div className="flex gap-2 px-2 items-center">
            <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Globe size={11} className="text-blue-400 animate-pulse" />
            </div>
            <span className="text-[11px] text-blue-400/70 truncate max-w-[220px]">
              Fetching page…
            </span>
          </div>
        )}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-2 px-2">
            <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center mt-0.5 flex-shrink-0">
              <Loader2 size={11} className="text-violet-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.06] p-2 flex gap-1.5">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming || !!fetchingUrl}
          placeholder="Ask about signals, setups, or paste a URL…"
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-white/20 disabled:opacity-40"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || streaming || !!fetchingUrl}
          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/50 hover:text-white/80 disabled:opacity-30 transition-colors"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
