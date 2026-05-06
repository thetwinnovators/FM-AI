# Flow AI RAG Next-Steps Build Order

This document is the implementation roadmap for turning Flow AI into a retrieval-augmented system that gets smarter over time while staying fast enough to feel conversational.[cite:1062][cite:855][cite:657]

It is intentionally different from the context retrieval redesign spec. The redesign spec defines the target architecture. This document defines what to build, in what order, with performance safeguards and latency optimizations embedded in every phase.[cite:999][cite:854]

## Build objective

Flow AI should improve over time in four ways:[cite:855][cite:657]
- retrieve better context
- choose less noisy context
- learn from usage patterns and stored memory
- stay fast as memory and features grow

The roadmap below assumes MCP work is largely done and that retrieval quality is the next major bottleneck.[cite:860][cite:1062]

## Performance targets

Use these targets to keep the system practical while it evolves:

| Metric | Target |
|---|---|
| Time to first token, simple query | under 0.8s [cite:1048] |
| Time to first token, retrieval query | under 1.5s [cite:1084][cite:1051] |
| Retrieval pipeline before generation | under 250ms target, under 400ms max [cite:1081][cite:1084] |
| Prompt context for normal chat | keep as small as possible, ideally well under large-window limits [cite:1090][cite:1048] |
| Default retrieved chunks sent to model | top 2-5 final chunks [cite:1089][cite:1085] |

## Phase summary

| Phase | Scope | Core outcome |
|---|---|---|
| Phase 1 | Ingestion, chunking, embeddings, vector index, simple retrieval, basic context assembly | Baseline RAG pipeline |
| Phase 2 | Hybrid search, metadata filtering, reranking | Higher-precision retrieval |
| Phase 3 | Typed memory, query rewriting, better context builder | Smarter retrieval and better prompt quality |
| Phase 4 | Retrieval-aware tool routing and agent workflows | Better action decisions and lower tool misuse |
| Phase 5 | Evaluation, observability, tuning | Continuous improvement loop |

## Phase 1

### Goal

Create the first usable RAG layer so Flow AI can retrieve relevant knowledge by meaning instead of relying mostly on broad memory dumps, graph lookups, or recent chat context.[cite:855][cite:657]

### Build scope

1. **Document ingestion**
- Define source adapters for notes, saved topics, research artifacts, chat summaries, and selected documents.[cite:642][cite:855]
- Normalize content into a common schema: `id`, `source_type`, `title`, `body`, `topic_ids`, `created_at`, `updated_at`, `visibility`, `workspace_id`.
- Exclude noisy fields that do not help retrieval.

2. **Chunking strategy**
- Chunk notes and documents into small semantically coherent units.
- Preserve source references and chunk order.
- Store summary text separately when available.

3. **Embeddings**
- Generate embeddings for chunks, summaries, and optionally titles.[cite:1081]
- Batch offline embedding jobs for existing corpus.
- Add incremental embedding on create/update.

4. **Vector index**
- Create a vector store or semantic index for retrieval.
- Keep index metadata lightweight for fast filtering.[cite:1086]

5. **Simple retrieval**
- Retrieve top semantic candidates from the vector store.
- Return small candidate sets only.

6. **Basic context assembly**
- Assemble a minimal prompt payload with identity memory, task state, recent conversation, and top retrieved chunks.[cite:999]
- Prefer summaries before raw excerpts.

### Latency optimization for Phase 1

- Pre-embed all existing content offline so runtime requests only embed the incoming query, not the full corpus.[cite:1081][cite:1084]
- Use a lightweight local embedding model first; optimize for speed before trying larger embedding models.[cite:1081]
- Stream the final response immediately so perceived latency improves even when retrieval adds overhead.[cite:1084][cite:1048]
- Cap initial retrieval to a small candidate pool, such as top 8-12 before final selection, to keep vector lookup and prompt assembly fast.[cite:1085][cite:1089]
- Keep chunk sizes moderate so the model receives fewer wasted tokens and retrieval remains more precise.[cite:1090]
- Keep the prompt prefix stable and append dynamic retrieval later in the prompt for better cache friendliness.[cite:1048][cite:999]

### Acceptance criteria

