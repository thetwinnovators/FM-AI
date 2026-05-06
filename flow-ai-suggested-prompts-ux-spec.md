# Flow AI Suggested Prompts UX Spec

This document defines how Flow AI should provide predetermined follow-up questions and action prompts after each response so the interaction feels guided, faster, and more useful.

## Goal

Flow AI should always help the user continue the conversation without requiring them to think of the next prompt from scratch.

The AI should:
- answer the current request
- anticipate likely next requests
- present predetermined follow-up questions the user can tap
- present useful actions when relevant
- update those suggestions after every response

## Core principle

The pattern should be consistent, but the prompt options should be dynamic.

That means:
- the UI always shows suggested follow-up prompts
- the prompts themselves change based on context
- the AI should not use one fixed list everywhere
- the suggestions should feel relevant to the latest response

## Why this matters

Suggested follow-ups reduce friction in conversational interfaces and help users continue naturally.

For Flow AI, this is especially useful because the system is not just conversational. It also supports actions such as:
- Save to Topic
- Save as Note
- Pin signal
- Mute signal
- Create watch rule
- Generate summary
- Generate content ideas
- Send to Telegram
- Start workflow

The AI should not only answer. It should help the user decide what to do next.

## UX pattern

Each AI response should end with two optional prompt layers:

### 1. Suggested questions
These are tap-to-ask follow-up questions.

### 2. Suggested actions
These are tap-to-run actions when relevant.

### Recommended layout

```text
AI response

Suggested questions
[ Explain this more simply ]
[ Show the implementation steps ]
[ What should be done first? ]

Actions
[ Save as Note ]
[ Generate summary ]
```

## Prompt design rules

Suggested questions should be:
- short
- specific
- relevant to the current answer
- different from one another
- oriented toward likely next intent

Avoid:
- generic filler
- repeated variations of the same question
- broad questions with no clear purpose
- more than 5 prompts at once

## Prompt categories

Every response should try to generate prompts from a mix of categories.

### Clarify
Used when the answer contains technical detail or complexity.

Examples:
- Explain this more simply
- What does that mean in practice?
- Show the issue in plain terms

### Expand
Used when the user may want more depth.

Examples:
- Show the full implementation plan
- Break this into steps
- Give the detailed version

### Compare
Used when tradeoffs or options exist.

Examples:
- What are the tradeoffs?
- Compare the options
- Which approach is better?

### Act
Used when the result can become something useful in FlowMap.

Examples:
- Save this as a note
- Generate a summary
- Turn this into content ideas

### Next-step
Used to move the conversation forward.

Examples:
- What should be done first?
- What should be fixed next?
- What part matters most?

## Quantity rules

Default output:
- 3 suggested questions
- 0 to 3 suggested actions

Fallbacks:
- if the answer is very short, still show at least 2 suggested questions
- if no meaningful action exists, omit the action row
- if confidence is low, include 1 clarifying prompt instead of pretending to know the next step

## Context logic

Suggestions should be generated from:
- the user’s latest message
- the AI’s latest response
- the current content type, such as topic, signal, note, memory, or chat
- available FlowMap actions
- confidence in the AI’s interpretation

Suggestions should not be generated from a static hardcoded list alone.

## Response schema

Use structured output so the UI can render suggestions reliably.

```ts
interface FlowAIResponse {
  answer: string;
  suggestedQuestions: string[];
  suggestedActions?: FlowAIAction[];
  confidence?: number;
  followUpMode?: 'normal' | 'clarify';
}

type FlowAIAction =
  | 'save-to-topic'
  | 'save-as-note'
  | 'pin-signal'
  | 'mute-signal'
  | 'create-watch-rule'
  | 'generate-summary'
  | 'generate-content-ideas'
  | 'send-to-telegram'
  | 'start-workflow';
```

## Generation rules

### Normal mode
When the AI understands the request well:
- generate 3 follow-up questions
- vary the prompts across categories
- include actions only if they are relevant

