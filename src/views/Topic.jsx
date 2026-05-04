import { useParams, Link } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Bookmark, BookmarkCheck, ChevronLeft, Loader2, AlertCircle, Sparkles, Trash2, LinkIcon, Pencil, Save, X, FilePlus, LayoutGrid, List, Play, FileText, EyeOff, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import VideoCard from '../components/content/VideoCard.jsx'
import ArticleCard from '../components/content/ArticleCard.jsx'
import SocialPostCard from '../components/content/SocialPostCard.jsx'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'
import Chip from '../components/ui/Chip.jsx'
import UrlIngestModal from '../components/ingest/UrlIngestModal.jsx'
import SummaryCard from '../components/topic/SummaryCard.jsx'
import SummaryModal from '../components/topic/SummaryModal.jsx'
import { useConfirm } from '../components/ui/ConfirmProvider.jsx'
import { fetchAll, groupByCategory, isRecent } from '../lib/search/aggregate.js'
import { buildTopicContext } from '../lib/search/topicContext.js'
import { getOgImage } from '../lib/search/ogImage.js'

// ─── content list card (list-view row) ───────────────────────────────────────

function ContentListCard({ item, onOpen, isFirst, isLast }) {
  const { isSaved, toggleSave, dismiss } = useStore()
  const { creatorById } = useSeed()
  const saved = isSaved(item.id)

  const [imageUrl, setImageUrl]     = useState(item.thumbnail || null)
  const [imageFailed, setImageFailed] = useState(false)

  // Lazy-fetch OG image for articles that don't already have a thumbnail
  useEffect(() => {
    if (item.type !== 'article' || imageUrl || !item.url) return
    let cancelled = false
    const timer = setTimeout(() => {
      getOgImage(item.url).then((url) => { if (!cancelled && url) setImageUrl(url) })
    }, Math.random() * 2000)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [item.url, item.type, imageUrl])

  const showImage   = imageUrl && !imageFailed
  const creator     = item.type === 'video' ? creatorById?.(item.creatorId) : null
  const sourceLabel = creator?.name ?? item.source ?? ''

  const radius = isFirst && isLast ? 'rounded-xl'
    : isFirst ? 'rounded-t-xl rounded-b-none'
    : isLast  ? 'rounded-t-none rounded-b-xl'
    : 'rounded-none'

  const TypeIcon = item.type === 'video' ? Play
    : item.type === 'social_post' ? MessageSquare
    : FileText

  return (
    <article
      onClick={() => onOpen?.(item)}
      className={`px-4 py-3 flex items-center gap-3 cursor-pointer bg-white/[0.03] hover:bg-white/[0.07] transition-colors group ${radius}`}
    >
      {/* thumbnail */}
      <div className="w-[80px] h-[48px] rounded-lg overflow-hidden relative shrink-0 bg-black/30 flex items-center justify-center">
        {showImage ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <TypeIcon size={14} className="text-white/25" />
        )}
        {item.type === 'video' && showImage && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/25">
            <Play size={11} className="text-white" />
          </div>
        )}
      </div>

      {/* source + title + summary */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-white/30 truncate mb-0.5">{sourceLabel}</p>
        <p className="text-sm font-medium text-white/85 truncate leading-snug">{item.title}</p>
        {item.summary ? (
          <p className="text-[11px] text-white/40 truncate leading-relaxed mt-0.5">{item.summary}</p>
        ) : null}
      </div>

      {/* date + actions */}
      <div className="flex items-center gap-2 shrink-0">
        {item.publishedAt ? (
          <span className="text-[10px] text-white/25 hidden lg:block">{item.publishedAt}</span>
        ) : null}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => dismiss(item.id)}
            className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-rose-400/70 transition-colors"
            aria-label="Hide" title="Don't show again"
          >
            <EyeOff size={12} />
          </button>
          <button
            onClick={() => toggleSave(item.id, item)}
            className="p-1 rounded hover:bg-white/5 text-white/30 transition-colors"
            aria-label={saved ? 'Unsave' : 'Save'}
          >
            {saved
              ? <BookmarkCheck size={13} className="text-[color:var(--color-topic)]" />
              : <Bookmark size={13} />}
          </button>
        </div>
      </div>
    </article>
  )
}