- Flow AI can retrieve relevant chunks from stored knowledge for a topical query.[cite:855]
- The prompt no longer contains large undifferentiated memory dumps.[cite:1062][cite:999]
- Retrieval plus assembly is consistently fast enough that response time still feels conversational.[cite:1084][cite:1051]

## Phase 2

### Goal

Improve retrieval precision so Flow AI stops returning broad matches and starts selecting the most useful evidence for the exact question.[cite:1031][cite:1036]

### Build scope

1. **Hybrid search**
- Combine semantic retrieval with lexical or keyword retrieval.[cite:1089][cite:1031]
- Merge and deduplicate candidates.

2. **Metadata filtering**
- Filter by source type, recency, workspace, topic, saved/followed state, and trust level.
- Prevent irrelevant memories from competing with task-relevant material.

3. **Reranking**
- Add a reranker over the merged candidate set before final context selection.[cite:1085][cite:1089]
- Select only the top final chunks for the model.

### Latency optimization for Phase 2

- Run semantic search and keyword search in parallel, then merge results.[cite:1048][cite:1084]
- Apply metadata filters early to reduce the number of candidates passed to reranking.[cite:1086]
- Keep reranking shallow at first, for example rerank top 20 rather than top 100, to protect latency.[cite:1082][cite:1085]
- Use a lightweight reranker for normal chat queries and reserve heavier reranking for high-value or ambiguous queries.[cite:1085][cite:1090]
- Cache merged candidate sets for repeated or near-duplicate queries.[cite:1081][cite:1091]

### Acceptance criteria

- Retrieval results feel narrower and more relevant than Phase 1.[cite:1031]
- Prompt context shrinks because irrelevant matches are filtered out before assembly.[cite:1090][cite:1048]
- Reranking improves top-result quality without making the system feel slow.[cite:1082][cite:1085]

## Phase 3

### Goal

Make retrieval more adaptive by teaching Flow AI to understand memory types, rewrite poor queries, and build cleaner context packages.[cite:855][cite:1087]

### Build scope

1. **Typed memory**
- Split retrieval stores or views by memory class: identity memory, task state, notes, topics, docs, prior answers, execution traces.[cite:855][cite:999]
- Give each type its own retrieval rules and budget.

2. **Query rewriting**
- Add a query rewrite step for vague, underspecified, or ambiguous questions.[cite:1087]
- Support entity extraction, topic expansion, and structured rewrites.

3. **Better context builder**
- Build a layered context envelope with fixed sections.[cite:999]
- Summarize long candidates before inclusion.
- Add small reason labels such as “selected because recent topic match” for debugging.

### Latency optimization for Phase 3

- Only trigger query rewriting when the classifier detects ambiguity; do not rewrite every query.[cite:1087][cite:1048]
- Use structured rewrites instead of free-form rewrites so the system produces fewer tokens and less noisy retrieval input.[cite:1087]
- Cache rewritten queries and their retrieval results when similar questions recur.[cite:1081][cite:1091]
- Keep typed memory retrieval parallelized, then combine candidates through a lightweight scoring step.[cite:1048]
- Summarize retrieved material before final prompt assembly to reduce generation cost and context length.[cite:1048][cite:1090]

### Acceptance criteria

- Flow AI selects different retrieval strategies depending on the query type.[cite:855]
- Broad questions retrieve the right memory class instead of dumping everything.[cite:1062][cite:999]
- Query rewriting improves weak-query retrieval without noticeable latency spikes.[cite:1087]

## Phase 4

### Goal

Make retrieval part of Flow AI’s action layer so the system knows when to answer, when to ask, and when to use MCP tools.[cite:860][cite:999]

### Build scope

1. **Retrieval-aware tool routing**
- Retrieve memory before tool selection.
- Decide whether the model already has enough context to answer directly.
- Use retrieved context to fill tool arguments more accurately.

2. **Agent workflows**
- Support multi-step retrieval -> reasoning -> action -> memory writeback flows.[cite:999]
- Keep a short task recitation block between steps.

3. **Memory writeback**
- Save useful outputs, learned patterns, and successful task summaries back into Flow AI memory.[cite:855]
- Store summaries, not massive raw logs, by default.

