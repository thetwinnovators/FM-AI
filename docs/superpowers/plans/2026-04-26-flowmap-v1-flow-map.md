# FlowMap v1 — Plan 3: Flow Map Cinematic Centerpiece Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Flow Map page — interactive 3D canvas graph, glass sidebar, KPI strip, sources/signals cards, full Interest Memory panel — and the pattern engine that turns user behavior + curated relations into typed, weighted, evolving graph context.

**Architecture:** A single canvas-rendered `FlowGraph` component drives the 3D visualization. Nodes are derived from the seed (topics, tools, creators, etc. + content items). Edges come from two sources: (a) explicit `relations.json` and (b) implicit edges derived from content's `topicIds`, `creatorId`, `toolIds`, `conceptIds`. A `useLearning` hook computes pattern signals from `useStore` behavioral data: edge weight boosts, node affinity, suggested entities. The graph reads typed/weighted edges from a unified `useGraph` hook. Click handlers dispatch to existing surfaces — video → modal, article → reader, topic → `/topic/:slug`.

**Tech Stack:** Same as Plans 1–2 + plain HTML5 canvas API (no library).

**Spec reference:** [docs/superpowers/specs/2026-04-26-flowmap-v1-design.md](../specs/2026-04-26-flowmap-v1-design.md) §7.4, §8.
**Plan dependencies:** Plans 1 and 2 must be complete.

**Plan covers:** Phase 5 (Flow Map page) from spec.

---

## File Structure

### Files created

```
src/
├── lib/
│   ├── graph/
│   │   ├── nodeTaxonomy.js                    (12 node types + colors)
│   │   ├── nodeTaxonomy.test.js
│   │   ├── buildGraph.js                      (nodes + edges from seed)
│   │   ├── buildGraph.test.js
│   │   ├── nodePositions.js                   (procedural 3D placement)
│   │   ├── nodePositions.test.js
│   │   ├── pattern.js                         (co-occurrence, weights, suggestions)
│   │   └── pattern.test.js
│   └── (none)
├── store/
│   ├── useGraph.js                            (assembles nodes + edges + colors)
│   ├── useGraph.test.js
│   ├── useLearning.js                         (pattern derivations from useStore)
│   └── useLearning.test.js
├── components/
│   └── flow/
│       ├── FlowGraph.jsx                      (canvas renderer — the big one)
│       ├── PipelineStrip.jsx
│       ├── GlassSidebar.jsx                   (Directory / Search / Detail)
│       ├── KpiRow.jsx
│       ├── ConnectedSources.jsx
│       ├── DerivedSignals.jsx
│       └── InterestMemoryPanel.jsx            (Flow Map page version, reuses Memory components)
└── views/
    └── (rewrite) FlowMap.jsx
```

### Files modified

- `src/views/FlowMap.jsx` — full rewrite (was a stub).

---

# Phase 5 — Flow Map page

## Task 1: Build `nodeTaxonomy.js` (12 types + colors, TDD)

**Files:**
- Create: `src/lib/graph/nodeTaxonomy.js`
- Create: `src/lib/graph/nodeTaxonomy.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest'
import { NODE_TYPES, getTypeMeta, RGB } from './nodeTaxonomy.js'

describe('nodeTaxonomy', () => {
  it('defines 12 node types', () => {
    expect(NODE_TYPES.length).toBe(12)
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
  it('RGB has 12 entries', () => {
    expect(Object.keys(RGB).length).toBe(12)
    expect(RGB.topic).toHaveLength(3)
    expect(RGB.topic.every((n) => typeof n === 'number')).toBe(true)
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
npm run test:run -- src/lib/graph/nodeTaxonomy.test.js
```

- [ ] **Step 3: Implement**

```js
export const NODE_TYPES = [
  { id: 'topic',         label: 'Topic',        color: '#f97316' },
  { id: 'concept',       label: 'Concept',      color: '#94a3b8' },
  { id: 'tool',          label: 'Tool',         color: '#06b6d4' },
  { id: 'company',       label: 'Company',      color: '#3b82f6' },
  { id: 'creator',       label: 'Creator',      color: '#14b8a6' },
  { id: 'video',         label: 'Video',        color: '#ec4899' },
  { id: 'article',       label: 'Article',      color: '#f59e0b' },
  { id: 'social_post',   label: 'Social Post',  color: '#8b5cf6' },
  { id: 'tag',           label: 'Tag',          color: '#64748b' },
  { id: 'learning_path', label: 'Learning',     color: '#10b981' },
  { id: 'memory',        label: 'Memory',       color: '#a855f7' },
  { id: 'signal',        label: 'Signal',       color: '#f43f5e' },
]

const BY_ID = Object.fromEntries(NODE_TYPES.map((t) => [t.id, t]))
const FALLBACK = { id: 'unknown', label: 'Unknown', color: '#94a3b8' }

export function getTypeMeta(id) {
  return BY_ID[id] || FALLBACK
}

function hexToRgb(hex) {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return [148, 163, 184]
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

export const RGB = Object.fromEntries(NODE_TYPES.map((t) => [t.id, hexToRgb(t.color)]))
```

- [ ] **Step 4: Run — should pass**

```bash
npm run test:run -- src/lib/graph/nodeTaxonomy.test.js
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/nodeTaxonomy.js src/lib/graph/nodeTaxonomy.test.js
git commit -m "feat(graph): add node taxonomy with 12 types + RGB"
```

---

## Task 2: Build `nodePositions.js` (procedural 3D placement, TDD)

**Files:**
- Create: `src/lib/graph/nodePositions.js`
- Create: `src/lib/graph/nodePositions.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest'
import { generatePositions } from './nodePositions.js'

const nodes = [
  { id: 'a', type: 'company' },
  { id: 'b', type: 'topic'   },
  { id: 'c', type: 'tool'    },
  { id: 'd', type: 'video'   },
  { id: 'e', type: 'creator' },
]

describe('generatePositions', () => {
  it('returns the same number of nodes', () => {
    const out = generatePositions(nodes)
    expect(out.length).toBe(nodes.length)
  })
  it('each output has bx, by, bz, phase', () => {
    const out = generatePositions(nodes)
    for (const n of out) {
      expect(typeof n.bx).toBe('number')
      expect(typeof n.by).toBe('number')
      expect(typeof n.bz).toBe('number')
      expect(typeof n.phase).toBe('number')
    }
  })
  it('clusters by type along x', () => {
    const out = generatePositions(nodes)
    const company = out.find((n) => n.id === 'a').bx
    const creator = out.find((n) => n.id === 'e').bx
    expect(company).toBeLessThan(creator)
  })
  it('is deterministic for the same input', () => {
    const a = generatePositions(nodes).map((n) => n.bx)
    const b = generatePositions(nodes).map((n) => n.bx)
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Implement**

```js
const X_BY_TYPE = {
  company:        -2.6,
  creator:         2.6,
  topic:          -1.0,
  concept:         0.2,
  tool:            0.2,
  tag:             0.2,
  learning_path:   1.4,
  memory:         -2.0,
  signal:          1.8,
  video:           1.5,
  article:         1.5,
  social_post:     1.5,
}

