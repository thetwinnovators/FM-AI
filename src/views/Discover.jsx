import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, X } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { filterContent } from '../lib/filter.js'
import VideoCard from '../components/content/VideoCard.jsx'
import ArticleCard from '../components/content/ArticleCard.jsx'
import SocialPostCard from '../components/content/SocialPostCard.jsx'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'
import Chip from '../components/ui/Chip.jsx'

const TYPE_OPTS = [
  { id: '',             label: 'All' },
  { id: 'video',        label: 'Videos' },
  { id: 'article',      label: 'Articles' },
  { id: 'social_post',  label: 'Posts' },
]

const PAGE_SIZE = 20

export default function Discover() {
  const [params] = useSearchParams()
  const initialQuery = params.get('q') || ''
  const relatedToNodeId = params.get('node') || null
  const { topics, content, topicById, toolById, creatorById, conceptById, companyById, tagById } = useSeed()
  const { isDismissed, dismiss } = useStore()

  const focusNode = relatedToNodeId
    ? (topicById(relatedToNodeId) || toolById(relatedToNodeId) || creatorById(relatedToNodeId) ||
       conceptById(relatedToNodeId) || companyById(relatedToNodeId) || tagById(relatedToNodeId))
    : null
  const focusLabel = focusNode?.name || focusNode?.title || relatedToNodeId

  const [query, setQuery] = useState(initialQuery)
  const [type, setType] = useState('')
  const [topicIds, setTopicIds] = useState([])
  const [page, setPage] = useState(1)
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  const filtered = useMemo(
    () => filterContent(content, { query, type, topicIds, relatedToNodeId, sort: 'newest' })
      .filter((it) => !isDismissed(it.id)),
    [content, query, type, topicIds, relatedToNodeId, isDismissed]
  )

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filtered.length

  function toggleTopic(id) {
    setTopicIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])
    setPage(1)
  }

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  return (
    <div className="p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          {filtered.length} items{' '}
          {focusLabel ? <>related to <span className="text-white">{focusLabel}</span></> : null}
          {query ? <> matching "<span className="text-white">{query}</span>"</> : null}
        </p>
      </header>

      {/* Filter bar */}
      <div className="glass-panel p-3 mb-6 flex items-center gap-3 flex-wrap sticky top-3 z-10">
        <Filter size={14} className="text-[color:var(--color-text-tertiary)]" />

        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          placeholder="Filter…"
          className="glass-input text-sm flex-1 min-w-[160px] max-w-[280px]"
        />

        <div className="flex items-center gap-1">
          {TYPE_OPTS.map((t) => (
            <button
              key={t.id || 'all'}
              onClick={() => { setType(t.id); setPage(1) }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                type === t.id
                  ? 'bg-[color:var(--color-topic)]/15 text-[color:var(--color-topic)] border border-[color:var(--color-topic)]/40'
                  : 'text-[color:var(--color-text-secondary)] hover:bg-white/5 border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {topics.map((t) => {
            const on = topicIds.includes(t.id)
            return (
              <Chip
                key={t.id}
                color={on ? '#d946ef' : undefined}
                onClick={() => toggleTopic(t.id)}
              >
                {t.name}
              </Chip>
            )
          })}
        </div>
      </div>

      {/* Stream */}
      {visible.length === 0 ? (
        <p className="text-sm text-[color:var(--color-text-tertiary)] py-16 text-center">
          Nothing matches. Loosen your filters.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map((it) => (
              <div key={it.id} className="relative group">
                <button
                  onClick={(e) => { e.stopPropagation(); dismiss(it.id) }}
                  className="absolute top-3 right-3 p-1.5 rounded-md bg-black/40 border border-white/10 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  aria-label="Dismiss"
                >
                  <X size={12} />
                </button>
                {it.type === 'video' ? <VideoCard item={it} onOpen={open} /> :
                 it.type === 'article' ? <ArticleCard item={it} onOpen={open} /> :
                 <SocialPostCard item={it} onOpen={open} />}
              </div>
            ))}
          </div>
          <div className="text-center pt-6">
            {hasMore ? (
              <button onClick={() => setPage(page + 1)} className="btn">Load more</button>
            ) : (
              <p className="text-[11px] text-[color:var(--color-text-tertiary)]">End of feed.</p>
            )}
          </div>
        </>
      )}

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </div>
  )
}
