import { Play, Bookmark, BookmarkCheck } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { useSeed } from '../../store/useSeed.js'

function formatDuration(sec) {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VideoCard({ item, onOpen }) {
  const { isSaved, toggleSave } = useStore()
  const { creatorById } = useSeed()
  const creator = creatorById(item.creatorId)
  const saved = isSaved(item.id)

  return (
    <article
      onClick={() => onOpen?.(item)}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] hover:bg-[color:var(--color-bg-glass-strong)] hover:border-[color:var(--color-border-default)] transition-colors"
    >
      <div className="relative aspect-video bg-black/40 overflow-hidden">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
            <Play size={18} className="text-white translate-x-0.5" />
          </div>
        </div>
        {item.durationSec ? (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[10px] bg-black/70 text-white rounded">
            {formatDuration(item.durationSec)}
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium leading-snug line-clamp-2">{item.title}</h3>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
          <span>{creator?.name ?? item.source}</span>
          <button
            onClick={(e) => { e.stopPropagation(); toggleSave(item.id) }}
            className="p-1 rounded hover:bg-white/5"
            aria-label={saved ? 'Unsave' : 'Save'}
          >
            {saved ? <BookmarkCheck size={14} className="text-[color:var(--color-topic)]" /> : <Bookmark size={14} />}
          </button>
        </div>
      </div>
    </article>
  )
}