function pseudoRandom(seedStr) {
  let h = 0
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) | 0
  return () => {
    h = (h * 1103515245 + 12345) | 0
    return ((h >>> 0) % 1000) / 1000
  }
}

export function generatePositions(nodes) {
  return nodes.map((n) => {
    const rng = pseudoRandom(n.id)
    const bx = (X_BY_TYPE[n.type] ?? 0) + (rng() - 0.5) * 0.4
    const by = (rng() - 0.5) * 3.2
    const bz = (rng() - 0.5) * 0.8
    const phase = rng() * Math.PI * 2
    return { ...n, bx, by, bz, phase }
  })
}
```

- [ ] **Step 4: Run — should pass**

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/nodePositions.js src/lib/graph/nodePositions.test.js
git commit -m "feat(graph): add procedural node position generator"
```

---

## Task 3: Build `buildGraph.js` (nodes + edges from seed, TDD)

**Files:**
- Create: `src/lib/graph/buildGraph.js`
- Create: `src/lib/graph/buildGraph.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest'
import { buildGraph } from './buildGraph.js'

const seed = {
  topics:    [{ id: 'topic_x', name: 'X' }],
  tools:     [{ id: 'tool_x',  name: 'X tool', topicIds: ['topic_x'] }],
  creators:  [{ id: 'creator_x', name: 'X creator', topicIds: ['topic_x'] }],
  companies: [],
  concepts:  [{ id: 'concept_x', name: 'X concept', topicIds: ['topic_x'] }],
  tags:      [],
  content:   [
    { id: 'vid_x', type: 'video', title: 'X video', topicIds: ['topic_x'], creatorId: 'creator_x', toolIds: ['tool_x'], conceptIds: ['concept_x'], publishedAt: '2025-01-01' }
  ],
  relations: [
    { from: 'tool_x', to: 'topic_x', kind: 'implements', weight: 1.0, evidence: ['vid_x'], lastReinforced: '2025-01-01' }
  ],
}

describe('buildGraph', () => {
  it('produces a node per entity', () => {
    const g = buildGraph(seed)
    const ids = new Set(g.nodes.map((n) => n.id))
    expect(ids.has('topic_x')).toBe(true)
    expect(ids.has('tool_x')).toBe(true)
    expect(ids.has('creator_x')).toBe(true)
    expect(ids.has('concept_x')).toBe(true)
    expect(ids.has('vid_x')).toBe(true)
  })
  it('each node carries id, label, type', () => {
    const g = buildGraph(seed)
    const t = g.nodes.find((n) => n.id === 'topic_x')
    expect(t.label).toBe('X')
    expect(t.type).toBe('topic')
  })
  it('includes explicit edges from relations.json', () => {
    const g = buildGraph(seed)
    const e = g.edges.find((e) => e.from === 'tool_x' && e.to === 'topic_x')
    expect(e).toBeDefined()
    expect(e.kind).toBe('implements')
    expect(e.weight).toBe(1.0)
  })
  it('derives implicit edges from content', () => {
    const g = buildGraph(seed)
    const e1 = g.edges.find((e) => (e.from === 'vid_x' && e.to === 'topic_x') || (e.from === 'topic_x' && e.to === 'vid_x'))
    const e2 = g.edges.find((e) => (e.from === 'vid_x' && e.to === 'creator_x') || (e.from === 'creator_x' && e.to === 'vid_x'))
    expect(e1).toBeDefined()
    expect(e2).toBeDefined()
  })
  it('implicit edges have evidence and weight', () => {
    const g = buildGraph(seed)
    const e = g.edges.find((e) => (e.from === 'vid_x' && e.to === 'topic_x') || (e.from === 'topic_x' && e.to === 'vid_x'))
    expect(e.evidence).toContain('vid_x')
    expect(e.weight).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Implement**

```js
function nodeFromEntity(entity, type) {
  return {
    id: entity.id,
    label: entity.name || entity.title || entity.id,
    type,
    summary: entity.summary || '',
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

export function buildGraph(seed) {
  const nodes = [
    ...seed.topics.map((x)    => nodeFromEntity(x, 'topic')),
    ...seed.tools.map((x)     => nodeFromEntity(x, 'tool')),
    ...seed.creators.map((x)  => nodeFromEntity(x, 'creator')),
    ...seed.companies.map((x) => nodeFromEntity(x, 'company')),
    ...seed.concepts.map((x)  => nodeFromEntity(x, 'concept')),
    ...seed.tags.map((x)      => nodeFromEntity(x, 'tag')),
    ...seed.content.map((x)   => nodeFromEntity(x, x.type)),
  ]

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
    for (const tid of c.toolIds   || []) pushImplicit(implicit, c.id, tid, c.id, 'discusses', 0.5, date)
    for (const cid of c.conceptIds|| []) pushImplicit(implicit, c.id, cid, c.id, 'discusses', 0.5, date)
    for (const tid of c.tagIds    || []) pushImplicit(implicit, c.id, tid, c.id, 'tagged_with', 0.3, date)
  }

  return { nodes, edges: [...explicit, ...implicit.values()] }
}
```

- [ ] **Step 4: Run — should pass**

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/buildGraph.js src/lib/graph/buildGraph.test.js
git commit -m "feat(graph): build typed/weighted graph from seed"
```

---

## Task 4: Build `pattern.js` (co-occurrence + node affinity, TDD)

**Files:**
- Create: `src/lib/graph/pattern.js`
- Create: `src/lib/graph/pattern.test.js`

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest'
import { computePatterns } from './pattern.js'

const seed = {
  content: [
    { id: 'c1', topicIds: ['t1', 't2'] },
    { id: 'c2', topicIds: ['t1', 't2'] },
    { id: 'c3', topicIds: ['t1', 't3'] },
    { id: 'c4', topicIds: ['t1'] },
  ]
}

describe('computePatterns', () => {
  it('returns coOccurrence pairs sorted by frequency', () => {
    const p = computePatterns(seed, { saves: {}, follows: {}, views: {} })
    const top = p.coOccurrence[0]
    expect([top.a, top.b].sort()).toEqual(['t1', 't2'])
    expect(top.count).toBeGreaterThanOrEqual(2)
  })
  it('boosts edges based on user views', () => {
    const p = computePatterns(seed, { saves: {}, follows: {}, views: { c1: { count: 5, lastAt: '2025-01-01' } } })
    const co = p.coOccurrence.find((x) => [x.a, x.b].sort().join(',') === 't1,t2')
    expect(co.boost).toBeGreaterThan(0)
  })
  it('topicAffinity reflects follows + views on related content', () => {
    const p = computePatterns(seed, {
      saves: { c1: { savedAt: 'x' } },
      follows: { t1: { followedAt: 'x' } },
      views: { c1: { count: 3, lastAt: 'x' } },
    })
    expect(p.topicAffinity.t1).toBeGreaterThan(p.topicAffinity.t3 || 0)
  })
})
```

- [ ] **Step 2: Run — should fail**

- [ ] **Step 3: Implement**

```js
export function computePatterns(seed, signals) {
  const { content = [] } = seed
  const { saves = {}, follows = {}, views = {} } = signals || {}

  const pairCounts = new Map()
  const topicCounts = new Map()
  for (const c of content) {
    const ids = c.topicIds || []
    for (const id of ids) topicCounts.set(id, (topicCounts.get(id) || 0) + 1)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]].sort()
        const key = `${a}|${b}`
        const v = pairCounts.get(key) || { a, b, count: 0, evidence: [], boost: 0 }
        v.count += 1
        v.evidence.push(c.id)
        const viewBoost = (views[c.id]?.count ?? 0) * 0.05
        const saveBoost = saves[c.id] ? 0.1 : 0
        v.boost += viewBoost + saveBoost
        pairCounts.set(key, v)
      }
    }
  }

  const coOccurrence = [...pairCounts.values()].sort((x, y) => (y.count + y.boost) - (x.count + x.boost))

  const topicAffinity = {}
  for (const [tid, baseCount] of topicCounts.entries()) {
    let score = baseCount * 0.1
    if (follows[tid]) score += 1.0
    for (const c of content) {
      if (!c.topicIds?.includes(tid)) continue
      if (saves[c.id])  score += 0.3
      const v = views[c.id]?.count ?? 0
      score += Math.min(0.5, v * 0.1)
    }
    topicAffinity[tid] = score
  }

  return { coOccurrence, topicAffinity }
}
```

- [ ] **Step 4: Run — should pass**

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph/pattern.js src/lib/graph/pattern.test.js
git commit -m "feat(graph): add pattern engine (co-occurrence + topic affinity)"
```

