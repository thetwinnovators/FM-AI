# Opportunity Radar — Market Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a market intelligence layer to Opportunity Radar: Apple top-chart feeds (auto-fetched), manually curated winning apps, revised three-component scoring (GapScore + MarketScore + BuildabilityScore), and a tabbed Signals / Market / Ranked UI.

**Architecture:** All market state lives in `OpportunityRadar.jsx` (single source of truth). Pure logic (scoring, fetching) is in TypeScript services. React components are thin and emit callbacks upward. Clusters are re-scored reactively whenever chart or winning-app data changes.

**Tech Stack:** React 19, TypeScript 5, Vite 8, vitest 4 (existing test harness), lucide-react for icons, existing `localStorage + scheduleSync` persistence pattern.

**Depends on:** `2026-05-08-opportunity-radar-market-layer-design.md` spec.

---

## File Map

| Path | Status | Responsibility |
|---|---|---|
| `src/opportunity-radar/types.ts` | **Modify** | Add `CategoryChart`, `WinningApp`; extend `OpportunityCluster` with score fields |
| `src/opportunity-radar/storage/radarStorage.ts` | **Modify** | Add chart + winning app CRUD methods |
| `src/opportunity-radar/constants/categoryKeywords.ts` | **Create** | Static category → keyword map used by marketScorer |
| `src/opportunity-radar/services/appleChartService.ts` | **Create** | Fetch Apple RSS feeds; fall back to cache on error |
| `src/opportunity-radar/services/marketScorer.ts` | **Create** | Category inference + MarketScore formula |
| `src/opportunity-radar/services/opportunityScorer.ts` | **Modify** | Add `scoreOpportunity()` wrapping all three score components |
| `src/opportunity-radar/services/__tests__/appleChartService.test.ts` | **Create** | Unit tests for chart fetching + fallback |
| `src/opportunity-radar/services/__tests__/marketScorer.test.ts` | **Create** | Unit tests for `inferCategory` + `computeMarketScore` |
| `src/opportunity-radar/services/__tests__/opportunityScorer.test.ts` | **Modify** | Add tests for `scoreOpportunity()` |
| `src/components/opportunity/ScoringStrip.jsx` | **Create** | Horizontal strip showing per-cluster score breakdowns |
| `src/components/opportunity/CategoryChartsPanel.jsx` | **Create** | Apple top-charts panel: category pills, app list, sync button |
| `src/components/opportunity/WinningAppsPanel.jsx` | **Create** | Manual winning apps: add/edit/delete form + card list |
| `src/components/opportunity/MarketTab.jsx` | **Create** | Market tab container: ScoringStrip + two panels |
| `src/views/OpportunityRadar.jsx` | **Modify** | Tab nav, load charts/winningApps, rescore hook, status line |

---

## Task 1: Extend `types.ts`

**Files:**
- Modify: `src/opportunity-radar/types.ts`

- [ ] **Step 1: Add `CategoryChart` and `WinningApp` interfaces after `RadarScanMeta`**

```ts
export interface CategoryChart {
  category:  string                    // e.g. 'productivity'
  chartType: 'top_free' | 'top_grossing'
  fetchedAt: string                    // ISO timestamp
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
  notes:        string   // free-text: complaints, strengths, context
  addedAt:      string
  updatedAt:    string
}
```

- [ ] **Step 2: Extend `OpportunityCluster` with optional score storage fields**

Append these four optional fields inside the `OpportunityCluster` interface, after `aiRejectionReason?`:

```ts
  // Market-layer scoring — populated by scoreOpportunity(); undefined until first scored
  gapScore?:          number
  marketScore?:       number
  buildabilityScore?: number
  inferredCategory?:  string | null
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (new fields are optional so existing code is unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/opportunity-radar/types.ts
git commit -m "feat(radar): add CategoryChart, WinningApp types; extend OpportunityCluster with score fields"
```

---

## Task 2: Extend `radarStorage.ts`

**Files:**
- Modify: `src/opportunity-radar/storage/radarStorage.ts`

- [ ] **Step 1: Add `charts` and `winningApps` to the KEYS constant**

Change the KEYS block to:

```ts
const KEYS = {
  signals:     'fm_radar_signals',
  clusters:    'fm_radar_clusters',
  concepts:    'fm_radar_concepts',
  meta:        'fm_radar_meta',
  charts:      'fm_radar_charts',
  winningApps: 'fm_radar_winning_apps',
} as const
```

- [ ] **Step 2: Add chart and winning app imports to the type import line**

```ts
import type { PainSignal, OpportunityCluster, AppConcept, RadarScanMeta, CategoryChart, WinningApp } from '../types.js'
```

- [ ] **Step 3: Add chart CRUD functions — paste after the `// ── Meta` block**

```ts
// ── Charts ───────────────────────────────────────────────────────────────────

export function loadCharts(): CategoryChart[] {
  return read<CategoryChart[]>(KEYS.charts, [])
}

export function saveCharts(charts: CategoryChart[]): void {
  write(KEYS.charts, charts)
  scheduleSync()
}

// ── Winning apps ─────────────────────────────────────────────────────────────

export function loadWinningApps(): WinningApp[] {
  return read<WinningApp[]>(KEYS.winningApps, [])
}

export function saveWinningApps(apps: WinningApp[]): void {
  write(KEYS.winningApps, apps)
  scheduleSync()
}
```

- [ ] **Step 4: Update `scheduleSync` to include market data in the disk snapshot**

Replace the `base.radar = { ... }` block inside `scheduleSync`:

```ts
      base.radar = {
        signals:     read<PainSignal[]>(KEYS.signals,  []),
        clusters:    read<OpportunityCluster[]>(KEYS.clusters, []),
        concepts:    read<AppConcept[]>(KEYS.concepts, []),
        meta:        read<RadarScanMeta>(KEYS.meta, { lastScanAt: null, totalSignals: 0, totalClusters: 0 }),
        charts:      read<CategoryChart[]>(KEYS.charts, []),
        winningApps: read<WinningApp[]>(KEYS.winningApps, []),
      }
```

- [ ] **Step 5: Add new methods to the default export object**

```ts
const radarStorage = {
  loadSignals, saveSignals, appendSignals,
  loadClusters, saveClusters,
  loadConcepts, saveConcept, getConceptByClusterId,
  loadMeta, saveMeta,
  loadCharts, saveCharts,
  loadWinningApps, saveWinningApps,
  clearAll,
}
```

