# Opportunity Radar Upgrade — Design Document

**Date:** 2026-05-05  
**Goal:** Upgrade Opportunity Radar from a pain-only scanner into a multi-signal opportunity discovery engine that surfaces buildable ideas from 7 signal classes.  
**Approach:** In-place schema upgrade (Approach A) — replace `PainSignal`/`AppConcept` types with `OpportunitySignal`/`OpportunityThesis`, refactor existing pipeline modules, abandon old localStorage keys.

---

## Architecture

### Pipeline

```
SIGNAL_QUERIES (7 modes × ~10 templates each)
  → runMultiSignalSearch()       tags each result with its SignalType
  → extractOpportunitySignal()   intensity filter; signalType from query mode (no LLM)
  → KeywordClusterer             unchanged Jaccard logic, updated types
  → scoreOpportunity()           8-component weighted formula
  → wedgeClassifier()            deterministic; no LLM
  → buildOpportunityThesis()     Ollama: JTBD + wedge fields + MVP
```

### JTBD extraction strategy

`signalType` is set **deterministically at extraction time** from which query mode found the signal — no LLM call needed. `jobToBeDone` is a **cluster-level** field populated by Ollama during thesis generation (one call per cluster). Signals inherit the cluster's inferred JTBD when the thesis is built. This keeps extraction fast while still producing the richer output the spec requires.

### Storage migration

New localStorage keys:
- `fm_radar_signals_v2` — `OpportunitySignal[]`
- `fm_radar_clusters_v2` — `OpportunityCluster[]` (upgraded)
- `fm_radar_theses` — `OpportunityThesis[]`

Old keys (`fm_radar_signals`, `fm_radar_clusters`, `fm_radar_concepts`) are abandoned — no migration. Existing data is low-quality noise and does not need carrying forward.

---

## Type System

### `SignalType` (replaces `PainType`)

```ts
export type SignalType =
  | 'pain'
  | 'pull'
  | 'success'
  | 'gap'
  | 'switching'
  | 'workaround'
  | 'adjacency'
```

### `OpportunitySignal` (replaces `PainSignal`)

```ts
export interface OpportunitySignal {
  id:                string
  detectedAt:        string          // ISO timestamp
  source:            string          // ScanSource value
  sourceUrl:         string
  sourceEntity?:     string
  author?:           string
  signalType:        SignalType      // set at extraction from query mode
  rawText:           string          // raw extracted text (was painText)
  normalizedText:    string
  keyTerms:          string[]
  jobToBeDone:       string          // '' at extraction; filled when thesis is built
  targetUser?:       string
  currentSolution?:  string
  incumbent?:        string
  incumbentGap?:     string
  switchingTrigger?: string
  niche?:            string
  tags:              string[]
  evidenceStrength:  number          // 0–10 (was intensityScore)
  queryUsed:         string
}
```

### `OpportunityCluster` (upgraded in place)

Existing fields retained. New fields added:

```ts
signalTypeBreakdown: Record<SignalType, number>  // count per signal type
blockedAt?:          string                       // ISO; present = blocked
```

`status` gains `'blocked'` as a valid value:
```ts
status: 'emerging' | 'validated' | 'concept_generated' | 'archived' | 'blocked'
```

### `OpportunityThesis` (replaces `AppConcept`)

```ts
export interface OpportunityThesis {
  id:                   string
  clusterId:            string
  title:                string
  jobToBeDone:          string
  targetUser:           string
  niche:                string
  wedgeType:            WedgeType
  summary:              string
  whyNow:               string
  currentAlternatives:  string[]
  incumbentWeaknesses:  string[]
  proofSignals:         string[]
  evidenceCount:        number
  buildabilityScore:    number    // 0–100
  demandScore:          number    // 0–100
  competitionPressure:  number    // 0–100
  wedgeClarityScore:    number    // 0–100
  recommendedMvp:       string[]
  generatedBy:          'ollama' | 'template'
  status:               'new' | 'reviewing' | 'saved' | 'building' | 'archived'
  createdAt:            string
  updatedAt:            string
}

export type WedgeType =
  | 'underserved-winner'
  | 'workaround-to-product'
  | 'pattern-transfer'
  | 'switching-wedge'
  | 'emerging-pull'
```

