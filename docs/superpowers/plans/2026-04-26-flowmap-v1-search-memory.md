# FlowMap v1 — Plan 2: Search & Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the global search system (Home hero + cmd-K modal + dedicated results page) and the Memory section (saved items, followed topics, Interest Memory entries with CRUD, source preferences placeholder) — turning Plan 1's behavioral signals into surfaces the operator actually browses.

**Architecture:** Search runs entirely against the in-memory seed using the existing `filterContent` and a new `searchEntities` helper. Memory entries live in `useStore` under a new `memoryEntries` map, fully CRUD'd. cmd-K mounts in `App.jsx` as a global keyboard listener that opens a portal-rendered modal.

**Tech Stack:** Same as Plan 1 — Vite + React 19 + Tailwind v4 + react-router-dom v7 + lucide-react + vitest + RTL.

**Spec reference:** [docs/superpowers/specs/2026-04-26-flowmap-v1-design.md](../specs/2026-04-26-flowmap-v1-design.md) §7.3, §7.6.
**Plan 1 reference:** [docs/superpowers/plans/2026-04-26-flowmap-v1-foundation.md](2026-04-26-flowmap-v1-foundation.md). This plan assumes Plan 1 is complete (25 commits, 30 tests).

**Plan covers:** Phase 3 (Home/Search) + Phase 4 (Memory).

---

## File Structure

### Files created in this plan

```
src/
├── data/
│   └── seed-memory.json                          (8 pre-populated Interest Memory entries)
├── lib/
│   ├── searchEntities.js                         (cross-type entity search)
│   └── searchEntities.test.js
├── components/
│   ├── search/
│   │   ├── CmdKModal.jsx                         (global cmd+K palette)
│   │   ├── SearchResultRow.jsx
│   │   └── useCmdK.js                            (custom hook: keybinding + state)
│   └── memory/
│       ├── MemoryEntryCard.jsx
│       ├── MemoryAddForm.jsx
│       └── SavedItemsGrid.jsx
└── views/
    ├── Search.jsx                                (NEW — /search?q=…)
    └── (rewrite) Home.jsx, Memory.jsx
```

### Files modified

- `src/store/useStore.js` — add `memoryEntries` map + `addMemory`, `updateMemory`, `deleteMemory` actions; add `recentSearches` selector. Update tests.
- `src/App.jsx` — mount global `<CmdKModal>` portal + add `/search` route.

---

# Phase 3 — Home / Search

## Task 1: Extend `useStore` with memoryEntries CRUD + recentSearches selector

**Files:**
- Modify: `src/store/useStore.js`
- Modify: `src/store/useStore.test.js`

- [ ] **Step 1: Append failing tests to `useStore.test.js`**

```js
describe('memoryEntries CRUD', () => {
  beforeEach(() => localStorage.clear())

  it('addMemory creates an entry with auto id and addedAt', () => {
    const { result } = renderHook(() => useStore())
    let id
    act(() => { id = result.current.addMemory({ category: 'topic_rule', content: 'Always include MCP-related videos when surfacing Claude content.' }) })
    expect(id).toMatch(/^mem_/)
    const e = result.current.memoryEntries[id]
    expect(e.content).toContain('MCP')
    expect(e.confidence).toBe(1.0)
    expect(e.status).toBe('active')
    expect(e.addedAt).toBeTruthy()
  })

  it('updateMemory patches fields', () => {
    const { result } = renderHook(() => useStore())
    let id
    act(() => { id = result.current.addMemory({ category: 'topic_rule', content: 'X' }) })
    act(() => { result.current.updateMemory(id, { content: 'Y', status: 'validated' }) })
    expect(result.current.memoryEntries[id].content).toBe('Y')
    expect(result.current.memoryEntries[id].status).toBe('validated')
  })

  it('deleteMemory removes an entry', () => {
    const { result } = renderHook(() => useStore())
    let id
    act(() => { id = result.current.addMemory({ category: 'topic_rule', content: 'X' }) })
    act(() => { result.current.deleteMemory(id) })
    expect(result.current.memoryEntries[id]).toBeUndefined()
  })
})

describe('recentSearches selector', () => {
  beforeEach(() => localStorage.clear())

  it('returns top N searches sorted by lastAt desc', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.recordSearch('claude'))
    act(() => result.current.recordSearch('mcp'))
    act(() => result.current.recordSearch('agents'))
    const recent = result.current.recentSearches(2)
    expect(recent).toHaveLength(2)
    expect(recent[0].query).toBe('agents')
    expect(recent[1].query).toBe('mcp')
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
npm run test:run -- src/store/useStore.test.js
```

