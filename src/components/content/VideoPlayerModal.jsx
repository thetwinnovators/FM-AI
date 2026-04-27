import { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { useStore } from '../../store/useStore.js'

export default function VideoPlayerModal({ item, onClose }) {
  const { recordView } = useStore()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (item) recordView(item.id)
  }, [item, recordView])

  if (!item) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-[1000px] max-h-[90vh] flex flex-col overflow-hidden"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-border-subtle)]">
          <h2 className="text-sm font-medium truncate pr-4">{item.title}</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={item.url} target="_blank" rel="noreferrer" className="btn p-2" aria-label="Open on YouTube">
              <ExternalLink size={14} />
            </a>
            <button onClick={onClose} className="btn p-2" aria-label="Close">
              <X size={14} />
            </button>
          </div>
        </header>
        <div className="aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${item.youtubeId}?autoplay=1&rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
        {item.summary ? (
          <div className="p-4 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
            {item.summary}
          </div>
        ) : null}
      </div>
    </div>
  )
}
