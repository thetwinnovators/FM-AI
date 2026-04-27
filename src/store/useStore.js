import { useCallback, useEffect, useSyncExternalStore } from 'react'

export const STORAGE_KEY = 'flowmap.v1'

const EMPTY = {
  saves: {},
  follows: {},
  dismisses: {},
  collections: {},
  views: {},      // contentId -> { count, lastAt }
  searches: {},   // normalized query -> { count, lastAt }
  memoryEntries: {},
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

export function useStore() {
  // Re-sync on mount in case localStorage was cleared by tests
  useEffect(() => {
    initialized = false
  }, [])

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const toggleSave = useCallback((id) => {
    const saves = { ...state.saves }
    if (saves[id]) delete saves[id]
    else saves[id] = { savedAt: new Date().toISOString() }
    persist({ ...state, saves })
  }, [state])

  const toggleFollow = useCallback((id) => {
    const follows = { ...state.follows }
    if (follows[id]) delete follows[id]
    else follows[id] = { followedAt: new Date().toISOString() }
    persist({ ...state, follows })
  }, [state])

  const dismiss = useCallback((id) => {
    persist({ ...state, dismisses: { ...state.dismisses, [id]: true } })
  }, [state])

  const recordView = useCallback((id) => {
    const prev = state.views[id]
    const now = new Date().toISOString()
    const views = { ...state.views, [id]: { count: (prev?.count ?? 0) + 1, lastAt: now } }
    persist({ ...state, views })
  }, [state])

  const recordSearch = useCallback((query) => {
    const norm = normalizeQuery(query)
    if (!norm) return
    const prev = state.searches[norm]
    const now = new Date().toISOString()
    const searches = { ...state.searches, [norm]: { count: (prev?.count ?? 0) + 1, lastAt: now, order: searchCounter++ } }
    persist({ ...state, searches })
  }, [state])

  const addMemory = useCallback((data) => {
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
    persist({ ...state, memoryEntries: { ...state.memoryEntries, [id]: entry } })
    return id
  }, [state])

  const updateMemory = useCallback((id, patch) => {
    const cur = state.memoryEntries[id]
    if (!cur) return
    persist({ ...state, memoryEntries: { ...state.memoryEntries, [id]: { ...cur, ...patch } } })
  }, [state])

  const deleteMemory = useCallback((id) => {
    const next = { ...state.memoryEntries }
    delete next[id]
    persist({ ...state, memoryEntries: next })
  }, [state])

  const recentSearches = useCallback((n = 8) => {
    return Object.entries(state.searches)
      .map(([query, info]) => ({ query, ...info }))
      .sort((a, b) => {
        const aTime = new Date(a.lastAt || '').getTime()
        const bTime = new Date(b.lastAt || '').getTime()
        if (aTime !== bTime) return bTime - aTime
        return (b.order ?? 0) - (a.order ?? 0)
      })
      .slice(0, n)
  }, [state])

  const isSaved = useCallback((id) => Boolean(state.saves[id]), [state])
  const isFollowing = useCallback((id) => Boolean(state.follows[id]), [state])
  const isDismissed = useCallback((id) => Boolean(state.dismisses[id]), [state])
  const viewCount = useCallback((id) => state.views[id]?.count ?? 0, [state])

  return {
    ...state,
    toggleSave, toggleFollow, dismiss,
    recordView, recordSearch,
    addMemory, updateMemory, deleteMemory,
    isSaved, isFollowing, isDismissed, viewCount, recentSearches,
  }
}
