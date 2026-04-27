# FlowMap Search Relevance Fixes

## Problem statement

FlowMap is returning nearly the same results no matter what the user searches for. This usually means the retrieval pipeline is collapsing distinct queries into the same normalized form, over-expanding weak queries into the same broad topic cluster, reusing one generic fallback retrieval path, or ranking mostly by source popularity rather than actual query-specific context.[web:91][web:95][web:96]

In search systems, query expansion can improve retrieval, but over-expansion and topic drift can reduce precision and make different searches converge toward the same result set.[web:95][web:96][web:102] Relevance feedback and query reformulation work best when expansions are tightly controlled and grounded in the actual query intent rather than broad semantic similarity alone.[web:80][web:92][web:97]

## Likely root causes

### 1. Over-normalization

Different searches may be getting reduced into the same internal query form. If `Claude Code`, `coding agents`, `MCP`, and `AI workflow automation` all end up mapped to a generic `AI tools` or `agents` cluster, the search layer will repeatedly fetch the same candidate set.[web:91][web:95]

### 2. Over-expansion and topic drift

Query expansion is helpful, but if too many related terms are added too early, the system starts retrieving the broad neighborhood around a concept rather than the specific target concept.[web:95][web:96][web:102] This is one of the most common reasons different queries produce nearly identical results.[web:96][web:102]

### 3. One shared fallback retrieval path

If the system always falls back to the same source list, same generic connectors, or same pre-ranked candidate pool, query differences stop mattering.[cite:75] This often happens when the pipeline uses broad “latest AI” searches underneath most user inputs.[cite:75]

### 4. Weak ranking features

If ranking relies too heavily on general authority, freshness, or source popularity, strong but generic pages can dominate many result sets.[web:83][web:100] Ranking must reward exact match, local context relevance, and topic-specific fit more heavily.[web:83]

### 5. Missing negative constraints

Without exclusions, intent filters, or source-type differences, queries that should diverge stay blended together.[web:92][web:95] `Claude Code tutorial` and `Claude business news` should not share the same ranking model or source bias.[web:92]

### 6. No user-specific relevance feedback

Search gets better when the system learns from what the user saves, dismisses, and repeatedly opens. Relevance feedback is a core retrieval improvement technique because it adapts later retrieval to actual user judgments.[web:80][web:97][web:103]

## What should change

The solution is to make the pipeline more query-specific at every stage: intent parsing, expansion, candidate generation, filtering, and ranking.[web:80][web:83][web:95] The engine should preserve the uniqueness of the original search unless there is strong evidence that expansion is needed.[web:96]

## Search architecture changes

### 1. Preserve exact query identity

Every search should keep a protected exact-match lane that is never diluted by semantic expansion. Exact phrase variants, direct aliases, and controlled synonyms can be searched first, while broader related concepts should be introduced only in a secondary lane.[web:95][web:96]

#### Required behavior

- Lane 1: exact phrase and exact alias search.
- Lane 2: close synonym search.
- Lane 3: related concept search.
- Lane 4: exploratory semantic expansion only if results are weak.[web:95][web:96]

This prevents `Claude Code` from immediately collapsing into generic `AI coding tools` results.[web:95]

### 2. Add query-type detection

The system should classify the user query before retrieval so it knows whether the user wants a tool, company, creator, concept, tutorial, news update, comparison, or implementation example.[web:92][web:95]

#### Example intent mapping

| Query | Intent type | Retrieval bias |
|---|---|---|
| Claude Code tutorial | How-to / implementation | Tutorials, docs, walkthrough videos |
| Claude latest news | News / recency | Recent articles, announcements, update posts |
| MCP servers for coding agents | Technical concept + tools | Docs, videos, GitHub discussions, blog posts |
| best AI workflow automation tools | Comparison / commercial | Reviews, list articles, product comparisons |

Intent classification helps force query divergence before ranking ever begins.[web:92][web:95]

### 3. Constrain query expansion

Expansion should be controlled by strict thresholds and expansion types. Over-expansion is a known cause of irrelevant or repetitive results because it broadens the query beyond the user’s actual information need.[web:95][web:96]

#### Rules for safer expansion

- Limit expansion terms to 2–5 per query.[web:95]
- Prefer aliases and exact synonyms over broad semantic cousins.[web:95][web:98]
- Only add related concepts when exact retrieval is weak.[web:96]
- Never expand across different intent types in the first pass.[web:92]
- Track which expansion terms actually improved result quality and reuse only those.[web:80][web:97]

### 4. Split candidate generation by source intent

Different intents should produce different source mixes. If all queries search the same domains and content classes in the same order, the results will converge.[cite:75]

#### Source mix examples

- Tutorial query: YouTube, docs, blogs, implementation guides.
- News query: news sites, official announcements, recent posts.
- Deep concept query: blogs, docs, essays, talks, GitHub-linked articles.
- Tool comparison query: listicles, comparison posts, reviews, pricing pages.[cite:75]

### 5. Strengthen ranking with exactness

Ranking should strongly favor exact phrase match, title match, header match, and dense local context around the query.[web:83] Query-aware context analysis shows that ranking improves when the local context related to the query is weighted more heavily than generic document relevance.[web:83]

#### Better ranking factors

