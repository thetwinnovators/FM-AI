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
    const score = overlap / Math.max(terms.length, 1)
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
    return { marketScore: 0, inferredCategory: null, breakdown: { ...ZERO_BREAKDOWN } }
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