---

## Task 5: Build `useGraph` and `useLearning` hooks

**Files:**
- Create: `src/store/useGraph.js`
- Create: `src/store/useLearning.js`
- Create: `src/store/useGraph.test.js`
- Create: `src/store/useLearning.test.js`

- [ ] **Step 1: Implement `useGraph.js`**

```js
import { useMemo } from 'react'
import { useSeed } from './useSeed.js'
import { buildGraph } from '../lib/graph/buildGraph.js'
import { generatePositions } from '../lib/graph/nodePositions.js'

export function useGraph() {
  const seed = useSeed()
  return useMemo(() => {
    const { nodes, edges } = buildGraph(seed)
    const positioned = generatePositions(nodes)
    return { nodes: positioned, edges }
  }, [seed])
}
```

- [ ] **Step 2: Implement `useLearning.js`**

```js
import { useMemo } from 'react'
import { useSeed } from './useSeed.js'
import { useStore } from './useStore.js'
import { computePatterns } from '../lib/graph/pattern.js'

export function useLearning() {
  const seed = useSeed()
  const { saves, follows, views } = useStore()

  return useMemo(
    () => computePatterns(seed, { saves, follows, views }),
    [seed, saves, follows, views]
  )
}
```

- [ ] **Step 3: Smoke tests**

`src/store/useGraph.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGraph } from './useGraph.js'

describe('useGraph', () => {
  it('returns nodes with positions and edges', () => {
    const { result } = renderHook(() => useGraph())
    expect(result.current.nodes.length).toBeGreaterThan(10)
    expect(result.current.nodes[0].bx).toBeDefined()
    expect(result.current.edges.length).toBeGreaterThan(0)
  })
})
```

`src/store/useLearning.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLearning } from './useLearning.js'

describe('useLearning', () => {
  beforeEach(() => localStorage.clear())

  it('returns coOccurrence and topicAffinity', () => {
    const { result } = renderHook(() => useLearning())
    expect(Array.isArray(result.current.coOccurrence)).toBe(true)
    expect(typeof result.current.topicAffinity).toBe('object')
  })
})
```

- [ ] **Step 4: Run — should pass**

```bash
npm run test:run
```

Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/store/useGraph.js src/store/useGraph.test.js src/store/useLearning.js src/store/useLearning.test.js
git commit -m "feat(store): add useGraph + useLearning hooks"
```

---

## Task 6: Build `FlowGraph.jsx` canvas renderer

> **Implementer note:** This is the largest single component in the project (~600 lines). It implements the spec's §8 renderer with:
> - 3D perspective projection
> - drag-rotate (Y + X axes), shift+drag pan, scroll-zoom
> - auto-rotate after idle
> - vertical node float (sin wave per node phase)
> - signal particles spawned periodically + on activeNodeIds change
> - bounce physics (spring + damping)
> - depth-of-field blur
> - selection dimming (non-neighbors muted)
> - hover tooltip drawn on canvas
> - 4-phase fullscreen animation
>
> All math/state lives in refs to keep the single `useEffect([])` from re-running. Props are read via refs that update on every render.

**Files:**
- Create: `src/components/flow/FlowGraph.jsx`

- [ ] **Step 1: Implement** (paste exactly)

```jsx
import { useEffect, useRef } from 'react'
import { RGB, getTypeMeta } from '../../lib/graph/nodeTaxonomy.js'

const MUTED = [80, 84, 96]
const CAM_D = 5
const SPRING_K = 80
const DAMP = 7

