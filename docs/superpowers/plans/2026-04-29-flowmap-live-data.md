# FlowMap Live Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Flow Map page graph and all info panels to the user's current data — user-added topics, documents, manual content, memory entries, and interaction signals — instead of static seed-only JSON.

**Architecture:** `buildGraph(seed, userState)` now accepts user state from the store and injects user entities as graph nodes, generates their edges, then applies signal-based weight boosts (follows/saves/views) to existing edges. `useGraph` subscribes to both `useSeed` and `useStore` and passes the relevant slice into `buildGraph`. Panel fixes (ConnectedSources, DerivedSignals, PipelineStrip, header chip) are driven by computed values passed as props from `FlowMap.jsx`, which already holds the store.

**Tech Stack:** React 18, Vitest, `useSyncExternalStore`

---

## File Map

| File | Change |
|---|---|
| `src/lib/graph/nodeTaxonomy.js` | Add `document` type (amber `#f59e0b`) |
| `src/lib/graph/nodeTaxonomy.test.js` | Update count assertions from 12 → 13 |
| `src/lib/graph/buildGraph.js` | Accept `userState`; inject user nodes; apply signal boosts |
| `src/lib/graph/buildGraph.test.js` | Add tests for user node injection and signal boosts |
| `src/store/useGraph.js` | Pull from `useStore()`; pass user state to `buildGraph` |
| `src/store/useGraph.test.js` | Update description; confirm basic contract still holds |
| `src/components/flow/ConnectedSources.jsx` | Accept `videoCount`, `documentCount`, `hnContentCount` props |
| `src/components/flow/DerivedSignals.jsx` | Accept `recentlyReinforced` string prop |
| `src/views/FlowMap.jsx` | Destructure `manualContent`, `memoryEntries` from store; compute all derived values; pass new props; fix `|| 1` bug; update header chip |

---

## Task 1: Add `document` node type to taxonomy

**Files:**
- Modify: `src/lib/graph/nodeTaxonomy.test.js`
- Modify: `src/lib/graph/nodeTaxonomy.js`

- [ ] **Step 1: Update the tests first**

Replace the count assertions in `src/lib/graph/nodeTaxonomy.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { NODE_TYPES, getTypeMeta, RGB } from './nodeTaxonomy.js'

describe('nodeTaxonomy', () => {
  it('defines 13 node types', () => {
    expect(NODE_TYPES.length).toBe(13)
  })
  it('each type has id, label, color', () => {
    for (const t of NODE_TYPES) {
      expect(t.id).toBeTruthy()
      expect(t.label).toBeTruthy()
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
  it('getTypeMeta resolves a known type', () => {
    expect(getTypeMeta('topic').label).toBe('Topic')
  })
  it('returns a fallback for unknown', () => {
    expect(getTypeMeta('zzz').color).toBe('#94a3b8')
  })
  it('RGB has 13 entries', () => {
    expect(Object.keys(RGB).length).toBe(13)
    expect(RGB.topic).toHaveLength(3)
    expect(RGB.topic.every((n) => typeof n === 'number')).toBe(true)
  })
  it('document type exists with amber color', () => {
    const doc = getTypeMeta('document')
    expect(doc.label).toBe('Document')
    expect(doc.color).toBe('#f59e0b')
  })
})
```

- [ ] **Step 2: Run tests — expect failure on count assertions**

```
npm run test:run -- src/lib/graph/nodeTaxonomy.test.js
```

Expected: FAIL — `expected 12 to be 13` and `document type exists` test fails.

- [ ] **Step 3: Add the document type to nodeTaxonomy.js**

Insert after the `memory` line in `src/lib/graph/nodeTaxonomy.js`:

```js
export const NODE_TYPES = [
  { id: 'topic',         label: 'Topic',        color: '#d946ef' },
  { id: 'concept',       label: 'Concept',      color: '#94a3b8' },
  { id: 'tool',          label: 'Tool',         color: '#06b6d4' },
  { id: 'company',       label: 'Company',      color: '#3b82f6' },
  { id: 'creator',       label: 'Creator',      color: '#14b8a6' },
  { id: 'video',         label: 'Video',        color: '#ec4899' },
  { id: 'article',       label: 'Article',      color: '#6366f1' },
  { id: 'social_post',   label: 'Social Post',  color: '#8b5cf6' },
  { id: 'tag',           label: 'Tag',          color: '#64748b' },
  { id: 'learning_path', label: 'Learning',     color: '#10b981' },
  { id: 'memory',        label: 'Memory',       color: '#a855f7' },
  { id: 'signal',        label: 'Signal',       color: '#f43f5e' },
  { id: 'document',      label: 'Document',     color: '#f59e0b' },
]
```

