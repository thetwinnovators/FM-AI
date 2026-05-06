# Flow AI Suggested Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After every AI response in the chat, show 2–3 tap-to-send follow-up question chips and 0–2 action chips so users never have to think of the next prompt from scratch.

**Architecture:** A pure `followUpService.ts` generates suggestions by first trying a fast non-streaming Ollama call for contextual JSON output, then falling back to heuristic tables keyed by `QueryIntent`. The `SuggestedPrompts.jsx` chip row renders below the last assistant message; `Chat.jsx` manages `suggestions` state, resets it on each send, and populates it after streaming completes.

**Tech Stack:** TypeScript (service), React + Tailwind (UI), Vitest + React Testing Library (tests), Ollama `/api/generate` (LLM path), `generateResponse` + `OLLAMA_CONFIG` from existing `ollama.js`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/flow-ai/services/followUpService.ts` | Create | Types + heuristic engine + LLM generation with fallback |
| `src/flow-ai/services/__tests__/followUpService.test.ts` | Create | Unit tests for heuristic functions (pure, no Ollama) |
| `src/components/chat/SuggestedPrompts.jsx` | Create | Chip row UI: question chips + action chips |
| `src/components/chat/__tests__/SuggestedPrompts.test.jsx` | Create | Render + interaction tests |
| `src/views/Chat.jsx` | Modify | Add `suggestions` state, call service after stream, render chips |

---

## Task 1: `followUpService.ts` — types and heuristic engine

**Files:**
- Create: `src/flow-ai/services/followUpService.ts`
- Create: `src/flow-ai/services/__tests__/followUpService.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/flow-ai/services/__tests__/followUpService.test.ts
import { describe, it, expect } from 'vitest'
import {
  generateHeuristicFollowUps,
  pickActions,
  type FlowAIAction,
  type FollowUpSuggestions,
} from '../followUpService.js'

describe('generateHeuristicFollowUps', () => {
  it('returns 3 questions for retrieval intent', () => {
    const result = generateHeuristicFollowUps('retrieval', 'Some answer about AI agents.')
    expect(result).toHaveLength(3)
    result.forEach((q) => expect(typeof q).toBe('string'))
    result.forEach((q) => expect(q.length).toBeGreaterThan(0))
  })

  it('returns questions for signal_analysis intent', () => {
    const result = generateHeuristicFollowUps('signal_analysis', 'Rising signal detected.')
    expect(result).toHaveLength(3)
  })

  it('returns questions for unknown/undefined intent', () => {
    const result = generateHeuristicFollowUps('unclear', '')
    expect(result).toHaveLength(3)
  })

  it('never returns duplicate questions', () => {
    const result = generateHeuristicFollowUps('retrieval', 'test')
    const unique = new Set(result)
    expect(unique.size).toBe(result.length)
  })
})