- Exact phrase match in title or canonical metadata.
- Query term density in the most relevant passage.
- Topic classification confidence.
- Intent-source alignment.
- Freshness when query implies recency.
- Metadata completeness.
- Preview image availability.
- User-interest affinity from memory.[cite:75][web:83]

### 6. Add diversity constraints after ranking

Even when many relevant results exist, the top results should not all come from the same domain, same creator, or same repost chain. Controlled diversity can improve usefulness without losing relevance.[web:93]

#### Diversity rules

- Max 2 results from the same domain in top 10.
- Prefer canonical/original source over syndication copy.
- Cluster near-duplicates and show one representative.
- Mix videos and articles when both are requested.[cite:75][web:93]

### 7. Learn from saves and dismissals

Relevance feedback is one of the most practical ways to improve future search quality because it uses actual user judgments to refine later retrieval.[web:80][web:97][web:103] FlowMap should treat saves, opens, dismissals, and repeat visits as structured signals.

#### Feedback signals

- Save = strong positive.
- Open and dwell = moderate positive.
- Dismiss = negative.
- Hide source = strong negative.
- Follow topic after search = positive expansion signal.[cite:75][web:80][web:97]

These signals should feed:

- source preferences,
- topic boosts,
- suppressed concepts,
- preferred media type,
- future expansion term selection.[cite:75]

## Recommended algorithm changes

### Multi-lane retrieval

Instead of one unified search, retrieve in separate lanes and merge later.

```ts
lanes = [
  exactLane(query),
  aliasLane(query),
  intentLane(queryIntent),
  controlledExpansionLane(query)
]
```

Each lane should produce candidates independently, with separate scoring, before deduplication and blended ranking.[web:95][web:96]

### Query-specific scoring

```ts
score =
  exactMatchScore * 0.30 +
  localContextScore * 0.20 +
  topicConfidence * 0.15 +
  intentAlignment * 0.10 +
  freshnessScore * 0.10 +
  metadataCompleteness * 0.10 +
  userFeedbackAffinity * 0.05
```

This makes the ranking more query-sensitive and reduces domination by generic high-authority pages.[web:83][web:100]

### Expansion gating

```ts
if (exactLane.results >= threshold) {
  suppressBroadExpansion = true
}
```

If exact or alias retrieval already produced enough strong candidates, do not widen the query further.[web:96]

### Intent-conditioned retrieval

```ts
if (intent === 'tutorial') {
  boostSources(['youtube', 'docs', 'developer blogs'])
  suppressSources(['generic news'])
}

if (intent === 'news') {
  boostFreshness = true
  boostSources(['official announcements', 'news sites'])
}
```

This is one of the simplest ways to stop every search from looking the same.[web:92][cite:75]

## Debug checklist for why results are repeating

Instrument the pipeline and inspect these values for 10–20 different queries.[cite:75]

### Check 1: normalized query output

Log the final normalized query and expansion terms. If many different searches reduce to the same normalized query or same expansion bundle, that is a primary failure point.[web:91][web:95]

### Check 2: candidate source pool

Log which connectors and domains were queried. If every query touches the same source mix in the same order, diversity will collapse.[cite:75]

### Check 3: expansion term count

If the expansion term set is too large, the search is likely drifting.[web:95][web:96]

### Check 4: top scoring features

Log why each result ranked highly. If the same features dominate every query, such as source authority or freshness, the ranker is too generic.[web:83]

### Check 5: dedupe clustering

If multiple distinct queries keep mapping to the same dedupe clusters, the candidate set is overly shared before ranking.[cite:75]

### Check 6: feedback use

If save and dismiss behavior is not changing later ranking, the search system is not learning relevance feedback.[web:80][web:97]

## Product rules to implement

- Never let semantic expansion override the original query in the first retrieval lane.[web:95][web:96]
- Keep exact-match and exact-alias retrieval separate from broad expansion.[web:95]
- Use query intent to choose source mix and ranking weights.[web:92]
- Favor local context relevance over generic document popularity.[web:83]
- Use feedback from saves, dismissals, and repeat opens to refine future ranking.[web:80][web:97][web:103]
- Add diversity controls so results are not dominated by the same domains or repost chains.[web:93]

## Better Claude Code implementation description

FlowMap search is returning similar results for very different queries because the pipeline is likely over-normalizing queries, over-expanding them into the same broad topic neighborhood, using the same generic source mix, and ranking too heavily on popularity instead of exact query-specific context.[web:91][web:95][web:96][web:83]

Refactor the search engine into a multi-lane retrieval system. Preserve an exact-match lane for the raw query and direct aliases, then add a controlled synonym lane, an intent-conditioned lane, and only lastly a broader semantic expansion lane if the earlier lanes return weak results.[web:95][web:96] Add query-intent classification before retrieval so searches like tutorials, news, comparisons, and technical concepts use different source mixes and ranking weights.[web:92]

Make ranking more query-sensitive by heavily weighting exact title match, local passage relevance, topic confidence, intent-source alignment, metadata completeness, and user feedback affinity. Reduce the influence of generic popularity signals so that different searches stop collapsing into the same top results.[web:83][web:100] Use saves, dismissals, repeat opens, and source preferences as relevance feedback signals that continuously improve future retrieval quality.[web:80][web:97][web:103]
