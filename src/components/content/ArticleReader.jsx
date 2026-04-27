import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink, Bookmark, BookmarkCheck, FileText } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { getOgImage } from '../../lib/search/ogImage.js'

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

export default function ArticleReader({ item, onClose }) {
  const { isSaved, toggleSave, recordView } = useStore()
  const [imageUrl, setImageUrl] = useState(null)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (item) recordView(item.id)
  }, [item, recordView])

  // Reset image state whenever the article being shown changes — fixes the bug where
  // a previously-fetched OG image stays sticky when a new article opens.
  useEffect(() => {
    if (!item) return
    setImageUrl(item.thumbnail || null)
    setImageFailed(false)
  }, [item?.id])

  useEffect(() => {
    if (!item || imageUrl || !item.url) return
    let cancelled = false
    getOgImage(item.url).then((url) => {
      if (!cancelled && url) setImageUrl(url)
    })
    return () => { cancelled = true }
  }, [item, imageUrl])

  if (!item) return null
  const saved = isSaved(item.id)
  const showImage = imageUrl && !imageFailed

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-md flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[760px] max-h-[90vh] flex flex-col rounded-3xl overflow-hidden"
        style={LIQUID_GLASS}
      >
        <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

        {showImage ? (
          <div className="aspect-[1.91/1] bg-black/40 overflow-hidden flex-shrink-0">
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => setImageFailed(true)}
            />
          </div>
        ) : null}

        <header className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10 flex-shrink-0">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-medium text-[color:var(--color-article)]">
              <FileText size={11} /> Article · {item.source}
            </span>
            <h2 className="text-[19px] font-semibold leading-snug mt-1.5 text-white">{item.title}</h2>
            {item.publishedAt ? (
              <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-2">{item.publishedAt}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => toggleSave(item.id)}
              className="btn p-2"
              aria-label={saved ? 'Unsave' : 'Save'}
            >
              {saved
                ? <BookmarkCheck size={14} className="text-[color:var(--color-topic)]" />
                : <Bookmark size={14} />}
            </button>
            <button onClick={onClose} className="btn p-2" aria-label="Close"><X size={14} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-6 py-5 text-[15px] leading-relaxed">
          <p className="text-[color:var(--color-text-secondary)]">{item.summary}</p>

          {item.keyPoints?.length ? (
            <>
              <h3 className="mt-6 mb-3 text-[11px] uppercase tracking-wide text-white/50 font-semibold">
                Key points
              </h3>
              <ul className="space-y-2.5">
                {item.keyPoints.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-1 h-1 rounded-full bg-[color:var(--color-article)] mt-2.5 flex-shrink-0" />
                    <span className="text-white/85">{p}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <footer className="px-6 py-4 border-t border-white/10 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
            Reader view · summary by curator
          </span>
          <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-primary">
            Open original <ExternalLink size={13} />
          </a>
        </footer>
      </div>
    </div>,
    document.body
  )
}
