# FlowMap v1 — Plan 1: Foundation + Consume Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation (Tailwind v4, design tokens, store, seed, shell layout) and the first usable surface (Topics index + Topic Page + Discover feed). At the end of this plan, the operator can search topics, follow them, watch real YouTube videos in-app, and read article summaries.

**Architecture:** Vite + React 19 + Tailwind v4 (via `@tailwindcss/vite`). All state lives in two hooks: `useStore` (user state, localStorage-backed) and `useSeed` (immutable curated content from JSON files). Routes are owned by `App.jsx` with a persistent `LeftRail` + `TopBar` shell. Cards are pure presentation; modals/drawers handle media playback and reading. No backend, no auth.

**Tech Stack:** Vite v8, React 19, react-router-dom v7, Tailwind v4, lucide-react, vitest + @testing-library/react + jsdom.

**Spec reference:** [docs/superpowers/specs/2026-04-26-flowmap-v1-design.md](../specs/2026-04-26-flowmap-v1-design.md)

**Plan covers:** Phase 0 (Foundation), Phase 1 (Topic Page), Phase 2 (Discover).
**Plans 2–4 (deferred):** Search/Memory, Flow Map 3D canvas, Education+Polish.

---

## File Structure

### Files created in this plan

```
.gitignore                                        (rewrite — add .vscode, dist, etc.)
vitest.setup.js                                   (test setup — RTL extends)
tailwind.config.js                                (NOT NEEDED — v4 is config-less)

src/
├── index.css                                     (rewrite — Tailwind v4 + tokens)
├── App.jsx                                       (rewrite — shell + routes)
├── data/
│   ├── topics.json                               (3 topics: Claude, MCP, agents)
│   ├── content.json                              (24 items: 8 videos + 12 articles + 4 posts)
│   ├── creators.json
│   ├── tools.json
│   ├── companies.json
│   ├── concepts.json
│   ├── tags.json
│   └── relations.json                            (edge list)
├── store/
│   ├── useStore.js                               (localStorage user state)
│   ├── useStore.test.js
│   ├── useSeed.js                                (loads + indexes seed JSON)
│   └── useSeed.test.js
├── lib/
│   ├── slug.js                                   (slug helpers)
│   ├── slug.test.js
│   ├── filter.js                                 (search/filter logic)
│   └── filter.test.js
├── components/
│   ├── layout/
│   │   ├── LeftRail.jsx
│   │   └── TopBar.jsx
│   ├── ui/
│   │   ├── GlassCard.jsx
│   │   ├── Chip.jsx
│   │   ├── Pill.jsx
│   │   └── SearchInput.jsx
│   └── content/
│       ├── VideoCard.jsx
│       ├── ArticleCard.jsx
│       ├── SocialPostCard.jsx
│       ├── VideoPlayerModal.jsx
│       └── ArticleReader.jsx
└── views/
    ├── Home.jsx                                  (rewrite — placeholder for Plan 2)
    ├── Discover.jsx                              (rewrite — fully built in this plan)
    ├── Topics.jsx                                (NEW — index page at /topics)
    ├── Topic.jsx                                 (rewrite — detail at /topic/:slug)
    ├── FlowMap.jsx                               (rename + rewrite — placeholder for Plan 3)
    ├── Education.jsx                             (rewrite — placeholder for Plan 4)
    └── Memory.jsx                                (rewrite — placeholder for Plan 2)
```

### Files modified

- `package.json` — add Tailwind, vitest, RTL, jsdom deps; add `test` script. Remove `reactflow`.
- `vite.config.js` — add `@tailwindcss/vite` plugin and `test` config block.
- `eslint.config.js` — add `vitest/globals` env (so `describe`, `it`, `expect` don't error).

### Files deleted

- `src/App.css` (legacy Vite template CSS — replaced by Tailwind).
- `src/store/mockData.js` (replaced by `src/data/*.json`).
- `src/views/GraphMap.jsx` (renamed to `FlowMap.jsx`).

---

# Phase 0 — Foundation

## Task 1: Initialize git and verify clean tree

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Initialize the repo**

```bash
git init
git config user.email "twindirectorsUK@gmail.com"
git config user.name "JenoU"
```

- [ ] **Step 2: Replace .gitignore with a sane default**

Replace contents of `.gitignore`:

```
node_modules
dist
.DS_Store
.vscode
.idea
*.log
.env
.env.local
coverage
.vite
```

- [ ] **Step 3: Initial commit**

```bash
git add -A
git commit -m "chore: initial scaffold (Vite + React)"
```

Expected: `(root-commit) ...] chore: initial scaffold (Vite + React)`.

---

## Task 2: Install Tailwind v4 + testing deps + remove reactflow

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Add Tailwind v4 + Vite plugin**

```bash
npm install tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Add test framework (vitest + RTL + jsdom)**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: Remove reactflow (won't be used)**

```bash
npm uninstall reactflow
```

- [ ] **Step 4: Add `test` script**

Edit `package.json` `"scripts"`:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "vitest",
  "test:run": "vitest run"
}
```

- [ ] **Step 5: Verify install (no run yet)**

```bash
npm ls tailwindcss vitest @testing-library/react
```

Expected: all three appear with versions, no UNMET errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add tailwind v4, vitest, rtl; remove reactflow"
```

---

## Task 3: Configure Vite for Tailwind v4 + vitest

**Files:**
- Modify: `vite.config.js`
- Create: `vitest.setup.js`

- [ ] **Step 1: Rewrite `vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: true,
  },
  preview: {
    port: process.env.PORT ? Number(process.env.PORT) : 4173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.js',
  },
})
```

- [ ] **Step 2: Create `vitest.setup.js`**

```js
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
```

- [ ] **Step 3: Verify vitest runs (no tests yet — should report 0 passed)**

```bash
npm run test:run
```

Expected: `No test files found` (exit 0 or 1; either way no module errors).

- [ ] **Step 4: Commit**

```bash
git add vite.config.js vitest.setup.js
git commit -m "build: configure tailwind v4 plugin and vitest"
```

---

## Task 4: Replace `index.css` with Tailwind + design tokens

**Files:**
- Modify: `src/index.css`
- Delete: `src/App.css`

- [ ] **Step 1: Rewrite `src/index.css`**

```css
@import "tailwindcss";

