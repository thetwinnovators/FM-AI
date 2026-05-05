# Flow AI ReAct Agent Loop — Design Spec

## Goal

Wire a ReAct (Reason + Act) agent loop into the existing Flow AI chat so it can call connected MCP tools, pause for approval on side-effecting actions, and write results back to memory — without touching the normal retrieval-only chat path.

## Architecture

The normal chat path (`handleSend` → `classifyIntent` → retrieval → `streamChat`) is unchanged. When `classifyIntent` returns `'tool_use'`, `handleSend` branches into `runAgentLoop` instead. All agent-specific logic lives in new files under `src/flow-ai/services/` and a new UI component; nothing in the existing retrieval pipeline is modified.

The MCP layer (`src/mcp/`) already provides:
- `mcpToolRegistry` — 7 registered providers (Telegram, Google Docs, Drive, Gmail, Calendar, Figma, FlowMap)
- `mcpExecutionService.runTool()` — safe execution wrapper with audit logging
- `mcpPermissionService` — risk-level checking
- `mcpMemoryService` — write-back to FlowMap memory
- `MCPToolDefinition.riskLevel` — `'read' | 'write' | 'publish'`

The only modification to `src/mcp/` is adding `writeAgentResult()` to `mcpMemoryService.ts` — all other MCP files are unchanged.

## Section 1 — Intent routing

`classifyIntent` in `src/lib/chat/retrieve.ts` gains a new return value: `'tool_use'`.

Detection heuristics (keyword + pattern, no LLM call):
- Message contains an imperative verb targeting an integration: send, post, draft, create, schedule, search, fetch, read, list, open, update
- Message names a connected integration or its domain: telegram, google docs, drive, gmail, calendar, figma
- Message contains phrases like "use [tool]", "via [tool]", "with [tool]"

If none of these match, `classifyIntent` returns its existing values (`'research'`, `'casual_chat'`, etc.) unchanged.

`handleSend` check:
```ts
const intent = classifyIntent(text)
if (intent === 'tool_use') {
  return runAgentLoop(text, { convId, ctrl, ...context })
}
// existing path continues unchanged
```

## Section 2 — ReAct loop (`agentLoopService.ts`)

File: `src/flow-ai/services/agentLoopService.ts`

### Prompt shape

Each Ollama call in the loop uses a separate system message (built by `agentSystemPrompt.ts`) and a `messages` array that accumulates:
- The original user message
- Each prior `{ role: 'tool', content: <observation> }` message

The model is instructed to respond with **only** valid JSON:
```json
{
  "thought": "string — internal reasoning",
  "action": "tool | answer",
  "toolId": "string (required when action=tool)",
  "toolInput": { "...": "..." },
  "answer": "string (required when action=answer)"
}
```

### Loop

```
maxSteps = 5
step = 0

while step < maxSteps:
  response = await ollamaJsonCall(messages, systemPrompt)
  emit({ type: 'thought', text: response.thought, step })

  if response.action === 'answer':
    emit({ type: 'done', answer: response.answer })
    break

  tool = mcpToolRegistry.getTool(response.toolId)
  emit({ type: 'tool_selected', tool, step })

  if tool.riskLevel === 'read':
    result = await mcpExecutionService.runTool(tool, response.toolInput)
  else:
    result = await awaitApproval(tool, response.toolInput)   // pauses loop
    if result.denied:
      emit({ type: 'denied', tool })
      answer = "I would have [description of action]. Let me know if you'd like to proceed."
      emit({ type: 'done', answer })
      break

  emit({ type: 'step_done', tool, resultSummary: summarise(result), step })
  messages.push({ role: 'tool', content: JSON.stringify(result) })
  step++

if step >= maxSteps:
  emit({ type: 'done', answer: "I've reached the step limit. Here's what I found so far: ..." })
```

### Stop conditions

| Condition | Behaviour |
|---|---|
| `action === 'answer'` | Normal exit, emit done |
| `step >= maxSteps` (5) | Emit partial answer with what was found |
| Tool error (first attempt) | Retry once; on second failure stop and surface error |
| Malformed JSON from model | Retry the Ollama call once with the same prompt; on second failure emit a plain-text answer explaining the model couldn't produce a valid action |
| User abort (AbortController) | Cancel in-flight Ollama call, stop loop |
| Approval denied | Stop loop, emit polite explanation |

### `awaitApproval`

Returns a `Promise<{ approved: boolean, denied: boolean }>`. The approval card component calls `resolveApproval(true/false)` which resolves the promise. The loop `await`s it — execution is suspended until the user responds.

## Section 3 — System prompt for tool calls (`agentSystemPrompt.ts`)

File: `src/flow-ai/services/agentSystemPrompt.ts`

