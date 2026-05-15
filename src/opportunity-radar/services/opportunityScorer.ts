import type { OpportunityCluster, PainSignal, DimensionScores, PainType } from '../types.js'
import type { CategoryChart, WinningApp } from '../types.js'
import { computeMarketScore } from './marketScorer.js'

// ── Anti-pattern detection ────────────────────────────────────────────────────

const BUILDABILITY_REGEX =
  /multi.?user|role.?manag|admin.?panel|real.?time.?collab|payment.?process|video.?stream|iot|bluetooth|hipaa|enterprise.?scale|native.?app|oauth|websocket|backend.?required/i

const SATURATION_REGEX =
  /\b(notion|jira|slack|trello|asana|monday|linear|salesforce|hubspot)\b/i

/**
 * Why-Now: AI/automation momentum keywords that signal a rapidly-changing
 * market and high current interest in the problem space.
 */
const WHY_NOW_RE =
  /\b(ai|llm|gpt|chatgpt|claude|automation|generative|openai|langchain|copilot|agent|embedding|vector)\b/i

// ── Buildability filter ───────────────────────────────────────────────────────

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

// ── Legacy single-score (used by getTop3 for fast display sorting) ────────────

/**
 * Lightweight raw score used only by getTop3() for sorting already-validated
 * clusters at render time. The authoritative score for storage is scoreOpportunity().
 */
export function scoreCluster(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): number {
  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))

  let score = cluster.signalCount * 2
  score += cluster.sourceDiversity

  const lastMs = new Date(cluster.lastDetected).getTime()
  const ageMs  = Date.now() - lastMs
  const DAY_MS = 24 * 60 * 60 * 1000
  if (ageMs < 7 * DAY_MS)  score += 5
  else if (ageMs < 30 * DAY_MS) score += 2

  score += cluster.avgIntensity * 1.5

  const highIntensity = clusterSignals.filter((s) => s.intensityScore >= 7).length
  if (highIntensity >= 3) score += 3
  if (cluster.isBuildable) score += 5

  const clusterText = Object.keys(cluster.termFrequency).join(' ')
  if (SATURATION_REGEX.test(clusterText)) score -= 10

  return Math.max(0, score)
}

// ── Qualification gate ────────────────────────────────────────────────────────

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

// ── 10-Dimension scoring ──────────────────────────────────────────────────────

// Pain-type helper arrays — typed as PainType[] to satisfy the type checker
const URGENCY_PAIN_TYPES: PainType[]    = ['speed', 'workflow']
const FIT_PAIN_TYPES: PainType[]        = ['workaround', 'feature', 'integration']
const COMPLEXITY_PAIN_TYPES: PainType[] = ['workflow', 'integration']

/**
 * Score a cluster across 10 opportunity dimensions, each 0–100.
 *
 * Entity summary data (from Schema v1 extraction) is used where available;
 * signals are scanned for urgency/financial/behavioural patterns.
 * The buildability filter is re-applied internally so feasibility is
 * authoritative regardless of the cluster's pre-stored isBuildable flag.
 */