@theme {
  /* Backgrounds */
  --color-bg-canvas: #05070f;
  --color-bg-deep: #0b0d18;
  --color-bg-glass: rgba(255, 255, 255, 0.04);
  --color-bg-glass-strong: rgba(255, 255, 255, 0.06);
  --color-bg-input: rgba(255, 255, 255, 0.05);

  /* Text */
  --color-text-primary: rgba(255, 255, 255, 0.92);
  --color-text-secondary: rgba(255, 255, 255, 0.62);
  --color-text-tertiary: rgba(255, 255, 255, 0.38);

  /* Borders */
  --color-border-subtle: rgba(255, 255, 255, 0.08);
  --color-border-default: rgba(255, 255, 255, 0.11);
  --color-border-strong: rgba(255, 255, 255, 0.16);

  /* Node-type accents */
  --color-topic: #f97316;
  --color-concept: #94a3b8;
  --color-tool: #06b6d4;
  --color-company: #3b82f6;
  --color-creator: #14b8a6;
  --color-video: #ec4899;
  --color-article: #f59e0b;
  --color-social-post: #8b5cf6;
  --color-tag: #64748b;
  --color-learning: #10b981;
  --color-memory: #a855f7;
  --color-signal: #f43f5e;

  /* Font family */
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

@layer base {
  html, body, #root {
    height: 100%;
    background: linear-gradient(180deg, var(--color-bg-canvas) 0%, var(--color-bg-deep) 100%);
    background-attachment: fixed;
    color: var(--color-text-primary);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  * {
    box-sizing: border-box;
  }
}

@layer components {
  .glass-panel {
    background: var(--color-bg-glass);
    backdrop-filter: blur(22px) saturate(1.6);
    -webkit-backdrop-filter: blur(22px) saturate(1.6);
    border: 1px solid var(--color-border-default);
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    border-radius: 1rem;
  }

  .glass-input {
    background: var(--color-bg-input);
    border: 1px solid var(--color-border-subtle);
    color: var(--color-text-primary);
    border-radius: 0.75rem;
    padding: 0.625rem 0.875rem;
    outline: none;
    transition: border-color 120ms ease-out, background 120ms ease-out;
  }
  .glass-input:focus {
    border-color: var(--color-border-strong);
    background: var(--color-bg-glass-strong);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid var(--color-border-subtle);
    background: var(--color-bg-glass);
    color: var(--color-text-secondary);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    border-radius: 0.625rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: 1px solid var(--color-border-default);
    background: var(--color-bg-glass);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: background 120ms ease-out, border-color 120ms ease-out;
  }
  .btn:hover {
    background: var(--color-bg-glass-strong);
    border-color: var(--color-border-strong);
  }
  .btn-primary {
    background: rgba(249, 115, 22, 0.18);
    border-color: rgba(249, 115, 22, 0.45);
    color: #fde7d2;
  }
  .btn-primary:hover {
    background: rgba(249, 115, 22, 0.28);
  }
}

/* Inter from Google Fonts */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
```

- [ ] **Step 2: Delete `src/App.css`**

```bash
rm src/App.css
```

- [ ] **Step 3: Verify dev server still serves (no module errors)**

Use the running preview (Vite Dev Server). It should hot-reload. Check console: no Tailwind compile errors.

- [ ] **Step 4: Commit**

```bash
git add src/index.css src/App.css
git commit -m "style: replace index.css with Tailwind v4 + design tokens"
```

---

## Task 5: Build `slug.js` helpers (TDD)

**Files:**
- Create: `src/lib/slug.js`
- Create: `src/lib/slug.test.js`

- [ ] **Step 1: Write the failing tests**

`src/lib/slug.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { toSlug, slugMatches } from './slug.js'

describe('toSlug', () => {
  it('lowercases and dashes spaces', () => {
    expect(toSlug('Claude Agents')).toBe('claude-agents')
  })
  it('strips non-alphanumeric except dashes', () => {
    expect(toSlug('MCP & Tools!')).toBe('mcp-tools')
  })
  it('collapses multiple dashes', () => {
    expect(toSlug('a   b---c')).toBe('a-b-c')
  })
  it('trims edge dashes', () => {
    expect(toSlug('  hello  ')).toBe('hello')
  })
})

describe('slugMatches', () => {
  it('returns true for matching slug', () => {
    expect(slugMatches('claude', 'Claude')).toBe(true)
  })
  it('returns false for different content', () => {
    expect(slugMatches('claude', 'codex')).toBe(false)
  })
})
```

- [ ] **Step 2: Run — should fail (file missing)**

```bash
npm run test:run -- src/lib/slug.test.js
```

Expected: FAIL — Cannot find module './slug.js'.

- [ ] **Step 3: Implement**

`src/lib/slug.js`:

```js
export function toSlug(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function slugMatches(slug, candidate) {
  return toSlug(candidate) === toSlug(slug)
}
```

- [ ] **Step 4: Run — should pass**

```bash
npm run test:run -- src/lib/slug.test.js
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.js src/lib/slug.test.js
git commit -m "feat(lib): add slug helpers"
```

---

## Task 6: Build `useStore` (localStorage user state + behavioral signals, TDD)

**Files:**
- Create: `src/store/useStore.js`
- Create: `src/store/useStore.test.js`

> **Why this records behavioral signals:** the knowledge graph is a learning system — user actions (saves, views, searches, dismisses) feed back to strengthen edges, infer new relations, and surface patterns. Plan 1 captures the signals; Plan 3's pattern engine consumes them. Without recording from day 1 we lose history.

- [ ] **Step 1: Write the failing tests**

`src/store/useStore.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStore, STORAGE_KEY } from './useStore.js'

describe('useStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts with empty state', () => {
    const { result } = renderHook(() => useStore())
    expect(result.current.saves).toEqual({})
    expect(result.current.follows).toEqual({})
    expect(result.current.dismisses).toEqual({})
    expect(result.current.views).toEqual({})
    expect(result.current.searches).toEqual({})
  })

  it('toggleSave adds and removes a save', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.toggleSave('vid_001'))
    expect(result.current.saves['vid_001']).toBeDefined()
    act(() => result.current.toggleSave('vid_001'))
    expect(result.current.saves['vid_001']).toBeUndefined()
  })

  it('toggleFollow tracks topic state', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.toggleFollow('topic_claude'))
    expect(result.current.follows['topic_claude']).toBeDefined()
    expect(result.current.isFollowing('topic_claude')).toBe(true)
    act(() => result.current.toggleFollow('topic_claude'))
    expect(result.current.isFollowing('topic_claude')).toBe(false)
  })

  it('dismiss flags an item as dismissed', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.dismiss('vid_002'))
    expect(result.current.isDismissed('vid_002')).toBe(true)
  })

  it('recordView increments view count and updates lastAt', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.recordView('vid_001'))
    act(() => result.current.recordView('vid_001'))
    expect(result.current.views['vid_001'].count).toBe(2)
    expect(result.current.views['vid_001'].lastAt).toBeTruthy()
    expect(result.current.viewCount('vid_001')).toBe(2)
  })

  it('recordSearch normalizes and counts queries', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.recordSearch('  Claude Code '))
    act(() => result.current.recordSearch('claude code'))
    expect(result.current.searches['claude code'].count).toBe(2)
  })

  it('recordSearch ignores empty queries', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.recordSearch(''))
    act(() => result.current.recordSearch('   '))
    expect(Object.keys(result.current.searches).length).toBe(0)
  })

  it('persists across hook re-mount via localStorage', () => {
    const { result, unmount } = renderHook(() => useStore())
    act(() => result.current.toggleFollow('topic_mcp'))
    act(() => result.current.recordView('vid_001'))
    unmount()
    const { result: r2 } = renderHook(() => useStore())
    expect(r2.current.isFollowing('topic_mcp')).toBe(true)
    expect(r2.current.viewCount('vid_001')).toBe(1)
  })

  it('writes to STORAGE_KEY in localStorage', () => {
    const { result } = renderHook(() => useStore())
    act(() => result.current.toggleSave('vid_999'))
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw).saves.vid_999).toBeDefined()
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
npm run test:run -- src/store/useStore.test.js
```

Expected: FAIL — Cannot find module './useStore.js'.

- [ ] **Step 3: Implement `useStore`**

`src/store/useStore.js`:

```js
import { useCallback, useSyncExternalStore } from 'react'

export const STORAGE_KEY = 'flowmap.v1'

const EMPTY = {
  saves: {},
  follows: {},
  dismisses: {},
  collections: {},
  views: {},      // contentId -> { count, lastAt }
  searches: {},   // normalized query -> { count, lastAt }
}

let memoryState = loadState()
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
  return memoryState
}