- [ ] **Step 6: Verify compilation**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/opportunity-radar/storage/radarStorage.ts
git commit -m "feat(radar): add chart + winning app storage methods"
```

---

## Task 3: Create `categoryKeywords.ts`

**Files:**
- Create: `src/opportunity-radar/constants/categoryKeywords.ts`

- [ ] **Step 1: Create the file**

```ts
/**
 * Static map used by marketScorer.ts to infer which app store category a
 * cluster belongs to. Keys match the category slugs used in the Market tab.
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  productivity:     ['task', 'todo', 'note', 'calendar', 'focus', 'plan', 'reminder', 'schedule', 'workflow', 'organize', 'project'],
  finance:          ['budget', 'expense', 'invest', 'bank', 'money', 'payment', 'tax', 'saving', 'crypto', 'wallet', 'transaction'],
  entertainment:    ['video', 'stream', 'watch', 'movie', 'podcast', 'music', 'media', 'content', 'show', 'episode'],
  shopping:         ['buy', 'shop', 'cart', 'order', 'product', 'store', 'price', 'deal', 'checkout', 'delivery'],
  social:           ['post', 'share', 'follow', 'friend', 'feed', 'chat', 'message', 'community', 'comment', 'profile'],
  games:            ['game', 'play', 'level', 'score', 'multiplayer', 'puzzle', 'quest', 'achievement', 'character'],
  'health-fitness': ['health', 'fitness', 'workout', 'sleep', 'diet', 'calories', 'steps', 'meditation', 'run', 'exercise'],
  utilities:        ['file', 'scan', 'convert', 'compress', 'backup', 'transfer', 'storage', 'password', 'vpn', 'clean'],
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/opportunity-radar/constants/categoryKeywords.ts
git commit -m "feat(radar): add categoryKeywords static map"
```

---

## Task 4: Create `appleChartService.ts` + tests

**Files:**
- Create: `src/opportunity-radar/services/appleChartService.ts`
- Create: `src/opportunity-radar/services/__tests__/appleChartService.test.ts`

- [ ] **Step 1: Write the failing tests first**

```ts
// src/opportunity-radar/services/__tests__/appleChartService.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchCharts } from '../appleChartService.js'
import type { CategoryChart } from '../../types.js'

// Minimal Apple RSS API response shape
function makeAppleResponse(names: string[]): unknown {
  return {
    feed: {
      results: names.map((name, i) => ({
        name,
        artistName: `Publisher ${i}`,
        id: `app_${i}`,
      })),
    },
  }
}

afterEach(() => { vi.restoreAllMocks() })

describe('fetchCharts', () => {
  it('parses Apple RSS response into CategoryChart records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeAppleResponse(['App A', 'App B', 'App C']),
    }))

    const results = await fetchCharts([{ category: 'productivity', chartType: 'top_free' }])

    expect(results).toHaveLength(1)
    expect(results[0].category).toBe('productivity')
    expect(results[0].chartType).toBe('top_free')
    expect(results[0].apps).toHaveLength(3)
    expect(results[0].apps[0]).toEqual({ rank: 1, name: 'App A', publisher: 'Publisher 0', appId: 'app_0' })
    expect(results[0].fetchedAt).toBeTruthy()
  })

  it('falls back to cached data when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    // Inject a pre-existing cache entry via the storage mock
    const cached: CategoryChart = {
      category: 'productivity',
      chartType: 'top_free',
      fetchedAt: '2026-01-01T00:00:00Z',
      apps: [{ rank: 1, name: 'Cached App', publisher: 'X', appId: 'x1' }],
    }
    vi.mock('../../storage/radarStorage.js', () => ({
      loadCharts: () => [cached],
      saveCharts: vi.fn(),
    }))

    const results = await fetchCharts([{ category: 'productivity', chartType: 'top_free' }])
    expect(results).toHaveLength(1)
    expect(results[0].apps[0].name).toBe('Cached App')
  })

  it('returns empty array when fetch fails and no cache exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    vi.mock('../../storage/radarStorage.js', () => ({
      loadCharts: () => [],
      saveCharts: vi.fn(),
    }))

    const results = await fetchCharts([{ category: 'finance', chartType: 'top_grossing' }])
    expect(results).toHaveLength(0)
  })

  it('hits the correct Apple RSS URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeAppleResponse(['App']),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchCharts([{ category: 'social', chartType: 'top_grossing' }])

    const calledUrl = mockFetch.mock.calls[0][0]
    expect(calledUrl).toContain('top-grossing')
    expect(calledUrl).toContain('social-networking')  // Apple slug mapping
    expect(calledUrl).toContain('50')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/opportunity-radar/services/__tests__/appleChartService.test.ts
```

Expected: FAIL — `appleChartService.js` doesn't exist yet.

- [ ] **Step 3: Implement `appleChartService.ts`**

```ts
// src/opportunity-radar/services/appleChartService.ts
import type { CategoryChart } from '../types.js'
import { loadCharts } from '../storage/radarStorage.js'

// Chart type slug as used in Apple's URL
const CHART_TYPE_SLUG: Record<string, string> = {
  top_free:     'top-free',
  top_grossing: 'top-grossing',
}

// Apple category slugs differ from our display slugs
const APPLE_SLUGS: Record<string, string> = {
  'games':          'games',
  'productivity':   'productivity',
  'finance':        'finance',
  'entertainment':  'entertainment',
  'shopping':       'shopping',
  'social':         'social-networking',
  'health-fitness': 'health-fitness',
  'utilities':      'utilities',
}

interface FetchRequest {
  category:  string
  chartType: 'top_free' | 'top_grossing'
}

async function fetchSingleChart(
  category: string,
  chartType: 'top_free' | 'top_grossing',
  limit = 50,
): Promise<CategoryChart | null> {
  const categorySlug = APPLE_SLUGS[category]
  const chartSlug    = CHART_TYPE_SLUG[chartType]
  if (!categorySlug || !chartSlug) return null

  const url =
    `https://rss.applemarketingtools.com/api/v2/us/apps/${chartSlug}/${limit}/${categorySlug}/apps.json`

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json() as { feed?: { results?: Record<string, string>[] } }
    const results = data?.feed?.results ?? []

    const apps = results.slice(0, limit).map((item, idx) => ({
      rank:      idx + 1,
      name:      String(item.name      ?? ''),
      publisher: String(item.artistName ?? ''),
      appId:     String(item.id        ?? ''),
    }))

    return { category, chartType, fetchedAt: new Date().toISOString(), apps }
  } catch {
    return null
  }
}

/**
 * Fetch Apple RSS top-chart feeds for the given category/chartType pairs.
 * On fetch failure, returns cached data for that pair (or nothing if no cache).
 * Never throws.
 *
 * Caller is responsible for persisting results via radarStorage.saveCharts().
 */
export async function fetchCharts(requests: FetchRequest[]): Promise<CategoryChart[]> {
  const cached  = loadCharts()
  const results: CategoryChart[] = []

  for (const req of requests) {
    const chart = await fetchSingleChart(req.category, req.chartType)
    if (chart) {
      results.push(chart)
    } else {
      const fallback = cached.find(
        (c) => c.category === req.category && c.chartType === req.chartType,
      )
      if (fallback) results.push(fallback)
    }
  }

  return results
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/opportunity-radar/services/__tests__/appleChartService.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/opportunity-radar/services/appleChartService.ts src/opportunity-radar/services/__tests__/appleChartService.test.ts
git commit -m "feat(radar): add appleChartService with cache fallback"
```

---

## Task 5: Create `marketScorer.ts` + tests

**Files:**
- Create: `src/opportunity-radar/services/marketScorer.ts`
- Create: `src/opportunity-radar/services/__tests__/marketScorer.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/opportunity-radar/services/__tests__/marketScorer.test.ts
import { describe, it, expect } from 'vitest'
import { inferCategory, computeMarketScore } from '../marketScorer.js'
import type { OpportunityCluster, CategoryChart, WinningApp } from '../../types.js'

function makeCluster(terms: Record<string, number> = {}): OpportunityCluster {
  const now = new Date().toISOString()
  return {
    id: 'c1', clusterName: 'test', painTheme: 'workflow',
    signalIds: [], signalCount: 10, sourceDiversity: 2,
    avgIntensity: 5, firstDetected: now, lastDetected: now,
    termFrequency: terms, opportunityScore: 0, isBuildable: true,
    status: 'emerging', createdAt: now, updatedAt: now,
  }
}

function makeChart(category: string, rankCount = 10): CategoryChart {
  return {
    category, chartType: 'top_free', fetchedAt: new Date().toISOString(),
    apps: Array.from({ length: rankCount }, (_, i) => ({
      rank: i + 1, name: `App ${i}`, publisher: 'Pub', appId: `app${i}`,
    })),
  }
}

function makeWinningApp(category: string, pricingModel: WinningApp['pricingModel'] = 'free', notes = ''): WinningApp {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), name: 'TestApp', category, pricingModel, notes, addedAt: now, updatedAt: now }
}