### Clarify mode
When the AI is uncertain:
- generate 1 to 2 clarifying prompts
- avoid overconfident next-step suggestions
- prioritize narrowing the user’s intent

Example:
- Do you want the UX version or the technical version?
- Should this work for Telegram only or for all chat surfaces?

## Prompt strategy by intent

### If the user asks for explanation
Return prompts like:
- Explain this more simply
- Show a practical example
- What should be done first?

### If the user asks for debugging help
Return prompts like:
- Show the part of the code to inspect
- Give a debug checklist
- What is the most likely root cause?

### If the user asks for product planning
Return prompts like:
- Turn this into a spec
- Break this into phases
- What are the tradeoffs?

### If the user asks about signals or saved content
Return prompts like:
- Save to Topic
- Generate summary
- Create content ideas

## UI behavior

### Placement
Show prompt chips directly below the AI response.

### Interaction
- one tap sends the selected question immediately
- selected actions should run or open a confirmation flow
- once the next response arrives, replace the old suggestions with new ones

### Visual treatment
- use chips or pill buttons
- keep labels short
- do not hide the prompts behind menus by default
- show actions as a separate row from questions

## Guardrails

Do not let the AI:
- generate duplicate prompts
- generate prompts unrelated to the answer
- show more than 5 prompts total in one block unless explicitly designed otherwise
- suggest unavailable actions
- suggest actions with misleading certainty

## Ranking logic

Suggested questions should be ranked by:
1. relevance to latest response
2. usefulness as the next step
3. diversity across categories
4. actionability
5. confidence

## Example outputs

### Example 1: debugging response

```json
{
  "answer": "Telegram is connected, but the incoming message may not be reaching the Ollama handler.",
  "suggestedQuestions": [
    "Show the exact handler logic to fix",
    "Give me a debug checklist",
    "What is the most likely root cause?"
  ],
  "suggestedActions": ["save-as-note", "generate-summary"],
  "confidence": 0.88,
  "followUpMode": "normal"
}
```

### Example 2: low-confidence response

```json
{
  "answer": "There may be more than one issue in the Telegram flow.",
  "suggestedQuestions": [
    "Should this work for free text or commands only?",
    "Do you want to debug the webhook or the Ollama call first?"
  ],
  "confidence": 0.54,
  "followUpMode": "clarify"
}
```

## Recommended implementation flow

```text
User message
  -> intent detection
  -> Flow AI response generation
  -> follow-up prompt generator
  -> action suggester
  -> structured output assembly
  -> UI render
```

## Services

```text
src/flow-ai/
  services/
    responseService.ts
    suggestedQuestionService.ts
    suggestedActionService.ts
    followUpRankingService.ts
    followUpSchemaService.ts
```

## Suggested internal logic

### suggestedQuestionService
Responsibilities:
- inspect latest user intent
- inspect latest answer
- generate candidate prompts by category
- remove duplicates
- limit count
- pass candidates to ranking

### suggestedActionService
Responsibilities:
- map answer context to valid FlowMap actions
- filter unavailable actions
- order actions by usefulness

### followUpRankingService
Responsibilities:
- score relevance
- score diversity
- score confidence alignment
- select final prompts

## Product behavior standard

Flow AI should always end with helpful next-step options.

The user should never be left asking:
- What do I ask next?
- What can I do with this answer?
- What is the next useful step?

The system should help answer those questions proactively.

## Success criteria

This feature is successful when:
- users continue conversations more easily
- prompt friction is reduced
- more outputs are converted into actions
- Flow AI feels more guided and agentic
- follow-up prompts feel relevant instead of random

## Final recommendation

Make suggested prompts a permanent interaction pattern across Flow AI.

Use a fixed UI pattern with dynamic, context-aware prompt generation.
Use structured outputs so the UI can reliably render question chips and action chips after every response.
EOF && ls -l /home/user/output/flow-ai-suggested-prompts-ux-spec.md
