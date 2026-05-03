# Flow AI Layered Context Retrieval — Design

> **For agentic workers:** use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Replace the current bulk-injection prompt assembly with a strict layered context model, add user-controlled identity memory pinning, and route all non-identity knowledge exclusively through the existing ranked retrieval pipeline.

**Architecture:** Four prompt layers (identity, task state, static app context, ranked knowledge) each with hard token budgets. The store gains an `isIdentityPinned` boolean on memory entries. Notes are added to the retrieval pipeline so they rank alongside documents and topics instead of being dumped unconditionally.

**Tech stack:** React + Zustand (store), vanilla JS (retrieve.js prompt assembly), TypeScript (flow-ai pipeline services), Tailwind (Memory UI).

---

## Problem being solved

`buildSystemMessage()` unconditionally injects:
- up to 15 memory entries (`formatMemoryBlock`)
- up to 20 topics (`formatTopicsBlock`)
- up to 8 user notes (`formatNotesBlock`)
- up to 10 document index entries

This runs on every non-casual turn regardless of relevance. The result is a broad, noisy context payload that competes with the pipeline's ranked output and wastes tokens on every query.

---

## Files to create or modify

| File | Action | Purpose |
|---|---|---|
| `src/store/useStore.js` | Modify | Add `isIdentityPinned` field, `pinMemoryAsIdentity()` action, backfill on hydration |
| `src/lib/chat/retrieve.js` | Modify | Refactor `buildSystemMessage()` to layered model; add `buildIdentityBlock()`, `buildTaskState()`; remove three bulk-inject formatters |
| `src/flow-ai/services/retrievalService.ts` | Modify | Add `userNotes` to `RetrievalInput`; add `buildNoteCandidates()`; filter pinned entries from `buildMemoryCandidates()` |
| `src/flow-ai/utils/hybridSearch.ts` | Modify | Add `'note'` to `SearchCandidate['type']` union |
| `src/flow-ai/services/contextBuilderService.ts` | Modify | Add `'note'` entry to `MEMORY_TYPE_LABEL` map |
| `src/views/Memory.jsx` | Modify | Split into Identity Memory + Working Memory sections; add count indicator |
| `src/components/memory/MemoryEntryCard.jsx` | Modify | Add pin toggle button; visual state for pinned entries |
| `src/views/Chat.jsx` | Modify | Pass recent message history to `buildSystemMessage()` and `userNotes` to pipeline |

---

## Data model

### Memory entry schema addition

```ts
// Added to every memory entry object
isIdentityPinned?: boolean   // undefined = not yet decided; true = always inject; false = retrieval only
```

### Identity default categories

On first store hydration, any entry where `isIdentityPinned` is `undefined` is backfilled:
- Set to `true` if category is one of: `personal_rule`, `preference`, `behavior`, `personal_fact`
- Set to `false` for all other categories

This backfill runs only once and never overwrites an explicit user decision.

---

## Store changes (`useStore.js`)

### New action: `pinMemoryAsIdentity(id, pinned)`

```js
pinMemoryAsIdentity(id, pinned) {
  set((state) => ({
    memoryEntries: {
      ...state.memoryEntries,
      [id]: { ...state.memoryEntries[id], isIdentityPinned: pinned },
    },
  }))
}
```

### Backfill on hydration

In the store's hydration/initialisation path, after loading `memoryEntries`:

```js
const IDENTITY_DEFAULT_CATEGORIES = new Set(['personal_rule', 'preference', 'behavior', 'personal_fact'])

function backfillIdentityPins(entries) {
  const result = {}
  for (const [id, entry] of Object.entries(entries)) {
    if (entry.isIdentityPinned !== undefined) {
      result[id] = entry
    } else {
      result[id] = {
        ...entry,
        isIdentityPinned: IDENTITY_DEFAULT_CATEGORIES.has(entry.category),
      }
    }
  }
  return result
}
```

---

## Prompt assembly refactor (`retrieve.js`)

### Layer budget table

| Layer | Always injected | Budget |
|---|---|---|
| Personality + links | Yes | ~200 tokens (static, unchanged) |
| Identity memory | Yes | Max 8 entries, 100 chars each, ~100 tokens |
| Task state | When confident | 1 line, max 80 chars, ~20 tokens |
| FlowMap app knowledge | Yes | ~150 tokens (static, unchanged) |
| Actions block | Task turns only | ~150 tokens (static, unchanged) |
| Document index | Non-casual, max 5 | ~80 tokens |
| Signal instructions | Signal turns only | ~100 tokens (static, unchanged) |
| Turn banner + rules | Yes | ~200 tokens (static, unchanged) |
| Retrieved knowledge | When pipeline returns results | Max 3 200 chars (~800 tokens) |