// ── inferCategory ─────────────────────────────────────────────────────────────

describe('inferCategory', () => {
  it('infers productivity from task/todo terms', () => {
    const c = makeCluster({ task: 5, todo: 4, organize: 3 })
    expect(inferCategory(c)).toBe('productivity')
  })

  it('infers finance from budget/expense terms', () => {
    const c = makeCluster({ budget: 6, expense: 5, tax: 2 })
    expect(inferCategory(c)).toBe('finance')
  })

  it('returns null when no category exceeds 20% keyword overlap', () => {
    const c = makeCluster({ random: 5, irrelevant: 3 })
    expect(inferCategory(c)).toBeNull()
  })

  it('picks the category with the highest overlap', () => {
    // social has more matching terms than productivity here
    const c = makeCluster({ post: 4, share: 3, follow: 2, friend: 2, task: 1 })
    expect(inferCategory(c)).toBe('social')
  })
})

// ── computeMarketScore ────────────────────────────────────────────────────────

describe('computeMarketScore', () => {
  it('returns marketScore=0 and no inferredCategory when terms are unrecognised', () => {
    const c = makeCluster({ foo: 1, bar: 1 })
    const result = computeMarketScore(c, [], [])
    expect(result.marketScore).toBe(0)
    expect(result.inferredCategory).toBeNull()
  })

  it('awards CategoryChartPresence=100 when charts exist for the inferred category', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const chart = makeChart('productivity')
    const result = computeMarketScore(c, [chart], [])
    expect(result.breakdown.categoryChartPresence).toBe(100)
  })

  it('awards CategoryChartPresence=0 when no charts exist for the inferred category', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const result = computeMarketScore(c, [], [])  // no charts at all
    expect(result.breakdown.categoryChartPresence).toBe(0)
  })

  it('WinningAppDensity scales with number of apps (cap at 5)', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const apps = Array.from({ length: 3 }, () => makeWinningApp('productivity'))
    const result = computeMarketScore(c, [], apps)
    // 3/5 * 100 = 60
    expect(result.breakdown.winningAppDensity).toBe(60)
  })

  it('WinningAppDensity caps at 100 with 5+ apps', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const apps = Array.from({ length: 7 }, () => makeWinningApp('productivity'))
    const result = computeMarketScore(c, [], apps)
    expect(result.breakdown.winningAppDensity).toBe(100)
  })

  it('CompetitorWeaknessSignal is fraction of apps with non-empty notes', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const apps = [
      makeWinningApp('productivity', 'free', 'has complaints'),
      makeWinningApp('productivity', 'free', ''),
    ]
    const result = computeMarketScore(c, [], apps)
    expect(result.breakdown.competitorWeakness).toBe(50) // 1/2 = 50%
  })

  it('total marketScore is weighted blend of four components', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const chart = makeChart('productivity')
    const apps  = Array.from({ length: 5 }, () => makeWinningApp('productivity', 'subscription', 'some notes'))
    const result = computeMarketScore(c, [chart], apps)

    const expected = Math.round(
      0.35 * result.breakdown.categoryChartPresence +
      0.25 * result.breakdown.chartRankStrength +
      0.25 * result.breakdown.winningAppDensity +
      0.15 * result.breakdown.competitorWeakness,
    )
    expect(result.marketScore).toBe(expected)
    expect(result.marketScore).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/opportunity-radar/services/__tests__/marketScorer.test.ts
```

Expected: FAIL — `marketScorer.js` doesn't exist yet.

- [ ] **Step 3: Implement `marketScorer.ts`**

```ts
// src/opportunity-radar/services/marketScorer.ts
import { CATEGORY_KEYWORDS } from '../constants/categoryKeywords.js'
import type { OpportunityCluster, CategoryChart, WinningApp } from '../types.js'

const CATEGORY_MATCH_THRESHOLD = 0.20

/**
 * Infer the most likely App Store category for a cluster based on keyword overlap.
 * Returns null when no category reaches the 20% overlap threshold.
 */
export function inferCategory(cluster: OpportunityCluster): string | null {
  const terms = Object.keys(cluster.termFrequency).map((t) => t.toLowerCase())
  let bestCategory: string | null = null
  let bestScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const overlap = keywords.filter((kw) =>
      terms.some((t) => t.includes(kw) || kw.includes(t)),
    ).length
    const score = overlap / Math.max(keywords.length, 1)
    if (score > bestScore) { bestScore = score; bestCategory = category }
  }

  return bestScore >= CATEGORY_MATCH_THRESHOLD ? bestCategory : null
}

export interface MarketScoreResult {
  marketScore:      number
  inferredCategory: string | null
  breakdown: {
    categoryChartPresence: number
    chartRankStrength:     number
    winningAppDensity:     number
    competitorWeakness:    number
  }
}

const ZERO_BREAKDOWN = { categoryChartPresence: 0, chartRankStrength: 0, winningAppDensity: 0, competitorWeakness: 0 }

/**
 * Compute MarketScore (0–100) for a cluster given available chart and winning-app data.
 *
 * Formula:
 *   0.35 × CategoryChartPresence  (0 or 100)
 *   0.25 × ChartRankStrength      (rank 1 = 100, rank 50 = 0, based on top-10 apps)
 *   0.25 × WinningAppDensity      (count of apps in category, capped at 5, scaled 0–100)
 *   0.15 × CompetitorWeaknessSignal (fraction of apps with non-empty notes, 0–100)
 */
export function computeMarketScore(
  cluster: OpportunityCluster,
  charts: CategoryChart[],
  winningApps: WinningApp[],
): MarketScoreResult {
  const inferredCategory = inferCategory(cluster)

  if (!inferredCategory) {
    return { marketScore: 0, inferredCategory: null, breakdown: ZERO_BREAKDOWN }
  }

  // 1. CategoryChartPresence: does this category have any fetched chart data?
  const categoryCharts = charts.filter((c) => c.category === inferredCategory)
  const categoryChartPresence = categoryCharts.length > 0 ? 100 : 0

  // 2. ChartRankStrength: average rank of first 10 apps in the first available chart,
  //    normalised so rank 1 = 100 and rank 50 = 0.
  let chartRankStrength = 0
  if (categoryCharts.length > 0) {
    const topApps = categoryCharts[0].apps.slice(0, 10)
    if (topApps.length > 0) {
      const avgRank = topApps.reduce((sum, a) => sum + a.rank, 0) / topApps.length
      chartRankStrength = Math.max(0, Math.round(((50 - avgRank) / 49) * 100))
    }
  }

  // 3. WinningAppDensity: manually added apps in this category, capped at 5.
  const appsInCategory  = winningApps.filter((a) => a.category === inferredCategory)
  const winningAppDensity = Math.min(100, Math.round((Math.min(appsInCategory.length, 5) / 5) * 100))

  // 4. CompetitorWeaknessSignal: fraction of category apps with non-empty notes.
  const appsWithNotes     = appsInCategory.filter((a) => a.notes.trim().length > 0)
  const competitorWeakness = appsInCategory.length === 0
    ? 0
    : Math.round((appsWithNotes.length / appsInCategory.length) * 100)

  const marketScore = Math.round(
    0.35 * categoryChartPresence +
    0.25 * chartRankStrength +
    0.25 * winningAppDensity +
    0.15 * competitorWeakness,
  )

  return {
    marketScore,
    inferredCategory,
    breakdown: { categoryChartPresence, chartRankStrength, winningAppDensity, competitorWeakness },
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/opportunity-radar/services/__tests__/marketScorer.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/opportunity-radar/services/marketScorer.ts src/opportunity-radar/services/__tests__/marketScorer.test.ts
git commit -m "feat(radar): add marketScorer — category inference + MarketScore formula"
```

---

## Task 6: Add `scoreOpportunity()` to `opportunityScorer.ts`

**Files:**
- Modify: `src/opportunity-radar/services/opportunityScorer.ts`
- Modify: `src/opportunity-radar/services/__tests__/opportunityScorer.test.ts`

- [ ] **Step 1: Append the new test cases to the existing test file**

Add this block at the end of `opportunityScorer.test.ts` (after the existing `getTop3` describe block):

```ts
import { scoreOpportunity } from '../opportunityScorer.js'
import type { CategoryChart, WinningApp } from '../../types.js'

function makeChart(category: string): CategoryChart {
  return {
    category, chartType: 'top_free', fetchedAt: new Date().toISOString(),
    apps: Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, name: `App ${i}`, publisher: 'Pub', appId: `a${i}` })),
  }
}

