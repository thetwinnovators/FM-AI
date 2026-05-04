import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'
import VideoCard from '../content/VideoCard.jsx'
import ArticleCard from '../content/ArticleCard.jsx'
import SocialPostCard from '../content/SocialPostCard.jsx'
import VideoPlayerModal from '../content/VideoPlayerModal.jsx'
import ArticleReader from '../content/ArticleReader.jsx'

const TYPE_ORDER = { video: 0, article: 1, social_post: 2 }
const TYPE_LABELS = { video: 'Videos', article: 'Articles', social_post: 'Posts' }

export default function SavedItemsGrid() {
  const { contentById } = useSeed()
  const { saves } = useStore()
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)
  const [sortBy, setSortBy] = useState('recent') // 'recent' | 'type'

  // Resolve each saved id to either the stored snapshot (live items) or the seed lookup.
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

  // When sorting by type, group items under labelled section headers.
  const renderGrid = (list) => (
    <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
      {list.map((it) =>
        it.type === 'video'       ? <VideoCard      key={it.id} item={it} onOpen={open} /> :
        it.type === 'article'     ? <ArticleCard    key={it.id} item={it} onOpen={open} /> :
        <SocialPostCard key={it.id} item={it} onOpen={open} />
      )}
    </div>
  )

  const groups = sortBy === 'type'
    ? Object.entries(
        items.reduce((acc, it) => {
          const key = it.type || 'other'
          ;(acc[key] ||= []).push(it)
          return acc
        }, {})
      ).sort(([a], [b]) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99))
    : null

  return (
    <>
      {/* Sort control */}
      <div className="flex items-center gap-2 mb-4">
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
      </div>

      {groups ? (
        <div className="space-y-8">
          {groups.map(([type, list]) => (
            <div key={type}>
              <h3 className="text-[11px] uppercase tracking-wide text-white/50 font-semibold mb-3">
                {TYPE_LABELS[type] || type} <span className="text-[color:var(--color-text-tertiary)] ml-1">{list.length}</span>
              </h3>
              {renderGrid(list)}
            </div>
          ))}
        </div>
      ) : renderGrid(items)}

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </>
  )
}
