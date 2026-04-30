# FlowMap Search Quality Improvements

FlowMap already has a working multi-source search system. The next step is not rebuilding search from scratch. The next step is improving search quality so results feel more relevant, cleaner, fresher when needed, and more useful for topic-driven discovery.

This document defines how to improve FlowMap's existing search system while keeping the current free-only, personal-app architecture intact.

## Goal

Improve the quality of FlowMap search results without introducing paid providers or a major backend dependency.

The outcome should be:
- better first-page relevance,
- less duplication,
- more intentional blending across sources,
- better handling of current-event queries,
- and stronger matching between results and the user's topic or research intent.

## Current State

FlowMap already has:
- multi-source search,
- adapters for several content sources,
- a shared aggregator,
- query expansion,
- ranking,
- domain diversity,
- and caching.

This means the problem is no longer "add search." The problem is "make the existing search meaningfully smarter."

## Search Quality Principles

The improved search system should follow these principles:

1. Relevance before volume.
   Ten strong results are better than fifty weak ones.

2. Blended, not chaotic.
   Multi-source search should feel intentionally composed, not like several unrelated feeds dumped into one list.

3. Freshness only when appropriate.
   Newer is not always better. Recency should matter more for news, trends, tools, releases, and active conversations.

4. Diversity without dilution.
   Results should come from multiple domains and source types, but relevance should still dominate.

5. Topic-aware retrieval.
   FlowMap is not general search. Results should feel aware of the current topic, context, and knowledge graph.

6. Free-only and lightweight.
   Improvements should fit the current frontend-first personal-app architecture.

## What Better Search Should Mean in FlowMap

A better FlowMap search should do the following:
- show the most useful results first,
- reduce duplicates and near-duplicates,
- understand when the user likely wants a tutorial, explainer, news item, tool, person, or reference,
- give video results more weight when the query implies visual learning,
- give encyclopedia or documentation results more weight when the query implies definition or explanation,
- and make results feel connected to topic building instead of generic browsing.

## Main Upgrade Areas

### 1. Query Understanding

Before blending source results, FlowMap should classify the query into one or more search intents.

Suggested intent types:
- explainer,
- tutorial,
- tool,
- news,
- trend,
- person,
- company,
- concept,
- comparison,
- reference.

Examples:
- "what is MCP" -> explainer, concept, reference
- "best Claude coding workflow" -> tutorial, comparison, tool
- "OpenAI latest model" -> news, trend
- "Anthropic" -> company, reference
- "vibecoding" -> concept, trend, explainer

This query intent should affect:
- source weighting,
- query expansion,
- freshness weighting,
- result type ordering.

### 2. Selective Query Expansion

FlowMap already uses query expansion, but expansion should become more deliberate.

Expansion should be selective, not broad by default.

Good expansion types:
- acronym expansion, for example MCP -> Model Context Protocol
- spelling variants,
- singular/plural variants,
- common aliases,
- well-known related phrases,
- brand/product name variations.

Expansion should be avoided when:
- the query is already very specific,
- the query is a product or person name that could become noisy with expansion,
- expansion creates too many vague results.

Suggested rule:
- Apply hardcoded or heuristic expansion for short technical terms, acronyms, and ambiguous concepts.
- Avoid wide expansion for long-tail or already precise queries.

### 3. Intent-Based Source Weighting

Different sources should matter more depending on query intent.

Suggested weighting logic:

| Intent | Stronger sources | Lower-weight sources |
|---|---|---|
| Explainer | Wikipedia, trusted web pages | Reddit, HN |
| Tutorial | YouTube, web, docs | Wikipedia |
| News | News feeds, tech news, Reddit, HN | Wikipedia |
| Trend | Reddit, HN, tech news, YouTube | Wikipedia |
| Tool | Web, docs, YouTube, HN | Wikipedia |
| Reference | Wikipedia, docs, trusted sites | Reddit |
| Comparison | Web, YouTube, Reddit | Wikipedia |

This does not mean excluding sources. It means using query intent to influence ranking.

### 4. Result Normalization

All sources should expose a stronger normalized ranking object.

Suggested internal shape:

```ts
{
  id: string,
  title: string,
  description: string,
  url: string,
  source: string,
  sourceType: 'video' | 'article' | 'news' | 'reference' | 'community',
  image?: string,
  publishedAt?: string,
  author?: string,
  domain?: string,
  scoreBase?: number,
  scoreFreshness?: number,
  scoreIntent?: number,
  scoreAuthority?: number,
  scoreDiversityPenalty?: number,
  scoreFinal?: number,
  queryIntent?: string[],
  matchedExpansion?: string | null,
  topicFit?: number
}
```

This does not need to be shown in the UI. It is for internal ranking clarity.

### 5. Better Ranking Formula

Instead of one blended score, use a more explicit scoring model.

Suggested score components:
- base relevance score from source or match quality,
- source weight,
- intent match bonus,
- freshness bonus when relevant,
- authority bonus for stronger domains,
- topic fit bonus,
- domain repetition penalty,
- duplicate or near-duplicate penalty.

Conceptual formula:

```text
finalScore =
  baseRelevance
  + sourceWeight
  + intentMatchBonus
  + freshnessBonus
  + authorityBonus
  + topicFitBonus
  - domainRepetitionPenalty
  - duplicationPenalty
```

The exact numbers can be tuned later. The key improvement is score transparency and modularity.

### 6. Freshness-Aware Ranking

Recency should not dominate every search.

Introduce a simple query freshness classifier.

Likely freshness-sensitive queries:
- latest,
- new,
- update,
- released,
- launch,
- news,
- this week,
- 2026,
- current,
- recent.

For freshness-sensitive queries:
- upweight newer news and community posts,
- boost tech news feeds,
- reduce Wikipedia dominance,
- keep at least some stable reference results in the list.

