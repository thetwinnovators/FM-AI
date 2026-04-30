# FlowMap SearXNG Web Search Adapter Spec

## Purpose

FlowMap already has multi-source search, but the current results are dominated by source-specific adapters such as Reddit, Hacker News, and Wikipedia. That makes the experience feel like a source aggregator rather than broad web search.

This spec defines how to add SearXNG as the main generic web search adapter so FlowMap can pull results from a much broader slice of the web while keeping the current free-only, personal-app architecture.

## Why SearXNG

SearXNG is the best fit for the current constraints because:
- it is free,
- it supports broad web metasearch,
- it can be self-hosted later,
- public instances exist for testing,
- and it fits a personal app better than paid search APIs.

The goal is not to replace all existing adapters. The goal is to give FlowMap a true broad-web backbone and let source-specific adapters become supporting signals.

## Current Problem

The current search results feel too narrow because:
- generic web search is weak or underperforming,
- structured sources return cleaner metadata,
- and source-specific adapters dominate ranking.

As a result, searches look like a mix of Reddit, Hacker News, and Wikipedia instead of the wider web.

## Target Outcome

After this change, FlowMap should:
- use SearXNG as the default broad web source,
- return more general web pages from many domains,
- still blend in specialty sources like Reddit, Hacker News, Wikipedia, YouTube, and RSS,
- and make the search feel closer to a real web search engine.

## Search Model After This Change

FlowMap search should become a two-layer system:

### 1. Broad Web Backbone

Primary source:
- SearXNG

This layer provides:
- general web pages,
- articles,
- documentation,
- blog posts,
- company pages,
- guides,
- and other public web results.

### 2. Specialty Source Layer

Supporting sources:
- Reddit
- Hacker News
- Wikipedia
- YouTube
- RSS feeds

This layer provides:
- discussions,
- community signals,
- explainers,
- videos,
- and news-specific content.

The broad web layer should become the foundation of the results page. Specialty sources should enrich the results, not dominate them.

## Architecture Plan

### New Adapter

Add a new search adapter:

```text
src/lib/search/adapters/searxng.js
```

Responsibility:
- send a query to a SearXNG instance,
- parse the response,
- normalize results into the shared FlowMap result shape,
- return a clean list to the aggregator.

### Optional Config Module

Add a configuration file for the SearXNG base URL and adapter settings:

```text
src/lib/search/config.js
```

Suggested fields:

```ts
export const SEARCH_CONFIG = {
  searxngBaseUrl: 'https://<instance-url>',
  searxngCategories: 'general',
  searxngLanguage: 'en-US',
  searxngSafeSearch: 1,
  searxngTimeRange: '',
  searxngEnabled: true,
}
```

If a config file already exists, merge these settings into the existing structure.

## Adapter Responsibilities

The SearXNG adapter should:
- accept a query string,
- call the SearXNG search endpoint,
- request JSON output,
- gracefully handle timeout and empty results,
- normalize fields,
- derive a domain from the URL,
- set `source` to `web`,
- set `sourceType` to `article` by default unless a better type can be inferred,
- and return a list of normalized items.

## Suggested Request Pattern

Typical SearXNG request shape:

```text
GET /search?q=<query>&format=json&categories=general&language=en-US&safesearch=1
```

Optional parameters can include:
- time_range,
- engines,
- page,
- pageno.

Start simple. Do not over-tune the request before validating the basic adapter.

## Shared Result Shape

The adapter should return the same shared normalized object used by the refactor plan.

Suggested shape:

```ts
{
  id: string,
  title: string,
  description: string,
  url: string,
  source: 'web',
  sourceType: 'article',
  image?: string,
  publishedAt?: string,
  author?: string,
  domain?: string,
  canonicalUrl?: string,
  scoreBase?: number,
  scoreFreshness?: number,
  scoreIntent?: number,
  scoreAuthority?: number,
  scoreDiversityPenalty?: number,
  scoreFinal?: number
}
```

## Normalization Rules

Map SearXNG fields into FlowMap fields.

Suggested mapping:
- `title` -> `title`
- `content` -> `description`
- `url` -> `url`
- `img_src` -> `image` when present
- `publishedDate` or other date-like field -> `publishedAt` when available
- domain derived from URL hostname -> `domain`
- canonical URL derived via URL normalization -> `canonicalUrl`

