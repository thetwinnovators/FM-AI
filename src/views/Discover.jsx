import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, X, Loader2, Compass, RefreshCw } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { filterContent } from '../lib/filter.js'
import { fetchAll, isRecent } from '../lib/search/aggregate.js'
import { clearCache } from '../lib/search/cache.js'
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

const PAGE_SIZE = 24

export default function Discover() {
  const [params] = useSearchParams()
  const initialQuery = params.get('q') || ''
  const relatedToNodeId = params.get('node') || null
  const { topics, content, topicById, toolById, creatorById, conceptById, companyById, tagById } = useSeed()
  // dismisses/views read directly from state so the inbox useMemo recomputes
  // when they mutate. The isDismissed/viewCount selectors are stable (empty
  // useCallback deps), so React would otherwise skip recomputation after dismiss.
  const { isDismissed, dismiss, viewCount, userTopics, recentSearches, dismisses, views } = useStore()

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
  const [showRead, setShowRead] = useState(false)
  const [sortDiscover, setSortDiscover] = useState('newest')

  // Live items pulled from user topics + recent searches
  const [liveItems, setLiveItems] = useState([])
  const [liveStatus, setLiveStatus] = useState('idle')
  const [refreshTick, setRefreshTick] = useState(0)

  // Stable string key — re-fetch only when the set of queries actually changes
  const queriesKey = useMemo(() => {
    const set = new Set()
    Object.values(userTopics).forEach((t) => { if (t.query) set.add(t.query) })
    recentSearches(5).forEach((r) => { if (r.query) set.add(r.query) })
    return [...set].sort().join('|')
  }, [userTopics, recentSearches])

  useEffect(() => {
    if (!queriesKey) {
      setLiveItems([])
      setLiveStatus('idle')
      return
    }
    let cancelled = false
    setLiveStatus('loading')
    const queries = queriesKey.split('|').filter(Boolean)
    Promise.allSettled(queries.map((q) => fetchAll(q, undefined, { seed: { topics, topicById } }))).then((results) => {
      if (cancelled) return
      const out = []
      const seen = new Set()
      for (const r of results) {
        if (r.status !== 'fulfilled') continue
        for (const item of (r.value.items || [])) {
          if (seen.has(item.id)) continue
          seen.add(item.id)
          out.push(item)
        }
      }
      setLiveItems(out)
      setLiveStatus('done')
    })
    return () => { cancelled = true }
  }, [queriesKey, refreshTick])

  function handleRefresh() {
    clearCache()
    setRefreshTick((n) => n + 1)
  }

  // Inbox: combine seed + live, exclude viewed and dismissed, past 9 months only
  const inbox = useMemo(() => {
    const seedFiltered = filterContent(content, { query, type, topicIds, relatedToNodeId, sort: 'newest' })
      .filter(isRecent)
    // Live items don't have topicIds — we apply only query/type/dismiss/view filters to them
    const liveFiltered = liveItems.filter((it) => {
      if (type && it.type !== type) return false
      if (relatedToNodeId) return false  // node-filter only applies to seed
      if (query) {
        const q = query.toLowerCase()
        const hay = `${it.title || ''} ${it.summary || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    // De-dupe by id, then apply inbox filter
    const merged = [...seedFiltered, ...liveFiltered]
    const seen = new Set()
    const deduped = []
    for (const it of merged) {
      if (seen.has(it.id)) continue
      seen.add(it.id)
      deduped.push(it)
    }
    const filtered = showRead
      ? deduped.filter((it) => !isDismissed(it.id))
      : deduped.filter((it) => !isDismissed(it.id) && viewCount(it.id) === 0)
    if (sortDiscover === 'oldest') {
      filtered.sort((a, b) => (a.publishedAt || '').localeCompare(b.publishedAt || ''))
    } else if (sortDiscover === 'az') {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    } else if (sortDiscover === 'za') {
      filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''))
    } else {
      filtered.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
    }
    return filtered
  }, [content, liveItems, query, type, topicIds, relatedToNodeId, isDismissed, viewCount, showRead, dismisses, views, sortDiscover])

  const totalUnread = useMemo(() => {
    const merged = [...content, ...liveItems]
    const seen = new Set()
    let count = 0
    for (const it of merged) {
      if (seen.has(it.id)) continue
      seen.add(it.id)
      if (!isDismissed(it.id) && viewCount(it.id) === 0) count += 1
    }
    return count
  }, [content, liveItems, isDismissed, viewCount, dismisses, views])

  const visible = inbox.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < inbox.length

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
      <header className="mb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5">
            <Compass size={20} className="text-[color:var(--color-topic)]" /> Discover
          </h1>
          <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
            {showRead
              ? <>{inbox.length} {inbox.length === 1 ? 'item' : 'items'}</>
              : <>{totalUnread} unread {totalUnread === 1 ? 'item' : 'items'}</>}
            {focusLabel ? <> related to <span className="text-white">{focusLabel}</span></> : null}
            {query ? <> matching "<span className="text-white">{query}</span>"</> : null}
            {liveStatus === 'loading' ? (
              <span className="ml-2 inline-flex items-center gap-1.5 text-[11px] text-[color:var(--color-text-tertiary)]">
                <Loader2 size={11} className="animate-spin" /> fetching live
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRead((v) => !v)}
            className="btn text-xs"
          >
            {showRead ? 'Show only unread' : 'Show read items too'}
          </button>
          <button
            onClick={handleRefresh}
            className="btn text-xs"
            disabled={liveStatus === 'loading'}
          >
            <RefreshCw size={12} className={liveStatus === 'loading' ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </header>

      {/* Filter bar — opaque-ish frosted glass that fully overlays scrolling content */}
      <div
        className="p-3 mb-6 flex items-center gap-3 flex-wrap sticky top-3 z-20 rounded-2xl border border-white/10"
        style={{
          background: 'linear-gradient(160deg, rgba(11,13,24,0.88) 0%, rgba(5,7,15,0.92) 100%)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)',
        }}
      >
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

        <div className="w-px h-4 bg-white/10 flex-shrink-0" />

        <div className="flex items-center gap-1">
          {[
            { id: 'newest', label: 'Newest' },
            { id: 'oldest', label: 'Oldest' },
            { id: 'az',     label: 'A → Z'  },
            { id: 'za',     label: 'Z → A'  },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setSortDiscover(opt.id); setPage(1) }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                sortDiscover === opt.id
                  ? 'bg-[color:var(--color-topic)]/15 text-[color:var(--color-topic)] border border-[color:var(--color-topic)]/40'
                  : 'text-[color:var(--color-text-secondary)] hover:bg-white/5 border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

      </div>

      {/* Stream */}
      {visible.length === 0 ? (
        <div className="text-sm text-[color:var(--color-text-tertiary)] py-16 text-center">
          {totalUnread === 0 && !query && type === '' && topicIds.length === 0 ? (
            <>
              <Compass size={28} className="mx-auto mb-3 opacity-50" />
              <p>You're all caught up. Save more topics from <a href="/search" className="underline text-white">Search</a> to grow your inbox.</p>
            </>
          ) : (
            <p>Nothing matches. Loosen your filters or toggle "Show read items too".</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
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
