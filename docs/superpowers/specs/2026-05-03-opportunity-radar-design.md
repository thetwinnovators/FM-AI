# Opportunity Radar — Design Spec
_2026-05-03_

## Goal

Build a FlowMap feature that automatically detects emerging app opportunities by searching the web for recurring pain patterns, then generates structured app concept packages — including a ready-to-paste Claude Code build prompt.

**Key principle:** Every opportunity must be realistically buildable as a single-page web app by a solo developer in one Claude Code session. No enterprise platforms, no hardware-dependent ideas, no multi-year projects.

---

## Architectural decisions

| Question | Decision |
|---|---|
| Module organisation | Standalone `src/opportunity-radar/` module (same pattern as `signals/`, `flow-ai/`, `mcp/`) |
| Scheduling | On-load freshness check (6 h default) + manual "Run Scan" button. No background polling. |
| Clustering MVP | Keyword clustering (normalize → term extraction → Jaccard similarity). Clean `IClusterer` interface for semantic upgrade later. |
| Concept generation | Hybrid: deterministic template for evidence/stats + Ollama for narrative. Full template fallback when Ollama is off. |
| Ollama output format | Section-constrained prompt with exact `## HEADER` markers. Parser extracts by header; missing sections fall through to template. |
| Synonym normalisation | Lightweight flat synonym map in `constants/synonyms.ts`. Applied before clustering. |

---

## Module structure

```
src/opportunity-radar/
  types.ts
  constants/
    painQueries.ts          — 12 pain detection queries
    synonyms.ts             — synonym/normalization map
  storage/
    radarStorage.ts         — localStorage CRUD + disk sync
  services/
    painSearchService.ts    — run pain queries across Reddit + HN + YouTube
    signalExtractor.ts      — extract and score pain signals from raw results
    normalizationService.ts — lowercase, stopword strip, synonym collapse, key term extraction
    clusterService.ts       — IClusterer interface + KeywordClusterer implementation
    opportunityScorer.ts    — scoring formula + buildability filter + top-3 gate
    conceptGenerator.ts     — hybrid template + Ollama concept generation

src/views/
  OpportunityRadar.jsx

src/components/opportunity/
  RadarTopCard.jsx          — top-3 featured cards
  PatternTable.jsx          — secondary sortable/filterable list
  ConceptView.jsx           — concept detail panel
  EvidencePanel.jsx         — signals evidence drawer
```

---

## Data model

### Storage keys (localStorage + disk sync)

```
fm_radar_signals    — PainSignal[]
fm_radar_clusters   — OpportunityCluster[]
fm_radar_concepts   — AppConcept[]
fm_radar_meta       — RadarScanMeta
```

Follows the same `read / write / scheduleSync` pattern as `src/signals/storage/localSignalsStorage.ts`.

### Types

```typescript
type PainType =
  | 'workflow' | 'cost' | 'feature' | 'complexity'
  | 'speed'    | 'workaround' | 'integration' | 'privacy'

interface PainSignal {
  id:             string
  detectedAt:     string         // ISO timestamp
  source:         'reddit' | 'hackernews' | 'youtube'
  sourceUrl:      string
  author?:        string
  painText:       string         // raw extracted text
  normalizedText: string         // lowercased, stopwords stripped, synonyms collapsed
  keyTerms:       string[]       // extracted from normalizedText
  painType:       PainType
  intensityScore: number         // 0–10
  clusterId?:     string
  queryUsed:      string
}

interface OpportunityCluster {
  id:              string
  clusterName:     string        // top 3 terms by frequency: "manual spreadsheet export pain"
  painTheme:       PainType
  signalIds:       string[]
  signalCount:     number
  sourceDiversity: number        // count of distinct sources
  avgIntensity:    number
  firstDetected:   string
  lastDetected:    string
  termFrequency:   Record<string, number>  // preserved for semantic upgrade
  opportunityScore: number
  isBuildable:     boolean
  status:          'emerging' | 'validated' | 'concept_generated' | 'archived'
  createdAt:       string
  updatedAt:       string
}

interface AppConcept {
  id:             string
  clusterId:      string
  title:          string
  tagline:        string
  confidenceScore: number        // 0–100 mapped from opportunityScore

  // Deterministic — always present, no LLM needed
  evidenceSummary: {
    signalCount:     number
    sourceBreakdown: Record<string, number>
    dateRange:       { first: string; last: string }
    topQuotes:       Array<{ text: string; source: string; url: string; author?: string }>
  }
  painPoints: Array<{ point: string; frequency: number }>

  // Narrative — Ollama when available, template fallback otherwise
  opportunitySummary:  string
  problemStatement:    string
  targetUser:          string
  proposedSolution:    string
  valueProp:           string
  mvpScope:            string
  risks:               string
  claudeCodePrompt:    string
  implementationPlan:  string

  generatedBy: 'ollama' | 'template'
  status:      'new' | 'reviewing' | 'saved' | 'building' | 'archived'
  createdAt:   string
  updatedAt:   string
}

interface RadarScanMeta {
  lastScanAt:      string | null
  totalSignals:    number
  totalClusters:   number
  scanDurationMs?: number
}
```