const TABS = [
  { id: 'all',         label: 'All'      },
  { id: 'video',       label: 'Videos'   },
  { id: 'article',     label: 'Articles' },
  { id: 'social_post', label: 'Posts'    },
  { id: 'saved',       label: 'Saved'    },
]

export default function Topic() {
  const { slug } = useParams()
  const seed = useSeed()
  const { topicBySlug, contentByTopic, toolById, conceptById, topicById } = seed
  const store = useStore()
  const { isFollowing, toggleFollow, userTopicBySlug, removeUserTopic, updateUserTopic, isSaved, manualContentForTopic, searches, manualContent, isDismissed, dismisses } = store
  const navigate = useNavigate()

  const confirm = useConfirm()

  const seedTopic = topicBySlug(slug)
  const userTopic = !seedTopic ? userTopicBySlug(slug) : null

  // Sync title draft when the active topic changes (or its name updates
  // via another tab). Skipped while editing so we don't clobber unsaved
  // input mid-keystroke.
  useEffect(() => {
    if (!editingTitle) setTitleDraft(userTopic?.name || seedTopic?.name || '')
  }, [userTopic?.id, userTopic?.name, seedTopic?.id, seedTopic?.name]) // eslint-disable-line react-hooks/exhaustive-deps

  function commitTitle() {
    if (!userTopic) { setEditingTitle(false); return }
    const next = titleDraft.trim()
    if (!next || next === userTopic.name) {
      setTitleDraft(userTopic.name)
      setEditingTitle(false)
      return
    }
    // If the auto-summary was never customized, refresh it to match the new name.
    const wasAutoSummary = userTopic.summary === `Saved from your search for "${userTopic.query || userTopic.name}".`
    const updated = updateUserTopic(userTopic.id, {
      name: next,
      ...(wasAutoSummary ? { summary: `Saved from your search for "${userTopic.query || next}".` } : {}),
    })
    setEditingTitle(false)
    if (updated && updated.slug !== userTopic.slug) {
      // Slug changed → URL is stale; redirect to the new one.
      navigate(`/topic/${updated.slug}`, { replace: true })
    }
  }

  function cancelEdit() {
    setTitleDraft(userTopic?.name || '')
    setEditingTitle(false)
  }
  const topic = seedTopic || userTopic
  const isUser = Boolean(userTopic)

  async function askRemoveUserTopic() {
    if (!topic) return
    const ok = await confirm({
      title: `Remove "${topic.name}"?`,
      message:
        'This stops tracking the topic. Any URLs you added to it stay in Memory > Added URLs but lose this topic label.',
      confirmLabel: 'Remove topic',
      danger: true,
    })
    if (ok) removeUserTopic(topic.id)
  }

  const [tab, setTab] = useState('all')
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('flowmap.topic.viewMode') ?? 'grid',
  )
  function handleViewMode(mode) {
    setViewMode(mode)
    localStorage.setItem('flowmap.topic.viewMode', mode)
  }
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)
  const [showIngest, setShowIngest] = useState(false)
  const [showSummaryModal, setShowSummaryModal] = useState(false)
  // Inline title edit — only for user-saved topics. The summary is also
  // rewritten on save so the auto-generated "Saved from your search for X"
  // stays in sync with the new name (unless the user already customized it).
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  // Measure the sticky header so the side rail can pin itself just below it
  // — header height varies with topic content (summary length, "why it matters",
  // live query line, etc.).
  const headerRef = useRef(null)
  const [headerHeight, setHeaderHeight] = useState(220)
  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => setHeaderHeight(el.offsetHeight)
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [])

  // Live-fetch state for user topics
  const [live, setLive] = useState({ status: 'idle', items: [], errors: [] })
  const abortRef = useRef(null)

  useEffect(() => {
    if (!isUser || !userTopic?.query) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLive({ status: 'loading', items: [], errors: [] })
    // Phase 3: build topic context so the ranker biases toward this topic's
    // historical pattern (intent distribution, preferred domains, tags, etc.).
    const topicContext = buildTopicContext(userTopic, { searches, manualContent, seed })
    fetchAll(userTopic.query, ctrl.signal, { seed, topicContext })
      .then((res) => {
        if (ctrl.signal.aborted) return
        setLive({ status: 'done', items: res.items, errors: res.errors })
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return
        setLive({ status: 'done', items: [], errors: [{ source: 'all', error: err?.message || String(err) }] })
      })
    return () => ctrl.abort()
  }, [isUser, userTopic?.query])

  if (!topic) {
    return (
      <div className="p-6">
        <Link to="/topics" className="text-sm text-[color:var(--color-text-tertiary)] hover:text-white inline-flex items-center gap-1">
          <ChevronLeft size={14} /> Back to topics
        </Link>
        <h1 className="text-2xl font-semibold mt-4">Topic not found</h1>
      </div>
    )
  }

  // Source items for filtering — seed content for seed topics, live items for user topics.
  // Past-9-months recency filter applies to all tabs except 'saved' (saved items are
  // intentional — user explicitly bookmarked them, regardless of age).
  let sourceItems
  if (isUser) {
    if (userTopic.source === 'category' && userTopic.category) {
      const grouped = groupByCategory(live.items)
      sourceItems = grouped[userTopic.category] || []
    } else {
      sourceItems = live.items
    }
  } else {
    sourceItems = contentByTopic(topic.id)
  }
  // Merge in manually-ingested content for this topic (always — recency filter
  // doesn't apply to user-curated additions)
  const manualForTopic = manualContentForTopic(topic?.id)
  if (manualForTopic.length) sourceItems = [...manualForTopic, ...sourceItems]
  if (tab !== 'saved') sourceItems = sourceItems.filter(isRecent)
  // Exclude items the user has explicitly hidden. Reading `dismisses` here
  // (even though isDismissed uses it internally) ensures this component
  // re-renders when the store changes.
  void dismisses
  sourceItems = sourceItems.filter((c) => !isDismissed(c.id))
  const items =
    tab === 'all'   ? sourceItems
    : tab === 'saved' ? sourceItems.filter((c) => isSaved(c.id))
    : sourceItems.filter((c) => c.type === tab)
  const followed = isUser ? true : isFollowing(topic.id)

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  return (
    <div className="p-6">
      <Link to="/topics" className="text-sm text-[color:var(--color-text-tertiary)] hover:text-white inline-flex items-center gap-1 mb-4">
        <ChevronLeft size={14} /> Back to topics
      </Link>

      {/* Hero — sticky so the topic title + Add URL / Remove stay reachable while scrolling.
          Inline style overrides glass-panel's translucent background with a darker opaque frost
          so scrolling content doesn't bleed through and make the title hard to read. */}
      <header
        ref={headerRef}
        className="glass-panel p-6 mb-6 flex items-start justify-between gap-6 sticky top-0 z-20"
        style={{
          background: 'linear-gradient(160deg, #0d0f1c 0%, #07090f 100%)',
          boxShadow:
            '0 18px 48px rgba(0,0,0,0.65),' +
            '0 6px 16px rgba(0,0,0,0.45),' +
            'inset 0 1px 0 rgba(255,255,255,0.10)',
        }}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[color:var(--color-topic)]" />
            <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-topic)] font-medium">topic</span>
            {isUser ? (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium text-[color:var(--color-creator)] px-1.5 py-0.5 rounded border border-[color:var(--color-creator)]/30 bg-[color:var(--color-creator)]/10">
                <Sparkles size={10} /> saved from {userTopic.source === 'category' ? 'category' : 'search'}
              </span>
            ) : null}
          </div>
          {isUser && editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitTitle() }
                  if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
                }}
                className="text-3xl font-semibold tracking-tight flex-1 glass-input"
              />
              <button onMouseDown={(e) => e.preventDefault()} onClick={commitTitle} className="btn" title="Save (Enter)">
                <Save size={13} /> Save
              </button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={cancelEdit} className="btn" title="Cancel (Esc)" aria-label="Cancel">
                <X size={13} />
              </button>
            </div>
          ) : (
            <div className="group flex items-center gap-2">
              <h1
                className="text-3xl font-semibold tracking-tight"
                onDoubleClick={() => isUser && setEditingTitle(true)}
                title={isUser ? 'Double-click to rename' : undefined}
              >
                {topic.name}
              </h1>
              {isUser ? (
                <button
                  onClick={() => setEditingTitle(true)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-[color:var(--color-text-tertiary)] hover:text-white hover:bg-white/[0.06]"
                  aria-label="Rename topic"
                  title="Rename"
                >
                  <Pencil size={13} />
                </button>
              ) : null}
            </div>
          )}
          <p className="mt-3 text-sm text-[color:var(--color-text-secondary)] max-w-3xl leading-relaxed">{topic.summary}</p>
          {topic.whyItMatters ? (
            <p className="mt-3 text-sm italic text-[color:var(--color-text-tertiary)] max-w-3xl">{topic.whyItMatters}</p>
          ) : null}
          {isUser && userTopic.query ? (
            <p className="mt-3 text-[12px] text-[color:var(--color-text-tertiary)]">
              Live query: <code className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/80">{userTopic.query}</code>
            </p>
          ) : null}
        </div>
        <div className="flex flex-row gap-2 flex-shrink-0">
          <button
            onClick={() => setShowIngest(true)}
            className="btn text-xs"
          >
            <FilePlus size={13} /> Add content
          </button>
          {isUser ? (
            <button
              onClick={askRemoveUserTopic}
              className="btn text-xs text-rose-300 hover:text-rose-200 hover:border-rose-400/40"
            >
              <Trash2 size={13} /> Remove topic
            </button>
          ) : (
            <button
              onClick={() => toggleFollow(topic.id)}
              className={`btn ${followed ? 'btn-primary' : ''}`}
            >
              {followed ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              {followed ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Side rail — always visible, sticks below the hero on lg+. Order is
            fixed: Summary, Related Topics, Tools, Concepts. Cards render with
            an empty state when the topic has no entries for that section. */}
        <aside
          className="space-y-4 lg:sticky lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-auto pr-1"
          style={{ top: `${headerHeight + 12}px` }}
        >
          <SummaryCard
            topic={topic}
            items={sourceItems}
            onGenerate={() => setShowSummaryModal(true)}
          />

          <div className="glass-panel p-4">
            <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">
              Related topics
            </h3>
            {topic.relatedTopicIds?.length ? (
              <div className="flex flex-wrap gap-2">
                {topic.relatedTopicIds.map((id) => {
                  const t = topicById(id)
                  return t ? <Link key={id} to={`/topic/${t.slug}`}><Chip color="#d946ef">{t.name}</Chip></Link> : null
                })}
              </div>
            ) : (
              <p className="text-[11px] text-[color:var(--color-text-tertiary)]">None linked yet.</p>
            )}
          </div>

          <div className="glass-panel p-4">
            <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Tools mentioned</h3>
            {topic.toolIds?.length ? (
              <ul className="space-y-2">
                {topic.toolIds.map((id) => {
                  const tool = toolById(id)
                  return tool ? (
                    <li key={id}>
                      <a href={tool.url} target="_blank" rel="noreferrer" className="text-sm hover:underline">
                        {tool.name}
                      </a>
                      <p className="text-[11px] text-[color:var(--color-text-tertiary)]">{tool.summary}</p>
                    </li>
                  ) : null
                })}
              </ul>
            ) : (
              <p className="text-[11px] text-[color:var(--color-text-tertiary)]">None tagged yet.</p>
            )}
          </div>

          <div className="glass-panel p-4">
            <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Concepts</h3>
            {topic.conceptIds?.length ? (
              <div className="flex flex-wrap gap-2">
                {topic.conceptIds.map((id) => {
                  const c = conceptById(id)
                  return c ? <Chip key={id} color="#94a3b8">{c.name}</Chip> : null
                })}
              </div>
            ) : (
              <p className="text-[11px] text-[color:var(--color-text-tertiary)]">None tagged yet.</p>
            )}
          </div>
        </aside>

        {/* Main content */}
        <section>
          {/* Tabs + view toggle */}
          <div className="flex gap-1 mb-4 border-b border-[color:var(--color-border-subtle)] flex-wrap">
            {TABS.map((t) => {
              const count =
                t.id === 'all'   ? sourceItems.length
                : t.id === 'saved' ? sourceItems.filter((c) => isSaved(c.id)).length
                : sourceItems.filter((c) => c.type === t.id).length
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-[color:var(--color-topic)] text-white'
                      : 'border-transparent text-[color:var(--color-text-tertiary)] hover:text-white'
                  }`}
                >
                  {t.label} <span className="text-[11px] text-[color:var(--color-text-tertiary)]">{count}</span>
                </button>
              )
            })}
            <div className="ml-auto flex items-center gap-2 pb-1 self-end">
              {isUser && live.status === 'loading' ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--color-text-tertiary)]">
                  <Loader2 size={12} className="animate-spin" /> fetching…
                </span>
              ) : null}
              <div className="flex items-center gap-px bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                {[
                  { mode: 'grid', Icon: LayoutGrid, title: 'Card view' },
                  { mode: 'list', Icon: List,       title: 'List view' },
                ].map(({ mode, Icon, title }) => (
                  <button
                    key={mode}
                    title={title}
                    onClick={() => handleViewMode(mode)}
                    className={`flex items-center justify-center w-6 h-6 rounded transition-colors ${
                      viewMode === mode
                        ? 'bg-white/[0.10] text-white/90'
                        : 'text-white/35 hover:text-white/65'
                    }`}
                  >
                    <Icon size={13} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Errors */}
          {isUser && live.errors.length > 0 ? (
            <div className="mb-4 space-y-1">
              {live.errors.map((err, i) => (
                <div key={i} className="text-[11px] text-amber-300/80 inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 mr-2">
                  <AlertCircle size={11} /> {err.source}: {err.error}
                </div>
              ))}
            </div>
          ) : null}

          {/* Content */}
          {items.length === 0 ? (
            isUser && live.status === 'loading' ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] p-4 h-32 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-px max-w-[760px]">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className={`h-[60px] bg-white/[0.03] animate-pulse ${i === 0 ? 'rounded-t-xl' : i === 7 ? 'rounded-b-xl' : ''}`} />
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">No items in this tab.</p>
            )
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
              {items.map((it) =>
                it.type === 'video' ? <VideoCard key={it.id} item={it} onOpen={open} /> :
                it.type === 'article' ? <ArticleCard key={it.id} item={it} onOpen={open} /> :
                <SocialPostCard key={it.id} item={it} onOpen={open} />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-px max-w-[760px]">
              {items.map((it, idx) => (
                <ContentListCard
                  key={it.id}
                  item={it}
                  onOpen={open}
                  isFirst={idx === 0}
                  isLast={idx === items.length - 1}
                />
              ))}
            </div>
          )}
        </section>

      </div>

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
      <UrlIngestModal
        open={showIngest}
        onClose={() => setShowIngest(false)}
        defaultTopicId={topic?.id}
      />
      <SummaryModal
        open={showSummaryModal}
        topic={topic}
        items={sourceItems}
        onClose={() => setShowSummaryModal(false)}
      />
    </div>
  )
}
