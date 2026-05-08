# Opportunity Radar — Market Layer Design

**Date:** 2026-05-08  
**Goal:** Add a market intelligence layer to Opportunity Radar so that cluster scoring reflects proven category demand and competitor weakness, not just pain signal volume.  
**Depends on:** `2026-05-05-opportunity-radar-upgrade-design.md` (OpportunitySignal / OpportunityThesis types and multi-score pipeline assumed in place)

---

## What this adds

The existing radar collects pain signals and scores clusters on gap evidence alone. This spec adds two new data inputs:

1. **Apple top charts** — auto-fetched from Apple's public RSS API; top 50 free and top 50 grossing apps per category.
2. **Manually curated winning apps** — user-added records with pricing model, notes on complaints and strengths.

These feed a new `MarketScore` component. The final opportunity score becomes a weighted blend of MarketScore, GapScore, and BuildabilityScore.

---

## Page structure

`OpportunityRadar.jsx` becomes a tabbed container. Three top-level tabs:

| Tab | Content |
|---|---|
| **Signals** | Current content: scan progress, top 3 opportunities, all pain patterns table |
| **Market** | New: Apple top charts (left) + manual winning apps (right) + scoring summary (top) |
| **Ranked Opportunities** | Placeholder — activates once scoring is fully populated |

### Shared header (visible on all tabs)

The existing scan/reset button row is retained but made more informative:

- **Run Scan** button — tooltip or subtext: "Refreshes pain signals and updates opportunity scores"
- **Reset** button — tooltip: "Clears scan results, clusters, and ranking state"
- **Status line** below the buttons:
  ```
  Last scan: 6:14 AM · 214 signals · 18 clusters · market synced for 6 categories
  ```
  Fields: `lastScanAt` (formatted), `totalSignals`, `totalClusters`, `marketSyncedCategories` (count of categories with chart data).

The Market tab's own content area emphasises market tasks. The scan controls belong to the page-level workflow, not the Signals tab specifically.

---

## Market tab layout

### Top — Scoring summary strip

A horizontal bar showing aggregate scores for the current top clusters. Updates live as chart data or winning apps are added or edited.

Displayed fields per top cluster:
- Cluster name (truncated)
- MarketScore (0–100)
- GapScore (0–100)
- BuildabilityScore (0–100)
- TotalOpportunityScore (0–100)

If no clusters qualify yet, the strip shows: "Add market data to start seeing scores."

### Left column (~60%) — Category charts

- **Category pills**: Games · Productivity · Finance · Entertainment · Shopping · Social · Health & Fitness · Utilities
- **Chart type toggle**: Top Free / Top Grossing
- **App list**: compact ranked rows — rank number, app name, publisher. Renders up to 50 rows.
- **Sync status**: "Synced 4 minutes ago" + "Sync now" button. On error: "Last sync failed — showing cached data."
- Charts auto-fetch on first Market tab visit and on demand. Stale data (> 6 hours) shows a warning badge.

### Right column (~40%) — Winning apps

- **"Add app" button** — opens an inline form above the list:
  - Name (text)
  - Category (select — same list as chart pills)
  - Pricing model (select: free / subscription / IAP / mixed / one-time)
  - Notes (textarea — complaints, strengths, context, anything)
- **App cards** — each shows: name, category badge, pricing badge, notes excerpt (2 lines, expandable). Edit and delete icons on hover.
- Empty state: "Add apps you've researched to enrich opportunity scoring."

---

## Data model

### New types (add to `types.ts`)

```ts
export interface CategoryChart {
  category:  string                   // e.g. 'productivity'
  chartType: 'top_free' | 'top_grossing'
  fetchedAt: string                   // ISO timestamp
  apps: Array<{
    rank:      number
    name:      string
    publisher: string
    appId:     string
  }>
}

export interface WinningApp {
  id:           string
  name:         string
  category:     string
  pricingModel: 'free' | 'subscription' | 'iap' | 'mixed' | 'one_time'
  notes:        string    // free-text: complaints, strengths, context
  addedAt:      string
  updatedAt:    string
}
```

### Storage keys (add to `radarStorage.ts`)

| Key | Type | Description |
|---|---|---|
| `fm_radar_charts` | `CategoryChart[]` | Cached Apple RSS results |
| `fm_radar_winning_apps` | `WinningApp[]` | Manually curated apps |

New storage methods:
- `saveCharts(charts: CategoryChart[]): void`
- `loadCharts(): CategoryChart[]`
- `saveWinningApps(apps: WinningApp[]): void`
- `loadWinningApps(): WinningApp[]`

---

## New services

### `appleChartService.ts`

Fetches Apple's public RSS API for a given category and chart type.

**Endpoint pattern:**
```
https://rss.applemarketingtools.com/api/v2/us/apps/{chartType}/{limit}/{category}/apps.json
```
Example: `top-free/50/productivity/apps.json`

**Behaviour:**
- Accepts a list of `{ category, chartType }` pairs.
- Returns `CategoryChart[]`.
- On fetch error, returns cached data from `radarStorage.loadCharts()` for that category. If no cache exists, returns an empty array — never throws.
- Caller is responsible for saving results via `radarStorage.saveCharts()`.

**Category slug mapping** (Apple slugs differ from display names):
```ts
const APPLE_SLUGS: Record<string, string> = {
  'games':           'games',
  'productivity':    'productivity',
  'finance':         'finance',
  'entertainment':   'entertainment',
  'shopping':        'shopping',
  'social':          'social-networking',
  'health-fitness':  'health-fitness',
  'utilities':       'utilities',
}
```

