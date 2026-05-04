import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, ExternalLink, Globe, FileText, MessageCircle, Plus, Check, Bookmark, BookmarkCheck, Play, FileDown } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { fetchAll, groupByCategory, sortCategoryGroups } from '../lib/search/aggregate.js'
import { CATEGORY_LABELS } from '../lib/search/classify.js'
import { searchEntities } from '../lib/searchEntities.js'
import { getOgImage } from '../lib/search/ogImage.js'
import { Link } from 'react-router-dom'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'
import FileTypeChip from '../components/document/FileTypeChip.jsx'

function relativeDate(iso) {
  if (!iso) return ''
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (Number.isNaN(diff)) return ''
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function iconAndAccentFor(item) {
  if (item.type === 'pdf' || item.sourceType === 'pdf')
                               return { Icon: FileDown,     accent: '#f59e0b' }
  if (item.type === 'video')   return { Icon: Play,         accent: 'var(--color-video)' }
  if (item.type === 'social_post') return { Icon: MessageCircle, accent: 'var(--color-social-post)' }
  if (item.type === 'article') return { Icon: FileText,     accent: 'var(--color-article)' }
  return { Icon: Globe, accent: 'var(--color-article)' }
}

function ResultCard({ item, onOpen }) {
  const { Icon, accent } = iconAndAccentFor(item)
  const { isSaved, toggleSave } = useStore()
  const saved = isSaved(item.id)
  const [imageUrl, setImageUrl] = useState(item.thumbnail || null)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    if (imageUrl || !item.url) return
    let cancelled = false
    getOgImage(item.url).then((url) => {
      if (!cancelled && url) setImageUrl(url)
    })
    return () => { cancelled = true }
  }, [item.url, imageUrl])

  const showImage = imageUrl && !imageFailed

  function handleSave(e) {
    e.preventDefault()
    e.stopPropagation()
    toggleSave(item.id, item)
  }

  function handleExternal(e) {
    e.preventDefault()
    e.stopPropagation()
    window.open(item.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <article
      onClick={() => onOpen?.(item)}
      className="block rounded-2xl overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] hover:bg-[color:var(--color-bg-glass-strong)] hover:border-[color:var(--color-border-default)] transition-colors group flex flex-col cursor-pointer"
    >
      {showImage ? (
        <div className="aspect-[1.91/1] bg-black/40 overflow-hidden">
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
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${accent} 18%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`, color: accent }}
          >
            <Icon size={12} />
          </span>
          <span className="text-[11px] uppercase tracking-wide font-medium truncate" style={{ color: accent }}>
            {item.source}
          </span>
          <button
            onClick={handleExternal}
            className="ml-auto p-1 rounded text-[color:var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
            aria-label="Open original in new tab"
            title="Open original in new tab"
          >
            <ExternalLink size={11} />
          </button>
        </div>
        <h3 className="text-[15px] font-semibold leading-snug line-clamp-3">{item.title}</h3>
        {item.summary ? (
          <p className="mt-2 text-xs text-[color:var(--color-text-secondary)] line-clamp-3">{item.summary}</p>
        ) : null}
        <div className="mt-auto pt-3 flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
          <span>{item.publishedAt || ''}</span>
          <button
            onClick={handleSave}
            className="p-1 rounded hover:bg-white/10"
            aria-label={saved ? 'Unsave' : 'Save to memory'}
            title={saved ? 'Saved' : 'Save to memory'}
          >
            {saved
              ? <BookmarkCheck size={14} className="text-[color:var(--color-topic)]" />
              : <Bookmark size={14} />}
          </button>
        </div>
      </div>
    </article>
  )
}

function SeedResultRow({ kind, item }) {
  const href = kind === 'topics' ? `/topic/${item.slug}` : item.url
  const external = kind !== 'topics'
  const Tag = external ? 'a' : Link
  const props = external ? { href, target: '_blank', rel: 'noreferrer' } : { to: href }
  return (
    <Tag
      {...props}
      className="glass-panel p-4 hover:brightness-125 transition-all block"
    >
      <div className="text-[10px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] mb-1">{kind}</div>
      <h4 className="text-sm font-semibold">{item.name || item.title}</h4>
      {item.summary ? <p className="text-xs text-[color:var(--color-text-secondary)] mt-1 line-clamp-2">{item.summary}</p> : null}
    </Tag>
  )
}

function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function getSnippet(text, query) {
  if (!text || !query) return null
  const plain = stripHtml(text)
  const idx = plain.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return null
  const start = Math.max(0, idx - 55)
  const end = Math.min(plain.length, idx + query.length + 80)
  return (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '')
}

function DocCard({ doc, query }) {
  const snippet = getSnippet(doc.content, query) || getSnippet(doc.excerpt, query) || doc.summary || doc.excerpt
  const topicChips = (doc.tags || []).slice(0, 4)
  return (
    <article className="rounded-lg overflow-hidden border transition-colors flex flex-col group shadow-sm border-black/10 bg-slate-100 hover:bg-slate-200">
      <Link to={`/documents/${doc.id}`} className="block p-5 flex-1">
        <div className="flex items-center gap-2 mb-4">
          <FileTypeChip sourceType={doc.sourceType} fileName={doc.fileName} />
          {doc.fileName ? (
            <span className="text-[11px] text-gray-500 font-mono truncate min-w-0" title={doc.fileName}>
              {doc.fileName}
            </span>
          ) : null}
          <span className="text-[11px] text-gray-500 ml-auto flex-shrink-0">
            {relativeDate(doc.updatedAt || doc.createdAt)}
          </span>
        </div>
        <h3 className="text-[15px] font-semibold leading-snug line-clamp-2 text-gray-900">
          {doc.title || 'Untitled'}
        </h3>
        {snippet ? (
          <p className="mt-3 text-xs text-gray-600 line-clamp-3 leading-relaxed">{snippet}</p>
        ) : null}
        {topicChips.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {topicChips.map((tag, i) => (
              <span
                key={i}
                className="text-[10px] text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </Link>
      <div className="px-5 pb-3 text-[11px] text-gray-500">
        {doc.wordCount ? `${doc.wordCount} words` : ''}
      </div>
    </article>
  )
}

export default function Search() {
  const [params] = useSearchParams()
  const query = params.get('q') || ''
  const isWebMode = params.get('mode') === 'web'
  const navigate = useNavigate()
  const seed = useSeed()
  const { addUserTopic, userTopics, saves, views, dismisses, documents } = useStore()
  const userTopicSlugs = new Set(Object.values(userTopics).map((t) => t.slug))
  const slugForName = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '')

  function handleSaveSearchAsTopic() {
    if (!query.trim()) return
    const created = addUserTopic({ name: query.trim(), source: 'query', query: query.trim() })
    if (created) navigate(`/topic/${created.slug}`)
  }

  function handleFollowCategory(categoryId) {
    const label = CATEGORY_LABELS[categoryId] || categoryId
    const created = addUserTopic({ name: label, source: 'category', category: categoryId, query: query.trim() || label })
    if (created) navigate(`/topic/${created.slug}`)
  }

  const [state, setState] = useState({ status: 'idle', items: [], errors: [] })
  const abortRef = useRef(null)

  // Open clicked results in the same VideoPlayerModal / ArticleReader the rest
  // of the app uses, instead of bouncing the user out to a new tab.
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)
  function openItem(item) {
    if (!item) return
    if (item.type === 'pdf' || item.sourceType === 'pdf') {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    } else if (item.type === 'video') {
      setOpenVideo(item)
    } else {
      setOpenArticle(item)
    }
  }

  useEffect(() => {
    if (!query.trim()) {
      setState({ status: 'idle', items: [], errors: [] })
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState((s) => ({ ...s, status: 'loading' }))
    fetchAll(query, ctrl.signal, { seed, signals: { saves, views, dismisses } })
      .then((res) => {
        if (ctrl.signal.aborted) return
        setState({ status: 'done', items: res.items, errors: res.errors })
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setState({ status: 'done', items: [], errors: [{ source: 'all', error: err?.message || String(err) }] })
      })
    return () => ctrl.abort()
  }, [query])

  const seedHits = query ? searchEntities(query, seed) : null
  const seedTotal = seedHits
    ? Object.values(seedHits).reduce((sum, arr) => sum + arr.length, 0)
    : 0

  const docHits = query
    ? Object.values(documents || {}).filter((doc) => {
        const term = query.toLowerCase()
        return (
          (doc.title   || '').toLowerCase().includes(term) ||
          (doc.excerpt || '').toLowerCase().includes(term) ||
          stripHtml(doc.content || '').toLowerCase().includes(term)
        )
      })
    : []

  // SearXNG-style category tabs by sourceType. "All" preserves the topical
  // groupByCategory display below; specific tabs render a flat filtered grid.
  const [sourceTab, setSourceTab] = useState('all')
  const tabCounts = state.items.reduce((acc, it) => {
    acc.all += 1
    if (it.sourceType) acc[it.sourceType] = (acc[it.sourceType] || 0) + 1
    return acc
  }, { all: 0, article: 0, video: 0, news: 0, reference: 0, community: 0, pdf: 0, documents: 0 })
  // Documents only surface in FlowMap mode — not in web search
  if (!isWebMode) {
    tabCounts.documents = docHits.length
    tabCounts.all += docHits.length
  }
  const SOURCE_TABS = [
    { id: 'all',       label: 'All' },
    ...(!isWebMode ? [{ id: 'documents', label: 'Documents' }] : []),
    { id: 'article',   label: 'General' },
    { id: 'video',     label: 'Videos' },
    { id: 'pdf',       label: 'PDFs' },
    { id: 'news',      label: 'News' },
    { id: 'reference', label: 'Reference' },
    { id: 'community', label: 'Community' },
  ]
  const filteredItems = sourceTab === 'all' || sourceTab === 'documents'
    ? state.items
    : state.items.filter((it) => it.sourceType === sourceTab)

  const grouped = groupByCategory(filteredItems)
  const groups = sortCategoryGroups(grouped)
  const liveTotal = state.items.length

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          {query ? <>Results for "<span className="text-white">{query}</span>"</> : 'Type a query to search across your library and the live web.'}
        </p>
      </header>

      {query && isWebMode ? (
        <div className="mb-6 glass-panel px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[12px] text-[color:var(--color-text-secondary)]">
            Track this search? Save it as a topic to follow it on the Topics page.
          </div>
          <button
            onClick={handleSaveSearchAsTopic}
            disabled={userTopicSlugs.has(slugForName(query))}
            className={`btn ${userTopicSlugs.has(slugForName(query)) ? '' : 'btn-primary'} text-xs`}
          >
            {userTopicSlugs.has(slugForName(query))
              ? <><Check size={13} /> Saved as topic</>
              : <><Plus size={13} /> Save "{query.trim()}" as topic</>}
          </button>
        </div>
      ) : null}

      {!query ? (
        <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">
          Use the top bar to search topics, tools, creators, and live web content (Hacker News + Reddit).
        </p>
      ) : (
        <div className="space-y-10">

          <section>
            {/* SearXNG-style category tabs — slice by sourceType. Counts read
                straight from the items already fetched (no re-fetching on tab switch). */}
            <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
              <div className="flex gap-1 border-b border-[color:var(--color-border-subtle)] flex-wrap">
                {SOURCE_TABS.map((t) => {
                  const count = tabCounts[t.id] || 0
                  const active = sourceTab === t.id
                  const dimmed = count === 0 && t.id !== 'all'
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSourceTab(t.id)}
                      disabled={dimmed}
                      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                        active
                          ? 'border-[color:var(--color-topic)] text-white'
                          : dimmed
                            ? 'border-transparent text-[color:var(--color-text-tertiary)]/40 cursor-default'
                            : 'border-transparent text-[color:var(--color-text-tertiary)] hover:text-white'
                      }`}
                    >
                      {t.label} <span className="text-[11px] text-[color:var(--color-text-tertiary)]">{count}</span>
                    </button>
                  )
                })}
              </div>
              {state.status === 'loading' ? (
                <span className="text-[11px] text-[color:var(--color-text-tertiary)] inline-flex items-center gap-1.5 pb-2">
                  <Loader2 size={12} className="animate-spin" /> fetching…
                </span>
              ) : null}
            </div>

            {state.errors.length > 0 ? (
              <div className="mb-4 space-y-1">
                {state.errors.map((err, i) => (
                  <div key={i} className="text-[11px] text-amber-300/80 inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 mr-2">
                    <AlertCircle size={11} /> {err.source}: {err.error}
                  </div>
                ))}
              </div>
            ) : null}

            {sourceTab === 'documents' ? (
              docHits.length === 0 ? (
                <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">
                  No documents match "{query}".
                </p>
              ) : (
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 300px)' }}>
                  {docHits.map((doc) => <DocCard key={doc.id} doc={doc} query={query} />)}
                </div>
              )
            ) : state.status === 'loading' && state.items.length === 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] p-4 h-32 animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              state.status === 'done' ? (
                <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">
                  {sourceTab === 'all'
                    ? 'No live results. The seed library above may still have matches.'
                    : 'No results in this tab. Try another category.'}
                </p>
              ) : null
            ) : sourceTab !== 'all' ? (
              <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
                {filteredItems.map((it) => <ResultCard key={it.id} item={it} onOpen={openItem} />)}
              </div>
            ) : (
              <div className="space-y-8">
                {!isWebMode && docHits.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3 gap-3">
                      <h3 className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">
                        Documents <span className="text-[10px] text-[color:var(--color-text-tertiary)] ml-1">{docHits.length}</span>
                      </h3>
                    </div>
                    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, 300px)' }}>
                      {docHits.map((doc) => <DocCard key={doc.id} doc={doc} query={query} />)}
                    </div>
                  </div>
                ) : null}
                {groups.map(({ category, label, items }) => (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-3 gap-3">
                      <h3 className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">
                        {label} <span className="text-[10px] text-[color:var(--color-text-tertiary)] ml-1">{items.length}</span>
                      </h3>
                      {category !== 'uncategorized' ? (
                        <button
                          onClick={() => handleFollowCategory(category)}
                          disabled={userTopicSlugs.has(slugForName(label))}
                          className="btn text-[11px] py-1 px-2"
                        >
                          {userTopicSlugs.has(slugForName(label))
                            ? <><Check size={11} /> Following</>
                            : <><Plus size={11} /> Follow as topic</>}
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
                      {items.map((it) => <ResultCard key={it.id} item={it} onOpen={openItem} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </div>
  )
}
