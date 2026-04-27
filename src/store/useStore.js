import { useCallback, useEffect, useSyncExternalStore } from 'react'

export const STORAGE_KEY = 'flowmap.v1'

const EMPTY = {
  saves: {},
  follows: {},
  dismisses: {},
  collections: {},
  views: {},      // contentId -> { count, lastAt }
  searches: {},   // normalized query -> { count, lastAt, order }
  memoryEntries: {},
  memoryDismisses: {},  // seed memory ids the user has dismissed
  userTopics: {},
}

let memoryState = EMPTY
let initialized = false
let searchCounter = 0
const listeners = new Set()

function loadState() {
  if (typeof localStorage === 'undefined') return EMPTY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

function persist(next) {
  memoryState = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {}
  listeners.forEach((fn) => fn())
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot() {
  if (!initialized) {
    initialized = true
    memoryState = loadState()
  }
  return memoryState
}

function normalizeQuery(q) {
  return String(q || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function useStore() {
  // Re-sync on mount in case localStorage was cleared by tests
  useEffect(() => {
    initialized = false
  }, [])

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Actions are stable (empty deps) — they read the latest module-scope state at call time.
  // This is critical: if these depended on `state`, every state update would create new
  // function identities, and any consumer that includes them in a useEffect dep array
  // would loop infinitely (e.g. recordView in modal mount effects).
  // toggleSave(id, item?) — store full item snapshot so live HN/Reddit/Dailymotion
  // results can be rendered later from localStorage alone, without a live re-fetch.
  const toggleSave = useCallback((id, item) => {
    const cur = memoryState
    const saves = { ...cur.saves }
    if (saves[id]) delete saves[id]
    else saves[id] = { savedAt: new Date().toISOString(), item: item || null }
    persist({ ...cur, saves })
  }, [])

  const toggleFollow = useCallback((id) => {
    const cur = memoryState
    const follows = { ...cur.follows }
    if (follows[id]) delete follows[id]
    else follows[id] = { followedAt: new Date().toISOString() }
    persist({ ...cur, follows })
  }, [])

  const dismiss = useCallback((id) => {
    const cur = memoryState
    persist({ ...cur, dismisses: { ...cur.dismisses, [id]: true } })
  }, [])

  const recordView = useCallback((id) => {
    const cur = memoryState
    const prev = cur.views[id]
    const now = new Date().toISOString()
    const views = { ...cur.views, [id]: { count: (prev?.count ?? 0) + 1, lastAt: now } }
    persist({ ...cur, views })
  }, [])

  const recordSearch = useCallback((query) => {
    const norm = normalizeQuery(query)
    if (!norm) return
    const cur = memoryState
    const prev = cur.searches[norm]
    const now = new Date().toISOString()
    const searches = { ...cur.searches, [norm]: { count: (prev?.count ?? 0) + 1, lastAt: now, order: searchCounter++ } }
    persist({ ...cur, searches })
  }, [])

  const addMemory = useCallback((data) => {
    const cur = memoryState
    const id = `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const entry = {
      id,
      category: data.category || 'research_focus',
      content: data.content || '',
      confidence: data.confidence ?? 1.0,
      status: data.status || 'active',
      addedAt: new Date().toISOString().slice(0, 10),
      source: data.source || 'manual',
    }
    persist({ ...cur, memoryEntries: { ...cur.memoryEntries, [id]: entry } })
    return id
  }, [])

  const updateMemory = useCallback((id, patch) => {
    const cur = memoryState
    const existing = cur.memoryEntries[id]
    if (!existing) return
    persist({ ...cur, memoryEntries: { ...cur.memoryEntries, [id]: { ...existing, ...patch } } })
  }, [])

  // Seed memory entries (id starts with `mem_seed_`) live in JSON and can't be
  // mutated. Treat delete on those as a "dismiss" — track in localStorage and
  // filter at render time. User-added entries get fully removed.
  const deleteMemory = useCallback((id) => {
    const cur = memoryState
    if (String(id).startsWith('mem_seed_')) {
      persist({ ...cur, memoryDismisses: { ...cur.memoryDismisses, [id]: true } })
      return
    }
    const next = { ...cur.memoryEntries }
    delete next[id]
    persist({ ...cur, memoryEntries: next })
  }, [])

  const isMemoryDismissed = useCallback(
    (id) => Boolean(memoryState.memoryDismisses?.[id]),
    []
  )

  // Selectors — stable too. They read memoryState; since useSyncExternalStore re-renders
  // the consumer on state change, callers see fresh values during render.
  const recentSearches = useCallback((n = 8) => {
    return Object.entries(memoryState.searches)
      .map(([query, info]) => ({ query, ...info }))
      .sort((a, b) => {
        const aTime = new Date(a.lastAt || '').getTime()
        const bTime = new Date(b.lastAt || '').getTime()
        if (aTime !== bTime) return bTime - aTime
        return (b.order ?? 0) - (a.order ?? 0)
      })
      .slice(0, n)
  }, [])

  const isSaved = useCallback((id) => Boolean(memoryState.saves[id]), [])
  const isFollowing = useCallback((id) => Boolean(memoryState.follows[id]), [])
  const isDismissed = useCallback((id) => Boolean(memoryState.dismisses[id]), [])
  const viewCount = useCallback((id) => memoryState.views[id]?.count ?? 0, [])

  const addUserTopic = useCallback((data) => {
    const cur = memoryState
    const slug = slugify(data.slug || data.name)
    if (!slug) return null
    // Dedupe by slug
    const existingId = Object.keys(cur.userTopics).find((id) => cur.userTopics[id].slug === slug)
    if (existingId) return cur.userTopics[existingId]
    const id = `utopic_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const summary = data.summary
      || (data.source === 'category'
        ? `Saved from the "${data.name}" category on the search results page.`
        : `Saved from your search for "${data.query || data.name}".`)
    const entry = {
      id,
      slug,
      name: data.name,
      summary,
      source: data.source || 'query',
      query: data.query || data.name,
      category: data.category || null,
      followed: true,
      addedAt: new Date().toISOString().slice(0, 10),
    }
    persist({ ...cur, userTopics: { ...cur.userTopics, [id]: entry } })
    return entry
  }, [])

  const removeUserTopic = useCallback((id) => {
    const cur = memoryState
    const next = { ...cur.userTopics }
    delete next[id]
    persist({ ...cur, userTopics: next })
  }, [])

  const userTopicBySlug = useCallback((slug) => {
    const target = slugify(slug)
    return Object.values(memoryState.userTopics).find((t) => t.slug === target)
  }, [])

  return {
    ...state,
    toggleSave, toggleFollow, dismiss,
    recordView, recordSearch,
    addMemory, updateMemory, deleteMemory, isMemoryDismissed,
    addUserTopic, removeUserTopic, userTopicBySlug,
    isSaved, isFollowing, isDismissed, viewCount, recentSearches,
  }
}
