import { useCallback, useEffect, useSyncExternalStore } from 'react'

export const STORAGE_KEY = 'flowmap.v1'

const EMPTY = {
  saves: {},
  follows: {},
  dismisses: {},
  collections: {},
  views: {},      // contentId -> { count, lastAt }
  searches: {},   // normalized query -> { count, lastAt }
}

let memoryState = EMPTY
let initialized = false
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
    const searches = { ...state.searches, [norm]: { count: (prev?.count ?? 0) + 1, lastAt: now } }
    persist({ ...state, searches })
  }, [state])

  const isSaved = useCallback((id) => Boolean(state.saves[id]), [state])
  const isFollowing = useCallback((id) => Boolean(state.follows[id]), [state])
  const isDismissed = useCallback((id) => Boolean(state.dismisses[id]), [state])
  const viewCount = useCallback((id) => state.views[id]?.count ?? 0, [state])

  return {
    ...state,
    toggleSave, toggleFollow, dismiss,
    recordView, recordSearch,
    isSaved, isFollowing, isDismissed, viewCount,
  }
}