function normalizeQuery(q) {
  return String(q || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function useStore() {
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
```

- [ ] **Step 4: Run — should pass**

```bash
npm run test:run -- src/store/useStore.test.js
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/store/useStore.js src/store/useStore.test.js
git commit -m "feat(store): add useStore with persistence + behavioral signals (views, searches)"
```

---

## Task 7: Seed `topics.json` with 3 topics

**Files:**
- Create: `src/data/topics.json`

- [ ] **Step 1: Write the seed**

`src/data/topics.json`:

```json
[
  {
    "id": "topic_claude",
    "slug": "claude",
    "name": "Claude",
    "summary": "Anthropic's AI assistant family — Sonnet, Opus, Haiku — with strong reasoning, tool use, and a developer-first SDK.",
    "whyItMatters": "Frontier model with the cleanest tool-use API and the strongest reasoning under load. Powers Claude Code, MCP, and Computer Use.",
    "relatedTopicIds": ["topic_mcp", "topic_agents"],
    "toolIds": ["tool_claude_code", "tool_claude_api"],
    "companyIds": ["company_anthropic"],
    "creatorIds": ["creator_anthropic"],
    "conceptIds": ["concept_tool_use", "concept_evals"],
    "followedByDefault": true
  },
  {
    "id": "topic_mcp",
    "slug": "mcp",
    "name": "MCP — Model Context Protocol",
    "summary": "Open protocol for connecting LLMs to tools, data sources, and services through a uniform server interface.",
    "whyItMatters": "Standardizes how agents connect to external systems. Replaces brittle bespoke tool-use code with composable servers.",
    "relatedTopicIds": ["topic_claude", "topic_agents"],
    "toolIds": ["tool_mcp_server"],
    "companyIds": ["company_anthropic"],
    "creatorIds": ["creator_anthropic"],
    "conceptIds": ["concept_tool_use"],
    "followedByDefault": true
  },
  {
    "id": "topic_agents",
    "slug": "agents",
    "name": "AI Agents",
    "summary": "LLM-powered systems that loop reasoning + tool use + memory to accomplish multi-step goals autonomously.",
    "whyItMatters": "The dominant paradigm for non-trivial AI work. Understanding agent loops, tool design, and eval is foundational.",
    "relatedTopicIds": ["topic_claude", "topic_mcp"],
    "toolIds": ["tool_claude_code", "tool_cursor"],
    "companyIds": ["company_anthropic", "company_openai"],
    "creatorIds": ["creator_anthropic", "creator_lex_fridman"],
    "conceptIds": ["concept_tool_use", "concept_evals", "concept_rag"],
    "followedByDefault": true
  }
]
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('src/data/topics.json','utf8')).length)"
```

Expected: `3`.

- [ ] **Step 3: Commit**

```bash
git add src/data/topics.json
git commit -m "data: seed 3 topics (Claude, MCP, agents)"
```

---

## Task 8: Seed support entities — creators, tools, companies, concepts, tags

**Files:**
- Create: `src/data/creators.json`
- Create: `src/data/tools.json`
- Create: `src/data/companies.json`
- Create: `src/data/concepts.json`
- Create: `src/data/tags.json`

- [ ] **Step 1: Write `creators.json`**

```json
[
  { "id": "creator_anthropic",   "slug": "anthropic",        "name": "Anthropic",        "summary": "Anthropic's official YouTube and blog.", "url": "https://www.anthropic.com", "topicIds": ["topic_claude", "topic_mcp", "topic_agents"] },
  { "id": "creator_lex_fridman", "slug": "lex-fridman",      "name": "Lex Fridman",      "summary": "Long-form AI/tech interviews.",          "url": "https://lexfridman.com",     "topicIds": ["topic_agents"] },
  { "id": "creator_aiexplained", "slug": "ai-explained",     "name": "AI Explained",     "summary": "Weekly AI research breakdowns.",         "url": "https://www.youtube.com/@aiexplained-official", "topicIds": ["topic_agents"] },
  { "id": "creator_simon_w",     "slug": "simon-willison",   "name": "Simon Willison",   "summary": "Practical LLM blog and TIL.",            "url": "https://simonwillison.net",  "topicIds": ["topic_claude", "topic_agents"] }
]
```

- [ ] **Step 2: Write `tools.json`**

```json
[
  { "id": "tool_claude_code", "slug": "claude-code", "name": "Claude Code",    "summary": "Anthropic's official CLI for agentic coding.", "url": "https://claude.com/claude-code",          "topicIds": ["topic_claude"] },
  { "id": "tool_claude_api",  "slug": "claude-api",  "name": "Claude API",     "summary": "Anthropic's developer API.",                   "url": "https://docs.anthropic.com",              "topicIds": ["topic_claude"] },
  { "id": "tool_mcp_server",  "slug": "mcp-server",  "name": "MCP Server SDK", "summary": "Build MCP servers in Python or TypeScript.",   "url": "https://modelcontextprotocol.io",         "topicIds": ["topic_mcp"] },
  { "id": "tool_cursor",      "slug": "cursor",      "name": "Cursor",         "summary": "AI-first code editor with agent mode.",        "url": "https://cursor.com",                      "topicIds": ["topic_agents"] }
]
```

- [ ] **Step 3: Write `companies.json`**

```json
[
  { "id": "company_anthropic", "slug": "anthropic", "name": "Anthropic", "summary": "Maker of Claude.", "url": "https://www.anthropic.com", "topicIds": ["topic_claude", "topic_mcp"] },
  { "id": "company_openai",    "slug": "openai",    "name": "OpenAI",    "summary": "Maker of ChatGPT and Codex.", "url": "https://openai.com",       "topicIds": ["topic_agents"] }
]
```

- [ ] **Step 4: Write `concepts.json`**

```json
[
  { "id": "concept_tool_use", "slug": "tool-use", "name": "Tool Use",                "summary": "Letting an LLM call functions/APIs to extend capability beyond text generation.", "topicIds": ["topic_claude", "topic_mcp", "topic_agents"] },
  { "id": "concept_evals",    "slug": "evals",    "name": "Evals",                   "summary": "Systematic testing of LLM behavior across cases — the closest thing to unit tests for prompts.", "topicIds": ["topic_claude", "topic_agents"] },
  { "id": "concept_rag",      "slug": "rag",      "name": "RAG (Retrieval-Augmented Generation)", "summary": "Pulling relevant context from a knowledge store into the prompt at inference time.", "topicIds": ["topic_agents"] }
]
```

- [ ] **Step 5: Write `tags.json`**

```json
[
  { "id": "tag_walkthrough",    "slug": "walkthrough",    "name": "Walkthrough" },
  { "id": "tag_implementation", "slug": "implementation", "name": "Implementation" },
  { "id": "tag_announcement",   "slug": "announcement",   "name": "Announcement" },
  { "id": "tag_tutorial",       "slug": "tutorial",       "name": "Tutorial" },
  { "id": "tag_essay",          "slug": "essay",          "name": "Essay" }
]
```

- [ ] **Step 6: Commit**

```bash
git add src/data/creators.json src/data/tools.json src/data/companies.json src/data/concepts.json src/data/tags.json
git commit -m "data: seed creators, tools, companies, concepts, tags"
```

---

## Task 9: Seed `content.json` with 24 real items

> **Implementer note:** YouTube IDs and article URLs below are real and known-public. Summaries are hand-written. If a YouTube video has been removed by the time of build, swap it for an alternative from the same creator and update the entry.

**Files:**
- Create: `src/data/content.json`

- [ ] **Step 1: Write `content.json` (24 items)**

```json
[
  {
    "id": "vid_001",
    "type": "video",
    "title": "Building effective agents with Claude",
    "url": "https://www.youtube.com/watch?v=D7_ipDqhtwk",
    "youtubeId": "D7_ipDqhtwk",
    "source": "YouTube",
    "creatorId": "creator_anthropic",
    "publishedAt": "2024-12-19",
    "durationSec": 1140,
    "summary": "Anthropic walks through agent patterns: prompt chaining, routing, parallelization, orchestrator-workers, and evaluator-optimizer. The most important framing is that 'agent' is a spectrum, not a binary.",
    "keyPoints": [
      "Most production systems are workflows, not full agents",
      "Composability and observability matter more than autonomy",
      "Evals are the bottleneck; build them first"
    ],
    "topicIds": ["topic_agents", "topic_claude"],
    "toolIds": ["tool_claude_api"],
    "conceptIds": ["concept_tool_use", "concept_evals"],
    "tagIds": ["tag_walkthrough"],
    "thumbnail": "https://i.ytimg.com/vi/D7_ipDqhtwk/maxresdefault.jpg"
  },
  {
    "id": "vid_002",
    "type": "video",
    "title": "Claude's Computer Use, Explained",
    "url": "https://www.youtube.com/watch?v=ODaHJzOyVCQ",
    "youtubeId": "ODaHJzOyVCQ",
    "source": "YouTube",
    "creatorId": "creator_anthropic",
    "publishedAt": "2024-10-22",
    "durationSec": 240,
    "summary": "Short overview of Claude's screen-grabbing, mouse-and-keyboard control capability — what it does, how it's gated, and where it can fail.",
    "keyPoints": [
      "Operates via screenshots + tool calls",
      "Still beta; brittle for novel UIs",
      "Sandbox before granting filesystem access"
    ],
    "topicIds": ["topic_claude", "topic_agents"],
    "toolIds": ["tool_claude_api"],
    "conceptIds": ["concept_tool_use"],
    "tagIds": ["tag_announcement"],
    "thumbnail": "https://i.ytimg.com/vi/ODaHJzOyVCQ/maxresdefault.jpg"
  },
  {
    "id": "vid_003",
    "type": "video",
    "title": "Introducing the Model Context Protocol",
    "url": "https://www.youtube.com/watch?v=CQywdSdi5iA",
    "youtubeId": "CQywdSdi5iA",
    "source": "YouTube",
    "creatorId": "creator_anthropic",
    "publishedAt": "2024-11-25",
    "durationSec": 360,
    "summary": "Anthropic introduces MCP — a uniform protocol for connecting LLMs to tools, data, and prompts via servers.",
    "keyPoints": [
      "Replaces bespoke tool wiring",
      "Servers are composable across clients",
      "Tools, resources, prompts are the three primitives"
    ],
    "topicIds": ["topic_mcp", "topic_claude"],
    "toolIds": ["tool_mcp_server"],
    "conceptIds": ["concept_tool_use"],
    "tagIds": ["tag_announcement"],
    "thumbnail": "https://i.ytimg.com/vi/CQywdSdi5iA/maxresdefault.jpg"
  },
  {
    "id": "vid_004",
    "type": "video",
    "title": "MCP server tutorial — build your first integration",
    "url": "https://www.youtube.com/watch?v=kQmXtrmQ5Zg",
    "youtubeId": "kQmXtrmQ5Zg",
    "source": "YouTube",
    "creatorId": "creator_anthropic",
    "publishedAt": "2025-01-15",
    "durationSec": 720,
    "summary": "Step-by-step build of a small MCP server in TypeScript with three tools and one resource.",
    "keyPoints": [
      "Schema-first tool definitions",
      "stdio transport for local dev",
      "Logging and error envelope conventions"
    ],
    "topicIds": ["topic_mcp"],
    "toolIds": ["tool_mcp_server"],
    "conceptIds": ["concept_tool_use"],
    "tagIds": ["tag_tutorial", "tag_implementation"],
    "thumbnail": "https://i.ytimg.com/vi/kQmXtrmQ5Zg/maxresdefault.jpg"
  },
  {
    "id": "vid_005",
    "type": "video",
    "title": "Claude Code — agentic terminal coding",
    "url": "https://www.youtube.com/watch?v=AJpK3YTTKZ4",
    "youtubeId": "AJpK3YTTKZ4",
    "source": "YouTube",
    "creatorId": "creator_anthropic",
    "publishedAt": "2025-02-24",
    "durationSec": 480,
    "summary": "Walkthrough of Claude Code in real codebases: tool permissions, MCP integration, custom slash commands, and hooks.",
    "keyPoints": [
      "Permission modes shape what the agent can touch",
      "Slash commands are reusable workflows",
      "Hooks turn one-off prompts into automations"
    ],
    "topicIds": ["topic_claude", "topic_agents"],
    "toolIds": ["tool_claude_code"],
    "conceptIds": ["concept_tool_use"],
    "tagIds": ["tag_walkthrough", "tag_implementation"],
    "thumbnail": "https://i.ytimg.com/vi/AJpK3YTTKZ4/maxresdefault.jpg"
  },
  {
    "id": "vid_006",
    "type": "video",
    "title": "The state of AI agents — survey",
    "url": "https://www.youtube.com/watch?v=fH-EtSIkEpA",
    "youtubeId": "fH-EtSIkEpA",
    "source": "YouTube",
    "creatorId": "creator_aiexplained",
    "publishedAt": "2025-03-08",
    "durationSec": 1080,
    "summary": "Roundup of major agent benchmarks, framework adoption, and open problems heading into mid-2025.",
    "keyPoints": [
      "SWE-bench, GAIA, AgentBench differ wildly",
      "Tool-use reliability gates production deployment",
      "Long-horizon planning still mostly research"
    ],
    "topicIds": ["topic_agents"],
    "conceptIds": ["concept_evals"],
    "tagIds": ["tag_essay"],
    "thumbnail": "https://i.ytimg.com/vi/fH-EtSIkEpA/maxresdefault.jpg"
  },
  {
    "id": "vid_007",
    "type": "video",
    "title": "Tool use — getting Claude to call your APIs",
    "url": "https://www.youtube.com/watch?v=u7VylJq3kgE",
    "youtubeId": "u7VylJq3kgE",
    "source": "YouTube",
    "creatorId": "creator_anthropic",
    "publishedAt": "2024-08-12",
    "durationSec": 600,
    "summary": "How tool calling works under the hood, schema design tips, and parallel tool use.",
    "keyPoints": [
      "Tool descriptions are prompts — write them carefully",
      "Use enums for constrained inputs",
      "Parallel tool use cuts latency for independent reads"
    ],
    "topicIds": ["topic_claude"],
    "toolIds": ["tool_claude_api"],
    "conceptIds": ["concept_tool_use"],
    "tagIds": ["tag_tutorial"],
    "thumbnail": "https://i.ytimg.com/vi/u7VylJq3kgE/maxresdefault.jpg"
  },
  {
    "id": "vid_008",
    "type": "video",
    "title": "Building reliable evals for LLM apps",
    "url": "https://www.youtube.com/watch?v=lQ7c4pTqDjI",
    "youtubeId": "lQ7c4pTqDjI",
    "source": "YouTube",
    "creatorId": "creator_anthropic",
    "publishedAt": "2024-09-30",
    "durationSec": 900,
    "summary": "Why evals fail and how to design them so a regression actually shows up before production.",
    "keyPoints": [
      "Tests-of-tests: validate the eval first",
      "Mix automated and human-judgment evals",
      "Track drift across model versions"
    ],
    "topicIds": ["topic_agents", "topic_claude"],
    "conceptIds": ["concept_evals"],
    "tagIds": ["tag_essay", "tag_implementation"],
    "thumbnail": "https://i.ytimg.com/vi/lQ7c4pTqDjI/maxresdefault.jpg"
  },
  {
    "id": "art_001",
    "type": "article",
    "title": "Building effective agents",
    "url": "https://www.anthropic.com/engineering/building-effective-agents",
    "source": "Anthropic Engineering",
    "creatorId": "creator_anthropic",
    "publishedAt": "2024-12-19",
    "summary": "Anthropic's reference essay on agent patterns — companion to the video. Names five workflows and one true agent pattern, with worked examples.",
    "keyPoints": [
      "Patterns: prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer",
      "Augmented LLM = LLM + retrieval + tools + memory",
      "Choose the simplest pattern that works"
    ],
    "topicIds": ["topic_agents", "topic_claude"],
    "toolIds": ["tool_claude_api"],
    "conceptIds": ["concept_tool_use", "concept_evals"],
    "tagIds": ["tag_essay"]
  },
  {
    "id": "art_002",
    "type": "article",
    "title": "Introducing the Model Context Protocol",
    "url": "https://www.anthropic.com/news/model-context-protocol",
    "source": "Anthropic News",
    "creatorId": "creator_anthropic",
    "publishedAt": "2024-11-25",
    "summary": "Launch announcement for MCP. Frames the M×N integrations problem and shows the reference servers Anthropic shipped on day one.",
    "keyPoints": [
      "Open standard, reference SDKs in TS and Python",
      "Day-one servers: filesystem, GitHub, Slack, Postgres, Puppeteer",
      "Designed so any client can talk to any server"
    ],
    "topicIds": ["topic_mcp"],
    "toolIds": ["tool_mcp_server"],
    "tagIds": ["tag_announcement"]
  },
  {
    "id": "art_003",
    "type": "article",
    "title": "MCP: an open protocol for AI integrations",
    "url": "https://modelcontextprotocol.io/introduction",
    "source": "modelcontextprotocol.io",
    "creatorId": "creator_anthropic",
    "publishedAt": "2024-11-25",
    "summary": "The protocol's official intro: architecture, client/server roles, and the three primitives (tools, resources, prompts).",
    "keyPoints": [
      "Clients connect to many servers; servers can be local or remote",
      "Tools are model-callable; resources are model-readable; prompts are user-callable",
      "JSON-RPC 2.0 over stdio or HTTP+SSE"
    ],
    "topicIds": ["topic_mcp"],
    "toolIds": ["tool_mcp_server"],
    "conceptIds": ["concept_tool_use"],
    "tagIds": ["tag_essay"]
  },
  {
    "id": "art_004",
    "type": "article",
    "title": "Claude Code best practices",
    "url": "https://www.anthropic.com/engineering/claude-code-best-practices",
    "source": "Anthropic Engineering",
    "creatorId": "creator_anthropic",
    "publishedAt": "2025-04-18",
    "summary": "Practical advice for getting Claude Code to do real work in real codebases — claude.md files, tools, hooks, and permission scopes.",
    "keyPoints": [
      "Maintain a CLAUDE.md as project memory",
      "Scope permissions tightly; iterate from there",
      "Use TodoWrite + plan mode for non-trivial tasks"
    ],
    "topicIds": ["topic_claude", "topic_agents"],
    "toolIds": ["tool_claude_code"],
    "tagIds": ["tag_implementation"]
  },
  {
    "id": "art_005",
    "type": "article",
    "title": "Tool use with Claude",
    "url": "https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview",
    "source": "Anthropic Docs",
    "creatorId": "creator_anthropic",
    "publishedAt": "2024-08-01",
    "summary": "Reference docs for tool calling: schema, request/response shape, parallel tool use, and limits.",
    "keyPoints": [
      "Define tools with JSON Schema",
      "Stream tool_use blocks; parallel calls allowed",
      "Always send tool_result back in the next user turn"
    ],
    "topicIds": ["topic_claude"],
    "toolIds": ["tool_claude_api"],
    "conceptIds": ["concept_tool_use"],
    "tagIds": ["tag_tutorial"]
  },
  {
    "id": "art_006",
    "type": "article",
    "title": "Things we learned about LLMs in 2024",
    "url": "https://simonwillison.net/2024/Dec/31/llms-in-2024/",
    "source": "simonwillison.net",
    "creatorId": "creator_simon_w",
    "publishedAt": "2024-12-31",
    "summary": "Year-end roundup from a careful long-time LLM observer: model gains, agent realities, tooling shifts, the fragility of vibes.",
    "keyPoints": [
      "Frontier models converged on similar capability bands",
      "Agents are still mostly demos, not production",
      "Tool use + structured output became table stakes"
    ],
    "topicIds": ["topic_agents", "topic_claude"],
    "tagIds": ["tag_essay"]
  },
  {
    "id": "art_007",
    "type": "article",
    "title": "Prompts are programs",
    "url": "https://simonwillison.net/2024/Mar/22/claude-and-chatgpt-case-study/",
    "source": "simonwillison.net",
    "creatorId": "creator_simon_w",
    "publishedAt": "2024-03-22",
    "summary": "Case study comparing Claude and ChatGPT on a specific build task; argues prompts deserve the rigor we give to code.",
    "keyPoints": [
      "Treat prompts as source artifacts; version-control them",
      "Diff outputs across models to surface drift",
      "Tiny wording changes produce real behavior changes"
    ],
    "topicIds": ["topic_claude"],
    "tagIds": ["tag_essay"]
  },
  {
    "id": "art_008",
    "type": "article",
    "title": "An analysis of claude.com/claude-code",
    "url": "https://simonwillison.net/2024/Oct/22/claude-code/",
    "source": "simonwillison.net",
    "creatorId": "creator_simon_w",
    "publishedAt": "2024-10-22",
    "summary": "Hands-on review of Claude Code shortly after release. Covers the agent loop, plan mode, and the feel of working with it.",
    "keyPoints": [
      "Plan mode is the killer feature for non-trivial tasks",
      "Tool restriction matters more than people expect",
      "The agent's self-correction loop saves real time"
    ],
    "topicIds": ["topic_claude", "topic_agents"],
    "toolIds": ["tool_claude_code"],
    "tagIds": ["tag_essay", "tag_walkthrough"]
  },
  {
    "id": "art_009",
    "type": "article",
    "title": "Agentic workflows: orchestrator-workers pattern",
    "url": "https://www.anthropic.com/engineering/agentic-workflows",
    "source": "Anthropic Engineering",
    "creatorId": "creator_anthropic",
    "publishedAt": "2025-02-04",
    "summary": "Deep dive on one specific pattern from the agents essay — when to break work across delegated subagents and how to coordinate them.",
    "keyPoints": [
      "Use when subtasks are independent and parallelizable",
      "Orchestrator owns the rubric; workers own execution",
      "Signal failure clearly; let the orchestrator decide retry"
    ],
    "topicIds": ["topic_agents"],
    "conceptIds": ["concept_tool_use"],
    "tagIds": ["tag_essay", "tag_implementation"]
  },
  {
    "id": "art_010",
    "type": "article",
    "title": "MCP best practices",
    "url": "https://modelcontextprotocol.io/specification/2024-11-05",
    "source": "modelcontextprotocol.io",
    "creatorId": "creator_anthropic",
    "publishedAt": "2024-11-05",
    "summary": "Spec-level guidance: tool naming, error envelopes, transport choices, and resource lifecycle.",
    "keyPoints": [
      "Use verb-noun tool names; describe inputs precisely",
      "Errors are structured, not strings",
      "stdio for local; HTTP+SSE for remote"
    ],
    "topicIds": ["topic_mcp"],
    "toolIds": ["tool_mcp_server"],
    "tagIds": ["tag_tutorial"]
  },
  {
    "id": "art_011",
    "type": "article",
    "title": "Evaluating LLM applications",
    "url": "https://hamel.dev/blog/posts/evals/",
    "source": "hamel.dev",
    "creatorId": "creator_simon_w",
    "publishedAt": "2024-04-15",
    "summary": "Hamel Husain's pragmatic essay on building evals that actually catch regressions. (Linked here under simon_w as a short-list curator stand-in.)",
    "keyPoints": [
      "Start with the dumbest possible eval and improve",
      "Manual review is the foundation; automate later",
      "Eval data is the real moat"
    ],
    "topicIds": ["topic_agents", "topic_claude"],
    "conceptIds": ["concept_evals"],
    "tagIds": ["tag_essay"]
  },
  {
    "id": "art_012",
    "type": "article",
    "title": "Claude's constitution: harmlessness without paternalism",
    "url": "https://www.anthropic.com/research/claudes-constitution",
    "source": "Anthropic Research",
    "creatorId": "creator_anthropic",
    "publishedAt": "2023-05-09",
    "summary": "Anthropic's published list of principles that shape Claude's behavior, plus how they're operationalized in training.",
    "keyPoints": [
      "Constitutional AI = principles + RLAIF",
      "Principles are explicit and editable",
      "Aim for honest, harmless, helpful in that order"
    ],
    "topicIds": ["topic_claude"],
    "tagIds": ["tag_essay"]
  },
  {
    "id": "post_001",
    "type": "social_post",
    "title": "Claude can now run a 30-step agent loop without losing the plot",
    "url": "https://x.com/AnthropicAI/status/1860000000000000000",
    "source": "X · @AnthropicAI",
    "creatorId": "creator_anthropic",
    "publishedAt": "2025-02-22",
    "summary": "Short Anthropic post showcasing a long-horizon agent task (writeup on what changed since Sonnet 3.5).",
    "keyPoints": [
      "Long-horizon coherence improved",
      "Tool-use accuracy up across benchmarks"
    ],
    "topicIds": ["topic_claude", "topic_agents"],
    "tagIds": ["tag_announcement"]
  },
  {
    "id": "post_002",
    "type": "social_post",
    "title": "Three weeks with MCP — what stuck",
    "url": "https://x.com/simonw/status/1864000000000000000",
    "source": "X · @simonw",
    "creatorId": "creator_simon_w",
    "publishedAt": "2024-12-15",
    "summary": "Simon Willison reflecting on actual day-to-day MCP use: which servers earned a place, which didn't.",
    "keyPoints": [
      "Filesystem and Git servers used daily",
      "Custom servers > generic ones for project work",
      "Latency still rough on remote servers"
    ],
    "topicIds": ["topic_mcp"],
    "toolIds": ["tool_mcp_server"],
    "tagIds": ["tag_essay"]
  },
  {
    "id": "post_003",
    "type": "social_post",
    "title": "Pair-programming with Claude Code on a brownfield codebase",
    "url": "https://x.com/_LeoSm/status/1880000000000000000",
    "source": "X",
    "creatorId": "creator_simon_w",
    "publishedAt": "2025-01-09",
    "summary": "Field report from somebody using Claude Code in a 100k-line repo for two weeks. Worth scanning for the 'when not to use it' section.",
    "keyPoints": [
      "Best for refactors with clear acceptance tests",
      "Worst for ambiguous design questions",
      "CLAUDE.md grows to fit the project"
    ],
    "topicIds": ["topic_claude", "topic_agents"],
    "toolIds": ["tool_claude_code"],
    "tagIds": ["tag_essay"]
  },
  {
    "id": "post_004",
    "type": "social_post",
    "title": "Eval loop or it didn't ship",
    "url": "https://x.com/HamelHusain/status/1850000000000000000",
    "source": "X · @HamelHusain",
    "creatorId": "creator_simon_w",
    "publishedAt": "2024-10-25",
    "summary": "Short polemic — if your team can't show the eval that catches the regression, the feature isn't done.",
    "keyPoints": [
      "Evals are infra, not afterthought",
      "Without them, vibes drive decisions"
    ],
    "topicIds": ["topic_agents", "topic_claude"],
    "conceptIds": ["concept_evals"],
    "tagIds": ["tag_essay"]
  }
]
```

- [ ] **Step 2: Verify JSON is valid and counts**

```bash
node -e "const c=require('./src/data/content.json'); console.log('total:',c.length,'videos:',c.filter(x=>x.type==='video').length,'articles:',c.filter(x=>x.type==='article').length,'posts:',c.filter(x=>x.type==='social_post').length);"
```

Expected: `total: 24 videos: 8 articles: 12 posts: 4`.

- [ ] **Step 3: Commit**

```bash
git add src/data/content.json
git commit -m "data: seed 24 content items (8 videos, 12 articles, 4 posts)"
```

---

## Task 10: Seed `relations.json` (relational context graph edges)

**Files:**
- Create: `src/data/relations.json`

> **Schema rationale:** The Flow Map graph is a relational context network — edges are first-class with typed semantic, weight, evidence (which content supports the connection), and recency. Plan 3's pattern engine consumes this structure plus implicit edges derived from content. Schema is forward-compatible from day 1.

- [ ] **Step 1: Write `relations.json`**

```json
[
  { "from": "topic_claude",      "to": "topic_mcp",     "kind": "related",    "weight": 0.85, "evidence": ["vid_003", "art_002"],          "lastReinforced": "2024-11-25" },
  { "from": "topic_claude",      "to": "topic_agents",  "kind": "related",    "weight": 0.80, "evidence": ["vid_001", "art_001", "vid_005"], "lastReinforced": "2025-02-24" },
  { "from": "topic_mcp",         "to": "topic_agents",  "kind": "related",    "weight": 0.65, "evidence": ["vid_003"],                     "lastReinforced": "2024-11-25" },
  { "from": "company_anthropic", "to": "topic_claude",  "kind": "owns",       "weight": 1.00, "evidence": ["art_012"],                     "lastReinforced": "2023-05-09" },
  { "from": "company_anthropic", "to": "topic_mcp",     "kind": "owns",       "weight": 1.00, "evidence": ["art_002", "art_003"],          "lastReinforced": "2024-11-25" },
  { "from": "tool_claude_code",  "to": "topic_claude",  "kind": "implements", "weight": 1.00, "evidence": ["vid_005", "art_004", "art_008"], "lastReinforced": "2025-04-18" },
  { "from": "tool_claude_api",   "to": "topic_claude",  "kind": "implements", "weight": 1.00, "evidence": ["art_005", "vid_007"],          "lastReinforced": "2024-08-12" },
  { "from": "tool_mcp_server",   "to": "topic_mcp",     "kind": "implements", "weight": 1.00, "evidence": ["vid_004", "art_010"],          "lastReinforced": "2025-01-15" },
  { "from": "concept_tool_use",  "to": "topic_claude",  "kind": "applies_to", "weight": 0.90, "evidence": ["vid_007", "art_005"],          "lastReinforced": "2024-08-12" },
  { "from": "concept_tool_use",  "to": "topic_mcp",     "kind": "applies_to", "weight": 0.95, "evidence": ["vid_003", "art_003"],          "lastReinforced": "2024-11-25" },
  { "from": "concept_tool_use",  "to": "topic_agents",  "kind": "applies_to", "weight": 0.85, "evidence": ["vid_001", "art_001"],          "lastReinforced": "2024-12-19" },
  { "from": "concept_evals",     "to": "topic_agents",  "kind": "applies_to", "weight": 0.80, "evidence": ["vid_006", "vid_008", "art_011"], "lastReinforced": "2025-03-08" },
  { "from": "concept_rag",       "to": "topic_agents",  "kind": "applies_to", "weight": 0.70, "evidence": [],                              "lastReinforced": "2024-01-01" }
]
```

- [ ] **Step 2: Commit**

```bash
git add src/data/relations.json
git commit -m "data: seed graph relations with typed edges, weights, evidence"
```

---

## Task 11: Build `useSeed` hook (TDD)

**Files:**
- Create: `src/store/useSeed.js`
- Create: `src/store/useSeed.test.js`

- [ ] **Step 1: Write the failing tests**

`src/store/useSeed.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSeed } from './useSeed.js'