export default function FlowGraph({
  className = '',
  nodes,
  edges,
  activeNodeIds = [],
  selectedNodeId = null,
  onNodeClick,
  onNodeHover,
}) {
  const canvasRef = useRef(null)
  const propsRef = useRef({ nodes, edges, activeNodeIds, selectedNodeId, onNodeClick, onNodeHover })

  useEffect(() => {
    propsRef.current = { nodes, edges, activeNodeIds, selectedNodeId, onNodeClick, onNodeHover }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let dpr = window.devicePixelRatio || 1
    let W = 0, H = 0
    function resize() {
      const r = canvas.getBoundingClientRect()
      W = r.width; H = r.height
      canvas.width = Math.floor(W * dpr)
      canvas.height = Math.floor(H * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let rotY = 0, rotX = 0
    let rotYVel = 0, rotXVel = 0
    let panX = 0, panY = 0
    let zoom = 1
    let dragging = false, dragStart = null, dragMode = null, didDrag = false
    let hoverId = null
    let lastInteract = performance.now()

    const bounce = new Map()  // id -> { amp, vel }
    const sigs = []           // active signal particles
    let lastSigSpawn = 0
    let focalZ = 0

    function project(x, y, z) {
      const cx = (W / 2) * dpr
      const cy = (H / 2) * dpr
      const unit = Math.min(W, H) * 0.195 * dpr * zoom
      const persp = (CAM_D * unit) / (CAM_D + z)
      return {
        sx: cx + x * persp + panX * dpr,
        sy: cy + y * persp + panY * dpr,
        depth: z,
        persp,
        unit,
      }
    }

    function rotate3D(bx, by, bz, t) {
      const yWobble = Math.sin(t * 0.55 + (bx + bz) * 0.5) * 0.055
      const x0 = bx, y0 = by + yWobble, z0 = bz
      const cy = Math.cos(rotY), sy = Math.sin(rotY)
      const x1 = x0 * cy + z0 * sy
      const z1 = -x0 * sy + z0 * cy
      const cx = Math.cos(rotX), sx = Math.sin(rotX)
      const y2 = y0 * cx - z1 * sx
      const z2 = y0 * sx + z1 * cx
      return { x: x1, y: y2, z: z2 }
    }

    function neighborsOf(id) {
      const out = new Set()
      for (const e of propsRef.current.edges) {
        if (e.from === id) out.add(e.to)
        if (e.to === id) out.add(e.from)
      }
      return out
    }

    function hitTest(mx, my, projected) {
      let best = null, bestDist = 1e9
      for (let i = projected.length - 1; i >= 0; i--) {
        const p = projected[i]
        const dx = (mx * dpr) - p.sx
        const dy = (my * dpr) - p.sy
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < p.r + 4 * dpr && d < bestDist) { best = p; bestDist = d }
      }
      return best
    }

    function spawnSignal() {
      const { edges } = propsRef.current
      if (!edges.length) return
      const e = edges[Math.floor(Math.random() * edges.length)]
      const fromNode = propsRef.current.nodes.find((n) => n.id === e.from)
      if (!fromNode) return
      const rgb = RGB[fromNode.type] || MUTED
      sigs.push({
        id: Math.random(),
        fromId: e.from,
        toId: e.to,
        progress: 0,
        speed: 2.5 + Math.random(),
        rgb,
      })
    }

    function impactBounce(toId, fromId) {
      const t = bounce.get(toId) || { amp: 0, vel: 0 }
      t.vel += 5.0
      bounce.set(toId, t)
      const f = bounce.get(fromId) || { amp: 0, vel: 0 }
      f.vel += 0.4
      bounce.set(fromId, f)
    }

    let raf
    let lastT = performance.now()
    function frame(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000)
      lastT = now
      const t = now / 1000

      // Auto-rotate after 2.5s idle
      if (now - lastInteract > 2500 && !dragging) {
        rotY += dt * 0.07
      }
      // Apply momentum
      rotY += rotYVel * dt
      rotX += rotXVel * dt
      rotX = Math.max(-0.55, Math.min(0.55, rotX))
      rotYVel *= Math.exp(-3.5 * dt)
      rotXVel *= Math.exp(-3.5 * dt)

      // Spawn signals
      if (sigs.length < 18 && now - lastSigSpawn > 900) {
        spawnSignal()
        lastSigSpawn = now
      }

      // Project all nodes
      const { nodes: nodes_, edges: edges_, selectedNodeId: selId, activeNodeIds: actIds } = propsRef.current
      const actSet = new Set(actIds)
      const neighbors = selId ? neighborsOf(selId) : null

      const projected = nodes_.map((n) => {
        const r = rotate3D(n.bx, n.by, n.bz, t + (n.phase || 0))
        const p = project(r.x, r.y, r.z)
        const b = bounce.get(n.id) || { amp: 0, vel: 0 }
        b.vel += -SPRING_K * b.amp * dt
        b.vel *= Math.exp(-DAMP * dt)
        b.amp += b.vel * dt
        bounce.set(n.id, b)
        const baseR = 7.5 * dpr * Math.max(0.65, 1 + r.z * 0.13)
        const r_ = baseR * (1 + b.amp * 0.45)
        const sx = p.sx + (p.sx - (W / 2) * dpr) * b.amp * 0.12
        return { ...n, sx, sy: p.sy, depth: r.z, r: r_, projZ: r.z }
      }).sort((a, b) => a.depth - b.depth)

      // DOF target
      const hovered = projected.find((p) => p.id === hoverId)
      const targetFocal = hovered ? hovered.depth : Math.sin(t * 0.4) * 0.4
      focalZ += (targetFocal - focalZ) * 0.055

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Edges
      const projById = Object.fromEntries(projected.map((p) => [p.id, p]))
      for (const e of edges_) {
        const a = projById[e.from], b = projById[e.to]
        if (!a || !b) continue
        const dimA = selId && !(neighbors.has(a.id) || a.id === selId)
        const dimB = selId && !(neighbors.has(b.id) || b.id === selId)
        const muted = dimA || dimB
        const colorA = muted ? MUTED : (RGB[a.type] || MUTED)
        const alpha = (a.depth + b.depth) / 2
        ctx.strokeStyle = `rgba(${colorA[0]},${colorA[1]},${colorA[2]},${(muted ? 0.06 : 0.18) * Math.max(0.4, 1 + alpha * 0.2)})`
        ctx.lineWidth = (e.weight ?? 0.5) * 1.4 * dpr
        ctx.beginPath()
        ctx.moveTo(a.sx, a.sy)
        ctx.lineTo(b.sx, b.sy)
        ctx.stroke()
      }

      // Signals
      for (let i = sigs.length - 1; i >= 0; i--) {
        const s = sigs[i]
        const a = projById[s.fromId], b = projById[s.toId]
        if (!a || !b) { sigs.splice(i, 1); continue }
        s.progress += dt * s.speed * 0.25
        if (s.progress >= 0.92 && !s.bounced) {
          s.bounced = true
          impactBounce(s.toId, s.fromId)
        }
        if (s.progress >= 1) { sigs.splice(i, 1); continue }
        const x = a.sx + (b.sx - a.sx) * s.progress
        const y = a.sy + (b.sy - a.sy) * s.progress
        ctx.fillStyle = `rgba(${s.rgb[0]},${s.rgb[1]},${s.rgb[2]},0.95)`
        ctx.beginPath()
        ctx.arc(x, y, 2.2 * dpr, 0, Math.PI * 2)
        ctx.fill()
      }

      // Nodes
      for (const p of projected) {
        const dim = selId && !(neighbors.has(p.id) || p.id === selId)
        const rgb = dim ? MUTED : (RGB[p.type] || MUTED)
        const dof = Math.abs(p.depth - focalZ)
        const blurPx = Math.min(4.0, dof * 3.0) * dpr
        const dofAlpha = Math.max(0.28, 1 - dof * 0.38)
        const isActive = actSet.has(p.id)

        // Halo
        ctx.filter = `blur(${blurPx}px)`
        const haloR = p.r * (3 + dof * 0.75)
        const grad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, haloR)
        grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.5 * dofAlpha})`)
        grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`)
        ctx.fillStyle = grad
        ctx.beginPath(); ctx.arc(p.sx, p.sy, haloR, 0, Math.PI * 2); ctx.fill()

        // Core
        ctx.filter = 'none'
        const core = ctx.createRadialGradient(p.sx - p.r * 0.3, p.sy - p.r * 0.35, 0, p.sx, p.sy, p.r)
        core.addColorStop(0, `rgba(255,255,255,${dim ? 0.15 : 0.55})`)
        core.addColorStop(0.4, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${dofAlpha})`)
        core.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.7 * dofAlpha})`)
        ctx.fillStyle = core
        ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r, 0, Math.PI * 2); ctx.fill()

        // Selection ring
        if (p.id === selId) {
          ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.95)`
          ctx.lineWidth = 2 * dpr
          ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r + 5 * dpr, 0, Math.PI * 2); ctx.stroke()
          ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.5 + 0.4 * Math.sin(t * 4)})`
          ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r + 8 * dpr, 0, Math.PI * 2); ctx.stroke()
        } else if (p.id === hoverId) {
          ctx.strokeStyle = 'rgba(255,255,255,0.45)'
          ctx.lineWidth = 1 * dpr
          ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r + 3.5 * dpr, 0, Math.PI * 2); ctx.stroke()
        }

        // Active emerald pulse
        if (isActive) {
          ctx.strokeStyle = `rgba(16,185,129,${0.5 + 0.4 * Math.sin(t * 5)})`
          ctx.lineWidth = 2 * dpr
          ctx.beginPath(); ctx.arc(p.sx, p.sy, p.r + 6 * dpr, 0, Math.PI * 2); ctx.stroke()
        }

        // Label
        const fs = 9 * Math.max(0.65, 1 + p.depth * 0.13) * dpr
        ctx.fillStyle = dim ? `rgba(${MUTED[0]},${MUTED[1]},${MUTED[2]},0.55)` : `rgba(255,255,255,${0.55 * dofAlpha})`
        ctx.font = `500 ${fs}px Inter, system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(p.label, p.sx, p.sy + p.r + fs * 1.35)
      }

      // Tooltip
      if (hoverId && !selId) {
        const h = projected.find((p) => p.id === hoverId)
        if (h) {
          const meta = getTypeMeta(h.type)
          const w = 230 * dpr, padX = 10 * dpr, padY = 8 * dpr
          let tx = h.sx + h.r + 12 * dpr
          if (tx + w > canvas.width) tx = h.sx - w - h.r - 12 * dpr
          const ty = h.sy - 30 * dpr
          ctx.fillStyle = 'rgba(6,8,18,0.90)'
          ctx.strokeStyle = `rgba(${RGB[h.type]?.join(',') || MUTED.join(',')},0.55)`
          ctx.lineWidth = 1 * dpr
          ctx.beginPath()
          ctx.roundRect ? ctx.roundRect(tx, ty, w, 60 * dpr, 8 * dpr) : ctx.rect(tx, ty, w, 60 * dpr)
          ctx.fill(); ctx.stroke()
          ctx.fillStyle = meta.color
          ctx.font = `600 ${10 * dpr}px Inter`
          ctx.textAlign = 'left'
          ctx.fillText(meta.label.toUpperCase(), tx + padX, ty + padY + 8 * dpr)
          ctx.fillStyle = 'rgba(255,255,255,0.95)'
          ctx.font = `600 ${12 * dpr}px Inter`
          ctx.fillText(h.label, tx + padX, ty + padY + 24 * dpr)
        }
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // Mouse handlers
    function onDown(e) {
      dragging = true
      didDrag = false
      dragStart = { x: e.clientX, y: e.clientY, rotX, rotY, panX, panY }
      dragMode = e.shiftKey ? 'pan' : 'rotate'
      lastInteract = performance.now()
      canvas.style.cursor = 'grabbing'
    }
    function onMove(e) {
      lastInteract = performance.now()
      const r = canvas.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      if (dragging) {
        const dx = e.clientX - dragStart.x
        const dy = e.clientY - dragStart.y
        if (Math.abs(dx) + Math.abs(dy) > 2) didDrag = true
        if (dragMode === 'pan') {
          panX = dragStart.panX + dx
          panY = dragStart.panY + dy
        } else {
          rotY = dragStart.rotY + dx * 0.005
          rotX = Math.max(-0.55, Math.min(0.55, dragStart.rotX - dy * 0.005))
        }
      } else {
        const proj = []
        for (const n of propsRef.current.nodes) {
          const r3 = rotate3D(n.bx, n.by, n.bz, performance.now() / 1000)
          const p = project(r3.x, r3.y, r3.z)
          const baseR = 7.5 * dpr * Math.max(0.65, 1 + r3.z * 0.13)
          proj.push({ id: n.id, sx: p.sx, sy: p.sy, r: baseR })
        }
        const hit = hitTest(mx, my, proj)
        const newHover = hit?.id || null
        if (newHover !== hoverId) {
          hoverId = newHover
          propsRef.current.onNodeHover?.(newHover)
          canvas.style.cursor = newHover ? 'pointer' : (dragging ? 'grabbing' : 'grab')
        }
      }
    }
    function onUp(e) {
      if (dragging) {
        if (!didDrag) {
          // It was a click, not a drag
          const r = canvas.getBoundingClientRect()
          const mx = e.clientX - r.left
          const my = e.clientY - r.top
          const proj = []
          for (const n of propsRef.current.nodes) {
            const r3 = rotate3D(n.bx, n.by, n.bz, performance.now() / 1000)
            const p = project(r3.x, r3.y, r3.z)
            const baseR = 7.5 * dpr * Math.max(0.65, 1 + r3.z * 0.13)
            proj.push({ id: n.id, sx: p.sx, sy: p.sy, r: baseR })
          }
          const hit = hitTest(mx, my, proj)
          propsRef.current.onNodeClick?.(hit?.id || null)
        } else {
          // Apply momentum
          const dx = (e.clientX - dragStart.x) * 0.005
          const dy = (e.clientY - dragStart.y) * 0.005
          rotYVel = dx * 4
          rotXVel = -dy * 4
        }
      }
      dragging = false
      canvas.style.cursor = 'grab'
    }
    function onWheel(e) {
      e.preventDefault()
      lastInteract = performance.now()
      const factor = Math.exp(-e.deltaY * 0.001)
      zoom = Math.max(0.35, Math.min(3.0, zoom * factor))
    }

    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.style.cursor = 'grab'

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
```