function makeWinningApp(category: string, pricing: WinningApp['pricingModel'] = 'subscription', notes = 'complaints here'): WinningApp {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), name: 'App', category, pricingModel: pricing, notes, addedAt: now, updatedAt: now }
}

describe('scoreOpportunity', () => {
  it('returns a totalScore between 0 and 100', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    const result = scoreOpportunity(c, signals, [], [])
    expect(result.totalScore).toBeGreaterThanOrEqual(0)
    expect(result.totalScore).toBeLessThanOrEqual(100)
  })

  it('totalScore = 0.40*market + 0.40*gap + 0.20*buildability', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    const result = scoreOpportunity(c, signals, [], [])
    const expected = Math.round(0.40 * result.marketScore + 0.40 * result.gapScore + 0.20 * result.buildabilityScore)
    expect(result.totalScore).toBe(expected)
  })

  it('marketScore increases when chart data is provided for the inferred category', () => {
    // Use a cluster with productivity terms so inferCategory returns 'productivity'
    const c = makeCluster({ termFrequency: { task: 8, todo: 6, organize: 4, plan: 3 } })
    const signals = makeSignals(c)
    const withoutMarket = scoreOpportunity(c, signals, [], [])
    const chart = makeChart('productivity')
    const withMarket = scoreOpportunity(c, signals, [chart], [])
    expect(withMarket.marketScore).toBeGreaterThan(withoutMarket.marketScore)
  })

  it('buildabilityScore is 100 for a buildable, non-saturated cluster with paid apps and notes', () => {
    const c = makeCluster({ termFrequency: { task: 8, todo: 6, organize: 4, plan: 3 } })
    const signals = makeSignals(c)
    const apps = [makeWinningApp('productivity')]
    const result = scoreOpportunity(c, signals, [], apps)
    expect(result.buildabilityScore).toBe(100)
  })

  it('buildabilityScore loses 35 points for unbuildable cluster', () => {
    const c = makeCluster({ termFrequency: { 'multi-user': 5, admin: 3, oauth: 2 } })
    const signals = makeSignals(c)
    const apps = [makeWinningApp('productivity')]
    const result = scoreOpportunity(c, signals, [], apps)
    // unbuildable = no isBuildable regex pass → loses 35 pts; 100 - 35 = 65 max
    expect(result.buildabilityScore).toBeLessThanOrEqual(65)
  })
})
```

- [ ] **Step 2: Run tests — verify the new tests fail**

```bash
npx vitest run src/opportunity-radar/services/__tests__/opportunityScorer.test.ts
```

Expected: existing tests pass, new `scoreOpportunity` tests fail with "not a function".

- [ ] **Step 3: Add the imports and `scoreOpportunity` function to `opportunityScorer.ts`**

Add at the top of the file (after existing imports):

```ts
import type { CategoryChart, WinningApp } from '../types.js'
import { computeMarketScore } from './marketScorer.js'
```

Add this function at the end of the file (after `getTop3`):

```ts
/**
 * Unified opportunity score for a cluster incorporating market data.
 * Replaces the raw `scoreCluster` call in the scan pipeline and rescore hook.
 *
 *   Total = 0.40 × MarketScore + 0.40 × GapScore + 0.20 × BuildabilityScore
 */
export function scoreOpportunity(
  cluster:     OpportunityCluster,
  signals:     PainSignal[],
  charts:      CategoryChart[],
  winningApps: WinningApp[],
): {
  gapScore:          number
  marketScore:       number
  buildabilityScore: number
  totalScore:        number
  inferredCategory:  string | null
} {
  // GapScore: normalise the raw cluster score to 0–100 (raw rarely exceeds 100)
  const rawGap  = scoreCluster(cluster, signals)
  const gapScore = Math.min(100, rawGap)

  // MarketScore + inferredCategory
  const { marketScore, inferredCategory } = computeMarketScore(cluster, charts, winningApps)

  // BuildabilityScore (0–100) composed of four binary factors
  const isBuildable  = applyBuildabilityFilter(cluster, signals)
  const notSaturated = !SATURATION_REGEX.test(Object.keys(cluster.termFrequency).join(' '))

  const appsInCategory = inferredCategory
    ? winningApps.filter((a) => a.category === inferredCategory)
    : []
  const hasPaidPricing   = appsInCategory.some(
    (a) => a.pricingModel === 'subscription' || a.pricingModel === 'iap',
  )
  const hasCompetitorNotes = appsInCategory.some((a) => a.notes.trim().length > 0)

  const buildabilityScore = (isBuildable      ? 35 : 0)
                          + (notSaturated      ? 25 : 0)
                          + (hasPaidPricing    ? 20 : 0)
                          + (hasCompetitorNotes ? 20 : 0)

  const totalScore = Math.round(
    0.40 * marketScore +
    0.40 * gapScore +
    0.20 * buildabilityScore,
  )

  return { gapScore, marketScore, buildabilityScore, totalScore, inferredCategory }
}
```

Note: `SATURATION_REGEX` is already declared at the top of `opportunityScorer.ts` — no need to re-declare.

- [ ] **Step 4: Run the full test suite — all tests should pass**

```bash
npx vitest run src/opportunity-radar/services/__tests__/opportunityScorer.test.ts
```

Expected: all tests (old + new) pass.

- [ ] **Step 5: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/opportunity-radar/services/opportunityScorer.ts src/opportunity-radar/services/__tests__/opportunityScorer.test.ts
git commit -m "feat(radar): add scoreOpportunity() — three-component scoring with market data"
```

---

## Task 7: Create `ScoringStrip.jsx`

**Files:**
- Create: `src/components/opportunity/ScoringStrip.jsx`

Manual verification: open the Market tab with clusters present and confirm score cards render correctly.

- [ ] **Step 1: Create the file**

