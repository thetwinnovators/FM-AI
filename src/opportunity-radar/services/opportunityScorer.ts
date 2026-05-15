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

  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))
  const isCorpusOnly   = clusterSignals.length > 0 && clusterSignals.every((s) => s.source === 'corpus')

  if (isCorpusOnly) {
    // Corpus clusters: signals are curated research, not raw social posts.
    // sourceDiversity is measured by corpusSourceType (save/document/brief/etc).
    // A large single-type cluster (≥5) is still meaningful research signal.
    if (cluster.signalCount < 3)                                  return false
    if (cluster.signalCount < 5 && cluster.sourceDiversity < 2)  return false
    // No high-intensity-signal gate — corpus content is analytical, not emotional.
  } else {
    // External clusters: original strict gates apply.
    if (cluster.signalCount < 10)         return false
    if (cluster.sourceDiversity < 2)      return false
    if (clusterSignals.filter((s) => s.intensityScore >= 7).length < 3) return false
  }

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

  // ── Confidence: low signal count reduces confidence significantly ──────────
  const confidence = cluster.signalCount < 3  ? 0.30
    : cluster.signalCount < 5  ? 0.50
    : cluster.signalCount < 10 ? 0.70
    : cluster.signalCount < 20 ? 0.85
    : 0.95

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
    confidence,
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

// ── Score explanation builder ────────────────────────────────────────────────

/**
 * Converts raw DimensionScores into human-readable explanation entries.
 * One entry per dimension. Import ScoreBreakdownEntry from venture-scope/types.
 */
export function buildScoreExplanations(
  dim: DimensionScores,
  signalCount: number,
): Array<{ dimension: string; score: number; explanation: string; confidence: number }> {
  const confidence = dim.confidence ?? (
    signalCount >= 20 ? 0.95
    : signalCount >= 10 ? 0.85
    : signalCount >= 5  ? 0.70
    : signalCount >= 3  ? 0.50
    : 0.30
  )

  function explain(score: number, high: string, mid: string, low: string): string {
    if (score >= 65) return high
    if (score >= 40) return mid
    return low
  }

  return [
    {
      dimension: 'Pain Severity', score: dim.painSeverity, confidence,
      explanation: explain(dim.painSeverity,
        'Strong, persistent pain reported across multiple sources with high-intensity signals.',
        'Moderate pain — present but not universally severe.',
        'Weak signal — pain mentioned infrequently or at low intensity.',
      ),
    },
    {
      dimension: 'Frequency', score: dim.frequency, confidence,
      explanation: explain(dim.frequency,
        `High recurrence — ${signalCount} signals across diverse sources confirm this is a common problem.`,
        'Moderate frequency — problem appears repeatedly but in a narrower source set.',
        'Low frequency — too few signals to confirm this is a widespread pattern.',
      ),
    },
    {
      dimension: 'Urgency', score: dim.urgency, confidence,
      explanation: explain(dim.urgency,
        'Time-pressure signals present — people want a solution now, not eventually.',
        'Some urgency — problem is felt but not blocking critical workflows.',
        'Low urgency — users tolerate the status quo without active urgency.',
      ),
    },
    {
      dimension: 'Willingness to Pay', score: dim.willingnessToPay, confidence,
      explanation: explain(dim.willingnessToPay,
        'Strong economic signal — references to budget, cost, or existing paid tools confirm WTP.',
        'Some WTP evidence — users compare costs or mention paid alternatives.',
        'Weak WTP signal — no clear evidence users would pay to solve this.',
      ),
    },
    {
      dimension: 'Market Breadth', score: dim.marketBreadth, confidence,
      explanation: explain(dim.marketBreadth,
        'Multiple distinct personas and industries affected — broad addressable market.',
        'Moderate breadth — several segments but not universally applicable.',
        'Narrow market — signals concentrated in a single persona or niche.',
      ),
    },
    {
      dimension: 'Weak Solution Fit', score: dim.poorSolutionFit, confidence,
      explanation: explain(dim.poorSolutionFit,
        'Existing tools are clearly inadequate — workarounds dominate, incumbents are frustrating.',
        'Partial gap — some tools exist but miss key needs.',
        'Market may be served — few workarounds and existing tools appear adequate.',
      ),
    },
    {
      dimension: 'Feasibility', score: dim.feasibility, confidence,
      explanation: explain(dim.feasibility,
        'MVP is realistic for a small team — no enterprise blockers, clear scope.',
        'Buildable with care — some complexity but no hard blockers identified.',
        'Feasibility concerns — signals suggest backend complexity or multi-user requirements.',
      ),
    },
    {
      dimension: 'Why Now', score: dim.whyNow, confidence,
      explanation: explain(dim.whyNow,
        'Strong timing signal — AI/automation momentum or recent platform shift creates a window.',
        'Reasonable timing — market is active but no single catalyst identified.',
        'Timing uncertain — problem exists but no clear "why now" driver detected.',
      ),
    },
    {
      dimension: 'Defensibility', score: dim.defensibility, confidence,
      explanation: explain(dim.defensibility,
        'Potential for durable advantage — deep workflow integration, data accumulation, or habit formation.',
        'Some moat potential — workflow depth or niche focus provides limited protection.',
        'Low defensibility signal — problem may be easily copied once validated.',
      ),
    },
    {
      dimension: 'GTM Clarity', score: dim.gtmClarity, confidence,
      explanation: explain(dim.gtmClarity,
        'Clear first audience — named personas, specific industries, and community presence identified.',
        'Partial clarity — some persona signals but distribution path is vague.',
        'GTM unclear — broad signals without a specific reachable first user segment.',
      ),
    },
  ]
}
