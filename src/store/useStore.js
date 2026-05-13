import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { classifyQueryIntent, isFreshnessSensitiveQuery } from '../lib/search/queryIntent.js'
import { generateSummary } from '../lib/llm/ollama.js'
import { OLLAMA_CONFIG } from '../lib/llm/ollamaConfig.js'
import { pullFromDisk, pushToDisk } from '../lib/sync/fileSync.js'
import { notifyWrite } from '../memory-index/memoryService.js'
import { shouldGenerateTopicBrief } from '../lib/briefs/briefTrigger.js'
import { generateTopicBrief } from '../lib/briefs/generateTopicBrief.js'

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
  manualContent: {},    // id -> { id, item, topicIds, tags, relevanceNote, savedAt, ingestionMethod }
  // Documents Phase 1: long-form content (pasted notes / chat dumps for now;
  // uploads land in Phase 2 alongside LLM summaries via Ollama).
  documents: {},        // id -> DocumentMeta (no content body — keeps the index light)
  documentContents: {}, // id -> { id, plainText, raw? } (lazy-loadable later when SQL lands)
  // Phase 3 chat: conversations index + append-only message log keyed by conversationId.
  conversations: {},    // id -> { id, title, createdAt, updatedAt, pinned, archived, topics }
  chatMessages: {},     // conversationId -> ChatMessage[] in insertion order
  // Per-item user notes. Keyed by content/article/video id; shows up in the
  // reader modals so the user can capture takeaways without leaving the app.
  userNotes: {},        // itemId -> { content, updatedAt }
  folders: {},
  // Per-topic AI overviews. Cached so the SummaryCard renders instantly on
  // revisit. itemSignature is a hash of the item ids the overview was built
  // from — when it drifts from the topic's current items, the card surfaces
  // an "out of date" hint.
  topicSummaries: {},   // topicId -> { overview, report, generatedAt, itemSignature }
  courses: {},          // Flow Academy — courseId -> LearningCourse (lessons inline)
  codeLessons: {},      // Code Academy — lessonKey -> CodeLesson (cached AI-generated)
  codeProgress: {},     // Code Academy — lessonKey -> CodeLessonProgress
  pythonProgress: {},   // Python Curriculum — subLessonId -> SubLessonProgress
  briefs: {},
}

let memoryState = EMPTY
let initialized = false
let searchCounter = 0
const listeners = new Set()

export const IDENTITY_DEFAULT_CATEGORIES = new Set([
  'personal_rule', 'preference', 'behavior', 'personal_fact',
])

export function backfillIdentityPins(memoryEntriesRecord) {
  const result = {}
  for (const [id, entry] of Object.entries(memoryEntriesRecord || {})) {
    result[id] = entry.isIdentityPinned !== undefined
      ? entry
      : { ...entry, isIdentityPinned: IDENTITY_DEFAULT_CATEGORIES.has(entry.category) }
  }
  return result
}

function loadState() {
  if (typeof localStorage === 'undefined') return EMPTY
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const base = raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
    return { ...base, memoryEntries: backfillIdentityPins(base.memoryEntries) }
  } catch {
    return EMPTY
  }
}

// Sync state — exposed so the gear menu can show a status pip.
export const syncState = {
  status: 'idle',     // 'idle' | 'pulling' | 'pushing' | 'synced' | 'offline'
  lastModified: null, // timestamp from the disk file (server-side mtime)
  error: null,
}
const syncListeners = new Set()
export function subscribeSyncStatus(fn) {
  syncListeners.add(fn)
  return () => syncListeners.delete(fn)
}
function setSyncStatus(patch) {
  Object.assign(syncState, patch)
  syncListeners.forEach((fn) => fn())
}

let pushTimer = null
function schedulePush() {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(async () => {
    setSyncStatus({ status: 'pushing', error: null })
    const res = await pushToDisk(memoryState)
    if (res?.ok) {
      setSyncStatus({ status: 'synced', lastModified: res.lastModified, error: null })
    } else {
      setSyncStatus({ status: 'offline', error: res?.error || 'push failed' })
    }
  }, 800) // debounce — coalesce bursts of edits into one write
}