```jsx
// src/components/opportunity/ScoringStrip.jsx

function truncate(str, maxLen) {
  if (!str) return ''
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '…'
}

function MiniScoreRow({ label, value, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

/**
 * Horizontal strip showing per-cluster score breakdowns for the top 5 clusters.
 * Props:
 *   clusters — OpportunityCluster[] (all clusters; component picks top 5 by opportunityScore)
 */
export default function ScoringStrip({ clusters = [] }) {
  const top5 = [...clusters]
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
    .slice(0, 5)

  if (top5.length === 0) {
    return (
      <div style={{
        padding: '12px 16px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        color: 'rgba(255,255,255,0.30)',
        fontSize: 13,
        textAlign: 'center',
      }}>
        Add market data to start seeing scores.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
      {top5.map((c) => {
        const total = c.opportunityScore  ?? 0
        const gap   = c.gapScore          ?? 0
        const mkt   = c.marketScore       ?? 0
        const bld   = c.buildabilityScore ?? 0

        // Tier label
        const tier =
          total >= 80 ? { label: 'Strong',    color: '#10b981' } :
          total >= 65 ? { label: 'Promising', color: '#6366f1' } :
          total >= 50 ? { label: 'Watchlist', color: '#f59e0b' } :
                        { label: 'Weak',      color: 'rgba(255,255,255,0.25)' }

        return (
          <div
            key={c.id}
            style={{
              flexShrink: 0,
              width: 180,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            {/* Cluster name + total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3, flex: 1, marginRight: 6 }}>
                {truncate(c.clusterName, 28)}
              </p>
              <span style={{
                flexShrink: 0,
                fontSize: 18,
                fontWeight: 700,
                color: tier.color,
                lineHeight: 1,
              }}>
                {total}
              </span>
            </div>

            {/* Tier badge */}
            <div style={{ marginBottom: 10 }}>
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: tier.color,
                background: `${tier.color}18`,
                border: `1px solid ${tier.color}30`,
                borderRadius: 4,
                padding: '2px 5px',
              }}>
                {tier.label}
              </span>
            </div>

            {/* Score bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <MiniScoreRow label="Market" value={mkt} color="#0d9488" />
              <MiniScoreRow label="Gap"    value={gap} color="#6366f1" />
              <MiniScoreRow label="Build"  value={bld} color="#f59e0b" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/opportunity/ScoringStrip.jsx
git commit -m "feat(radar): add ScoringStrip component"
```

---

## Task 8: Create `CategoryChartsPanel.jsx`

**Files:**
- Create: `src/components/opportunity/CategoryChartsPanel.jsx`

Manual verification: open Market tab, click a category pill, verify the app list renders. Click "Sync now" and verify the list updates.

- [ ] **Step 1: Create the file**

```jsx
// src/components/opportunity/CategoryChartsPanel.jsx
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { fetchCharts } from '../../opportunity-radar/services/appleChartService.js'
import radarStorage from '../../opportunity-radar/storage/radarStorage.js'

const CATEGORIES = [
  'games', 'productivity', 'finance', 'entertainment',
  'shopping', 'social', 'health-fitness', 'utilities',
]
const CATEGORY_LABELS = {
  'games': 'Games', 'productivity': 'Productivity', 'finance': 'Finance',
  'entertainment': 'Entertainment', 'shopping': 'Shopping', 'social': 'Social',
  'health-fitness': 'Health & Fitness', 'utilities': 'Utilities',
}
const STALE_MS = 6 * 60 * 60 * 1000  // 6 hours

function formatSyncAge(isoTs) {
  if (!isoTs) return null
  const diffMs = Date.now() - new Date(isoTs).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`
  const hrs = Math.floor(diffMs / 3_600_000)
  return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
}

/**
 * Left panel of the Market tab: category pill selector + ranked app list.
 * Props:
 *   onChartsUpdated(charts) — called after a successful sync
 */
export default function CategoryChartsPanel({ onChartsUpdated }) {
  const [activeCategory, setActiveCategory] = useState('productivity')
  const [chartType,      setChartType]      = useState('top_free')
  const [allCharts,      setAllCharts]      = useState(() => radarStorage.loadCharts())
  const [syncing,        setSyncing]        = useState(false)
  const [syncError,      setSyncError]      = useState(false)

  // Derive the currently visible chart from allCharts
  const activeChart = allCharts.find(
    (c) => c.category === activeCategory && c.chartType === chartType,
  )
  const isStale = !activeChart || (Date.now() - new Date(activeChart.fetchedAt).getTime() > STALE_MS)

  // Auto-fetch on first visit if no data for this category + chartType
  useEffect(() => {
    if (!activeChart) { doSync(activeCategory, chartType) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, chartType])

  const doSync = useCallback(async (category, type) => {
    if (syncing) return
    setSyncing(true)
    setSyncError(false)
    try {
      const fetched = await fetchCharts([{ category, chartType: type }])
      if (fetched.length > 0) {
        // Merge fetched chart into allCharts, replacing the same category+type entry
        const merged = [
          ...allCharts.filter((c) => !(c.category === category && c.chartType === type)),
          ...fetched,
        ]
        radarStorage.saveCharts(merged)
        setAllCharts(merged)
        onChartsUpdated?.(merged)
      } else {
        setSyncError(true)
      }
    } catch {
      setSyncError(true)
    } finally {
      setSyncing(false)
    }
  }, [syncing, allCharts, onChartsUpdated])

  const pillStyle = (active) => ({
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid',
    transition: 'all 0.15s',
    background:   active ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.04)',
    color:        active ? '#5eead4' : 'rgba(255,255,255,0.45)',
    borderColor:  active ? 'rgba(13,148,136,0.35)' : 'rgba(255,255,255,0.09)',
  })

  const toggleStyle = (active) => ({
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background:  active ? 'rgba(255,255,255,0.12)' : 'transparent',
    color:       active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Chart type toggle */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        background: 'rgba(255,255,255,0.05)', borderRadius: 8,
        padding: 3, alignSelf: 'flex-start',
      }}>
        <button style={toggleStyle(chartType === 'top_free')}     onClick={() => setChartType('top_free')}>Top Free</button>
        <button style={toggleStyle(chartType === 'top_grossing')} onClick={() => setChartType('top_grossing')}>Top Grossing</button>
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button key={cat} style={pillStyle(cat === activeCategory)} onClick={() => setActiveCategory(cat)}>
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Sync status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
        {syncError ? (
          <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={11} /> Last sync failed — showing cached data
          </span>
        ) : activeChart ? (
          <span style={{ color: isStale ? '#fbbf24' : 'rgba(255,255,255,0.35)' }}>
            {isStale && '⚠ '}Synced {formatSyncAge(activeChart.fetchedAt)}
          </span>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>No data yet</span>
        )}
        <button
          onClick={() => doSync(activeCategory, chartType)}
          disabled={syncing}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: syncing ? 'default' : 'pointer',
            color: syncing ? 'rgba(255,255,255,0.25)' : '#5eead4',
            fontSize: 11, fontWeight: 600, padding: 0,
          }}
        >
          <RefreshCw size={10} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {/* App list */}
      {activeChart ? (
        <div style={{
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden',
          maxHeight: 420,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
        }}>
          {activeChart.apps.slice(0, 50).map((app) => (
            <div
              key={app.appId}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: app.rank % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
              }}
            >
              <span style={{ width: 26, textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                {app.rank}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.80)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {app.name}
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', margin: 0 }}>
                  {app.publisher}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)',
          padding: '32px 16px', textAlign: 'center',
          color: 'rgba(255,255,255,0.25)', fontSize: 13,
        }}>
          {syncing ? 'Fetching chart data…' : 'No chart data — click Sync now to load.'}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add the spin keyframe** to the global CSS if not already present. Open `src/index.css` and ensure this exists:

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/opportunity/CategoryChartsPanel.jsx src/index.css
git commit -m "feat(radar): add CategoryChartsPanel"
```

---

## Task 9: Create `WinningAppsPanel.jsx`

**Files:**
- Create: `src/components/opportunity/WinningAppsPanel.jsx`

Manual verification: add an app, verify it appears in the list. Edit it, verify changes save. Delete it, verify it is removed.

- [ ] **Step 1: Create the file**

```jsx
// src/components/opportunity/WinningAppsPanel.jsx
import { useState } from 'react'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import radarStorage from '../../opportunity-radar/storage/radarStorage.js'

const CATEGORIES = [
  'games', 'productivity', 'finance', 'entertainment',
  'shopping', 'social', 'health-fitness', 'utilities',
]
const CATEGORY_LABELS = {
  'games': 'Games', 'productivity': 'Productivity', 'finance': 'Finance',
  'entertainment': 'Entertainment', 'shopping': 'Shopping', 'social': 'Social',
  'health-fitness': 'Health & Fitness', 'utilities': 'Utilities',
}
const PRICING_LABELS = {
  free: 'Free', subscription: 'Subscription', iap: 'In-App Purchase',
  mixed: 'Mixed', one_time: 'One-time',
}

const PRICING_COLORS = {
  free: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: 'rgba(100,116,139,0.25)' },
  subscription: { bg: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: 'rgba(99,102,241,0.25)' },
  iap: { bg: 'rgba(245,158,11,0.15)', color: '#fcd34d', border: 'rgba(245,158,11,0.25)' },
  mixed: { bg: 'rgba(20,184,166,0.15)', color: '#5eead4', border: 'rgba(20,184,166,0.25)' },
  one_time: { bg: 'rgba(34,197,94,0.15)', color: '#86efac', border: 'rgba(34,197,94,0.25)' },
}

