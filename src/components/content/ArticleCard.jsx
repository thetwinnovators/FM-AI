import { useEffect, useState } from 'react'
import { Bookmark, BookmarkCheck, EyeOff, FileText } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { getOgImage } from '../../lib/search/ogImage.js'
import ReasonBadges from '../ui/ReasonBadges.jsx'

export default function ArticleCard({ item, onOpen }) {
  const { isSaved, toggleSave, dismiss } = useStore()
  const saved = isSaved(item.id)
  const [imageUrl, setImageUrl] = useState(item.thumbnail || null)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    if (imageUrl || !item.url) return
    let cancelled = false
    // Spread requests across 2s to avoid rate-limiting when many cards mount together
    const delay = Math.random() * 2000
    const timer = setTimeout(() => {
      getOgImage(item.url).then((url) => {
        if (!cancelled && url) setImageUrl(url)
      })
    }, delay)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [item.url, imageUrl])

  const showImage = imageUrl && !imageFailed

  return (
    <article
      onClick={() => onOpen?.(item)}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] hover:bg-[color:var(--color-bg-glass-strong)] hover:border-[color:var(--color-border-default)] transition-colors flex flex-col"
    >
      {showImage ? (
        <div className="relative aspect-video bg-black/40 overflow-hidden">
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : null}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-6 h-6 rounded-md bg-[color:var(--color-article)]/15 flex items-center justify-center text-[color:var(--color-article)]">
            <FileText size={12} />
          </span>
          <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-article)] font-medium truncate">
            {item.source}
          </span>
        </div>

        <h3 className="text-[15px] font-semibold leading-snug line-clamp-3">{item.title}</h3>
        {item.summary ? (
          <p className="mt-2 text-xs text-[color:var(--color-text-secondary)] line-clamp-3">{item.summary}</p>
        ) : null}

        <ReasonBadges item={item} className="mt-2.5" />

        <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
          <span>{item.publishedAt}</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(item.id) }}
              className="p-1 rounded hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-rose-400/70"
              aria-label="Hide" title="Don't show again"
            >
              <EyeOff size={13} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleSave(item.id, item) }}
              className="p-1 rounded hover:bg-white/5"
              aria-label={saved ? 'Unsave' : 'Save'}
            >
              {saved ? <BookmarkCheck size={14} className="text-[color:var(--color-topic)]" /> : <Bookmark size={14} />}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