---

## Pipeline

### 1. Pain search (`painSearchService.ts`)

Runs 12 queries across Reddit, HN, and YouTube using existing adapters (`searchReddit`, `searchHackerNews`, `searchYoutube`). Execution is source-sequential, queries-parallel within each source: run all 12 queries against Reddit concurrently (max 5 in-flight at once), then HN, then YouTube. This keeps peak concurrency to 5 requests rather than 36, avoids rate-limit responses, and makes per-source errors easy to isolate. Results are mapped to `{ title, body, url, source, author, publishedAt }` and deduplicated by URL before extraction.

```typescript
const PAIN_QUERIES = [
  '"I hate how"',
  '"there should be a tool for"',
  '"why isn\'t there an app that"',
  '"I keep doing this manually"',
  '"current tools are too expensive" OR "too complex"',
  '"I built a workaround for"',
  '"doesn\'t support"',
  '"takes too long every time"',
  '"I wish" AND (app OR tool OR feature)',
  '"no good solution for"',
  '"still doing this in spreadsheets"',
  '"frustrated with"',
]
```

### 2. Signal extraction (`signalExtractor.ts`)

For each search result:
- Classify `painType` by keyword matching per type
- Score intensity across four sub-signals (sum = 0–10):

```
emotionalScore   0–3   "nightmare" "gave up" "terrible" "hate" "broken"
urgencyScore     0–3   "every day" "constantly" "always" "waste hours" "every time"
workaroundScore  0–2   "I built" "three tools" "manual process" "script" "workaround"
financialScore   0–2   "too expensive" "can't afford" "wasted hours" "lost money"
```

Signals with `intensityScore < 3` are discarded — weak/generic mentions with no real pain.

### 3. Normalisation (`normalizationService.ts`)

Applied to every signal before clustering. Order matters — multi-word phrases must be replaced before tokenisation or they will never match.

1. **Multi-word phrase substitution** — scan the raw lowercased text and replace known multi-word phrases with their canonical single token (e.g. `"google sheets"` → `"spreadsheet"`, `"takes forever"` → `"slow"`, `"copy paste"` → `"manual"`). Applied to raw text before any splitting.
2. **Lowercase + strip** — punctuation, numbers, stopwords (`the`, `a`, `is`, `for`, `with`, `that`, `it`, `we`, `they` …)
3. **Single-token synonym collapse** — map remaining single-word variants to canonical terms
4. **Key term extraction** — remaining tokens with length ≥ 4, deduped → `signal.keyTerms`

`constants/synonyms.ts` stores two separate maps to match the two-pass approach:

```typescript
// Applied to raw text before tokenisation (phrase → single token)
export const PHRASE_SYNONYMS: Record<string, string> = {
  'google sheets':  'spreadsheet',
  'microsoft excel': 'spreadsheet',
  'takes forever':  'slow',
  'not working':    'broken',
  "doesn't work":   'broken',
  "can't afford":   'costly',
  'copy paste':     'manual',
  'by hand':        'manual',
}

// Applied to tokens after tokenisation (word → canonical word)
export const TOKEN_SYNONYMS: Record<string, string> = {
  'hate':       'dislike',   'terrible': 'bad',    'awful':      'bad',
  'frustrated': 'annoyed',   'annoying': 'annoyed', 'nightmare':  'bad',
  'excel':      'spreadsheet', 'sheets': 'spreadsheet',
  'laggy':      'slow',      'slow':    'slow',
  'broken':     'broken',
  'overpriced': 'costly',    'expensive': 'costly',
  'manual':     'manual',
}
```

### 4. Clustering (`clusterService.ts`)

**Interface — semantic upgrade is a drop-in replacement:**