---

## Query Builder

### `constants/signalQueries.ts` (replaces `constants/painQueries.ts`)

Exports `SIGNAL_QUERIES: Record<SignalType, string[]>` with ~10 templates per mode:

```ts
export const SIGNAL_QUERIES: Record<SignalType, string[]> = {
  pain: [
    '"I hate how"',
    '"why isn\'t there an app that"',
    '"frustrated with"',
    '"takes too long every time"',
    '"I keep doing this manually"',
    '"no good solution for"',
    '"still doing this in spreadsheets"',
    '"current tools are too expensive" OR "too complex"',
    '"I built a workaround for"',
    '"doesn\'t support"',
  ],
  pull: [
    '"looking for a tool to"',
    '"need an app for"',
    '"best way to"',
    '"is there a tool that"',
    '"recommend a tool for"',
    '"any good software for"',
    '"what do you use for"',
    '"help me find"',
  ],
  success: [
    '"best" AND ("app" OR "tool" OR "software")',
    '"top rated" AND "software"',
    '"favorite" AND ("tool" OR "app")',
    '"highly recommend" AND "app"',
    '"worth the money" AND "app"',
    '"switched to" AND "never looked back"',
    '"game changer" AND ("tool" OR "software")',
  ],
  gap: [
    '"wish it had"',
    '"missing feature"',
    '"feature request"',
    '"should have" AND ("app" OR "tool")',
    '"doesn\'t support" AND "wish"',
    '"would be great if"',
    '"one thing I hate about"',
    '"biggest complaint" AND "app"',
  ],
  switching: [
    '"switched from" AND "to"',
    '"alternative to"',
    '"moved away from"',
    '"better than" AND "for"',
    '"left" AND "because"',
    '"migrated from"',
    '"replaced" AND "with"',
  ],
  workaround: [
    '"spreadsheet for"',
    '"using notion for"',
    '"zapier workaround"',
    '"manual way to"',
    '"copy paste" AND "every time"',
    '"built a script for"',
    '"three tools" AND "workflow"',
    '"manual process" AND "annoying"',
  ],
  adjacency: [
    '"like" AND "but for"',
    '"AI copilot for"',
    '"for teams" AND "like"',
    '"version of" AND "for"',
    '"for" AND "industry" AND "tool"',
    '"nobody has built" AND "for"',
  ],
}
```

### Source affinity

Site: sources run a targeted subset of modes that match their content type:

| Source | Modes |
|---|---|
| reddit, hackernews, stackoverflow, twitter, linkedin, indiehackers | all 7 |
| producthunt | success, pull, gap |
| g2, capterra | gap, success, switching |
| github | gap, workaround |
| youtube | pain, workaround, success |

---

## Search Service

### `services/multiSignalSearchService.ts` (replaces `painSearchService.ts`)

```ts
export async function runMultiSignalSearch(
  modes: SignalType[] = ALL_SIGNAL_TYPES,
  sources: ScanSource[] = ALL_SOURCES,
  onProgress: ProgressCallback = () => {},
): Promise<Array<RawSearchResult & { signalType: SignalType }>>
```

- Builds query list per mode using source affinity
- Tags each result with `signalType` before returning
- `ScanProgress` gains `signalType?: SignalType` field for UI display
- Same `pLimit(5)` concurrency as existing service
- Same per-source deduplication by URL

---

## Signal Extraction

### `services/signalExtractor.ts` (updated)