function persist(next) {
  memoryState = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // QuotaExceededError — retry without document content bodies so folders,
    // memory entries, and all metadata still survive a full localStorage.
    try {
      const slim = { ...next, documentContents: {} }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
    } catch { /* truly full — disk sync via schedulePush is the safety net */ }
  }
  notifyWrite(STORAGE_KEY)
  listeners.forEach((fn) => fn())
  schedulePush()
}

// Validate that a pulled payload looks like a real FlowMap state envelope —
// must be an object containing at least one of the canonical top-level keys.
// Defends against junk on disk (manual edits, test payloads) overwriting good
// local state. If the payload doesn't pass, we treat the file as empty.
const CANONICAL_KEYS = ['documents', 'documentContents', 'conversations', 'chatMessages', 'userTopics', 'manualContent', 'saves', 'follows', 'memoryEntries', 'userNotes']
function looksLikeFlowMapState(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false
  return CANONICAL_KEYS.some((k) => k in obj)
}

// Pull from disk and replace memoryState if the file is newer than our last
// pull. Used on app mount and on window focus so cross-browser changes propagate.
let lastPulledModified = 0
let pullInFlight = null
export async function pullSyncedState() {
  if (pullInFlight) return pullInFlight
  setSyncStatus({ status: 'pulling', error: null })
  pullInFlight = (async () => {
    const res = await pullFromDisk()
    if (res?.exists && looksLikeFlowMapState(res.data)) {
      // Only replace if the file is newer than what we already pulled —
      // avoids fighting our own freshly-pushed state.
      if (res.lastModified > lastPulledModified) {
        lastPulledModified = res.lastModified
        memoryState = { ...EMPTY, ...res.data }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryState)) } catch {}
        notifyWrite(STORAGE_KEY)
        listeners.forEach((fn) => fn())
      }
      setSyncStatus({ status: 'synced', lastModified: res.lastModified, error: null })
    } else if (res?.exists) {
      // File is there but doesn't look like FlowMap data — don't trust it.
      // Re-seed with our current state so the disk and memory align.
      setSyncStatus({ status: 'pushing', error: 'disk had unrecognized payload — re-seeding from local state' })
      const w = await pushToDisk(memoryState)
      if (w?.ok) {
        lastPulledModified = w.lastModified
        setSyncStatus({ status: 'synced', lastModified: w.lastModified, error: null })
      }
    } else if (res?.error) {
      setSyncStatus({ status: 'offline', error: res.error })
    } else {
      // exists: false — disk is empty. Push our current state to seed it.
      setSyncStatus({ status: 'pushing', error: null })
      const w = await pushToDisk(memoryState)
      if (w?.ok) {
        lastPulledModified = w.lastModified
        setSyncStatus({ status: 'synced', lastModified: w.lastModified, error: null })
      } else {
        setSyncStatus({ status: 'offline', error: w?.error || 'seed push failed' })
      }
    }
  })()
  try { await pullInFlight } finally { pullInFlight = null }
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

// ─── Module-level sync singleton ─────────────────────────────────────────────
// useStore() is called from ~34 files. If each instance registered its own
// visibilitychange/focus listeners we'd accumulate 68+ identical listeners that
// all fire at once, triggering 68+ concurrent /api/state requests on every tab
// focus. Moving setup to a module-level singleton means exactly ONE listener
// pair is ever registered, no matter how many components call useStore().
let syncInitialized = false
function initSync() {
  if (syncInitialized) return
  syncInitialized = true
  pullSyncedState()
  function onVis() { if (document.visibilityState === 'visible') pullSyncedState() }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('focus', onVis)
}

export function unreadBriefCount(briefs = {}) {
  return Object.values(briefs).filter((b) => b.readAt == null).length
}

