import { Bookmark, BookmarkCheck, EyeOff, MessageCircle } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import ReasonBadges from '../ui/ReasonBadges.jsx'

export default function SocialPostCard({ item, onOpen }) {
  const { isSaved, toggleSave, dismiss } = useStore()
  const saved = isSaved(item.id)

  return (
    <article
      onClick={() => onOpen?.(item)}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] hover:bg-[color:var(--color-bg-glass-strong)] hover:border-[color:var(--color-border-default)] transition-colors p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-md bg-[color:var(--color-social-post)]/15 flex items-center justify-center text-[color:var(--color-social-post)]">
          <MessageCircle size={12} />
        </span>
        <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-social-post)] font-medium">
          {item.source}
        </span>
      </div>

      <p className="text-sm leading-snug line-clamp-4">{item.title}</p>
      <p className="mt-2 text-xs text-[color:var(--color-text-secondary)] line-clamp-3">{item.summary}</p>

      <ReasonBadges item={item} className="mt-2.5" />

      <div className="mt-3 flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
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