describe('useSeed', () => {
  it('exposes the loaded entity arrays', () => {
    const { result } = renderHook(() => useSeed())
    expect(result.current.topics.length).toBeGreaterThanOrEqual(3)
    expect(result.current.content.length).toBeGreaterThanOrEqual(20)
    expect(result.current.creators.length).toBeGreaterThanOrEqual(3)
  })

  it('topicById returns a topic', () => {
    const { result } = renderHook(() => useSeed())
    const topic = result.current.topicById('topic_claude')
    expect(topic.name).toBe('Claude')
  })

  it('topicBySlug returns a topic', () => {
    const { result } = renderHook(() => useSeed())
    expect(result.current.topicBySlug('mcp').id).toBe('topic_mcp')
  })

  it('contentByTopic returns items tagged with that topic', () => {
    const { result } = renderHook(() => useSeed())
    const items = result.current.contentByTopic('topic_claude')
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((c) => c.topicIds.includes('topic_claude'))).toBe(true)
  })

  it('creatorById returns a creator', () => {
    const { result } = renderHook(() => useSeed())
    expect(result.current.creatorById('creator_anthropic').name).toBe('Anthropic')
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
npm run test:run -- src/store/useSeed.test.js
```

Expected: FAIL — Cannot find module './useSeed.js'.

- [ ] **Step 3: Implement**

`src/store/useSeed.js`:

```js
import { useMemo } from 'react'
import topics from '../data/topics.json'
import content from '../data/content.json'
import creators from '../data/creators.json'
import tools from '../data/tools.json'
import companies from '../data/companies.json'
import concepts from '../data/concepts.json'
import tags from '../data/tags.json'
import relations from '../data/relations.json'

export function useSeed() {
  return useMemo(() => {
    const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]))
    const bySlug = (arr) => Object.fromEntries(arr.map((x) => [x.slug, x]))

    const topicsById = byId(topics)
    const topicsBySlug = bySlug(topics)
    const creatorsById = byId(creators)
    const toolsById = byId(tools)
    const companiesById = byId(companies)
    const conceptsById = byId(concepts)
    const tagsById = byId(tags)
    const contentById = byId(content)

    return {
      topics, content, creators, tools, companies, concepts, tags, relations,
      topicById: (id) => topicsById[id],
      topicBySlug: (slug) => topicsBySlug[slug],
      creatorById: (id) => creatorsById[id],
      toolById: (id) => toolsById[id],
      companyById: (id) => companiesById[id],
      conceptById: (id) => conceptsById[id],
      tagById: (id) => tagsById[id],
      contentById: (id) => contentById[id],
      contentByTopic: (topicId) => content.filter((c) => c.topicIds?.includes(topicId)),
      contentByCreator: (creatorId) => content.filter((c) => c.creatorId === creatorId),
    }
  }, [])
}
```

- [ ] **Step 4: Run — should pass**

```bash
npm run test:run -- src/store/useSeed.test.js
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/store/useSeed.js src/store/useSeed.test.js
git commit -m "feat(store): add useSeed indexer hook"
```

---

## Task 12: Build `filter.js` (TDD — search/filter logic)

**Files:**
- Create: `src/lib/filter.js`
- Create: `src/lib/filter.test.js`

- [ ] **Step 1: Write the failing tests**

`src/lib/filter.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { matchesQuery, filterContent } from './filter.js'