export function allBriefsSorted(briefs = {}) {
  // Deduplicate news_digests that share the same calendar day (same-day ID
  // prefix, or legacy UUIDs that were generated on the same day). Keep only
  // the most-recently generated one per day so stale duplicates never show.
  const deduped = Object.values(briefs).filter((brief, _i, arr) => {
    if (brief.type !== 'news_digest') return true
    const dayKey = new Date(brief.generatedAt).toISOString().slice(0, 10)
    const sameDayDigests = arr.filter(
      (b) => b.type === 'news_digest' &&
             new Date(b.generatedAt).toISOString().slice(0, 10) === dayKey,
    )
    // Keep only the newest for this day
    const newest = sameDayDigests.reduce((a, b) => (b.generatedAt > a.generatedAt ? b : a))
    return brief.id === newest.id
  })

  const all    = deduped
  const unread = all.filter((b) => b.readAt == null)
  const read   = all.filter((b) => b.readAt != null)

  // Within unread: news_digest first, then topic briefs by generatedAt desc
  unread.sort((a, b) => {
    if (a.type === 'news_digest' && b.type !== 'news_digest') return -1
    if (b.type === 'news_digest' && a.type !== 'news_digest') return 1
    return b.generatedAt - a.generatedAt
  })
  // Within read: most recent first
  read.sort((a, b) => b.generatedAt - a.generatedAt)

  return [...unread, ...read]
}

