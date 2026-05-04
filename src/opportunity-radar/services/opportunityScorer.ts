import type { OpportunityCluster, PainSignal } from '../types.js'

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