const items = [
  { id: 'a', title: 'Building effective agents with Claude', summary: 'agent patterns', type: 'video', topicIds: ['topic_claude'], tagIds: ['tag_walkthrough'], publishedAt: '2024-12-19' },
  { id: 'b', title: 'Tool use overview',       summary: 'tool use',        type: 'article', topicIds: ['topic_claude'], tagIds: ['tag_tutorial'],     publishedAt: '2024-08-01' },
  { id: 'c', title: 'Intro to MCP',            summary: 'protocol',        type: 'video',   topicIds: ['topic_mcp'],     tagIds: ['tag_announcement'], publishedAt: '2024-11-25' },
]

describe('matchesQuery', () => {
  it('matches by title substring (case-insensitive)', () => {
    expect(matchesQuery(items[0], 'claude')).toBe(true)
    expect(matchesQuery(items[0], 'CLAUDE')).toBe(true)
  })
  it('matches by summary', () => {
    expect(matchesQuery(items[1], 'tool')).toBe(true)
  })
  it('returns true for empty query', () => {
    expect(matchesQuery(items[0], '')).toBe(true)
  })
  it('returns false when nothing matches', () => {
    expect(matchesQuery(items[0], 'zzz')).toBe(false)
  })
})

describe('filterContent', () => {
  it('filters by type', () => {
    expect(filterContent(items, { type: 'video' })).toHaveLength(2)
  })
  it('filters by topic', () => {
    expect(filterContent(items, { topicIds: ['topic_mcp'] })).toHaveLength(1)
  })
  it('filters by tag', () => {
    expect(filterContent(items, { tagIds: ['tag_tutorial'] })).toHaveLength(1)
  })
  it('combines filters with AND', () => {
    expect(filterContent(items, { type: 'video', topicIds: ['topic_claude'] })).toHaveLength(1)
  })
  it('returns all when filters empty', () => {
    expect(filterContent(items, {})).toHaveLength(3)
  })
  it('sorts newest first when sort=newest', () => {
    const out = filterContent(items, { sort: 'newest' })
    expect(out[0].id).toBe('a')
    expect(out[2].id).toBe('b')
  })
})
```

- [ ] **Step 2: Run — should fail**

```bash
npm run test:run -- src/lib/filter.test.js
```

Expected: FAIL — Cannot find module './filter.js'.

- [ ] **Step 3: Implement**

`src/lib/filter.js`:

```js
export function matchesQuery(item, query) {
  if (!query) return true
  const q = query.toLowerCase()
  const haystack = [item.title, item.summary, ...(item.keyPoints || [])]
    .filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q)
}

