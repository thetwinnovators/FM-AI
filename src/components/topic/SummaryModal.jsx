import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, Sparkles, Copy, Check, FolderPlus, Square } from 'lucide-react'
import MarkdownView from '../content/MarkdownView.jsx'
import NotesEditor from '../content/NotesEditor.jsx'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import { streamTopicReport, itemSignature } from '../../lib/chat/summarize.js'
import { useStore } from '../../store/useStore.js'

const LIQUID_GLASS = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.07) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.15)',
  boxShadow:
    '0 30px 80px rgba(0,0,0,0.65),' +
    '0 8px 24px rgba(0,0,0,0.35),' +
    'inset 0 1px 0 rgba(255,255,255,0.20),' +
    'inset 0 -1px 0 rgba(255,255,255,0.05)',
}

const AI_MEMORY_FOLDER = 'AI Memory'

// Modal that streams a full markdown report on the user's topic collection
// and lets them save it as a document inside the "AI Memory" folder. Generation
// auto-starts when the modal opens and Ollama is enabled; the report is also
// cached on the topicSummaries store entry so reopening doesn't re-stream
// unnecessarily (a small "Regenerate" link kicks off a fresh run).
export default function SummaryModal({ open, topic, items, onClose }) {
  const navigate = useNavigate()
  const { topicSummaries, setTopicSummary, ensureFolderByName, addDocument } = useStore()
  const cached = topic?.id ? topicSummaries?.[topic.id] : null

  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [savedDocId, setSavedDocId] = useState(null)
  const abortRef = useRef(null)

  // Drive a generation run. We always replace the cached report on completion
  // so "Regenerate" always reflects the current item set.
  async function runReport() {
    if (!topic?.id || items.length === 0 || !OLLAMA_CONFIG.enabled || running) return
    setRunning(true)
    setError(null)
    setText('')
    setSavedDocId(null)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let buf = ''
    try {
      for await (const chunk of streamTopicReport(topic, items, { signal: ctrl.signal })) {
        buf += chunk
        setText(buf)
      }
      if (buf.trim()) {
        setTopicSummary(topic.id, {
          report: buf,
          generatedAt: new Date().toISOString(),
          itemSignature: itemSignature(items),
        })
      } else {
        setError('No response — is Ollama running?')
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Generation failed')
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }

  // When the modal opens: prefer cached report; otherwise stream a fresh one.
  useEffect(() => {
    if (!open) return
    setCopied(false)
    setSavedDocId(null)
    if (cached?.report) {
      setText(cached.report)
      setError(null)
    } else {
      setText('')
      runReport()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, topic?.id])

  // Close + cancel hotkeys
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') {
        if (running) abortRef.current?.abort()
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, running, onClose])

  // Abort any in-flight stream when the modal unmounts so closing mid-stream
  // doesn't keep tokens flowing in the background.
  useEffect(() => () => abortRef.current?.abort(), [])

  if (!open) return null

  async function handleCopy() {
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
      } catch { /* truly blocked */ }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function handleAddToMemory() {
    if (!text.trim() || !topic) return
    const folder = ensureFolderByName(AI_MEMORY_FOLDER)
    const doc = addDocument({
      title: `Summary: ${topic.name}`,
      plainText: text,
      folderId: folder?.id || null,
      sourceType: 'ai_summary',
    })
    setSavedDocId(doc?.id || null)
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl"
        style={LIQUID_GLASS}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Summary of ${topic?.name || 'topic'}`}
      >
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[color:var(--color-topic)]" />
            <h2 className="text-sm font-semibold text-white truncate">
              Summary · {topic?.name || ''}
            </h2>
            {running ? (
              <span className="text-[11px] text-[color:var(--color-text-tertiary)] inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-topic)] animate-pulse" />
                Streaming…
              </span>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[color:var(--color-text-tertiary)] hover:text-white hover:bg-white/[0.08] transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 glass-scroll">
          {error ? (
            <div className="text-[12px] text-amber-300/90 inline-flex items-center gap-2">
              {error}
            </div>
          ) : null}
          {text ? (
            <MarkdownView markdown={text} />
          ) : !error ? (
            <div className="text-[12px] text-[color:var(--color-text-tertiary)] inline-flex items-center gap-2">
              <Sparkles size={11} className="animate-pulse" /> Reading {items.length} item{items.length === 1 ? '' : 's'}…
            </div>
          ) : null}
        </div>

        {/* Notes pinned just above the action footer — stays visible while
            the report scrolls so the user can jot a thought without losing
            their place in the markdown above. */}
        {topic?.id ? (
          <div className="px-6 py-3 border-t border-white/[0.08] flex-shrink-0 max-h-[40%] overflow-auto glass-scroll">
            <NotesEditor itemId={`summary:${topic.id}`} />
          </div>
        ) : null}

        <div className="px-5 py-3 border-t border-white/[0.08] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={runReport}
              disabled={running || items.length === 0}
              className="text-[11px] text-[color:var(--color-text-tertiary)] hover:text-white disabled:opacity-40 inline-flex items-center gap-1 transition-colors"
            >
              Regenerate
            </button>
          </div>
          <div className="flex items-center gap-2">
            {running ? (
              <button
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-rose-100 bg-rose-500/25 hover:bg-rose-500/35 transition-colors"
              >
                <Square size={11} fill="currentColor" /> Stop
              </button>
            ) : null}
            <button
              onClick={handleCopy}
              disabled={!text.trim() || running}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white/90 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 disabled:opacity-40 transition-colors"
            >
              {copied ? <Check size={11} className="text-emerald-300" /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={savedDocId ? () => navigate(`/documents/${savedDocId}`) : handleAddToMemory}
              disabled={!text.trim() || running}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                savedDocId
                  ? 'text-white bg-teal-500/30 hover:bg-teal-500/45 border border-teal-400/50'
                  : 'text-white bg-[color:var(--color-topic)]/30 hover:bg-[color:var(--color-topic)]/45 border border-[color:var(--color-topic)]/40'
              }`}
            >
              {savedDocId ? <Check size={11} /> : <FolderPlus size={11} />}
              {savedDocId ? 'Saved to Memory' : 'Add to Memory'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
