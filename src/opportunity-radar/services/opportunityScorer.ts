import type { OpportunityCluster, PainSignal } from '../types.js'
import type { CategoryChart, WinningApp } from '../types.js'
import { computeMarketScore } from './marketScorer.js'

const BUILDABILITY_REGEX =
  /multi.?user|role.?manag|admin.?panel|real.?time.?collab|payment.?process|video.?stream|iot|bluetooth|hipaa|enterprise.?scale|native.?app|oauth|websocket|backend.?required/i

const SATURATION_REGEX =
  /\b(notion|jira|slack|trello|asana|monday|linear|salesforce|hubspot)\b/i

export function applyBuildabilityFilter(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): boolean {
  const clusterText = Object.keys(cluster.termFrequency).join(' ')
  if (BUILDABILITY_REGEX.test(clusterText)) return false
  for (const s of signals) {
    if (cluster.signalIds.includes(s.id) && BUILDABILITY_REGEX.test(s.painText)) return false
  }
  return true
}

export function scoreCluster(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): number {
  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))

  // Frequency
  let score = cluster.signalCount * 2

  // Source diversity
  score += cluster.sourceDiversity

  // Recency bonus
  const lastMs  = new Date(cluster.lastDetected).getTime()
  const ageMs   = Date.now() - lastMs
  const DAY_MS  = 24 * 60 * 60 * 1000
  if (ageMs < 7 * DAY_MS)  score += 5
  else if (ageMs < 30 * DAY_MS) score += 2

  // Avg intensity
  score += cluster.avgIntensity * 1.5

  // Specificity bonus — ≥3 signals with intensityScore ≥ 7
  const highIntensity = clusterSignals.filter((s) => s.intensityScore >= 7).length
  if (highIntensity >= 3) score += 3

  // Buildability bonus
  if (cluster.isBuildable) score += 5

  // Saturation penalty
  const clusterText = Object.keys(cluster.termFrequency).join(' ')
  if (SATURATION_REGEX.test(clusterText)) score -= 10

  return Math.max(0, score)
}

function qualifies(cluster: OpportunityCluster, signals: PainSignal[]): boolean {
  if (!cluster.isBuildable) return false
  if (cluster.signalCount < 10) return false
  if (cluster.sourceDiversity < 2) return false

  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))
  if (clusterSignals.filter((s) => s.intensityScore >= 7).length < 3) return false

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
  const lastMs = new Date(cluster.lastDetected).getTime()
  if (Date.now() - lastMs > NINETY_DAYS_MS) return false

  return true
}

export function getTop3(
  clusters: OpportunityCluster[],
  signals: PainSignal[],
): OpportunityCluster[] {
  const scored = clusters.map((c) => {
    const isBuildable = applyBuildabilityFilter(c, signals)
    const withBuildable = { ...c, isBuildable }
    return {
      ...withBuildable,
      opportunityScore: scoreCluster(withBuildable, signals),
    }
  })

  return scored
    .filter((c) => qualifies(c, signals))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 3)
}

/**
 * Unified opportunity score for a cluster incorporating market data.
 * Replaces the raw scoreCluster call in the scan pipeline and rescore hook.
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
  const isBuildableForScoring = applyBuildabilityFilter(cluster, signals)
  const clusterForScoring = { ...cluster, isBuildable: isBuildableForScoring }
  const rawGap  = scoreCluster(clusterForScoring, signals)
  const gapScore = Math.min(100, rawGap)

  // MarketScore + inferredCategory
  const { marketScore, inferredCategory } = computeMarketScore(cluster, charts, winningApps)

  // BuildabilityScore (0–100) composed of four binary factors
  const notSaturated = !SATURATION_REGEX.test(Object.keys(cluster.termFrequency).join(' '))

  const appsInCategory = inferredCategory
    ? winningApps.filter((a) => a.category === inferredCategory)
    : []
  const hasPaidPricing   = appsInCategory.some(
    (a) => a.pricingModel === 'subscription' || a.pricingModel === 'iap',
  )
  const hasCompetitorNotes = appsInCategory.some((a) => a.notes.trim().length > 0)

  const buildabilityScore = (isBuildableForScoring ? 35 : 0)
                          + (notSaturated        ? 25 : 0)
                          + (hasPaidPricing      ? 20 : 0)
                          + (hasCompetitorNotes  ? 20 : 0)

  const totalScore = Math.round(
    0.40 * marketScore +
    0.40 * gapScore +
    0.20 * buildabilityScore,
  )

  return { gapScore, marketScore, buildabilityScore, totalScore, inferredCategory }
}