export function scoreDimensions(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): DimensionScores {
  const clusterSignals      = signals.filter((s) => cluster.signalIds.includes(s.id))
  const es                  = cluster.entitySummary            // undefined on legacy clusters
  const clusterText         = Object.keys(cluster.termFrequency).join(' ')
  const ageDays             = (Date.now() - new Date(cluster.lastDetected).getTime()) / 86_400_000
  const isActuallyBuildable = applyBuildabilityFilter(cluster, signals)

  // ── 1. Pain Severity ───────────────────────────────────────────────────────
  // avgIntensity (0–10) → 0–90; high-intensity signal count adds up to 10.
  const highIntensityCount = clusterSignals.filter((s) => s.intensityScore >= 7).length
  const painSeverity       = Math.min(100, Math.round(
    cluster.avgIntensity * 9 +
    (highIntensityCount >= 3 ? 10 : highIntensityCount >= 1 ? 5 : 0),
  ))

  // ── 2. Frequency ───────────────────────────────────────────────────────────
  // Volume (50+ signals → 100) + cross-source breadth bonus.
  const frequency = Math.min(100, Math.round(
    cluster.signalCount * 2 + cluster.sourceDiversity * 5,
  ))

  // ── 3. Urgency ─────────────────────────────────────────────────────────────
  // Ratio of urgency-marker signals + recency bonus + pain-type bonus.
  const URGENCY_RE  = /every day|constantly|always|waste hours|every time|all the time|urgent|asap|desperately/i
  const urgentCount  = clusterSignals.filter((s) => URGENCY_RE.test(s.painText)).length
  const urgencyRatio = clusterSignals.length > 0 ? urgentCount / clusterSignals.length : 0
  const recencyBonus = ageDays < 7 ? 20 : ageDays < 30 ? 10 : ageDays < 90 ? 0 : -10
  const urgencyTypeBonus = URGENCY_PAIN_TYPES.includes(cluster.painTheme) ? 10 : 0
  const urgency = Math.max(0, Math.min(100, Math.round(
    urgencyRatio * 70 + recencyBonus + urgencyTypeBonus,
  )))

  // ── 4. Willingness to Pay ──────────────────────────────────────────────────
  // Financial distress signals + cost pain-type bonus + paid-solutions indicator.
  const WTP_RE         = /too expensive|can't afford|wasted hours|lost money|overpriced|pay for|worth paying|subscription/i
  const wtpCount       = clusterSignals.filter((s) => WTP_RE.test(s.painText)).length
  const wtpRatio       = clusterSignals.length > 0 ? wtpCount / clusterSignals.length : 0
  const wtpFromType      = cluster.painTheme === 'cost' ? 30 : 0
  const wtpFromSolutions = (es?.existingSolutions?.length ?? 0) > 0 ? 20 : 0
  const willingnessToPay = Math.min(100, Math.round(
    wtpRatio * 50 + wtpFromType + wtpFromSolutions,
  ))

  // ── 5. Market Breadth ──────────────────────────────────────────────────────
  // Cross-source diversity + entity-level persona / industry spread.
  const breadthSources    = Math.min(60, cluster.sourceDiversity * 15)
  const breadthPersonas   = Math.min(25, (es?.personas?.length   ?? 0) * 5)
  const breadthIndustries = Math.min(15, (es?.industries?.length ?? 0) * 5)
  const marketBreadth     = Math.min(100, Math.round(
    breadthSources + breadthPersonas + breadthIndustries,
  ))

  // ── 6. Poor Solution Fit ───────────────────────────────────────────────────
  // Workaround evidence (strongest signal) + pain-type + non-saturation.
  const workaroundScore = Math.min(60, (es?.workarounds?.length ?? 0) * 15)
  const fitFromType     = FIT_PAIN_TYPES.includes(cluster.painTheme) ? 20 : 0
  const notSaturated    = !SATURATION_REGEX.test(clusterText) ? 20 : 0
  const poorSolutionFit = Math.min(100, Math.round(workaroundScore + fitFromType + notSaturated))

  // ── 7. Feasibility ─────────────────────────────────────────────────────────
  // Zero when buildability filter fails; otherwise base + tech clarity − complexity.
  const feasibility = !isActuallyBuildable ? 0 : Math.min(100, Math.round(
    50 +                                                              // base: passed filter
    Math.min(25, (es?.technologies?.length ?? 0) * 5) +             // known tech stack present
    Math.min(15, (5 - Math.min(5, es?.workflows?.length ?? 0)) * 3), // fewer workflows = simpler
  ))

  // ── 8. Why Now ─────────────────────────────────────────────────────────────
  // Recency (how fresh are signals?) + AI/automation momentum indicator.
  const recencyScore = ageDays < 7  ? 60
                     : ageDays < 30 ? 45
                     : ageDays < 90 ? 30
                     : ageDays < 180 ? 15 : 5
  const aiMomentum   = WHY_NOW_RE.test(clusterText)
    || clusterSignals.some((s) => WHY_NOW_RE.test(s.painText))
    ? 40 : 0
  const whyNow = Math.min(100, Math.round(recencyScore + aiMomentum))

  // ── 9. Defensibility ───────────────────────────────────────────────────────
  // Workflow depth (lock-in) + technology entanglement + cross-industry presence.
  const defWorkflows     = Math.min(40, (es?.workflows?.length   ?? 0) * 10)
  const defTech          = Math.min(25, (es?.technologies?.length ?? 0) * 5)
  const defMultiIndustry = (es?.industries?.length ?? 0) > 1 ? 20 : 0
  const defComplexPain   = COMPLEXITY_PAIN_TYPES.includes(cluster.painTheme) ? 15 : 0
  const defensibility    = Math.min(100, Math.round(
    defWorkflows + defTech + defMultiIndustry + defComplexPain,
  ))

  // ── 10. GTM Clarity ────────────────────────────────────────────────────────
  // Named personas + industry focus + evidence of existing communities.
  const gtmPersonas    = Math.min(50, (es?.personas?.length    ?? 0) * 10)
  const gtmIndustries  = Math.min(30, (es?.industries?.length  ?? 0) * 10)
  const gtmCommunities = cluster.sourceDiversity >= 2 ? 20 : 0
  const gtmClarity     = Math.min(100, Math.round(gtmPersonas + gtmIndustries + gtmCommunities))

  return {
    painSeverity,
    frequency,
    urgency,
    willingnessToPay,
    marketBreadth,
    poorSolutionFit,
    feasibility,
    whyNow,
    defensibility,
    gtmClarity,
  }
}

