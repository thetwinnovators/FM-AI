import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { Bookmark, BookmarkCheck, Sparkles, Trash2, Plus, BookOpen, ArrowUpDown, LayoutGrid, List } from 'lucide-react'
import TopicCover from '../components/topic/TopicCover.jsx'
import NewTopicModal from '../components/topic/NewTopicModal.jsx'
import { getCached } from '../lib/search/cache.js'
import { useConfirm } from '../components/ui/ConfirmProvider.jsx'

// ─── cover gradient helper (mirrors TopicCover palette) ──────────────────────

const COVER_PALETTE = [
  ['#d946ef', '#6366f1'],
  ['#06b6d4', '#3b82f6'],
  ['#14b8a6', '#06b6d4'],
  ['#8b5cf6', '#ec4899'],
  ['#a855f7', '#d946ef'],
  ['#3b82f6', '#8b5cf6'],
  ['#10b981', '#14b8a6'],
  ['#f43f5e', '#a855f7'],
]
function hashStr(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function coverGradient(slug, name) {
  const seed  = slug || name || 'topic'
  const hash  = hashStr(seed)
  const [c1, c2] = COVER_PALETTE[hash % COVER_PALETTE.length]
  const angle = 110 + (hashStr(seed + ':a') % 100)
  return `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%)`
}

// Cached Reddit thumbnails come back with literal "&amp;" sequences instead of
// "&", which breaks the signed `s=` query parameter and 403s on load. Decode
// before passing to the <img>.
function decodeAmp(url) {
  return url ? url.replace(/&amp;/g, '&') : url
}

// 70x70 b.thumbs.redditmedia.com avatars render poorly at 16:7. Reddit
// preview.redd.it URLs are referer-locked at the small-thumbnail size — they
// fail to load from outside Reddit. Treat both as "bad cover" candidates.
function isUnusableThumb(url) {
  if (!url) return false
  if (url.includes('b.thumbs.redditmedia.com')) return true
  if (/preview\.redd\.it/.test(url) || /external-preview\.redd\.it/.test(url)) return true
  return false
}

function pickCover(items, used) {
  // Videos first — YouTube maxresdefault is reliably 1280x720.
  for (const it of items) {
    if (it?.type === 'video' && it.thumbnail && !used.has(it.thumbnail)) return decodeAmp(it.thumbnail)
  }
  // Then any thumbnail that won't visibly fail (skips referer-locked Reddit previews
  // and tiny avatar thumbnails).
  for (const it of items) {
    if (it?.thumbnail && !used.has(it.thumbnail) && !isUnusableThumb(it.thumbnail)) return decodeAmp(it.thumbnail)
  }
  return null
}

// Pull a cover thumbnail from a user topic's cached search results. Bypasses
// the normal 30-min TTL — a stale thumbnail is still fine for card art, and
// the cover would otherwise wink to a procedural gradient between visits.
function cachedCoverForUserTopic(userTopic, used) {
  if (!userTopic?.query) return null
  const key = 'all:' + String(userTopic.query).trim().toLowerCase()
  const cached = getCached(key, Number.MAX_SAFE_INTEGER)
  return pickCover(cached?.items || [], used)
}

// Build a map of topicId → cover thumbnail, with a global de-dup so two topics
// that share their top content (e.g. the Anthropic agents talk shows under both
// Claude and AI Agents) don't end up with identical card art. Iterates in seed
// order so assignment is stable regardless of follow state. Topics that can't
// claim a unique thumbnail fall back to the procedural gradient.
function buildTopicCovers(topicsInOrder, contentByTopic) {
  const used = new Set()
  const map = {}
  for (const t of topicsInOrder) {
    const items = t.isUserAdded ? null : (contentByTopic ? (contentByTopic(t.id) || []) : [])
    const chosen = t.isUserAdded
      ? cachedCoverForUserTopic(t, used)
      : pickCover(items, used)
    if (chosen) used.add(chosen)
    map[t.id] = chosen
  }
  return map
}

export default function Topics() {
  const { topics, contentByTopic } = useSeed()
  const { isFollowing, toggleFollow, userTopics, removeUserTopic } = useStore()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [showNew, setShowNew] = useState(false)
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('flowmap.topics.viewMode') ?? 'grid',
  )

  function handleViewMode(mode) {
    setViewMode(mode)
    localStorage.setItem('flowmap.topics.viewMode', mode)
  }

  async function askRemoveUserTopic(t) {
    const ok = await confirm({
      title: `Remove "${t.name}"?`,
      message:
        'This stops tracking the topic. Any URLs you added to it stay in Memory > Added URLs but lose this topic label.',
      confirmLabel: 'Remove topic',
      danger: true,
    })
    if (ok) removeUserTopic(t.id)
  }

  const userTopicList = Object.values(userTopics)
  const merged = [
    ...topics.map((t) => ({ ...t, isUserAdded: false })),
    ...userTopicList.map((t) => ({ ...t, isUserAdded: true })),
  ]

  const coversById = buildTopicCovers(merged, contentByTopic)

  const sorted = [...merged].sort((a, b) => {
    if (sortBy === 'az') return a.name.localeCompare(b.name)
    if (sortBy === 'za') return b.name.localeCompare(a.name)
    if (sortBy === 'count') {
      const ac = a.isUserAdded ? 0 : (contentByTopic(a.id)?.length || 0)
      const bc = b.isUserAdded ? 0 : (contentByTopic(b.id)?.length || 0)
      return bc - ac
    }
    if (sortBy === 'newest') {
      // user-added topics have timestamp-encoded IDs; seed topics go last
      if (a.isUserAdded && !b.isUserAdded) return -1
      if (!a.isUserAdded && b.isUserAdded) return 1
      return (b.id || '').localeCompare(a.id || '')
    }
    // following first
    const aFollowed = a.isUserAdded ? a.followed : isFollowing(a.id)
    const bFollowed = b.isUserAdded ? b.followed : isFollowing(b.id)
    return (aFollowed ? 0 : 1) - (bFollowed ? 0 : 1)
  })

  return (
    <div className="p-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5">
            <BookOpen size={20} className="text-[color:var(--color-topic)]" /> My Topics
          </h1>
          <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
            {sorted.length} {sorted.length === 1 ? 'topic' : 'topics'} in your map
            {userTopicList.length > 0 ? <> · <span className="text-white">{userTopicList.length} saved from search</span></> : null}.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white/[0.05] border border-white/10 rounded-lg p-0.5">
            <ArrowUpDown size={11} className="text-[color:var(--color-text-tertiary)] ml-2 flex-shrink-0" />
            {[
              { id: 'newest',    label: 'Newest'     },
              { id: 'following', label: 'Following' },
              { id: 'az',        label: 'A → Z'     },
              { id: 'za',        label: 'Z → A'     },
              { id: 'count',     label: 'Most items' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  sortBy === opt.id
                    ? 'bg-[color:var(--color-topic)]/25 text-white'
                    : 'text-[color:var(--color-text-tertiary)] hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* view toggle */}
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

          <button onClick={() => setShowNew(true)} className="btn btn-primary text-sm">
            <Plus size={13} /> New topic
          </button>
        </div>
      </header>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map((t) => {
            const followed = t.isUserAdded ? t.followed : isFollowing(t.id)
            const count = t.isUserAdded ? null : contentByTopic(t.id).length
            return (
              <article key={t.id} className="glass-panel p-4 flex flex-col gap-3 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.06)] hover:[box-shadow:0_8px_40px_rgba(0,0,0,0.45),_inset_0_1px_0_rgba(255,255,255,0.06)] transition-shadow">
                <Link to={`/topic/${t.slug}`} className="block">
                  <TopicCover
                    slug={t.slug}
                    name={t.name}
                    image={coversById[t.id]}
                  />
                </Link>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[color:var(--color-topic)]" />
                    <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-topic)] font-medium">
                      topic
                    </span>
                  </div>
                  {t.isUserAdded ? (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-medium text-[color:var(--color-creator)] px-1.5 py-0.5 rounded bg-[color:var(--color-creator)]/15">
                      <Sparkles size={10} /> saved
                    </span>
                  ) : null}
                </div>

                <Link to={`/topic/${t.slug}`} className="block">
                  <h2 className="text-lg font-semibold leading-tight hover:underline">{t.name}</h2>
                  <p className="mt-2 text-sm text-[color:var(--color-text-secondary)] line-clamp-3">
                    {t.summary}
                  </p>
                </Link>

                <div className="flex items-center justify-between mt-auto pt-2">
                  <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
                    {count !== null ? `${count} ${count === 1 ? 'item' : 'items'}` : 'live · fetched on visit'}
                  </span>
                  {t.isUserAdded ? (
                    <div className="inline-flex items-center gap-1.5">
                      <span className="btn btn-primary text-xs cursor-default opacity-95" aria-label="Saved topic">
                        <BookmarkCheck size={13} /> Saved
                      </span>
                      <button
                        onClick={() => askRemoveUserTopic(t)}
                        className="btn text-xs text-rose-300 hover:text-rose-200 hover:border-rose-400/40 px-2"
                        aria-label={`Remove ${t.name}`}
                        title="Remove topic"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => toggleFollow(t.id)}
                      className={`btn ${followed ? 'btn-primary' : ''} text-xs`}
                    >
                      {followed ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                      {followed ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        /* ── list view ── */
        <div className="flex flex-col gap-px">
          {sorted.map((t, idx) => {
            const followed = t.isUserAdded ? t.followed : isFollowing(t.id)
            const count    = t.isUserAdded ? null : contentByTopic(t.id).length
            const cover    = coversById[t.id]
            const gradient = coverGradient(t.slug, t.name)
            const isFirst  = idx === 0
            const isLast   = idx === sorted.length - 1
            const radius   = isFirst && isLast ? 'rounded-xl'
              : isFirst ? 'rounded-t-xl rounded-b-none'
              : isLast  ? 'rounded-t-none rounded-b-xl'
              : 'rounded-none'
            return (
              <article
                key={t.id}
                onClick={() => navigate(`/topic/${t.slug}`)}
                className={`px-4 py-3 flex items-center gap-4 cursor-pointer bg-white/[0.03] hover:bg-white/[0.07] transition-colors ${radius}`}
              >
                {/* thumbnail */}
                <div className="w-[72px] h-[46px] rounded-lg overflow-hidden relative shrink-0">
                  {cover ? (
                    <img src={cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="absolute inset-0" style={{ background: gradient }} />
                  )}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.35) 100%),' +
                        'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.14) 0%, transparent 55%)',
                    }}
                  />
                </div>

                {/* title + summary */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-white/85 truncate">{t.name}</span>
                    {t.isUserAdded && (
                      <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wide font-medium text-[color:var(--color-creator)] px-1.5 py-0.5 rounded bg-[color:var(--color-creator)]/15 shrink-0">
                        <Sparkles size={9} /> saved
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/40 truncate leading-relaxed">{t.summary}</p>
                </div>

                {/* meta */}
                <span className="text-[11px] text-white/30 shrink-0 hidden md:block">
                  {count !== null ? `${count} ${count === 1 ? 'item' : 'items'}` : 'live · fetched on visit'}
                </span>

                {/* actions — stop propagation so they don't trigger card navigation */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {t.isUserAdded ? (
                    <>
                      <span className="btn btn-primary text-xs cursor-default opacity-95 py-1">
                        <BookmarkCheck size={12} /> Saved
                      </span>
                      <button
                        onClick={() => askRemoveUserTopic(t)}
                        className="btn text-xs text-rose-300 hover:text-rose-200 hover:border-rose-400/40 px-2 py-1"
                        aria-label={`Remove ${t.name}`}
                        title="Remove topic"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => toggleFollow(t.id)}
                      className={`btn ${followed ? 'btn-primary' : ''} text-xs py-1`}
                    >
                      {followed ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                      {followed ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <NewTopicModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  )
}
