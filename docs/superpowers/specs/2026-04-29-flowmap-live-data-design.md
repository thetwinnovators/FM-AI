# FlowMap Live Data Design

**Date:** 2026-04-29
**Scope:** Flow Map page — wire graph and all info panels to current user data instead of static seed-only data.

---

## Problem

The Flow Map page is the relational context view for the user's personal knowledge graph. Currently:

- The 3D network graph is built exclusively from static seed JSON. User-added topics, documents, manual URLs, and memory entries never appear as nodes.
- Three info panels contain hardcoded or placeholder values: ConnectedSources (three fixed entries), DerivedSignals ("Recently reinforced" is a literal string `"computing"`), and PipelineStrip (discover count masked with `|| 1`).
- The graph edges do not reflect user signals (views, saves, follows), so heavily-used connections look identical to untouched ones.

---

## Goal

Every panel and the graph itself should reflect the user's actual current state — their topics, their content, their interaction history.

---

## Architecture / Data Flow

```
useSeed()   ─┐
              ├─► buildGraph(seed, userState) ─► useGraph() ─► FlowMap / FlowGraph / GlassSidebar
useStore()  ─┘
```

`useGraph.js` subscribes to both `useSeed()` and `useStore()`. It passes the relevant slice of store state into `buildGraph`. The graph rebuilds reactively whenever that slice changes — same pattern the KPI row already uses.

`FlowMap.jsx` already holds `useStore()` for the KPI row. Panel fixes (ConnectedSources, DerivedSignals) receive computed props from FlowMap — no new store subscriptions in leaf components.

---

## Section 1: Graph Node Injection

`buildGraph(seed, userState)` receives:
```js
userState = { userTopics, documents, manualContent, memoryEntries, saves, views, follows }
```

Four user entity types become graph nodes:

| Source | Node type | Label source | Edges generated |
|---|---|---|---|
| `userTopics` | `topic` | topic `name` | none initially — connected via signals |
| `manualContent` | item's `.type` (article/video/social_post) | item `title` | to each `topicId` in `entry.topicIds` (the wrapper field, not `item.topicIds`), kind `covers` |
| `documents` | `document` (new type) | doc `title` | to each value in `doc.topics[]` — match against `topic.id` first, then `topic.slug`; skip unresolved values |
| `memoryEntries` | `memory` | entry `content` (truncated to 36 chars) | none — standalone |

**Deduplication:** Before injecting, skip any entity whose `id` already exists in the built node list. Manual content uses its own id which could coincide with a seed content id if the same piece was seeded — skip the user copy.

**New node type** — `document` added to `nodeTaxonomy.js`:
```js
{ id: 'document', label: 'Document', color: '#f59e0b' }
```

---

## Section 2: Signal-Based Edge Boosts

After nodes and edges are built, a single pass over signals adjusts edge weights. No new edges — only existing ones are strengthened.

| Signal | Applies to | Formula |
|---|---|---|
| `follows[topicId]` | edges where `from` or `to` === topicId | `weight = min(1.0, weight × 1.4)` |
| `saves[contentId]` | edges where `from` or `to` === contentId | `weight = min(1.0, weight + 0.15)` |
| `views[contentId].count` | same edges | `weight = min(1.0, weight + min(0.1, count × 0.02))` |

Applied in-place on the merged edge list before returning from `buildGraph`.

---

## Section 3: Panel Fixes

### ConnectedSources

Keep three source entries. Derive their `status` and `count` from real data passed as props from FlowMap:

- **YouTube:** `status: 'connected'` if `videoCount > 0`. Sub-label shows total video count.
- **RSS:** `status: 'connected'` if `Object.keys(documents).length > 0` (any user-pasted documents exist). Otherwise `'planned'`.
- **HN:** `status: 'connected'` if any manualContent item URL contains `news.ycombinator.com`. Otherwise `'planned'`.

FlowMap computes these values from store + seed data and passes them to `<ConnectedSources />`.

### DerivedSignals

Fix the hardcoded "Recently reinforced" row:

- Scan `views` and `saves` for the most recently-touched content item (by `lastAt` timestamp).
- Find that item's first `topicId` from seed `content` first, then `manualContent` entries.
- Resolve the topic name: check seed `topics` by id, then `userTopics` by id. Strip any `topic_` prefix for display.
- Show the resolved name (or `—` if no activity or topic not found).

`DerivedSignals` receives `saves` and `views` as additional props alongside `patterns`.

### PipelineStrip (in FlowMap.jsx)

Two count fixes:
1. Remove `|| 1` from the `discover` count — was masking zero followed topics.
2. `retain` count = `savedCount + Object.keys(memoryEntries).length` (currently only `savedCount`).

### Header chip (in FlowMap.jsx)

- If user has any `userTopics`, `documents`, or `manualContent` → label: `"Live · personal"`
- Otherwise → keep `"Live · seed"`

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/graph/nodeTaxonomy.js` | Add `document` type |
| `src/lib/graph/buildGraph.js` | Accept `userState`; inject user nodes; apply signal boosts |
| `src/store/useGraph.js` | Pull from `useStore()` and pass to `buildGraph` |
| `src/components/flow/ConnectedSources.jsx` | Accept props; derive status from data |
| `src/components/flow/DerivedSignals.jsx` | Accept `saves`+`views`; compute recently-reinforced |
| `src/views/FlowMap.jsx` | Fix pipeline counts; update header chip; pass new props |

---

## Out of Scope

- Changing the visual appearance of user nodes vs seed nodes (intentionally blended).
- Adding new node types beyond `document`.
- Persisting edge weights to storage (computed fresh each render from current signals).
- Search history as graph nodes.