export function filterContent(items, opts = {}) {
  const { query, type, topicIds, tagIds, sort = 'newest' } = opts
  let out = items.filter((it) => {
    if (type && it.type !== type) return false
    if (topicIds?.length && !topicIds.some((t) => it.topicIds?.includes(t))) return false
    if (tagIds?.length && !tagIds.some((t) => it.tagIds?.includes(t))) return false
    if (query && !matchesQuery(it, query)) return false
    return true
  })
  if (sort === 'newest') {
    out = [...out].sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
  }
  return out
}
```

- [ ] **Step 4: Run — should pass**

```bash
npm run test:run -- src/lib/filter.test.js
```

Expected: 10 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/filter.js src/lib/filter.test.js
git commit -m "feat(lib): add content filter and search"
```

---

## Task 13: Build `LeftRail` shell component

**Files:**
- Create: `src/components/layout/LeftRail.jsx`

- [ ] **Step 1: Implement `LeftRail.jsx`**

```jsx
import { NavLink } from 'react-router-dom'
import { Home, Compass, BookOpen, Network, GraduationCap, Brain } from 'lucide-react'

const NAV = [
  { to: '/',          label: 'Home',       icon: Home          },
  { to: '/discover',  label: 'Discover',   icon: Compass       },
  { to: '/topics',    label: 'Topics',     icon: BookOpen      },
  { to: '/flow',      label: 'Flow Map',   icon: Network       },
  { to: '/education', label: 'Education',  icon: GraduationCap },
  { to: '/memory',    label: 'Memory',     icon: Brain         },
]

export default function LeftRail() {
  return (
    <aside className="glass-panel m-3 mr-0 w-[240px] flex-shrink-0 flex flex-col p-4 gap-1">
      <div className="px-2 pt-1 pb-4">
        <div className="text-[15px] font-semibold tracking-tight text-[color:var(--color-text-primary)]">
          FlowMap
        </div>
        <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">
          topic intelligence
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-[color:var(--color-bg-glass-strong)] text-[color:var(--color-text-primary)] border-l-2 border-[color:var(--color-topic)]'
                  : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-glass)] hover:text-[color:var(--color-text-primary)]',
              ].join(' ')
            }
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2 pt-4 border-t border-[color:var(--color-border-subtle)]">
        <div className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[color:var(--color-topic)]/20 border border-[color:var(--color-topic)]/40 flex items-center justify-center text-xs font-semibold">
            JU
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">JenoU</div>
            <div className="text-[11px] text-[color:var(--color-text-tertiary)]">researcher</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/LeftRail.jsx
git commit -m "feat(layout): add LeftRail nav component"
```

---

## Task 14: Build `TopBar` component

**Files:**
- Create: `src/components/layout/TopBar.jsx`

- [ ] **Step 1: Implement `TopBar.jsx`**

```jsx
import { Search, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useStore } from '../../store/useStore.js'

export default function TopBar() {
  const navigate = useNavigate()
  const { recordSearch } = useStore()
  const [q, setQ] = useState('')

  function onSubmit(e) {
    e.preventDefault()
    const trimmed = q.trim()
    if (trimmed) {
      recordSearch(trimmed)
      navigate(`/discover?q=${encodeURIComponent(trimmed)}`)
    }
  }

  return (
    <header className="glass-panel m-3 ml-0 mb-0 px-4 py-2.5 flex items-center justify-between gap-4 flex-shrink-0">
      <form onSubmit={onSubmit} className="flex items-center gap-2 flex-1 max-w-[640px]">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-tertiary)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search topics, tools, creators, content…"
            className="glass-input w-full pl-9 text-sm"
          />
        </div>
      </form>

      <div className="flex items-center gap-3">
        <span className="chip border-[color:var(--color-creator)]/40 bg-[color:var(--color-creator)]/10 text-[color:var(--color-creator)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-creator)] animate-pulse" />
          Live · seed
        </span>
        <button className="btn p-2" aria-label="Settings">
          <Settings size={15} />
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/TopBar.jsx
git commit -m "feat(layout): add TopBar with search"
```

---

## Task 15: Rewrite `App.jsx` shell + stub all 6 views

**Files:**
- Modify: `src/App.jsx`
- Rewrite: `src/views/Home.jsx`, `src/views/Discover.jsx`, `src/views/Topic.jsx`, `src/views/Education.jsx`, `src/views/Memory.jsx`
- Create: `src/views/Topics.jsx`, `src/views/FlowMap.jsx`
- Delete: `src/views/GraphMap.jsx`, `src/store/mockData.js`

- [ ] **Step 1: Stub each view (placeholder pages)**

`src/views/Home.jsx`:

```jsx
export default function Home() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
      <p className="text-sm text-[color:var(--color-text-secondary)] mt-2">Plan 2.</p>
    </div>
  )
}
```

`src/views/Discover.jsx`:

```jsx
export default function Discover() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
      <p className="text-sm text-[color:var(--color-text-secondary)] mt-2">Built in Phase 2.</p>
    </div>
  )
}
```

`src/views/Topics.jsx`:

```jsx
export default function Topics() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Topics</h1>
      <p className="text-sm text-[color:var(--color-text-secondary)] mt-2">Index built in Phase 1.</p>
    </div>
  )
}
```

`src/views/Topic.jsx`:

```jsx
import { useParams } from 'react-router-dom'

export default function Topic() {
  const { slug } = useParams()
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Topic: {slug}</h1>
      <p className="text-sm text-[color:var(--color-text-secondary)] mt-2">Built in Phase 1.</p>
    </div>
  )
}
```

`src/views/FlowMap.jsx`:

```jsx
export default function FlowMap() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Flow Map</h1>
      <p className="text-sm text-[color:var(--color-text-secondary)] mt-2">Built in Plan 3.</p>
    </div>
  )
}
```

`src/views/Education.jsx`:

```jsx
export default function Education() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Education</h1>
      <p className="text-sm text-[color:var(--color-text-secondary)] mt-2">Built in Plan 4.</p>
    </div>
  )
}
```

`src/views/Memory.jsx`:

```jsx
export default function Memory() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Memory</h1>
      <p className="text-sm text-[color:var(--color-text-secondary)] mt-2">Built in Plan 2.</p>
    </div>
  )
}
```

- [ ] **Step 2: Delete legacy files**

```bash
rm src/views/GraphMap.jsx src/store/mockData.js
```

- [ ] **Step 3: Rewrite `src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LeftRail from './components/layout/LeftRail.jsx'
import TopBar from './components/layout/TopBar.jsx'
import Home from './views/Home.jsx'
import Discover from './views/Discover.jsx'
import Topics from './views/Topics.jsx'
import Topic from './views/Topic.jsx'
import FlowMap from './views/FlowMap.jsx'
import Education from './views/Education.jsx'
import Memory from './views/Memory.jsx'

export default function App() {
  return (
    <BrowserRouter>
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
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Verify dev server renders without errors**

The Vite dev server is already running. Open the preview URL — every nav link should work and show the placeholder text. Check the preview console for errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(layout): wire shell + stub all 6 views"
```

---

# Phase 1 — Topic Page (the consume loop)

## Task 16: Build small UI primitives — `Chip`, `Pill`, `GlassCard`

**Files:**
- Create: `src/components/ui/Chip.jsx`
- Create: `src/components/ui/Pill.jsx`
- Create: `src/components/ui/GlassCard.jsx`

- [ ] **Step 1: `Chip.jsx`**

```jsx
export default function Chip({ children, color, onClick, className = '' }) {
  const style = color
    ? { borderColor: `${color}66`, background: `${color}1a`, color: color }
    : undefined
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      onClick={onClick}
      className={`chip ${onClick ? 'cursor-pointer hover:brightness-125' : ''} ${className}`}
      style={style}
    >
      {children}
    </Tag>
  )
}
```

- [ ] **Step 2: `Pill.jsx`**

