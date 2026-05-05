# Flow AI ReAct Agent Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a ReAct (Reason + Act) loop into Flow AI chat so it can call connected MCP tools, pause for user approval on write actions, and write results back to memory.

**Architecture:** `classifyIntent` gains a `'tool_use'` return value that branches `handleSend` into `runAgentLoop` instead of the normal retrieval path. `agentLoopService.ts` drives the JSON-mode Ollama loop; `AgentRunTimeline.tsx` renders the live step trail and inline approval card. The existing retrieval pipeline, streamChat, and all MCP providers are untouched.

**Tech Stack:** TypeScript (new service files), JSX/TSX (UI component), Vitest (tests), Ollama `/api/chat` with `format: 'json'`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/llm/ollama.js` | Modify | Add `chatJson()` — non-streaming JSON-mode chat call |
| `src/lib/chat/retrieve.js` | Modify | Add `'tool_use'` return value to `classifyIntent` |
| `src/mcp/services/mcpMemoryService.ts` | Modify | Add `writeAgentResult()` |
| `src/flow-ai/services/agentSystemPrompt.ts` | Create | Tool-use system prompt builder |
| `src/flow-ai/services/agentLoopService.ts` | Create | ReAct loop, step emission, approval gate |
| `src/components/chat/AgentRunTimeline.tsx` | Create | Step trail + approval card UI |
| `src/views/Chat.jsx` | Modify | Branch on tool_use intent, wire state, render timeline |
| `src/lib/chat/__tests__/retrieve.test.js` | Modify | Tests for new `tool_use` intent detection |
| `src/mcp/services/__tests__/mcpMemoryService.test.ts` | Modify | Tests for `writeAgentResult` |
| `src/flow-ai/services/__tests__/agentSystemPrompt.test.ts` | Create | Tests for prompt builder |

---

## Task 1: Add `chatJson()` to `src/lib/llm/ollama.js`

**Files:**
- Modify: `src/lib/llm/ollama.js`

The agent loop needs a non-streaming JSON-mode Ollama call. `postJson` is already an internal helper in `ollama.js` — we add a new exported function `chatJson` that uses `/api/chat` with `format: 'json'` and `stream: false`. Returns the parsed JSON object, or `null` on any failure.

- [ ] **Step 1: Write the failing test**

Create `src/lib/llm/__tests__/chatJson.test.js`:

```js
import { beforeEach, describe, expect, it, vi } from 'vitest'

// chatJson is not exported yet — this test must fail first
import { chatJson } from '../ollama.js'

function mockFetch(responseBody, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(responseBody),
  })
}

beforeEach(() => {
  vi.unstubAllGlobals()
  localStorage.setItem('flowmap.ollama.enabled', 'true')
})