- [ ] **Step 2: Verify the build succeeds**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/flow/FlowGraph.jsx
git commit -m "feat(flow): add FlowGraph 3D canvas renderer"
```

---

## Task 7: Build `PipelineStrip` component

**Files:**
- Create: `src/components/flow/PipelineStrip.jsx`

- [ ] **Step 1: Implement**

```jsx
import { Compass, Filter, Tags, Brain } from 'lucide-react'

const STAGES = [
  { icon: Compass, color: '#14b8a6', title: 'Discover',  sub: 'Sources · Searches · Triggers' },
  { icon: Filter,  color: '#f59e0b', title: 'Parse',     sub: 'Metadata · Transcripts · Entities' },
  { icon: Tags,    color: '#8b5cf6', title: 'Classify',  sub: 'Topics · Concepts · Relations' },
  { icon: Brain,   color: '#10b981', title: 'Retain',    sub: 'Memory · Patterns · Suggestions' },
]

export default function PipelineStrip({ counts = {} }) {
  return (
    <div className="glass-panel overflow-hidden">
      <div className="px-5 py-2.5 border-b border-[color:var(--color-border-subtle)] flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-tertiary)]">
          Topic Intelligence Pipeline
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-[color:var(--color-text-tertiary)]">4-stage loop · always running</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[color:var(--color-border-subtle)]">
        {STAGES.map((s, i) => {
          const Icon = s.icon
          const count = counts[s.title.toLowerCase()] ?? 0
          return (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color: s.color }} />
                <p className="text-[13px] font-semibold">{s.title}</p>
              </div>
              <p className="text-[11px] text-[color:var(--color-text-secondary)] leading-relaxed mb-2">
                {s.sub}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" style={{ boxShadow: '0 0 4px rgba(16,185,129,0.7)' }} />
                <span className="text-[11px] text-emerald-400 font-medium">{count} signals active</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/flow/PipelineStrip.jsx
git commit -m "feat(flow): add PipelineStrip"
```

---

## Task 8: Build `GlassSidebar` (Directory / Search / Detail modes)

**Files:**
- Create: `src/components/flow/GlassSidebar.jsx`

- [ ] **Step 1: Implement**

```jsx
import { useState } from 'react'
import { Search, ChevronRight } from 'lucide-react'
import { NODE_TYPES, getTypeMeta } from '../../lib/graph/nodeTaxonomy.js'

export default function GlassSidebar({
  nodes,
  edges,
  searchQuery,
  setSearchQuery,
  selectedNodeId,
  setSelectedNodeId,
}) {
  const [openGroups, setOpenGroups] = useState(new Set())

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null
  const filtered = searchQuery
    ? nodes.filter((n) => (n.label + ' ' + n.summary).toLowerCase().includes(searchQuery.toLowerCase()))
    : null

  const grouped = NODE_TYPES.map((t) => ({
    type: t,
    items: nodes.filter((n) => n.type === t.id),
  })).filter((g) => g.items.length)

  function toggleGroup(id) {
    setOpenGroups((cur) => {
      const next = new Set(cur)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Detail mode
  if (selectedNode) {
    const meta = getTypeMeta(selectedNode.type)
    const incoming = edges.filter((e) => e.to === selectedNode.id)
    const outgoing = edges.filter((e) => e.from === selectedNode.id)
    return (
      <aside
        className="w-[250px] flex flex-col rounded-2xl overflow-hidden absolute top-[48px] left-3 z-20 max-h-[544px]"
        style={{
          background: 'rgba(6,10,22,0.68)',
          backdropFilter: 'blur(22px) saturate(1.6)',
          border: '1px solid rgba(255,255,255,0.11)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <button onClick={() => setSelectedNodeId(null)} className="text-[10px] text-white/40 hover:text-white">close</button>
        </div>
        <div className="px-3 py-3 overflow-auto">
          <h3 className="text-sm font-semibold leading-tight text-white">{selectedNode.label}</h3>
          {selectedNode.summary ? (
            <p className="text-[11px] text-white/60 mt-2 leading-relaxed">{selectedNode.summary}</p>
          ) : null}

          {incoming.length ? (
            <div className="mt-4">
              <h4 className="text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Receives from ({incoming.length})</h4>
              <div className="flex flex-wrap gap-1">
                {incoming.slice(0, 8).map((e) => {
                  const src = nodes.find((n) => n.id === e.from)
                  if (!src) return null
                  return <button key={e.from} onClick={() => setSelectedNodeId(e.from)} className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/70 hover:bg-white/10">{src.label}</button>
                })}
              </div>
            </div>
          ) : null}

          {outgoing.length ? (
            <div className="mt-4">
              <h4 className="text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Sends to ({outgoing.length})</h4>
              <div className="flex flex-wrap gap-1">
                {outgoing.slice(0, 8).map((e) => {
                  const dst = nodes.find((n) => n.id === e.to)
                  if (!dst) return null
                  return <button key={e.to} onClick={() => setSelectedNodeId(e.to)} className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-white/70 hover:bg-white/10">{dst.label}</button>
                })}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    )
  }

  return (
    <aside
      className="w-[250px] flex flex-col rounded-2xl overflow-hidden absolute top-[48px] left-3 z-20 max-h-[544px]"
      style={{
        background: 'rgba(6,10,22,0.68)',
        backdropFilter: 'blur(22px) saturate(1.6)',
        border: '1px solid rgba(255,255,255,0.11)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <div className="px-3 py-2 border-b border-white/5 relative">
        <Search size={12} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search nodes…"
          className="w-full bg-white/5 border border-white/10 rounded-md pl-7 pr-2 py-1.5 text-[11px] text-white placeholder:text-white/30 outline-none focus:border-white/25"
        />
      </div>

      <div className="overflow-auto flex-1 p-2">
        {filtered ? (
          filtered.length === 0 ? (
            <p className="text-[10px] text-white/40 px-2 py-4 text-center">No matches.</p>
          ) : (
            <div className="space-y-0.5">
              {filtered.slice(0, 30).map((n) => {
                const meta = getTypeMeta(n.type)
                return (
                  <button
                    key={n.id}
                    onClick={() => { setSelectedNodeId(n.id); setSearchQuery('') }}
                    className="w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                    <span className="text-[11px] text-white/80 truncate">{n.label}</span>
                  </button>
                )
              })}
            </div>
          )
        ) : (
          <div className="space-y-1">
            {grouped.map(({ type, items }) => {
              const open = openGroups.has(type.id)
              return (
                <div key={type.id}>
                  <button
                    onClick={() => toggleGroup(type.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: type.color }} />
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-white/70 flex-1 text-left">{type.label}</span>
                    <span className="text-[10px] text-white/40">{items.length}</span>
                    <ChevronRight size={12} className={`text-white/30 transition-transform ${open ? 'rotate-90' : ''}`} />
                  </button>
                  {open ? (
                    <div className="ml-3 pl-2 border-l border-white/5 space-y-0.5 my-1">
                      {items.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => setSelectedNodeId(n.id)}
                          className="w-full text-left text-[11px] text-white/70 hover:text-white px-2 py-1 rounded hover:bg-white/5 truncate"
                        >
                          {n.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!filtered ? (
        <div className="px-3 py-2 border-t border-white/5 text-[10px] text-white/35 leading-snug">
          Click a category to expand, then select a node — or click directly on the canvas.
        </div>
      ) : null}
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/flow/GlassSidebar.jsx
git commit -m "feat(flow): add GlassSidebar with directory/search/detail modes"
```

---

## Task 9: Build KpiRow, ConnectedSources, DerivedSignals

**Files:**
- Create: `src/components/flow/KpiRow.jsx`
- Create: `src/components/flow/ConnectedSources.jsx`
- Create: `src/components/flow/DerivedSignals.jsx`

- [ ] **Step 1: `KpiRow.jsx`**

```jsx
export default function KpiRow({ items }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => it.onClick?.()}
          disabled={!it.onClick}
          className={`glass-panel px-4 py-3.5 text-left ${it.onClick ? 'hover:brightness-125 transition-all' : ''}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-[color:var(--color-text-tertiary)]">{it.label}</span>
            {it.live ? <span className="text-[9px] uppercase tracking-wide text-emerald-400 font-medium">live</span> : null}
          </div>
          <div className="text-[22px] font-bold tracking-tight">{it.value}</div>
          {it.sub ? <p className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">{it.sub}</p> : null}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: `ConnectedSources.jsx`**

```jsx
const SOURCES = [
  { id: 'youtube', label: 'YouTube',         status: 'connected',  desc: 'Curated seed feed' },
  { id: 'rss',     label: 'RSS readers',     status: 'planned',    desc: 'Anthropic, OpenAI, Simon Willison' },
  { id: 'hn',      label: 'Hacker News',     status: 'planned',    desc: 'AI/agent topical filter' },
]

export default function ConnectedSources() {
  return (
    <div className="glass-panel p-5">
      <h2 className="text-[13px] font-semibold mb-3">Connected sources</h2>
      <ul className="space-y-2">
        {SOURCES.map((s) => (
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

- [ ] **Step 3: `DerivedSignals.jsx`**

```jsx
import Pill from '../ui/Pill.jsx'

export default function DerivedSignals({ patterns }) {
  const top = patterns?.coOccurrence?.[0]
  const topAffinity = Object.entries(patterns?.topicAffinity || {}).sort((a, b) => b[1] - a[1])[0]

  const rows = [
    { label: 'Strongest co-occurrence', value: top ? `${top.a.replace('topic_', '')} + ${top.b.replace('topic_', '')}` : '—', tone: 'positive' },
    { label: 'Top topic affinity',      value: topAffinity ? topAffinity[0].replace('topic_', '') : '—',                       tone: 'accent' },
    { label: 'Recently reinforced',     value: 'computing',                                                                    tone: 'warning' },
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

- [ ] **Step 4: Commit (all three in one commit)**

```bash
git add src/components/flow/KpiRow.jsx src/components/flow/ConnectedSources.jsx src/components/flow/DerivedSignals.jsx
git commit -m "feat(flow): add KpiRow, ConnectedSources, DerivedSignals"
```

---

## Task 10: Build `InterestMemoryPanel.jsx` (Flow Map version of memory grid)

**Files:**
- Create: `src/components/flow/InterestMemoryPanel.jsx`

- [ ] **Step 1: Implement** (reuses Plan 2's `MemoryEntryCard` + `MemoryAddForm`)

```jsx
import { useState } from 'react'
import { Database, Plus } from 'lucide-react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'
import MemoryEntryCard from '../memory/MemoryEntryCard.jsx'
import MemoryAddForm from '../memory/MemoryAddForm.jsx'

const FILTERS = [
  { id: 'all',            label: 'All' },
  { id: 'topic_rule',     label: 'Topic Rules' },
  { id: 'source_pref',    label: 'Source Prefs' },
  { id: 'research_focus', label: 'Research Focus' },
  { id: 'personal_stack', label: 'Personal Stack' },
]

export default function InterestMemoryPanel() {
  const { seedMemory } = useSeed()
  const { memoryEntries, addMemory, deleteMemory } = useStore()
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)

  const all = [...seedMemory, ...Object.values(memoryEntries)]
  const filtered = filter === 'all' ? all : all.filter((m) => m.category === filter)

  return (
    <div className="glass-panel overflow-hidden">
      <div className="px-5 py-3 border-b border-[color:var(--color-border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-[color:var(--color-memory)]" />
          <h2 className="text-[13px] font-semibold">Interest Memory</h2>
          <span className="text-[10px] text-[color:var(--color-text-tertiary)] ml-2">
            Baseline facts and rules that shape what surfaces here.
          </span>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="btn btn-primary text-xs">
          <Plus size={12} /> Add memory
        </button>
      </div>

      <div className="px-5 py-2 border-b border-[color:var(--color-border-subtle)] flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-[color:var(--color-memory)]/15 text-[color:var(--color-memory)] border border-[color:var(--color-memory)]/40'
                : 'text-[color:var(--color-text-secondary)] hover:bg-white/5 border border-transparent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {showAdd ? <MemoryAddForm onSubmit={(d) => { addMemory(d); setShowAdd(false) }} onCancel={() => setShowAdd(false)} /> : null}
        {filtered.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-tertiary)] py-8 text-center">No entries in this category.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((entry) => (
              <MemoryEntryCard
                key={entry.id}
                entry={entry}
                onDelete={(id) => { if (!id.startsWith('mem_seed_')) deleteMemory(id) }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/flow/InterestMemoryPanel.jsx
git commit -m "feat(flow): add InterestMemoryPanel for Flow Map page"
```

---

## Task 11: Build `FlowMap.jsx` view (the integrator)

**Files:**
- Modify: `src/views/FlowMap.jsx`

- [ ] **Step 1: Implement**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FlowGraph from '../components/flow/FlowGraph.jsx'
import PipelineStrip from '../components/flow/PipelineStrip.jsx'
import GlassSidebar from '../components/flow/GlassSidebar.jsx'
import KpiRow from '../components/flow/KpiRow.jsx'
import ConnectedSources from '../components/flow/ConnectedSources.jsx'
import DerivedSignals from '../components/flow/DerivedSignals.jsx'
import InterestMemoryPanel from '../components/flow/InterestMemoryPanel.jsx'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'
import { useGraph } from '../store/useGraph.js'
import { useLearning } from '../store/useLearning.js'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'

export default function FlowMap() {
  const navigate = useNavigate()
  const { nodes, edges } = useGraph()
  const patterns = useLearning()
  const { topics, content, contentById } = useSeed()
  const { saves, follows } = useStore()

  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  function onNodeClick(id) {
    if (!id) { setSelectedNodeId(null); return }
    const node = nodes.find((n) => n.id === id)
    if (!node) return
    if (node.type === 'video') {
      setOpenVideo(contentById(id))
      return
    }
    if (node.type === 'article') {
      setOpenArticle(contentById(id))
      return
    }
    if (node.type === 'topic') {
      navigate(`/topic/${id.replace('topic_', '')}`)
      return
    }
    setSelectedNodeId(id)
  }

  const followedCount = Object.keys(follows).length
  const savedCount = Object.keys(saves).length
  const videos   = content.filter((c) => c.type === 'video').length
  const articles = content.filter((c) => c.type === 'article').length
  const posts    = content.filter((c) => c.type === 'social_post').length

  const kpis = [
    { label: 'Followed topics', value: followedCount, sub: `of ${topics.length}` },
    { label: 'Items this week', value: content.length, sub: 'in the seed' },
    { label: 'Saved items',     value: savedCount, live: savedCount > 0 },
    { label: 'Sources tracked', value: 1, sub: 'YouTube · v1.1 expands' },
    { label: 'Videos',          value: videos },
    { label: 'Articles',        value: articles },
    { label: 'Posts',           value: posts },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flow Map</h1>
          <p className="text-sm text-[color:var(--color-text-secondary)] mt-1 max-w-2xl">
            The relational context network for your topic intelligence — typed, weighted, and learning from what you save and view.
          </p>
        </div>
        <span className="chip border-[color:var(--color-creator)]/40 bg-[color:var(--color-creator)]/10 text-[color:var(--color-creator)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-creator)] animate-pulse" />
          Live · seed
        </span>
      </header>

      {/* Pipeline */}
      <PipelineStrip counts={{ discover: 1, parse: content.length, classify: edges.length, retain: savedCount }} />

      {/* Network */}
      <div className="relative">
        <GlassSidebar
          nodes={nodes}
          edges={edges}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedNodeId={selectedNodeId}
          setSelectedNodeId={setSelectedNodeId}
        />
        <div
          className="flex flex-col overflow-hidden rounded-2xl border"
          style={{
            background: '#05070f',
            borderColor: 'rgba(255,255,255,0.07)',
            height: 640,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}
        >
          <div className="px-6 h-12 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <h2 className="text-[13px] font-semibold text-white/70 tracking-wide">Network</h2>
            <span className="text-[10px] text-white/30">Drag to rotate · Shift+drag to pan · Click a node to inspect</span>
          </div>
          <div className="flex-1 min-h-0">
            <FlowGraph
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              onNodeClick={onNodeClick}
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <KpiRow items={kpis} />

      {/* Sources + signals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConnectedSources />
        <DerivedSignals patterns={patterns} />
      </div>

      {/* Interest Memory */}
      <InterestMemoryPanel />

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/views/FlowMap.jsx
git commit -m "feat(view): build Flow Map page integrator"
```

---

## Task 12: Final smoke test

**Files:** *(no changes)*

- [ ] **Step 1: Run all tests**

```bash
npm run test:run
```

Expected: ~50 tests pass (Plans 1–2's ~40 + Plan 3's ~10).

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Visit `/flow` in dev server**

- 3D graph renders, nodes are colored, auto-rotating after idle.
- Drag-rotate works. Shift+drag pans. Scroll zooms.
- Hover a node → cursor changes to pointer, tooltip appears.
- Click a topic node → navigates to `/topic/:slug`.
- Click a video node → modal opens.
- Click an article node → drawer opens.
- Type in glass sidebar search → filters nodes.
- Open a category in sidebar → expanded list.
- Click any sidebar node → detail mode opens, "Receives from"/"Sends to" chips show.
- KPI row populates with real counts.
- Memory panel renders 8+ entries; add a new one; reload — persisted.

- [ ] **Step 4: Final commit**

```bash
git commit --allow-empty -m "chore: complete Plan 3 — Flow Map cinematic centerpiece"
```

---

# Done

After this plan:
- Cinematic Flow Map page with full visual fidelity to the Flowerk reference (adapted to dark glassmorphic chrome).
- Interactive 3D canvas graph: drag/rotate, signals, bounce, DOF, hover, click, selection dimming.
- Pattern engine: co-occurrence, topic affinity, derived signals, all driven by the user's behavioral signals.
- Glass sidebar with directory/search/detail modes.
- Pipeline strip + KPI row + sources/signals cards + Interest Memory panel.
- All node clicks dispatch to the right surface — videos play in the modal, articles open the drawer, topics navigate to their page.

**Next plan:** Plan 4 — Education + Polish.
