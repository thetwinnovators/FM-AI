import { useEffect } from 'react'
import { X, ExternalLink, Bookmark, BookmarkCheck } from 'lucide-react'
import { useStore } from '../../store/useStore.js'

export default function ArticleReader({ item, onClose }) {
  const { isSaved, toggleSave, recordView } = useStore()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (item) recordView(item.id)
  }, [item, recordView])

  if (!item) return null
  const saved = isSaved(item.id)

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="glass-panel h-full w-full max-w-[640px] m-3 flex flex-col overflow-hidden"
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[color:var(--color-border-subtle)]">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[color:var(--color-article)] font-medium mb-1">
              {item.source}
            </div>
            <h2 className="text-lg font-semibold leading-snug">{item.title}</h2>
            <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-1">{item.publishedAt}</div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button onClick={onClose} className="btn p-2" aria-label="Close"><X size={14} /></button>
            <button onClick={() => toggleSave(item.id)} className="btn p-2" aria-label={saved ? 'Unsave' : 'Save'}>
              {saved ? <BookmarkCheck size={14} className="text-[color:var(--color-topic)]" /> : <Bookmark size={14} />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-5 text-sm leading-relaxed">
          <p className="text-[color:var(--color-text-secondary)]">{item.summary}</p>

          {item.keyPoints?.length ? (
            <>
              <h3 className="mt-6 mb-2 text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium">
                Key points
              </h3>
              <ul className="space-y-2">
                {item.keyPoints.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-1 h-1 rounded-full bg-[color:var(--color-topic)] mt-2 flex-shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <footer className="px-5 py-3 border-t border-[color:var(--color-border-subtle)] flex items-center justify-between">
          <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
            Reader view · summary by curator
          </span>
          <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-primary">
            Open original <ExternalLink size={13} />
          </a>
        </footer>
      </aside>
    </div>
  )
}