Expected: 4 new tests fail with "addMemory is not a function" / "recentSearches is not a function".

- [ ] **Step 3: Modify `useStore.js`**

Find `const EMPTY` and add `memoryEntries: {}`:

```js
const EMPTY = {
  saves: {},
  follows: {},
  dismisses: {},
  collections: {},
  views: {},
  searches: {},
  memoryEntries: {},
}
```

Inside `useStore()` (after `recordSearch`), add:

```js
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
      .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''))
      .slice(0, n)
  }, [state])
```

Add them to the returned object alongside the existing actions/selectors:

```js
  return {
    ...state,
    toggleSave, toggleFollow, dismiss,
    recordView, recordSearch,
    addMemory, updateMemory, deleteMemory,
    isSaved, isFollowing, isDismissed, viewCount, recentSearches,
  }
```

- [ ] **Step 4: Run — should pass**

```bash
npm run test:run -- src/store/useStore.test.js
```

Expected: 13 tests pass (9 original + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/store/useStore.js src/store/useStore.test.js
git commit -m "feat(store): add memoryEntries CRUD + recentSearches selector"
```

---

## Task 2: Build `searchEntities.js` (cross-type search, TDD)

**Files:**
- Create: `src/lib/searchEntities.js`
- Create: `src/lib/searchEntities.test.js`

- [ ] **Step 1: Write the failing tests**

`src/lib/searchEntities.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { searchEntities } from './searchEntities.js'

const seed = {
  topics:    [{ id: 'topic_claude',     slug: 'claude',     name: 'Claude',         summary: 'Anthropic AI',           __kind: 'topic'   }],
  tools:     [{ id: 'tool_claude_code', slug: 'claude-code', name: 'Claude Code',    summary: 'CLI agent',              __kind: 'tool'    }],
  creators:  [{ id: 'creator_simon_w',  slug: 'simon-willison', name: 'Simon Willison', summary: 'LLM blog',           __kind: 'creator' }],
  companies: [{ id: 'company_anthropic', slug: 'anthropic', name: 'Anthropic',       summary: 'Maker of Claude',        __kind: 'company' }],
  concepts:  [{ id: 'concept_tool_use', slug: 'tool-use',   name: 'Tool Use',        summary: 'Function calling',       __kind: 'concept' }],
  content:   [{ id: 'vid_001',          title: 'Building agents with Claude', summary: 'agent patterns',  type: 'video' }],
}

describe('searchEntities', () => {
  it('returns empty for empty query', () => {
    expect(searchEntities('', seed)).toEqual({ topics: [], tools: [], creators: [], companies: [], concepts: [], content: [] })
  })
  it('matches topics by name', () => {
    const r = searchEntities('claude', seed)
    expect(r.topics.length).toBe(1)
  })
  it('matches across multiple types', () => {
    const r = searchEntities('claude', seed)
    expect(r.topics.length).toBe(1)
    expect(r.tools.length).toBe(1)
    expect(r.companies.length).toBe(1)
    expect(r.content.length).toBe(1)
  })
  it('matches creators by name (case-insensitive)', () => {
    const r = searchEntities('SIMON', seed)
    expect(r.creators.length).toBe(1)
  })
  it('matches concepts by summary', () => {
    const r = searchEntities('function calling', seed)
    expect(r.concepts.length).toBe(1)
  })
  it('matches content by title or summary', () => {
    const r = searchEntities('agent', seed)
    expect(r.content.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
npm run test:run -- src/lib/searchEntities.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/searchEntities.js`:

```js
function matches(entity, q) {
  const haystack = [entity.name, entity.title, entity.summary, entity.slug]
    .filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q)
}

export function searchEntities(query, seed) {
  const empty = { topics: [], tools: [], creators: [], companies: [], concepts: [], content: [] }
  if (!query || !query.trim()) return empty
  const q = query.trim().toLowerCase()
  return {
    topics:    seed.topics.filter((x) => matches(x, q)),
    tools:     seed.tools.filter((x) => matches(x, q)),
    creators:  seed.creators.filter((x) => matches(x, q)),
    companies: seed.companies.filter((x) => matches(x, q)),
    concepts:  seed.concepts.filter((x) => matches(x, q)),
    content:   seed.content.filter((x) => matches(x, q)),
  }
}
```

- [ ] **Step 4: Run — should pass**

```bash
npm run test:run -- src/lib/searchEntities.test.js
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/searchEntities.js src/lib/searchEntities.test.js
git commit -m "feat(lib): add cross-type entity search"
```

---

## Task 3: Seed `seed-memory.json` (8 pre-populated Interest Memory entries)

**Files:**
- Create: `src/data/seed-memory.json`

- [ ] **Step 1: Write the seed**

```json
[
  { "id": "mem_seed_001", "category": "topic_rule",     "content": "Always include MCP-related videos when surfacing Claude content — they almost always belong together.",                  "confidence": 1.0, "status": "validated", "addedAt": "2026-04-15", "source": "manual" },
  { "id": "mem_seed_002", "category": "topic_rule",     "content": "When a topic mentions agents, also pull in tool-use and evals — those are the foundational concepts.",                       "confidence": 1.0, "status": "active",    "addedAt": "2026-04-16", "source": "manual" },
  { "id": "mem_seed_003", "category": "source_pref",    "content": "Prefer Anthropic Engineering and modelcontextprotocol.io over generic news roundups for protocol-level details.",            "confidence": 0.95,"status": "validated", "addedAt": "2026-04-12", "source": "manual" },
  { "id": "mem_seed_004", "category": "source_pref",    "content": "Simon Willison's blog is high-signal for practical LLM observations — keep it weighted high.",                              "confidence": 0.90,"status": "active",    "addedAt": "2026-04-13", "source": "manual" },
  { "id": "mem_seed_005", "category": "research_focus", "content": "Current focus: the agent loop pattern, eval design, and MCP server authoring — building toward a personal toolkit.",         "confidence": 1.0, "status": "active",    "addedAt": "2026-04-20", "source": "manual" },
  { "id": "mem_seed_006", "category": "research_focus", "content": "Track how Claude Code is being adopted in real codebases — case studies > announcements.",                                  "confidence": 0.85,"status": "active",    "addedAt": "2026-04-22", "source": "manual" },
  { "id": "mem_seed_007", "category": "personal_stack", "content": "Vibecoding stack: Claude Code + Vite + Tailwind + Supabase. Look for content that builds on this combo specifically.",       "confidence": 1.0, "status": "active",    "addedAt": "2026-04-10", "source": "manual" },
  { "id": "mem_seed_008", "category": "personal_stack", "content": "Avoid React Native / Swift mobile content unless it intersects directly with AI agents or Claude.",                          "confidence": 0.80,"status": "learning",  "addedAt": "2026-04-08", "source": "manual" }
]
```

- [ ] **Step 2: Verify**

```bash
node -e "console.log(require('./src/data/seed-memory.json').length)"
```

Expected: `8`.

- [ ] **Step 3: Commit**

```bash
git add src/data/seed-memory.json
git commit -m "data: seed 8 Interest Memory entries"
```

---

## Task 4: Build `useCmdK` hook (global keyboard listener)

**Files:**
- Create: `src/components/search/useCmdK.js`

- [ ] **Step 1: Implement**

```js
import { useEffect, useState } from 'react'

export function useCmdK() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handler(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return [open, setOpen]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/useCmdK.js
git commit -m "feat(search): add useCmdK keyboard hook"
```

---

## Task 5: Build `SearchResultRow` component

**Files:**
- Create: `src/components/search/SearchResultRow.jsx`

- [ ] **Step 1: Implement**

```jsx
import { Link } from 'react-router-dom'

const KIND_LABELS = {
  topic: { label: 'Topic',   color: '#f97316' },
  tool:    { label: 'Tool',    color: '#06b6d4' },
  creator: { label: 'Creator', color: '#14b8a6' },
  company: { label: 'Company', color: '#3b82f6' },
  concept: { label: 'Concept', color: '#94a3b8' },
  content: { label: 'Content', color: '#f59e0b' },
}

function hrefFor(kind, item) {
  if (kind === 'topic') return `/topic/${item.slug}`
  if (kind === 'content') return null
  return null
}

export default function SearchResultRow({ kind, item, onSelect }) {
  const meta = KIND_LABELS[kind]
  const href = hrefFor(kind, item)

  const inner = (
    <div className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
      <span
        className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}aa` }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-sm font-medium truncate">{item.name || item.title}</span>
        </div>
        {item.summary ? (
          <p className="text-xs text-[color:var(--color-text-tertiary)] line-clamp-1 mt-0.5">{item.summary}</p>
        ) : null}
      </div>
    </div>
  )

  if (href) return <Link to={href} onClick={onSelect}>{inner}</Link>
  return <button onClick={() => onSelect?.(kind, item)} className="block w-full text-left">{inner}</button>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/SearchResultRow.jsx
git commit -m "feat(search): add SearchResultRow"
```

---

## Task 6: Build `CmdKModal` (global search palette)

**Files:**
- Create: `src/components/search/CmdKModal.jsx`

- [ ] **Step 1: Implement**

```jsx
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'
import { searchEntities } from '../../lib/searchEntities.js'
import SearchResultRow from './SearchResultRow.jsx'

export default function CmdKModal({ open, onClose }) {
  const navigate = useNavigate()
  const seed = useSeed()
  const { recordSearch } = useStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  if (!open) return null

  const results = searchEntities(query, seed)
  const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)

  function selectAndClose() {
    if (query.trim()) recordSearch(query.trim())
    onClose()
  }

  function onSubmit(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    recordSearch(q)
    onClose()
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[15vh] p-6">
      <div onClick={(e) => e.stopPropagation()} className="glass-panel w-full max-w-[640px] flex flex-col overflow-hidden">
        <form onSubmit={onSubmit} className="flex items-center gap-3 px-4 py-3 border-b border-[color:var(--color-border-subtle)]">
          <Search size={16} className="text-[color:var(--color-text-tertiary)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics, tools, creators, content…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-[color:var(--color-text-tertiary)]"
          />
          <kbd className="text-[10px] text-[color:var(--color-text-tertiary)] border border-[color:var(--color-border-subtle)] rounded px-1.5 py-0.5">esc</kbd>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5" aria-label="Close"><X size={14} /></button>
        </form>

        <div className="max-h-[50vh] overflow-auto p-2">
          {!query ? (
            <p className="px-3 py-8 text-center text-xs text-[color:var(--color-text-tertiary)]">
              Type to search across topics, tools, creators, concepts, and content.
            </p>
          ) : total === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-[color:var(--color-text-tertiary)]">No matches.</p>
          ) : (
            <div className="space-y-1">
              {results.topics.map((x)    => <SearchResultRow key={x.id} kind="topic"    item={x} onSelect={selectAndClose} />)}
              {results.tools.map((x)     => <SearchResultRow key={x.id} kind="tool"     item={x} onSelect={selectAndClose} />)}
              {results.creators.map((x)  => <SearchResultRow key={x.id} kind="creator"  item={x} onSelect={selectAndClose} />)}
              {results.companies.map((x) => <SearchResultRow key={x.id} kind="company"  item={x} onSelect={selectAndClose} />)}
              {results.concepts.map((x)  => <SearchResultRow key={x.id} kind="concept"  item={x} onSelect={selectAndClose} />)}
              {results.content.map((x)   => <SearchResultRow key={x.id} kind="content"  item={x} onSelect={selectAndClose} />)}
            </div>
          )}
        </div>

        {query ? (
          <footer className="px-4 py-2 border-t border-[color:var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
            <span>{total} {total === 1 ? 'result' : 'results'}</span>
            <span>Press Enter to see all in /search</span>
          </footer>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/CmdKModal.jsx
git commit -m "feat(search): add CmdKModal palette"
```

---

## Task 7: Mount cmd-K globally in `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add cmd-K wiring**

Update `src/App.jsx` to:

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LeftRail from './components/layout/LeftRail.jsx'
import TopBar from './components/layout/TopBar.jsx'
import CmdKModal from './components/search/CmdKModal.jsx'
import { useCmdK } from './components/search/useCmdK.js'
import Home from './views/Home.jsx'
import Discover from './views/Discover.jsx'
import Topics from './views/Topics.jsx'
import Topic from './views/Topic.jsx'
import FlowMap from './views/FlowMap.jsx'
import Education from './views/Education.jsx'
import Memory from './views/Memory.jsx'
import Search from './views/Search.jsx'

function Shell() {
  const [open, setOpen] = useCmdK()
  return (
    <>
      <div className="flex h-full">
        <LeftRail />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar />
          <main className="flex-1 overflow-auto m-3 mt-3">
            <div className="glass-panel min-h-full overflow-hidden">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/topics" element={<Topics />} />
                <Route path="/topic/:slug" element={<Topic />} />
                <Route path="/flow" element={<FlowMap />} />
                <Route path="/education" element={<Education />} />
                <Route path="/memory" element={<Memory />} />
                <Route path="/search" element={<Search />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
      <CmdKModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
```

(Note: `Search` view is created in Task 8.)

- [ ] **Step 2: Commit (after Task 8 also completes — for now, skip the commit; Task 8 will commit App.jsx + Search.jsx together. If that ordering is awkward, commit App.jsx now and Search.jsx in Task 8.)**

For pragmatic ordering — commit App.jsx and a stub Search.jsx in this task:

Stub `src/views/Search.jsx`:

```jsx
export default function Search() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <p className="text-sm text-[color:var(--color-text-secondary)] mt-2">Coming up in next task.</p>
    </div>
  )
}
```

```bash
git add src/App.jsx src/views/Search.jsx
git commit -m "feat(app): mount cmd-K modal + add /search route stub"
```

---

## Task 8: Build `Search` results view (`/search?q=…`)

**Files:**
- Modify: `src/views/Search.jsx` (replace stub)

- [ ] **Step 1: Implement**

```jsx
import { useSearchParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { useSeed } from '../store/useSeed.js'
import { searchEntities } from '../lib/searchEntities.js'
import VideoCard from '../components/content/VideoCard.jsx'
import ArticleCard from '../components/content/ArticleCard.jsx'
import SocialPostCard from '../components/content/SocialPostCard.jsx'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'

const SECTIONS = [
  { key: 'topics',    label: 'Topics' },
  { key: 'tools',     label: 'Tools' },
  { key: 'creators',  label: 'Creators' },
  { key: 'companies', label: 'Companies' },
  { key: 'concepts',  label: 'Concepts' },
  { key: 'content',   label: 'Content' },
]

export default function Search() {
  const [params] = useSearchParams()
  const query = params.get('q') || ''
  const seed = useSeed()
  const results = searchEntities(query, seed)
  const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          {total} {total === 1 ? 'result' : 'results'} for "<span className="text-white">{query}</span>"
        </p>
      </header>

      {!query ? (
        <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">Type a query to search.</p>
      ) : total === 0 ? (
        <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">No matches across any entity type.</p>
      ) : (
        <div className="space-y-8">
          {SECTIONS.map(({ key, label }) => {
            const items = results[key]
            if (!items.length) return null
            return (
              <section key={key}>
                <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">{label} ({items.length})</h2>
                {key === 'content' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {items.map((it) =>
                      it.type === 'video'   ? <VideoCard       key={it.id} item={it} onOpen={open} /> :
                      it.type === 'article' ? <ArticleCard     key={it.id} item={it} onOpen={open} /> :
                                              <SocialPostCard  key={it.id} item={it} onOpen={open} />
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((x) => (
                      <Link
                        key={x.id}
                        to={key === 'topics' ? `/topic/${x.slug}` : (x.url || '#')}
                        target={key === 'topics' ? undefined : '_blank'}
                        rel={key === 'topics' ? undefined : 'noreferrer'}
                        className="glass-panel p-4 hover:brightness-125 transition-all"
                      >
                        <h3 className="text-sm font-semibold leading-tight">{x.name}</h3>
                        {x.summary ? (
                          <p className="text-xs text-[color:var(--color-text-secondary)] mt-1 line-clamp-2">{x.summary}</p>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/Search.jsx
git commit -m "feat(view): build Search results page"
```

---

## Task 9: Rewrite `Home.jsx` (hero + watchlist + suggestions + highlights)

**Files:**
- Modify: `src/views/Home.jsx`

- [ ] **Step 1: Implement**

```jsx
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Search, Bookmark, BookmarkCheck, Clock } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { filterContent } from '../lib/filter.js'
import VideoCard from '../components/content/VideoCard.jsx'
import ArticleCard from '../components/content/ArticleCard.jsx'
import SocialPostCard from '../components/content/SocialPostCard.jsx'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'

export default function Home() {
  const navigate = useNavigate()
  const { topics, content } = useSeed()
  const { isFollowing, toggleFollow, recordSearch, recentSearches } = useStore()
  const [query, setQuery] = useState('')
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  const followed = topics.filter((t) => isFollowing(t.id))
  const suggested = topics.filter((t) => !isFollowing(t.id))
  const highlights = filterContent(content, { sort: 'newest' }).slice(0, 6)
  const recent = recentSearches(5)

  function onSubmit(e) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    recordSearch(q)
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  return (
    <div className="p-6 space-y-10">
      {/* Hero */}
      <section className="flex flex-col items-center pt-6">
        <h1 className="text-3xl font-semibold tracking-tight">What are you exploring today?</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-2">
          Topics, tools, creators, content — all searchable in one place.
        </p>
        <form onSubmit={onSubmit} className="w-full max-w-[640px] mt-6 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--color-text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "MCP", "agent loop", "Simon Willison"…'
            className="glass-input w-full pl-11 pr-4 py-3 text-base"
          />
        </form>
        {recent.length ? (
          <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
            <Clock size={12} className="text-[color:var(--color-text-tertiary)]" />
            <span className="text-[11px] text-[color:var(--color-text-tertiary)] mr-1">recent:</span>
            {recent.map((r) => (
              <Link key={r.query} to={`/search?q=${encodeURIComponent(r.query)}`} className="chip hover:brightness-125">{r.query}</Link>
            ))}
          </div>
        ) : null}
      </section>

      {/* Watchlist */}
      {followed.length ? (
        <section>
          <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Watchlist ({followed.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {followed.map((t) => (
              <Link key={t.id} to={`/topic/${t.slug}`} className="glass-panel p-4 hover:brightness-125 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-topic)] font-medium">topic</span>
                  <BookmarkCheck size={13} className="text-[color:var(--color-topic)]" />
                </div>
                <h3 className="text-base font-semibold leading-tight">{t.name}</h3>
                <p className="text-xs text-[color:var(--color-text-secondary)] mt-1 line-clamp-2">{t.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Suggestions */}
      {suggested.length ? (
        <section>
          <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Suggested topics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suggested.map((t) => (
              <article key={t.id} className="glass-panel p-4">
                <Link to={`/topic/${t.slug}`} className="block">
                  <h3 className="text-base font-semibold leading-tight hover:underline">{t.name}</h3>
                  <p className="text-xs text-[color:var(--color-text-secondary)] mt-1 line-clamp-2">{t.summary}</p>
                </Link>
                <button onClick={() => toggleFollow(t.id)} className="btn text-xs mt-3">
                  <Bookmark size={13} /> Follow
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {/* Highlights */}
      <section>
        <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Latest highlights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {highlights.map((it) =>
            it.type === 'video'   ? <VideoCard       key={it.id} item={it} onOpen={open} /> :
            it.type === 'article' ? <ArticleCard     key={it.id} item={it} onOpen={open} /> :
                                    <SocialPostCard  key={it.id} item={it} onOpen={open} />
          )}
        </div>
      </section>

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/Home.jsx
git commit -m "feat(view): build Home with hero search, watchlist, suggestions, highlights"
```

---

# Phase 4 — Memory

## Task 10: Build `MemoryEntryCard` component

**Files:**
- Create: `src/components/memory/MemoryEntryCard.jsx`

- [ ] **Step 1: Implement**

```jsx
import { Trash2 } from 'lucide-react'
import Pill from '../ui/Pill.jsx'

const CATEGORY = {
  topic_rule:     { label: 'Topic Rule',     color: '#f59e0b' },
  source_pref:    { label: 'Source Pref',    color: '#14b8a6' },
  research_focus: { label: 'Research Focus', color: '#3b82f6' },
  personal_stack: { label: 'Personal Stack', color: '#f97316' },
}

const STATUS_TONE = {
  validated: 'positive',
  active:    'accent',
  learning:  'warning',
}

export default function MemoryEntryCard({ entry, onDelete }) {
  const cat = CATEGORY[entry.category] || { label: entry.category, color: '#94a3b8' }
  return (
    <article className="glass-panel p-4 group flex flex-col gap-3 relative">
      <div className="flex items-center justify-between">
        <span
          className="px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide font-medium border"
          style={{ borderColor: `${cat.color}66`, background: `${cat.color}1a`, color: cat.color }}
        >
          {cat.label}
        </span>
        <Pill tone={STATUS_TONE[entry.status] || 'neutral'}>{entry.status}</Pill>
      </div>

      <p className="text-sm leading-relaxed">{entry.content}</p>

      <div className="mt-auto pt-2 border-t border-[color:var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
        <span>Confidence: {Math.round((entry.confidence ?? 1) * 100)}% · Added {entry.addedAt}</span>
        {onDelete ? (
          <button
            onClick={() => onDelete(entry.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-300"
            aria-label="Delete"
          >
            <Trash2 size={13} />
          </button>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5 rounded-b-2xl overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${Math.round((entry.confidence ?? 1) * 100)}%`, background: cat.color }}
        />
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/memory/MemoryEntryCard.jsx
git commit -m "feat(memory): add MemoryEntryCard"
```

---

## Task 11: Build `MemoryAddForm` component

**Files:**
- Create: `src/components/memory/MemoryAddForm.jsx`

- [ ] **Step 1: Implement**

```jsx
import { useState } from 'react'
import { Plus, X } from 'lucide-react'

const CATEGORIES = [
  { value: 'topic_rule',     label: 'Topic Rule' },
  { value: 'source_pref',    label: 'Source Pref' },
  { value: 'research_focus', label: 'Research Focus' },
  { value: 'personal_stack', label: 'Personal Stack' },
]

export default function MemoryAddForm({ onSubmit, onCancel }) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('research_focus')

  function submit(e) {
    e.preventDefault()
    if (!content.trim()) return
    onSubmit({ content: content.trim(), category })
    setContent('')
  }

  return (
    <form onSubmit={submit} className="glass-panel p-4 space-y-3 border-[color:var(--color-topic)]/40">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Write a memory — a rule, preference, focus, or stack note that should shape future suggestions…"
        className="glass-input w-full text-sm resize-none"
        autoFocus
      />
      <div className="flex items-center justify-between gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="glass-input text-sm flex-1 max-w-[200px]"
        >
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="btn text-sm">
            <X size={13} /> Cancel
          </button>
          <button type="submit" className="btn btn-primary text-sm">
            <Plus size={13} /> Save
          </button>
        </div>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/memory/MemoryAddForm.jsx
git commit -m "feat(memory): add MemoryAddForm"
```

---

## Task 12: Build `SavedItemsGrid` component

**Files:**
- Create: `src/components/memory/SavedItemsGrid.jsx`

- [ ] **Step 1: Implement**

```jsx
import { useState } from 'react'
import { useSeed } from '../../store/useSeed.js'
import { useStore } from '../../store/useStore.js'
import VideoCard from '../content/VideoCard.jsx'
import ArticleCard from '../content/ArticleCard.jsx'
import SocialPostCard from '../content/SocialPostCard.jsx'
import VideoPlayerModal from '../content/VideoPlayerModal.jsx'
import ArticleReader from '../content/ArticleReader.jsx'

export default function SavedItemsGrid() {
  const { contentById } = useSeed()
  const { saves } = useStore()
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  const items = Object.keys(saves).map((id) => contentById(id)).filter(Boolean)

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  if (items.length === 0) {
    return <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">No saved items yet. Save anything via the bookmark icon.</p>
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((it) =>
          it.type === 'video'   ? <VideoCard       key={it.id} item={it} onOpen={open} /> :
          it.type === 'article' ? <ArticleCard     key={it.id} item={it} onOpen={open} /> :
                                  <SocialPostCard  key={it.id} item={it} onOpen={open} />
        )}
      </div>
      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/memory/SavedItemsGrid.jsx
git commit -m "feat(memory): add SavedItemsGrid"
```

---

## Task 13: Build full `Memory.jsx` view

**Files:**
- Modify: `src/views/Memory.jsx`
- Modify: `src/store/useSeed.js` (expose seed memory)

- [ ] **Step 1: Modify `useSeed.js` to expose seed memory**

Add the import at the top of `src/store/useSeed.js`:

```js
import seedMemory from '../data/seed-memory.json'
```

Then in the returned object, add:

```js
seedMemory,
```

(Place it alongside the other arrays.)

- [ ] **Step 2: Implement `Memory.jsx`**

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Bookmark, BookmarkX, Database } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import MemoryEntryCard from '../components/memory/MemoryEntryCard.jsx'
import MemoryAddForm from '../components/memory/MemoryAddForm.jsx'
import SavedItemsGrid from '../components/memory/SavedItemsGrid.jsx'

const TABS = [
  { id: 'saved',     label: 'Saved items'      },
  { id: 'followed',  label: 'Followed topics'  },
  { id: 'memory',    label: 'Memory entries'   },
  { id: 'sources',   label: 'Source preferences' },
]

const CATEGORY_FILTERS = [
  { id: 'all',            label: 'All'             },
  { id: 'topic_rule',     label: 'Topic Rules'     },
  { id: 'source_pref',    label: 'Source Prefs'    },
  { id: 'research_focus', label: 'Research Focus'  },
  { id: 'personal_stack', label: 'Personal Stack'  },
]

export default function Memory() {
  const { topics, seedMemory } = useSeed()
  const { follows, toggleFollow, memoryEntries, addMemory, deleteMemory } = useStore()

  const [tab, setTab] = useState('saved')
  const [showAdd, setShowAdd] = useState(false)
  const [catFilter, setCatFilter] = useState('all')

  const followedTopics = topics.filter((t) => follows[t.id])
  const allMemory = [...seedMemory, ...Object.values(memoryEntries)]
  const filteredMemory = catFilter === 'all' ? allMemory : allMemory.filter((m) => m.category === catFilter)

  function onAddSubmit(data) {
    addMemory(data)
    setShowAdd(false)
  }

  function onDeleteMemory(id) {
    if (id.startsWith('mem_seed_')) return // can't delete pre-populated seed
    deleteMemory(id)
  }

  return (
    <div className="p-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
          <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
            What you've saved, who you follow, and the rules shaping your map.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[color:var(--color-border-subtle)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-[color:var(--color-topic)] text-white'
                : 'border-transparent text-[color:var(--color-text-tertiary)] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'saved' && <SavedItemsGrid />}

      {tab === 'followed' && (
        followedTopics.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">
            Not following any topics yet. Find one in <Link to="/topics" className="underline">/topics</Link>.
          </p>
        ) : (
          <ul className="space-y-2 max-w-[640px]">
            {followedTopics.map((t) => (
              <li key={t.id} className="glass-panel p-4 flex items-center justify-between">
                <Link to={`/topic/${t.slug}`} className="flex items-center gap-3 hover:underline flex-1 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[color:var(--color-topic)] flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-[11px] text-[color:var(--color-text-tertiary)] truncate">{t.summary}</div>
                  </div>
                </Link>
                <button
                  onClick={() => toggleFollow(t.id)}
                  className="btn text-xs flex-shrink-0"
                  aria-label="Unfollow"
                >
                  <BookmarkX size={13} /> Unfollow
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'memory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {CATEGORY_FILTERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCatFilter(c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    catFilter === c.id
                      ? 'bg-[color:var(--color-topic)]/15 border-[color:var(--color-topic)]/40 text-[color:var(--color-topic)]'
                      : 'border-[color:var(--color-border-subtle)] text-[color:var(--color-text-secondary)] hover:bg-white/5'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAdd((v) => !v)} className="btn btn-primary text-sm">
              <Plus size={13} /> Add memory
            </button>
          </div>

          {showAdd ? <MemoryAddForm onSubmit={onAddSubmit} onCancel={() => setShowAdd(false)} /> : null}

          {filteredMemory.length === 0 ? (
            <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">No memory entries in this category.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredMemory.map((entry) => (
                <MemoryEntryCard key={entry.id} entry={entry} onDelete={onDeleteMemory} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'sources' && (
        <div className="glass-panel p-6 max-w-[640px]">
          <Database size={18} className="text-[color:var(--color-creator)] mb-3" />
          <h2 className="text-base font-semibold">Source preferences</h2>
          <p className="text-sm text-[color:var(--color-text-secondary)] mt-2 leading-relaxed">
            Source weighting comes online when live ingestion ships (planned for v1.1). For now, the seed library is curated — every item is treated as high signal.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify**

```bash
npm run test:run
npm run build
```

Expected: all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/views/Memory.jsx src/store/useSeed.js
git commit -m "feat(view): build full Memory section with 4 tabs + CRUD"
```

---

## Task 14: Final smoke test

**Files:** *(no changes — verification only)*

- [ ] **Step 1: Run all tests**

```bash
npm run test:run
```

Expected: 36+ tests pass (Plan 1's 30 + Plan 2's 4 useStore additions + 6 searchEntities = ~40).

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Visit each route in dev server**

`/`, `/discover`, `/topics`, `/topic/claude`, `/flow`, `/education`, `/memory`, `/search?q=claude`. All render. Press cmd+K (or ctrl+K) anywhere — palette opens.

- [ ] **Step 4: Verify the consume loop**

1. Open cmd-K. Type "MCP". See results across topics, tools, content.
2. Press Enter. Lands on `/search?q=MCP` with grouped results.
3. Click a topic result → topic page.
4. Click "Add memory" on `/memory`. Save a note. Reload. Note still there.
5. Filter memory by category. See filtered list.

- [ ] **Step 5: Final commit**

```bash
git commit --allow-empty -m "chore: complete Plan 2 — search & memory"
```

---

# Done

After this plan:
- Global cmd+K search palette mounted.
- `/search?q=…` results page grouped by entity type.
- Home page with hero search, watchlist, suggested topics, latest highlights, recent searches chips.
- Memory section with 4 tabs (Saved / Followed / Memory entries / Source preferences) and full CRUD on Memory entries.
- 8 pre-populated Interest Memory seed entries plus user-added ones.
- Recent search history surfaced in the Home hero.

**Next plan:** Plan 3 — Flow Map cinematic centerpiece (3D canvas + glass sidebar + KPI strip + pattern engine).
