import type { OpportunityCluster, PainSignal, DimensionScores, PainType } from '../types.js'
import type { CategoryChart, WinningApp } from '../types.js'
import type { DimensionDriverMap, DimensionDriver } from '../../venture-scope/types.js'
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

// Promoted to module scope so collectDimensionDrivers can share them without redefinition.

/** Corpus urgency: analytical language indicating a pressing or time-sensitive problem. */
const CORPUS_URGENCY_TEXT_RE =
  /\b(?:growing|emerging|accelerat|rapidly|increasingly|critical|pressing|urgent|time-sensitive|cannot\s+wait|without\s+delay|immediate)\b/i

/** Social-media urgency: behavioural markers showing the problem is felt constantly or urgently. */
const URGENCY_RE =
  /every day|constantly|always|waste hours|every time|all the time|urgent|asap|desperately/i

/** Social-media willingness-to-pay: financial distress signals. */
const WTP_RE =
  /too expensive|can't afford|wasted hours|lost money|overpriced|pay for|worth paying|subscription/i

/** B2B / enterprise industry context — indicates budget availability. */
const B2B_INDUSTRY_RE =
  /enterprise|saas|b2b|fintech|healthcare|legal|banking|insurance|cybersecurity|edtech/i

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

  // Detect corpus-only clusters — curated research content, not raw social posts.
  // Urgency and WTP use different signals for corpus vs social-media clusters.
  const isCorpusCluster = clusterSignals.length > 0
    && clusterSignals.every((s) => s.source === 'corpus')

  // ── 1. Pain Severity ───────────────────────────────────────────────────────
  // avgIntensity (0–10) → 0–90; high-intensity signal count adds up to 10.
  // For corpus clusters, avgIntensity is entity-density based (see signalExtractor),
  // so this formula now reflects research richness, not just emotional complaint volume.
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
  const recencyBonus     = ageDays < 7 ? 20 : ageDays < 30 ? 10 : ageDays < 90 ? 0 : -10
  const urgencyTypeBonus = URGENCY_PAIN_TYPES.includes(cluster.painTheme) ? 10 : 0
  let urgency: number

  if (isCorpusCluster) {
    // Corpus urgency: measured by blocking entities + market-timing signals, not complaint frequency.
    // Platform shifts and emerging tech indicate an open window; bottlenecks signal active blocking.
    const corpusUrgentCount  = clusterSignals.filter((s) => CORPUS_URGENCY_TEXT_RE.test(s.painText)).length
    const corpusUrgentRatio  = clusterSignals.length > 0 ? corpusUrgentCount / clusterSignals.length : 0
    const platformShiftBonus = (es?.platformShifts?.length ?? 0) > 0 ? 30 : 0
    const emergingTechBonus  = (es?.emergingTech?.length   ?? 0) > 0 ? 20 : 0
    const bottleneckBonus    = (es?.bottlenecks?.length    ?? 0) > 0 ? 15 : 0
    urgency = Math.max(0, Math.min(100, Math.round(
      corpusUrgentRatio * 35 + platformShiftBonus + emergingTechBonus + bottleneckBonus +
      recencyBonus + urgencyTypeBonus,
    )))
  } else {
    // Social-media urgency: ratio of complaint signals with urgency markers.
    const urgentCount  = clusterSignals.filter((s) => URGENCY_RE.test(s.painText)).length
    const urgencyRatio = clusterSignals.length > 0 ? urgentCount / clusterSignals.length : 0
    urgency = Math.max(0, Math.min(100, Math.round(
      urgencyRatio * 70 + recencyBonus + urgencyTypeBonus,
    )))
  }

  // ── 4. Willingness to Pay ──────────────────────────────────────────────────
  let willingnessToPay: number

  if (isCorpusCluster) {
    // Corpus WTP: inferred from market context rather than individual price complaints.
    // Existing solutions → people are already paying. Buyer roles → budget authority present.
    // B2B / high-value industries → enterprise budgets exist.
    const hasSolutions  = (es?.existingSolutions?.length ?? 0) > 0 ? 25 : 0
    const hasBuyerRoles = (es?.buyerRoles?.length        ?? 0) > 0 ? 25 : 0
    const b2bBonus      = (es?.industries ?? []).some((i) => B2B_INDUSTRY_RE.test(i)) ? 20 : 0
    const painTypeBonus = ['cost', 'workaround', 'feature'].includes(cluster.painTheme) ? 30 : 0
    willingnessToPay = Math.min(100, Math.round(hasSolutions + hasBuyerRoles + b2bBonus + painTypeBonus))
  } else {
    // Social-media WTP: financial distress signals + cost pain-type + existing paid solutions.
    const wtpCount       = clusterSignals.filter((s) => WTP_RE.test(s.painText)).length
    const wtpRatio       = clusterSignals.length > 0 ? wtpCount / clusterSignals.length : 0
    const wtpFromType      = cluster.painTheme === 'cost' ? 30 : 0
    const wtpFromSolutions = (es?.existingSolutions?.length ?? 0) > 0 ? 20 : 0
    willingnessToPay = Math.min(100, Math.round(wtpRatio * 50 + wtpFromType + wtpFromSolutions))
  }

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