const EMPTY_FORM = { name: '', category: 'productivity', pricingModel: 'free', notes: '' }

function AppForm({ initial = EMPTY_FORM, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const inputStyle = {
    width: '100%', padding: '6px 10px', borderRadius: 7, fontSize: 12,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.85)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block' }

  return (
    <div style={{
      borderRadius: 10, background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.12)', padding: '14px 14px 12px',
      marginBottom: 12,
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>App Name</label>
          <input style={inputStyle} placeholder="e.g. Notion" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Pricing Model</label>
          <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.pricingModel} onChange={set('pricingModel')}>
            {Object.entries(PRICING_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={labelStyle}>Notes (complaints, strengths, context)</label>
        <textarea
          style={{ ...inputStyle, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="What do users complain about? What does it do well?"
          value={form.notes}
          onChange={set('notes')}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.50)',
        }}>
          <X size={11} /> Cancel
        </button>
        <button onClick={() => form.name.trim() && onSave(form)} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          background: 'rgba(13,148,136,0.20)', border: '1px solid rgba(13,148,136,0.35)', color: '#5eead4',
          opacity: form.name.trim() ? 1 : 0.4,
        }}>
          <Check size={11} /> Save
        </button>
      </div>
    </div>
  )
}

/**
 * Right panel of the Market tab: manually curated winning apps.
 * Props:
 *   onWinningAppsUpdated(apps) — called after any add/edit/delete
 */
