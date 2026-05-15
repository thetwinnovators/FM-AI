# Venture Scope — Inspectability Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Venture Scope end-to-end inspectable — every evidence snippet navigates back to its FlowMap source record, every dimension score exposes the signals and entities that drove it, and the entity graph underlying each concept is visible as a collapsible panel.

**Architecture:** Three independent layers added in sequence. Phase 1 (source linkage) is a pure utility + component update with no type changes. Phase 2 (score drivers) requires a new type, a scoring function extension, and a cluster schema addition. Phase 3 (OpportunityFrame panel) is entirely additive UI — no backend changes.

**Tech Stack:** TypeScript, React, React Router v6, Zustand-style store (`useStore`), existing Venture Scope types in `src/venture-scope/types.ts` and `src/opportunity-radar/types.ts`.

---

## Current state (what already exists)

These are in place and should NOT be rebuilt:
- `OpportunityFrame` type + `buildOpportunityFrame()` in `src/venture-scope/services/opportunityFrameBuilder.ts`
- `EvidenceTraceEntry` interface in `src/venture-scope/types.ts` with `sourceId`, `sourceType`, `topicId`, `documentId`, `evidenceSnippet`, `extractedAt`
- `evidenceTrace?: EvidenceTraceEntry[]` on `VentureConceptCandidate`
- `buildEvidenceTrace()` in `src/opportunity-radar/services/conceptGenerator.ts`
- `EvidenceTraceSection` component in `src/components/venture-scope/tabs/BriefTab.jsx`
- Entity evidence panel in `src/components/venture-scope/tabs/ScoresTab.jsx`

The gap is that evidence entries are **opaque** (shown as text chips with no navigation), score dimensions have **no backing evidence** (just computed numbers), and the OpportunityFrame used for concept synthesis is **invisible** to the user.

---

## File structure map

### New files (create)
| Path | Responsibility |
|------|---------------|
| `src/venture-scope/utils/sourceResolver.ts` | Pure function: resolves a `(sourceId, sourceType, storeSlice)` tuple into a navigable link and display metadata |
| `src/components/venture-scope/OpportunityFramePanel.jsx` | Collapsible entity graph inspector — entities by type, key relationships, source breakdown |

### Modified files (extend)
| Path | Change summary |
|------|---------------|
| `src/venture-scope/types.ts` | Add `ResolvedSourceLink`, `DimensionDriver`, `DimensionDriverMap` types |
| `src/opportunity-radar/types.ts` | Add optional `dimensionDrivers?: DimensionDriverMap` to `OpportunityCluster` |
| `src/opportunity-radar/services/opportunityScorer.ts` | New exported `collectDimensionDrivers()` function; `scoreOpportunity()` returns drivers |
| `src/components/venture-scope/DimensionScoreGrid.jsx` | Accept and render `drivers` prop alongside `explanations`; each row expands to show backing evidence |
| `src/components/venture-scope/tabs/BriefTab.jsx` | Accept `entityGraph` + `allSignals` + `selectedCluster` props; render `OpportunityFramePanel`; pass `storeSlice` to `EvidenceTraceSection` |
| `src/components/venture-scope/tabs/EvidenceTab.jsx` | Use `resolveSourceLink()` to make signal source rows navigable |
| `src/components/venture-scope/tabs/ScoresTab.jsx` | Pass `drivers` from cluster to `DimensionScoreGrid` |
| `src/views/VentureScope.jsx` | Pass `entityGraph`, `signals`, `selectedCluster` to `BriefTab`; pass `signals` to `EvidenceTab` |

---

## Phase 1 — Source-linkage layer

### Goal
Every row in `EvidenceTraceSection` (BriefTab) and every signal row in `EvidenceTab` becomes clickable and navigates back to the originating FlowMap record.

---

### 1.1 New type: `ResolvedSourceLink`

Add to `src/venture-scope/types.ts`:

```
interface ResolvedSourceLink {
  // Display
  label:      string          // e.g. "Saved item", "Document", "Topic summary"
  title?:     string          // item title from the store if available
  snippet?:   string          // first ~120 chars of content if useful
  date?:      string          // ISO date from savedAt / createdAt

  // Navigation
  externalUrl?: string        // open in new tab (saves, manual_content)
  internalPath?: string       // React Router path to navigate to (/documents/:id)
  canNavigate:  boolean       // false if record was deleted or type unsupported
  notFound:     boolean       // true if sourceId is not in the current store
}
```