- [ ] **Step 4: Run tests — expect pass**

```
npm run test:run -- src/lib/graph/nodeTaxonomy.test.js
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/nodeTaxonomy.js src/lib/graph/nodeTaxonomy.test.js
git commit -m "feat(graph): add document node type to taxonomy"
```

---

## Task 2: Inject user entities into buildGraph

**Files:**
- Modify: `src/lib/graph/buildGraph.test.js`
- Modify: `src/lib/graph/buildGraph.js`

- [ ] **Step 1: Add failing tests for user node injection**

Append these tests to `src/lib/graph/buildGraph.test.js` (keep all existing tests):

```js
const emptyUserState = {
  userTopics: {}, documents: {}, manualContent: {}, memoryEntries: {},
  saves: {}, views: {}, follows: {},
}

describe('buildGraph — user entity injection', () => {
  it('injects userTopics as topic nodes', () => {
    const userState = {
      ...emptyUserState,
      userTopics: {
        'utopic_1': { id: 'utopic_1', name: 'My Topic', slug: 'my-topic', summary: 'custom' },
      },
    }
    const g = buildGraph(seed, userState)
    const node = g.nodes.find((n) => n.id === 'utopic_1')
    expect(node).toBeDefined()
    expect(node.type).toBe('topic')
    expect(node.label).toBe('My Topic')
  })

  it('injects manualContent as typed nodes with edges to their topicIds', () => {
    const userState = {
      ...emptyUserState,
      manualContent: {
        'art_1': {
          id: 'art_1',
          item: { id: 'art_1', type: 'article', title: 'A great read', summary: '' },
          topicIds: ['topic_x'],
          savedAt: '2026-01-01',
        },
      },
    }
    const g = buildGraph(seed, userState)
    const node = g.nodes.find((n) => n.id === 'art_1')
    expect(node).toBeDefined()
    expect(node.type).toBe('article')
    const edge = g.edges.find((e) =>
      (e.from === 'art_1' && e.to === 'topic_x') || (e.from === 'topic_x' && e.to === 'art_1')
    )
    expect(edge).toBeDefined()
    expect(edge.kind).toBe('covers')
  })

  it('injects documents as document type nodes', () => {
    const userState = {
      ...emptyUserState,
      documents: {
        'doc_1': { id: 'doc_1', title: 'My Notes', topics: [], excerpt: 'intro text', updatedAt: '2026-01-01' },
      },
    }
    const g = buildGraph(seed, userState)
    const node = g.nodes.find((n) => n.id === 'doc_1')
    expect(node).toBeDefined()
    expect(node.type).toBe('document')
    expect(node.label).toBe('My Notes')
    expect(node.summary).toBe('intro text')
  })

  it('generates edges from document.topics to resolved seed topic', () => {
    const userState = {
      ...emptyUserState,
      documents: {
        'doc_2': { id: 'doc_2', title: 'Notes', topics: ['topic_x'], excerpt: '', updatedAt: '2026-01-01' },
      },
    }
    const g = buildGraph(seed, userState)
    const edge = g.edges.find((e) =>
      (e.from === 'doc_2' && e.to === 'topic_x') || (e.from === 'topic_x' && e.to === 'doc_2')
    )
    expect(edge).toBeDefined()
  })

  it('injects memoryEntries as memory nodes', () => {
    const userState = {
      ...emptyUserState,
      memoryEntries: {
        'mem_1': { id: 'mem_1', content: 'Focus on interpretability research', category: 'research_focus' },
      },
    }
    const g = buildGraph(seed, userState)
    const node = g.nodes.find((n) => n.id === 'mem_1')
    expect(node).toBeDefined()
    expect(node.type).toBe('memory')
  })

  it('does not duplicate nodes already in the seed', () => {
    const userState = {
      ...emptyUserState,
      manualContent: {
        'topic_x': {
          id: 'topic_x',
          item: { id: 'topic_x', type: 'article', title: 'Duplicate' },
          topicIds: [],
        },
      },
    }
    const g = buildGraph(seed, userState)
    const dupes = g.nodes.filter((n) => n.id === 'topic_x')
    expect(dupes.length).toBe(1)
  })

  it('backward-compatible: works with no userState argument', () => {
    const g = buildGraph(seed)
    expect(g.nodes.length).toBeGreaterThan(0)
    expect(g.edges.length).toBeGreaterThan(0)
  })
})

describe('buildGraph — signal edge boosts', () => {
  const seedWithRelation = {
    ...seed,
    relations: [{ from: 'tool_x', to: 'topic_x', kind: 'implements', weight: 0.5, evidence: [], lastReinforced: null }],
  }

  it('boosts edge weight for followed topic', () => {
    const userState = { ...emptyUserState, follows: { 'topic_x': { followedAt: '2026-01-01' } } }
    const g = buildGraph(seedWithRelation, userState)
    const edge = g.edges.find((e) => e.from === 'tool_x' && e.to === 'topic_x')
    expect(edge.weight).toBeCloseTo(0.7, 1) // 0.5 * 1.4
  })

  it('boosts edge weight for saved content node', () => {
    const userState = { ...emptyUserState, saves: { 'tool_x': { savedAt: '2026-01-01' } } }
    const g = buildGraph(seedWithRelation, userState)
    const edge = g.edges.find((e) => e.from === 'tool_x' && e.to === 'topic_x')
    expect(edge.weight).toBeCloseTo(0.65, 2) // 0.5 + 0.15
  })

  it('boosts edge weight for viewed content node', () => {
    const userState = { ...emptyUserState, views: { 'tool_x': { count: 5, lastAt: '2026-01-01' } } }
    const g = buildGraph(seedWithRelation, userState)
    const edge = g.edges.find((e) => e.from === 'tool_x' && e.to === 'topic_x')
    // 0.5 + min(0.1, 5 * 0.02) = 0.5 + 0.1 = 0.6
    expect(edge.weight).toBeCloseTo(0.6, 2)
  })

  it('caps boosted weight at 1.0', () => {
    const userState = {
      ...emptyUserState,
      follows: { 'topic_x': { followedAt: '2026-01-01' } },
      saves:   { 'tool_x': { savedAt: '2026-01-01' } },
      views:   { 'tool_x': { count: 100, lastAt: '2026-01-01' } },
    }
    const g = buildGraph(seedWithRelation, userState)
    const edge = g.edges.find((e) => e.from === 'tool_x' && e.to === 'topic_x')
    expect(edge.weight).toBeLessThanOrEqual(1.0)
  })
})
```