`extractSignal()` now returns `OpportunitySignal | null`. The function accepts `signalType: SignalType` as a third parameter (passed from the query mode that produced the result). `intensityScore` → `evidenceStrength`. `painText` → `rawText`. `painType` field is removed. `jobToBeDone` initialises to `''`.

---

## Scoring

### `services/opportunityScorer.ts` (updated)

8-component weighted formula:

```ts
opportunityScore =
  demand       * 0.20 +   // (pull count + success count) normalised 0–10
  pain         * 0.15 +   // avg evidenceStrength of pain signals, normalised 0–10
  validation   * 0.15 +   // success signal count, normalised 0–10
  gap          * 0.15 +   // gap signal count, normalised 0–10
  switching    * 0.10 +   // switching signal count, normalised 0–10
  workaround   * 0.10 +   // workaround signal count, normalised 0–10
  wedgeClarity * 0.10 +   // number of distinct SignalTypes in cluster (1–7), normalised
  buildability * 0.05     // 10 if BUILDABILITY_REGEX absent, else 0
```

Each component is normalised to 0–10 before weighting. Final score is 0–100.

**`qualifies()` gate relaxed:**
- Minimum 3 signals (was 10) — multi-signal clusters naturally start smaller
- Minimum 1 source (was 2)
- Recency window: 90 days (unchanged)
- Not blocked

**`getTopN(n, clusters, signals)`** replaces `getTop3()` — parameterised count, returns top N by `opportunityScore`.

---

## Wedge Classification

### `services/wedgeClassifier.ts` (new file)

Pure function, no LLM. Classifies based on `signalTypeBreakdown` ratios in a cluster:

```ts
export function classifyWedge(cluster: OpportunityCluster): WedgeType {
  const total = cluster.signalCount
  const ratio = (type: SignalType) =>
    (cluster.signalTypeBreakdown[type] ?? 0) / total

  if (ratio('switching')   > 0.30) return 'switching-wedge'
  if (ratio('workaround')  > 0.30) return 'workaround-to-product'
  if (ratio('adjacency')   > 0.30) return 'pattern-transfer'
  if (ratio('success')     > 0.25 && ratio('gap') > 0.15) return 'underserved-winner'
  return 'emerging-pull'
}
```

---

## Thesis Generation

### `services/thesisGenerator.ts` (replaces `conceptGenerator.ts`)

One Ollama call per cluster returns all prose thesis fields. The 4 numeric scores come from the scorer (not Ollama). Wedge type comes from `wedgeClassifier` (not Ollama).

**Ollama prompt returns (JSON):**
```json
{
  "jobToBeDone": "...",
  "targetUser": "...",
  "niche": "...",
  "summary": "...",
  "whyNow": "...",
  "currentAlternatives": ["...", "..."],
  "incumbentWeaknesses": ["...", "..."],
  "proofSignals": ["...", "..."],
  "recommendedMvp": ["...", "...", "..."]
}
```

Uses `chatJson()` (the JSON-mode Ollama call added for the agent loop). Falls back to template values if Ollama fails.

After thesis generation, all `OpportunitySignal`s in the cluster have their `jobToBeDone` backfilled from `thesis.jobToBeDone`.

---

## Block Action

**Storage:**
- `radarStorage.blockCluster(id: string)` — sets `status: 'blocked'`, `blockedAt: now`
- `radarStorage.unblockCluster(id: string)` — resets `status: 'emerging'`, clears `blockedAt`

**Filtering:**
- All scorer outputs exclude blocked clusters
- All UI tabs exclude blocked clusters by default
- A "Blocked (N)" chip above the pattern table toggles their visibility
- Unblock button restores status to `'emerging'`

---

## UI Changes

### `OpportunityRadar.jsx`

**Signal-type tab bar** replaces source filter chips:

```
All · Pain · Pull · Winners · Gaps · Switching · Workarounds · Adjacency · Theses
```