// ── Unified opportunity score ─────────────────────────────────────────────────

/**
 * Unified opportunity score using the 10-dimension model.
 *
 * The three roll-up scores (gapScore, marketScore, buildabilityScore) preserve
 * the UI/storage API contract while being driven by the 10-dimension engine.
 * dimensionScores is included so callers can surface individual insights.
 *
 * Roll-up weights:
 *   gapScore          = painSeverity 30% + urgency 25% + poorSolutionFit 25% + willingnessToPay 20%
 *   marketScore       = marketBreadth 40% + frequency 30% + marketLayerScore 30%
 *   buildabilityScore = feasibility 40% + whyNow 30% + defensibility 15% + gtmClarity 15%
 *   totalScore        = gapScore 40% + marketScore 40% + buildabilityScore 20%
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
  dimensionScores:   DimensionScores
} {
  const dim = scoreDimensions(cluster, signals)

  // Market-layer: App Store charts + winning-app database
  const { marketScore: marketLayerScore, inferredCategory } =
    computeMarketScore(cluster, charts, winningApps)

  // Demand-side roll-up: how underserved and painful is this problem?
  const gapScore = Math.round(
    0.30 * dim.painSeverity +
    0.25 * dim.urgency +
    0.25 * dim.poorSolutionFit +
    0.20 * dim.willingnessToPay,
  )

  // Market-side roll-up: how broad and externally validated is the opportunity?
  const marketScore = Math.round(
    0.40 * dim.marketBreadth +
    0.30 * dim.frequency +
    0.30 * marketLayerScore,
  )

  // Supply-side roll-up: can we win and defend this?
  const buildabilityScore = Math.round(
    0.40 * dim.feasibility +
    0.30 * dim.whyNow +
    0.15 * dim.defensibility +
    0.15 * dim.gtmClarity,
  )

  const totalScore = Math.round(
    0.40 * gapScore +
    0.40 * marketScore +
    0.20 * buildabilityScore,
  )

  return {
    gapScore,
    marketScore,
    buildabilityScore,
    totalScore,
    inferredCategory,
    dimensionScores: dim,
  }
}

// ── Top-3 selector ────────────────────────────────────────────────────────────

export function getTop3(
  clusters: OpportunityCluster[],
  signals:  PainSignal[],
): OpportunityCluster[] {
  const scored = clusters.map((c) => {
    const isBuildable   = applyBuildabilityFilter(c, signals)
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