### Latency optimization for Phase 4

- Skip retrieval entirely for simple direct-answer queries when classifier confidence is high.[cite:1048][cite:1084]
- Use tool masking so only relevant tools are exposed for the current task, reducing planning overhead.[cite:999]
- Avoid passing full tool logs into the main prompt; store them externally and inject only compact summaries.[cite:999]
- Keep memory writeback asynchronous so the user does not wait for storage and indexing work after an answer or action completes.[cite:1084][cite:1091]
- Reuse task summaries across multi-step tool workflows instead of rebuilding context from scratch each step.[cite:999][cite:1048]

### Acceptance criteria

- Flow AI uses retrieval to improve tool decisions instead of carrying noisy context into every action.[cite:999][cite:860]
- Tool workflows stay responsive even when memory is written back after completion.[cite:1084]
- Multi-step tasks remain grounded without runaway prompt growth.[cite:999]

## Phase 5

### Goal

Create the feedback loop that makes Flow AI improve over time through measurement, tuning, and memory quality control.[cite:855][cite:1035]

### Build scope

1. **Evaluation**
- Build a test set of representative Flow AI queries.
- Measure retrieval precision, answer quality, context size, and tool-choice accuracy.

2. **Observability**
- Log timings for query embedding, retrieval, reranking, context assembly, and generation.[cite:1081][cite:1035]
- Log selected sources, dropped sources, and token counts.

3. **Tuning**
- Tune chunk sizes, top-k values, reranking depth, rewrite triggers, and filter weights.[cite:1086][cite:1091]
- Prune low-value memories and consolidate duplicated identity rules.[cite:1062]

### Latency optimization for Phase 5

- Measure latency by pipeline stage so optimization is based on real bottlenecks rather than guesswork.[cite:1082][cite:1091]
- Add semantic caching for repeated high-frequency queries.[cite:1084][cite:1081]
- Introduce SLA-based routing, for example shallow retrieval under tight latency thresholds and deeper retrieval for complex research questions.[cite:1085][cite:1090]
- Tune HNSW or equivalent vector index parameters against your actual dataset size and latency budget.[cite:1086]
- Regularly audit context size because every extra token adds inference cost and time.[cite:1090][cite:1048]

### Acceptance criteria

- Flow AI has measurable quality and latency baselines.[cite:1035][cite:1091]
- Retrieval quality improves through tuning rather than guesswork.[cite:1083]
- The system gets better over time because the memory layer, evaluation loop, and tuning loop are connected.[cite:855][cite:657]

## Suggested code and service order

Build in this order so each stage has a clear dependency chain:

1. `ingestionPipeline`
2. `chunkingService`
3. `embeddingService`
4. `vectorIndexService`
5. `retrievalService`
6. `contextAssemblyService`
7. `hybridRetrievalService`
8. `metadataFilterService`
9. `rerankerService`
10. `queryClassifierService`
11. `queryRewriteService`
12. `typedMemoryService`
13. `toolRoutingService`
14. `memoryWritebackService`
15. `retrievalEvaluationService`
16. `retrievalObservabilityService`
17. `latencyOptimizationService`

## What “improve over time” should mean for Flow AI

Flow AI should improve over time in a controlled way, not just by accumulating more data.[cite:855][cite:657] That means:

- better memory quality, not just more memory
- better retrieval selection, not just more retrieved chunks
- better tool decisions, not just more tool access
- better latency discipline, not just more features
- better evaluation loops, not just intuition-based tuning[cite:1035][cite:1091]

The system becomes better when successful interactions create useful memory artifacts, weak retrieval patterns are measured and corrected, and the context builder keeps prompt space focused instead of bloated.[cite:999][cite:855]

## Immediate next move

Start with **Phase 1**, but implement it with the performance guardrails already in place: offline corpus embedding, small chunk budgets, streaming, stable prompt prefix, and strict top-k limits.[cite:1081][cite:1084][cite:1048]

Then move to **Phase 2** quickly, because hybrid retrieval and reranking are what usually transform a working baseline RAG system into one that actually feels selective and intelligent.[cite:1089][cite:1085][cite:1036]
