import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, BookOpen, Plus, Check, Sparkles } from 'lucide-react'
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

export default function NewTopicModal({ open, onClose, prefill = null }) {
  const navigate = useNavigate()
  const { addUserTopic } = useStore()

  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [query, setQuery] = useState('')
  const [queryTouched, setQueryTouched] = useState(false)

  // Re-populate form whenever the modal opens OR the prefill changes while open.
  // Both deps are intentional: if the parent sets prefill and open in the same
  // render batch they both land here; if they arrive in separate renders the
  // prefill dep ensures the form still syncs even when open was already true.
  useEffect(() => {
    if (!open) return
    setName(prefill?.name ?? '')
    setSummary(prefill?.summary ?? '')
    setQuery(prefill?.query ?? '')
    setQueryTouched(!!prefill?.query)
  }, [open, prefill])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const trimmedName = name.trim()
  const canSave = trimmedName.length >= 1
  // If user hasn't customized query, mirror the name for live-fetching.
  const effectiveQuery = queryTouched ? query.trim() : trimmedName

  function handleSave() {
    if (!canSave) return
    try {
      const created = addUserTopic({
        name: trimmedName,
        summary: summary.trim() || null,
        query: effectiveQuery || trimmedName,
        source: 'query',
      })
      onClose()
      if (created?.slug) navigate(`/topic/${created.slug}`)
    } catch (err) {
      console.error('[NewTopicModal] handleSave failed:', err)
    }
  }

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[560px] max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
        style={LIQUID_GLASS}
      >
        <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpen size={16} className="text-[color:var(--color-topic)]" />
            <h2 className="text-base font-semibold text-white">New topic</h2>
            {prefill && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25">
                <Sparkles size={9} />
                AI recommended
              </span>
            )}
          </div>
          <button onClick={onClose} className="btn p-2" aria-label="Close"><X size={14} /></button>
        </header>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-4">
          <div>
            <label htmlFor="new-topic-name" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
              Name *
            </label>
            <input
              id="new-topic-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vector databases, Tauri, RAG patterns"
              className="glass-input w-full text-sm"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="new-topic-summary" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
              Summary <span className="text-white/30 normal-case ml-1">(optional)</span>
            </label>
            <textarea
              id="new-topic-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder="Why this topic matters to you, what you want to track…"
              className="glass-input w-full text-sm resize-none"
            />
          </div>

          <div>
            <label htmlFor="new-topic-query" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
              Live query <span className="text-white/30 normal-case ml-1">(optional — defaults to the name)</span>
            </label>
            <input
              id="new-topic-query"
              value={queryTouched ? query : trimmedName}
              onChange={(e) => { setQuery(e.target.value); setQueryTouched(true) }}
              placeholder={trimmedName || 'Search query used to fetch live results on the topic page'}
              className="glass-input w-full text-sm font-mono"
            />
            <p className="mt-1.5 text-[11px] text-[color:var(--color-text-tertiary)]">
              The Topic page runs this query against all your sources every time you visit. Leave blank for a manual-only topic.
            </p>
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="btn text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="btn btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check size={13} /> Create topic
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