- [ ] **Step 2: Run tests — expect new tests to fail**

```
npm run test:run -- src/lib/graph/buildGraph.test.js
```

Expected: original 5 tests pass, new 7 tests fail with `buildGraph is not a function` or argument mismatch.

- [ ] **Step 3: Implement user entity injection in buildGraph.js**

Replace `src/lib/graph/buildGraph.js` with:

```js
function nodeFromEntity(entity, type) {
  return {
    id: entity.id,
    label: entity.name || entity.title || entity.id,
    type,
    summary: entity.summary || '',
  }
}

function nodeFromMemory(entry) {
  const text = entry.content || ''
  const label = text.length > 36 ? text.slice(0, 33).trim() + '…' : text
  return {
    id: entry.id,
    label,
    type: 'memory',
    summary: text,
  }
}

function pushImplicit(map, from, to, contentId, kind = 'derived', weight = 0.5, lastReinforced = null) {
  const k1 = `${from}__${to}`
  const k2 = `${to}__${from}`
  const existing = map.get(k1) || map.get(k2)
  if (existing) {
    if (!existing.evidence.includes(contentId)) existing.evidence.push(contentId)
    existing.weight = Math.min(1.0, existing.weight + 0.05)
    if (lastReinforced && (!existing.lastReinforced || lastReinforced > existing.lastReinforced)) {
      existing.lastReinforced = lastReinforced
    }
    return
  }
  map.set(k1, { from, to, kind, weight, evidence: [contentId], lastReinforced })
}

export function buildGraph(seed, userState = {}) {
  const {
    userTopics = {},
    documents = {},
    manualContent = {},
    memoryEntries = {},
    saves = {},
    views = {},
    follows = {},
  } = userState

  const nodes = [
    ...seed.topics.map((x)    => nodeFromEntity(x, 'topic')),
    ...seed.tools.map((x)     => nodeFromEntity(x, 'tool')),
    ...seed.creators.map((x)  => nodeFromEntity(x, 'creator')),
    ...seed.companies.map((x) => nodeFromEntity(x, 'company')),
    ...seed.concepts.map((x)  => nodeFromEntity(x, 'concept')),
    ...seed.tags.map((x)      => nodeFromEntity(x, 'tag')),
    ...seed.content.map((x)   => nodeFromEntity(x, x.type)),
    ...(seed.seedMemory || []).map(nodeFromMemory),
  ]

  const existingIds = new Set(nodes.map((n) => n.id))

  for (const t of Object.values(userTopics)) {
    if (existingIds.has(t.id)) continue
    nodes.push({ id: t.id, label: t.name || t.id, type: 'topic', summary: t.summary || '' })
    existingIds.add(t.id)
  }

  for (const entry of Object.values(manualContent)) {
    const item = entry.item
    if (!item || existingIds.has(item.id)) continue
    nodes.push({ id: item.id, label: item.title || item.id, type: item.type || 'article', summary: item.summary || '' })
    existingIds.add(item.id)
  }

  for (const doc of Object.values(documents)) {
    if (existingIds.has(doc.id)) continue
    nodes.push({ id: doc.id, label: doc.title || doc.id, type: 'document', summary: doc.excerpt || '' })
    existingIds.add(doc.id)
  }

  for (const entry of Object.values(memoryEntries)) {
    if (existingIds.has(entry.id)) continue
    nodes.push(nodeFromMemory(entry))
    existingIds.add(entry.id)
  }

  const topicById = Object.fromEntries(seed.topics.map((t) => [t.id, t]))
  const topicBySlug = Object.fromEntries(
    seed.topics.filter((t) => t.slug).map((t) => [t.slug, t])
  )

  const explicit = (seed.relations || []).map((r) => ({
    from: r.from,
    to: r.to,
    kind: r.kind || 'related',
    weight: r.weight ?? 0.5,
    evidence: r.evidence || [],
    lastReinforced: r.lastReinforced || null,
  }))

  const implicit = new Map()
  for (const c of seed.content || []) {
    const date = c.publishedAt || null
    for (const tid of c.topicIds || []) {
      pushImplicit(implicit, c.id, tid, c.id, 'covers', 0.6, date)
    }
    if (c.creatorId) pushImplicit(implicit, c.creatorId, c.id, c.id, 'authored', 0.7, date)
    for (const tid of c.toolIds    || []) pushImplicit(implicit, c.id, tid, c.id, 'discusses', 0.5, date)
    for (const cid of c.conceptIds || []) pushImplicit(implicit, c.id, cid, c.id, 'discusses', 0.5, date)
    for (const tid of c.tagIds     || []) pushImplicit(implicit, c.id, tid, c.id, 'tagged_with', 0.3, date)
  }

  for (const entry of Object.values(manualContent)) {
    const item = entry.item
    if (!item || !existingIds.has(item.id)) continue
    for (const tid of entry.topicIds || []) {
      if (existingIds.has(tid)) {
        pushImplicit(implicit, item.id, tid, item.id, 'covers', 0.6, entry.savedAt || null)
      }
    }
  }

  for (const doc of Object.values(documents)) {
    if (!existingIds.has(doc.id)) continue
    for (const ref of doc.topics || []) {
      const resolved = topicById[ref] || topicBySlug[ref]
      if (resolved && existingIds.has(resolved.id)) {
        pushImplicit(implicit, doc.id, resolved.id, doc.id, 'covers', 0.6, doc.updatedAt || null)
      }
    }
  }

  const edges = [...explicit, ...implicit.values()]

  for (const edge of edges) {
    if (follows[edge.from] || follows[edge.to]) {
      edge.weight = Math.min(1.0, edge.weight * 1.4)
    }
    if (saves[edge.from] || saves[edge.to]) {
      edge.weight = Math.min(1.0, edge.weight + 0.15)
    }
    const vc = (views[edge.from]?.count ?? 0) + (views[edge.to]?.count ?? 0)
    if (vc > 0) {
      edge.weight = Math.min(1.0, edge.weight + Math.min(0.1, vc * 0.02))
    }
  }

  return { nodes, edges }
}
```

