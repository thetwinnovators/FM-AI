# Flow AI (Ollama) Effectiveness Upgrade Spec

Create a structured upgrade plan for **Flow AI** so it becomes more effective inside FlowMap. The goal is not just to improve chat quality, but to improve retrieval relevance, memory usage, structured reasoning, and action-taking across the app.

## Goal

Improve Flow AI so it can:
- retrieve the most relevant context from FlowMap
- use memory more intelligently
- classify and summarize consistently
- take useful actions inside FlowMap
- become a reliable local-first AI layer powered by Ollama

## Product framing

Flow AI should not behave like a generic chatbot with a giant prompt. It should behave like a **context-aware local intelligence layer** for FlowMap.

Use this model:
- **FlowMap content** = source knowledge
- **Memory retrieval** = deciding what matters now
- **Flow AI** = reasoning over the best context
- **Actions/tools** = doing something useful with the result

## Core recommendation

The biggest improvements should come from:
1. **better retrieval**
2. **reranking**
3. **typed memory**
4. **structured outputs**
5. **tool/action routing**

Do not treat model swapping as the main solution.

## Primary upgrades

## 1. Retrieval pipeline

Build a stronger retrieval system for Flow AI.

### Requirements
- use embeddings for FlowMap content
- support hybrid retrieval (semantic + keyword)
- retrieve candidates by relevance
- rerank candidates before prompt assembly
- keep prompt context tight and high-quality

### Content sources to index
- topics
- notes
- saved documents
- AI Memory `.txt` files
- chat history
- saved signals
- source content summaries
- future research notes/canvases

### Suggested architecture

```text
User query
  -> query analysis
  -> semantic retrieval
  -> keyword retrieval
  -> merged candidate pool
  -> reranker
  -> prompt context builder
  -> Ollama response
```

## 2. Typed memory model

Do not store or retrieve all memory the same way.

Create memory types such as:
- `topic-memory`
- `signal-memory`
- `note-memory`
- `document-memory`
- `chat-memory`
- `behavior-memory`
- `workflow-memory`

Each memory type should support:
- different retrieval weight
- different recency handling
- different summarization rules
- different confidence rules

## 3. Structured outputs

Use structured outputs for important AI operations.

Flow AI should return predictable JSON-like structures for:
- topic tagging
- signal classification
- summarization
- note generation
- memory extraction
- action suggestions
- content idea generation

Do not rely on loose free-form text for core app features.

### Example structured output shapes

```ts
interface FlowAISummaryResult {
  title: string;
  summary: string;
  keyPoints: string[];
  confidence: number;
}

interface TopicTaggingResult {
  primaryTopicId?: string;
  relatedTopicIds: string[];
  reasoning?: string;
  confidence: number;
}

interface ActionSuggestionResult {
  actions: Array<
    | 'save-to-topic'
    | 'save-as-note'
    | 'pin-signal'
    | 'mute-signal'
    | 'add-to-memory'
    | 'generate-summary'
    | 'generate-content-ideas'
  >;
  confidence: number;
}
```

## 4. Reranking layer

After initial retrieval, add a reranking step.

The reranker should score candidate memories based on:
- semantic similarity to the current query
- exact keyword overlap
- topic match
- source type importance
- recency
- confidence / quality score
- user activity relevance

The reranker should return the final best items to include in the prompt.

## 5. Context builder

Build a dedicated context builder.

Do not dump raw search results into Ollama.

The context builder should:
- deduplicate results
- group related memories
- trim irrelevant text
- produce short structured context blocks
- label each block by memory type
- include metadata such as topic, date, source, and confidence

### Example prompt context block

```text
[topic-memory]
Title: AI Agents
Relevance: 0.92
Updated: 2026-05-01
Summary: The user tracks AI agents, MCP tooling, and local-first automation patterns.

[signal-memory]
Title: Telegram AI agents rising
Relevance: 0.87
Detected: 2026-05-01
Summary: Rising signal detected from YouTube titles and saved notes.
```

## 6. Tool and action routing

Flow AI should be able to do useful things inside FlowMap.

### Initial action/tool targets
- Save to Topic
- Save as Note
- Add to memory
- Generate summary
- Generate content ideas
- Tag related topics
- Classify signal
- Prepare Telegram summary *(future)*
- Start workflow *(future)*

Use a service-first architecture so these tools are callable from both chat UI and other product surfaces.

## 7. Memory writing rules

Flow AI should not write everything into memory automatically.

Create memory writing rules such as:
- save only durable insights
- save summaries instead of noisy raw text
- store metadata alongside memory files
- avoid duplicate memory entries
- tag memory with type, topic, source, and timestamp

### Add to memory behavior
When the user chooses **Add to memory**, Flow AI should:
- generate a concise `.txt` memory artifact
- write it into `My Documents > AI Memory`
- include title, summary, supporting details, source references, and topic associations
- make it retrievable later

## 8. Retrieval quality controls

Add controls so Flow AI can stay relevant.

### Include
- retrieval score threshold
- max context item count
- max context token budget
- fallback behavior when no strong context exists
- option to answer from general knowledge vs FlowMap-only context

## 9. Query analysis

Before retrieval, analyze the user query.

Detect whether the query is mainly asking for:
- factual retrieval
- summarization
- comparison
- note generation
- signal interpretation
- action suggestion
- content ideation

Use this to decide:
- which memory types to prioritize
- how much context to retrieve
- which output schema to request
- whether a tool/action should be suggested

## 10. Feedback loop

Flow AI should improve from use.

Track lightweight signals such as:
- which retrieved items were actually used
- which summaries were saved
- which topic tags were accepted or changed
- which generated ideas were kept or ignored
- which memory artifacts were later referenced again

This feedback can improve future retrieval ranking.

## Suggested architecture

```text
src/flow-ai/
  services/
    queryAnalysisService.ts
    retrievalService.ts
    rerankingService.ts
    contextBuilderService.ts
    structuredOutputService.ts
    actionRoutingService.ts
    memoryWriteService.ts
  storage/
    flowAIMemoryIndex.ts
    flowAIRetrievalStore.ts
  utils/
    embeddings.ts
    hybridSearch.ts
    scoring.ts
    dedupe.ts
    schemas.ts
```

## Suggested implementation phases

### Phase 1 — Retrieval foundation
- index FlowMap content
- add embeddings
- add keyword search
- merge results
- create context builder

### Phase 2 — Reranking
- build reranking scores
- reorder candidate memories
- improve prompt quality

### Phase 3 — Structured outputs
- define schemas
- add schema-driven Ollama calls
- replace free-form parsing in core flows

### Phase 4 — Tool routing
- wire save actions
- wire note creation
- wire memory writing
- wire content idea generation

### Phase 5 — Feedback loop
- track accepted vs rejected outputs
- refine ranking and heuristics

## UX expectations

Flow AI should feel:
- fast
- relevant
- less repetitive
- more grounded in the user’s actual FlowMap data
- more capable of doing useful tasks, not just answering

## Success criteria

Flow AI is improved when:
- retrieved context is noticeably more relevant
- answers reference the correct FlowMap memory more often
- fewer irrelevant memories appear in responses
- topic tagging becomes more accurate
- summaries and notes are more consistent
- save actions feel reliable
- Flow AI can power Signals, Notes, Topics, and future workflows with the same core intelligence layer

## Output expectations for Claude Code

Provide the implementation in labeled file sections.
Keep the architecture modular and service-first.
Use Ollama as the local model runtime.
Focus on retrieval quality, reranking, structured outputs, and tool routing rather than just swapping models.
EOF && ls -l /home/user/output/flow-ai-ollama-effectiveness-upgrade-spec.md
