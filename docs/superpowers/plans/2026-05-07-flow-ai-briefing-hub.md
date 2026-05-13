# Flow AI Briefing Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent Briefs button to the app header that automatically generates and displays AI-synthesised Topic Briefs (triggered when 3+ new items are saved to a topic) and a daily AI News Digest from HN + Reddit.

**Architecture:** A pure-function trigger checker (`briefTrigger.js`) decides when to generate; two LLM-backed generators (`generateTopicBrief.js`, `generateNewsDigest.js`) produce structured JSON briefs; briefs are stored in the existing `useStore` singleton under `briefs`; UI is three new components (`BriefsDropdown`, `BriefModal`, `useDailyDigestCheck`) wired into the existing `TopBar`.

**Tech Stack:** React 18, Vite, Ollama (`chatJson` from `src/lib/llm/ollama.js`), HN Algolia proxy (`/api/hn`), Reddit proxy (`/api/reddit`), `createPortal` for dropdown + modal, `useSyncExternalStore` via existing `useStore` pattern, Vitest + jsdom for tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/store/useStore.js` | Add `briefs: {}` to EMPTY; add `addBrief`, `markBriefRead`, `markAllBriefsRead`; selectors `unreadBriefCount`, `allBriefsSorted` |
| Create | `src/store/__tests__/useBriefs.test.js` | Tests for brief store actions and selectors |
| Create | `src/lib/briefs/briefTrigger.js` | Pure functions: `newItemsSinceLastBrief`, `shouldGenerateTopicBrief` |
| Create | `src/lib/briefs/__tests__/briefTrigger.test.js` | Tests for trigger logic |
| Create | `src/lib/briefs/generateTopicBrief.js` | LLM call → structured Topic Brief JSON |
| Create | `src/lib/briefs/__tests__/generateTopicBrief.test.js` | Tests for generation (mocked LLM) |
| Create | `src/lib/briefs/fetchAiNews.js` | Fetch top AI stories from HN + Reddit, deduplicate |
| Create | `src/lib/briefs/__tests__/fetchAiNews.test.js` | Tests for fetch + dedup (mocked fetch) |
| Create | `src/lib/briefs/generateNewsDigest.js` | LLM call → structured News Digest JSON |
| Create | `src/lib/briefs/__tests__/generateNewsDigest.test.js` | Tests for digest generation (mocked LLM) |
| Modify | `src/store/useStore.js` | Wire brief generation after `addManualContent` saves |
| Create | `src/components/briefs/BriefsDropdown.jsx` | Portalled dropdown listing all briefs |
| Create | `src/components/briefs/BriefModal.jsx` | Portalled full-screen modal rendering one brief |
| Create | `src/components/briefs/useDailyDigestCheck.js` | Hook: on mount checks if news digest is stale, generates if needed |
| Modify | `src/components/layout/TopBar.jsx` | Add Radio icon button, mount BriefsDropdown + BriefModal, call useDailyDigestCheck |

---

### Task 1: Brief store additions

**Files:**
- Modify: `src/store/useStore.js`
- Create: `src/store/__tests__/useBriefs.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/store/__tests__/useBriefs.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'

// We test the pure selectors directly — no React needed.
// Import the module-level helpers once they exist.
import {
  unreadBriefCount,
  allBriefsSorted,
} from '../../store/useStore.js'

const TOPIC_BRIEF = {
  id: 'b1',
  type: 'topic',
  title: 'Agentic AI',
  topicId: 't1',
  generatedAt: 1000,
  readAt: null,
  newItemCount: 3,
  sourceCount: 2,
  sections: [],
}

const NEWS_BRIEF = {
  id: 'b2',
  type: 'news_digest',
  title: 'Today in AI',
  topicId: null,
  generatedAt: 2000,
  readAt: null,
  newItemCount: 6,
  sourceCount: 3,
  sections: [],
}

const READ_BRIEF = {
  id: 'b3',
  type: 'topic',
  title: 'Old topic',
  topicId: 't2',
  generatedAt: 500,
  readAt: 600,
  newItemCount: 3,
  sourceCount: 1,
  sections: [],
}

describe('unreadBriefCount', () => {
  it('counts briefs where readAt is null', () => {
    const briefs = { b1: TOPIC_BRIEF, b2: NEWS_BRIEF, b3: READ_BRIEF }
    expect(unreadBriefCount(briefs)).toBe(2)
  })

  it('returns 0 when all are read', () => {
    expect(unreadBriefCount({ b3: READ_BRIEF })).toBe(0)
  })

  it('returns 0 for empty object', () => {
    expect(unreadBriefCount({})).toBe(0)
  })
})