- [ ] **Step 4: Run all buildGraph tests — expect full pass**

```
npm run test:run -- src/lib/graph/buildGraph.test.js
```

Expected: PASS — all 12 tests (5 original + 7 new) green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/buildGraph.js src/lib/graph/buildGraph.test.js
git commit -m "feat(graph): inject user entities as nodes and apply signal edge boosts"
```

---

## Task 3: Wire useGraph to useStore

**Files:**
- Modify: `src/store/useGraph.test.js`
- Modify: `src/store/useGraph.js`

- [ ] **Step 1: Update the test to reflect the new dependency**

Replace `src/store/useGraph.test.js` with:

```js
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGraph } from './useGraph.js'

describe('useGraph', () => {
  it('returns nodes with positions and edges from seed data', () => {
    const { result } = renderHook(() => useGraph())
    expect(result.current.nodes.length).toBeGreaterThan(10)
    expect(result.current.nodes[0].bx).toBeDefined()
    expect(result.current.edges.length).toBeGreaterThan(0)
  })

  it('every node has bx, by, bz position fields from generatePositions', () => {
    const { result } = renderHook(() => useGraph())
    for (const node of result.current.nodes) {
      expect(typeof node.bx).toBe('number')
      expect(typeof node.by).toBe('number')
      expect(typeof node.bz).toBe('number')
    }
  })
})
```

- [ ] **Step 2: Run tests — expect pass (store returns empty state in test env)**

```
npm run test:run -- src/store/useGraph.test.js
```

Expected: PASS — hook still works because `useStore()` returns empty state in the test environment (no localStorage, no disk sync).

- [ ] **Step 3: Update useGraph.js to pull from useStore**

Replace `src/store/useGraph.js` with:

```js
import { useMemo } from 'react'
import { useSeed } from './useSeed.js'
import { useStore } from './useStore.js'
import { buildGraph } from '../lib/graph/buildGraph.js'
import { generatePositions } from '../lib/graph/nodePositions.js'