---

### 1.2 New utility: `resolveSourceLink`

**File:** `src/venture-scope/utils/sourceResolver.ts`

**Signature:**
```
function resolveSourceLink(
  sourceId:   string,
  sourceType: string,
  storeSlice: {
    saves:           Record<string, { savedAt: string; item: any }>
    documents:       Record<string, { id: string; title: string; url?: string; createdAt: string }>
    manualContent:   Record<string, { id: string; item: { url?: string; title?: string }; savedAt: string }>
    topicSummaries:  Record<string, { overview?: string; generatedAt?: string }>
    userTopics:      Record<string, { id: string; title: string; slug?: string }>
    briefs:          Record<string, { id: string; title?: string; createdAt?: string }>
  }
): ResolvedSourceLink
```

**Resolution rules per sourceType:**

| sourceType | title source | navigation |
|---|---|---|
| `save` | `saves[id].item.title ?? saves[id].item.sourceTitle ?? saves[id].item.videoTitle ?? null` | `externalUrl = item.url ?? item.sourceUrl` |
| `document` | `documents[id].title` | `internalPath = /documents/${id}` |
| `manual_content` | `manualContent[id].item.title ?? manualContent[id].item.url` | `externalUrl = manualContent[id].item.url` |
| `topic_summary` | `userTopics[id]?.title ?? "Topic summary"` | `internalPath = /topic/${userTopics[id]?.slug ?? id}` |
| `brief` | `briefs[id].title ?? "Brief"` | `internalPath = /briefs` (no deep link yet; link to listing) |
| unknown | `"Unknown source"` | `canNavigate = false` |

**Fallback when id not found:** Return `{ label: sourceType label, canNavigate: false, notFound: true }`.

**Note:** `saves` items have inconsistent shape depending on whether they came from HN, Reddit, YouTube, etc. The resolver should try `item.title`, `item.videoTitle`, `item.sourceTitle`, `item.name` in order and fall back to `item.url ?? "(untitled)"`.

---

### 1.3 `EvidenceTraceSection` — navigable rows

**File:** `src/components/venture-scope/tabs/BriefTab.jsx`

**Changes:**
- `EvidenceTraceSection` receives a new optional `storeSlice` prop (saves, documents, manualContent, topicSummaries, userTopics, briefs)
- For each entry, call `resolveSourceLink(e.sourceId, e.sourceType, storeSlice)` to get a `ResolvedSourceLink`
- Replace the static `<div>` for each trace row with a conditional wrapper:
  - If `resolved.externalUrl`: render `<a href={url} target="_blank" rel="noopener">` around the row
  - If `resolved.internalPath`: render a `<button onClick={() => navigate(path)}>` using React Router's `useNavigate()`
  - If `!resolved.canNavigate`: render the existing non-clickable `<div>` (no change)
- Display `resolved.title` as a line below the snippet if it differs from the snippet itself and is not null
- Display `resolved.date` formatted as locale date (already done via `extractedAt` — cross-check consistency)

**Where to call `useNavigate`:** Import `useNavigate` from `react-router-dom` inside the `EvidenceTraceSection` component.

**Where to get the store slice in `BriefTab`:** `BriefTab` receives `storeSlice` as a new prop. `VentureScope.jsx` constructs it:
```
const storeSlice = {
  saves:          store.saves,
  documents:      store.documents,
  manualContent:  store.manualContent,
  topicSummaries: store.topicSummaries,
  userTopics:     store.userTopics,
  briefs:         store.briefs,
}
```
Pass as `<BriefTab storeSlice={storeSlice} ... />`.

---

### 1.4 `EvidenceTab` — navigable signal rows

**File:** `src/components/venture-scope/tabs/EvidenceTab.jsx`

Same pattern: each signal row shows the corpus source type. Upgrade the URL display to also show an in-app navigate link when the source is a document or topic. Use `resolveSourceLink` with the same `storeSlice` prop.

`EvidenceTab` currently receives `signals`, `clusters`, `selectedClusterId`. Add `storeSlice` as a new prop; pass the same slice from `VentureScope.jsx`.