describe('chatJson', () => {
  it('returns null when OLLAMA_CONFIG.enabled is false', async () => {
    localStorage.setItem('flowmap.ollama.enabled', 'false')
    const result = await chatJson([{ role: 'user', content: 'hi' }])
    expect(result).toBeNull()
  })

  it('returns null for empty messages array', async () => {
    const result = await chatJson([])
    expect(result).toBeNull()
  })

  it('calls /api/ollama/api/chat with format: json and stream: false', async () => {
    const fetch = mockFetch({
      message: { role: 'assistant', content: '{"action":"answer","thought":"ok","answer":"done"}' },
      done: true,
    })
    vi.stubGlobal('fetch', fetch)

    await chatJson([{ role: 'system', content: 'be a json bot' }, { role: 'user', content: 'go' }])

    expect(fetch).toHaveBeenCalledOnce()
    const [, init] = fetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.format).toBe('json')
    expect(body.stream).toBe(false)
    expect(body.messages).toHaveLength(2)
  })

  it('returns parsed JSON from message.content', async () => {
    const payload = { action: 'answer', thought: 'I know this', answer: 'The result is 42' }
    const fetch = mockFetch({
      message: { role: 'assistant', content: JSON.stringify(payload) },
      done: true,
    })
    vi.stubGlobal('fetch', fetch)

    const result = await chatJson([{ role: 'user', content: 'what is the answer' }])
    expect(result).toEqual(payload)
  })

  it('returns null when message.content is not valid JSON', async () => {
    const fetch = mockFetch({
      message: { role: 'assistant', content: 'this is not json' },
      done: true,
    })
    vi.stubGlobal('fetch', fetch)

    const result = await chatJson([{ role: 'user', content: 'go' }])
    expect(result).toBeNull()
  })

  it('returns null on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false))
    const result = await chatJson([{ role: 'user', content: 'go' }])
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/lib/llm/__tests__/chatJson.test.js
```

Expected: FAIL — `chatJson` is not exported from `ollama.js`.

- [ ] **Step 3: Add `chatJson` to `src/lib/llm/ollama.js`**

Append this function at the end of the file, before the final blank line:

```js
// Non-streaming JSON-mode chat call for the agent loop.
// Uses /api/chat with format:'json' so the model is forced to return valid JSON.
// Returns the parsed JSON object, or null on any failure (Ollama off, network
// error, model returns non-JSON). Caller should validate the shape it receives.
export async function chatJson(messages, opts = {}) {
  if (!OLLAMA_CONFIG.enabled) return null
  if (!Array.isArray(messages) || messages.length === 0) return null

  const json = await postJson('/api/chat', {
    model: OLLAMA_CONFIG.model,
    messages,
    stream: false,
    format: 'json',
    keep_alive: '15m',
    options: { temperature: opts.temperature ?? 0.1 },
  }, opts.signal)

  if (!json?.message?.content) return null
  try {
    return JSON.parse(json.message.content)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npx vitest run src/lib/llm/__tests__/chatJson.test.js
```

Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/llm/ollama.js src/lib/llm/__tests__/chatJson.test.js
git commit -m "feat: add chatJson() to ollama adapter for agent loop JSON calls"
```

---

## Task 2: Extend `classifyIntent` in `src/lib/chat/retrieve.js`

**Files:**
- Modify: `src/lib/chat/retrieve.js`
- Modify: `src/lib/chat/__tests__/retrieve.test.js`

Add `'tool_use'` as a new return value. The heuristic checks: (a) message contains an imperative verb targeting an integration, AND (b) message names a connected integration or uses `"use/via/with [tool]"` phrases. The `tool_use` check runs BEFORE the casual pattern check so an explicit integration command always wins.

- [ ] **Step 1: Write the failing tests**

Append to the end of `src/lib/chat/__tests__/retrieve.test.js` (after all existing `describe` blocks):

```js
// ─── classifyIntent ───────────────────────────────────────────────────────────
import { classifyIntent } from '../retrieve.js'

describe('classifyIntent — tool_use', () => {
  it('detects send + telegram as tool_use', () => {
    expect(classifyIntent('send a message to @channel on telegram saying hi')).toBe('tool_use')
  })

  it('detects post + figma as tool_use', () => {
    expect(classifyIntent('post this design note to figma')).toBe('tool_use')
  })

  it('detects create + google docs as tool_use', () => {
    expect(classifyIntent('create a google docs document from my summary')).toBe('tool_use')
  })

  it('detects "use [tool]" phrase as tool_use', () => {
    expect(classifyIntent('use telegram to notify the team')).toBe('tool_use')
  })

  it('detects "via gmail" phrase as tool_use', () => {
    expect(classifyIntent('draft a report and send it via gmail')).toBe('tool_use')
  })

  it('detects schedule + calendar as tool_use', () => {
    expect(classifyIntent('schedule a reminder on google calendar for tomorrow')).toBe('tool_use')
  })

  it('detects fetch + drive as tool_use', () => {
    expect(classifyIntent('fetch the latest file from google drive')).toBe('tool_use')
  })

  it('does NOT classify casual greeting as tool_use', () => {
    expect(classifyIntent('hi')).toBe('casual_chat')
    expect(classifyIntent('hey')).toBe('casual_chat')
  })

  it('does NOT classify a plain knowledge question as tool_use', () => {
    expect(classifyIntent('what is n8n?')).not.toBe('tool_use')
  })

  it('does NOT classify a telegram-mentioning knowledge question as tool_use', () => {
    // mentions telegram but no imperative action verb
    expect(classifyIntent('what is telegram used for?')).not.toBe('tool_use')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/lib/chat/__tests__/retrieve.test.js
```

Expected: FAIL on the new `classifyIntent — tool_use` tests (existing tests pass).

- [ ] **Step 3: Add tool_use detection to `src/lib/chat/retrieve.js`**

Add the three new constants directly after the `TASK_KEYWORDS` constant (around line 62), then update `classifyIntent`:

```js
// ─── Tool-use intent detection ────────────────────────────────────────────────
// Matches messages that direct the AI to act via a named integration.
// Requires BOTH an action verb AND an integration name/phrase to reduce
// false positives (e.g. "what is telegram?" has no verb → not tool_use).
const TOOL_USE_VERBS = /\b(send|post|draft|create|make|schedule|fetch|read|list|open|update|search|get|add|delete|remove)\b/i

const INTEGRATION_NAMES = /\b(telegram|google\s*docs|google\s*drive|drive|gmail|google\s*calendar|calendar|figma|flowmap)\b/i

const TOOL_USE_PHRASES = /\b(use|via|with|through|on|using)\s+(telegram|google\s*docs|google\s*drive|drive|gmail|google\s*calendar|calendar|figma|flowmap)\b/i
```

Then change `classifyIntent` — insert ONE line before the `CASUAL_PATTERNS` check:

```js
export function classifyIntent(query) {
  const q = String(query || '').trim()
  if (!q) return 'unclear'
  // Tool-use check first: explicit integration command overrides casual patterns.
  if (TOOL_USE_VERBS.test(q) && (INTEGRATION_NAMES.test(q) || TOOL_USE_PHRASES.test(q))) return 'tool_use'
  if (CASUAL_PATTERNS.some((p) => p.test(q))) return 'casual_chat'
  // ... rest unchanged
```

The full updated function body (show the whole function so position is unambiguous):

```js
export function classifyIntent(query) {
  const q = String(query || '').trim()
  if (!q) return 'unclear'
  if (TOOL_USE_VERBS.test(q) && (INTEGRATION_NAMES.test(q) || TOOL_USE_PHRASES.test(q))) return 'tool_use'
  if (CASUAL_PATTERNS.some((p) => p.test(q))) return 'casual_chat'
  // Short messages with no retrieval/task signal lean casual
  const wordCount = q.split(/\s+/).filter(Boolean).length
  if (wordCount <= 3 && !RETRIEVAL_KEYWORDS.test(q) && !TASK_KEYWORDS.test(q)) return 'casual_chat'
  if (RETRIEVAL_KEYWORDS.test(q)) return 'retrieval_request'
  if (TASK_KEYWORDS.test(q)) return 'task_request'
  return 'retrieval_request'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/lib/chat/__tests__/retrieve.test.js
```

Expected: all tests PASS (new tool_use tests + all existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/chat/retrieve.js src/lib/chat/__tests__/retrieve.test.js
git commit -m "feat: add tool_use intent to classifyIntent for MCP agent routing"
```

---

## Task 3: Add `writeAgentResult()` to `src/mcp/services/mcpMemoryService.ts`

**Files:**
- Modify: `src/mcp/services/mcpMemoryService.ts`
- Modify: `src/mcp/services/__tests__/mcpMemoryService.test.ts`

After a `runAgentLoop` run (success, denial, or max-steps), the result is written to FlowMap memory so the user can see what the agent did. The entry uses `content` (matching `useStore.addMemory`) and `category: 'research_focus'`.

- [ ] **Step 1: Write the failing tests**

Append to `src/mcp/services/__tests__/mcpMemoryService.test.ts` after the existing `describe('writeExecutionMemory', ...)` block:

```ts
import { writeAgentResult } from '../mcpMemoryService.js'

describe('writeAgentResult', () => {
  it('writes a memory entry to flowmap.v1.memoryEntries', () => {
    writeAgentResult({
      userMessage: 'send a message to @dev on telegram',
      toolsUsed: ['Send Telegram Message'],
      outcome: 'Sent message to @dev.',
      source: 'agent_run',
    })
    const entries = readMemoryEntries()
    expect(Object.keys(entries)).toHaveLength(1)
  })

  it('entry id is prefixed with mem_agent_', () => {
    writeAgentResult({
      userMessage: 'list drive files',
      toolsUsed: ['List Drive Files'],
      outcome: 'Found 3 files.',
      source: 'agent_run',
    })
    const entries = readMemoryEntries()
    const key = Object.keys(entries)[0]
    expect(key).toMatch(/^mem_agent_/)
  })

  it('entry uses content field (not text)', () => {
    writeAgentResult({
      userMessage: 'create a doc',
      toolsUsed: ['Create Google Doc'],
      outcome: 'Created the doc.',
      source: 'agent_run',
    })
    const entry = Object.values(readMemoryEntries())[0] as Record<string, unknown>
    expect(entry.content).toBeDefined()
    expect(typeof entry.content).toBe('string')
  })

  it('entry content mentions tools used and outcome', () => {
    writeAgentResult({
      userMessage: 'create a doc',
      toolsUsed: ['Create Google Doc'],
      outcome: 'Created the doc.',
      source: 'agent_run',
    })
    const entry = Object.values(readMemoryEntries())[0] as { content: string }
    expect(entry.content).toContain('Create Google Doc')
    expect(entry.content).toContain('Created the doc.')
  })

  it('entry has category research_focus and source agent_run', () => {
    writeAgentResult({
      userMessage: 'do something',
      toolsUsed: [],
      outcome: 'Done.',
      source: 'agent_run',
    })
    const entry = Object.values(readMemoryEntries())[0] as { category: string; source: string }
    expect(entry.category).toBe('research_focus')
    expect(entry.source).toBe('agent_run')
  })

  it('entry has addedAt as ISO date string', () => {
    writeAgentResult({
      userMessage: 'test',
      toolsUsed: [],
      outcome: 'ok',
      source: 'agent_run',
    })
    const entry = Object.values(readMemoryEntries())[0] as { addedAt: string }
    expect(entry.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })

  it('preserves existing flowmap.v1 data', () => {
    localStorage.setItem('flowmap.v1', JSON.stringify({
      saves: { s1: { id: 's1' } },
      memoryEntries: {},
    }))
    writeAgentResult({ userMessage: 'x', toolsUsed: [], outcome: 'ok', source: 'agent_run' })
    const raw = localStorage.getItem('flowmap.v1')!
    const store = JSON.parse(raw) as { saves: Record<string, unknown> }
    expect(store.saves['s1']).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/mcp/services/__tests__/mcpMemoryService.test.ts
```

Expected: FAIL on the new `writeAgentResult` tests.

- [ ] **Step 3: Add `writeAgentResult` to `src/mcp/services/mcpMemoryService.ts`**

Add the interface and function after the `writeExecutionMemory` function at the end of the file:

```ts
export interface WriteAgentResultParams {
  userMessage: string
  toolsUsed: string[]
  outcome: string
  source: 'agent_run'
}

/**
 * Writes a memory entry after an agent run completes.
 * The entry appears in Memory > Memory entries like any other working memory entry.
 * Uses `content` field to match the shape expected by useStore and the retrieval pipeline.
 */
export function writeAgentResult(params: WriteAgentResultParams): void {
  const { userMessage, toolsUsed, outcome } = params
  const id = `mem_agent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

  const toolPhrase = toolsUsed.length
    ? `Used: ${toolsUsed.join(', ')}. `
    : ''
  const content = `Agent run for "${userMessage.slice(0, 80)}". ${toolPhrase}${outcome.slice(0, 200)}`

  const entry = {
    id,
    content,
    category: 'research_focus',
    addedAt: new Date().toISOString().slice(0, 10),
    source: 'agent_run',
    status: 'active',
    tags: ['agent', 'tool-execution'],
  }

  const store = readStore()
  const entries = store.memoryEntries ?? {}
  entries[id] = entry as unknown as MemoryEntry
  writeStore({ ...store, memoryEntries: entries })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/mcp/services/__tests__/mcpMemoryService.test.ts
```

Expected: all PASS (new writeAgentResult tests + all existing writeExecutionMemory tests).

- [ ] **Step 5: Commit**

```bash
git add src/mcp/services/mcpMemoryService.ts src/mcp/services/__tests__/mcpMemoryService.test.ts
git commit -m "feat: add writeAgentResult() to mcpMemoryService for agent run memory"
```

---

## Task 4: Create `src/flow-ai/services/agentSystemPrompt.ts`

**Files:**
- Create: `src/flow-ai/services/agentSystemPrompt.ts`
- Create: `src/flow-ai/services/__tests__/agentSystemPrompt.test.ts`

Builds the system message for tool-use mode. Separate from `buildSystemMessage` in `retrieve.js` — never mixed. Reads connected tools from `localMCPStorage`, formats a tool catalog, injects memory context and the required JSON schema.

- [ ] **Step 1: Write the failing tests**

Create `src/flow-ai/services/__tests__/agentSystemPrompt.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAgentSystemPrompt } from '../agentSystemPrompt.js'

// Mock localMCPStorage so tests don't need localStorage
vi.mock('../../../mcp/storage/localMCPStorage.js', () => ({
  localMCPStorage: {
    listIntegrations: vi.fn(() => [
      { id: 'integ_telegram', type: 'telegram', name: 'Telegram', status: 'connected', updatedAt: '' },
      { id: 'integ_gdocs', type: 'google-docs', name: 'Google Docs', status: 'disconnected', updatedAt: '' },
    ]),
    listTools: vi.fn(() => [
      {
        id: 'telegram_send_message',
        integrationId: 'integ_telegram',
        toolName: 'send_message',
        displayName: 'Send Telegram Message',
        description: 'Send a message to a Telegram channel.',
        riskLevel: 'write',
        permissionMode: 'auto',
      },
      {
        id: 'gdocs_create',
        integrationId: 'integ_gdocs',
        toolName: 'create_doc',
        displayName: 'Create Google Doc',
        description: 'Create a new Google Doc.',
        riskLevel: 'write',
        permissionMode: 'auto',
      },
    ]),
  },
}))

describe('buildAgentSystemPrompt', () => {
  it('includes role instruction telling model to output JSON only', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('JSON')
    expect(prompt.toLowerCase()).toContain('tool-using assistant')
  })

  it('includes the JSON response schema', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('"thought"')
    expect(prompt).toContain('"action"')
    expect(prompt).toContain('"toolId"')
    expect(prompt).toContain('"answer"')
  })

  it('includes only tools from connected integrations', () => {
    const prompt = buildAgentSystemPrompt()
    // telegram is connected → its tool appears
    expect(prompt).toContain('telegram_send_message')
    // google-docs is disconnected → its tool does NOT appear
    expect(prompt).not.toContain('gdocs_create')
  })

  it('includes tool displayName and description in catalog', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('Send Telegram Message')
    expect(prompt).toContain('Send a message to a Telegram channel')
  })

  it('includes memory context when provided', () => {
    const prompt = buildAgentSystemPrompt([
      { category: 'research_focus', content: 'I work on AI tooling research.' },
    ])
    expect(prompt).toContain('I work on AI tooling research.')
  })

  it('includes max steps constraint', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('5')
  })

  it('omits memory context block when array is empty', () => {
    const prompt = buildAgentSystemPrompt([])
    expect(prompt).not.toContain('MEMORY CONTEXT')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/flow-ai/services/__tests__/agentSystemPrompt.test.ts
```

Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Create `src/flow-ai/services/agentSystemPrompt.ts`**

```ts
import { localMCPStorage } from '../../mcp/storage/localMCPStorage.js'

export interface MemoryContextEntry {
  category: string
  content: string
}

const JSON_SCHEMA = `{
  "thought": "string — your internal reasoning step",
  "action": "tool | answer",
  "toolId": "string (required when action=tool)",
  "toolInput": { "key": "value" },
  "answer": "string (required when action=answer)"
}`

/**
 * Builds the system message for tool-use mode.
 * Only includes tools whose parent integration has status === 'connected'.
 * Completely separate from buildSystemMessage in retrieve.js — never mixed.
 */
export function buildAgentSystemPrompt(memoryContext: MemoryContextEntry[] = []): string {
  const integrations = localMCPStorage.listIntegrations()
  const connectedIds = new Set(
    integrations.filter((i) => i.status === 'connected').map((i) => i.id),
  )
  const tools = localMCPStorage.listTools().filter((t) => connectedIds.has(t.integrationId))

  const toolCatalog = tools.length
    ? tools
        .map(
          (t) =>
            `- id: "${t.id}" | name: "${t.displayName}" | ` +
            `description: "${t.description ?? ''}" | risk: "${t.riskLevel ?? 'read'}"`,
        )
        .join('\n')
    : '(no tools connected)'

  const memoryBlock =
    memoryContext.length > 0
      ? `\nMEMORY CONTEXT:\n${memoryContext
          .map((m) => `- [${m.category}] ${m.content}`)
          .join('\n')}\n`
      : ''

  return [
    'You are a tool-using assistant. Always respond with valid JSON only.',
    'No preamble, no markdown, no explanation — output the JSON object and nothing else.',
    '',
    'RESPONSE SCHEMA:',
    JSON_SCHEMA,
    '',
    'TOOLS AVAILABLE:',
    toolCatalog,
    memoryBlock,
    'CONSTRAINTS:',
    '- Maximum 5 reasoning steps.',
    '- Prefer action=answer when you already have enough information.',
    '- When uncertain which tool to use, choose action=answer and explain naturally.',
    '- toolInput must only use parameter names described in the tool description.',
    '- Never fabricate tool output. Only report what tools actually return.',
  ].join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/flow-ai/services/__tests__/agentSystemPrompt.test.ts
```

Expected: 7/7 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/flow-ai/services/agentSystemPrompt.ts src/flow-ai/services/__tests__/agentSystemPrompt.test.ts
git commit -m "feat: add agentSystemPrompt builder for tool-use mode"
```

---

## Task 5: Create `src/flow-ai/services/agentLoopService.ts`

**Files:**
- Create: `src/flow-ai/services/agentLoopService.ts`
- Create: `src/flow-ai/services/__tests__/agentLoopService.test.ts`

The ReAct loop. Calls `chatJson` for each step, emits typed events via callback, handles approval via Promise-based gate, retries on malformed JSON/tool errors, writes memory on completion.

**Key design:** `runAgentLoop` takes an `onEvent` callback. `awaiting_approval` events carry `approve` and `deny` functions that are called by Chat.jsx when the user acts. The loop `await`s the Promise internally. Returns `{ steps, finalAnswer }` so Chat.jsx can persist the full step set on the assistant message without stale-closure issues.

- [ ] **Step 1: Write the failing tests**

Create `src/flow-ai/services/__tests__/agentLoopService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAgentLoop } from '../agentLoopService.js'
import type { AgentEvent } from '../agentLoopService.js'

// Mock all external dependencies
vi.mock('../../../lib/llm/ollama.js', () => ({
  chatJson: vi.fn(),
}))
vi.mock('../../../mcp/storage/localMCPStorage.js', () => ({
  localMCPStorage: {
    listTools: vi.fn(() => [
      {
        id: 'flowmap_get_topics',
        integrationId: 'integ_flowmap',
        toolName: 'get_topics',
        displayName: 'Get Followed Topics',
        description: 'List all topics.',
        riskLevel: 'read',
        permissionMode: 'read_only',
      },
      {
        id: 'telegram_send_message',
        integrationId: 'integ_telegram',
        toolName: 'send_message',
        displayName: 'Send Telegram Message',
        description: 'Send a message.',
        riskLevel: 'write',
        permissionMode: 'auto',
      },
    ]),
    listIntegrations: vi.fn(() => [
      { id: 'integ_flowmap', type: 'flowmap', name: 'FlowMap', status: 'connected', updatedAt: '' },
      { id: 'integ_telegram', type: 'telegram', name: 'Telegram', status: 'connected', updatedAt: '' },
    ]),
  },
}))
vi.mock('../../../mcp/services/mcpExecutionService.js', () => ({
  runTool: vi.fn(),
}))
vi.mock('../../../mcp/services/mcpMemoryService.js', () => ({
  writeAgentResult: vi.fn(),
}))
vi.mock('../agentSystemPrompt.js', () => ({
  buildAgentSystemPrompt: vi.fn(() => 'system-prompt-stub'),
}))

import { chatJson } from '../../../lib/llm/ollama.js'
import { runTool } from '../../../mcp/services/mcpExecutionService.js'
import { writeAgentResult } from '../../../mcp/services/mcpMemoryService.js'

const mockChatJson = vi.mocked(chatJson)
const mockRunTool = vi.mocked(runTool)
const mockWriteAgentResult = vi.mocked(writeAgentResult)

function makeCtrl() {
  return new AbortController()
}

function collectEvents(events: AgentEvent[]) {
  return (event: AgentEvent) => events.push(event)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runAgentLoop — answer path', () => {
  it('emits thought then done when model returns action=answer immediately', async () => {
    mockChatJson.mockResolvedValue({
      thought: 'I know this without tools.',
      action: 'answer',
      answer: 'The answer is 42.',
    })

    const events: AgentEvent[] = []
    const result = await runAgentLoop('what is the answer?', {
      ctrl: makeCtrl(),
      onEvent: collectEvents(events),
    })

    expect(events[0]).toMatchObject({ type: 'thought', text: 'I know this without tools.' })
    expect(events[events.length - 1]).toMatchObject({ type: 'done', answer: 'The answer is 42.' })
    expect(result.finalAnswer).toBe('The answer is 42.')
  })

  it('calls writeAgentResult after completion', async () => {
    mockChatJson.mockResolvedValue({ thought: 'ok', action: 'answer', answer: 'done' })
    await runAgentLoop('test', { ctrl: makeCtrl(), onEvent: () => {} })
    expect(mockWriteAgentResult).toHaveBeenCalledOnce()
  })
})

describe('runAgentLoop — read tool path', () => {
  it('auto-executes a read tool without emitting awaiting_approval', async () => {
    mockChatJson
      .mockResolvedValueOnce({
        thought: 'I will list topics.',
        action: 'tool',
        toolId: 'flowmap_get_topics',
        toolInput: { limit: 5 },
      })
      .mockResolvedValueOnce({
        thought: 'Got the topics.',
        action: 'answer',
        answer: 'You follow 3 topics.',
      })

    mockRunTool.mockResolvedValue({
      success: true,
      executionId: 'exec_1',
      output: ['AI', 'Crypto', 'Design'],
    })

    const events: AgentEvent[] = []
    const result = await runAgentLoop('list my topics', {
      ctrl: makeCtrl(),
      onEvent: collectEvents(events),
    })

    const awaitingEvent = events.find((e) => e.type === 'awaiting_approval')
    expect(awaitingEvent).toBeUndefined()
    expect(mockRunTool).toHaveBeenCalledOnce()
    expect(result.finalAnswer).toBe('You follow 3 topics.')
  })

  it('emits tool_selected and step_done for each tool call', async () => {
    mockChatJson
      .mockResolvedValueOnce({
        thought: 'Listing.',
        action: 'tool',
        toolId: 'flowmap_get_topics',
        toolInput: {},
      })
      .mockResolvedValueOnce({ thought: 'Done.', action: 'answer', answer: 'Topics: AI.' })

    mockRunTool.mockResolvedValue({ success: true, executionId: 'exec_1', output: ['AI'] })

    const events: AgentEvent[] = []
    await runAgentLoop('list topics', { ctrl: makeCtrl(), onEvent: collectEvents(events) })

    expect(events.some((e) => e.type === 'tool_selected')).toBe(true)
    expect(events.some((e) => e.type === 'step_done')).toBe(true)
  })
})

describe('runAgentLoop — write tool approval path', () => {
  it('emits awaiting_approval for write-risk tools', async () => {
    mockChatJson.mockResolvedValueOnce({
      thought: 'Will send a message.',
      action: 'tool',
      toolId: 'telegram_send_message',
      toolInput: { message: 'hi', chatId: '@dev' },
    })

    const events: AgentEvent[] = []
    const loopPromise = runAgentLoop('send hi to telegram', {
      ctrl: makeCtrl(),
      onEvent: (event) => {
        events.push(event)
        // Auto-deny to unblock the loop
        if (event.type === 'awaiting_approval') {
          event.deny()
        }
      },
    })

    const result = await loopPromise
    expect(events.some((e) => e.type === 'awaiting_approval')).toBe(true)
    expect(result.finalAnswer).toContain('Send Telegram Message')
  })

  it('executes tool and continues loop when approved', async () => {
    mockChatJson
      .mockResolvedValueOnce({
        thought: 'Sending.',
        action: 'tool',
        toolId: 'telegram_send_message',
        toolInput: { message: 'hi' },
      })
      .mockResolvedValueOnce({ thought: 'Done.', action: 'answer', answer: 'Message sent.' })

    mockRunTool.mockResolvedValue({ success: true, executionId: 'exec_1', output: { ok: true } })

    const events: AgentEvent[] = []
    const result = await runAgentLoop('send hi via telegram', {
      ctrl: makeCtrl(),
      onEvent: (event) => {
        events.push(event)
        if (event.type === 'awaiting_approval') {
          event.approve()
        }
      },
    })

    expect(mockRunTool).toHaveBeenCalledOnce()
    expect(result.finalAnswer).toBe('Message sent.')
  })
})

describe('runAgentLoop — error handling', () => {
  it('returns graceful answer when chatJson returns null twice', async () => {
    mockChatJson.mockResolvedValue(null)
    const result = await runAgentLoop('do something', { ctrl: makeCtrl(), onEvent: () => {} })
    expect(result.finalAnswer).toBeTruthy()
    expect(typeof result.finalAnswer).toBe('string')
  })

  it('retries tool once on failure then continues', async () => {
    mockChatJson
      .mockResolvedValueOnce({
        thought: 'Will use topics tool.',
        action: 'tool',
        toolId: 'flowmap_get_topics',
        toolInput: {},
      })
      .mockResolvedValueOnce({ thought: 'Got it.', action: 'answer', answer: 'Done.' })

    mockRunTool
      .mockResolvedValueOnce({ success: false, executionId: 'e1', error: 'timeout' })
      .mockResolvedValueOnce({ success: true, executionId: 'e2', output: [] })

    const result = await runAgentLoop('list topics', { ctrl: makeCtrl(), onEvent: () => {} })
    expect(mockRunTool).toHaveBeenCalledTimes(2)
    expect(result.finalAnswer).toBe('Done.')
  })

  it('stops gracefully when AbortController is aborted', async () => {
    const ctrl = makeCtrl()
    mockChatJson.mockImplementation(() => {
      ctrl.abort()
      return Promise.resolve(null)
    })
    const result = await runAgentLoop('test', { ctrl, onEvent: () => {} })
    expect(result).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npx vitest run src/flow-ai/services/__tests__/agentLoopService.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `src/flow-ai/services/agentLoopService.ts`**

```ts
import { chatJson } from '../../lib/llm/ollama.js'
import { localMCPStorage } from '../../mcp/storage/localMCPStorage.js'
import { runTool } from '../../mcp/services/mcpExecutionService.js'
import { writeAgentResult } from '../../mcp/services/mcpMemoryService.js'
import { buildAgentSystemPrompt } from './agentSystemPrompt.js'
import type { MCPToolDefinition } from '../../mcp/types.js'

// ─── Public types ─────────────────────────────────────────────────────────────

export type AgentStep =
  | { type: 'thought'; text: string; step: number }
  | { type: 'tool_selected'; toolName: string; step: number }
  | { type: 'step_done'; toolName: string; resultSummary: string; step: number }
  | { type: 'denied'; toolName: string; step: number }
  | { type: 'done'; answer: string }

export interface PendingApprovalState {
  toolName: string
  integrationId: string
  inputSummary: string
}

export type AgentEvent =
  | AgentStep
  | {
      type: 'awaiting_approval'
      pendingApproval: PendingApprovalState
      approve: () => void
      deny: () => void
    }

export interface MemoryContextEntry {
  category: string
  content: string
}

export interface RunAgentLoopOptions {
  ctrl: AbortController
  memoryContext?: MemoryContextEntry[]
  onEvent: (event: AgentEvent) => void
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const MAX_STEPS = 5

interface ModelResponse {
  thought: string
  action: 'tool' | 'answer'
  toolId?: string
  toolInput?: Record<string, unknown>
  answer?: string
}

function isValidResponse(v: unknown): v is ModelResponse {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return typeof r.thought === 'string' && (r.action === 'tool' || r.action === 'answer')
}

function summariseResult(result: unknown): string {
  if (result === undefined || result === null) return 'No output'
  const str = typeof result === 'string' ? result : JSON.stringify(result)
  return str.slice(0, 200)
}

function buildInputSummary(toolInput: Record<string, unknown>): string {
  return Object.entries(toolInput)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
    .join(', ')
    .slice(0, 120)
}

function awaitApproval(
  tool: MCPToolDefinition,
  toolInput: Record<string, unknown>,
  onEvent: (event: AgentEvent) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    onEvent({
      type: 'awaiting_approval',
      pendingApproval: {
        toolName: tool.displayName,
        integrationId: tool.integrationId,
        inputSummary: buildInputSummary(toolInput),
      },
      approve: () => resolve(true),
      deny: () => resolve(false),
    })
  })
}

// ─── Main loop ────────────────────────────────────────────────────────────────

export async function runAgentLoop(
  text: string,
  options: RunAgentLoopOptions,
): Promise<{ steps: AgentStep[]; finalAnswer: string }> {
  const { ctrl, memoryContext = [], onEvent } = options

  const systemPrompt = buildAgentSystemPrompt(memoryContext)
  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: text },
  ]

  const steps: AgentStep[] = []
  let finalAnswer = ''
  let step = 0

  function emit(event: AgentStep): void {
    steps.push(event)
    onEvent(event)
  }

  while (step < MAX_STEPS) {
    if (ctrl.signal.aborted) break

    // Try up to 2 times to get a valid JSON response from the model.
    const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages]
    let parsed: ModelResponse | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      if (ctrl.signal.aborted) break
      const raw = await chatJson(fullMessages, { signal: ctrl.signal })
      if (isValidResponse(raw)) {
        parsed = raw
        break
      }
    }

    if (!parsed) {
      finalAnswer = "I couldn't produce a valid action for that request — the model returned unexpected output. Try rephrasing."
      emit({ type: 'done', answer: finalAnswer })
      break
    }

    emit({ type: 'thought', text: parsed.thought, step })

    // ── Answer action → done ───────────────────────────────────────────────
    if (parsed.action === 'answer') {
      finalAnswer = parsed.answer ?? ''
      emit({ type: 'done', answer: finalAnswer })
      break
    }

    // ── Tool action ────────────────────────────────────────────────────────
    const toolId = parsed.toolId ?? ''
    const toolInput = parsed.toolInput ?? {}

    const tool = localMCPStorage.listTools().find((t) => t.id === toolId) ?? null
    if (!tool) {
      const msg = `Tool "${toolId}" not found in the registry.`
      messages.push({ role: 'tool', content: msg })
      emit({ type: 'step_done', toolName: toolId, resultSummary: msg, step })
      step++
      continue
    }

    emit({ type: 'tool_selected', toolName: tool.displayName, step })

    // Approval gate for non-read tools
    if (tool.riskLevel !== 'read') {
      const approved = await awaitApproval(tool, toolInput, onEvent)
      if (!approved) {
        emit({ type: 'denied', toolName: tool.displayName, step })
        finalAnswer = `I would have used ${tool.displayName} to complete that action. Let me know if you'd like to proceed.`
        emit({ type: 'done', answer: finalAnswer })
        break
      }
    }

    // Execute — retry once on failure
    let runResult = await runTool({ toolId: tool.id, input: toolInput, sourceSurface: 'chat' })
    if (!runResult.success) {
      runResult = await runTool({ toolId: tool.id, input: toolInput, sourceSurface: 'chat' })
    }

    if (!runResult.success) {
      const errMsg = runResult.error ?? 'Tool execution failed after retry.'
      messages.push({ role: 'tool', content: errMsg })
      emit({ type: 'step_done', toolName: tool.displayName, resultSummary: errMsg, step })
      step++
      continue
    }

    const summary = summariseResult(runResult.output)
    messages.push({ role: 'tool', content: JSON.stringify(runResult.output) })
    emit({ type: 'step_done', toolName: tool.displayName, resultSummary: summary, step })
    step++
  }

  // Max-steps fallback
  if (!finalAnswer) {
    const doneSteps = steps.filter((s) => s.type === 'step_done') as Array<{
      type: 'step_done'; toolName: string; resultSummary: string; step: number
    }>
    finalAnswer = doneSteps.length
      ? `I've reached the step limit. Here's what I found: ${doneSteps.map((s) => s.resultSummary).join('; ')}`
      : "I've reached the step limit without finding an answer."
    emit({ type: 'done', answer: finalAnswer })
  }

  // Memory write-back (fire-and-forget — never blocks the return)
  const toolsUsed = (steps.filter((s) => s.type === 'step_done') as Array<{ toolName: string }>)
    .map((s) => s.toolName)
  try {
    writeAgentResult({ userMessage: text, toolsUsed, outcome: finalAnswer, source: 'agent_run' })
  } catch { /* memory write failure must never surface to the user */ }

  return { steps, finalAnswer }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npx vitest run src/flow-ai/services/__tests__/agentLoopService.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/flow-ai/services/agentLoopService.ts src/flow-ai/services/__tests__/agentLoopService.test.ts
git commit -m "feat: add ReAct agentLoopService with approval gate and memory write-back"
```

---

## Task 6: Create `src/components/chat/AgentRunTimeline.tsx`

**Files:**
- Create: `src/components/chat/AgentRunTimeline.tsx`

Step trail (collapsible pill) + inline approval card. Stateless from the parent's perspective — all behaviour (expand/collapse) is internal. Renders in two modes: `isRunning=true` (live, with spinner) and static (collapsed after run, showing tool names). When `pendingApproval !== null`, shows the approval card below the pill regardless of expand state.

- [ ] **Step 1: Create `src/components/chat/AgentRunTimeline.tsx`**

(No failing test first for this UI component — test via Task 7 manual verification in the browser.)

```tsx
import { useState } from 'react'
import { ChevronDown, ChevronRight, Zap, Loader2, Check, X } from 'lucide-react'
import type { AgentStep, PendingApprovalState } from '../../flow-ai/services/agentLoopService.js'

interface AgentRunTimelineProps {
  steps: AgentStep[]
  pendingApproval: PendingApprovalState | null
  onApprove: () => void
  onDeny: () => void
  isRunning?: boolean
}

export default function AgentRunTimeline({
  steps,
  pendingApproval,
  onApprove,
  onDeny,
  isRunning = false,
}: AgentRunTimelineProps) {
  const [expanded, setExpanded] = useState(false)

  const doneSteps = steps.filter(
    (s): s is Extract<AgentStep, { type: 'step_done' }> => s.type === 'step_done',
  )
  const toolNames = [...new Set(doneSteps.map((s) => s.toolName))]
  const isDone = steps.some((s) => s.type === 'done')
  const pillLabel = toolNames.length ? toolNames.join(' · ') : isRunning ? 'Thinking…' : 'Agent run'
  const trailSteps = steps.filter((s) => s.type !== 'done')

  return (
    <div className="mb-4">
      {/* ── Collapsed pill ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs text-white/60 hover:text-white/80 hover:bg-white/[0.07] transition-colors"
        aria-expanded={expanded}
      >
        {isRunning && !isDone ? (
          <Loader2 className="w-3 h-3 text-teal-400 animate-spin flex-shrink-0" />
        ) : (
          <Check className="w-3 h-3 text-teal-400 flex-shrink-0" />
        )}
        <span>{pillLabel}</span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
        )}
      </button>

      {/* ── Expanded step trail ─────────────────────────────────────────────── */}
      {expanded && trailSteps.length > 0 ? (
        <div className="mt-2 ml-1 border-l border-white/10 pl-3 space-y-1.5">
          {trailSteps.map((s, i) => (
            <TrailRow key={i} step={s} />
          ))}
        </div>
      ) : null}

      {/* ── Approval card ───────────────────────────────────────────────────── */}
      {pendingApproval ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 max-w-sm">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-xs font-medium text-white/80">Approval needed</span>
          </div>
          <p className="text-sm text-white/70 mb-1">{pendingApproval.toolName}</p>
          <p className="text-xs text-white/40 font-mono break-all mb-3">
            {pendingApproval.inputSummary}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onDeny}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20 transition-colors"
            >
              Deny
            </button>
            <button
              onClick={onApprove}
              className="px-3 py-1.5 text-xs rounded-lg bg-teal-500/20 border border-teal-500/30 text-teal-300 hover:bg-teal-500/30 transition-colors"
            >
              Allow this once
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TrailRow({ step }: { step: Exclude<AgentStep, { type: 'done' }> }) {
  if (step.type === 'thought') {
    return (
      <p className="text-xs text-white/40 italic leading-relaxed">
        {step.text}
      </p>
    )
  }
  if (step.type === 'tool_selected') {
    return (
      <p className="text-xs text-white/50">
        <span className="text-teal-400/80 mr-1">→</span>
        {step.toolName}
      </p>
    )
  }
  if (step.type === 'step_done') {
    return (
      <p className="text-xs text-white/60">
        <span className="text-teal-400 mr-1">✓</span>
        <span className="font-medium">{step.toolName}:</span>{' '}
        <span className="text-white/40">{step.resultSummary}</span>
      </p>
    )
  }
  if (step.type === 'denied') {
    return (
      <p className="text-xs text-red-400/70 flex items-center gap-1">
        <X className="w-3 h-3 inline flex-shrink-0" />
        {step.toolName} — denied
      </p>
    )
  }
  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/AgentRunTimeline.tsx
git commit -m "feat: add AgentRunTimeline component with step trail and approval card"
```

---

## Task 7: Wire `Chat.jsx`

**Files:**
- Modify: `src/views/Chat.jsx`

Three changes:
1. Add imports (`runAgentLoop`, `AgentRunTimeline`)
2. Add state + ref (`agentSteps`, `pendingApproval`, `approvalResolveRef`)
3. Add `tool_use` branch in `handleSend` (before the retrieval pipeline)
4. Render `AgentRunTimeline` in the message list (live + persisted)

- [ ] **Step 1: Add imports**

Find the existing import block at the top of `src/views/Chat.jsx`. The last import line is currently:
```js
import StarterPromptGrid from '../components/chat/StarterPromptGrid.jsx'
import ChatMessage from '../components/chat/ChatMessage.jsx'
```

Add after `ChatMessage`:
```js
import AgentRunTimeline from '../components/chat/AgentRunTimeline.jsx'
import { runAgentLoop } from '../flow-ai/services/agentLoopService.js'
```

- [ ] **Step 2: Add state and ref**

Find the existing state declarations around line 642 in Chat.jsx. They look like:
```js
const [streamingText, setStreamingText] = useState('')
const [busy, setBusy] = useState(false)
const [retrievedHint, setRetrievedHint] = useState([])
```

Insert AFTER the `abortRef` line (`const abortRef = useRef(null)`):

```js
const [agentSteps, setAgentSteps] = useState([])
const [pendingApproval, setPendingApproval] = useState(null)
const approvalResolveRef = useRef(null)

function onApproveHandler() {
  approvalResolveRef.current?.approve()
  approvalResolveRef.current = null
  setPendingApproval(null)
}

function onDenyHandler() {
  approvalResolveRef.current?.deny()
  approvalResolveRef.current = null
  setPendingApproval(null)
}
```

- [ ] **Step 3: Add `tool_use` branch in `handleSend`**

In `handleSend`, find these lines (around line 793):
```js
setSuggestions(null)
latestAssistantRef.current = ''

let pipelineResult = null
let retrieved = []
```

Insert the tool_use branch between `latestAssistantRef.current = ''` and `let pipelineResult = null`:

```js
    // ── Agent loop (tool_use intent) ────────────────────────────────────────
    if (intent === 'tool_use') {
      const agentMemory = [
        ...(seedMemory || []).filter((m) => !isMemoryDismissed(m.id)),
        ...Object.values(memoryEntries || {}),
      ]
        .filter((m) => (m.status || 'active') === 'active' && m.content)
        .map((m) => ({ category: String(m.category || 'note'), content: String(m.content) }))

      setBusy(true)
      setAgentSteps([])
      setPendingApproval(null)

      const onAgentEvent = (event) => {
        if (event.type === 'awaiting_approval') {
          setPendingApproval(event.pendingApproval)
          approvalResolveRef.current = { approve: event.approve, deny: event.deny }
          return
        }
        setAgentSteps((prev) => [...prev, event])
      }

      try {
        const { steps, finalAnswer } = await runAgentLoop(text, {
          ctrl,
          memoryContext: agentMemory,
          onEvent: onAgentEvent,
        })
        addChatMessage(convId, { role: 'assistant', content: finalAnswer, agentSteps: steps })
      } finally {
        setBusy(false)
        setPendingApproval(null)
        approvalResolveRef.current = null
        abortRef.current = null
      }
      return
    }
    // ── Normal retrieval path continues ─────────────────────────────────────
```

- [ ] **Step 4: Add `AgentRunTimeline` to the message rendering**

In the conversation mode rendering (inside the `<div ref={scrollRef}>` scroll area), find the message loop:

```jsx
{messages.map((m, i) => (
  <React.Fragment key={m.id}>
    <MessageBubble message={m} />
    {m.role === 'assistant' && (m.followUpSuggestions || (i === messages.length - 1 && suggestions)) ? (
```

Change it to:

```jsx
{messages.map((m, i) => (
  <React.Fragment key={m.id}>
    <MessageBubble message={m} />
    {m.role === 'assistant' && m.agentSteps?.length > 0 ? (
      <AgentRunTimeline
        steps={m.agentSteps}
        pendingApproval={null}
        onApprove={() => {}}
        onDeny={() => {}}
      />
    ) : null}
    {m.role === 'assistant' && (m.followUpSuggestions || (i === messages.length - 1 && suggestions)) ? (
```

Then find the `{streamingText ? ...}` block and the typing indicator. Change those three blocks from:

```jsx
{streamingText ? <MessageBubble message={{ role: 'assistant', content: streamingText }} /> : null}
{busy && !streamingText ? (
  <div className="flex justify-start mb-4">
    <div className="rounded-2xl px-4 py-3 bg-white/[0.05]">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-white/70 typing-dot" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-white/70 typing-dot" style={{ animationDelay: '180ms' }} />
        <span className="w-2 h-2 rounded-full bg-white/70 typing-dot" style={{ animationDelay: '360ms' }} />
      </div>
    </div>
  </div>
) : null}
{retrievedHint.length > 0 && (busy || streamingText) ? <CitedDocsHint retrieved={retrievedHint} /> : null}
```

To:

```jsx
{/* Live agent run — shown while the loop is executing */}
{busy && agentSteps.length > 0 ? (
  <AgentRunTimeline
    steps={agentSteps}
    pendingApproval={pendingApproval}
    onApprove={onApproveHandler}
    onDeny={onDenyHandler}
    isRunning={true}
  />
) : null}
{streamingText ? <MessageBubble message={{ role: 'assistant', content: streamingText }} /> : null}
{busy && !streamingText && agentSteps.length === 0 ? (
  <div className="flex justify-start mb-4">
    <div className="rounded-2xl px-4 py-3 bg-white/[0.05]">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-white/70 typing-dot" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-white/70 typing-dot" style={{ animationDelay: '180ms' }} />
        <span className="w-2 h-2 rounded-full bg-white/70 typing-dot" style={{ animationDelay: '360ms' }} />
      </div>
    </div>
  </div>
) : null}
{retrievedHint.length > 0 && (busy || streamingText) ? <CitedDocsHint retrieved={retrievedHint} /> : null}
```

- [ ] **Step 5: Run the full test suite**

```
npx vitest run
```

Expected: all existing tests pass. No regressions.

- [ ] **Step 6: Manual smoke test in the browser**

Start the dev server (`npm run dev`). Open `/chat` and verify:

1. Type `"what is n8n?"` → routes to normal retrieval path (no agent steps appear)
2. Type `"list my flowmap topics"` → routes to agent loop; step trail appears below the user message; "Get Followed Topics" shows in the pill after the run
3. If Telegram is connected: type `"send a message to @channel saying hello"` → step trail appears, then the approval card appears. Clicking **Deny** shows the polite explanation message. Clicking **Allow** runs the tool.
4. After a run, reload the page → the assistant message with persisted `agentSteps` still shows the collapsed pill with the tool names.
5. Open Memory → Memory entries → confirm a `research_focus` entry from `agent_run` source appears.

- [ ] **Step 7: Commit**

```bash
git add src/views/Chat.jsx
git commit -m "feat: wire Chat.jsx to agent loop — tool_use branch, AgentRunTimeline, approval gate"
```

---

## Self-Review Against Spec

### Spec coverage
| Spec requirement | Covered by |
|---|---|
| `classifyIntent` returns `'tool_use'` | Task 2 |
| `handleSend` branches on `tool_use` | Task 7 Step 3 |
| Agent loop calls Ollama with JSON format | Task 1 (`chatJson`), Task 5 |
| Loop uses separate system prompt (not `buildSystemMessage`) | Task 4 (`buildAgentSystemPrompt`) |
| `read` tools auto-execute | Task 5 (`riskLevel !== 'read'` gate) |
| `write`/`publish` tools show approval card | Task 5 (`awaitApproval`), Task 6 |
| Approval card shows tool name + input summary + Allow/Deny | Task 6 |
| Deny stops loop with polite explanation | Task 5 |
| Step trail: thought / tool_selected / step_done / denied / done | Task 5 (emit), Task 6 (render) |
| Max 5 steps then partial answer | Task 5 |
| JSON retry once on malformed output | Task 5 |
| Tool error retry once | Task 5 |
| AbortController stops loop | Task 5 |
| Step trail persisted on assistant message | Task 7 Step 4 |
| Collapsed pill after run | Task 6 |
| `writeAgentResult()` in `mcpMemoryService.ts` | Task 3 |
| Memory entry appears in Memory view | Task 3 (`category: 'research_focus'`) |
| Normal retrieval path untouched | Task 7 (early return) |

### Placeholder scan
None — all steps contain complete code.

### Type consistency
- `AgentStep` defined once in `agentLoopService.ts`, imported in `AgentRunTimeline.tsx`
- `PendingApprovalState` defined once in `agentLoopService.ts`, imported in `AgentRunTimeline.tsx`
- `MemoryContextEntry` defined once in `agentLoopService.ts`, re-exported from `agentSystemPrompt.ts` (same shape)
- `writeAgentResult` parameter `source: 'agent_run'` is a literal type — matches usage in `agentLoopService.ts`
- `agentSteps` on chat messages: Chat.jsx passes them as plain JS — no type annotation needed in the JSX file
