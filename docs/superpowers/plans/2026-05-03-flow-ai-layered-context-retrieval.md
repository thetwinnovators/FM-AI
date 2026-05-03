# Flow AI Layered Context Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace bulk memory/topics/notes injection with a layered context model featuring user-pinned identity memory, deterministic task state, and ranked-only retrieval for all other knowledge.

**Architecture:** Add `isIdentityPinned` to memory entries with category-based backfill defaults; add notes to the retrieval pipeline; refactor `buildSystemMessage()` to use strict layered budgets (identity block + task state block + doc index, removing the old bulk formatters); split the Memory page into Identity/Working sections with pin controls.

**Tech Stack:** React + custom localStorage store (useStore.js), vanilla JS (retrieve.js), TypeScript (flow-ai pipeline), Tailwind CSS (Memory UI), vitest (tests)

---

## File Structure

| File | Change |
|---|---|
| `src/store/useStore.js` | Add `IDENTITY_DEFAULT_CATEGORIES` const + `backfillIdentityPins()` fn; add `isIdentityPinned` to `addMemory`; add `pinMemoryAsIdentity` action |
| `src/store/__tests__/useStore.identity.test.js` | **New** — unit tests for `backfillIdentityPins` and `IDENTITY_DEFAULT_CATEGORIES` |
| `src/flow-ai/utils/hybridSearch.ts` | Add `'note'` to `CandidateType` union (line 17) |
| `src/flow-ai/services/contextBuilderService.ts` | Add `note: 'document-memory'` to `MEMORY_TYPE_LABEL` map |
| `src/flow-ai/services/retrievalService.ts` | Add `userNotes?` to `RetrievalInput`; export `buildNoteCandidates()`; filter pinned entries from `buildMemoryCandidates()` |
| `src/flow-ai/services/__tests__/buildNoteCandidates.test.ts` | **New** — unit tests for `buildNoteCandidates` |
| `src/lib/chat/retrieve.js` | Export `buildIdentityBlock()` + `buildTaskState()`; remove `formatMemoryBlock`, `formatTopicsBlock`, `formatNotesBlock`; refactor `buildSystemMessage()` with layered assembly + 10th `recentMessages` param; shrink `formatDocumentsIndexBlock` default limit 10 → 5 |
| `src/lib/chat/__tests__/retrieve.test.js` | **New** — unit tests for `buildIdentityBlock` and `buildTaskState` |
| `src/views/Chat.jsx` | Pass `userNotes` to `retrieveWithPipeline`; pass `recentMessages` slice as 10th arg to `buildSystemMessage` |
| `src/components/memory/MemoryEntryCard.jsx` | Add `onPin` prop and pin toggle button; pinned cards get accent left border |
| `src/views/Memory.jsx` | Import `pinMemoryAsIdentity`; split memory tab into Identity/Working sections |

---

### Task 1: Store — identity memory data model

**Files:**
- Modify: `src/store/useStore.js`
- Create: `src/store/__tests__/useStore.identity.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/store/__tests__/useStore.identity.test.js`:

```js
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../lib/search/queryIntent.js', () => ({
  classifyQueryIntent: vi.fn(),
  isFreshnessSensitiveQuery: vi.fn(),
}))
vi.mock('../../lib/llm/ollama.js', () => ({ generateSummary: vi.fn() }))
vi.mock('../../lib/llm/ollamaConfig.js', () => ({ OLLAMA_CONFIG: {} }))
vi.mock('../../lib/sync/fileSync.js', () => ({
  pullFromDisk: vi.fn(),
  pushToDisk: vi.fn(),
}))

import { backfillIdentityPins, IDENTITY_DEFAULT_CATEGORIES } from '../useStore.js'

describe('IDENTITY_DEFAULT_CATEGORIES', () => {
  it('includes identity-relevant categories', () => {
    expect(IDENTITY_DEFAULT_CATEGORIES.has('personal_rule')).toBe(true)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('preference')).toBe(true)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('behavior')).toBe(true)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('personal_fact')).toBe(true)
  })
  it('excludes non-identity categories', () => {
    expect(IDENTITY_DEFAULT_CATEGORIES.has('research_focus')).toBe(false)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('topic_rule')).toBe(false)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('source_pref')).toBe(false)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('personal_stack')).toBe(false)
  })
})

describe('backfillIdentityPins', () => {
  it('returns empty object for empty/null/undefined input', () => {
    expect(backfillIdentityPins({})).toEqual({})
    expect(backfillIdentityPins(null)).toEqual({})
    expect(backfillIdentityPins(undefined)).toEqual({})
  })
  it('sets isIdentityPinned=true for identity categories when field is absent', () => {
    const result = backfillIdentityPins({
      m1: { id: 'm1', category: 'personal_rule', content: 'Be direct' },
    })
    expect(result.m1.isIdentityPinned).toBe(true)
  })
  it('sets isIdentityPinned=false for non-identity categories when field is absent', () => {
    const result = backfillIdentityPins({
      m2: { id: 'm2', category: 'research_focus', content: 'AI agents' },
    })
    expect(result.m2.isIdentityPinned).toBe(false)
  })
  it('does not overwrite an existing isIdentityPinned value', () => {
    // research_focus is not an identity category, but user pinned it manually
    const result = backfillIdentityPins({
      m3: { id: 'm3', category: 'research_focus', content: 'test', isIdentityPinned: true },
    })
    expect(result.m3.isIdentityPinned).toBe(true)
  })
  it('preserves false when explicitly set', () => {
    const result = backfillIdentityPins({
      m4: { id: 'm4', category: 'personal_rule', content: 'test', isIdentityPinned: false },
    })
    expect(result.m4.isIdentityPinned).toBe(false)
  })
  it('preserves all other entry fields unchanged', () => {
    const result = backfillIdentityPins({
      m5: { id: 'm5', category: 'preference', content: 'always be direct', confidence: 0.9, status: 'active' },
    })
    expect(result.m5.content).toBe('always be direct')
    expect(result.m5.confidence).toBe(0.9)
    expect(result.m5.status).toBe('active')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/__tests__/useStore.identity.test.js`