Selecting a tab filters the cluster table to clusters where that `SignalType` is the plurality in `signalTypeBreakdown`. The **Theses** tab renders `ThesisCard` components instead of the pattern table.

**Pattern table (`PatternTable.jsx`):**
- New `Type` column: colour-coded signal-type pill
  - pain = teal, pull = violet, success = amber, gap = orange, switching = red, workaround = yellow, adjacency = indigo
- New `Wedge` column: wedge type label
- `Score` tooltip updated to describe 8-component formula
- `Actions` column gains **Block (×)** button — calls `blockCluster(id)`, fades row out immediately
- "Blocked (N)" chip above table shows/hides blocked rows

### `components/opportunity/ThesisCard.tsx` (new)

Used in the Theses tab and Top Opportunities section. Layout:

- **Header:** title + wedge type badge + opportunity score bar
- **Body:** job to be done, target user, why now (one sentence each)
- **Evidence strip:** signal type breakdown pills (`pain ×4 · gap ×3 · switching ×2`)
- **Incumbent weaknesses:** bulleted list (top 3)
- **Recommended MVP:** bulleted list
- **Actions:** Generate full concept · Block · Evidence

Existing `ConceptView` modal and `EvidencePanel` are reused unchanged for the "Generate full concept" flow.

---

## Files Changed / Created

| File | Change |
|---|---|
| `src/opportunity-radar/types.ts` | Replace `PainSignal`/`AppConcept`; add `OpportunitySignal`, `OpportunityThesis`, `WedgeType`, `SignalType` |
| `src/opportunity-radar/constants/signalQueries.ts` | New — 7-class query map |
| `src/opportunity-radar/constants/painQueries.ts` | Delete (superseded) |
| `src/opportunity-radar/constants/synonyms.ts` | Unchanged |
| `src/opportunity-radar/services/multiSignalSearchService.ts` | New — replaces `painSearchService.ts` |
| `src/opportunity-radar/services/painSearchService.ts` | Delete (superseded) |
| `src/opportunity-radar/services/signalExtractor.ts` | Update for `OpportunitySignal` |
| `src/opportunity-radar/services/clusterService.ts` | Update types; add `signalTypeBreakdown` tracking |
| `src/opportunity-radar/services/opportunityScorer.ts` | Replace 5-factor with 8-component scorer; relax `qualifies()`; `getTopN()` |
| `src/opportunity-radar/services/wedgeClassifier.ts` | New — deterministic wedge classification |
| `src/opportunity-radar/services/thesisGenerator.ts` | New — replaces `conceptGenerator.ts` |
| `src/opportunity-radar/services/conceptGenerator.ts` | Delete (superseded) |
| `src/opportunity-radar/services/aiOpportunityFilter.ts` | Update types to `OpportunitySignal`/`OpportunityCluster` |
| `src/opportunity-radar/storage/radarStorage.ts` | New v2 keys; `blockCluster`/`unblockCluster` helpers |
| `src/opportunity-radar/services/__tests__/` | Update all existing tests; add tests for wedgeClassifier, thesisGenerator, multiSignalSearchService |
| `src/views/OpportunityRadar.jsx` | Tab bar; call new services; integrate ThesisCard; block action |
| `src/components/opportunity/ThesisCard.tsx` | New |
| `src/components/opportunity/PatternTable.jsx` | Type pill; wedge column; block button; blocked chip |
| `src/components/opportunity/RadarTopCard.jsx` | Update to show `OpportunityThesis` fields |

---

## Success Criteria

- Scan produces signals tagged with 7 distinct `signalType` values
- Pattern table shows signal type and wedge type columns
- Block button dismisses a pattern immediately and persistently
- Thesis cards show job, wedge type, incumbent weaknesses, and MVP bullets
- Opportunity score uses 8 components; qualifies() accepts clusters with 3+ signals
- Ollama thesis generation falls back to template without crashing
- All existing tests updated; wedgeClassifier and thesisGenerator have test coverage
