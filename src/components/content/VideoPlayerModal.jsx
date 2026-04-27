import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, Play } from 'lucide-react'
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

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[1100px] max-h-[92vh] flex flex-col rounded-3xl overflow-hidden"
        style={LIQUID_GLASS}
      >
        {/* Top highlight strip — the 'liquid glass' specular */}
        <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

        <header className="flex items-start justify-between gap-4 px-6 py-4 border-b border-white/10 flex-shrink-0">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-medium text-[color:var(--color-video)]">
              <Play size={11} /> Video · {item.source}
            </span>
            <h2 className="text-[17px] font-semibold leading-snug mt-1 truncate text-white">{item.title}</h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={item.url} target="_blank" rel="noreferrer" className="btn p-2" aria-label="Open on YouTube">
              <ExternalLink size={14} />
            </a>
            <button onClick={onClose} className="btn p-2" aria-label="Close">
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="aspect-video bg-black flex-shrink-0">
          <iframe
            src={`https://www.youtube.com/embed/${item.youtubeId}?autoplay=1&rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        </div>

        <div className="overflow-auto px-6 py-5 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
          {item.summary ? <p>{item.summary}</p> : null}
          {item.keyPoints?.length ? (
            <>
              <h3 className="mt-5 mb-2 text-[11px] uppercase tracking-wide text-white/50 font-semibold">Key points</h3>
              <ul className="space-y-2">
                {item.keyPoints.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-1 h-1 rounded-full bg-[color:var(--color-video)] mt-2 flex-shrink-0" />
                    <span className="text-white/80">{p}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {item.publishedAt ? (
            <div className="mt-4 text-[11px] text-[color:var(--color-text-tertiary)]">Published {item.publishedAt}</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}