export function useStore() {
  // Bootstrap the sync singleton on first component mount. Subsequent calls
  // from other components are no-ops (syncInitialized guard above).
  useEffect(() => { initSync() }, [])

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

  // recordSearch logs the search and tags it with the heuristic intents +
  // freshness flag. Persisted on each entry so Phase 3 (topic-aware ranking)
  // can aggregate intent patterns per topic without re-classifying history.
  const recordSearch = useCallback((query) => {
    const norm = normalizeQuery(query)
    if (!norm) return
    const cur = memoryState
    const prev = cur.searches[norm]
    const now = new Date().toISOString()
    const intents = classifyQueryIntent(norm)
    const freshSensitive = isFreshnessSensitiveQuery(norm)
    const searches = {
      ...cur.searches,
      [norm]: {
        count: (prev?.count ?? 0) + 1,
        lastAt: now,
        order: searchCounter++,
        intents,
        freshSensitive,
      },
    }
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
      isIdentityPinned: IDENTITY_DEFAULT_CATEGORIES.has(data.category || 'research_focus'),
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

  const pinMemoryAsIdentity = useCallback((id, pinned) => {
    const cur = memoryState
    const existing = cur.memoryEntries[id]
    if (!existing) return
    persist({
      ...cur,
      memoryEntries: {
        ...cur.memoryEntries,
        [id]: { ...existing, isIdentityPinned: Boolean(pinned) },
      },
    })
  }, [])

  // Per-item notes — sticky-note style, multiple per item, each independently
  // removable. Stored as `userNotes[itemId] = [{ id, content, addedAt }]`. The
  // selector also accepts the legacy single-note shape ({content, updatedAt})
  // and surfaces it as a one-element array so older entries don't disappear.
  function normalizeNotes(raw, itemId) {
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'object' && raw.content) {
      return [{ id: `legacy_${itemId}`, content: raw.content, addedAt: raw.updatedAt || new Date().toISOString() }]
    }
    return []
  }
  const notesFor = useCallback(
    (itemId) => normalizeNotes(memoryState.userNotes?.[itemId], itemId),
    []
  )
  const addNote = useCallback((itemId, content) => {
    if (!itemId) return null
    const text = String(content || '').trim()
    if (!text) return null
    const cur = memoryState
    const existing = normalizeNotes(cur.userNotes?.[itemId], itemId)
    const note = {
      id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      content: text,
      addedAt: new Date().toISOString(),
    }
    persist({ ...cur, userNotes: { ...(cur.userNotes || {}), [itemId]: [...existing, note] } })
    return note.id
  }, [])
  const removeNote = useCallback((itemId, noteId) => {
    const cur = memoryState
    const arr = normalizeNotes(cur.userNotes?.[itemId], itemId)
    const filtered = arr.filter((n) => n.id !== noteId)
    const next = { ...(cur.userNotes || {}) }
    if (filtered.length === 0) delete next[itemId]
    else next[itemId] = filtered
    persist({ ...cur, userNotes: next })
  }, [])

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

  // Patch an existing user topic — used by the Topic page's inline title /
  // summary edit. If `name` changes we re-derive the slug so the URL stays
  // in sync, but skip the slug update if a different topic already owns it.
  const updateUserTopic = useCallback((id, patch) => {
    const cur = memoryState
    const existing = cur.userTopics?.[id]
    if (!existing) return null
    let slug = existing.slug
    if (patch?.name && patch.name !== existing.name) {
      const candidate = slugify(patch.name)
      const conflict = candidate
        && Object.entries(cur.userTopics).some(([otherId, t]) => otherId !== id && t.slug === candidate)
      if (candidate && !conflict) slug = candidate
    }
    const next = { ...existing, ...patch, id, slug, updatedAt: new Date().toISOString() }
    persist({ ...cur, userTopics: { ...cur.userTopics, [id]: next } })
    return next
  }, [])

  const userTopicBySlug = useCallback((slug) => {
    const target = slugify(slug)
    return Object.values(memoryState.userTopics).find((t) => t.slug === target)
  }, [])

  // Manual URL ingest — store the normalized item plus topic/tag relationships and
  // provenance metadata. The item itself is shaped exactly like a search/seed result
  // so it renders through the same cards/modals downstream.
  const addManualContent = useCallback((data) => {
    const cur = memoryState
    const item = data.item
    if (!item || !item.id) return null
    const enriched = {
      id: item.id,
      item,
      topicId: (data.topicIds || [])[0] || null,
      topicIds: data.topicIds || [],
      tags: data.tags || [],
      relevanceNote: data.relevanceNote || null,
      savedAt: new Date().toISOString(),
      ingestionMethod: 'manual_url',
    }
    persist({ ...cur, manualContent: { ...cur.manualContent, [item.id]: enriched } })

    // Fire-and-forget: check if this topic now has 3+ new items → generate brief
    if (enriched.topicId) {
      setTimeout(async () => {
        const s = memoryState
        const allItems = Object.values(s.manualContent || {})
        if (!shouldGenerateTopicBrief(enriched.topicId, allItems, s.briefs || {})) return

        const topicEntry = Object.values(s.userTopics || {}).find(
          (t) => t.id === enriched.topicId,
        )
        const topicTitle = topicEntry?.label ?? topicEntry?.name ?? enriched.topicId

        const itemsForTopic = allItems.filter(
          (i) => i.topicId === enriched.topicId || (i.topicIds ?? []).includes(enriched.topicId),
        )
        const brief = await generateTopicBrief(topicTitle, enriched.topicId, itemsForTopic)
        if (brief) persist({ ...memoryState, briefs: { ...memoryState.briefs, [brief.id]: brief } })
      }, 0)
    }

    return enriched
  }, [])

  const removeManualContent = useCallback((id) => {
    const cur = memoryState
    const next = { ...cur.manualContent }
    delete next[id]
    persist({ ...cur, manualContent: next })
  }, [])

  const manualContentForTopic = useCallback((topicId) => {
    if (!topicId) return []
    return Object.values(memoryState.manualContent || {})
      .filter((e) => (e.topicIds || []).includes(topicId))
      .map((e) => e.item)
  }, [])

  const manualContentByUrl = useCallback((url) => {
    if (!url) return null
    return Object.values(memoryState.manualContent || {}).find((e) => e.item?.url === url) || null
  }, [])

  // Documents Phase 1 — local storage only. content.plainText kept inline; will
  // split to a separate column when SQL lands.
  const addDocument = useCallback((data) => {
    const cur = memoryState
    const id = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()
    const plainText = String(data.plainText || '').trim()
    const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0
    const meta = {
      id,
      title: String(data.title || '').trim() || (plainText.split('\n')[0] || 'Untitled').slice(0, 80),
      sourceType: data.sourceType || 'pasted',
      fileName: data.fileName || null,
      mimeType: data.mimeType || null,
      url: data.url || null,
      createdAt: now,
      updatedAt: now,
      topics: Array.isArray(data.topics) ? data.topics : [],
      tags: Array.isArray(data.tags) ? data.tags : [],
      summary: null,
      excerpt: plainText.slice(0, 240) || null,
      wordCount,
      folderId: data.folderId || null,
      // Markdown processing fields
      processingStatus: data.normalizedMarkdown ? 'processed' : (data.processingStatus || null),
      processingError: data.processingError || null,
      lastProcessedAt: data.normalizedMarkdown ? now : null,
      processingVersion: data.normalizedMarkdown ? (data.processingVersion || null) : null,
    }
    const content = {
      id,
      plainText,
      raw: data.raw || null,
      normalizedMarkdown: data.normalizedMarkdown || null,
    }
    persist({
      ...cur,
      documents: { ...cur.documents, [id]: meta },
      documentContents: { ...cur.documentContents, [id]: content },
    })
    return meta
  }, [])

  // Re-run Markdown normalization on an already-stored document.
  // Reads the stored plainText, converts it, and updates both the content and
  // the processing status fields on the meta record.
  const reprocessDocument = useCallback((id) => {
    const cur = memoryState
    const meta = cur.documents?.[id]
    const content = cur.documentContents?.[id]
    if (!meta || !content?.plainText) return Promise.resolve()

    // Import lazily so the normalizer is only loaded when actually used
    return import('../lib/document/normalizeMarkdown.js').then(({ normalizeMarkdown, PROCESSING_VERSION }) => {
      const now = new Date().toISOString()
      let normalizedMarkdown = null
      let processingStatus = 'failed'
      let processingError = null

      try {
        normalizedMarkdown = normalizeMarkdown(content.plainText, meta.mimeType || '')
        processingStatus = 'processed'
      } catch (err) {
        processingError = err?.message || 'Normalization failed'
      }

      // Read latest state at completion time to avoid clobbering concurrent edits
      const latest = memoryState
      const latestMeta = latest.documents?.[id]
      const latestContent = latest.documentContents?.[id]
      if (!latestMeta || !latestContent) return

      persist({
        ...latest,
        documents: {
          ...latest.documents,
          [id]: {
            ...latestMeta,
            processingStatus,
            processingError,
            lastProcessedAt: now,
            processingVersion: PROCESSING_VERSION,
            updatedAt: now,
          },
        },
        documentContents: {
          ...latest.documentContents,
          [id]: { ...latestContent, normalizedMarkdown },
        },
      })
    })
  }, [])

  const updateDocument = useCallback((id, patch) => {
    const cur = memoryState
    const existing = cur.documents?.[id]
    if (!existing) return null
    const now = new Date().toISOString()
    const next = { ...existing, ...patch, id, updatedAt: now }
    // Keep excerpt and wordCount in sync if plainText changes through this path.
    if (patch.plainText !== undefined) {
      const text = String(patch.plainText || '').trim()
      next.excerpt = text.slice(0, 240) || null
      next.wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0
      const contentNext = { ...(cur.documentContents[id] || { id }), plainText: text }
      persist({
        ...cur,
        documents: { ...cur.documents, [id]: next },
        documentContents: { ...cur.documentContents, [id]: contentNext },
      })
    } else {
      persist({ ...cur, documents: { ...cur.documents, [id]: next } })
    }
    return next
  }, [])

  const removeDocument = useCallback((id) => {
    const cur = memoryState
    const docs = { ...cur.documents }; delete docs[id]
    const contents = { ...cur.documentContents }; delete contents[id]
    persist({ ...cur, documents: docs, documentContents: contents })
  }, [])

  const setTopicSummary = useCallback((topicId, patch) => {
    if (!topicId || !patch) return
    const cur = memoryState
    const prev = (cur.topicSummaries || {})[topicId] || {}
    const next = { ...prev, ...patch }
    persist({ ...cur, topicSummaries: { ...(cur.topicSummaries || {}), [topicId]: next } })
  }, [])

  const clearTopicSummary = useCallback((topicId) => {
    if (!topicId) return
    const cur = memoryState
    const map = { ...(cur.topicSummaries || {}) }
    delete map[topicId]
    persist({ ...cur, topicSummaries: map })
  }, [])

  // Find or create the special "AI Memory" folder used by the topic-summary
  // save flow. Centralized so the modal doesn't need to care whether the
  // folder existed beforehand.
  const ensureFolderByName = useCallback((name) => {
    const cur = memoryState
    const trimmed = String(name || '').trim()
    if (!trimmed) return null
    const lc = trimmed.toLowerCase()
    const existing = Object.values(cur.folders || {}).find((f) => String(f.name || '').toLowerCase() === lc)
    if (existing) return existing
    const id = `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const folder = { id, name: trimmed.slice(0, 80), createdAt: new Date().toISOString() }
    persist({ ...cur, folders: { ...(cur.folders || {}), [id]: folder } })
    return folder
  }, [])

  const addFolder = useCallback((name) => {
    const cur = memoryState
    const id = `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const trimmed = String(name || '').trim().slice(0, 80) || 'New Folder'
    const folder = { id, name: trimmed, createdAt: new Date().toISOString() }
    persist({ ...cur, folders: { ...(cur.folders || {}), [id]: folder } })
    return folder
  }, [])

  const renameFolder = useCallback((id, name) => {
    const cur = memoryState
    const folder = (cur.folders || {})[id]
    if (!folder) return
    const trimmed = String(name || '').trim().slice(0, 80) || 'New Folder'
    persist({ ...cur, folders: { ...(cur.folders || {}), [id]: { ...folder, name: trimmed } } })
  }, [])

  const removeFolder = useCallback((id) => {
    const cur = memoryState
    const folders = { ...(cur.folders || {}) }
    delete folders[id]
    const documents = {}
    for (const [docId, doc] of Object.entries(cur.documents || {})) {
      documents[docId] = doc.folderId === id ? { ...doc, folderId: null } : doc
    }
    persist({ ...cur, folders, documents })
  }, [])

  const documentById = useCallback((id) => memoryState.documents?.[id] || null, [])
  const documentContentById = useCallback((id) => memoryState.documentContents?.[id] || null, [])

  const documentsForTopic = useCallback((topicId) => {
    if (!topicId) return []
    return Object.values(memoryState.documents || {})
      .filter((d) => (d.topics || []).includes(topicId))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
  }, [])

  // Phase 3 chat: conversations + messages. Append-only message log keeps the
  // history cheap to render and easy to migrate to SQL later (one row per
  // message). A conversation is auto-created on first user message; title is
  // derived from that first message and editable.
  const createConversation = useCallback((seed = {}) => {
    const cur = memoryState
    const id = `conv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()
    const conv = {
      id,
      title: String(seed.title || 'New conversation').slice(0, 80),
      createdAt: now,
      updatedAt: now,
      pinned: false,
      archived: false,
      topics: Array.isArray(seed.topics) ? seed.topics : [],
    }
    persist({
      ...cur,
      conversations: { ...cur.conversations, [id]: conv },
      chatMessages: { ...cur.chatMessages, [id]: [] },
    })
    return conv
  }, [])

  const updateConversation = useCallback((id, patch) => {
    const cur = memoryState
    const existing = cur.conversations?.[id]
    if (!existing) return null
    const next = { ...existing, ...patch, id, updatedAt: new Date().toISOString() }
    persist({ ...cur, conversations: { ...cur.conversations, [id]: next } })
    return next
  }, [])

  const deleteConversation = useCallback((id) => {
    const cur = memoryState
    const conversations = { ...cur.conversations }; delete conversations[id]
    const chatMessages = { ...cur.chatMessages }; delete chatMessages[id]
    persist({ ...cur, conversations, chatMessages })
  }, [])

  // Append a message and bump the conversation's updatedAt. Title auto-fills
  // from the first user message if it's still the placeholder.
  const addChatMessage = useCallback((conversationId, message) => {
    const cur = memoryState
    const conv = cur.conversations?.[conversationId]
    if (!conv) return null
    const now = new Date().toISOString()
    const msg = {
      id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      conversationId,
      role: message.role || 'user',
      content: String(message.content || ''),
      createdAt: now,
      citedDocumentIds: message.citedDocumentIds || [],
      citedItemIds: message.citedItemIds || [],
      // Provenance blob the chat view persists with assistant turns so the
      // user can audit what the model saw. Optional; not set on user msgs.
      context: message.context || null,
    }
    const list = [...(cur.chatMessages?.[conversationId] || []), msg]
    let title = conv.title
    if (msg.role === 'user' && (title === 'New conversation' || !title.trim())) {
      title = msg.content.split('\n')[0].slice(0, 80) || 'New conversation'
    }
    persist({
      ...cur,
      chatMessages: { ...cur.chatMessages, [conversationId]: list },
      conversations: {
        ...cur.conversations,
        [conversationId]: { ...conv, title, updatedAt: now },
      },
    })
    return msg
  }, [])

  // Patch arbitrary fields on an existing message (e.g. attach followUpSuggestions after generation).
  const patchChatMessage = useCallback((conversationId, messageId, patch) => {
    const cur = memoryState
    const list = cur.chatMessages?.[conversationId]
    if (!list) return
    const updated = list.map((m) => m.id === messageId ? { ...m, ...patch } : m)
    persist({ ...cur, chatMessages: { ...cur.chatMessages, [conversationId]: updated } })
  }, [])

  const conversationById = useCallback((id) => memoryState.conversations?.[id] || null, [])
  const chatMessagesFor = useCallback((id) => memoryState.chatMessages?.[id] || [], [])
  const allConversationsSorted = useCallback(() =>
    Object.values(memoryState.conversations || {})
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return (b.updatedAt || '').localeCompare(a.updatedAt || '')
      }),
  [])

  // Phase 2: kick off an async summary job for a document. No-op when the
  // Ollama bridge is disabled or the call fails — the document just keeps
  // its excerpt fallback. Marks `summaryStatus: 'pending'` while running so
  // the UI can show a spinner; clears it when done (or on failure).
  const requestSummary = useCallback((id) => {
    const cur = memoryState
    const meta = cur.documents?.[id]
    const content = cur.documentContents?.[id]
    if (!meta || !content?.plainText) return
    // No-op when Ollama is disabled — don't even mark pending. The UI's
    // "Enable Ollama" hint takes care of the messaging in that state.
    if (!OLLAMA_CONFIG.enabled) return
    persist({
      ...cur,
      documents: { ...cur.documents, [id]: { ...meta, summaryStatus: 'pending' } },
    })
    // Fire-and-forget — read latest state at completion time so concurrent
    // updates (e.g. user editing tags mid-summary) don't get clobbered.
    generateSummary(content.plainText)
      .then((summary) => {
        const latest = memoryState
        const latestMeta = latest.documents?.[id]
        if (!latestMeta) return
        persist({
          ...latest,
          documents: {
            ...latest.documents,
            [id]: {
              ...latestMeta,
              summary: summary || latestMeta.summary || null,
              summaryStatus: summary ? 'done' : 'failed',
              updatedAt: new Date().toISOString(),
            },
          },
        })
      })
      .catch(() => {
        const latest = memoryState
        const latestMeta = latest.documents?.[id]
        if (!latestMeta) return
        persist({
          ...latest,
          documents: { ...latest.documents, [id]: { ...latestMeta, summaryStatus: 'failed' } },
        })
      })
  }, [])

  // ── Flow Academy ─────────────────────────────────────────────────────────────
  // Each course stores its full lesson array inline. Lesson bodies + quizzes
  // are null until generated on first open (lazy via courseGenerator).

  const addCourse = useCallback((data) => {
    const cur = memoryState
    const id = `course_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()
    const course = {
      id,
      topic:                    String(data.topic || '').trim(),
      title:                    String(data.title || '').trim(),
      summary:                  String(data.summary || '').trim(),
      estimatedDurationMinutes: Number(data.estimatedDurationMinutes) || 45,
      objectives:               Array.isArray(data.objectives)     ? data.objectives     : [],
      keyVocabulary:            Array.isArray(data.keyVocabulary)  ? data.keyVocabulary  : [],
      status:                   'draft',
      createdAt:                now,
      completedAt:              null,
      lessons:                  Array.isArray(data.lessons)        ? data.lessons        : [],
    }
    persist({ ...cur, courses: { ...cur.courses, [id]: course } })
    return course
  }, [])

  const addBrief = useCallback((brief) => {
    const cur = memoryState
    persist({ ...cur, briefs: { ...cur.briefs, [brief.id]: brief } })
  }, [])

  const deleteBrief = useCallback((id) => {
    const cur = memoryState
    const next = { ...cur.briefs }
    delete next[id]
    persist({ ...cur, briefs: next })
  }, [])

  const markBriefRead = useCallback((id) => {
    const cur = memoryState
    const brief = cur.briefs[id]
    if (!brief || brief.readAt != null) return
    persist({ ...cur, briefs: { ...cur.briefs, [id]: { ...brief, readAt: Date.now() } } })
  }, [])

  const markAllBriefsRead = useCallback(() => {
    const cur = memoryState
    const now = Date.now()
    const updated = {}
    for (const [k, v] of Object.entries(cur.briefs)) {
      updated[k] = v.readAt == null ? { ...v, readAt: now } : v
    }
    persist({ ...cur, briefs: updated })
  }, [])

  const updateCourse = useCallback((id, patch) => {
    const cur = memoryState
    const existing = cur.courses?.[id]
    if (!existing) return null
    const next = { ...existing, ...patch, id }
    persist({ ...cur, courses: { ...cur.courses, [id]: next } })
    return next
  }, [])

  const deleteCourse = useCallback((id) => {
    const cur = memoryState
    const next = { ...cur.courses }
    delete next[id]
    persist({ ...cur, courses: next })
  }, [])

  const updateLesson = useCallback((courseId, lessonId, patch) => {
    const cur = memoryState
    const course = cur.courses?.[courseId]
    if (!course) return null
    const lessons = course.lessons.map((l) => l.id === lessonId ? { ...l, ...patch } : l)
    const next = { ...course, lessons }
    persist({ ...cur, courses: { ...cur.courses, [courseId]: next } })
    return next
  }, [])

  const courseById = useCallback((id) => memoryState.courses?.[id] || null, [])

  const allCoursesSorted = useCallback(() =>
    Object.values(memoryState.courses || {})
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
  [])

  // ── Code Academy ─────────────────────────────────────────────────────────────

  const addCodeLesson = useCallback((key, lesson) => {
    const cur = memoryState
    persist({ ...cur, codeLessons: { ...cur.codeLessons, [key]: lesson } })
  }, [])

  const deleteCodeLesson = useCallback((key) => {
    const cur = memoryState
    const nextLessons   = { ...cur.codeLessons }
    const nextProgress  = { ...cur.codeProgress }
    delete nextLessons[key]
    delete nextProgress[key]
    persist({ ...cur, codeLessons: nextLessons, codeProgress: nextProgress })
  }, [])

  const getCodeLesson = useCallback((key) => memoryState.codeLessons?.[key] || null, [])

  const saveCodeProgress = useCallback((key, patch) => {
    const cur = memoryState
    const existing = cur.codeProgress?.[key] || {
      lessonKey: key,
      attempts: 0,
      hintsUsed: 0,
      exercisesCompleted: 0,
      exercisesTotal: 0,
      masteryState: 'not_started',
    }
    persist({ ...cur, codeProgress: { ...cur.codeProgress, [key]: { ...existing, ...patch } } })
  }, [])

  const getCodeProgress = useCallback((key) => memoryState.codeProgress?.[key] || null, [])

  const allCodeProgress = useCallback(() => Object.values(memoryState.codeProgress || {}), [])

  const updatePythonProgress = useCallback((id, partial) => {
    const cur = memoryState
    const existing = cur.pythonProgress?.[id] || {
      subLessonId: id, viewed: false, practiced: false, completed: false, skipped: false, lastOpenedAt: '',
    }
    const updated = { ...existing, ...partial, subLessonId: id, lastOpenedAt: new Date().toISOString() }
    persist({ ...cur, pythonProgress: { ...cur.pythonProgress, [id]: updated } })
  }, [])

  return {
    ...state,
    toggleSave, toggleFollow, dismiss,
    recordView, recordSearch,
    addMemory, updateMemory, deleteMemory, isMemoryDismissed, pinMemoryAsIdentity,
    notesFor, addNote, removeNote,
    addUserTopic, removeUserTopic, updateUserTopic, userTopicBySlug,
    addManualContent, removeManualContent, manualContentForTopic, manualContentByUrl,
    addDocument, updateDocument, removeDocument, reprocessDocument, documentById, documentContentById, documentsForTopic, requestSummary,
    addFolder, renameFolder, removeFolder, ensureFolderByName,
    setTopicSummary, clearTopicSummary,
    createConversation, updateConversation, deleteConversation, addChatMessage, patchChatMessage,
    conversationById, chatMessagesFor, allConversationsSorted,
    isSaved, isFollowing, isDismissed, viewCount, recentSearches,
    // Flow Academy
    addCourse, updateCourse, deleteCourse, updateLesson,
    courseById, allCoursesSorted,
    addBrief,
    deleteBrief,
    markBriefRead,
    markAllBriefsRead,
    // Code Academy
    addCodeLesson, deleteCodeLesson, getCodeLesson, saveCodeProgress, getCodeProgress, allCodeProgress,
    // Python Curriculum
    updatePythonProgress,
  }
}
