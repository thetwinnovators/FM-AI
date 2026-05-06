# Flow AI Context Retrieval Redesign Spec

This document defines a redesign of Flow AI’s context retrieval system so that prompt context becomes smaller, more relevant, faster, and easier for the model to use effectively.[cite:1062][cite:855][cite:999]

## Problem statement

The current retrieval behavior appears to inject too much raw material into the active prompt, including personal memory, topic lists, notes, excerpts, and document content at the same time.[cite:1062][cite:855] This creates a context payload that is broad rather than selective, which increases noise, token usage, and latency while making it harder for the model to focus on the actual user request.[cite:999][cite:990][cite:495]

The retrieval system should stop behaving like a memory dump and start behaving like a ranked context builder.[cite:990][cite:995]

## Design goals

The redesigned system should:
- retrieve only what is useful for the current turn[cite:990]
- separate stable identity memory from task-specific knowledge[cite:999]
- rank before injecting context[cite:1030][cite:1031]
- summarize long material unless verbatim text is necessary[cite:999]
- offload large content to files and reference it when needed[cite:999]
- improve speed by reducing prompt size and keeping context structured[cite:1048][cite:1051]
- support future RAG, reranking, and tool execution layers[cite:855][cite:1034]

## Core retrieval model

Flow AI should move to a layered retrieval architecture with hard boundaries between memory classes.

| Layer | Purpose | Included by default | Typical budget |
|---|---|---|---|
| Identity memory | Stable preferences, tone, naming, critical user rules | Yes | 3-8 lines [cite:1062] |
| Task state | Current goal, recent turn summary, in-progress plan | Yes | 1 short summary [cite:999] |
| Conversation context | Only the recent turns relevant to the request | Yes | Last 2-6 turns [cite:995] |
| Retrieved knowledge | Notes, saved topics, excerpts, documents, prior findings | Conditional | Top 2-4 chunks [cite:1030][cite:1031] |
| Tool context | Tool outputs, capability notes, execution artifacts | Just-in-time | Only when needed [cite:999] |
| File-backed context | Large bodies of text or artifacts | Reference-only by default | File pointer only [cite:999] |

This layering prevents all memory types from competing equally for attention in the same prompt window.[cite:990][cite:995]

## Retrieval flow

Use this retrieval pipeline for every non-trivial user query:

```text
User query
  -> classify query type
  -> retrieve identity memory
  -> retrieve task/session state
  -> retrieve candidate knowledge items
  -> rerank candidates
  -> compress/summarize candidates
  -> enforce token budget by layer
  -> assemble final context
  -> send to model
```

This ensures retrieval is deliberate, ranked, and budgeted instead of additive and unbounded.[cite:1030][cite:1031][cite:999]

## Query classification

Before retrieval, classify the query so the system knows what kind of context to fetch.

### Recommended query classes

- **Personal**: questions about user preferences, saved memories, or stable instructions[cite:1062]
- **Topical recall**: questions about a saved topic or a past research area[cite:642]
- **Document lookup**: questions needing supporting excerpts or file-derived evidence[cite:999]
- **Synthesis**: questions requiring multiple sources combined into one answer[cite:1034]
- **Action request**: tasks that may require MCP tools or file outputs[cite:860][cite:999]
- **Session follow-up**: next-turn questions that rely mostly on recent chat state[cite:995]

The query class should determine which memory layers are eligible and how much budget each layer receives.[cite:1030]

## Memory layers

### 1. Identity memory

Identity memory should contain only stable, high-priority user instructions that truly affect response behavior.[cite:1062] It should be short, curated, and pinned.

#### Rules
- Max 3-8 lines.[cite:1062]
- Deduplicate overlapping instructions.
- Remove stylistic preferences that do not materially affect the current task.
- Store as normalized canonical rules rather than multiple paraphrased variants.

#### Example

```text
Identity memory:
- Address the user as Uche at the start of a new conversation.
- Avoid assumptions about family unless the user raises it.
- Prefer direct, product-focused explanations.
```

### 2. Task state

Task state should summarize the current objective, what has already been established, and what the model is trying to do next.[cite:999] This acts as an attention anchor and should be rewritten each turn.

#### Rules
- One short recitation block.
- Include current goal, known constraints, next step.
- Replace long historical thread summaries with one compact update.

### 3. Conversation context

Conversation context should include only the recent turns that matter to the current request.[cite:995] It should not blindly append large prior responses.

#### Rules
- Default to last 2-6 relevant turns.
- Prefer summarized history over raw long chat transcripts.
- Exclude turns that are already represented in task state.

### 4. Retrieved knowledge

Retrieved knowledge should include only the top-ranked pieces of saved knowledge relevant to the question.[cite:1030][cite:1031] This is where topics, notes, excerpts, and documents belong.