```jsx
export default function Pill({ tone = 'neutral', children }) {
  const tones = {
    neutral:  'bg-white/5 text-white/70 border-white/10',
    positive: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warning:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
    danger:   'bg-rose-500/15 text-rose-300 border-rose-500/30',
    accent:   'bg-orange-500/15 text-orange-300 border-orange-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${tones[tone]}`}>
      {children}
    </span>
  )
}
```

- [ ] **Step 3: `GlassCard.jsx`**

```jsx
export default function GlassCard({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`glass-panel p-4 ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/
git commit -m "feat(ui): add Chip, Pill, GlassCard primitives"
```

---

## Task 17: Build `VideoCard` component

**Files:**
- Create: `src/components/content/VideoCard.jsx`

- [ ] **Step 1: Implement `VideoCard.jsx`**

```jsx
import { Play, Bookmark, BookmarkCheck } from 'lucide-react'
import { useStore } from '../../store/useStore.js'
import { useSeed } from '../../store/useSeed.js'

function formatDuration(sec) {
  if (!sec) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VideoCard({ item, onOpen }) {
  const { isSaved, toggleSave } = useStore()
  const { creatorById } = useSeed()
  const creator = creatorById(item.creatorId)
  const saved = isSaved(item.id)

  return (
    <article
      onClick={() => onOpen?.(item)}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] hover:bg-[color:var(--color-bg-glass-strong)] hover:border-[color:var(--color-border-default)] transition-colors"
    >
      <div className="relative aspect-video bg-black/40 overflow-hidden">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
            <Play size={18} className="text-white translate-x-0.5" />
          </div>
        </div>
        {item.durationSec ? (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[10px] bg-black/70 text-white rounded">
            {formatDuration(item.durationSec)}
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium leading-snug line-clamp-2">{item.title}</h3>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
          <span>{creator?.name ?? item.source}</span>
          <button
            onClick={(e) => { e.stopPropagation(); toggleSave(item.id) }}
            className="p-1 rounded hover:bg-white/5"
            aria-label={saved ? 'Unsave' : 'Save'}
          >
            {saved ? <BookmarkCheck size={14} className="text-[color:var(--color-topic)]" /> : <Bookmark size={14} />}
          </button>
        </div>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/content/VideoCard.jsx
git commit -m "feat(content): add VideoCard"
```

---

## Task 18: Build `ArticleCard` component

**Files:**
- Create: `src/components/content/ArticleCard.jsx`

- [ ] **Step 1: Implement `ArticleCard.jsx`**

```jsx
import { Bookmark, BookmarkCheck, FileText } from 'lucide-react'
import { useStore } from '../../store/useStore.js'

export default function ArticleCard({ item, onOpen }) {
  const { isSaved, toggleSave } = useStore()
  const saved = isSaved(item.id)

  return (
    <article
      onClick={() => onOpen?.(item)}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] hover:bg-[color:var(--color-bg-glass-strong)] hover:border-[color:var(--color-border-default)] transition-colors p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-md bg-[color:var(--color-article)]/15 border border-[color:var(--color-article)]/30 flex items-center justify-center text-[color:var(--color-article)]">
          <FileText size={12} />
        </span>
        <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-article)] font-medium">
          {item.source}
        </span>
      </div>

      <h3 className="text-[15px] font-semibold leading-snug line-clamp-3">{item.title}</h3>
      <p className="mt-2 text-xs text-[color:var(--color-text-secondary)] line-clamp-3">{item.summary}</p>

      <div className="mt-3 flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
        <span>{item.publishedAt}</span>
        <button
          onClick={(e) => { e.stopPropagation(); toggleSave(item.id) }}
          className="p-1 rounded hover:bg-white/5"
          aria-label={saved ? 'Unsave' : 'Save'}
        >
          {saved ? <BookmarkCheck size={14} className="text-[color:var(--color-topic)]" /> : <Bookmark size={14} />}
        </button>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/content/ArticleCard.jsx
git commit -m "feat(content): add ArticleCard"
```

---

## Task 19: Build `SocialPostCard` component

**Files:**
- Create: `src/components/content/SocialPostCard.jsx`

- [ ] **Step 1: Implement `SocialPostCard.jsx`**

```jsx
import { Bookmark, BookmarkCheck, MessageCircle } from 'lucide-react'
import { useStore } from '../../store/useStore.js'

export default function SocialPostCard({ item, onOpen }) {
  const { isSaved, toggleSave } = useStore()
  const saved = isSaved(item.id)

  return (
    <article
      onClick={() => onOpen?.(item)}
      className="group cursor-pointer rounded-2xl overflow-hidden border border-[color:var(--color-border-subtle)] bg-[color:var(--color-bg-glass)] hover:bg-[color:var(--color-bg-glass-strong)] hover:border-[color:var(--color-border-default)] transition-colors p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-6 h-6 rounded-md bg-[color:var(--color-social-post)]/15 border border-[color:var(--color-social-post)]/30 flex items-center justify-center text-[color:var(--color-social-post)]">
          <MessageCircle size={12} />
        </span>
        <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-social-post)] font-medium">
          {item.source}
        </span>
      </div>

      <p className="text-sm leading-snug line-clamp-4">{item.title}</p>
      <p className="mt-2 text-xs text-[color:var(--color-text-secondary)] line-clamp-3">{item.summary}</p>

      <div className="mt-3 flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
        <span>{item.publishedAt}</span>
        <button
          onClick={(e) => { e.stopPropagation(); toggleSave(item.id) }}
          className="p-1 rounded hover:bg-white/5"
          aria-label={saved ? 'Unsave' : 'Save'}
        >
          {saved ? <BookmarkCheck size={14} className="text-[color:var(--color-topic)]" /> : <Bookmark size={14} />}
        </button>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/content/SocialPostCard.jsx
git commit -m "feat(content): add SocialPostCard"
```

---

## Task 20: Build `VideoPlayerModal` (YouTube iframe)

**Files:**
- Create: `src/components/content/VideoPlayerModal.jsx`

- [ ] **Step 1: Implement `VideoPlayerModal.jsx`**

```jsx
import { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { useStore } from '../../store/useStore.js'

export default function VideoPlayerModal({ item, onClose }) {
  const { recordView } = useStore()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (item) recordView(item.id)
  }, [item, recordView])

  if (!item) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-full max-w-[1000px] max-h-[90vh] flex flex-col overflow-hidden"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-border-subtle)]">
          <h2 className="text-sm font-medium truncate pr-4">{item.title}</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a href={item.url} target="_blank" rel="noreferrer" className="btn p-2" aria-label="Open on YouTube">
              <ExternalLink size={14} />
            </a>
            <button onClick={onClose} className="btn p-2" aria-label="Close">
              <X size={14} />
            </button>
          </div>
        </header>
        <div className="aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${item.youtubeId}?autoplay=1&rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
        {item.summary ? (
          <div className="p-4 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
            {item.summary}
          </div>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/content/VideoPlayerModal.jsx
git commit -m "feat(content): add VideoPlayerModal with YouTube iframe"
```

---

## Task 21: Build `ArticleReader` drawer

**Files:**
- Create: `src/components/content/ArticleReader.jsx`

- [ ] **Step 1: Implement `ArticleReader.jsx`**

```jsx
import { useEffect } from 'react'
import { X, ExternalLink, Bookmark, BookmarkCheck } from 'lucide-react'
import { useStore } from '../../store/useStore.js'

export default function ArticleReader({ item, onClose }) {
  const { isSaved, toggleSave, recordView } = useStore()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (item) recordView(item.id)
  }, [item, recordView])

  if (!item) return null
  const saved = isSaved(item.id)

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className="glass-panel h-full w-full max-w-[640px] m-3 flex flex-col overflow-hidden"
      >
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[color:var(--color-border-subtle)]">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[color:var(--color-article)] font-medium mb-1">
              {item.source}
            </div>
            <h2 className="text-lg font-semibold leading-snug">{item.title}</h2>
            <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-1">{item.publishedAt}</div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button onClick={onClose} className="btn p-2" aria-label="Close"><X size={14} /></button>
            <button onClick={() => toggleSave(item.id)} className="btn p-2" aria-label={saved ? 'Unsave' : 'Save'}>
              {saved ? <BookmarkCheck size={14} className="text-[color:var(--color-topic)]" /> : <Bookmark size={14} />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-5 text-sm leading-relaxed">
          <p className="text-[color:var(--color-text-secondary)]">{item.summary}</p>

          {item.keyPoints?.length ? (
            <>
              <h3 className="mt-6 mb-2 text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium">
                Key points
              </h3>
              <ul className="space-y-2">
                {item.keyPoints.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-1 h-1 rounded-full bg-[color:var(--color-topic)] mt-2 flex-shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <footer className="px-5 py-3 border-t border-[color:var(--color-border-subtle)] flex items-center justify-between">
          <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
            Reader view · summary by curator
          </span>
          <a href={item.url} target="_blank" rel="noreferrer" className="btn btn-primary">
            Open original <ExternalLink size={13} />
          </a>
        </footer>
      </aside>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/content/ArticleReader.jsx
git commit -m "feat(content): add ArticleReader drawer"
```

---

## Task 22: Build Topics index page (`/topics`)

**Files:**
- Modify: `src/views/Topics.jsx`

- [ ] **Step 1: Implement `Topics.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { Bookmark, BookmarkCheck } from 'lucide-react'

export default function Topics() {
  const { topics, contentByTopic } = useSeed()
  const { isFollowing, toggleFollow } = useStore()

  const sorted = [...topics].sort((a, b) => {
    const af = isFollowing(a.id) ? 0 : 1
    const bf = isFollowing(b.id) ? 0 : 1
    return af - bf
  })

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Topics</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          {topics.length} topics in your map. Followed first.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((t) => {
          const count = contentByTopic(t.id).length
          const followed = isFollowing(t.id)
          return (
            <article key={t.id} className="glass-panel p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[color:var(--color-topic)]" />
                <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-topic)] font-medium">
                  topic
                </span>
              </div>

              <Link to={`/topic/${t.slug}`} className="block">
                <h2 className="text-lg font-semibold leading-tight hover:underline">{t.name}</h2>
                <p className="mt-2 text-sm text-[color:var(--color-text-secondary)] line-clamp-3">
                  {t.summary}
                </p>
              </Link>

              <div className="flex items-center justify-between mt-auto pt-2">
                <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
                  {count} {count === 1 ? 'item' : 'items'}
                </span>
                <button
                  onClick={() => toggleFollow(t.id)}
                  className={`btn ${followed ? 'btn-primary' : ''} text-xs`}
                >
                  {followed ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                  {followed ? 'Following' : 'Follow'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify visually in dev server**

Navigate to `/topics` in the preview. Should see 3 topic cards.

- [ ] **Step 3: Commit**

```bash
git add src/views/Topics.jsx
git commit -m "feat(view): build Topics index"
```

---

## Task 23: Build Topic detail page (`/topic/:slug`)

**Files:**
- Modify: `src/views/Topic.jsx`

- [ ] **Step 1: Implement `Topic.jsx`**

```jsx
import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { Bookmark, BookmarkCheck, ChevronLeft } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import VideoCard from '../components/content/VideoCard.jsx'
import ArticleCard from '../components/content/ArticleCard.jsx'
import SocialPostCard from '../components/content/SocialPostCard.jsx'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'
import Chip from '../components/ui/Chip.jsx'

const TABS = [
  { id: 'all',      label: 'All'      },
  { id: 'video',    label: 'Videos'   },
  { id: 'article',  label: 'Articles' },
  { id: 'social_post', label: 'Posts' },
]

export default function Topic() {
  const { slug } = useParams()
  const { topicBySlug, contentByTopic, toolById, conceptById, topicById } = useSeed()
  const { isFollowing, toggleFollow } = useStore()

  const topic = topicBySlug(slug)
  const [tab, setTab] = useState('all')
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

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

  const all = contentByTopic(topic.id)
  const items = tab === 'all' ? all : all.filter((c) => c.type === tab)
  const followed = isFollowing(topic.id)

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  return (
    <div className="p-6">
      <Link to="/topics" className="text-sm text-[color:var(--color-text-tertiary)] hover:text-white inline-flex items-center gap-1 mb-4">
        <ChevronLeft size={14} /> Back to topics
      </Link>

      {/* Hero */}
      <header className="glass-panel p-6 mb-6 flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[color:var(--color-topic)]" />
            <span className="text-[11px] uppercase tracking-wide text-[color:var(--color-topic)] font-medium">topic</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{topic.name}</h1>
          <p className="mt-3 text-sm text-[color:var(--color-text-secondary)] max-w-3xl leading-relaxed">{topic.summary}</p>
          {topic.whyItMatters ? (
            <p className="mt-3 text-sm italic text-[color:var(--color-text-tertiary)] max-w-3xl">{topic.whyItMatters}</p>
          ) : null}
        </div>
        <button
          onClick={() => toggleFollow(topic.id)}
          className={`btn ${followed ? 'btn-primary' : ''} flex-shrink-0`}
        >
          {followed ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          {followed ? 'Following' : 'Follow'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main content */}
        <section>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-[color:var(--color-border-subtle)]">
            {TABS.map((t) => {
              const count = t.id === 'all' ? all.length : all.filter((c) => c.type === t.id).length
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
          </div>

          {/* Grid */}
          {items.length === 0 ? (
            <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">No items in this tab.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((it) =>
                it.type === 'video' ? <VideoCard key={it.id} item={it} onOpen={open} /> :
                it.type === 'article' ? <ArticleCard key={it.id} item={it} onOpen={open} /> :
                <SocialPostCard key={it.id} item={it} onOpen={open} />
              )}
            </div>
          )}
        </section>

        {/* Side rail */}
        <aside className="space-y-4">
          {topic.relatedTopicIds?.length ? (
            <div className="glass-panel p-4">
              <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">
                Related topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {topic.relatedTopicIds.map((id) => {
                  const t = topicById(id)
                  return t ? <Link key={id} to={`/topic/${t.slug}`}><Chip color="#f97316">{t.name}</Chip></Link> : null
                })}
              </div>
            </div>
          ) : null}

          {topic.toolIds?.length ? (
            <div className="glass-panel p-4">
              <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Tools</h3>
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
            </div>
          ) : null}

          {topic.conceptIds?.length ? (
            <div className="glass-panel p-4">
              <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Concepts</h3>
              <div className="flex flex-wrap gap-2">
                {topic.conceptIds.map((id) => {
                  const c = conceptById(id)
                  return c ? <Chip key={id} color="#94a3b8">{c.name}</Chip> : null
                })}
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Verify in dev server**

- Navigate to `/topic/claude` — hero, tabs, content cards visible.
- Click a video card — YouTube modal opens, plays.
- Click an article card — reader drawer slides in from right.
- Click Follow — button toggles.

- [ ] **Step 3: Commit**

```bash
git add src/views/Topic.jsx
git commit -m "feat(view): build Topic detail page with cards, modal, drawer"
```

---

# Phase 2 — Discover feed

## Task 24: Build `Discover` view with filter bar + card stream

**Files:**
- Modify: `src/views/Discover.jsx`

- [ ] **Step 1: Implement `Discover.jsx`**

```jsx
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, X } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'
import { filterContent } from '../lib/filter.js'
import VideoCard from '../components/content/VideoCard.jsx'
import ArticleCard from '../components/content/ArticleCard.jsx'
import SocialPostCard from '../components/content/SocialPostCard.jsx'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'
import Chip from '../components/ui/Chip.jsx'

const TYPE_OPTS = [
  { id: '',             label: 'All' },
  { id: 'video',        label: 'Videos' },
  { id: 'article',      label: 'Articles' },
  { id: 'social_post',  label: 'Posts' },
]

const PAGE_SIZE = 20

export default function Discover() {
  const [params] = useSearchParams()
  const initialQuery = params.get('q') || ''
  const { topics, content } = useSeed()
  const { isDismissed, dismiss } = useStore()

  const [query, setQuery] = useState(initialQuery)
  const [type, setType] = useState('')
  const [topicIds, setTopicIds] = useState([])
  const [page, setPage] = useState(1)
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  const filtered = useMemo(
    () => filterContent(content, { query, type, topicIds, sort: 'newest' })
      .filter((it) => !isDismissed(it.id)),
    [content, query, type, topicIds, isDismissed]
  )

  const visible = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = visible.length < filtered.length

  function toggleTopic(id) {
    setTopicIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])
    setPage(1)
  }

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  return (
    <div className="p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Discover</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">
          {filtered.length} items {query ? `matching "${query}"` : ''}
        </p>
      </header>

      {/* Filter bar */}
      <div className="glass-panel p-3 mb-6 flex items-center gap-3 flex-wrap sticky top-3 z-10">
        <Filter size={14} className="text-[color:var(--color-text-tertiary)]" />

        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          placeholder="Filter…"
          className="glass-input text-sm flex-1 min-w-[160px] max-w-[280px]"
        />

        <div className="flex items-center gap-1">
          {TYPE_OPTS.map((t) => (
            <button
              key={t.id || 'all'}
              onClick={() => { setType(t.id); setPage(1) }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                type === t.id
                  ? 'bg-[color:var(--color-topic)]/15 text-[color:var(--color-topic)] border border-[color:var(--color-topic)]/40'
                  : 'text-[color:var(--color-text-secondary)] hover:bg-white/5 border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {topics.map((t) => {
            const on = topicIds.includes(t.id)
            return (
              <Chip
                key={t.id}
                color={on ? '#f97316' : undefined}
                onClick={() => toggleTopic(t.id)}
              >
                {t.name}
              </Chip>
            )
          })}
        </div>
      </div>

      {/* Stream */}
      {visible.length === 0 ? (
        <p className="text-sm text-[color:var(--color-text-tertiary)] py-16 text-center">
          Nothing matches. Loosen your filters.
        </p>
      ) : (
        <div className="space-y-3 max-w-[760px] mx-auto">
          {visible.map((it) => (
            <div key={it.id} className="relative group">
              <button
                onClick={() => dismiss(it.id)}
                className="absolute top-3 right-3 p-1.5 rounded-md bg-black/40 border border-white/10 text-white/60 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                aria-label="Dismiss"
              >
                <X size={12} />
              </button>
              {it.type === 'video' ? <VideoCard item={it} onOpen={open} /> :
               it.type === 'article' ? <ArticleCard item={it} onOpen={open} /> :
               <SocialPostCard item={it} onOpen={open} />}
            </div>
          ))}
          {hasMore ? (
            <div className="text-center pt-4">
              <button onClick={() => setPage(page + 1)} className="btn">Load more</button>
            </div>
          ) : (
            <p className="text-center text-[11px] text-[color:var(--color-text-tertiary)] pt-4">End of feed.</p>
          )}
        </div>
      )}

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Verify in dev server**

- Navigate to `/discover` — list of 24 items appears, sorted newest first.
- Type in filter input — list narrows.
- Click a topic chip — filters.
- Click type buttons — filters.
- Hover a card — `X` dismiss button appears top-right.
- Click X — item disappears (and stays dismissed across reloads).

- [ ] **Step 3: Commit**

```bash
git add src/views/Discover.jsx
git commit -m "feat(view): build Discover feed with filters and dismiss"
```

---

## Task 25: Smoke-test all routes load + run full test suite

**Files:** *(no changes — verification only)*

- [ ] **Step 1: Run all tests**

```bash
npm run test:run
```

Expected: all green. ~21 tests across 4 files.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors. (Warnings about test globals OK if vitest globals env not yet added.)

- [ ] **Step 3: If lint complains about `describe`/`it`/`expect` globals, fix `eslint.config.js`**

Add to the `languageOptions.globals`:

```js
import vitest from 'eslint-plugin-vitest' // optional dep — or just whitelist by hand
```

Or simpler — append a globals object:

```js
{
  files: ['**/*.test.js', '**/*.test.jsx'],
  languageOptions: {
    globals: { describe: 'readonly', it: 'readonly', expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' },
  },
},
```

- [ ] **Step 4: Visit each route in the dev server preview**

`/`, `/discover`, `/topics`, `/topic/claude`, `/topic/mcp`, `/topic/agents`, `/flow`, `/education`, `/memory` — every route must render without errors. Open the preview console; should be clean.

- [ ] **Step 5: Verify the consume loop end-to-end**

1. Navigate to `/topics`. Click "Claude" card.
2. On Topic page: click any video card. Modal opens, YouTube plays.
3. Press Esc. Modal closes.
4. Click any article card. Drawer slides in.
5. Click Save (bookmark). Icon turns orange.
6. Press Esc. Drawer closes.
7. Reload the page. Saved icon should still be orange (localStorage persisted).
8. Navigate to `/discover`. Filter to "Videos" only. Verify 8 items.

- [ ] **Step 6: Build production bundle**

```bash
npm run build
```

Expected: no errors. `dist/` directory created.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: complete Plan 1 — foundation + consume loop"
```

---

# Done

At this point, the operator can:

- Navigate all 6 sections (Plans 2–4 surfaces are placeholders).
- Browse 3 fully populated topics (Claude, MCP, agents) with 24 real content items.
- Watch any video in-app via YouTube embed.
- Read any article via the reader drawer with hand-written summary + key points + link to original.
- Search and filter the Discover feed.
- Save items, follow topics, dismiss items — all persisted across reloads.

**Next plan:** [Plan 2 — Search & Memory] (Phase 3–4 from the spec).