### `buildIdentityBlock(memoryEntries)`

New function. Takes the full `memoryEntries` object, filters to pinned entries, returns a formatted block or empty string.

```js
const IDENTITY_MAX = 8
const IDENTITY_CHAR_CAP = 100

function buildIdentityBlock(memoryEntries) {
  const pinned = Object.values(memoryEntries || {})
    .filter((m) => m.isIdentityPinned === true && m.content && (m.status || 'active') === 'active')
    .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
    .slice(0, IDENTITY_MAX)

  if (pinned.length === 0) return ''

  const lines = pinned.map((m) => {
    const cat = String(m.category || 'note').replace(/_/g, ' ')
    const text = String(m.content).trim().slice(0, IDENTITY_CHAR_CAP)
    return `- [${cat}] ${text}`
  })
  return `IDENTITY:\n${lines.join('\n')}\n\n`
}
```

### `buildTaskState(recentMessages, currentQuery)`

```js
// recentMessages: Array<{ role: 'user' | 'assistant', content: string }>
//                 The last 1–3 messages BEFORE the current user turn.
// currentQuery:   string — the user's new message.
// Returns:        string — a single Task state: line, or '' to omit.
```

Pure function — no async, no LLM. Returns a single line or empty string.

```js
const TASK_STATE_MAX_CHARS = 80
const FOLLOW_UP_SIGNALS = /^(and|but|so|why|how|what about|ok but|also|wait|actually|explain|more|then|plus|follow.?up)\b/i
const CONTINUATION_SIGNALS = /\b(first|second|next|then|finally|step \d|numbered)\b/i

function buildTaskState(recentMessages, currentQuery) {
  const q = String(currentQuery || '').trim()
  if (!q || q.split(/\s+/).length < 3) return ''

  // Casual or too short — skip
  if (CASUAL_PATTERNS.some((p) => p.test(q))) return ''

  // Self-contained and substantive — use current message directly
  const wordCount = q.split(/\s+/).length
  if (wordCount >= 6 && !FOLLOW_UP_SIGNALS.test(q)) {
    const label = q.slice(0, TASK_STATE_MAX_CHARS)
    return `Task state: ${label}${q.length > TASK_STATE_MAX_CHARS ? '…' : ''}\n\n`
  }

  // Follow-up fragment — look back at previous user message
  const prevUserMsg = [...(recentMessages || [])]
    .reverse()
    .find((m) => m.role === 'user' && m.content !== q)
  if (!prevUserMsg) return ''

  const prevContent = String(prevUserMsg.content || '').trim()
  const prevWords = prevContent.split(/\s+/).length
  if (prevWords < 4) return ''

  // Check if the previous assistant was mid-answer (continuation)
  const prevAssistant = [...(recentMessages || [])]
    .reverse()
    .find((m) => m.role === 'assistant')
  const isContinuation = prevAssistant && CONTINUATION_SIGNALS.test(prevAssistant.content || '')

  const base = prevContent.slice(0, 60)
  const qualifier = q.slice(0, 20)
  if (isContinuation) {
    return `Task state: Continuing — ${base}${prevContent.length > 60 ? '…' : ''}\n\n`
  }
  return `Task state: ${base}${prevContent.length > 60 ? '…' : ''} — ${qualifier}\n\n`
}
```

### `buildSystemMessage()` new structure

Remove `formatMemoryBlock`, `formatTopicsBlock`, `formatNotesBlock` entirely.

New assembly order:

```js
export function buildSystemMessage(
  retrieved, userQuery, memoryEntries, _topics, _notes, intent,
  folders, overrideContextText, allDocuments, recentMessages
) {
  if (intent === 'casual_chat') return CASUAL_SYSTEM_MESSAGE

  const identityBlock  = buildIdentityBlock(memoryEntries)
  const taskStateBlock = buildTaskState(recentMessages, userQuery)
  const isReadDirective = isReadDocIntent(userQuery) && retrieved.length > 0
  const docIndexBlock  = isReadDirective ? '' : formatDocumentsIndexBlock(allDocuments, folders, 5)

  if (isMetaSystemQuestion(userQuery)) {
    return identityBlock
      ? `${META_SYSTEM_MESSAGE}\n\n${identityBlock}`
      : META_SYSTEM_MESSAGE
  }

  const preamble =
    PERSONALITY +
    identityBlock +
    taskStateBlock +
    `You are running INSIDE the user's FlowMap app. ` +
    `Treat IDENTITY entries as authoritative facts about the user. ` +
    `On every task/retrieval turn, FlowMap searches saved content and includes ` +
    `matching passages under RETRIEVED KNOWLEDGE — your source of truth for content questions.\n\n` +
    FLOWMAP_APP_KNOWLEDGE +
    (intent === 'task_request' ? FLOWMAP_ACTIONS_BLOCK : '')

  const signalInstruction = isSignalAnalysisQuery(userQuery) ? SIGNAL_SYNTHESIS_INSTRUCTIONS : ''

  // No results path
  if ((!retrieved || retrieved.length === 0) && !overrideContextText) {
    return preamble + docIndexBlock + signalInstruction + NO_RESULTS_RULES(userQuery) + NEVER_ECHO
  }

  // Pipeline path
  if (overrideContextText) {
    return preamble + docIndexBlock + signalInstruction + PIPELINE_TURN_BANNER(userQuery) + PIPELINE_RULES + NEVER_ECHO + `\nCONTEXT:\n${overrideContextText}`
  }

  // Keyword fallback path
  const corpus = buildCorpus(retrieved, isReadDirective, folders)
  const turnBanner = buildTurnBanner(userQuery, retrieved, isReadDirective)
  return preamble + docIndexBlock + signalInstruction + turnBanner + KEYWORD_RULES + NEVER_ECHO + `\nEXCERPTS:\n${corpus}`
}
```

**Signature change:** adds `recentMessages` as the 10th parameter. `_topics` and `_notes` parameters are retained in the signature for backwards compatibility but are no longer used inside the function.

---

## Pipeline additions (`retrievalService.ts`)

### `RetrievalInput` addition

```ts
userNotes?: Record<string, any>   // useStore.userNotes — keyed by itemId, value is array of note objects
```

### `buildNoteCandidates(input)`

```ts
// userNotes shape from useStore: Record<itemId, noteObject | noteObject[]>
// Note: no pre-resolution of itemId → title is needed. Ranking is driven by
// note content (searchBody), not title. The itemId serves as a stable identifier.
function buildNoteCandidates(input: RetrievalInput): SearchCandidate[] {
  if (!input.userNotes) return []
  const candidates: SearchCandidate[] = []
  for (const [itemId, raw] of Object.entries(input.userNotes)) {
    const entries = Array.isArray(raw) ? raw : (raw?.content ? [raw] : [])
    for (const note of entries) {
      if (!note?.content || !String(note.content).trim()) continue
      const content = String(note.content).trim()
      candidates.push({
        id:          `note_${itemId}_${note.id ?? candidates.length}`,
        type:        'note' as const,
        title:       `Note: ${itemId}`,   // itemId used directly; no lookup required
        snippet:     content.slice(0, 200),
        searchBody:  content,
        date:        note.addedAt,
        hasSummary:  true,
        wordCount:   content.split(/\s+/).length,
        sourceLabel: 'Note',
      })
    }
  }
  return candidates
}
```

### `buildMemoryCandidates()` filter

Exclude pinned identity entries so they do not appear twice in the prompt:

```ts
function buildMemoryCandidates(input: RetrievalInput): SearchCandidate[] {
  return Object.values(input.memoryEntries)
    .filter((m) => m.status !== 'dismissed' && m.isIdentityPinned !== true)
    .map((mem) => ({ ... }))
}
```

### `hybridSearch.ts` type union addition

Add `'note'` to the `SearchCandidate['type']` discriminated union so TypeScript accepts the new candidate type:

```ts
type: 'document' | 'memory' | 'signal' | 'topic' | 'save' | 'note'
```

### `contextBuilderService.ts` label addition

Add `'note'` to `MEMORY_TYPE_LABEL` so note candidates render with a recognisable header in the prompt:

```ts
const MEMORY_TYPE_LABEL: Record<string, string> = {
  document: 'document-memory',
  signal:   'signal-memory',
  memory:   'behavior-memory',
  topic:    'topic-memory',
  save:     'document-memory',
  note:     'document-memory',   // ← new — treat notes as document-class memory
}
```

### `buildCandidates()` addition

```ts
function buildCandidates(input: RetrievalInput): SearchCandidate[] {
  return [
    ...buildDocumentCandidates(input),
    ...buildMemoryCandidates(input),
    ...buildSignalCandidates(input),
    ...buildTopicCandidates(input),
    ...buildSaveCandidates(input),
    ...buildNoteCandidates(input),   // ← new
  ]
}
```

---

## Memory UI changes

### `src/views/Memory.jsx`

Split the entry list into two sections:

```jsx
// Section 1: Identity Memory
<section>
  <div className="flex items-center justify-between mb-3">
    <h2>Identity Memory</h2>
    <span>{pinnedCount} / 8 pinned</span>   // soft cap indicator
  </div>
  {pinnedCount >= 8 && <p className="warning">Only the first 8 pinned entries are always injected.</p>}
  {pinnedEntries.length === 0 && <EmptyState>Pin entries below to always include them in Flow AI's context.</EmptyState>}
  {pinnedEntries.map((m) => <MemoryEntryCard key={m.id} entry={m} onPin={pinMemoryAsIdentity} />)}
</section>

// Section 2: Working Memory
<section>
  <h2>Working Memory</h2>
  {unpinnedEntries.map((m) => <MemoryEntryCard key={m.id} entry={m} onPin={pinMemoryAsIdentity} />)}
</section>
```

### `src/components/memory/MemoryEntryCard.jsx`

Add pin button in the card's action area:

```jsx
<button
  onClick={() => onPin(entry.id, !entry.isIdentityPinned)}
  title={entry.isIdentityPinned ? 'Unpin from identity memory' : 'Pin to identity memory'}
  className={entry.isIdentityPinned ? 'text-[color:var(--color-topic)]' : 'text-white/30 hover:text-white/70'}
>
  <Pin size={13} />
</button>
```

Pinned card visual: subtle left border accent (`border-l-2 border-[color:var(--color-topic)]/40`).

---

## `Chat.jsx` change

Pass `recentMessages` to `buildSystemMessage()`:

```js
// Slice the last 3 messages BEFORE the current user turn for task state context
const recentForTaskState = allRecent.slice(-4, -1)   // up to 3 prior messages

const systemMessage = buildSystemMessage(
  retrieved, text, allMemory, allTopics, allNotes, intent, folders,
  pipelineResult?.contextText ?? null,
  allDocs,
  recentForTaskState,   // ← new 10th argument
)
```

Also pass `userNotes` to the pipeline call:

```js
pipelineResult = await retrieveWithPipeline(
  {
    query, documents, documentContents, memoryEntries,
    saves, views: {}, userTopics, seedTopics,
    signals: localSignalsStorage.listSignals(),
    userNotes,   // ← new
  },
  ctrl.signal,
)
```

---

## What is removed

| Removed | Replaced by |
|---|---|
| `formatMemoryBlock()` | Pinned entries → identity block; non-pinned → retrieval pipeline |
| `formatTopicsBlock()` | Pipeline ranked output via `buildTopicCandidates()` |
| `formatNotesBlock()` | Pipeline ranked output via `buildNoteCandidates()` |
| `allTopics` passed to `buildSystemMessage()` | Signature retained but unused; pipeline handles topics |
| `allNotes` passed to `buildSystemMessage()` | Signature retained but unused; pipeline handles notes |

---

## Error handling and edge cases

- If all memory entries are unpinned: identity block is empty; model still functions normally via retrieval
- If `buildTaskState()` returns empty string: the task state line is simply omitted — no gap or placeholder
- If `userNotes` is undefined in pipeline input: `buildNoteCandidates()` returns `[]` — no crash
- If a note's `itemId` has no resolved title in Chat.jsx: falls back to raw `itemId` string
- Pinned count > 8: system silently takes the first 8; UI shows the warning but does not block pinning

---

## Success criteria

- Identity block in every non-casual prompt contains only pinned entries, never more than 8
- Topics, notes, and non-pinned memory never appear in the prompt unless the pipeline ranked them in
- Task state line appears on substantive non-self-contained turns; is absent on casual or self-contained ones
- Memory page shows two distinct sections with pin controls working correctly
- Existing pipeline output format (`contextBuilderService.ts`) is unchanged
- All existing tests continue to pass