### `marketScorer.ts`

Computes `MarketScore` (0–100) for a cluster given chart and winning app data.

**Category inference:**
Each cluster's top terms are compared against `categoryKeywords.ts` (a static map of category → keyword list). The category with the highest overlap score is selected. If no category scores above a minimum threshold (20% overlap), `MarketScore` returns 0 and the cluster is flagged as `category: 'unmatched'`.

**MarketScore formula:**
```
MarketScore =
  0.35 × CategoryChartPresence    // category has fetched chart data (0 or 100)
  0.25 × ChartRankStrength        // average rank of top 10 apps, normalised (rank 1 = 100, rank 50 = 0)
  0.25 × WinningAppDensity        // count of manually added apps in this category, capped at 5, scaled 0–100
  0.15 × CompetitorWeaknessSignal // fraction of winning apps in this category that have non-empty notes, scaled 0–100
```

Returns `{ marketScore: number; inferredCategory: string | null; breakdown: Record<string, number> }`.

### `categoryKeywords.ts`

Static map used by `marketScorer.ts` for cluster-to-category inference:

```ts
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  productivity: ['task', 'todo', 'note', 'calendar', 'focus', 'plan', 'reminder', 'schedule', 'workflow', 'organize', 'project'],
  finance:      ['budget', 'expense', 'invest', 'bank', 'money', 'payment', 'tax', 'saving', 'crypto', 'wallet', 'transaction'],
  entertainment:['video', 'stream', 'watch', 'movie', 'podcast', 'music', 'media', 'content', 'show', 'episode'],
  shopping:     ['buy', 'shop', 'cart', 'order', 'product', 'store', 'price', 'deal', 'checkout', 'delivery'],
  social:       ['post', 'share', 'follow', 'friend', 'feed', 'chat', 'message', 'community', 'comment', 'profile'],
  games:        ['game', 'play', 'level', 'score', 'multiplayer', 'puzzle', 'quest', 'achievement', 'character'],
  'health-fitness': ['health', 'fitness', 'workout', 'sleep', 'diet', 'calories', 'steps', 'meditation', 'run', 'exercise'],
  utilities:    ['file', 'scan', 'convert', 'compress', 'backup', 'transfer', 'storage', 'password', 'vpn', 'clean'],
}
```

---

## Revised scoring model

`opportunityScorer.ts` gains a new function signature:

```ts
scoreOpportunity(
  cluster:     OpportunityCluster,
  signals:     OpportunitySignal[],
  charts:      CategoryChart[],
  winningApps: WinningApp[],
): {
  gapScore:          number   // 0–100
  marketScore:       number   // 0–100
  buildabilityScore: number   // 0–100
  totalScore:        number   // 0–100
  inferredCategory:  string | null
}
```

**GapScore** (0–100) — normalised from existing logic:
- Signal count, source diversity, recency, avg intensity, high-intensity ratio
- Normalised to 0–100 using observed max values (cap at 100)

**BuildabilityScore** (0–100) — expanded from current boolean:
- `isBuildable` regex filter (35%)
- Saturation penalty inverse (25%)
- Pricing model viability: does any winning app in this category monetise via subscription or IAP? (20%)
- Competitor weakness: does any winning app have notes? (20%)

**Total:**
```
Total = 0.40 × MarketScore + 0.40 × GapScore + 0.20 × BuildabilityScore
```

### Scoring tiers

| Score | Label |
|---|---|
| 80–100 | Strong opportunity |
| 65–79 | Promising |
| 50–64 | Watchlist |
| < 50 | Weak / noisy |

---

## File map

### New files
| Path | Purpose |
|---|---|
| `src/opportunity-radar/services/appleChartService.ts` | Fetches Apple RSS top chart feeds |
| `src/opportunity-radar/services/marketScorer.ts` | Computes MarketScore per cluster |
| `src/opportunity-radar/constants/categoryKeywords.ts` | Static category → keyword map |
| `src/components/opportunity/MarketTab.jsx` | Market tab container (chart panel + winning apps panel) |
| `src/components/opportunity/CategoryChartsPanel.jsx` | Left column: category selector + ranked app list |
| `src/components/opportunity/WinningAppsPanel.jsx` | Right column: add/edit/delete winning app records |
| `src/components/opportunity/ScoringStrip.jsx` | Top bar: per-cluster score breakdown |

### Modified files
| Path | Change |
|---|---|
| `src/opportunity-radar/types.ts` | Add `CategoryChart`, `WinningApp` |
| `src/opportunity-radar/storage/radarStorage.ts` | Add chart + winning app CRUD methods |
| `src/opportunity-radar/services/opportunityScorer.ts` | Revised `scoreOpportunity` signature accepting market data |
| `src/views/OpportunityRadar.jsx` | Tab container; load charts + winning apps; pass to scorer |

---

## Error handling

- **Apple RSS fetch fails:** Use cached chart data; show "Last sync failed — showing cached data" in the chart panel. Never block scoring — a category with no chart data scores 0 on `CategoryChartPresence`.
- **No category match for cluster:** `MarketScore = 0`, `inferredCategory = null`. Cluster still appears in All Patterns table; a "No market data" badge appears on its score row.
- **No winning apps added:** `WinningAppDensity = 0`, `CompetitorWeaknessSignal = 0`. MarketScore is still computable (just lower).

---

## Out of scope for this spec

- Ranked Opportunities tab (placeholder only)
- Android / Google Play chart ingestion
- Category download/revenue aggregate stats (CategoryMarket type from reference schema)
- Automatic winning app suggestions from chart data