describe('allBriefsSorted', () => {
  it('puts news_digest first among unread', () => {
    const briefs = { b1: TOPIC_BRIEF, b2: NEWS_BRIEF }
    const sorted = allBriefsSorted(briefs)
    expect(sorted[0].id).toBe('b2')
  })

  it('puts read briefs after unread', () => {
    const briefs = { b1: TOPIC_BRIEF, b2: NEWS_BRIEF, b3: READ_BRIEF }
    const sorted = allBriefsSorted(briefs)
    expect(sorted[sorted.length - 1].id).toBe('b3')
  })

  it('sorts unread topic briefs by generatedAt descending', () => {
    const older = { ...TOPIC_BRIEF, id: 'b_old', generatedAt: 100 }
    const newer = { ...TOPIC_BRIEF, id: 'b_new', generatedAt: 900 }
    const sorted = allBriefsSorted({ b_old: older, b_new: newer })
    expect(sorted[0].id).toBe('b_new')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/store/__tests__/useBriefs.test.js
```

Expected: FAIL — `unreadBriefCount is not a function` (or similar import error)

- [ ] **Step 3: Add `briefs` to EMPTY and add store actions**

In `src/store/useStore.js`, find the `const EMPTY = {` block and add `briefs: {}` after `courses: {}` (search for `courses: {}`):

```js
  courses: {},
  briefs: {},
```

Then find the exported named selectors section (after all the `useCallback` action blocks, near the bottom of the file before the `return` statement). Add these two pure-function exports **before** the `export function useStore()` line:

```js
export function unreadBriefCount(briefs = {}) {
  return Object.values(briefs).filter((b) => b.readAt == null).length
}

export function allBriefsSorted(briefs = {}) {
  const all = Object.values(briefs)
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
```

Now add the three brief actions inside `useStore()`. Find where `addCourse` is defined (search for `const addCourse = useCallback`) and add the new actions right after the `addCourse` block:

```js
  const addBrief = useCallback((brief) => {
    persist((s) => ({ briefs: { ...s.briefs, [brief.id]: brief } }))
  }, [])

  const markBriefRead = useCallback((id) => {
    persist((s) => {
      const brief = s.briefs[id]
      if (!brief || brief.readAt != null) return s
      return { briefs: { ...s.briefs, [id]: { ...brief, readAt: Date.now() } } }
    })
  }, [])

  const markAllBriefsRead = useCallback(() => {
    persist((s) => {
      const now = Date.now()
      const updated = {}
      for (const [k, v] of Object.entries(s.briefs)) {
        updated[k] = v.readAt == null ? { ...v, readAt: now } : v
      }
      return { briefs: updated }
    })
  }, [])
```

Then in the `return` block of `useStore()`, add the three actions (find the line with `addCourse,` and add below it):

```js
      addBrief,
      markBriefRead,
      markAllBriefsRead,
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/store/__tests__/useBriefs.test.js
```

Expected: 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/store/useStore.js src/store/__tests__/useBriefs.test.js
git commit -m "feat(briefs): add brief store actions and selectors to useStore"
```

---

### Task 2: Brief trigger logic

**Files:**
- Create: `src/lib/briefs/briefTrigger.js`
- Create: `src/lib/briefs/__tests__/briefTrigger.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/briefs/__tests__/briefTrigger.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  newItemsSinceLastBrief,
  shouldGenerateTopicBrief,
} from '../briefTrigger.js'

const topicId = 't1'

function makeItem(topicId, savedAt) {
  return { id: `item-${savedAt}`, topicId, savedAt }
}

function makeBrief(topicId, generatedAt) {
  return { id: `b-${generatedAt}`, type: 'topic', topicId, generatedAt }
}

describe('newItemsSinceLastBrief', () => {
  it('counts items saved after the last brief for this topic', () => {
    const items = [
      makeItem(topicId, 100),
      makeItem(topicId, 200),
      makeItem(topicId, 300),
    ]
    const briefs = { b1: makeBrief(topicId, 150) }
    expect(newItemsSinceLastBrief(topicId, items, briefs)).toBe(2)
  })

  it('counts all items when no prior brief exists', () => {
    const items = [makeItem(topicId, 100), makeItem(topicId, 200)]
    expect(newItemsSinceLastBrief(topicId, {}, items)).toBe(2)
  })

  it('ignores items from other topics', () => {
    const items = [makeItem('other', 300), makeItem(topicId, 300)]
    expect(newItemsSinceLastBrief(topicId, {}, items)).toBe(1)
  })

  it('returns 0 when no items at all', () => {
    expect(newItemsSinceLastBrief(topicId, {}, [])).toBe(0)
  })
})

describe('shouldGenerateTopicBrief', () => {
  it('returns true when 3 or more new items since last brief', () => {
    const items = [
      makeItem(topicId, 200),
      makeItem(topicId, 300),
      makeItem(topicId, 400),
    ]
    const briefs = { b1: makeBrief(topicId, 100) }
    expect(shouldGenerateTopicBrief(topicId, items, briefs)).toBe(true)
  })

  it('returns false when fewer than 3 new items', () => {
    const items = [makeItem(topicId, 200), makeItem(topicId, 300)]
    const briefs = { b1: makeBrief(topicId, 100) }
    expect(shouldGenerateTopicBrief(topicId, items, briefs)).toBe(false)
  })

  it('returns false when a brief was just generated (same items)', () => {
    const items = [makeItem(topicId, 200), makeItem(topicId, 300), makeItem(topicId, 400)]
    // Brief generated AFTER all items — nothing new
    const briefs = { b1: makeBrief(topicId, 500) }
    expect(shouldGenerateTopicBrief(topicId, items, briefs)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/lib/briefs/__tests__/briefTrigger.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement briefTrigger.js**

Create `src/lib/briefs/briefTrigger.js`:

```js
/**
 * Returns the count of items saved to `topicId` after the most recent
 * brief for that topic was generated.  If no prior brief exists, counts
 * all items for the topic.
 *
 * @param {string}   topicId
 * @param {object[]} items    — array of content objects with { topicId, savedAt }
 * @param {object}   briefs   — briefs record object (id → Brief)
 * @returns {number}
 */
export function newItemsSinceLastBrief(topicId, briefs = {}, items = []) {
  const topicBriefs = Object.values(briefs).filter(
    (b) => b.type === 'topic' && b.topicId === topicId,
  )
  const lastGeneratedAt =
    topicBriefs.length > 0
      ? Math.max(...topicBriefs.map((b) => b.generatedAt))
      : 0

  return items.filter(
    (item) => item.topicId === topicId && (item.savedAt ?? 0) > lastGeneratedAt,
  ).length
}

/**
 * Returns true when there are 3 or more items saved to `topicId` since
 * the last brief was generated for that topic.
 *
 * @param {string}   topicId
 * @param {object[]} items
 * @param {object}   briefs
 * @returns {boolean}
 */
export function shouldGenerateTopicBrief(topicId, items, briefs) {
  return newItemsSinceLastBrief(topicId, briefs, items) >= 3
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/briefs/__tests__/briefTrigger.test.js
```

Expected: 7 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/briefs/briefTrigger.js src/lib/briefs/__tests__/briefTrigger.test.js
git commit -m "feat(briefs): add briefTrigger pure functions with tests"
```

---

### Task 3: Topic brief generator

**Files:**
- Create: `src/lib/briefs/generateTopicBrief.js`
- Create: `src/lib/briefs/__tests__/generateTopicBrief.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/briefs/__tests__/generateTopicBrief.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the LLM module before importing the module under test
vi.mock('../../../lib/llm/ollama.js', () => ({
  chatJson: vi.fn(),
  OLLAMA_CONFIG: { enabled: true },
}))

import { chatJson, OLLAMA_CONFIG } from '../../../lib/llm/ollama.js'
import { generateTopicBrief } from '../generateTopicBrief.js'

const MOCK_LLM_RESPONSE = {
  overview: 'Agentic AI is advancing rapidly.',
  what_changed: [
    { dot: 'rising', text: 'LangGraph adoption accelerating.' },
  ],
  strongest_signals: [
    { strength: 'Strong', source: 'HN', text: 'Tool-use reliability is the key bottleneck.' },
  ],
  open_questions: ['Does scale improve tool-call reliability?'],
  risks: 'Hype risk: enterprise adoption may be outpacing production deployment.',
}

const ITEMS = [
  { id: 'c1', title: 'LangGraph post', body: 'LangGraph is great', url: 'https://a.com', savedAt: 1000 },
  { id: 'c2', title: 'Agent evals', body: 'Evaluating agents', url: 'https://b.com', savedAt: 2000 },
]

beforeEach(() => {
  vi.clearAllMocks()
  OLLAMA_CONFIG.enabled = true
})

describe('generateTopicBrief', () => {
  it('calls chatJson and returns a Brief-shaped object', async () => {
    chatJson.mockResolvedValue(MOCK_LLM_RESPONSE)

    const result = await generateTopicBrief('Agentic AI', 't1', ITEMS)

    expect(chatJson).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      type: 'topic',
      topicId: 't1',
      title: 'Agentic AI',
      newItemCount: 2,
      sections: expect.any(Array),
    })
    expect(result.id).toBeTruthy()
    expect(result.generatedAt).toBeGreaterThan(0)
    expect(result.readAt).toBeNull()
  })

  it('maps LLM sections into BriefSection objects', async () => {
    chatJson.mockResolvedValue(MOCK_LLM_RESPONSE)
    const result = await generateTopicBrief('Agentic AI', 't1', ITEMS)

    const types = result.sections.map((s) => s.type)
    expect(types).toContain('overview')
    expect(types).toContain('what_changed')
    expect(types).toContain('strongest_signals')
    expect(types).toContain('open_questions')
    expect(types).toContain('risks')
  })

  it('returns null when LLM is disabled', async () => {
    OLLAMA_CONFIG.enabled = false
    const result = await generateTopicBrief('Agentic AI', 't1', ITEMS)
    expect(result).toBeNull()
    expect(chatJson).not.toHaveBeenCalled()
  })

  it('returns null when chatJson returns null', async () => {
    chatJson.mockResolvedValue(null)
    const result = await generateTopicBrief('Agentic AI', 't1', ITEMS)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/lib/briefs/__tests__/generateTopicBrief.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement generateTopicBrief.js**

Create `src/lib/briefs/generateTopicBrief.js`:

```js
import { chatJson, OLLAMA_CONFIG } from '../llm/ollama.js'

const SYSTEM_PROMPT = `You are an intelligence analyst. Given a list of saved content items on a topic, produce a structured brief as JSON with these exact keys:
- overview: string (2-3 sentences summarising the topic's current state)
- what_changed: array of { dot: "rising"|"shift"|"new", text: string } (3-5 items)
- strongest_signals: array of { strength: "Strong"|"Medium", source: string, text: string } (2-3 items)
- open_questions: array of strings (2-4 questions worth watching)
- risks: string (1-2 sentences on the strongest contrarian view or evidence gap)

Respond ONLY with the JSON object, no markdown, no explanation.`

/**
 * Generates a Topic Brief for the given topic using the provided content items.
 *
 * @param {string}   topicTitle
 * @param {string}   topicId
 * @param {object[]} items  — content objects { id, title, body, url, savedAt }
 * @returns {Promise<object|null>}  Brief record or null if LLM unavailable
 */
export async function generateTopicBrief(topicTitle, topicId, items) {
  if (!OLLAMA_CONFIG.enabled) return null

  // Cap at 30 most recent items to stay within LLM context
  const sorted = [...items].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)).slice(0, 30)

  const itemsText = sorted
    .map((item, i) => `${i + 1}. ${item.title ?? '(no title)'}\n${item.body ?? item.url ?? ''}`)
    .join('\n\n')

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Topic: ${topicTitle}\n\nContent items:\n${itemsText}`,
    },
  ]

  const raw = await chatJson(messages)
  if (!raw) return null

  const sections = [
    { type: 'overview', content: raw.overview ?? '' },
    { type: 'what_changed', items: Array.isArray(raw.what_changed) ? raw.what_changed : [] },
    { type: 'strongest_signals', items: Array.isArray(raw.strongest_signals) ? raw.strongest_signals : [] },
    { type: 'open_questions', items: Array.isArray(raw.open_questions) ? raw.open_questions : [] },
    { type: 'risks', content: raw.risks ?? '' },
  ]

  return {
    id: crypto.randomUUID(),
    type: 'topic',
    title: topicTitle,
    topicId,
    generatedAt: Date.now(),
    readAt: null,
    newItemCount: items.length,
    sourceCount: new Set(items.map((i) => i.source).filter(Boolean)).size,
    sections,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/briefs/__tests__/generateTopicBrief.test.js
```

Expected: 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/briefs/generateTopicBrief.js src/lib/briefs/__tests__/generateTopicBrief.test.js
git commit -m "feat(briefs): add generateTopicBrief with LLM integration"
```

---

### Task 4: AI news fetcher

**Files:**
- Create: `src/lib/briefs/fetchAiNews.js`
- Create: `src/lib/briefs/__tests__/fetchAiNews.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/briefs/__tests__/fetchAiNews.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAiNews, deduplicateStories } from '../fetchAiNews.js'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

function makeHnResponse(hits) {
  return { ok: true, json: async () => ({ hits }) }
}

function makeRedditResponse(posts) {
  return {
    ok: true,
    json: async () => ({ data: { children: posts.map((p) => ({ data: p })) } }),
  }
}

beforeEach(() => vi.clearAllMocks())

const HN_HIT = { objectID: 'hn1', title: 'GPT-5 released', url: 'https://a.com', points: 300, num_comments: 50 }
const HN_HIT2 = { objectID: 'hn2', title: 'Claude 4 announced', url: 'https://b.com', points: 200, num_comments: 30 }
const REDDIT_POST = { id: 'r1', title: 'GPT-5 released', url: 'https://a.com', score: 400, subreddit: 'MachineLearning' }

describe('deduplicateStories', () => {
  it('removes stories with duplicate URLs', () => {
    const stories = [
      { id: 'a', url: 'https://same.com', title: 'Story A', score: 100 },
      { id: 'b', url: 'https://same.com', title: 'Story B', score: 50 },
      { id: 'c', url: 'https://other.com', title: 'Story C', score: 200 },
    ]
    const result = deduplicateStories(stories)
    expect(result).toHaveLength(2)
    // Keeps the higher-scored one
    expect(result.find((s) => s.url === 'https://same.com').score).toBe(100)
  })

  it('keeps stories with unique URLs', () => {
    const stories = [
      { id: 'a', url: 'https://a.com', title: 'A', score: 100 },
      { id: 'b', url: 'https://b.com', title: 'B', score: 50 },
    ]
    expect(deduplicateStories(stories)).toHaveLength(2)
  })
})

describe('fetchAiNews', () => {
  it('returns merged deduplicated stories from HN and Reddit', async () => {
    mockFetch
      .mockResolvedValueOnce(makeHnResponse([HN_HIT, HN_HIT2]))   // HN call
      .mockResolvedValueOnce(makeRedditResponse([REDDIT_POST]))    // Reddit call

    const stories = await fetchAiNews()

    // HN and Reddit both have "GPT-5" story at same URL → deduped to 1
    expect(stories.length).toBe(2) // GPT-5 (deduped) + Claude 4
  })

  it('returns empty array when both fetches fail', async () => {
    mockFetch.mockRejectedValue(new Error('network'))
    const stories = await fetchAiNews()
    expect(stories).toEqual([])
  })

  it('returns HN results even when Reddit fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeHnResponse([HN_HIT]))
      .mockRejectedValueOnce(new Error('reddit down'))

    const stories = await fetchAiNews()
    expect(stories.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/lib/briefs/__tests__/fetchAiNews.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement fetchAiNews.js**

Create `src/lib/briefs/fetchAiNews.js`:

```js
const HN_API = '/api/hn/api/v1/search_by_date'
const REDDIT_API = '/api/reddit/r/MachineLearning+artificial/top.json'

/**
 * Deduplicates stories by URL, keeping the one with the highest score.
 *
 * @param {object[]} stories — array of { id, url, title, score, source }
 * @returns {object[]}
 */
export function deduplicateStories(stories) {
  const byUrl = new Map()
  for (const story of stories) {
    const key = story.url ?? story.id
    const existing = byUrl.get(key)
    if (!existing || story.score > existing.score) {
      byUrl.set(key, story)
    }
  }
  return Array.from(byUrl.values())
}

async function fetchHnAiStories() {
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
  const url = `${HN_API}?query=AI+machine+learning+LLM&tags=story&numericFilters=created_at_i>${since},points>=50&hitsPerPage=30`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HN fetch failed: ${res.status}`)
  const data = await res.json()
  return (data.hits ?? []).map((h) => ({
    id: `hn-${h.objectID}`,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    title: h.title,
    score: h.points ?? 0,
    comments: h.num_comments ?? 0,
    source: 'Hacker News',
  }))
}

async function fetchRedditAiStories() {
  const res = await fetch(`${REDDIT_API}?t=day&limit=25`)
  if (!res.ok) throw new Error(`Reddit fetch failed: ${res.status}`)
  const data = await res.json()
  return (data?.data?.children ?? []).map((c) => ({
    id: `reddit-${c.data.id}`,
    url: c.data.url,
    title: c.data.title,
    score: c.data.score ?? 0,
    comments: c.data.num_comments ?? 0,
    source: `r/${c.data.subreddit}`,
  }))
}

/**
 * Fetches AI news stories from Hacker News and Reddit, deduplicates by URL,
 * and returns the merged list sorted by score descending.
 *
 * Failures from individual sources are swallowed — the other source's
 * results are still returned.
 *
 * @returns {Promise<object[]>}
 */
export async function fetchAiNews() {
  const [hnResult, redditResult] = await Promise.allSettled([
    fetchHnAiStories(),
    fetchRedditAiStories(),
  ])

  const hnStories = hnResult.status === 'fulfilled' ? hnResult.value : []
  const redditStories = redditResult.status === 'fulfilled' ? redditResult.value : []

  const merged = [...hnStories, ...redditStories]
  const deduped = deduplicateStories(merged)

  return deduped.sort((a, b) => b.score - a.score)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/briefs/__tests__/fetchAiNews.test.js
```

Expected: 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/briefs/fetchAiNews.js src/lib/briefs/__tests__/fetchAiNews.test.js
git commit -m "feat(briefs): add fetchAiNews with HN+Reddit fetch and URL dedup"
```

---

### Task 5: News digest generator

**Files:**
- Create: `src/lib/briefs/generateNewsDigest.js`
- Create: `src/lib/briefs/__tests__/generateNewsDigest.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/briefs/__tests__/generateNewsDigest.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/llm/ollama.js', () => ({
  chatJson: vi.fn(),
  OLLAMA_CONFIG: { enabled: true },
}))

import { chatJson, OLLAMA_CONFIG } from '../../../lib/llm/ollama.js'
import { generateNewsDigest } from '../generateNewsDigest.js'

const MOCK_STORIES = [
  { id: 'hn-1', title: 'GPT-5 released', score: 300, source: 'Hacker News', url: 'https://a.com' },
  { id: 'r-1', title: 'New RLHF paper', score: 200, source: 'r/MachineLearning', url: 'https://b.com' },
]

const MOCK_LLM_RESPONSE = {
  highlights: ['GPT-5 released with multimodal capabilities.', 'New RLHF paper shows 20% improvement.'],
  themes: ['Multimodal models dominating', 'RLHF improvements continuing'],
  top_signal: 'GPT-5 represents a step change in capability.',
  risks: 'Benchmark saturation — hard to tell genuine improvement from overfitting.',
}

beforeEach(() => {
  vi.clearAllMocks()
  OLLAMA_CONFIG.enabled = true
})

describe('generateNewsDigest', () => {
  it('returns a Brief-shaped object with news_digest type', async () => {
    chatJson.mockResolvedValue(MOCK_LLM_RESPONSE)
    const result = await generateNewsDigest(MOCK_STORIES)

    expect(result).toMatchObject({
      type: 'news_digest',
      topicId: null,
      readAt: null,
    })
    expect(result.id).toBeTruthy()
    expect(result.generatedAt).toBeGreaterThan(0)
  })

  it('maps LLM response into correct section types', async () => {
    chatJson.mockResolvedValue(MOCK_LLM_RESPONSE)
    const result = await generateNewsDigest(MOCK_STORIES)

    const types = result.sections.map((s) => s.type)
    expect(types).toContain('highlights')
    expect(types).toContain('themes')
    expect(types).toContain('top_signal')
    expect(types).toContain('risks')
  })

  it('returns null when LLM is disabled', async () => {
    OLLAMA_CONFIG.enabled = false
    const result = await generateNewsDigest(MOCK_STORIES)
    expect(result).toBeNull()
    expect(chatJson).not.toHaveBeenCalled()
  })

  it('returns null when chatJson returns null', async () => {
    chatJson.mockResolvedValue(null)
    const result = await generateNewsDigest(MOCK_STORIES)
    expect(result).toBeNull()
  })

  it('returns null when no stories provided', async () => {
    const result = await generateNewsDigest([])
    expect(result).toBeNull()
    expect(chatJson).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run src/lib/briefs/__tests__/generateNewsDigest.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement generateNewsDigest.js**

Create `src/lib/briefs/generateNewsDigest.js`:

```js
import { chatJson, OLLAMA_CONFIG } from '../llm/ollama.js'

const SYSTEM_PROMPT = `You are an AI news analyst. Given a list of today's top AI stories from Hacker News and Reddit, produce a structured digest as JSON with these exact keys:
- highlights: array of strings (4-6 one-sentence bullet developments)
- themes: array of strings (2-3 cross-story patterns or trends)
- top_signal: string (single highest-confidence development to pay attention to)
- risks: string (1-2 sentences on what looks hyped, premature, or contradicted)

Respond ONLY with the JSON object, no markdown, no explanation.`

/**
 * Generates an AI News Digest brief from the provided stories.
 *
 * @param {object[]} stories  — from fetchAiNews: { id, title, score, source, url }
 * @returns {Promise<object|null>}  Brief record or null if LLM unavailable / no stories
 */
export async function generateNewsDigest(stories) {
  if (!OLLAMA_CONFIG.enabled) return null
  if (!stories || stories.length === 0) return null

  const storiesText = stories
    .slice(0, 25)
    .map((s, i) => `${i + 1}. [${s.source}] ${s.title} (score: ${s.score})`)
    .join('\n')

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Today's AI stories:\n${storiesText}` },
  ]

  const raw = await chatJson(messages)
  if (!raw) return null

  const uniqueSources = new Set(stories.map((s) => s.source).filter(Boolean))
  const highlightCount = Array.isArray(raw.highlights) ? raw.highlights.length : 0

  const sections = [
    { type: 'highlights', items: Array.isArray(raw.highlights) ? raw.highlights : [] },
    { type: 'themes', items: Array.isArray(raw.themes) ? raw.themes : [] },
    { type: 'top_signal', content: raw.top_signal ?? '' },
    { type: 'risks', content: raw.risks ?? '' },
  ]

  return {
    id: crypto.randomUUID(),
    type: 'news_digest',
    title: `Today in AI — ${highlightCount} development${highlightCount !== 1 ? 's' : ''}`,
    topicId: null,
    generatedAt: Date.now(),
    readAt: null,
    newItemCount: stories.length,
    sourceCount: uniqueSources.size,
    sections,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/briefs/__tests__/generateNewsDigest.test.js
```

Expected: 5 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/briefs/generateNewsDigest.js src/lib/briefs/__tests__/generateNewsDigest.test.js
git commit -m "feat(briefs): add generateNewsDigest with LLM integration"
```

---

### Task 6: Wire brief generation into useStore

**Files:**
- Modify: `src/store/useStore.js`

Brief generation is fire-and-forget async, exactly like `requestSummary` in the existing codebase. It runs after `addManualContent` persists its item, checks the trigger, and calls the generator without blocking the UI.

- [ ] **Step 1: Write the failing test**

Add this test case to `src/store/__tests__/useBriefs.test.js`. Open the file and append at the bottom:

```js
// ── Integration: generation is wired ─────────────────────────────────────────
// These tests verify that the trigger + generator plumbing is in place.
// They do NOT call Ollama — the LLM module is fully mocked.

import { vi } from 'vitest'

vi.mock('../../lib/briefs/generateTopicBrief.js', () => ({
  generateTopicBrief: vi.fn().mockResolvedValue({
    id: 'auto-brief-1',
    type: 'topic',
    title: 'Test Topic',
    topicId: 't1',
    generatedAt: 9999,
    readAt: null,
    newItemCount: 3,
    sourceCount: 1,
    sections: [],
  }),
}))

import { generateTopicBrief } from '../../lib/briefs/generateTopicBrief.js'
```

> **Note:** The integration test for `addManualContent` → brief generation requires rendering the React hook in a test environment. Since this is a complex integration test that touches React + async effects, it is acceptable to write this as a manual smoke test: after implementing Task 6, manually add 3 items in the app and verify a brief appears in the dropdown. Skip the automated integration test for this task.

- [ ] **Step 2: Add imports to useStore.js**

At the top of `src/store/useStore.js`, after all existing imports, add:

```js
import { shouldGenerateTopicBrief } from '../lib/briefs/briefTrigger.js'
import { generateTopicBrief } from '../lib/briefs/generateTopicBrief.js'
```

- [ ] **Step 3: Add brief generation trigger inside addManualContent**

In `src/store/useStore.js`, find the `addManualContent` callback. It currently looks like:

```js
  const addManualContent = useCallback((item) => {
    const enriched = { ...item, savedAt: item.savedAt ?? Date.now(), source: item.source ?? 'manual' }
    persist((s) => ({ manualContent: { ...s.manualContent, [enriched.id]: enriched } }))
```

After the `persist(...)` call (but still inside the callback), add the fire-and-forget brief generation:

```js
    // Fire-and-forget: check if this topic now has 3+ new items → generate brief
    if (enriched.topicId) {
      setTimeout(async () => {
        const s = getSnapshot()
        const allItems = Object.values(s.manualContent || {})
        if (!shouldGenerateTopicBrief(enriched.topicId, allItems, s.briefs || {})) return

        const topicEntry = Object.values(s.userTopics || {}).find(
          (t) => t.id === enriched.topicId,
        )
        const topicTitle = topicEntry?.label ?? topicEntry?.name ?? enriched.topicId

        const itemsForTopic = allItems.filter((i) => i.topicId === enriched.topicId)
        const brief = await generateTopicBrief(topicTitle, enriched.topicId, itemsForTopic)
        if (brief) persist((s) => ({ briefs: { ...s.briefs, [brief.id]: brief } }))
      }, 0)
    }
```

> `getSnapshot()` is the module-level function already in useStore.js that returns the current state snapshot. Search for `function getSnapshot` to confirm it exists before adding this code.

- [ ] **Step 4: Run full test suite to verify nothing is broken**

```bash
npx vitest run
```

Expected: all existing tests still pass

- [ ] **Step 5: Commit**

```bash
git add src/store/useStore.js
git commit -m "feat(briefs): wire brief generation trigger into addManualContent"
```

---

### Task 7: BriefsDropdown component

**Files:**
- Create: `src/components/briefs/BriefsDropdown.jsx`

- [ ] **Step 1: Implement BriefsDropdown.jsx**

Create `src/components/briefs/BriefsDropdown.jsx`:

```jsx
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useStore, allBriefsSorted, unreadBriefCount } from '../../store/useStore.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(diff / 3_600_000)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(diff / 86_400_000)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function BriefItem({ brief, onClick }) {
  const isUnread = brief.readAt == null
  const isNews = brief.type === 'news_digest'

  const preview = (() => {
    const overviewSection = brief.sections?.find((s) => s.type === 'overview' || s.type === 'highlights')
    if (!overviewSection) return ''
    if (overviewSection.content) return overviewSection.content
    if (Array.isArray(overviewSection.items)) return overviewSection.items.slice(0, 2).join(' ')
    return ''
  })()

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-3 px-4 py-3 border-b transition-colors hover:bg-white/[0.025]"
      style={{
        borderColor: 'rgba(255,255,255,0.05)',
        opacity: isUnread ? 1 : 0.4,
        position: 'relative',
      }}
    >
      {isUnread && (
        <span
          style={{
            position: 'absolute',
            left: 5,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#0d9488',
            flexShrink: 0,
          }}
        />
      )}

      {/* Icon */}
      <span
        className="flex-shrink-0 flex items-center justify-center text-base rounded-[10px]"
        style={{
          width: 36,
          height: 36,
          background: isNews
            ? 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.12))'
            : 'linear-gradient(135deg,rgba(13,148,136,0.18),rgba(6,182,212,0.1))',
          border: isNews ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(45,212,191,0.18)',
        }}
      >
        {isNews ? '📰' : '🧠'}
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div
          className="text-[10px] font-semibold uppercase tracking-wide mb-0.5"
          style={{ color: isNews ? 'rgba(167,139,250,0.7)' : 'rgba(45,212,191,0.6)' }}
        >
          {isNews ? 'AI News Digest' : 'Topic Brief'}
        </div>
        <div className="text-[13px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
          {brief.title}
        </div>
        {preview && (
          <div
            className="text-[12px] mt-1 leading-snug"
            style={{
              color: 'rgba(255,255,255,0.35)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {preview}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {isUnread && (
            <span
              className="text-[10px] font-semibold px-[7px] py-0.5 rounded-[5px]"
              style={
                isNews
                  ? { background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }
                  : { background: 'rgba(13,148,136,0.18)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.2)' }
              }
            >
              {isNews ? 'Daily' : `+${brief.newItemCount} new`}
            </span>
          )}
          <span className="text-[10px] ml-auto" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {relativeTime(brief.generatedAt)}
          </span>
        </div>
      </div>
    </button>
  )
}

// ── Main dropdown ─────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {DOMRect} props.anchorRect   — bounding rect of the trigger button
 * @param {function} props.onClose     — close the dropdown
 * @param {function} props.onOpenBrief — (brief) => void
 */
export default function BriefsDropdown({ anchorRect, onClose, onOpenBrief }) {
  const { briefs, markBriefRead, markAllBriefsRead } = useStore()
  const sorted = allBriefsSorted(briefs)
  const dropdownRef = useRef(null)

  // Close on click-outside
  useEffect(() => {
    function onDown(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const top = (anchorRect?.bottom ?? 0) + 8
  const right = window.innerWidth - (anchorRect?.right ?? 0)

  return createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top,
        right,
        zIndex: 200,
        width: 340,
        background: '#0b0e1a',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 14,
        boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <span className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>
          Flow AI Briefs
        </span>
        <button
          onClick={markAllBriefsRead}
          className="text-[11px] font-medium"
          style={{ color: 'rgba(45,212,191,0.7)' }}
        >
          Mark all read
        </button>
      </div>

      {/* Items */}
      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
            No briefs yet — save 3+ items to a topic to get your first brief.
          </div>
        ) : (
          sorted.map((brief) => (
            <BriefItem
              key={brief.id}
              brief={brief}
              onClick={() => {
                markBriefRead(brief.id)
                onOpenBrief(brief)
                onClose()
              }}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 text-center border-t"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          View all briefs →
        </span>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: Run the full test suite to verify nothing is broken**

```bash
npx vitest run
```

Expected: all tests pass (no tests for this UI component — visual verification in Task 9)

- [ ] **Step 3: Commit**

```bash
git add src/components/briefs/BriefsDropdown.jsx
git commit -m "feat(briefs): add BriefsDropdown component"
```

---

### Task 8: BriefModal component

**Files:**
- Create: `src/components/briefs/BriefModal.jsx`

- [ ] **Step 1: Implement BriefModal.jsx**

Create `src/components/briefs/BriefModal.jsx`:

```jsx
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store/useStore.js'

// ── Section renderers ─────────────────────────────────────────────────────────

function OverviewSection({ section }) {
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Overview
      </div>
      <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
        {section.content}
      </p>
    </div>
  )
}

const DOT_COLORS = { rising: '#2dd4bf', shift: '#a78bfa', new: '#60a5fa' }

function WhatChangedSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        What Changed
      </div>
      <div className="flex flex-col gap-[9px]">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: DOT_COLORS[item.dot] ?? '#2dd4bf',
                flexShrink: 0,
                marginTop: 5,
              }}
            />
            <p className="text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {item.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function SignalCard({ signal }) {
  const isStrong = signal.strength === 'Strong'
  return (
    <div
      className="rounded-[10px] p-3"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] font-bold px-[7px] py-0.5 rounded-[5px]"
          style={
            isStrong
              ? { background: 'rgba(13,148,136,0.15)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.2)' }
              : { background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }
          }
        >
          {signal.strength}
        </span>
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {signal.source}
        </span>
      </div>
      <p className="text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {signal.text}
      </p>
    </div>
  )
}

function StrongestSignalsSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Strongest Signals
      </div>
      <div className="flex flex-col gap-2">
        {items.map((signal, i) => <SignalCard key={i} signal={signal} />)}
      </div>
    </div>
  )
}

function OpenQuestionsSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Open Questions
      </div>
      <div className="flex flex-col gap-[7px]">
        {items.map((q, i) => (
          <div key={i} className="flex items-start gap-[9px] text-[13px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
            <span className="text-[11px] font-bold flex-shrink-0 pt-px" style={{ color: 'rgba(255,255,255,0.2)', minWidth: 16 }}>
              {i + 1}.
            </span>
            <span>{q}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RisksSection({ section }) {
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Risks &amp; Counterpoints
      </div>
      <div
        className="rounded-[10px] p-3"
        style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.12)' }}
      >
        <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {section.content}
        </p>
      </div>
    </div>
  )
}

function HighlightsSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Today's Highlights
      </div>
      <div className="flex flex-col gap-[9px]">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#2dd4bf', flexShrink: 0, marginTop: 5 }}
            />
            <p className="text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {item}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ThemesSection({ section }) {
  const items = Array.isArray(section.items) ? section.items : []
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Emerging Themes
      </div>
      <div className="flex flex-col gap-[7px]">
        {items.map((theme, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: 5 }}
            />
            <p className="text-[13px] leading-snug" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {theme}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopSignalSection({ section }) {
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Strongest Signal
      </div>
      <div
        className="rounded-[10px] p-3"
        style={{ background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(45,212,191,0.15)' }}
      >
        <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {section.content}
        </p>
      </div>
    </div>
  )
}

function RisksNoiseSection({ section }) {
  return (
    <div className="px-6 py-[18px] border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
        Risks &amp; Noise
      </div>
      <div
        className="rounded-[10px] p-3"
        style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.12)' }}
      >
        <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {section.content}
        </p>
      </div>
    </div>
  )
}

function BriefSection({ section }) {
  switch (section.type) {
    case 'overview':           return <OverviewSection section={section} />
    case 'what_changed':       return <WhatChangedSection section={section} />
    case 'strongest_signals':  return <StrongestSignalsSection section={section} />
    case 'open_questions':     return <OpenQuestionsSection section={section} />
    case 'risks':              return section.content ? <RisksSection section={section} /> : null
    case 'highlights':         return <HighlightsSection section={section} />
    case 'themes':             return <ThemesSection section={section} />
    case 'top_signal':         return <TopSignalSection section={section} />
    default:                   return null
  }
}

// ── Action rail ───────────────────────────────────────────────────────────────

function ActionBtn({ label, variant = 'secondary', onClick }) {
  const styles = {
    primary:   { background: 'rgba(13,148,136,0.18)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.28)' },
    purple:    { background: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.22)' },
    secondary: { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' },
  }
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-[7px] rounded-[9px] text-[12px] font-semibold transition-colors"
      style={styles[variant]}
    >
      {label}
    </button>
  )
}

function relativeTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const hrs = Math.floor(diff / 3_600_000)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(diff / 86_400_000)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

// ── Main modal ────────────────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {object}   props.brief    — Brief record to display
 * @param {function} props.onClose  — close callback
 */
export default function BriefModal({ brief, onClose }) {
  // Escape key closes
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!brief) return null

  const isNews = brief.type === 'news_digest'

  function comingSoon(label) {
    return () => {
      // Simple toast using the existing pattern (no-op if toast not wired)
      console.info(`Coming soon: ${label}`)
    }
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 301,
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          background: 'linear-gradient(160deg,rgba(12,15,26,0.99) 0%,rgba(6,8,18,1) 100%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex-shrink-0 px-6 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="flex-shrink-0 flex items-center justify-center text-xl rounded-[13px]"
                style={{
                  width: 44,
                  height: 44,
                  background: isNews
                    ? 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(168,85,247,0.12))'
                    : 'linear-gradient(135deg,rgba(13,148,136,0.2),rgba(6,182,212,0.12))',
                  border: isNews ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(45,212,191,0.2)',
                }}
              >
                {isNews ? '📰' : '🧠'}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(45,212,191,0.65)' }}>
                  {isNews ? 'AI News Digest' : 'Topic Brief'}
                </div>
                <h2 className="text-[18px] font-bold leading-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>
                  {brief.title}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 flex items-center justify-center rounded-[8px] text-base transition-colors"
              style={{
                width: 30, height: 30,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              ✕
            </button>
          </div>

          {/* Meta pills */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {brief.newItemCount > 0 && (
              <span
                className="text-[11px] font-medium px-[9px] py-[3px] rounded-[6px]"
                style={{ background: 'rgba(13,148,136,0.15)', color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.2)' }}
              >
                {isNews ? `${brief.newItemCount} stories` : `+${brief.newItemCount} new items`}
              </span>
            )}
            <span
              className="text-[11px] font-medium px-[9px] py-[3px] rounded-[6px]"
              style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {relativeTime(brief.generatedAt)}
            </span>
            {brief.sourceCount > 0 && (
              <span
                className="text-[11px] font-medium px-[9px] py-[3px] rounded-[6px]"
                style={{ color: 'rgba(167,139,250,0.75)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
              >
                {brief.sourceCount} source{brief.sourceCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {(brief.sections ?? []).map((section, i) => (
            <BriefSection key={i} section={section} />
          ))}
        </div>

        {/* Footer action rail */}
        <div
          className="flex-shrink-0 px-6 py-3.5 border-t"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(6,8,18,0.8)' }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-wide mb-2.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Next Steps
          </div>
          <div className="flex flex-wrap gap-2">
            {isNews ? (
              <>
                <ActionBtn label="💾 Save highlights to inbox" variant="primary" onClick={comingSoon('Save highlights')} />
                <ActionBtn label="📋 Create watch rule" variant="secondary" onClick={comingSoon('Create watch rule')} />
                <ActionBtn label="🎓 Turn into learning path" variant="secondary" onClick={comingSoon('Learning path')} />
              </>
            ) : (
              <>
                <ActionBtn label="💾 Save to Topic" variant="primary" onClick={comingSoon('Save to Topic')} />
                <ActionBtn label="⚡ Generate opportunity brief" variant="purple" onClick={comingSoon('Opportunity brief')} />
                <ActionBtn label="🎓 Turn into learning path" variant="secondary" onClick={comingSoon('Learning path')} />
                <ActionBtn label="📋 Create watch rule" variant="secondary" onClick={comingSoon('Create watch rule')} />
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
```

- [ ] **Step 2: Run the full test suite to verify nothing is broken**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/briefs/BriefModal.jsx
git commit -m "feat(briefs): add BriefModal component with all section renderers"
```

---

### Task 9: TopBar integration + daily digest hook

**Files:**
- Create: `src/components/briefs/useDailyDigestCheck.js`
- Modify: `src/components/layout/TopBar.jsx`

- [ ] **Step 1: Implement useDailyDigestCheck.js**

Create `src/components/briefs/useDailyDigestCheck.js`:

```js
import { useEffect } from 'react'
import { useStore } from '../../store/useStore.js'
import { fetchAiNews } from '../../lib/briefs/fetchAiNews.js'
import { generateNewsDigest } from '../../lib/briefs/generateNewsDigest.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Mount-time hook.  Checks whether the most recent news_digest brief is
 * older than 24 hours (or missing).  If so, fetches AI news and generates
 * a new digest.  Fire-and-forget — does not block rendering.
 */
export function useDailyDigestCheck() {
  const { briefs, addBrief } = useStore()

  useEffect(() => {
    const lastDigest = Object.values(briefs)
      .filter((b) => b.type === 'news_digest')
      .sort((a, b) => b.generatedAt - a.generatedAt)[0]

    const isStale = !lastDigest || Date.now() - lastDigest.generatedAt > ONE_DAY_MS
    if (!isStale) return

    ;(async () => {
      const stories = await fetchAiNews().catch(() => [])
      if (!stories.length) return
      const digest = await generateNewsDigest(stories)
      if (digest) addBrief(digest)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
```

- [ ] **Step 2: Read TopBar.jsx to understand its current structure**

```bash
cat src/components/layout/TopBar.jsx
```

Confirm the file has:
- A `<div className="flex items-center gap-3">` on the right side containing the avatar/settings button
- `createPortal` already imported
- An existing portalled dropdown pattern (mode-switcher) to follow

- [ ] **Step 3: Modify TopBar.jsx**

Open `src/components/layout/TopBar.jsx`.

**3a. Add imports** at the top of the file after the existing imports:

```js
import { Radio } from 'lucide-react'
import { useState, useRef } from 'react'
import { useStore, unreadBriefCount } from '../../store/useStore.js'
import BriefsDropdown from '../briefs/BriefsDropdown.jsx'
import BriefModal from '../briefs/BriefModal.jsx'
import { useDailyDigestCheck } from '../briefs/useDailyDigestCheck.js'
```

Note: `useState`, `useRef`, and `useStore` may already be imported. Only add what is missing.

**3b. Add state and refs** inside the `TopBar` component function body, after the existing state declarations:

```js
  const { briefs } = useStore()
  const unread = unreadBriefCount(briefs)
  const [briefsOpen, setBriefsOpen] = useState(false)
  const [activeBrief, setActiveBrief] = useState(null)
  const briefsBtnRef = useRef(null)

  useDailyDigestCheck()
```

**3c. Add the Briefs button** to the right-side icon group. Find the `<div className="flex items-center gap-3">` block and add the Briefs button before the Settings button:

```jsx
          {/* Briefs button */}
          <div className="relative">
            <button
              ref={briefsBtnRef}
              onClick={() => setBriefsOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] text-[12px] font-semibold transition-colors"
              style={{
                background: 'rgba(13,148,136,0.15)',
                border: '1px solid rgba(45,212,191,0.25)',
                color: '#2dd4bf',
              }}
              aria-label="Open AI Briefs"
            >
              <Radio size={13} />
              Briefs
            </button>
            {unread > 0 && (
              <span
                className="absolute flex items-center justify-center text-[10px] font-bold text-white"
                style={{
                  top: -6,
                  right: -6,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  background: 'linear-gradient(135deg,#0d9488,#6366f1)',
                  border: '2px solid var(--color-bg, #070a14)',
                  padding: '0 4px',
                }}
              >
                {unread}
              </span>
            )}
          </div>
```

**3d. Add BriefsDropdown and BriefModal** at the bottom of the TopBar return statement, just before the closing `</>` or `</div>`:

```jsx
          {briefsOpen && (
            <BriefsDropdown
              anchorRect={briefsBtnRef.current?.getBoundingClientRect()}
              onClose={() => setBriefsOpen(false)}
              onOpenBrief={(brief) => setActiveBrief(brief)}
            />
          )}
          <BriefModal
            brief={activeBrief}
            onClose={() => setActiveBrief(null)}
          />
```

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass

- [ ] **Step 5: Start dev server and smoke-test visually**

```bash
npm run dev
```

Verify:
1. The "Briefs" button with Radio icon appears in the top bar
2. Clicking it opens the dropdown (shows empty state if no briefs yet)
3. "Mark all read" link is present
4. The dropdown closes when clicking outside or pressing Escape

To test end-to-end brief generation:
- Go to the Documents page, add 3+ items tagged to the same topic
- Wait a moment — a brief should auto-generate (requires Ollama to be running)
- Return to Dashboard — badge should show on Briefs button
- Click to see the dropdown entry, click to open the modal

- [ ] **Step 6: Commit**

```bash
git add src/components/briefs/useDailyDigestCheck.js src/components/layout/TopBar.jsx
git commit -m "feat(briefs): wire BriefsDropdown, BriefModal, and daily digest check into TopBar"
```

---

## Running All Tests

```bash
npx vitest run
```

Expected final state: all tests pass, including:
- `src/store/__tests__/useBriefs.test.js` (6 tests)
- `src/lib/briefs/__tests__/briefTrigger.test.js` (7 tests)
- `src/lib/briefs/__tests__/generateTopicBrief.test.js` (4 tests)
- `src/lib/briefs/__tests__/fetchAiNews.test.js` (5 tests)
- `src/lib/briefs/__tests__/generateNewsDigest.test.js` (5 tests)
- All pre-existing tests

---

## Self-Review

**Spec coverage:**
- ✅ Topic Brief trigger (3+ items since last brief) — Task 2 + Task 6
- ✅ Topic Brief LLM generation (5 sections) — Task 3
- ✅ AI News Digest from HN + Reddit — Tasks 4 + 5
- ✅ Brief stored in persistence layer — Task 1 (`briefs` in useStore)
- ✅ Briefs button in header with badge — Task 9
- ✅ Dropdown: sorted, AI News pinned first, unread dot, read dimmed — Task 7
- ✅ Modal: all section types, action rail with Phase 1 handlers — Task 8
- ✅ Mark as read on click, mark all read — Tasks 1 + 7
- ✅ Daily digest check on mount — Task 9 (`useDailyDigestCheck`)
- ✅ "View all briefs →" renders but goes nowhere — Task 7 (no-op span)
- ✅ Action buttons: Save/watch rule wired to coming-soon toast in Phase 1 — Task 8

**Out-of-scope confirmed excluded:** cross-source compare, proactive resurface, full "view all" page, push notifications, brief editing/export.