export default function WinningAppsPanel({ onWinningAppsUpdated }) {
  const [apps, setApps]           = useState(() => radarStorage.loadWinningApps())
  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState(null)

  function persist(updated) {
    radarStorage.saveWinningApps(updated)
    setApps(updated)
    onWinningAppsUpdated?.(updated)
  }

  function handleAdd(form) {
    const now = new Date().toISOString()
    const newApp = { ...form, id: crypto.randomUUID(), addedAt: now, updatedAt: now }
    persist([...apps, newApp])
    setShowForm(false)
  }

  function handleEdit(id, form) {
    persist(apps.map((a) => a.id === id ? { ...a, ...form, updatedAt: new Date().toISOString() } : a))
    setEditingId(null)
  }

  function handleDelete(id) {
    persist(apps.filter((a) => a.id !== id))
  }

  const pricingBadge = (model) => {
    const c = PRICING_COLORS[model] ?? PRICING_COLORS.free
    return (
      <span style={{
        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        padding: '2px 6px', borderRadius: 4,
        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      }}>
        {PRICING_LABELS[model] ?? model}
      </span>
    )
  }

  const categoryBadge = (cat) => (
    <span style={{
      fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
      padding: '2px 6px', borderRadius: 4,
      background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)',
      border: '1px solid rgba(255,255,255,0.10)',
    }}>
      {CATEGORY_LABELS[cat] ?? cat}
    </span>
  )

  return (
    <div>
      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setEditingId(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.25)', color: '#5eead4',
            marginBottom: 12,
          }}
        >
          <Plus size={12} /> Add app
        </button>
      )}

      {/* Add form */}
      {showForm && (
        <AppForm onSave={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {/* App cards */}
      {apps.length === 0 && !showForm ? (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingTop: 20 }}>
          Add apps you've researched to enrich opportunity scoring.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {apps.map((app) => (
            editingId === app.id ? (
              <AppForm
                key={app.id}
                initial={{ name: app.name, category: app.category, pricingModel: app.pricingModel, notes: app.notes }}
                onSave={(form) => handleEdit(app.id, form)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={app.id}
                className="group"
                style={{
                  borderRadius: 10, padding: '10px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.80)', margin: 0 }}>
                    {app.name}
                  </p>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => { setEditingId(app.id); setShowForm(false) }} title="Edit"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.30)', padding: 2 }}>
                      <Edit2 size={11} />
                    </button>
                    <button onClick={() => handleDelete(app.id)} title="Delete"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.50)', padding: 2 }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, marginBottom: app.notes ? 7 : 0 }}>
                  {categoryBadge(app.category)}
                  {pricingBadge(app.pricingModel)}
                </div>
                {app.notes && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', margin: 0, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {app.notes}
                  </p>
                )}
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/opportunity/WinningAppsPanel.jsx
git commit -m "feat(radar): add WinningAppsPanel — CRUD for manually curated apps"
```

---

## Task 10: Create `MarketTab.jsx`

**Files:**
- Create: `src/components/opportunity/MarketTab.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/components/opportunity/MarketTab.jsx
import ScoringStrip      from './ScoringStrip.jsx'
import CategoryChartsPanel from './CategoryChartsPanel.jsx'
import WinningAppsPanel   from './WinningAppsPanel.jsx'

/**
 * Market tab container. Layout: ScoringStrip on top, CategoryChartsPanel (60%)
 * left and WinningAppsPanel (40%) right.
 *
 * Props:
 *   clusters             — OpportunityCluster[] for the scoring strip
 *   onChartsUpdated(charts)        — bubbled from CategoryChartsPanel
 *   onWinningAppsUpdated(apps)     — bubbled from WinningAppsPanel
 */
export default function MarketTab({ clusters = [], onChartsUpdated, onWinningAppsUpdated }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Scoring summary strip */}
      <section>
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
          Score Summary
        </h3>
        <ScoringStrip clusters={clusters} />
      </section>

      {/* Two-column panel row */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>

        {/* Left: Apple top charts */}
        <section>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
            Apple Top Charts
          </h3>
          <CategoryChartsPanel onChartsUpdated={onChartsUpdated} />
        </section>

        {/* Right: Winning apps */}
        <section>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
            Winning Apps
          </h3>
          <WinningAppsPanel onWinningAppsUpdated={onWinningAppsUpdated} />
        </section>

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/opportunity/MarketTab.jsx
git commit -m "feat(radar): add MarketTab container"
```

---

## Task 11: Update `OpportunityRadar.jsx` — tabs, wiring, rescore

**Files:**
- Modify: `src/views/OpportunityRadar.jsx`

This is the integration task. Replace the current single-zone layout with a tabbed container, wire up the new market state and callbacks, and update the scan pipeline to use `scoreOpportunity`.

- [ ] **Step 1: Replace the entire file with the updated version**

```jsx
// src/views/OpportunityRadar.jsx
import { useState, useEffect, useCallback } from 'react'
import { Radar, Trash2, Play, Loader2 } from 'lucide-react'
import RadarTopCard    from '../components/opportunity/RadarTopCard.jsx'
import PatternTable    from '../components/opportunity/PatternTable.jsx'
import ConceptView     from '../components/opportunity/ConceptView.jsx'
import EvidencePanel   from '../components/opportunity/EvidencePanel.jsx'
import MarketTab       from '../components/opportunity/MarketTab.jsx'
import radarStorage    from '../opportunity-radar/storage/radarStorage.js'
import { runPainSearch }    from '../opportunity-radar/services/painSearchService.js'
import { extractSignals }   from '../opportunity-radar/services/signalExtractor.js'
import { KeywordClusterer } from '../opportunity-radar/services/clusterService.js'
import { applyBuildabilityFilter, scoreOpportunity } from '../opportunity-radar/services/opportunityScorer.js'
import { aiValidateClusters }  from '../opportunity-radar/services/aiOpportunityFilter.js'
import { generateConcept }     from '../opportunity-radar/services/conceptGenerator.js'
import { getTop3 }             from '../opportunity-radar/services/opportunityScorer.js'
import { ALL_SOURCES, SOURCE_LABELS } from '../opportunity-radar/services/painSearchService.js'

const SCAN_STALE_MS = 6 * 60 * 60 * 1000

function formatAge(isoDate) {
  if (!isoDate) return 'Never scanned'
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  const hours  = Math.floor(diffMs / 3_600_000)
  const days   = Math.floor(diffMs / 86_400_000)
  if (mins < 2)   return 'Just now'
  if (mins < 60)  return `${mins} minutes ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}

const TABS = ['signals', 'market', 'ranked']
const TAB_LABELS = { signals: 'Signals', market: 'Market', ranked: 'Ranked Opportunities' }

export default function OpportunityRadar() {
  const [signals,          setSignals]          = useState(() => radarStorage.loadSignals())
  const [clusters,         setClusters]         = useState(() => radarStorage.loadClusters())
  const [concepts,         setConcepts]         = useState(() => radarStorage.loadConcepts())
  const [meta,             setMeta]             = useState(() => radarStorage.loadMeta())
  const [charts,           setCharts]           = useState(() => radarStorage.loadCharts())
  const [winningApps,      setWinningApps]      = useState(() => radarStorage.loadWinningApps())
  const [scanning,         setScanning]         = useState(false)
  const [aiValidating,     setAiValidating]     = useState(false)
  const [progress,         setProgress]         = useState([])
  const [activeConceptId,  setActiveConceptId]  = useState(null)
  const [evidenceClusterId, setEvidenceClusterId] = useState(null)
  const [generatingFor,    setGeneratingFor]    = useState(null)
  const [activeTab,        setActiveTab]        = useState('signals')

  const top3 = getTop3(clusters, signals)

  // Count distinct categories that have chart data
  const marketSyncedCategories = [...new Set(charts.map((c) => c.category))].length

  // ── Rescore all clusters with fresh market data ─────────────────────────────
  const rescoreClusters = useCallback((currentCharts, currentApps) => {
    const allSignals = radarStorage.loadSignals()
    if (allSignals.length === 0) return
    const updated = clusters.map((c) => {
      const scores = scoreOpportunity(c, allSignals, currentCharts, currentApps)
      return {
        ...c,
        isBuildable:       applyBuildabilityFilter(c, allSignals),
        opportunityScore:  scores.totalScore,
        gapScore:          scores.gapScore,
        marketScore:       scores.marketScore,
        buildabilityScore: scores.buildabilityScore,
        inferredCategory:  scores.inferredCategory,
      }
    })
    radarStorage.saveClusters(updated)
    setClusters(updated)
  }, [clusters])

  // ── Market data change callbacks ────────────────────────────────────────────
  const handleChartsUpdated = useCallback((newCharts) => {
    setCharts(newCharts)
    rescoreClusters(newCharts, winningApps)
  }, [rescoreClusters, winningApps])

  const handleWinningAppsUpdated = useCallback((newApps) => {
    setWinningApps(newApps)
    rescoreClusters(charts, newApps)
  }, [rescoreClusters, charts])

  // ── Scan pipeline ───────────────────────────────────────────────────────────
  const triggerScan = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setProgress([])
    const start = Date.now()

    try {
      const rawResults = await runPainSearch(
        ALL_SOURCES,
        (p) => setProgress((prev) => {
          const existing = prev.findIndex((x) => x.source === p.source)
          if (existing >= 0) { const next = [...prev]; next[existing] = p; return next }
          return [...prev, p]
        }),
      )

      const newSignals = extractSignals(rawResults, '')
      radarStorage.appendSignals(newSignals)
      const allSignals = radarStorage.loadSignals()

      const clusterer = new KeywordClusterer()
      const existingClusters = radarStorage.loadClusters()
      const newClusters = clusterer.cluster(allSignals, existingClusters)

      // Load latest market data from storage (may have been synced on Market tab)
      const currentCharts      = radarStorage.loadCharts()
      const currentWinningApps = radarStorage.loadWinningApps()

      const scored = newClusters.map((c) => {
        const isBuildable = applyBuildabilityFilter(c, allSignals)
        const withB = { ...c, isBuildable }
        const scores = scoreOpportunity(withB, allSignals, currentCharts, currentWinningApps)
        return {
          ...withB,
          opportunityScore:  scores.totalScore,
          gapScore:          scores.gapScore,
          marketScore:       scores.marketScore,
          buildabilityScore: scores.buildabilityScore,
          inferredCategory:  scores.inferredCategory,
        }
      })

      setAiValidating(true)
      let validated = scored
      try {
        const validations = await aiValidateClusters(scored, allSignals)
        const validationMap = new Map(validations.map((v) => [v.clusterId, v]))
        validated = scored.map((c) => {
          const v = validationMap.get(c.id)
          return {
            ...c,
            aiValidated:       v ? v.keep : undefined,
            aiRejectionReason: v && !v.keep ? v.reason : undefined,
          }
        })
      } catch (err) {
        console.warn('[OpportunityRadar] AI validation failed, keeping all clusters', err)
      } finally {
        setAiValidating(false)
      }

      radarStorage.saveClusters(validated)
      const newMeta = {
        lastScanAt:     new Date().toISOString(),
        totalSignals:   allSignals.length,
        totalClusters:  scored.length,
        scanDurationMs: Date.now() - start,
      }
      radarStorage.saveMeta(newMeta)

      setSignals(allSignals)
      setClusters(validated)
      setConcepts(radarStorage.loadConcepts())
      setMeta(newMeta)
      setCharts(currentCharts)
    } catch (err) {
      console.error('[OpportunityRadar] scan failed', err)
    } finally {
      setScanning(false)
    }
  }, [scanning])

  // ── On-load freshness check ─────────────────────────────────────────────────
  useEffect(() => {
    const lastScan = meta?.lastScanAt ? new Date(meta.lastScanAt).getTime() : 0
    const isStale  = !meta?.lastScanAt || (Date.now() - lastScan > SCAN_STALE_MS)
    if (isStale) triggerScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reset ───────────────────────────────────────────────────────────────────
  function handleReset() {
    if (!window.confirm('Clear all signals, patterns, and concepts? Market data (charts + winning apps) is preserved.')) return
    radarStorage.clearAll()
    setSignals([])
    setClusters([])
    setConcepts([])
    setMeta(null)
    setProgress([])
    // Note: charts and winningApps are not cleared — they are market data, not scan data
  }

  // ── Concept generation ──────────────────────────────────────────────────────
  const handleGenerateConcept = useCallback(async (clusterId) => {
    const cluster = clusters.find((c) => c.id === clusterId)
    if (!cluster) return
    setGeneratingFor(clusterId)
    try {
      const concept = await generateConcept(cluster, signals)
      radarStorage.saveConcept(concept)
      const updatedClusters = clusters.map((c) =>
        c.id === clusterId ? { ...c, status: 'concept_generated' } : c,
      )
      radarStorage.saveClusters(updatedClusters)
      setClusters(updatedClusters)
      setConcepts(radarStorage.loadConcepts())
      setActiveConceptId(concept.id)
    } finally {
      setGeneratingFor(null)
    }
  }, [clusters, signals])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-4 md:p-6 max-w-7xl mx-auto">

      {/* ── Shared page header ─────────────────────────────────────────────── */}
      <div className="mb-5">
        {/* Title row + controls */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Radar className="w-6 h-6 text-teal-400" />
            <h1 className="text-xl font-semibold">Opportunity Radar</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={scanning}
              title="Clears scan results, clusters, and ranking state"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] text-white/40 border border-white/10
                hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={triggerScan}
              disabled={scanning}
              title="Refreshes pain signals and updates opportunity scores"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-400/20
                hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {scanning ? 'Scanning…' : <><Play className="w-3.5 h-3.5" fill="currentColor" />Run Scan</>}
            </button>
          </div>
        </div>

        {/* Status line */}
        <p className="text-xs text-white/30">
          Last scan: {formatAge(meta?.lastScanAt)}
          {meta?.totalSignals > 0 && (
            <> · <span className="text-teal-400/70">{meta.totalSignals} signals · {meta.totalClusters} clusters</span></>
          )}
          {marketSyncedCategories > 0 && (
            <> · <span className="text-indigo-400/70">market synced for {marketSyncedCategories} {marketSyncedCategories === 1 ? 'category' : 'categories'}</span></>
          )}
        </p>
      </div>

      {/* ── Scan progress ──────────────────────────────────────────────────── */}
      {scanning && (
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-400/70 transition-all duration-500"
                style={{
                  width: `${ALL_SOURCES.length === 0 ? 0 : Math.round(
                    (progress.filter(p => p.status === 'done' || p.status === 'error').length / ALL_SOURCES.length) * 100
                  )}%`
                }}
              />
            </div>
            <span className="text-xs text-white/40 flex-shrink-0">
              {progress.filter(p => p.status === 'done' || p.status === 'error').length} / {ALL_SOURCES.length} sources
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {ALL_SOURCES.map((src) => {
              const p = progress.find(x => x.source === src)
              const status = p?.status ?? 'pending'
              return (
                <span key={src} className={`text-xs px-2 py-1 rounded-full ${
                  status === 'done'    ? 'bg-green-400/10 text-green-400' :
                  status === 'error'  ? 'bg-red-400/10 text-red-400' :
                  status === 'running' ? 'bg-teal-400/10 text-teal-300 animate-pulse' :
                  'bg-white/5 text-white/20'
                }`}>
                  {SOURCE_LABELS[src] ?? src}
                  {status === 'done'    ? ` ✓${p?.resultCount ? ` ${p.resultCount}` : ''}` :
                   status === 'error'   ? ' ✗' :
                   status === 'running' ? ' …' : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {aiValidating && (
        <div className="mb-5 flex items-center gap-2 text-xs text-purple-300/80">
          <Loader2 className="w-3 h-3 animate-spin" />
          AI reviewing patterns for software buildability…
        </div>
      )}

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b border-white/8">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-teal-400'
                : 'text-white/40 hover:text-white/65'
            }`}
            style={activeTab === tab ? { borderBottom: '2px solid #2dd4bf', marginBottom: -1 } : {}}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── Signals tab ────────────────────────────────────────────────────── */}
      {activeTab === 'signals' && (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-medium text-white/40 uppercase tracking-wide mb-3">
              Top Opportunities
            </h2>
            {top3.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-white/30 text-sm">
                {scanning
                  ? 'Scanning for pain patterns…'
                  : `Not enough validated patterns yet. Need ≥ 10 signals, ≥ 2 sources per cluster. ${meta?.totalSignals ?? 0} signals collected so far.`}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3.map((cluster, i) => {
                  const existingConcept = concepts.find((c) => c.clusterId === cluster.id)
                  return (
                    <RadarTopCard
                      key={cluster.id}
                      cluster={cluster}
                      signals={signals.filter((s) => cluster.signalIds.includes(s.id))}
                      rank={i + 1}
                      existingConcept={existingConcept ?? null}
                      generating={generatingFor === cluster.id}
                      onGenerateConcept={() => handleGenerateConcept(cluster.id)}
                      onViewConcept={() => setActiveConceptId(existingConcept?.id ?? null)}
                      onViewEvidence={() => setEvidenceClusterId(
                        evidenceClusterId === cluster.id ? null : cluster.id,
                      )}
                      evidenceOpen={evidenceClusterId === cluster.id}
                    />
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium text-white/40 uppercase tracking-wide mb-3">
              All Pain Patterns
            </h2>
            <PatternTable
              clusters={clusters}
              signals={signals}
              concepts={concepts}
              onGenerateConcept={handleGenerateConcept}
              onViewConcept={(conceptId) => setActiveConceptId(conceptId)}
              onViewEvidence={(clusterId) => setEvidenceClusterId(clusterId)}
              generatingFor={generatingFor}
            />
          </section>
        </>
      )}

      {/* ── Market tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'market' && (
        <MarketTab
          clusters={clusters}
          onChartsUpdated={handleChartsUpdated}
          onWinningAppsUpdated={handleWinningAppsUpdated}
        />
      )}

      {/* ── Ranked Opportunities tab (placeholder) ─────────────────────────── */}
      {activeTab === 'ranked' && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center text-white/25 text-sm">
          <p className="text-lg mb-2">🏆</p>
          <p className="font-medium mb-1">Ranked Opportunities</p>
          <p>Coming soon — activates once scoring is fully populated.</p>
        </div>
      )}

      {/* ── Modals (always rendered, not tab-scoped) ───────────────────────── */}
      {evidenceClusterId && (
        <EvidencePanel
          cluster={clusters.find((c) => c.id === evidenceClusterId)}
          signals={signals.filter((s) =>
            clusters.find((c) => c.id === evidenceClusterId)?.signalIds.includes(s.id),
          )}
          onClose={() => setEvidenceClusterId(null)}
        />
      )}

      {activeConceptId && (
        <ConceptView
          concept={concepts.find((c) => c.id === activeConceptId)}
          onClose={() => setActiveConceptId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Compile check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (existing + new).

- [ ] **Step 4: Manual smoke test in the browser**

```bash
npm run dev
```

Check:
1. Opportunity Radar loads with three tabs: Signals, Market, Ranked Opportunities
2. Status line shows last scan age + signal/cluster counts
3. Signals tab shows Top Opportunities and All Pain Patterns as before
4. Market tab shows ScoringStrip, Apple Top Charts panel (left), Winning Apps panel (right)
5. Clicking a category pill in Charts panel triggers a fetch; app list renders
6. "Sync now" button re-fetches and updates the list
7. Adding a winning app via the form saves it and updates scoring strip scores
8. Deleting an app removes it from the list
9. Ranked Opportunities tab shows a placeholder
10. Reset button clears scan data but NOT market data

- [ ] **Step 5: Commit**

```bash
git add src/views/OpportunityRadar.jsx
git commit -m "feat(radar): tab navigation, market data wiring, rescore on market change, status line"
```

---

## Post-implementation self-review checklist

- [ ] **Spec coverage:** All spec sections (page structure, market tab layout, data model, new services, revised scoring, error handling) are covered by tasks 1–11.
- [ ] **Error handling:** Apple fetch failures fall back to cache (Task 4 `appleChartService.ts`). No-category-match → `MarketScore = 0` (Task 5). No winning apps → `WinningAppDensity = 0` (Task 5). Reset does not clear market data (Task 11 `handleReset`).
- [ ] **Out of scope preserved:** Ranked Opportunities tab is a placeholder only. No Android chart ingestion. No auto-suggest from chart data.
- [ ] **All tests pass:** `npx vitest run` — green across appleChartService, marketScorer, opportunityScorer suites.