Expected: FAIL — `backfillIdentityPins is not a function` (named export doesn't exist yet)

- [ ] **Step 3: Add `IDENTITY_DEFAULT_CATEGORIES` and `backfillIdentityPins` to `src/store/useStore.js`**

Insert the following two exports immediately before the `loadState` function (before line 43):

```js
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
```

- [ ] **Step 4: Modify `loadState()` to apply the backfill on load**

Replace the existing `loadState` function (lines 43-51):

```js
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
```

- [ ] **Step 5: Add `isIdentityPinned` to the entry object inside `addMemory`**

In `addMemory` (around line 254), replace the `entry` object literal:

```js
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
```

- [ ] **Step 6: Add `pinMemoryAsIdentity` action after `deleteMemory`**

After the `deleteMemory` callback (after line 289):

```js
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
```

- [ ] **Step 7: Add `pinMemoryAsIdentity` to the hook return object**

In the `return { ... }` block (line 722), add `pinMemoryAsIdentity` alongside the other memory actions:

```js
addMemory, updateMemory, deleteMemory, isMemoryDismissed, pinMemoryAsIdentity,
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/store/__tests__/useStore.identity.test.js`
Expected: PASS — 10 tests passing, 0 failing

- [ ] **Step 9: Commit**

```bash
git add src/store/useStore.js src/store/__tests__/useStore.identity.test.js
git commit -m "feat(store): add isIdentityPinned field and backfill to memory entries"
```

---

### Task 2: Type plumbing — add 'note' to CandidateType and MEMORY_TYPE_LABEL

**Files:**
- Modify: `src/flow-ai/utils/hybridSearch.ts`
- Modify: `src/flow-ai/services/contextBuilderService.ts`

- [ ] **Step 1: Add `'note'` to `CandidateType` in hybridSearch.ts**

Line 17 — replace:
```ts
export type CandidateType = 'document' | 'signal' | 'memory' | 'topic' | 'save'
```
With:
```ts
export type CandidateType = 'document' | 'signal' | 'memory' | 'topic' | 'save' | 'note'
```

- [ ] **Step 2: Add `note` entry to `MEMORY_TYPE_LABEL` in contextBuilderService.ts**

Lines 19-25 — replace the `MEMORY_TYPE_LABEL` map:
```ts
const MEMORY_TYPE_LABEL: Record<string, string> = {
  document: 'document-memory',
  signal:   'signal-memory',
  memory:   'behavior-memory',
  topic:    'topic-memory',
  save:     'document-memory',   // saved web content treated as document memory
  note:     'document-memory',   // user notes treated as document memory
}
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: same pass count as before this task, 0 new failures

- [ ] **Step 4: Commit**

```bash
git add src/flow-ai/utils/hybridSearch.ts src/flow-ai/services/contextBuilderService.ts
git commit -m "feat(pipeline): add note to CandidateType and MEMORY_TYPE_LABEL"
```

---

### Task 3: Pipeline — notes candidates + identity pin exclusion

**Files:**
- Modify: `src/flow-ai/services/retrievalService.ts`
- Create: `src/flow-ai/services/__tests__/buildNoteCandidates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/flow-ai/services/__tests__/buildNoteCandidates.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildNoteCandidates } from '../retrievalService.js'

const BASE_INPUT = {
  query: 'test',
  documents: {},
  documentContents: {},
  memoryEntries: {},
  saves: {},
  views: {},
  userTopics: {},
}