If fields are missing:
- description may be empty string,
- image may be undefined,
- publishedAt may be undefined.

## Aggregator Changes

Update the search aggregator so that:
- SearXNG becomes the primary generic web adapter,
- its results are always requested for general searches unless disabled,
- source weighting gives `web` enough strength to appear consistently in top results,
- specialty sources are blended after normalization,
- domain diversity logic prevents one source type from flooding the first page,
- and the final result set feels web-first rather than community-first.

## Ranking Changes

Ranking should be adjusted after the SearXNG adapter is added.

### Initial Ranking Goal

At first, do not overcomplicate.

Just make sure:
- web results are no longer underweighted,
- Reddit, Hacker News, and Wikipedia do not consume the entire top section,
- and at least several broad-web results appear on the first screen for general-topic queries.

### Suggested Initial Weighting

For generic searches:
- `web` should be treated as a first-class source,
- Reddit and Hacker News should receive lower default weight unless the query implies discussion or trends,
- Wikipedia should rank well for definition-style queries but not dominate all searches.

## Result Blending Rules

After this adapter is added, blending should follow these rules:
- page one should contain a mix of broad web and specialty sources,
- broad web should form the backbone,
- no single source family should dominate,
- specialty sources should surface when they add clear value.

Example target top results mix for a generic query:
- 4 to 6 broad web results,
- 1 to 2 Wikipedia/reference results,
- 1 to 2 community results,
- optional 1 video result.

This is not a hard rule, but a directional target.

## Fallback Strategy

SearXNG may fail depending on the public instance used.

Add graceful fallback behavior:
- if SearXNG fails, continue search with existing adapters,
- log the failure in development mode,
- optionally display no special UI warning at first,
- do not break the whole search pipeline.

## Public Instance Strategy

For early testing, use a public SearXNG instance.

Important caveats:
- public instances can be rate-limited,
- availability can vary,
- CORS support may differ,
- performance may fluctuate,
- some instances may block heavy or repeated usage.

Because FlowMap is a personal app, this is acceptable for experimentation.

## Long-Term Hosting Path

If SearXNG proves useful, the long-term best path is to self-host it or move it behind a local or Tauri-managed layer later.

That would give:
- more reliability,
- more control over engines,
- stable behavior,
- and less dependence on public instances.

This should be deferred until the adapter proves valuable enough.

## Files to Add or Update

Suggested file changes:

```text
src/lib/search/adapters/searxng.js
src/lib/search/config.js
src/lib/search/result.js
src/lib/search/rank.js
src/lib/search/fetchAll.js or aggregator equivalent
```

Depending on the current structure, the actual files may vary. The important part is introducing the adapter cleanly into the existing search pipeline.

## Suggested Adapter API

Example function:

```ts
export async function searchSearxng(query, options = {}) {
  // fetch results from configured instance
  // normalize items
  // return array of shared result objects
}
```

Optional helper:

```ts
function normalizeSearxngResult(raw) {
  // return shared ScoredItem shape
}
```

## Development Checklist

### Phase 1
- Add the adapter.
- Test against one public instance.
- Normalize results into the shared object.
- Blend with the current aggregator.

### Phase 2
- Tune source weighting.
- Reduce over-dominance from Reddit, Hacker News, and Wikipedia.
- Improve dedupe across web and specialty results.

### Phase 3
- Add better content-type inference.
- Add optional engine tuning.
- Add fallback instance support.

## Success Criteria

This integration is successful if:
- FlowMap results visibly expand beyond Reddit, Hacker News, and Wikipedia,
- generic queries surface more actual web pages,
- page one feels broader and more useful,
- the search still works without paid services,
- and existing specialty sources remain useful without dominating.

## What Not to Do Yet

Avoid these in the first pass:
- adding backend infrastructure,
- over-tuning engines,
- adding many fallback instances immediately,
- rewriting the whole search UI,
- building paid-provider support,
- adding topic-aware ranking before the broad web source works.

## Final Recommendation

The strongest free path to broader search in FlowMap is to add SearXNG as the main web adapter and let existing adapters become supporting sources.

This change should make FlowMap feel much closer to a real web search experience while preserving the current free-only personal-app setup.
