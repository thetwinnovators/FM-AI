import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Link as LinkIcon, AlertCircle, Play, FileText, Plus, Check, ShieldAlert } from 'lucide-react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'
import { fetchPreview, detectProvider, isValidUrl } from '../../lib/manualIngest.js'
import { checkUrl } from '../../lib/virustotal.js'

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

export default function UrlIngestModal({ open, onClose, defaultTopicId, defaultTopicSlug }) {
  const { topics: seedTopics } = useSeed()
  const { userTopics, addManualContent, manualContentByUrl } = useStore()

  const allTopics = [
    ...seedTopics.map((t) => ({ id: t.id, slug: t.slug, name: t.name, isUser: false })),
    ...Object.values(userTopics).map((t) => ({ id: t.id, slug: t.slug, name: t.name, isUser: true })),
  ]
  const initialTopicId = defaultTopicId
    || (defaultTopicSlug && allTopics.find((t) => t.slug === defaultTopicSlug)?.id)
    || ''

  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState('input')   // input | loading | preview | saved
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const [topicId, setTopicId] = useState(initialTopicId)
  const [tagsInput, setTagsInput] = useState('')
  const [relevanceNote, setRelevanceNote] = useState('')
  const [vtResult, setVtResult] = useState(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setUrl('')
    setPhase('input')
    setPreview(null)
    setError(null)
    setTopicId(initialTopicId)
    setTagsInput('')
    setRelevanceNote('')
    setVtResult(null)
  }, [open, initialTopicId])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const trimmed = url.trim()
  const valid = isValidUrl(trimmed)
  const provider = valid ? detectProvider(trimmed) : 'unknown'

  async function handleFetch(e) {
    e?.preventDefault?.()
    if (!valid) return
    setPhase('loading')
    setError(null)
    setVtResult(null)
    try {
      const [result, vt] = await Promise.all([fetchPreview(trimmed), checkUrl(trimmed)])
      setVtResult(vt)
      if (result.status === 'success') {
        setPreview(result)
        setPhase('preview')
      } else {
        setError(result)
        setPhase('input')
      }
    } catch (err) {
      setError({ errorCode: 'fetch_failed', message: err?.message || 'Fetch failed.' })
      setPhase('input')
    }
  }

  function handleSave() {
    if (!preview?.item || !topicId) return
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
    addManualContent({
      item: { ...preview.item, topicIds: [topicId] },
      topicIds: [topicId],
      tags,
      relevanceNote: relevanceNote.trim() || null,
    })
    setPhase('saved')
    setTimeout(onClose, 700)
  }

  const existingDuplicate = preview ? manualContentByUrl(preview.item.url) : null

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[640px] max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
        style={LIQUID_GLASS}
      >
        <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

        <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <LinkIcon size={16} className="text-[color:var(--color-topic)]" />
            <h2 className="text-base font-semibold text-white">Add URL to topic</h2>
          </div>
          <button onClick={onClose} className="btn p-2" aria-label="Close"><X size={14} /></button>
        </header>

        <div className="flex-1 overflow-auto px-6 py-5">
          {phase === 'saved' ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-4">
                <Check size={20} className="text-emerald-300" />
              </div>
              <h3 className="text-base font-semibold text-white">Saved to topic</h3>
              <p className="text-sm text-[color:var(--color-text-tertiary)] mt-2">
                {preview?.item.title}
              </p>
            </div>
          ) : phase === 'preview' && preview ? (
            <PreviewBlock
              preview={preview}
              topicId={topicId}
              setTopicId={setTopicId}
              tagsInput={tagsInput}
              setTagsInput={setTagsInput}
              relevanceNote={relevanceNote}
              setRelevanceNote={setRelevanceNote}
              allTopics={allTopics}
              existingDuplicate={existingDuplicate}
              vtResult={vtResult}
            />
          ) : (
            <form onSubmit={handleFetch}>
              <label htmlFor="ingest-url" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
                URL
              </label>
              <div className="relative">
                <input
                  id="ingest-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a YouTube or article URL to add it to this topic"
                  className="glass-input w-full text-sm pr-24"
                  autoFocus
                  disabled={phase === 'loading'}
                />
                {valid ? (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wide font-medium text-[color:var(--color-creator)] bg-[color:var(--color-creator)]/10 border border-[color:var(--color-creator)]/30 rounded px-1.5 py-0.5">
                    {provider}
                  </span>
                ) : null}
              </div>

              {phase === 'loading' ? (
                <div className="mt-4 flex items-center gap-2 text-[12px] text-[color:var(--color-text-tertiary)]">
                  <Loader2 size={12} className="animate-spin" /> Fetching preview and checking metadata…
                </div>
              ) : null}

              {error ? (
                <div className="mt-4 inline-flex items-start gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-200/90 text-[12px]">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>{error.message}</span>
                </div>
              ) : null}

              <div className="mt-5 flex items-center justify-between">
                <p className="text-[11px] text-[color:var(--color-text-tertiary)]">
                  We'll fetch the preview before saving.
                </p>
                <button
                  type="submit"
                  disabled={!valid || phase === 'loading'}
                  className="btn btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {phase === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Fetch preview
                </button>
              </div>
            </form>
          )}
        </div>

        {phase === 'preview' && preview ? (
          <footer className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-2 flex-shrink-0">
            <button
              onClick={() => { setPhase('input'); setPreview(null) }}
              className="btn text-sm"
            >
              ← Change URL
            </button>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn text-sm">Cancel</button>
              <button
                onClick={handleSave}
                disabled={!topicId || Boolean(existingDuplicate)}
                className="btn btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check size={13} /> Save to topic
              </button>
            </div>
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  )
}