```typescript
interface IClusterer {
  cluster(signals: PainSignal[], existing: OpportunityCluster[]): OpportunityCluster[]
}
```

**`KeywordClusterer` (MVP) — algorithm:**

1. For each incoming signal, compute Jaccard similarity of its `keyTerms` against each cluster's `termFrequency` key set
2. Similarity ≥ **0.35** AND same `painType` → assign to that cluster
3. Similarity ≥ **0.35** AND different `painType` → assign if cluster has < 5 signals (still forming), else create new cluster
4. No match above threshold → new cluster
5. After all signals assigned: merge clusters with > 70% overlapping `signalIds`
6. Cluster name = top 3 terms by frequency, joined: `"manual spreadsheet export pain"`
7. `termFrequency` updated incrementally — every new signal's key terms counted in

`termFrequency` is preserved on every cluster as the anchor for the future `EmbeddingClusterer`, which will use it as a hybrid signal alongside cosine scores.

### 5. Scoring (`opportunityScorer.ts`)

```
opportunityScore =
  (signalCount × 2)          frequency is the dominant signal
  + sourceDiversity           count of distinct sources (max 3 for Phase 1)
  + recencyBonus              last 7 days: +5 / last 30 days: +2 / older: 0
  + (avgIntensity × 1.5)      average intensityScore across all cluster signals
  + specificityBonus          +3 if ≥ 3 signals have intensityScore ≥ 7
  + buildabilityBonus         +5 if buildability filter passes
  − saturationPenalty         −10 if solved-problem keywords detected
```

**Buildability filter** — regex exclusion on cluster's top terms + all signal texts. Fail = `isBuildable: false`. Pass = `isBuildable: true` + the +5 bonus.

```
/multi.?user|role.?manag|admin.?panel|real.?time.?collab|payment.?process|
 video.?stream|iot|bluetooth|hipaa|enterprise.?scale|native.?app|
 oauth|websocket|backend.?required/i
```

**Top-3 qualification gate** (all must pass):
- `isBuildable: true`
- `signalCount ≥ 10`
- `sourceDiversity ≥ 2`
- At least 3 signals with `intensityScore ≥ 7`
- At least one signal within last 90 days

Sort all qualifying clusters by `opportunityScore` descending, take first 3.

---

## Concept generation (`conceptGenerator.ts`)

Generation is always user-triggered ("Generate App Concept" click). Never automatic.

### Step 1 — Deterministic fields (always runs, no LLM)

```typescript
evidenceSummary: {
  signalCount:     cluster.signalCount,
  sourceBreakdown: tally(signals, s => s.source),
  dateRange:       { first: cluster.firstDetected, last: cluster.lastDetected },
  topQuotes:       top5ByIntensity(signals).map(s => ({ text: s.painText, source: s.source, url: s.sourceUrl, author: s.author }))
}
painPoints:      top8Terms(cluster.termFrequency).map(([term, freq]) => ({ point: term, frequency: freq }))
confidenceScore: Math.min(100, Math.round(cluster.opportunityScore))
```

### Step 2 — Ollama generation (when available)

Single `generateSummary`-style call. Section-constrained prompt:

```
System:
You are an app opportunity analyst. Return EXACTLY these sections with EXACTLY
these headers in this order. No extra sections. No skipped sections.
Vary prose quality freely — never vary the schema.

## OPPORTUNITY_SUMMARY
## PROBLEM_STATEMENT
## TARGET_USER
## PROPOSED_SOLUTION
## VALUE_PROPOSITION
## MVP_SCOPE
## RISKS
## CLAUDE_CODE_PROMPT
## IMPLEMENTATION_PLAN

User:
Pain pattern: "{cluster.clusterName}"
Pain type: {cluster.painTheme}
Signal count: {cluster.signalCount} across {sources}
Top pain quotes:
{topQuotes}
Recurring terms: {top10Terms}

HARD CONSTRAINTS — enforce in every section, especially CLAUDE_CODE_PROMPT:
- Single-page web app (one HTML file or simple multi-file)
- localStorage or IndexedDB only — no backend, no database server
- No paid APIs, no OAuth, no real-time collaboration, no payment processing
- No native mobile or desktop apps
- Completable in one Claude Code session by a solo developer
- If pain requires anything on this list, scope the solution DOWN in RISKS
  until it fits within constraints
```

**Parser:** splits response on `## `, maps section names to concept fields. A missing section silently falls through to the template value for that field — no error, no partial failure.

### Step 3 — Template fallback