#### Rules
- Use top-k retrieval with small default values.
- Separate by source type before reranking.
- Prefer summary first, excerpt second.
- Avoid listing every saved topic that partially matches a query.

### 5. Tool context

Tool context should be injected only if the model must take an action or interpret tool output.[cite:999] Tool capabilities and execution traces do not belong in the prompt unless they are relevant to the next step.

### 6. File-backed context

Large notes, documents, transcripts, or webpage captures should live outside the core context window and be referenced through file handles or file paths.[cite:999] This preserves recall without overwhelming the prompt.[cite:999]

## Ranking model

Flow AI should rank candidates before prompt inclusion.

### Candidate sources

- notes
- saved topics
- document chunks
- prior chat answers
- research artifacts
- MCP execution logs
- file summaries[cite:855][cite:860]

### Ranking dimensions

Use weighted relevance scoring across:
- semantic similarity[cite:1030]
- keyword overlap[cite:1031]
- recency when relevant[cite:1030]
- source trust level[cite:999]
- user intent match[cite:1034]
- task type fit[cite:1030]

### Suggested retrieval defaults

| Context type | Default top-k | Compression |
|---|---|---|
| Identity memory | 1 set | none |
| Task state | 1 | rewrite summary |
| Topics | top 2-3 | one-line summaries |
| Notes | top 2 | summary + optional excerpt |
| Documents | top 2-4 chunks | snippet first |
| Chat memory | top 2 relevant | summary |
| Tool history | top 1-2 only when needed | normalized event summary |

These small values are intentional because the goal is minimal sufficient context, not maximum recall in prompt space.[cite:990][cite:999]

## Compression rules

Retrieval quality depends on compression as much as recall.[cite:999][cite:1035]

### Preferred output order

1. one-line source label
2. one-sentence summary
3. optional short excerpt
4. file reference if larger detail is needed

### Never do this by default

- dump full note bodies
- include long topic descriptions
- include every matching saved item
- show raw excerpts without explanation
- merge unrelated personal memory with topical evidence

## Token budgeting

The system should enforce fixed budgets per layer.

### Suggested default budget

| Layer | Soft budget |
|---|---|
| Identity memory | 60-120 tokens |
| Task state | 60-120 tokens |
| Conversation context | 200-500 tokens |
| Retrieved knowledge | 300-700 tokens |
| Tool context | 0 unless required |
| File-backed context references | 20-80 tokens |

The total context payload should stay small enough that responses remain fast and the model’s attention remains focused.[cite:1048][cite:1051]

## Prompt assembly format

Use a strict context envelope so the model can understand the role of each section.

```text
[IDENTITY]
...

[TASK STATE]
...

[RECENT CONVERSATION]
...

[RETRIEVED KNOWLEDGE]
1. Source: ...
   Summary: ...
   Excerpt: ...

2. Source: ...
   Summary: ...

[TOOL CONTEXT]
...

[FILE REFERENCES]
...
```

This structure makes context more scannable and prevents mixed-priority content from blending together.[cite:995][cite:999]

## RAG readiness

The redesign should support a later full RAG layer without requiring a second major rewrite.[cite:855] That means:
- embeddings-ready indexing[cite:855]
- hybrid retrieval compatibility[cite:1031]
- reranker insertion point[cite:1030]
- typed memory stores[cite:855]
- file-backed artifact references[cite:999]

## UX and observability

The retrieval UI should help debug the system without leaking the entire prompt strategy into the model context.

### UI recommendations

- show a compact “Context used” card
- group used context by layer
- show scores or reason tags for retrieved items
- collapse long supporting material behind expanders
- separate “used in prompt” from “available in memory”

### Debug labels

Each retrieved item should expose:
- source type
- rank
- reason selected
- token cost
- whether summarized or verbatim

This will make it easier to see why a note or topic was included and whether retrieval is behaving correctly.[cite:1035][cite:1026]

## Implementation constraints

- keep stable prompt prefixes for cache reuse[cite:999]
- do not dynamically dump all memories into prompt space[cite:999]
- preserve large content in files instead of long inline bodies[cite:999]
- keep failure traces only when relevant to the current task[cite:999]
- keep identity memory curated by hand or normalized consolidation[cite:1062]

## Success criteria

The redesign is successful if Flow AI:
- uses less context per turn[cite:1048]
- responds faster on average[cite:1051]
- retrieves fewer but more relevant items[cite:1030]
- stops showing large undifferentiated memory dumps[cite:1062]
- produces answers that feel more grounded and less distracted[cite:990]
- creates a clean foundation for RAG and tool-aware context building[cite:855][cite:999]