function PreviewBlock({
  preview, topicId, setTopicId, tagsInput, setTagsInput,
  relevanceNote, setRelevanceNote, allTopics, existingDuplicate, vtResult,
}) {
  const item = preview.item
  const Icon = item.type === 'video' ? Play : FileText
  const accent = item.type === 'video' ? 'var(--color-video)' : 'var(--color-article)'

  return (
    <div className="space-y-4">
      {/* Preview card */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.02]">
        {item.type === 'video' && item.youtubeId ? (
          <div className="aspect-video bg-black overflow-hidden">
            <iframe
              src={`https://www.youtube.com/embed/${item.youtubeId}?rel=0`}
              title={item.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        ) : item.thumbnail ? (
          <div className="aspect-video bg-black/40 overflow-hidden">
            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
        ) : null}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center"
              style={{ background: `color-mix(in srgb, ${accent} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`, color: accent }}
            >
              <Icon size={11} />
            </span>
            <span className="text-[11px] uppercase tracking-wide font-medium truncate" style={{ color: accent }}>
              {item.source}
            </span>
          </div>
          <h3 className="text-[16px] font-semibold leading-snug text-white">{item.title}</h3>
          {item.summary ? (
            <p className="mt-2 text-xs text-[color:var(--color-text-secondary)] line-clamp-3">{item.summary}</p>
          ) : null}
        </div>
      </div>

      {vtResult && !vtResult.unknown && !vtResult.clean ? (
        <div className="inline-flex items-start gap-2 px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-500/8 text-rose-200/90 text-[12px] w-full">
          <ShieldAlert size={13} className="flex-shrink-0 mt-0.5 text-rose-400" />
          <span>
            VirusTotal flagged this URL — {vtResult.malicious} malicious, {vtResult.suspicious} suspicious out of {vtResult.total} engines.
            {vtResult.permalink ? (
              <> <a href={vtResult.permalink} target="_blank" rel="noopener noreferrer" className="underline opacity-70 hover:opacity-100">View report</a>.</>
            ) : null}
            {' '}You can still save it.
          </span>
        </div>
      ) : null}

      {existingDuplicate ? (
        <div className="inline-flex items-start gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-200/90 text-[12px]">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>You've already added this URL.</span>
        </div>
      ) : null}

      {/* Topic selector */}
      <div>
        <label htmlFor="ingest-topic" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
          Save to topic *
        </label>
        <select
          id="ingest-topic"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className="glass-input w-full text-sm"
        >
          <option value="">— Choose a topic —</option>
          {allTopics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.isUser ? ' (saved)' : ''}</option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="ingest-tags" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
          Tags <span className="text-white/30 normal-case ml-1">(comma-separated, optional)</span>
        </label>
        <input
          id="ingest-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="claude, workflow, agent"
          className="glass-input w-full text-sm"
        />
      </div>

      {/* Relevance note */}
      <div>
        <label htmlFor="ingest-note" className="block text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">
          Why this matters <span className="text-white/30 normal-case ml-1">(optional)</span>
        </label>
        <textarea
          id="ingest-note"
          value={relevanceNote}
          onChange={(e) => setRelevanceNote(e.target.value)}
          rows={2}
          placeholder="Strong practical tutorial for agent workflows…"
          className="glass-input w-full text-sm resize-none"
        />
      </div>
    </div>
  )
}