---

### 1.5 Data flow summary (Phase 1)

```
VentureScope.jsx
  └─ const storeSlice = { saves, documents, manualContent, ... }
     ├─ <BriefTab storeSlice={storeSlice} ... />
     │    └─ <EvidenceTraceSection storeSlice={storeSlice} entries={concept.evidenceTrace} />
     │         └─ resolveSourceLink(e.sourceId, e.sourceType, storeSlice) → ResolvedSourceLink
     │              → <a href> or <button onClick={navigate}> wrapping each row
     └─ <EvidenceTab storeSlice={storeSlice} ... />
          └─ same pattern for signal source rows
```

---

### 1.6 Edge cases

| Scenario | Expected behaviour |
|---|---|
| `sourceId` not found in store (deleted item) | Show `notFound` indicator ("source deleted") alongside the snippet; row not clickable |
| `sourceType` is `null` or unknown string | Fall back to non-clickable row with label "Unknown source" |
| `save` item has no URL (e.g. was saved from an in-app card with no external link) | No `externalUrl`; row not clickable, but title/date still shown |
| `manual_content` with `item.url` being a localhost URL | Open it — don't filter; the user added it deliberately |
| `topic_summary` where topic has no slug | Navigate to `/topics` (listing) instead of specific topic |
| Evidence snippet is empty string | Hide the quote block; show only source metadata line |
| Multiple entries from the same source | Each renders separately; no deduplication (user can see multiple signals from one doc) |

---

### 1.7 Acceptance criteria (Phase 1)

- [ ] Every `EvidenceTraceSection` row with a valid `externalUrl` opens in a new browser tab
- [ ] Every row with a valid `internalPath` navigates the app to that route on click
- [ ] Rows with no resolvable link render without a hover cursor change and no click handler
- [ ] `resolveSourceLink` returns `notFound: true` when the store does not contain the sourceId
- [ ] Title line appears below the snippet for save, document, and manual_content entries where title is non-null
- [ ] `EvidenceTab` signal rows use the same resolver for their source metadata
- [ ] No crash when `storeSlice` is undefined (BriefTab should guard with optional chaining and skip the resolver call)

---

## Phase 2 — Score-driver layer

### Goal
Each dimension score in the `DimensionScoreGrid` exposes the specific signals and entity values that caused that score, visible by default as a compact sub-row under each bar.

---

### 2.1 New types

Add to `src/venture-scope/types.ts`:

```
interface DimensionDriver {
  type:         'signal' | 'entity' | 'flag'

  // Signal-type driver (points to a specific PainSignal)
  signalId?:      string
  signalSnippet?: string   // first 120 chars of painText

  // Entity-type driver (points to an entity from entitySummary)
  entityValue?:  string    // e.g. "product manager"
  entityType?:   string    // e.g. "persona"

  // Flag-type driver (boolean feature that added/subtracted points)
  flagKey?:      string    // e.g. "hasPlatformShift", "notSaturated"

  // Shared
  label:        string     // human-readable explanation of this driver's contribution
  contribution: 'positive' | 'negative'
  pointValue?:  number     // approximate score impact (optional, for display)
}

type DimensionDriverMap = Partial<Record<
  | 'painSeverity' | 'frequency' | 'urgency' | 'willingnessToPay'
  | 'marketBreadth' | 'poorSolutionFit' | 'feasibility'
  | 'whyNow' | 'defensibility' | 'gtmClarity',
  DimensionDriver[]
>>
```

Add to `OpportunityCluster` in `src/opportunity-radar/types.ts`:
```
dimensionDrivers?: DimensionDriverMap   // optional; undefined on legacy clusters
```

---

### 2.2 New function: `collectDimensionDrivers`

**File:** `src/opportunity-radar/services/opportunityScorer.ts`

**Signature:**
```
export function collectDimensionDrivers(
  cluster:  OpportunityCluster,
  signals:  PainSignal[],
): DimensionDriverMap
```

This function mirrors the logic of `scoreDimensions` but captures *which* signals/entities matched each pattern instead of computing the numeric score. It must stay in sync with `scoreDimensions` — any scoring change that affects a dimension should be reflected in the drivers for that dimension.

**Per-dimension driver collection:**

