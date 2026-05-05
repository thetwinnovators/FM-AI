import { useState } from 'react'
import { Bookmark, BookmarkCheck, EyeOff, FileText, LayoutGrid, List, MessageCircle, Play } from 'lucide-react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'
import VideoCard from '../content/VideoCard.jsx'
import ArticleCard from '../content/ArticleCard.jsx'
import SocialPostCard from '../content/SocialPostCard.jsx'
import VideoPlayerModal from '../content/VideoPlayerModal.jsx'
import ArticleReader from '../content/ArticleReader.jsx'

const TYPE_ORDER  = { video: 0, article: 1, social_post: 2 }
const TYPE_LABELS = { video: 'Videos', article: 'Articles', social_post: 'Posts' }

// Per-type icon + colour token (mirrors card components).
const TYPE_META = {
  video:       { Icon: Play,          text: 'text-[color:var(--color-video,#e879f9)]',      bg: 'bg-[color:var(--color-video,#e879f9)]/15' },
  article:     { Icon: FileText,      text: 'text-[color:var(--color-article)]',             bg: 'bg-[color:var(--color-article)]/15' },
  social_post: { Icon: MessageCircle, text: 'text-[color:var(--color-social-post)]',         bg: 'bg-[color:var(--color-social-post)]/15' },
}

// ─── List-view row ────────────────────────────────────────────────────────────

