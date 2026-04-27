import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, ExternalLink, Globe, FileText, MessageCircle, Plus, Check, Bookmark, BookmarkCheck, Play } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { fetchAll, groupByCategory, sortCategoryGroups } from '../lib/search/aggregate.js'
import { CATEGORY_LABELS } from '../lib/search/classify.js'
import { searchEntities } from '../lib/searchEntities.js'
import { getOgImage } from '../lib/search/ogImage.js'
import { Link } from 'react-router-dom'

function iconAndAccentFor(item) {
  if (item.type === 'video')       return { Icon: Play,          accent: 'var(--color-video)' }
  if (item.type === 'social_post') return { Icon: MessageCircle, accent: 'var(--color-social-post)' }
  if (item.type === 'article')     return { Icon: FileText,      accent: 'var(--color-article)' }
  return { Icon: Globe, accent: 'var(--color-article)' }
}

function ResultCard({ item }) {
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

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-2xl overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] hover:bg-[color:var(--color-bg-glass-strong)] hover:border-[color:var(--color-border-default)] transition-colors group flex flex-col"
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
          <ExternalLink size={11} className="ml-auto flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
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
    </a>
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

export default function Search() {
  const [params] = useSearchParams()
  const query = params.get('q') || ''
  const navigate = useNavigate()
  const seed = useSeed()
  const { addUserTopic, userTopics, saves, views, dismisses } = useStore()
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

  const grouped = groupByCategory(state.items)
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

      {query ? (
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
          {seedTotal > 0 ? (
            <section>
              <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">
                In your library ({seedTotal})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {seedHits.topics.map((x)    => <SeedResultRow key={x.id} kind="topics"    item={x} />)}
                {seedHits.tools.map((x)     => <SeedResultRow key={x.id} kind="tools"     item={x} />)}
                {seedHits.creators.map((x)  => <SeedResultRow key={x.id} kind="creators"  item={x} />)}
                {seedHits.companies.map((x) => <SeedResultRow key={x.id} kind="companies" item={x} />)}
                {seedHits.concepts.map((x)  => <SeedResultRow key={x.id} kind="concepts"  item={x} />)}
              </div>
            </section>
          ) : null}

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium">
                Live web — Hacker News + Reddit ({liveTotal})
              </h2>
              {state.status === 'loading' ? (
                <span className="text-[11px] text-[color:var(--color-text-tertiary)] inline-flex items-center gap-1.5">
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

            {state.status === 'loading' && state.items.length === 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] p-4 h-32 animate-pulse" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              state.status === 'done' ? (
                <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">
                  No live results. The seed library above may still have matches.
                </p>
              ) : null
            ) : (
              <div className="space-y-8">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {items.map((it) => <ResultCard key={it.id} item={it} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