For evergreen queries:
- let reference quality dominate,
- use recency lightly or not at all.

### 7. Dedupe and Near-Dedupe Handling

Search quality suffers when the same content appears repeatedly.

Dedupe should happen on:
- exact URL,
- canonicalized URL,
- title similarity,
- domain + title similarity,
- same underlying story from mirrored feeds.

Suggested behavior:
- remove exact duplicates,
- collapse near-duplicates,
- keep the strongest version,
- preserve source diversity where possible.

### 8. Domain Diversity Guardrails

Domain diversity should help, not distort.

Current diversity logic should be tightened with simple guardrails:
- allow multiple strong results from the same domain only if they are clearly different,
- penalize domain repetition after the first one or two high-value results,
- avoid pages of results dominated by one source type.

Goal:
- page one should feel varied but still coherent.

### 9. Topic-Aware Ranking

Because FlowMap is topic-driven, results should be influenced by the active topic when available.

Topic-aware ranking inputs could include:
- topic title,
- saved tags,
- related nodes,
- previous saved sources,
- known subtopics,
- known preferred content type.

Examples:
- If a topic already contains mostly tutorial videos, slightly boost video results.
- If a topic is a glossary or concept map, boost reference and explainer sources.
- If a topic is focused on current developments, boost freshness.

This is one of the biggest differentiators FlowMap can have, even as a personal app.

### 10. Better Result Presentation

Search quality is not only ranking. It is also how results are grouped and explained.

Improve the UI with:
- source badges,
- content-type badges,
- optional grouping by Articles, Videos, News, Community, References,
- small reason labels such as "Fresh", "Reference", "Popular discussion", or "Tutorial",
- topic-fit indicator when relevant.

This makes search feel smarter even before the user clicks.

## Recommended Implementation Plan

### Phase 1: Ranking Cleanup

Focus on the ranking layer without adding new providers.

Tasks:
- audit current normalized fields across adapters,
- create a shared ranking object,
- introduce modular score fields,
- improve duplicate handling,
- tighten domain diversity penalties,
- improve source weighting.

Outcome:
Search results become cleaner and more intentional without changing the architecture.

### Phase 2: Query Intent and Freshness

Tasks:
- add lightweight query classification,
- tag queries with one or more intent labels,
- add freshness-sensitive query detection,
- adjust source weighting based on intent,
- selectively adjust recency scoring.

Outcome:
Search results start behaving differently for explainers, tutorials, and news.

### Phase 3: Topic-Aware Ranking

Tasks:
- use current topic context during ranking,
- add topic-fit scoring,
- let topic type influence result ordering,
- let saved graph context bias future searches.

Outcome:
FlowMap search becomes context-sensitive instead of generic.

### Phase 4: UI Explanation Layer

Tasks:
- add result badges and reason labels,
- improve grouping and filtering,
- optionally expose tabs such as All, Videos, Articles, News, References.

Outcome:
Users understand why results were surfaced and can scan faster.

## Suggested Technical Changes

### Search Aggregator

Refactor the aggregator to expose explicit ranking stages:
- fetch,
- normalize,
- expand,
- classify,
- score,
- dedupe,
- diversify,
- sort,
- cache.

This makes search easier to tune over time.

### Query Classifier

Add a lightweight classifier function:

```ts
classifyQueryIntent(query): string[]
```

It can start as a heuristic keyword-based system.
No model is required at first.

### Freshness Classifier

Add:

```ts
isFreshnessSensitiveQuery(query): boolean
```

This can also be heuristic-based.

### Topic Fit Function

Add:

```ts
afterTopicFit(result, topicContext): number
```

This should score overlap with known topic tags, phrases, and saved source patterns.

### Dedupe Utility

Add a shared dedupe utility that works after normalization and before final sort.

## Example Scoring Heuristics

These are starter heuristics, not permanent values.

- +3 if source matches intent strongly
- +2 if title contains exact query phrase
- +2 if description contains expanded phrase
- +2 if result type matches likely intent
- +2 if domain is trusted for reference/explainer
- +2 if topic tags overlap strongly
- +1 if fresh and query is freshness-sensitive
- -2 if same domain already appears twice high in the list
- -3 if title similarity suggests near-duplicate

## Example Query Behavior

### Query: "what is mcp"

Expected result behavior:
- strong Wikipedia or explainer pages near the top,
- docs and explainers prioritized,
- community reactions lower,
- YouTube explainers included but not dominant.

### Query: "best Claude coding workflow"

Expected result behavior:
- tutorial videos and strong web explainers prioritized,
- comparison-style articles included,
- community discussion included but below concrete tutorials.

### Query: "OpenAI latest model"

Expected result behavior:
- news and recent discussions strongly boosted,
- freshness matters,
- old explainers or generic Wikipedia content should not dominate.

## What Not to Do Yet

Avoid these for now:
- adding paid search providers,
- rebuilding the entire stack,
- introducing a heavy backend just for ranking logic,
- building ML ranking before heuristics are tuned,
- expanding every query aggressively,
- overcomplicating the UI before ranking improves.

## Success Criteria

The search improvement effort is successful if:
- the first page feels noticeably more relevant,
- duplicate and low-value results appear less often,
- search feels different for tutorials vs news vs explainers,
- topic pages get results that match their context better,
- and the system stays free and lightweight.

## Final Recommendation

FlowMap does not need a new search system right now. It needs a smarter ranking and retrieval layer on top of the search foundation it already has.

The strongest next move is to improve:
- query understanding,
- selective query expansion,
- source weighting,
- freshness awareness,
- dedupe,
- domain diversity,
- and topic-aware ranking.

That path keeps the app free, aligns with its current architecture, and should produce the biggest practical improvement in perceived search quality.