**painSeverity:**
- Entity drivers: top 2 signals with `intensityScore >= 7` → `{ type: 'signal', signalId, signalSnippet, label: 'High-intensity signal', contribution: 'positive' }`
- Flag drivers: `{ type: 'flag', flagKey: 'avgIntensity', label: 'Average intensity: ${cluster.avgIntensity.toFixed(1)}/10', contribution: cluster.avgIntensity >= 5 ? 'positive' : 'negative' }`

**frequency:**
- Flag: signal count with label `"${cluster.signalCount} signals across ${cluster.sourceDiversity} source types"`
- No signal-level drivers needed (it's purely a count metric)

**urgency (corpus path):**
- Signal drivers: up to 3 signals matching `CORPUS_URGENCY_TEXT_RE` → include their snippet
- Entity drivers: `platformShifts` entities → `{ type: 'entity', entityValue, entityType: 'platform_shift', label: 'Platform shift detected', contribution: 'positive', pointValue: 30 }`
- Entity drivers: `emergingTech` entities → same pattern with `pointValue: 20`
- Entity drivers: `bottlenecks` entities → `pointValue: 15`

**urgency (social-media path):**
- Signal drivers: up to 3 signals matching `URGENCY_RE`

**willingnessToPay (corpus path):**
- Entity drivers: `existingSolutions` list → `{ label: 'Existing paid tools identified: ${solutions.join(', ')}' }`
- Entity drivers: `buyerRoles` list → `{ label: 'Buyer roles present: ${roles.join(', ')}' }`
- Entity drivers: B2B industries → `{ label: 'B2B industry context: ${matchedIndustry}' }`
- Flag: pain type → `{ label: 'Pain type ${cluster.painTheme} has WTP signal' }` if applicable

**willingnessToPay (social-media path):**
- Signal drivers: up to 3 signals matching `WTP_RE`

**marketBreadth:**
- Entity drivers: top 3 `personas` entities with label "Persona: ${value}"
- Entity drivers: top 2 `industries` entities with label "Industry: ${value}"
- Flag: source diversity → `{ label: '${sourceDiversity} distinct source types' }`

**poorSolutionFit:**
- Entity drivers: top 3 `workarounds` entities with label "Workaround: ${value}"
- Flag: not saturated → `{ label: 'No dominant incumbent detected', contribution: 'positive' }`
- Flag: pain type → if applicable

**feasibility:**
- Flag: passed buildability filter → `{ label: 'No enterprise-scale red flags' }`
- Entity drivers: top 3 `technologies` entities with label "Known tech: ${value}"
- Entity drivers: `workflows.length` as flag → `{ label: 'Workflow complexity: ${n} workflows' }`

**whyNow:**
- Flag: AI momentum → if `WHY_NOW_RE` matches cluster text, add `{ label: 'AI/automation keywords present' }`
- Flag: recency band → `{ label: 'Last signal: ${ageDays.toFixed(0)} days ago' }`

**defensibility:**
- Entity drivers: top 2 `workflows` with label "Workflow lock-in: ${value}"
- Entity drivers: top 2 `technologies` with label "Tech entanglement: ${value}"
- Flag: multi-industry → if `industries.length > 1` → `{ label: '${n} industries' }`

**gtmClarity:**
- Entity drivers: top 3 `personas` as first-audience evidence
- Entity drivers: top 2 `industries`
- Flag: source diversity → `{ label: '${sourceDiversity} source types confirm audience spread' }`

---

### 2.3 Wire drivers into the scan

**File:** `src/views/VentureScope.jsx`

In Step 4 (scoring loop), after `scoreOpportunity()`, call `collectDimensionDrivers()` and add the result to the scored cluster:
```
const drivers = collectDimensionDrivers(cluster, allSignals)
return { ...cluster, ...scoredFields, dimensionDrivers: drivers }
```

`saveVsClusters` already saves the full cluster object — `dimensionDrivers` will be persisted automatically since it's a plain JSON-serializable field.

---

### 2.4 `DimensionScoreGrid` — expandable driver sub-rows

**File:** `src/components/venture-scope/DimensionScoreGrid.jsx`

**New prop:** `drivers?: DimensionDriverMap` (optional, safe when undefined)

For each dimension row, if `drivers[key]` is non-empty:
- Show a compact sub-row below the score bar (always visible, not behind hover)
- Sub-row renders a horizontal flex list of driver pills
- Pill styling: distinct for `signal` (teal left accent), `entity` (magenta left accent), `flag` (white/5 background)
- Signal pills show the snippet (truncated to ~80 chars) and have a visual "signal source" indicator
- Entity pills show `entityType: entityValue` in monospace-ish style
- Flag pills show `label` in muted text

**Design constraints:**
- Max 3 driver pills per dimension (slice + "and N more" if needed)
- Signal pills are NOT clickable in Phase 2 (source linkage for signals in the scores tab is Phase 3 stretch)
- Total sub-row height should not cause layout thrash — use `min-height: 0` on the flex container

**Passing drivers through:**
- `ScoresTab.jsx` extracts `cluster.dimensionDrivers` and passes as `drivers` to `DimensionScoreGrid`
- `BriefTab.jsx` does NOT show `DimensionScoreGrid` currently — add that to Phase 3 scope if desired

---

### 2.5 Data flow summary (Phase 2)

```
VentureScope.jsx (scan Step 4)
  └─ scoreOpportunity(cluster, allSignals, ...) → dimensionScores
     collectDimensionDrivers(cluster, allSignals) → dimensionDrivers
     saveVsClusters([{ ...cluster, dimensionScores, dimensionDrivers }])

ScoresTab.jsx
  └─ cluster.dimensionDrivers passed as drivers prop to DimensionScoreGrid
       └─ each dimension row renders driver pills below the score bar
```

---

### 2.6 Edge cases

| Scenario | Expected behaviour |
|---|---|
| `cluster.dimensionDrivers` is undefined (legacy cluster, pre-Phase 2) | `DimensionScoreGrid` renders as before (text explanation only, no driver pills) |
| A dimension has zero drivers (e.g. all signals are non-corpus and urgency matched nothing) | Sub-row omitted; only the text explanation shows |
| Signal referenced in a driver has been deleted from `fm_vs_signals` | Show pill with `label` but no snippet; don't crash |
| `collectDimensionDrivers` and `scoreDimensions` diverge due to a scoring change | Document the sync requirement explicitly in both functions with a comment: `// SYNC: keep aligned with scoreDimensions()` |
| `dimensionDriverMap` grows large for clusters with many signals | Each dimension caps at 3 signal drivers; entity drivers cap at 3 per type |

---

### 2.7 Acceptance criteria (Phase 2)

- [ ] Each dimension row in `DimensionScoreGrid` shows driver pills when `cluster.dimensionDrivers` is present
- [ ] Urgency driver pills for a corpus cluster show entity values from `platformShifts`, `emergingTech`, and `bottlenecks` when present
- [ ] WTP driver pills for a corpus cluster show existing solution names and buyer role values when present
- [ ] Driver pills are always visible (not hover-gated)
- [ ] Legacy clusters (no `dimensionDrivers`) render identically to the current state
- [ ] Scan step 4 populates and persists `dimensionDrivers` on each scored cluster
- [ ] `collectDimensionDrivers` has a code comment declaring sync requirement with `scoreDimensions`

---

## Phase 3 — OpportunityFrame inspectability

### Goal
A collapsible "Graph Context" panel in the Brief tab exposes the full entity graph underlying a concept: entities by type with frequency, major relationships, and a source-type breakdown.

---

### 3.1 Data flow: making OpportunityFrame available to BriefTab

`OpportunityFrame` is built transiently in the scan and then discarded — it is never persisted. To show it in the Brief tab, it must be rebuilt on demand.

**File:** `src/views/VentureScope.jsx`

Add `entityGraph` and `signals` as props passed to `BriefTab`:
```
<BriefTab
  concept={leadingConcept}
  candidates={clusterCandidates}
  onSelectCandidate={setSelectedCandidate}
  selectedCluster={selectedCluster}   ← NEW
  entityGraph={entityGraph}            ← NEW
  allSignals={signals}                 ← NEW
  storeSlice={storeSlice}              ← from Phase 1
/>
```

**File:** `src/components/venture-scope/tabs/BriefTab.jsx`

Inside `BriefTab`, when `selectedCluster` and `entityGraph` are both non-null:
```
const frame = buildOpportunityFrame(selectedCluster, allSignals, entityGraph)
```

Pass `frame` to `<OpportunityFramePanel frame={frame} />`.

This is a synchronous call (pure function) — no useEffect or loading state needed.

---

### 3.2 New component: `OpportunityFramePanel`

**File:** `src/components/venture-scope/OpportunityFramePanel.jsx`

**Props:**
```
{ frame: OpportunityFrame | null }
```

**Structure:** collapsible panel (starts collapsed), triggered by a header button.

**When collapsed:** Shows summary line: `"Graph context — {n} entity types · {m} entities · {k} relationships"`.

**When expanded:**

```
[Section: Key Entities]
For each non-empty entity type in priority order (persona, workflow, workaround,
technology, bottleneck, emerging_technology, platform_shift, existing_solution,
buyer_role, industry):
  - Type header label (e.g. "Personas", "Workflows")
  - Entity chips showing value + frequency badge
  - Max 5 entities per type; "and N more" link if there are more

[Section: Entity Relationships]
Top 5 relationships by strength, formatted as:
  "{fromEntity} → {relationshipType} → {toEntity}"  (strength as opacity or subtle bar)
If fewer than 2 relationships: show "Sparse relationship data — more signals will build this over time"

[Section: Source breakdown]
Count of signals per corpusSourceType in this cluster:
  Saved items: N  |  Documents: M  |  Topic summaries: K  |  etc.
```

**Rendering rules:**
- Entity chips use the same styling as the entity evidence chips in `ScoresTab`
- Relationship type labels use human-readable form:
  - `experiences` → "experiences"
  - `performs` → "performs"
  - `has_friction` → "has friction with"
  - `uses` → "uses"
  - `signals_gap` → "signals gap in"
  - `enables` → "enables"
  - `operates_in` → "operates in"
  - `substitutes` → "substitutes"
- The panel is NOT scrollable internally — it expands the parent page height
- No JSON, no IDs visible to the user — only human-readable entity values and relationship labels

---

### 3.3 Source breakdown calculation

Inside `OpportunityFramePanel`, compute source breakdown from `frame.signals`:
```
group frame.signals by (s.corpusSourceType ?? s.source) and count
```

Use `SOURCE_TYPE_LABEL` map (already defined in `BriefTab.jsx` — move it to a shared constant or duplicate it in the panel).

---

### 3.4 Import path for `buildOpportunityFrame` in BriefTab

`BriefTab.jsx` is a React component in `src/components/` and currently has no service imports. Adding the import:
```
import { buildOpportunityFrame } from '../../../venture-scope/services/opportunityFrameBuilder.js'
```

`OpportunityFramePanel` does not need to import `buildOpportunityFrame` — it receives the already-built `frame` as a prop.

---

### 3.5 Placement in BriefTab

Add `<OpportunityFramePanel frame={frame} />` as the **last** section in BriefTab, after `EvidenceTraceSection` and before the alternate concepts panel. This placement ensures:
- Users read the concept brief first
- Evidence trace (source snippets) is seen before the graph context
- Graph context is discoverable but not the first thing shown

---

### 3.6 Data flow summary (Phase 3)

```
VentureScope.jsx state: { entityGraph, signals }
  └─ <BriefTab selectedCluster={...} entityGraph={entityGraph} allSignals={signals} />
       ├─ frame = buildOpportunityFrame(selectedCluster, allSignals, entityGraph)
       ├─ [existing concept content...]
       ├─ <EvidenceTraceSection entries={concept.evidenceTrace} storeSlice={storeSlice} />
       └─ <OpportunityFramePanel frame={frame} />
            ├─ Entity groups by type with frequency chips
            ├─ Top 5 relationships (human-readable)
            └─ Source type counts
```

---

### 3.7 Edge cases

| Scenario | Expected behaviour |
|---|---|
| No concept selected (leadingConcept is null) | BriefTab shows its existing empty state; OpportunityFramePanel never mounts |
| `entityGraph` is empty (before first scan) | `frame.personas`, `frame.workflows`, etc. are all empty arrays; panel shows "No entity data yet — run a scan first" |
| `selectedCluster` is null (no cluster selected yet) | Skip calling `buildOpportunityFrame`; don't pass `frame` to panel; panel renders nothing |
| Frame has entities but zero relationships | Relationship section shows the sparse data message |
| Entity has very long value string (e.g. a full phrase extracted as a workflow) | Chip truncates to 40 chars with `…` tooltip via HTML `title` attribute |
| All signals in the cluster have no `corpusSourceType` (legacy signals) | Source breakdown shows "corpus: N" as a single entry |

---

### 3.8 Acceptance criteria (Phase 3)

- [ ] "Graph Context" panel appears in BriefTab when a concept is selected and entity data exists
- [ ] Panel is collapsed by default; expands on click
- [ ] Collapsed state shows summary: entity type count, total entity count, relationship count
- [ ] Expanded state shows entity chips grouped by type with frequency badges (at least for personas, workflows, workarounds, technologies)
- [ ] Top 5 relationships render in human-readable form (no raw type strings like `has_friction`)
- [ ] Source breakdown shows per-corpusSourceType counts
- [ ] No JSON or raw IDs visible to the user anywhere in the panel
- [ ] If no entity data exists, panel shows a "no data" message rather than an empty accordion
- [ ] `buildOpportunityFrame` is called synchronously inside BriefTab — no loading state or async

---

## Migration and backward-compatibility

### Stored cluster data
- `dimensionDrivers` is an optional field on `OpportunityCluster` — old clusters without it will have `dimensionDrivers: undefined`
- No migration script needed — `DimensionScoreGrid` guards with `drivers?.[key]?.length` before rendering pills
- Next rescan will populate `dimensionDrivers` for all clusters

### Stored concept data
- No concept schema changes in this plan
- No migration needed

### `EvidenceTraceSection` prop changes
- `storeSlice` is a new optional prop — existing usage without it continues to work (resolver call is guarded with a `storeSlice &&` check)
- If `storeSlice` is not passed, rows render as before (not clickable)

### `BriefTab` prop changes
- `selectedCluster`, `entityGraph`, `allSignals`, `storeSlice` are all new optional props
- Existing usage (if BriefTab is referenced anywhere outside VentureScope.jsx) is unaffected
- `OpportunityFramePanel` only mounts when `frame` is non-null

### `DimensionScoreGrid` prop changes
- `drivers` is a new optional prop — component renders identically without it
- `explanations` prop behavior unchanged

---

## Implementation order within phases

### Phase 1 dependencies
```
sourceResolver.ts
  → EvidenceTraceSection (updated)
  → EvidenceTab (updated)
  → VentureScope.jsx (storeSlice prop added to BriefTab and EvidenceTab)
```
Build and test `resolveSourceLink` in isolation before touching the UI.

### Phase 2 dependencies
```
types.ts (new DimensionDriver, DimensionDriverMap)
  → types.ts in opportunity-radar (DimensionDriverMap added to OpportunityCluster)
  → opportunityScorer.ts (collectDimensionDrivers)
  → VentureScope.jsx (call collectDimensionDrivers in scan Step 4)
  → DimensionScoreGrid.jsx (drivers prop + pill rendering)
  → ScoresTab.jsx (pass drivers from cluster)
```
Add and test `collectDimensionDrivers` before changing any UI.

### Phase 3 dependencies
```
OpportunityFramePanel.jsx (new component)
  → BriefTab.jsx (import frame builder, add panel)
  → VentureScope.jsx (pass selectedCluster, entityGraph, allSignals to BriefTab)
```
Build `OpportunityFramePanel` in isolation with a mock frame before wiring it into BriefTab.

---

## Out of scope for this plan

The following related items were considered but excluded to keep this plan focused:

- **Score dimension deep-links to source records:** Driver pills in Phase 2 show signal snippets but do not yet click through to source records. That linkage (combining Phase 1 resolver with Phase 2 driver signal IDs) is a natural follow-on once both phases are stable.
- **Concept revision history:** Stable concept IDs (implemented earlier) are the prerequisite. A revision trail requires a separate versioning layer on `VentureConceptCandidate`.
- **Entity/cluster persistence compounding:** The entity graph is currently rebuilt from all signals on each scan. Incremental graph merging (preserving relationship strength over multiple scans) is a separate infrastructure task.
- **OpportunityFrame persistence:** The frame is currently rebuilt on-demand. Persisting it would enable showing the "frame at the time of generation" vs "current frame" — useful for change tracking but not required now.