function SavedItemRow({ item, onOpen }) {
  const { isSaved, toggleSave, dismiss } = useStore()
  const { creatorById } = useSeed()
  const saved = isSaved(item.id)

  const { Icon, text: textCls, bg: bgCls } = TYPE_META[item.type] ?? TYPE_META.article
  const creator = item.type === 'video' ? creatorById?.(item.creatorId) : null
  const source  = creator?.name ?? item.source ?? ''
  const thumb   = item.thumbnail

  return (
    <article
      onClick={() => onOpen?.(item)}
      className="group cursor-pointer flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] hover:bg-[color:var(--color-bg-glass-strong)] hover:border-[color:var(--color-border-default)] transition-colors"
    >
      {/* Thumbnail (video/article) or fallback type icon */}
      {thumb ? (
        <div className="relative flex-shrink-0 w-[64px] h-[40px] rounded-md overflow-hidden bg-black/30">
          <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
          {item.type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-black/55 flex items-center justify-center">
                <Play size={8} className="text-white translate-x-px" />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={`flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${bgCls}`}>
          <Icon size={14} className={textCls} />
        </div>
      )}

      {/* Title + source */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium leading-snug line-clamp-1">{item.title}</p>
        {source ? (
          <p className={`text-[11px] truncate mt-0.5 ${textCls} opacity-75`}>{source}</p>
        ) : null}
      </div>

      {/* Date + action buttons */}
      <div className="flex-shrink-0 flex items-center gap-0.5 text-[11px] text-[color:var(--color-text-tertiary)]">
        {item.publishedAt ? (
          <span className="hidden md:block mr-2 whitespace-nowrap">{item.publishedAt}</span>
        ) : null}
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
          {saved
            ? <BookmarkCheck size={13} className="text-[color:var(--color-topic)]" />
            : <Bookmark size={13} />}
        </button>
      </div>
    </article>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SavedItemsGrid() {
  const { contentById } = useSeed()
  const { saves } = useStore()
  const [openVideo,   setOpenVideo]   = useState(null)
  const [openArticle, setOpenArticle] = useState(null)
  const [sortBy,  setSortBy]  = useState('recent') // 'recent' | 'type'
  const [viewMode, setViewMode] = useState('grid')   // 'grid'  | 'list'

  // Resolve each saved id to either the stored snapshot or the seed lookup.
  const resolved = Object.entries(saves)
    .map(([id, save]) => save.item || contentById(id) || null)
    .filter(Boolean)

  const items = [...resolved].sort((a, b) => {
    if (sortBy === 'type') {
      const typeOrder = (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99)
      if (typeOrder !== 0) return typeOrder
    }
    const aSave = saves[a.id]?.savedAt || ''
    const bSave = saves[b.id]?.savedAt || ''
    return bSave.localeCompare(aSave)
  })

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-[color:var(--color-bg-glass-strong)] border border-[color:var(--color-border-default)] flex items-center justify-center mb-4">
          <Bookmark size={20} className="text-[color:var(--color-text-tertiary)]" />
        </div>
        <h3 className="text-base font-semibold">No saved items yet</h3>
        <p className="text-sm text-[color:var(--color-text-tertiary)] mt-2 max-w-md">
          Hit the bookmark icon on any video, article, or post to save it here.
        </p>
      </div>
    )
  }

  // Group helper used in both grid and list view when sort=type.
  const groups = sortBy === 'type'
    ? Object.entries(
        items.reduce((acc, it) => {
          const key = it.type || 'other'
          ;(acc[key] ||= []).push(it)
          return acc
        }, {})
      ).sort(([a], [b]) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99))
    : null

  // ── Card grid renderer ──
  const renderGrid = (list) => (
    <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
      {list.map((it, i) => (
        <div key={it.id} className="fm-fade-up" style={{ '--fm-delay': `${i * 35}ms` }}>
          {it.type === 'video'
            ? <VideoCard      item={it} onOpen={open} />
            : it.type === 'article'
            ? <ArticleCard    item={it} onOpen={open} />
            : <SocialPostCard item={it} onOpen={open} />}
        </div>
      ))}
    </div>
  )

  // ── List renderer ──
  const renderList = (list) => (
    <div className="flex flex-col gap-1.5">
      {list.map((it, i) => (
        <div key={it.id} className="fm-fade-up" style={{ '--fm-delay': `${i * 35}ms` }}>
          <SavedItemRow item={it} onOpen={open} />
        </div>
      ))}
    </div>
  )

  const renderItems = viewMode === 'grid' ? renderGrid : renderList

  return (
    <>
      {/* Toolbar: sort pills on the left, view-mode toggle on the right */}
      <div className="flex items-center gap-2 mb-4">
        {/* Sort */}
        <span className="text-[11px] text-[color:var(--color-text-tertiary)] uppercase tracking-wide">Sort</span>
        {['recent', 'type'].map((opt) => (
          <button
            key={opt}
            onClick={() => setSortBy(opt)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              sortBy === opt
                ? 'bg-[color:var(--color-topic)]/15 border-[color:var(--color-topic)]/40 text-[color:var(--color-topic)]'
                : 'border-[color:var(--color-border-subtle)] text-[color:var(--color-text-secondary)] hover:bg-white/5'
            }`}
          >
            {opt === 'recent' ? 'Recent' : 'Type'}
          </button>
        ))}

        {/* Separator */}
        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* View toggle */}
        <span className="text-[11px] text-[color:var(--color-text-tertiary)] uppercase tracking-wide">View</span>
        {[
          { id: 'grid', Icon: LayoutGrid, label: 'Card view'  },
          { id: 'list', Icon: List,       label: 'List view'  },
        ].map(({ id, Icon, label }) => (
          <button
            key={id}
            onClick={() => setViewMode(id)}
            aria-label={label}
            title={label}
            className={`p-1.5 rounded-md border transition-colors ${
              viewMode === id
                ? 'bg-[color:var(--color-topic)]/15 border-[color:var(--color-topic)]/40 text-[color:var(--color-topic)]'
                : 'border-[color:var(--color-border-subtle)] text-[color:var(--color-text-secondary)] hover:bg-white/5'
            }`}
          >
            <Icon size={13} />
          </button>
        ))}
      </div>

      {/* Content */}
      {groups ? (
        <div className="space-y-8">
          {groups.map(([type, list]) => (
            <div key={type}>
              <h3 className="text-[11px] uppercase tracking-wide text-white/50 font-semibold mb-3">
                {TYPE_LABELS[type] || type}{' '}
                <span className="text-[color:var(--color-text-tertiary)] ml-1">{list.length}</span>
              </h3>
              {renderItems(list)}
            </div>
          ))}
        </div>
      ) : renderItems(items)}

      <VideoPlayerModal item={openVideo}   onClose={() => setOpenVideo(null)}   />
      <ArticleReader    item={openArticle} onClose={() => setOpenArticle(null)} />
    </>
  )
}