export function useGraph() {
  const seed = useSeed()
  const { userTopics, documents, manualContent, memoryEntries, saves, views, follows } = useStore()

  return useMemo(() => {
    const { nodes, edges } = buildGraph(seed, {
      userTopics, documents, manualContent, memoryEntries, saves, views, follows,
    })
    const positioned = generatePositions(nodes)
    return { nodes: positioned, edges }
  }, [seed, userTopics, documents, manualContent, memoryEntries, saves, views, follows])
}
```

- [ ] **Step 4: Run all graph-layer tests**

```
npm run test:run -- src/store/useGraph.test.js src/lib/graph/buildGraph.test.js src/lib/graph/nodeTaxonomy.test.js
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/store/useGraph.js src/store/useGraph.test.js
git commit -m "feat(graph): wire useGraph to useStore so user data appears in the network"
```

---

## Task 4: Fix ConnectedSources panel

**Files:**
- Modify: `src/components/flow/ConnectedSources.jsx`
- Modify: `src/views/FlowMap.jsx`

- [ ] **Step 1: Rewrite ConnectedSources to accept computed props**

Replace `src/components/flow/ConnectedSources.jsx` with:

```jsx
export default function ConnectedSources({ videoCount = 0, documentCount = 0, hnContentCount = 0 }) {
  const sources = [
    {
      id: 'youtube',
      label: 'YouTube',
      status: videoCount > 0 ? 'connected' : 'planned',
      desc: videoCount > 0 ? `${videoCount} videos indexed` : 'Curated seed feed',
    },
    {
      id: 'rss',
      label: 'RSS readers',
      status: documentCount > 0 ? 'connected' : 'planned',
      desc: documentCount > 0 ? `${documentCount} documents added` : 'Anthropic, OpenAI, Simon Willison',
    },
    {
      id: 'hn',
      label: 'Hacker News',
      status: hnContentCount > 0 ? 'connected' : 'planned',
      desc: hnContentCount > 0 ? `${hnContentCount} items from HN` : 'AI/agent topical filter',
    },
  ]

  return (
    <div className="glass-panel p-5">
      <h2 className="text-[13px] font-semibold mb-3">Connected sources</h2>
      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2 border-t border-[color:var(--color-border-subtle)] first:border-t-0">
            <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
            <span className="chip">SOURCE</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{s.label}</div>
              <div className="text-[11px] text-[color:var(--color-text-tertiary)] truncate">{s.desc}</div>
            </div>
            <span className={`text-[11px] ${s.status === 'connected' ? 'text-emerald-400' : 'text-[color:var(--color-text-tertiary)]'}`}>
              {s.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Add store destructuring and source computations in FlowMap.jsx**

In `src/views/FlowMap.jsx`, update the `useStore()` destructure line (currently `const { saves, follows, documents, userTopics } = useStore()`) to:

```js
const { saves, follows, documents, userTopics, manualContent, memoryEntries } = useStore()
```

Then add these computed values right after the existing `kpis` array (before the `return`):

```js
const manualVideos = Object.values(manualContent || {}).filter((e) => e.item?.type === 'video').length
const hnContentCount = Object.values(manualContent || {}).filter(
  (e) => (e.item?.url || '').includes('news.ycombinator.com')
).length
const documentCount = Object.keys(documents || {}).length
const totalVideoCount = videos + manualVideos
```

- [ ] **Step 3: Pass props to ConnectedSources in FlowMap.jsx**

Find the `<ConnectedSources />` line and replace it with:

```jsx
<ConnectedSources
  videoCount={totalVideoCount}
  documentCount={documentCount}
  hnContentCount={hnContentCount}
/>
```

- [ ] **Step 4: Run the full test suite**

```
npm run test:run
```

Expected: PASS — no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/components/flow/ConnectedSources.jsx src/views/FlowMap.jsx
git commit -m "feat(flowmap): ConnectedSources derives status from real content counts"
```

---

## Task 5: Fix DerivedSignals "Recently reinforced" row

**Files:**
- Modify: `src/views/FlowMap.jsx`
- Modify: `src/components/flow/DerivedSignals.jsx`

- [ ] **Step 1: Add `recentlyReinforced` computation helper in FlowMap.jsx**

Add this function at the module level (above the `FlowMap` component) in `src/views/FlowMap.jsx`:

```js
function computeRecentlyReinforced(seedContent, seedTopics, manualContent, views, saves) {
  let latestId = null
  let latestTime = ''

  for (const [id, v] of Object.entries(views || {})) {
    if ((v.lastAt || '') > latestTime) { latestTime = v.lastAt; latestId = id }
  }
  for (const [id, s] of Object.entries(saves || {})) {
    if ((s.savedAt || '') > latestTime) { latestTime = s.savedAt; latestId = id }
  }

  if (!latestId) return '—'

  const seedItem = seedContent.find((c) => c.id === latestId)
  const manualEntry = seedItem
    ? null
    : Object.values(manualContent || {}).find((e) => e.item?.id === latestId)

  const topicId = (seedItem?.topicIds || manualEntry?.topicIds || [])[0]
  if (!topicId) return '—'

  const topic = seedTopics.find((t) => t.id === topicId)
  return (topic?.name || topicId).replace(/^topic_/, '').replace(/_/g, ' ')
}
```

- [ ] **Step 2: Call the helper and pass result to DerivedSignals in FlowMap.jsx**

Inside the `FlowMap` component body, add after the existing computed values:

```js
const recentlyReinforced = computeRecentlyReinforced(content, topics, manualContent, views, saves)
```

Find `<DerivedSignals patterns={patterns} />` and replace with:

```jsx
<DerivedSignals patterns={patterns} recentlyReinforced={recentlyReinforced} />
```

- [ ] **Step 3: Update DerivedSignals.jsx to use the prop**

Replace `src/components/flow/DerivedSignals.jsx` with:

```jsx
import Pill from '../ui/Pill.jsx'

export default function DerivedSignals({ patterns, recentlyReinforced = '—' }) {
  const top = patterns?.coOccurrence?.[0]
  const topAffinity = Object.entries(patterns?.topicAffinity || {}).sort((a, b) => b[1] - a[1])[0]

  const rows = [
    {
      label: 'Strongest co-occurrence',
      value: top ? `${top.a.replace('topic_', '')} + ${top.b.replace('topic_', '')}` : '—',
      tone: 'positive',
    },
    {
      label: 'Top topic affinity',
      value: topAffinity ? topAffinity[0].replace('topic_', '') : '—',
      tone: 'accent',
    },
    {
      label: 'Recently reinforced',
      value: recentlyReinforced,
      tone: 'warning',
    },
  ]

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold">Derived signals</h2>
        <span className="text-[10px] text-[color:var(--color-text-tertiary)]">computed from your behavior</span>
      </div>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-3 py-2 border-t border-[color:var(--color-border-subtle)] first:border-t-0">
            <span className="chip">SIGNAL</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{r.label}</div>
            </div>
            <Pill tone={r.tone}>{r.value}</Pill>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run full test suite**

```
npm run test:run
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/views/FlowMap.jsx src/components/flow/DerivedSignals.jsx
git commit -m "feat(flowmap): DerivedSignals recently-reinforced computed from real view/save activity"
```

---

## Task 6: Fix PipelineStrip counts and header chip

**Files:**
- Modify: `src/views/FlowMap.jsx`

- [ ] **Step 1: Fix the retain count and add hasUserData flag in FlowMap.jsx**

Inside the `FlowMap` component, add after the other computed values:

```js
const retainCount = savedCount + Object.keys(memoryEntries || {}).length
const hasUserData =
  Object.keys(userTopics || {}).length > 0 ||
  Object.keys(documents || {}).length > 0 ||
  Object.keys(manualContent || {}).length > 0
```

- [ ] **Step 2: Fix the PipelineStrip counts — remove the `|| 1` and use retainCount**

Find:
```jsx
<PipelineStrip counts={{ discover: followedCount || 1, parse: totalContent, classify: edges.length, retain: savedCount }} />
```

Replace with:
```jsx
<PipelineStrip counts={{ discover: followedCount, parse: totalContent, classify: edges.length, retain: retainCount }} />
```

- [ ] **Step 3: Update the header chip to reflect user vs seed state**

Find:
```jsx
<span className="chip border-[color:var(--color-creator)]/40 bg-[color:var(--color-creator)]/10 text-[color:var(--color-creator)]">
  <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-creator)] animate-pulse" />
  Live · seed
</span>
```

Replace with:
```jsx
<span className="chip border-[color:var(--color-creator)]/40 bg-[color:var(--color-creator)]/10 text-[color:var(--color-creator)]">
  <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-creator)] animate-pulse" />
  {hasUserData ? 'Live · personal' : 'Live · seed'}
</span>
```

- [ ] **Step 4: Run full test suite**

```
npm run test:run
```

Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/views/FlowMap.jsx
git commit -m "feat(flowmap): fix pipeline retain count, remove discover || 1 mask, header chip reflects user data"
```

---

## Verification Checklist

After all tasks complete, manually verify in the browser (`npm run dev`):

- [ ] Open Flow Map page with a fresh user (no data) — graph shows seed nodes, header says "Live · seed", all three source rows show "planned"
- [ ] Add a user topic (via the Topics page) — it appears as a purple topic node in the 3D graph on next visit to Flow Map
- [ ] Follow a topic — its edges appear thicker than unrelated nodes
- [ ] Save a content item — edges from that content node are boosted
- [ ] Add a document (via Documents/ingest) — it appears as an amber node in the graph
- [ ] After any views or saves, "Recently reinforced" in Derived Signals shows a real topic name, not "computing"
- [ ] YouTube row shows "connected" with a video count
- [ ] RSS row status matches whether any documents exist
- [ ] Retain count in PipelineStrip = saved items + memory entries
- [ ] Discover count shows 0 when following nothing (no longer masked to 1)