Builds a system message string containing:
1. **Role instruction** — "You are a tool-using assistant. Always respond with valid JSON only."
2. **JSON schema** — exact shape the model must output
3. **Tool catalog** — for each connected tool: `id`, `displayName`, `description`, `riskLevel`. Only tools from integrations with `status === 'connected'` are included.
4. **Memory context** — the same memory entries the normal chat path uses (passed in, not re-fetched)
5. **Constraints** — max steps, what to do when uncertain (prefer `answer` action over guessing a tool)

This is completely separate from `buildSystemMessage` in `retrieve.ts` — the two functions are never mixed.

## Section 4 — Approval gate & UI (`AgentRunTimeline.tsx`)

File: `src/components/chat/AgentRunTimeline.tsx`

### Types

```ts
interface PendingApprovalState {
  toolName: string
  integrationId: string
  inputSummary: string   // human-readable one-liner, e.g. "Send message to @channel: 'hi'"
}

interface AgentRunTimelineProps {
  steps: AgentStep[]
  pendingApproval: PendingApprovalState | null
  onApprove: () => void
  onDeny: () => void
}
```

### AgentStep shape (stored on chat message)
```ts
type AgentStep =
  | { type: 'thought';       text: string;         step: number }
  | { type: 'tool_selected'; toolName: string;      step: number }
  | { type: 'step_done';     toolName: string; resultSummary: string; step: number }
  | { type: 'denied';        toolName: string;      step: number }
  | { type: 'done';          answer: string }
```

### Rendered states

**Collapsed (default after run):** A single pill row: "Used Google Docs · Read file · Answered" with an expand chevron.

**Expanded:** Each step shown as a slim row with icon, tool name, and one-line summary.

**Approval card (inline, rendered when `pendingApproval !== null`):**
```
┌─────────────────────────────────────────────────────┐
│  ⚡ Approval needed                                  │
│  Send Telegram message to @channel                  │
│  "Draft ready for review"                           │
│                          [Deny]  [Allow this once]  │
└─────────────────────────────────────────────────────┘
```

### Chat.jsx integration

`Chat.jsx` gains two new state variables:
```ts
const [agentSteps, setAgentSteps] = useState<AgentStep[]>([])
const [pendingApproval, setPendingApproval] = useState<PendingApprovalState | null>(null)
```

`runAgentLoop` emits events via a callback; Chat.jsx accumulates them into `agentSteps`. When the loop emits `awaiting_approval`, Chat.jsx sets `pendingApproval`.

`AgentRunTimeline` renders:
- Below the most recent user message while the loop is running
- Persisted on the assistant message object (as `agentSteps`) once the run completes

## Section 5 — Memory write-back

After `runAgentLoop` resolves (success, denial, or max-steps), call:

```ts
mcpMemoryService.writeAgentResult({
  userMessage: text,
  toolsUsed: steps.filter(s => s.type === 'step_done').map(s => s.toolName),
  outcome: finalAnswer,
  source: 'agent_run',
})
```

This creates a memory entry with:
- `category: 'research_focus'`
- `content`: one-sentence summary of what was done
- `source: 'agent_run'`
- `addedAt`: ISO timestamp

The entry appears in Memory > Memory entries like any other working memory entry. No special UI needed.

## Files to create

| File | Purpose |
|---|---|
| `src/flow-ai/services/agentLoopService.ts` | ReAct loop, step emission, stop conditions, awaitApproval |
| `src/flow-ai/services/agentSystemPrompt.ts` | Tool-use system message builder |
| `src/components/chat/AgentRunTimeline.tsx` | Step trail, approval card |

## Files to modify

| File | Change |
|---|---|
| `src/lib/chat/retrieve.ts` | Add `'tool_use'` to `classifyIntent` return type and detection |
| `src/views/Chat.jsx` | Branch on `tool_use` intent, wire `agentSteps` state, render `AgentRunTimeline` |
| `src/mcp/services/mcpMemoryService.ts` | Add `writeAgentResult()` method |

## What this does NOT change

- Normal retrieval-only chat path — completely untouched
- `retrieveWithPipeline`, `buildSystemMessage`, `streamChat`
- Any existing MCP providers or tool definitions
- All existing MCP pages and UI

## Success criteria

1. Typing "send a Telegram message to @channel saying hi" routes to the agent loop
2. A `read`-risk tool call executes automatically and the result appears in the step trail
3. A `write`-risk tool call shows the approval card; Allow runs it, Deny stops the loop with an explanation
4. The loop stops cleanly at 5 steps if it hasn't answered
5. After the run, a memory entry appears in Memory > Memory entries summarising what happened
6. The normal "what is n8n?" chat path is completely unaffected