describe('pickActions', () => {
  it('returns empty array for casual_chat', () => {
    expect(pickActions('casual_chat')).toEqual([])
  })

  it('returns save-as-note for retrieval', () => {
    const actions = pickActions('retrieval')
    expect(actions).toContain('save-as-note')
  })

  it('returns at most 2 actions', () => {
    const actions = pickActions('content_ideation')
    expect(actions.length).toBeLessThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/flow-ai/services/__tests__/followUpService.test.ts
```
Expected: FAIL — "Cannot find module '../followUpService.js'"

- [ ] **Step 3: Create `followUpService.ts`**

```ts
// src/flow-ai/services/followUpService.ts
/**
 * Follow-up suggestion engine.
 *
 * Strategy: try Ollama first for contextual JSON output (fast non-streaming
 * call); fall back to heuristic tables keyed by QueryIntent when Ollama is
 * off or the parse fails. Heuristic path adds zero latency.
 */

import { generateResponse } from '../../lib/llm/ollama.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import type { QueryIntent } from './queryAnalysisService.js'

// ─── public types ─────────────────────────────────────────────────────────────

export type FlowAIAction =
  | 'save-as-note'
  | 'generate-summary'
  | 'generate-content-ideas'

export interface FollowUpSuggestions {
  questions:     string[]          // 2–3 tap-to-send follow-up questions
  actions:       FlowAIAction[]    // 0–2 in-app actions
  followUpMode:  'normal' | 'clarify'
  confidence:    number            // 0–1; < 0.6 → clarify mode
  fromLLM:       boolean           // true when Ollama produced the suggestions
}

// ─── heuristic tables ─────────────────────────────────────────────────────────

const HEURISTIC_QUESTIONS: Record<string, string[]> = {
  signal_analysis:   [
    'Which signals should I prioritize?',
    'What patterns are emerging?',
    'How do I act on this?',
  ],
  summarisation:     [
    'What are the key takeaways?',
    'What should I do with this?',
    'How does this connect to my other research?',
  ],
  comparison:        [
    'Which option fits my goals better?',
    'What are the main tradeoffs?',
    'Give me a clear recommendation',
  ],
  note_generation:   [
    'Expand on this further',
    'How should I organize this?',
    'Add a practical example',
  ],
  action_suggestion: [
    'What is the first step?',
    'What resources do I need?',
    'How do I measure progress?',
  ],
  content_ideation:  [
    'Give me 3 more ideas',
    'Which idea has the most potential?',
    'How do I validate this?',
  ],
  retrieval:         [
    'Tell me more about this',
    'What are the most important points?',
    'How does this relate to my other notes?',
  ],
  unclear:           [
    'Can you be more specific?',
    'Give me a practical example',
    'What else should I know?',
  ],
  casual_chat:       [
    'Tell me something useful about my research',
    'What topics am I tracking?',
    'What are my latest signals?',
  ],
}

const HEURISTIC_ACTIONS: Record<string, FlowAIAction[]> = {
  signal_analysis:   ['save-as-note'],
  summarisation:     ['save-as-note'],
  comparison:        ['save-as-note'],
  note_generation:   ['save-as-note'],
  action_suggestion: ['save-as-note'],
  content_ideation:  ['generate-content-ideas', 'save-as-note'],
  retrieval:         ['save-as-note', 'generate-summary'],
  unclear:           [],
  casual_chat:       [],
}

// ─── exported heuristic helpers (pure, testable) ──────────────────────────────

export function generateHeuristicFollowUps(
  intent: string,
  _assistantText: string,
): string[] {
  const list = HEURISTIC_QUESTIONS[intent] ?? HEURISTIC_QUESTIONS['unclear']
  return list.slice(0, 3)
}

export function pickActions(intent: string): FlowAIAction[] {
  const list = HEURISTIC_ACTIONS[intent] ?? []
  return list.slice(0, 2)
}

// ─── LLM generation (with heuristic fallback) ────────────────────────────────

const LLM_PROMPT_TEMPLATE = (userMsg: string, answerSnippet: string) =>
  `You are generating follow-up prompts for a chat interface. Respond ONLY with valid JSON — no prose, no markdown.

User message: "${userMsg.slice(0, 200)}"
AI response: "${answerSnippet.slice(0, 400)}"

Rules:
- 3 short follow-up questions (under 8 words each)
- 0–2 actions from: save-as-note, generate-summary, generate-content-ideas
- followUpMode is "clarify" only when the answer was uncertain/vague
- confidence is 0.0–1.0

{"questions":["Q1","Q2","Q3"],"actions":[],"followUpMode":"normal","confidence":0.9}`

function parseLLMResponse(raw: string | null): Partial<FollowUpSuggestions> | null {
  if (!raw) return null
  try {
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) return null
    const parsed = JSON.parse(jsonStr)
    const questions: string[] = Array.isArray(parsed.questions)
      ? parsed.questions.filter((q: unknown) => typeof q === 'string' && q.trim()).slice(0, 3)
      : []
    if (questions.length < 2) return null   // too few → use heuristic
    const actions: FlowAIAction[] = Array.isArray(parsed.actions)
      ? parsed.actions.filter((a: unknown): a is FlowAIAction =>
          ['save-as-note', 'generate-summary', 'generate-content-ideas'].includes(a as string)
        ).slice(0, 2)
      : []
    const confidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.8
    const followUpMode = confidence < 0.6 ? 'clarify' : 'normal'
    return { questions, actions, followUpMode, confidence }
  } catch {
    return null
  }
}

// ─── main entry point ─────────────────────────────────────────────────────────

export async function generateFollowUps(
  userMessage: string,
  assistantText: string,
  intent: QueryIntent | string,
  signal?: AbortSignal,
): Promise<FollowUpSuggestions> {
  // Try Ollama first when it's enabled
  if (OLLAMA_CONFIG.enabled) {
    try {
      const prompt = LLM_PROMPT_TEMPLATE(userMessage, assistantText)
      const raw = await generateResponse(prompt, { signal, temperature: 0.4 })
      const parsed = parseLLMResponse(raw)
      if (parsed?.questions) {
        return {
          questions:    parsed.questions,
          actions:      parsed.actions    ?? [],
          followUpMode: parsed.followUpMode ?? 'normal',
          confidence:   parsed.confidence  ?? 0.8,
          fromLLM:      true,
        }
      }
    } catch {
      // fall through to heuristic
    }
  }

  // Heuristic fallback — zero latency
  return {
    questions:    generateHeuristicFollowUps(intent, assistantText),
    actions:      pickActions(intent),
    followUpMode: 'normal',
    confidence:   0.7,
    fromLLM:      false,
  }
}
```

- [ ] **Step 4: Run the tests — they should pass**

```bash
npx vitest run src/flow-ai/services/__tests__/followUpService.test.ts
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/flow-ai/services/followUpService.ts src/flow-ai/services/__tests__/followUpService.test.ts
git commit -m "feat: add followUpService with heuristic + LLM follow-up generation"
```

---

## Task 2: `SuggestedPrompts.jsx` — chip row UI component

**Files:**
- Create: `src/components/chat/SuggestedPrompts.jsx`
- Create: `src/components/chat/__tests__/SuggestedPrompts.test.jsx`

- [ ] **Step 1: Write failing tests**

```jsx
// src/components/chat/__tests__/SuggestedPrompts.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SuggestedPrompts from '../SuggestedPrompts.jsx'

const defaultProps = {
  questions: ['Tell me more', 'What are the key points?', 'How does this connect?'],
  actions: ['save-as-note'],
  onSend: vi.fn(),
  onAction: vi.fn(),
}

describe('SuggestedPrompts', () => {
  it('renders all question chips', () => {
    render(<SuggestedPrompts {...defaultProps} />)
    expect(screen.getByText('Tell me more')).toBeTruthy()
    expect(screen.getByText('What are the key points?')).toBeTruthy()
    expect(screen.getByText('How does this connect?')).toBeTruthy()
  })

  it('renders action chip with display label', () => {
    render(<SuggestedPrompts {...defaultProps} />)
    expect(screen.getByText('Save as note')).toBeTruthy()
  })

  it('calls onSend with question text when question chip is clicked', () => {
    const onSend = vi.fn()
    render(<SuggestedPrompts {...defaultProps} onSend={onSend} />)
    fireEvent.click(screen.getByText('Tell me more'))
    expect(onSend).toHaveBeenCalledWith('Tell me more')
  })

  it('calls onAction with action key when action chip is clicked', () => {
    const onAction = vi.fn()
    render(<SuggestedPrompts {...defaultProps} onAction={onAction} />)
    fireEvent.click(screen.getByText('Save as note'))
    expect(onAction).toHaveBeenCalledWith('save-as-note')
  })

  it('renders nothing when questions array is empty', () => {
    const { container } = render(
      <SuggestedPrompts {...defaultProps} questions={[]} actions={[]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders generate-summary action with correct label', () => {
    render(<SuggestedPrompts {...defaultProps} actions={['generate-summary']} />)
    expect(screen.getByText('Generate summary')).toBeTruthy()
  })

  it('renders generate-content-ideas action with correct label', () => {
    render(<SuggestedPrompts {...defaultProps} actions={['generate-content-ideas']} />)
    expect(screen.getByText('Content ideas')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/chat/__tests__/SuggestedPrompts.test.jsx
```
Expected: FAIL — "Cannot find module '../SuggestedPrompts.jsx'"

- [ ] **Step 3: Create `SuggestedPrompts.jsx`**

```jsx
// src/components/chat/SuggestedPrompts.jsx

const ACTION_LABELS = {
  'save-as-note':           'Save as note',
  'generate-summary':       'Generate summary',
  'generate-content-ideas': 'Content ideas',
}

export default function SuggestedPrompts({ questions, actions, onSend, onAction }) {
  if (!questions || questions.length === 0) return null

  return (
    <div className="flex flex-col gap-2 mt-3 mb-4 ml-1 max-w-[75%]">
      {/* Follow-up question chips */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q) => (
          <button
            key={q}
            onClick={() => onSend(q)}
            className="text-[12px] px-3 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] text-white/70
              hover:bg-white/[0.10] hover:text-white hover:border-white/[0.22] transition-colors cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Action chips — visually distinct from question chips */}
      {actions && actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {actions.map((a) => {
            const label = ACTION_LABELS[a]
            if (!label) return null
            return (
              <button
                key={a}
                onClick={() => onAction(a)}
                className="text-[11px] px-3 py-1 rounded-full border border-[color:var(--color-topic)]/30
                  bg-[color:var(--color-topic)]/10 text-[color:var(--color-topic)]
                  hover:bg-[color:var(--color-topic)]/20 hover:border-[color:var(--color-topic)]/50
                  transition-colors cursor-pointer font-medium uppercase tracking-wide"
              >
                {label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — they should pass**

```bash
npx vitest run src/components/chat/__tests__/SuggestedPrompts.test.jsx
```
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/SuggestedPrompts.jsx src/components/chat/__tests__/SuggestedPrompts.test.jsx
git commit -m "feat: add SuggestedPrompts chip row component"
```

---

## Task 3: Wire suggestions into `Chat.jsx`

**Files:**
- Modify: `src/views/Chat.jsx`

Context: `Chat.jsx` lives at `src/views/Chat.jsx`. The relevant section is `handleSend` (lines ~669–808) and the message list render (lines ~910–926). The component already imports from `src/flow-ai/services/retrievalService.js` — follow the same pattern.

- [ ] **Step 1: Add the import at the top of `Chat.jsx`**

Add these two lines after the existing flow-ai import on line 9:

```js
import { generateFollowUps } from '../flow-ai/services/followUpService.js'
import SuggestedPrompts from '../components/chat/SuggestedPrompts.jsx'
```

- [ ] **Step 2: Add `suggestions` state and `latestAssistantText` ref inside the `Chat` component**

Add after the existing `const [voicePlaying, setVoicePlaying] = useState(false)` line (~line 588):

```js
const [suggestions, setSuggestions] = useState(null)
// Ref so the action handler can access assistant text without stale closure
const latestAssistantRef = useRef('')
```

- [ ] **Step 3: Reset suggestions at the top of `handleSend`**

Add this line immediately after `let pipelineResult = null` (around line 693, inside `handleSend`):

```js
setSuggestions(null)
latestAssistantRef.current = ''
```

- [ ] **Step 4: Generate suggestions after stream completes**

Find the block that ends with `setStreamingText(''); setBusy(false)` (around line 805–807). Replace it with:

```js
    setStreamingText('')
    setBusy(false)
    abortRef.current = null

    // Generate follow-up suggestions after the response is complete.
    // Fire-and-forget: doesn't affect busy state, won't block anything.
    if (assistantText.trim()) {
      latestAssistantRef.current = assistantText
      generateFollowUps(text, assistantText, intent).then(setSuggestions).catch(() => {})
    }
```

Note: Remove the existing `abortRef.current = null` line (~line 807) since it's now included above. Confirm the existing code ends with just `}` closing `handleSend` after those two lines.

- [ ] **Step 5: Handle actions in a new `handleSuggestionAction` function**

Add this function immediately before the `const ollamaOff = !OLLAMA_CONFIG.enabled` line (~line 810):

```js
  function handleSuggestionAction(action) {
    if (action === 'save-as-note') {
      const text = latestAssistantRef.current.trim()
      if (!text) return
      addMemory({
        category: 'research_note',
        content: text.slice(0, 600),
        source: 'chat-ai',
      })
      // Brief visual feedback: clear suggestions after saving
      setSuggestions(null)
      return
    }
    // For generate-* actions: send as a follow-up message
    const FOLLOW_UP_TEXT = {
      'generate-summary':       'Generate a summary of this',
      'generate-content-ideas': 'Generate content ideas based on this',
    }
    const followUpText = FOLLOW_UP_TEXT[action]
    if (followUpText) {
      setSuggestions(null)
      handleSend(followUpText)
    }
  }
```

- [ ] **Step 6: Add `addMemory` to the useStore destructure**

Find the existing `useStore()` destructure near the top of the `Chat` component (around line ~540). Add `addMemory` to it:

```js
  const {
    documents, documentContents, memoryEntries, saves, userTopics,
    addChatMessage, chatMessagesFor, createConversation, deleteConversation,
    updateConversation, allConversationsSorted,
    isFollowing, isMemoryDismissed, userNotes, folders,
    addMemory,   // ← add this
  } = useStore()
```

- [ ] **Step 7: Render `SuggestedPrompts` after the last assistant message**

Find the message list render block (around line 911):

```jsx
{messages.map((m) => <MessageBubble key={m.id} message={m} />)}
```

Replace with:

```jsx
{messages.map((m, i) => (
  <React.Fragment key={m.id}>
    <MessageBubble message={m} />
    {/* Show suggestions below the last assistant message only — not during streaming */}
    {!busy && i === messages.length - 1 && m.role === 'assistant' && suggestions ? (
      <SuggestedPrompts
        questions={suggestions.questions}
        actions={suggestions.actions}
        onSend={(q) => { setSuggestions(null); handleSend(q) }}
        onAction={handleSuggestionAction}
      />
    ) : null}
  </React.Fragment>
))}
```

- [ ] **Step 8: Add the React import for `React.Fragment`**

`Chat.jsx` already imports from `react`. Check that `React` is in scope. If the top import is:
```js
import { useEffect, useMemo, useRef, useState } from 'react'
```
Change it to:
```js
import React, { useEffect, useMemo, useRef, useState } from 'react'
```

- [ ] **Step 9: Verify in browser**

1. Open `http://localhost:5173/chat`
2. Send a message about a topic (not a greeting)
3. After the response streams, you should see 3 small pill chips below the assistant bubble
4. Click a chip — it should send that question as a new message
5. If actions appear (teal chips), click "Save as note" — nothing should visually break

- [ ] **Step 10: Commit**

```bash
git add src/views/Chat.jsx
git commit -m "feat: wire suggested prompts into chat — chips appear after every AI response"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Show 3 follow-up questions after each response | Task 1 generates them; Task 3 renders them |
| Show 0–2 action chips when relevant | Task 1 `pickActions`; Task 2 action chip row |
| Dynamic, context-aware (not static list) | Task 1 LLM path + heuristic keyed by intent |
| One tap sends the question | Task 3 Step 7 `onSend` handler |
| Actions run on tap | Task 3 Step 5 `handleSuggestionAction` |
| Reset suggestions on new send | Task 3 Step 3 |
| Chips show only after stream ends | Task 3 Step 7 `!busy` guard |
| Question chips visually distinct from action chips | Task 2 different colour/style |
| Max 5 prompts total | `questions.slice(0,3)` + `actions.slice(0,2)` = max 5 |
| `save-as-note` action | Task 3 Step 5 — calls `addMemory` |
| `generate-summary` action | Task 3 Step 5 — sends as follow-up |
| `generate-content-ideas` action | Task 3 Step 5 — sends as follow-up |
| `followUpMode: clarify` for low confidence | Task 1 `parseLLMResponse` — confidence < 0.6 |
| Graceful fallback when Ollama off | Task 1 — heuristic path always runs |
| `FlowAIResponse` / `FlowAIAction` types | Defined in `followUpService.ts` as `FollowUpSuggestions` / `FlowAIAction` |

**Out of scope for this plan (spec mentions, not implemented):**
- `save-to-topic`, `pin-signal`, `mute-signal`, `create-watch-rule`, `send-to-telegram`, `start-workflow` — these require navigation or data that isn't available from the chat context; implement in a follow-up spec
- `followUpRankingService.ts`, `suggestedActionService.ts` as separate files — merged into `followUpService.ts` per YAGNI; split when the service grows

**Placeholder scan:** None found.

**Type consistency check:**
- `FlowAIAction` defined in Task 1, used in Task 2 props, Task 3 handler — consistent
- `FollowUpSuggestions.questions` used in Task 3 Step 7 — matches Task 1 definition
- `handleSuggestionAction(action: string)` — matches `onAction` prop in Task 2

---

Plan complete and saved to `docs/superpowers/plans/2026-05-01-suggested-prompts.md`.