// ── Score-driver collector ────────────────────────────────────────────────────

// SYNC: collectDimensionDrivers must mirror scoreDimensions() exactly.
// Any scoring change that affects a dimension must be reflected here.
export function collectDimensionDrivers(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): DimensionDriverMap {
  // SYNC: keep aligned with scoreDimensions()
  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))
  const es             = cluster.entitySummary
  const clusterText    = Object.keys(cluster.termFrequency).join(' ')
  const ageDays        = (Date.now() - new Date(cluster.lastDetected).getTime()) / 86_400_000
  const isActuallyBuildable = applyBuildabilityFilter(cluster, signals)
  const isCorpusCluster = clusterSignals.length > 0 && clusterSignals.every((s) => s.source === 'corpus')

  // Helper: snippet from a signal
  const snippet = (s: PainSignal): string => s.painText.slice(0, 120)

  // Helper: build entity driver
  const entityDriver = (value: string, type: string, label: string, pts?: number): DimensionDriver => ({
    type: 'entity', entityValue: value, entityType: type, label, contribution: 'positive', pointValue: pts,
  })

  // Helper: build flag driver
  const flagDriver = (key: string, label: string, contribution: 'positive' | 'negative', pts?: number): DimensionDriver => ({
    type: 'flag', flagKey: key, label, contribution, pointValue: pts,
  })

  const map: DimensionDriverMap = {}

  // ── 1. painSeverity ────────────────────────────────────────────────────────
  // SYNC: keep aligned with scoreDimensions()
  {
    const highIntensity = clusterSignals.filter((s) => s.intensityScore >= 7)
    const drivers: DimensionDriver[] = []
    for (const s of highIntensity.slice(0, 2)) {
      drivers.push({ type: 'signal', signalId: s.id, signalSnippet: snippet(s),
        label: 'High-intensity signal', contribution: 'positive' })
    }
    drivers.push(flagDriver('avgIntensity',
      `Average intensity: ${cluster.avgIntensity.toFixed(1)}/10`,
      cluster.avgIntensity >= 5 ? 'positive' : 'negative',
    ))
    if (highIntensity.length >= 1) {
      drivers.push(flagDriver('highIntensityCount',
        `${highIntensity.length} high-intensity signal${highIntensity.length > 1 ? 's' : ''}`,
        'positive',
        highIntensity.length >= 3 ? 10 : 5,
      ))
    }
    map.painSeverity = drivers
  }

  // ── 2. frequency ───────────────────────────────────────────────────────────
  // SYNC: keep aligned with scoreDimensions()
  {
    map.frequency = [
      flagDriver('signalCount',
        `${cluster.signalCount} signals across ${cluster.sourceDiversity} source type${cluster.sourceDiversity !== 1 ? 's' : ''}`,
        cluster.signalCount >= 5 ? 'positive' : 'negative',
      ),
    ]
  }

  // ── 3. urgency ─────────────────────────────────────────────────────────────
  // SYNC: keep aligned with scoreDimensions()
  {
    const recencyContrib: 'positive' | 'negative' = ageDays < 90 ? 'positive' : 'negative'
    const recencyLabel = `Last signal ${ageDays.toFixed(0)} days ago`
    const urgencyTypeMatch = (URGENCY_PAIN_TYPES as string[]).includes(cluster.painTheme)
    const drivers: DimensionDriver[] = []

    if (isCorpusCluster) {
      const matching = clusterSignals.filter((s) => CORPUS_URGENCY_TEXT_RE.test(s.painText))
      for (const s of matching.slice(0, 3)) {
        drivers.push({ type: 'signal', signalId: s.id, signalSnippet: snippet(s),
          label: 'Urgency language detected', contribution: 'positive' })
      }
      for (const v of (es?.platformShifts ?? []).slice(0, 3)) {
        drivers.push(entityDriver(v, 'platform_shift', 'Platform shift detected', 30))
      }
      for (const v of (es?.emergingTech ?? []).slice(0, 3)) {
        drivers.push(entityDriver(v, 'emerging_technology', 'Emerging technology', 20))
      }
      for (const v of (es?.bottlenecks ?? []).slice(0, 3)) {
        drivers.push(entityDriver(v, 'bottleneck', 'Active bottleneck', 15))
      }
    } else {
      const matching = clusterSignals.filter((s) => URGENCY_RE.test(s.painText))
      for (const s of matching.slice(0, 3)) {
        drivers.push({ type: 'signal', signalId: s.id, signalSnippet: snippet(s),
          label: 'Urgency language detected', contribution: 'positive' })
      }
    }

    drivers.push(flagDriver('recency', recencyLabel, recencyContrib))
    if (urgencyTypeMatch) {
      drivers.push(flagDriver('urgencyPainType',
        `Pain type "${cluster.painTheme}" adds urgency bonus`, 'positive', 10))
    }
    map.urgency = drivers
  }

  // ── 4. willingnessToPay ────────────────────────────────────────────────────
  // SYNC: keep aligned with scoreDimensions()
  {
    const drivers: DimensionDriver[] = []

    if (isCorpusCluster) {
      for (const v of (es?.existingSolutions ?? []).slice(0, 3)) {
        drivers.push(entityDriver(v, 'existing_solution', 'Existing paid tool identified', 25))
      }
      for (const v of (es?.buyerRoles ?? []).slice(0, 3)) {
        drivers.push(entityDriver(v, 'buyer_role', 'Budget decision-maker role present', 25))
      }
      const matchedB2B = (es?.industries ?? []).find((i) => B2B_INDUSTRY_RE.test(i))
      if (matchedB2B) {
        drivers.push(flagDriver('b2bIndustry',
          `B2B/enterprise industry context: ${matchedB2B}`, 'positive', 20))
      }
      if ((['cost', 'workaround', 'feature'] as string[]).includes(cluster.painTheme)) {
        drivers.push(flagDriver('wtpPainType',
          `Pain type "${cluster.painTheme}" signals WTP`, 'positive', 30))
      }
    } else {
      const matching = clusterSignals.filter((s) => WTP_RE.test(s.painText))
      for (const s of matching.slice(0, 3)) {
        drivers.push({ type: 'signal', signalId: s.id, signalSnippet: snippet(s),
          label: 'Financial distress signal', contribution: 'positive' })
      }
      if (cluster.painTheme === 'cost') {
        drivers.push(flagDriver('costPainType', 'Cost pain type', 'positive', 30))
      }
      for (const v of (es?.existingSolutions ?? []).slice(0, 2)) {
        drivers.push(entityDriver(v, 'existing_solution', 'Existing paid tool', 20))
      }
    }
    map.willingnessToPay = drivers
  }

  // ── 5. marketBreadth ──────────────────────────────────────────────────────
  // SYNC: keep aligned with scoreDimensions()
  {
    const drivers: DimensionDriver[] = []
    for (const v of (es?.personas ?? []).slice(0, 3)) {
      drivers.push(entityDriver(v, 'persona', `Persona: ${v}`, 5))
    }
    for (const v of (es?.industries ?? []).slice(0, 2)) {
      drivers.push(entityDriver(v, 'industry', `Industry: ${v}`, 5))
    }
    drivers.push(flagDriver('sourceDiversity',
      `${cluster.sourceDiversity} distinct source type${cluster.sourceDiversity !== 1 ? 's' : ''}`,
      cluster.sourceDiversity >= 2 ? 'positive' : 'negative',
    ))
    map.marketBreadth = drivers
  }

  // ── 6. poorSolutionFit ────────────────────────────────────────────────────
  // SYNC: keep aligned with scoreDimensions()
  {
    const isSaturated = SATURATION_REGEX.test(clusterText)
    const drivers: DimensionDriver[] = []
    for (const v of (es?.workarounds ?? []).slice(0, 3)) {
      drivers.push(entityDriver(v, 'workaround', `Workaround: ${v}`, 15))
    }
    if ((['workaround', 'feature', 'integration'] as string[]).includes(cluster.painTheme)) {
      drivers.push(flagDriver('fitPainType',
        `Pain type "${cluster.painTheme}" confirms poor solution fit`, 'positive', 20))
    }
    drivers.push(flagDriver('saturation',
      isSaturated ? 'Incumbent detected — misses +20 bonus' : 'No dominant incumbent',
      isSaturated ? 'negative' : 'positive',
      isSaturated ? undefined : 20,
    ))
    map.poorSolutionFit = drivers
  }

  // ── 7. feasibility ────────────────────────────────────────────────────────
  // SYNC: keep aligned with scoreDimensions()
  {
    const drivers: DimensionDriver[] = []
    if (!isActuallyBuildable) {
      drivers.push(flagDriver('buildabilityFailed',
        'Buildability filter failed — enterprise-scale or multi-user pattern detected',
        'negative',
      ))
    } else {
      drivers.push(flagDriver('buildabilityPassed', 'No enterprise-scale red flags', 'positive', 50))
      for (const v of (es?.technologies ?? []).slice(0, 3)) {
        drivers.push(entityDriver(v, 'technology', `Known tech: ${v}`, 5))
      }
      const wCount = es?.workflows?.length ?? 0
      drivers.push(flagDriver('workflowComplexity',
        `Workflow complexity: ${wCount} workflow${wCount !== 1 ? 's' : ''}`,
        wCount <= 2 ? 'positive' : 'negative',
      ))
    }
    map.feasibility = drivers
  }

  // ── 8. whyNow ────────────────────────────────────────────────────────────
  // SYNC: keep aligned with scoreDimensions()
  {
    const drivers: DimensionDriver[] = []
    const hasAI = WHY_NOW_RE.test(clusterText) || clusterSignals.some((s) => WHY_NOW_RE.test(s.painText))
    if (hasAI) {
      drivers.push(flagDriver('aiMomentum', 'AI/automation keywords present', 'positive', 40))
    }
    const recencyLabel = ageDays < 7  ? `Last signal <7 days ago (${ageDays.toFixed(0)} days)`
                       : ageDays < 30 ? `Last signal <30 days ago (${ageDays.toFixed(0)} days)`
                       : ageDays < 90 ? `Last signal <90 days ago (${ageDays.toFixed(0)} days)`
                       : `Last signal ${ageDays.toFixed(0)} days ago`
    drivers.push(flagDriver('recency', recencyLabel, ageDays < 90 ? 'positive' : 'negative'))
    map.whyNow = drivers
  }

  // ── 9. defensibility ─────────────────────────────────────────────────────
  // SYNC: keep aligned with scoreDimensions()
  {
    const drivers: DimensionDriver[] = []
    for (const v of (es?.workflows ?? []).slice(0, 2)) {
      drivers.push(entityDriver(v, 'workflow', `Workflow lock-in: ${v}`, 10))
    }
    for (const v of (es?.technologies ?? []).slice(0, 2)) {
      drivers.push(entityDriver(v, 'technology', `Tech entanglement: ${v}`, 5))
    }
    if ((es?.industries?.length ?? 0) > 1) {
      drivers.push(flagDriver('multiIndustry',
        `${es!.industries!.length} industries — cross-market signal`, 'positive', 20))
    }
    if ((['workflow', 'integration'] as string[]).includes(cluster.painTheme)) {
      drivers.push(flagDriver('complexPainType',
        `Pain type "${cluster.painTheme}" suggests workflow depth`, 'positive', 15))
    }
    map.defensibility = drivers
  }

  // ── 10. gtmClarity ────────────────────────────────────────────────────────
  // SYNC: keep aligned with scoreDimensions()
  {
    const drivers: DimensionDriver[] = []
    for (const v of (es?.personas ?? []).slice(0, 3)) {
      drivers.push(entityDriver(v, 'persona', `First audience: ${v}`, 10))
    }
    for (const v of (es?.industries ?? []).slice(0, 2)) {
      drivers.push(entityDriver(v, 'industry', `Industry focus: ${v}`, 10))
    }
    drivers.push(flagDriver('sourceDiversity',
      `${cluster.sourceDiversity} source type${cluster.sourceDiversity !== 1 ? 's' : ''} confirm audience spread`,
      cluster.sourceDiversity >= 2 ? 'positive' : 'negative',
      cluster.sourceDiversity >= 2 ? 20 : 0,
    ))
    map.gtmClarity = drivers
  }

  return map
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