describe('buildNoteCandidates', () => {
  it('returns [] when userNotes is absent', () => {
    expect(buildNoteCandidates(BASE_INPUT)).toEqual([])
  })

  it('returns [] when userNotes is an empty object', () => {
    expect(buildNoteCandidates({ ...BASE_INPUT, userNotes: {} })).toEqual([])
  })

  it('maps a single flat-object note to one SearchCandidate', () => {
    const result = buildNoteCandidates({
      ...BASE_INPUT,
      userNotes: { item_abc: { content: 'This is my note' } },
    })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('note')
    expect(result[0].snippet).toBe('This is my note')
    expect(result[0].searchBody).toBe('This is my note')
    expect(result[0].sourceLabel).toBe('Note')
    expect(result[0].id).toBe('note_item_abc_0')
  })

  it('maps an array of notes to one candidate per entry', () => {
    const result = buildNoteCandidates({
      ...BASE_INPUT,
      userNotes: { item_abc: [{ content: 'First' }, { content: 'Second' }] },
    })
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('note_item_abc_0')
    expect(result[1].id).toBe('note_item_abc_1')
  })

  it('skips entries with empty or whitespace-only content', () => {
    const result = buildNoteCandidates({
      ...BASE_INPUT,
      userNotes: {
        item_abc: [{ content: '' }, { content: '   ' }, { content: 'Valid note' }],
      },
    })
    expect(result).toHaveLength(1)
    expect(result[0].snippet).toBe('Valid note')
  })

  it('truncates snippet to 300 chars but preserves full searchBody', () => {
    const long = 'x'.repeat(400)
    const result = buildNoteCandidates({
      ...BASE_INPUT,
      userNotes: { item_abc: { content: long } },
    })
    expect(result[0].snippet).toHaveLength(300)
    expect(result[0].searchBody).toHaveLength(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/flow-ai/services/__tests__/buildNoteCandidates.test.ts`
Expected: FAIL — `buildNoteCandidates is not exported from retrievalService`

- [ ] **Step 3: Add `userNotes?` to `RetrievalInput` in retrievalService.ts**

In the `RetrievalInput` interface (lines 32-50), add after the `signals?` line:

```ts
  userNotes?:    Record<string, any>    // useStore.userNotes
```

- [ ] **Step 4: Export `buildNoteCandidates` function**

Add after the closing brace of `buildSaveCandidates` (after line ~231):

```ts
export function buildNoteCandidates(input: RetrievalInput): SearchCandidate[] {
  const notes = input.userNotes
  if (!notes || Object.keys(notes).length === 0) return []
  const candidates: SearchCandidate[] = []
  for (const [itemId, raw] of Object.entries(notes)) {
    const entries: any[] = Array.isArray(raw) ? raw : (raw?.content ? [raw] : [])
    entries.forEach((n, idx) => {
      const text = String(n?.content ?? '').trim()
      if (!text) return
      candidates.push({
        id:          `note_${itemId}_${idx}`,
        type:        'note' as const,
        title:       itemId,
        snippet:     text.slice(0, 300),
        searchBody:  text,
        date:        n.updatedAt ?? n.addedAt,
        hasSummary:  true,
        wordCount:   text.split(/\s+/).length,
        sourceLabel: 'Note',
      })
    })
  }
  return candidates
}
```

- [ ] **Step 5: Filter pinned entries out of `buildMemoryCandidates`**

In `buildMemoryCandidates` (around line 153), add `&& m.isIdentityPinned !== true` to the `.filter()` call:

```ts
function buildMemoryCandidates(input: RetrievalInput): SearchCandidate[] {
  return Object.values(input.memoryEntries)
    .filter((m) => m.status !== 'dismissed' && m.isIdentityPinned !== true)
    .map((mem) => ({
      id:          mem.id,
      type:        'memory' as const,
      title:       mem.category ? `[${mem.category}] ${mem.content.slice(0, 60)}` : mem.content.slice(0, 60),
      snippet:     mem.content,
      searchBody:  `${mem.category ?? ''} ${mem.content}`,
      date:        mem.addedAt,
      hasSummary:  true,
      wordCount:   mem.content.split(/\s+/).length,
      sourceLabel: 'Memory',
    }))
}
```

- [ ] **Step 6: Add `buildNoteCandidates` to `buildCandidates`**

In `buildCandidates` (around line 118):

```ts
function buildCandidates(input: RetrievalInput): SearchCandidate[] {
  return [
    ...buildDocumentCandidates(input),
    ...buildMemoryCandidates(input),
    ...buildSignalCandidates(input),
    ...buildTopicCandidates(input),
    ...buildSaveCandidates(input),
    ...buildNoteCandidates(input),
  ]
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/flow-ai/services/__tests__/buildNoteCandidates.test.ts`
Expected: PASS — 6 tests passing

- [ ] **Step 8: Run full suite to confirm no regressions**

Run: `npx vitest run`
Expected: same pass count as before plus 6 new

- [ ] **Step 9: Commit**

```bash
git add src/flow-ai/services/retrievalService.ts src/flow-ai/services/__tests__/buildNoteCandidates.test.ts
git commit -m "feat(pipeline): add note candidates and exclude pinned memory from retrieval"
```

---

### Task 4: retrieve.js — buildIdentityBlock and buildTaskState

**Files:**
- Modify: `src/lib/chat/retrieve.js`
- Create: `src/lib/chat/__tests__/retrieve.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/chat/__tests__/retrieve.test.js`:

```js
import { vi, describe, it, expect } from 'vitest'

// Isolate from pipeline imports that have browser-specific dependencies
vi.mock('../../../flow-ai/services/retrievalService.js', () => ({
  retrieve: vi.fn(),
}))
vi.mock('../../../flow-ai/services/contextBuilderService.js', () => ({
  buildContext: vi.fn(),
}))

import { buildIdentityBlock, buildTaskState } from '../retrieve.js'

// ─── buildIdentityBlock ───────────────────────────────────────────────────────

describe('buildIdentityBlock', () => {
  it('returns "" for empty/null/undefined input', () => {
    expect(buildIdentityBlock([])).toBe('')
    expect(buildIdentityBlock(null)).toBe('')
    expect(buildIdentityBlock(undefined)).toBe('')
  })

  it('returns "" when no entries are pinned', () => {
    const entries = [
      { id: 'm1', content: 'focus on AI', status: 'active', isIdentityPinned: false },
    ]
    expect(buildIdentityBlock(entries)).toBe('')
  })

  it('builds a [IDENTITY] block from a single pinned active entry', () => {
    const entries = [
      { id: 'm1', content: 'Call me Uche', status: 'active', isIdentityPinned: true },
    ]
    expect(buildIdentityBlock(entries)).toBe('[IDENTITY]\n- Call me Uche\n\n')
  })

  it('excludes dismissed entries even if pinned', () => {
    const entries = [
      { id: 'm1', content: 'Be direct', status: 'dismissed', isIdentityPinned: true },
      { id: 'm2', content: 'No emoji', status: 'active', isIdentityPinned: true },
    ]
    const result = buildIdentityBlock(entries)
    expect(result).toContain('No emoji')
    expect(result).not.toContain('Be direct')
  })

  it('truncates each entry content to 100 chars', () => {
    const long = 'a'.repeat(150)
    const entries = [{ id: 'm1', content: long, status: 'active', isIdentityPinned: true }]
    const result = buildIdentityBlock(entries)
    expect(result).toContain('- ' + 'a'.repeat(100))
    expect(result).not.toContain('a'.repeat(101))
  })

  it('caps at 8 pinned entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      content: `Rule ${i}`,
      status: 'active',
      isIdentityPinned: true,
      addedAt: `2026-01-${String(i + 1).padStart(2, '0')}`,
    }))
    const result = buildIdentityBlock(entries)
    const lines = result.trim().split('\n')
    // [IDENTITY] header + 8 bullet lines = 9 lines total
    expect(lines).toHaveLength(9)
  })

  it('sorts pinned entries by addedAt descending (most recent first)', () => {
    const entries = [
      { id: 'm1', content: 'Older rule', status: 'active', isIdentityPinned: true, addedAt: '2026-01-01' },
      { id: 'm2', content: 'Newer rule', status: 'active', isIdentityPinned: true, addedAt: '2026-02-01' },
    ]
    const result = buildIdentityBlock(entries)
    expect(result.indexOf('Newer rule')).toBeLessThan(result.indexOf('Older rule'))
  })
})

// ─── buildTaskState ───────────────────────────────────────────────────────────

describe('buildTaskState', () => {
  it('returns "" for empty/null/undefined messages', () => {
    expect(buildTaskState([], 'hi')).toBe('')
    expect(buildTaskState(null, 'hi')).toBe('')
    expect(buildTaskState(undefined, 'hi')).toBe('')
  })

  it('returns "" when no assistant message exists', () => {
    const msgs = [{ role: 'user', content: 'hello' }]
    expect(buildTaskState(msgs, 'hi')).toBe('')
  })

  it('derives task state from the last assistant message', () => {
    const msgs = [
      { role: 'user', content: 'explain AI agents' },
      { role: 'assistant', content: 'AI agents are autonomous programs that can use tools.' },
    ]
    const result = buildTaskState(msgs, 'tell me more')
    expect(result).toContain('Task state: continuing from "AI agents are autonomous programs')
    expect(result).toMatch(/\n\n$/)
  })

  it('uses the LAST assistant message when there are multiple', () => {
    const msgs = [
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: 'ok' },
      { role: 'assistant', content: 'Second response' },
    ]
    const result = buildTaskState(msgs, 'continue')
    expect(result).toContain('Second response')
    expect(result).not.toContain('First response')
  })

  it('truncates summary to 100 chars', () => {
    const msgs = [{ role: 'assistant', content: 'x'.repeat(200) }]
    const result = buildTaskState(msgs, 'next')
    const match = result.match(/"([^"]+)"/)
    expect(match).not.toBeNull()
    expect(match[1].length).toBeLessThanOrEqual(100)
  })

  it('collapses whitespace in the assistant content', () => {
    const msgs = [
      { role: 'assistant', content: 'Here is\na multi\n\nline response.' },
    ]
    const result = buildTaskState(msgs, 'continue')
    expect(result).toContain('Here is a multi')
    // No newlines inside the quoted summary
    expect(result.match(/"([^"]+)"/)[1]).not.toContain('\n')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/chat/__tests__/retrieve.test.js`
Expected: FAIL — `buildIdentityBlock is not a function` / `buildTaskState is not a function`

- [ ] **Step 3: Implement `buildIdentityBlock` and `buildTaskState` in retrieve.js**

Add the following block in `src/lib/chat/retrieve.js`, immediately before the `// ─── FlowMap app knowledge ─` section (before the `FLOWMAP_APP_KNOWLEDGE` const):

```js
// ─── Layered context helpers ──────────────────────────────────────────────────

// Build the [IDENTITY] block from user-pinned memory entries.
// Only pinned, active entries are included — capped at 8, sorted by addedAt
// desc, content truncated to 100 chars per line (~120 tokens total max).
export function buildIdentityBlock(memoryEntries) {
  if (!memoryEntries || memoryEntries.length === 0) return ''
  const pinned = memoryEntries
    .filter((m) => m.isIdentityPinned === true && (m.status || 'active') === 'active' && m.content)
    .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
    .slice(0, 8)
  if (pinned.length === 0) return ''
  const lines = pinned.map((m) => `- ${String(m.content).slice(0, 100)}`)
  return `[IDENTITY]\n${lines.join('\n')}\n\n`
}

// Build a one-line task state from recent conversation history.
// Finds the last assistant message, collapses whitespace, and truncates to
// 100 chars. Returns '' when there is no prior assistant context.
export function buildTaskState(recentMessages, _currentQuery) {
  if (!recentMessages || recentMessages.length === 0) return ''
  const lastAssistant = [...recentMessages].reverse().find((m) => m.role === 'assistant')
  if (!lastAssistant) return ''
  const summary = String(lastAssistant.content || '').replace(/\s+/g, ' ').trim().slice(0, 100)
  if (!summary) return ''
  return `Task state: continuing from "${summary}"\n\n`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/chat/__tests__/retrieve.test.js`
Expected: PASS — 13 tests passing, 0 failing

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/retrieve.js src/lib/chat/__tests__/retrieve.test.js
git commit -m "feat(retrieve): add buildIdentityBlock and buildTaskState helpers"
```

---

### Task 5: retrieve.js — refactor buildSystemMessage to layered assembly

**Files:**
- Modify: `src/lib/chat/retrieve.js`

- [ ] **Step 1: Delete `formatTopicsBlock`**

Remove the entire `formatTopicsBlock` function (the one that produces `TOPICS (user's research areas...)\n...`). It spans from the `const TOPICS_LIMIT = 20` line through the closing `}` of the function.

- [ ] **Step 2: Delete `formatNotesBlock`**

Remove the entire `formatNotesBlock` function (the one that produces `USER NOTES (the user's own commentary...)\n...`). It spans from the `const NOTES_LIMIT = 8` line through the closing `}`.

- [ ] **Step 3: Delete `formatMemoryBlock`**

Remove the entire `formatMemoryBlock` function (the one that produces `USER MEMORY (facts and preferences...)\n...`). It spans from the `const MEMORY_LIMIT = 15` line through the closing `}`.

- [ ] **Step 4: Shrink `formatDocumentsIndexBlock` default limit**

In the `formatDocumentsIndexBlock` signature, change the default from `limit = 10` to `limit = 5`:

```js
function formatDocumentsIndexBlock(documents, folders = {}, limit = 5) {
```

- [ ] **Step 5: Update the `buildSystemMessage` signature**

Replace the current signature line:

```js
export function buildSystemMessage(retrieved, userQuery = '', memoryEntries = [], topics = [], notes = [], intent = 'retrieval_request', folders = {}, overrideContextText = null, allDocuments = []) {
```

With:

```js
export function buildSystemMessage(retrieved, userQuery = '', allMemory = [], _topics = [], _notes = [], intent = 'retrieval_request', folders = {}, overrideContextText = null, allDocuments = [], recentMessages = []) {
```

(`_topics` and `_notes` are kept to avoid breaking existing call sites that pass positional args, but are no longer used inside the function.)

- [ ] **Step 6: Replace the old variable block at the top of `buildSystemMessage`**

Remove these four variable declarations (they reference the deleted functions):

```js
const memoryBlock = formatMemoryBlock(memoryEntries)
const notesBlock = formatNotesBlock(notes)
const isReadDirective = isReadDocIntent(userQuery) && retrieved.length > 0
const topicsBlock = isReadDirective ? '' : formatTopicsBlock(topics)
const docIndexBlock = isReadDirective ? '' : formatDocumentsIndexBlock(allDocuments, folders)
```

Replace with:

```js
const identityBlock  = buildIdentityBlock(allMemory)
const taskStateBlock = buildTaskState(recentMessages, userQuery)
const isReadDirective = isReadDocIntent(userQuery) && retrieved.length > 0
const docIndexBlock   = isReadDirective ? '' : formatDocumentsIndexBlock(allDocuments, folders)
```

- [ ] **Step 7: Fix the meta question path**

Find the meta question early-return block:

```js
if (isMetaSystemQuestion(userQuery)) {
  const tail = [memoryBlock, topicsBlock, notesBlock].filter(Boolean).join('')
  return tail ? `${META_SYSTEM_MESSAGE}\n\n${tail}` : META_SYSTEM_MESSAGE
}
```

Replace with:

```js
if (isMetaSystemQuestion(userQuery)) {
  return identityBlock
    ? `${META_SYSTEM_MESSAGE}\n\n${identityBlock}`
    : META_SYSTEM_MESSAGE
}
```

- [ ] **Step 8: Fix the no-results return path**

Find the `return (...)` inside `if ((!retrieved || retrieved.length === 0) && !overrideContextText)`. Replace every occurrence of `memoryBlock + topicsBlock + ... + notesBlock` in that return with the new sequence:

Old sequence in that return:
```js
preamble +
memoryBlock +
topicsBlock +
docIndexBlock +
notesBlock +
signalInstruction +
```

New sequence:
```js
preamble +
identityBlock +
taskStateBlock +
docIndexBlock +
signalInstruction +
```

- [ ] **Step 9: Fix the pipeline context return path (overrideContextText)**

Find the `return (...)` inside `if (overrideContextText)`. Apply the same substitution:

Old:
```js
preamble +
memoryBlock +
topicsBlock +
docIndexBlock +
notesBlock +
signalInstruction +
```

New:
```js
preamble +
identityBlock +
taskStateBlock +
docIndexBlock +
signalInstruction +
```

- [ ] **Step 10: Fix the legacy keyword retrieval return path**

Find the final `return (...)` at the bottom of `buildSystemMessage` (the EXCERPTS path). Apply the same substitution:

Old:
```js
preamble +
memoryBlock +
topicsBlock +
docIndexBlock +
notesBlock +
signalInstruction +
```

New:
```js
preamble +
identityBlock +
taskStateBlock +
docIndexBlock +
signalInstruction +
```

- [ ] **Step 11: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (including the retrieve.test.js from Task 4)

- [ ] **Step 12: Commit**

```bash
git add src/lib/chat/retrieve.js
git commit -m "refactor(retrieve): layered buildSystemMessage — identity + task state blocks, remove bulk formatters"
```

---

### Task 6: Chat.jsx — wire userNotes and recentMessages

**Files:**
- Modify: `src/views/Chat.jsx`

- [ ] **Step 1: Add `userNotes` to the `retrieveWithPipeline` input object**

In `handleSend`, find the `retrieveWithPipeline` call (around line 793). Add `userNotes` to the input object — it is already destructured from `useStore()` at line 602, so no new import is needed:

```js
pipelineResult = await retrieveWithPipeline(
  {
    query:            text,
    documents,
    documentContents,
    memoryEntries,
    saves,
    views:            {},
    userTopics,
    seedTopics,
    signals:          localSignalsStorage.listSignals(),
    userNotes,
  },
  ctrl.signal,
)
```

- [ ] **Step 2: Move the `allRecent` computation before `buildSystemMessage`**

Currently `allRecent` is computed on the line after `buildSystemMessage` is called. Find these two blocks around lines 850-862 and swap their order so `allRecent` is computed first:

```js
// Compute allRecent BEFORE buildSystemMessage so we can pass it as recentMessages
const allRecent = chatMessagesFor(convId) // includes the user msg we just added
const systemMessage = buildSystemMessage(
  retrieved, text, allMemory, allTopics, allNotes, intent, folders,
  pipelineResult?.contextText ?? null,
  allDocs,
  allRecent.slice(-4, -1),
)
// Cap history at MAX_HISTORY for LLM messages
const MAX_HISTORY = 12
const recent = allRecent.length > MAX_HISTORY ? allRecent.slice(-MAX_HISTORY) : allRecent
```

(`allRecent.slice(-4, -1)` passes the 3 messages immediately before the current user message — providing the assistant's last reply as the task state anchor while excluding the just-added user message itself.)

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 4: Smoke test in the app**

Start the dev server: `npm run dev`
- Open Chat, send a message and wait for a reply
- Send a follow-up question
- Open DevTools → Network → Ollama request body
- Confirm the system message:
  - Contains `[IDENTITY]` block if any memory entries have `isIdentityPinned: true`
  - Contains `Task state: continuing from "..."` on the second message
  - Does NOT contain `USER MEMORY:` or `TOPICS (user's research areas` headers (bulk formatters removed)
- Confirm no console errors

- [ ] **Step 5: Commit**

```bash
git add src/views/Chat.jsx
git commit -m "feat(chat): wire userNotes to pipeline and recentMessages to buildSystemMessage"
```

---

### Task 7: Memory UI — pin button and Identity/Working split

**Files:**
- Modify: `src/components/memory/MemoryEntryCard.jsx`
- Modify: `src/views/Memory.jsx`

- [ ] **Step 1: Rewrite `src/components/memory/MemoryEntryCard.jsx`**

Replace the entire file:

```jsx
import { Trash2, Pin, PinOff } from 'lucide-react'
import Pill from '../ui/Pill.jsx'

const CATEGORY = {
  topic_rule:     { label: 'Topic Rule',     color: '#6366f1' },
  source_pref:    { label: 'Source Pref',    color: '#14b8a6' },
  research_focus: { label: 'Research Focus', color: '#3b82f6' },
  personal_stack: { label: 'Personal Stack', color: '#d946ef' },
  personal_rule:  { label: 'Personal Rule',  color: '#f59e0b' },
  preference:     { label: 'Preference',     color: '#10b981' },
  behavior:       { label: 'Behavior',       color: '#8b5cf6' },
  personal_fact:  { label: 'Personal Fact',  color: '#ec4899' },
}

const STATUS_TONE = {
  validated: 'positive',
  active:    'accent',
  learning:  'warning',
}

export default function MemoryEntryCard({ entry, onDelete, onPin }) {
  const cat = CATEGORY[entry.category] || { label: entry.category, color: '#94a3b8' }
  const isSeed   = String(entry.id || '').startsWith('mem_seed_')
  const isPinned = entry.isIdentityPinned === true

  return (
    <article
      className={`glass-panel p-4 group flex flex-col gap-3 relative rounded-b-none ${
        isPinned ? 'border-l-2 border-[color:var(--color-topic)]/40' : ''
      }`}
    >
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
        <div className="flex items-center gap-1">
          {onPin && !isSeed ? (
            <button
              onClick={() => onPin(entry.id, !isPinned)}
              title={isPinned ? 'Unpin from identity memory' : 'Pin to identity memory'}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${
                isPinned
                  ? 'text-[color:var(--color-topic)] hover:bg-[color:var(--color-topic)]/10'
                  : 'text-white/40 hover:bg-white/10 hover:text-white/70'
              }`}
            >
              {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          ) : null}
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
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5 overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${Math.round((entry.confidence ?? 1) * 100)}%`, background: cat.color }}
        />
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Add `Pin` to the lucide-react import in Memory.jsx**

Line 3 — add `Pin` to the existing import:

```js
import { Plus, Bookmark, BookmarkX, Database, Sparkles, Link as LinkIcon, Brain, Pin } from 'lucide-react'
```

- [ ] **Step 3: Add `pinMemoryAsIdentity` to the `useStore()` destructure**

Line 33 — add `pinMemoryAsIdentity` to the destructure:

```js
const {
  saves, follows, toggleFollow, memoryEntries, addMemory, deleteMemory, isMemoryDismissed,
  userTopics, removeUserTopic, manualContent, pinMemoryAsIdentity,
} = useStore()
```

- [ ] **Step 4: Replace the `filteredMemory` computation with the Identity/Working split**

Line 80 — replace the single `filteredMemory` line with:

```js
const identityMemory  = allMemory.filter((m) => m.isIdentityPinned === true)
const workingMemory   = allMemory.filter((m) => !m.isIdentityPinned)
const filteredWorking = catFilter === 'all'
  ? workingMemory
  : workingMemory.filter((m) => m.category === catFilter)
const pinnedCount = identityMemory.length
```

(`allMemory` on line 79 is unchanged and still used for the tab count badge.)

- [ ] **Step 5: Replace the memory tab JSX block**

Replace the entire `{tab === 'memory' && (...)}` block (lines 193-235) with:

```jsx
{tab === 'memory' && (
  <div className="space-y-6">
    {/* ── Identity Memory ──────────────────────────────────────────── */}
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[color:var(--color-text-secondary)] flex items-center gap-1.5">
          <Pin size={13} className="text-[color:var(--color-topic)]" />
          Identity Memory
          <span className="text-xs text-white/30 font-normal">({pinnedCount} / 8)</span>
        </h3>
        {pinnedCount >= 8 && (
          <span className="text-[10px] text-amber-400/70">
            Soft cap reached — unpin an entry to add more
          </span>
        )}
      </div>
      {identityMemory.length === 0 ? (
        <p className="text-xs text-[color:var(--color-text-tertiary)] py-3">
          No identity memory pinned yet. Pin entries below to always include them in AI context.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
          {identityMemory.map((entry) => (
            <MemoryEntryCard
              key={entry.id}
              entry={entry}
              onDelete={askDeleteMemory}
              onPin={pinMemoryAsIdentity}
            />
          ))}
        </div>
      )}
    </div>

    {/* ── Working Memory ───────────────────────────────────────────── */}
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
        <h3 className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
          Working Memory
        </h3>
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

      {filteredWorking.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[color:var(--color-bg-glass-strong)] border border-[color:var(--color-border-default)] flex items-center justify-center mb-3">
            <Database size={20} className="text-[color:var(--color-text-tertiary)]" />
          </div>
          <p className="text-sm text-[color:var(--color-text-tertiary)] max-w-md">
            No memory entries in this category. Add a rule, source preference, research focus, or stack note above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,300px)] gap-3">
          {filteredWorking.map((entry) => (
            <MemoryEntryCard
              key={entry.id}
              entry={entry}
              onDelete={askDeleteMemory}
              onPin={pinMemoryAsIdentity}
            />
          ))}
        </div>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass

- [ ] **Step 7: Smoke test the Memory UI**

Start dev server: `npm run dev`, navigate to `/memory` → Memory Entries tab:

- Confirm "Identity Memory" section appears above "Working Memory"
- Hover a non-seed card → Pin button appears
- Click Pin → card moves to Identity section, count badge increments
- Click PinOff on it → card returns to Working section
- Confirm seed entries (`mem_seed_*`) show no pin button
- Add a new memory entry with category `personal_rule` → confirm it auto-appears in Identity section
- Confirm `pinnedCount / 8` badge in Identity Memory header is accurate

- [ ] **Step 8: Commit**

```bash
git add src/components/memory/MemoryEntryCard.jsx src/views/Memory.jsx
git commit -m "feat(memory-ui): identity/working split with pin controls"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered in task |
|---|---|
| `isIdentityPinned` field on memory entries | Task 1 |
| Category-based backfill defaults (`personal_rule`, `preference`, `behavior`, `personal_fact`) | Task 1 |
| `backfillIdentityPins()` runs in `loadState()` (idempotent) | Task 1 |
| `pinMemoryAsIdentity(id, pinned)` store action | Task 1 |
| `'note'` type in `CandidateType` union | Task 2 |
| `note: 'document-memory'` in `MEMORY_TYPE_LABEL` | Task 2 |
| Notes enter the retrieval pipeline | Task 3 |
| Pinned memory excluded from retrieval (only goes through identity block) | Task 3 |
| `buildNoteCandidates()` exported and tested | Task 3 |
| `buildIdentityBlock()` exported and tested | Task 4 |
| `buildTaskState()` exported and tested | Task 4 |
| `buildSystemMessage()` uses identity block instead of `formatMemoryBlock` | Task 5 |
| `formatMemoryBlock`, `formatTopicsBlock`, `formatNotesBlock` removed | Task 5 |
| `recentMessages` 10th param on `buildSystemMessage()` | Task 5 |
| `formatDocumentsIndexBlock` limit shrunk 10 → 5 | Task 5 |
| `userNotes` passed to `retrieveWithPipeline` | Task 6 |
| `recentMessages` slice passed to `buildSystemMessage` | Task 6 |
| Memory page splits into Identity / Working sections | Task 7 |
| Pin/unpin button on each non-seed `MemoryEntryCard` | Task 7 |
| Seed entries (`mem_seed_*`) cannot be pinned | Task 7 |
| Soft cap indicator at 8 pinned entries | Task 7 |
| Pinned cards get accent left border | Task 7 |

### Type consistency check

- `buildIdentityBlock(memoryEntries: any[])` — receives `allMemory` (array) from Chat.jsx; same shape that `formatMemoryBlock` previously received ✓
- `buildTaskState(recentMessages: {role, content}[], currentQuery: string)` — receives `allRecent.slice(-4, -1)` (array of chat messages) ✓
- `buildNoteCandidates(input: RetrievalInput)` — `userNotes` field added to `RetrievalInput` in Task 3 before this function uses it ✓
- `pinMemoryAsIdentity(id: string, pinned: boolean)` — added to store in Task 1, destructured in Memory.jsx in Task 7 ✓
- `onPin` prop on `MemoryEntryCard` — added in Task 7 Step 1; passed in Task 7 Step 5 ✓