Each narrative field has a deterministic string-template fallback. `generatedBy` is set to `'ollama'` or `'template'`. The feature never fails because Ollama is off — it always produces a complete concept package.

### Step 4 — Persist

Saved to `fm_radar_concepts` keyed by `clusterId`. Cluster status → `'concept_generated'`. Re-generating overwrites with a confirmation prompt.

---

## Scheduling

On `OpportunityRadar` mount:

```javascript
const SCAN_STALE_MS = 6 * 60 * 60 * 1000  // 6 h, will be user-configurable

useEffect(() => {
  const meta = radarStorage.loadMeta()
  const lastScan = meta?.lastScanAt ? new Date(meta.lastScanAt).getTime() : 0
  const isStale = !meta?.lastScanAt || (Date.now() - lastScan > SCAN_STALE_MS)
  if (isStale) triggerScan()
}, [])
```

`triggerScan()`: sets `scanning` state → runs full pipeline → writes to storage → updates `lastScanAt` → refreshes component state. Progress and errors are local component state; no global store involvement.

Always-visible "Run Scan" button triggers the same `triggerScan()` regardless of staleness.

---

## UI

### Route and navigation

- Route: `/radar` added to `App.jsx`
- Nav entry in `LeftRail.jsx` exploration group (between Discover and Latest Signals):
  ```javascript
  { to: '/radar', label: 'Opportunity Radar', icon: Radar }
  ```
  (`Radar` from lucide-react)

### `OpportunityRadar.jsx` — three zones

**Zone 1: Header bar**
- Title: "Opportunity Radar"
- Last-scan chip: "Last scan: 2 hours ago" (or "Never scanned")
- Scan progress indicator (source-by-source status while running)
- "↻ Run Scan" button (disabled + spinner while running)
- After scan: signal count + cluster count summary chip

**Zone 2: Top 3 Featured Opportunities**

Responsive grid (`grid-cols-1 md:grid-cols-3`). Each `RadarTopCard`:
- Rank badge `#1` / `#2` / `#3`
- Cluster name (pain pattern title)
- Opportunity score + filled bar
- Signal count
- Source diversity pill: count + source names
- Recency chip: last signal age
- Pain intensity badge: LOW / MEDIUM / HIGH from `avgIntensity`
- Top quote from highest-intensity signal
- `[Claude-Code-buildable ✅]` badge (only if `isBuildable`)
- Primary CTA: "Generate App Concept" (if no concept) or "View Concept" (if concept exists)
- Secondary CTA: "View Evidence"

**Zone 3: All Pain Patterns**

`PatternTable` — sortable, filterable table.

Columns: Pattern · Signals · Sources · Last detected · Score · Status · Actions

Filters (pill strip): source, date range, status, "Buildable only" (default ON)

Sort options: score (default), signal count, recency, source diversity

### `ConceptView.jsx`

Slides in as a full-width panel below the triggering card — pushes content down, not a modal. Keeps radar context visible. Sections rendered top-to-bottom matching the generation schema. Each narrative section has a copy icon.

- Hero action: **"Copy Claude Code Prompt"** (full-width, prominent)
- Secondary: "Export as Markdown", "Save as Note", "Archive"
- Template-generated: `⚡ Generated from signals` badge
- Ollama-generated: `✦ AI-enhanced` badge

### `EvidencePanel.jsx`

Right-side drawer. All signals for a cluster grouped by source. Each signal: pain text, intensity badge, source URL, date, author. Filterable by source and intensity.

---

## Error and degradation behaviour

| Condition | Behaviour |
|---|---|
| Ollama off during concept generation | Full template fallback — concept still generated, `generatedBy: 'template'` |
| Ollama section missing from response | That section falls through to template value, rest of Ollama output used |
| Search source unavailable (Reddit down etc.) | Skip that source, continue with available sources, note in scan summary |
| No signals meet intensity threshold | Empty state with explanation, no clusters formed |
| No clusters meet Top-3 gate | Top-3 zone shows "Not enough validated patterns yet" with signal count progress |
| Re-generate existing concept | Confirmation prompt, then overwrites |

---

## Out of scope for this spec

- Semantic clustering via Ollama embeddings (upgrade path — `IClusterer` interface ready)
- Twitter/X, Product Hunt, G2/Capterra sources (Phase 2 sources)
- User-configurable pain queries
- Notification system for new Top-3 entries
- Scan frequency settings UI
- Success metric tracking (prompts copied, builds reported)
