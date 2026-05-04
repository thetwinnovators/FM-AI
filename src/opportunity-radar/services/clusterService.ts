import type { PainSignal, OpportunityCluster, PainType } from '../types.js'

// ── Interface — drop-in replacement for semantic upgrade ─────────────────────

export interface IClusterer {
  cluster(signals: PainSignal[], existing: OpportunityCluster[]): OpportunityCluster[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(): string {
  return `cluster_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function jaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0
  let intersection = 0
  for (const term of setA) {
    if (setB.has(term)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

function updateTermFrequency(
  freq: Record<string, number>,
  terms: string[],
): Record<string, number> {
  const updated = { ...freq }
  for (const t of terms) {
    updated[t] = (updated[t] ?? 0) + 1
  }
  return updated
}

function buildClusterName(termFrequency: Record<string, number>): string {
  return Object.entries(termFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([term]) => term)
    .join(' ')
}

function computeAvgIntensity(signals: PainSignal[], signalIds: string[]): number {
  const relevant = signals.filter((s) => signalIds.includes(s.id))
  if (relevant.length === 0) return 0
  return relevant.reduce((sum, s) => sum + s.intensityScore, 0) / relevant.length
}

function computeSourceDiversity(signals: PainSignal[], signalIds: string[]): number {
  const relevant = signals.filter((s) => signalIds.includes(s.id))
  return new Set(relevant.map((s) => s.source)).size
}

function overlapRatio(idsA: string[], idsB: string[]): number {
  const setA = new Set(idsA)
  const setB = new Set(idsB)
  let common = 0
  for (const id of setA) { if (setB.has(id)) common++ }
  const smaller = Math.min(setA.size, setB.size)
  return smaller === 0 ? 0 : common / smaller
}

// ── KeywordClusterer ──────────────────────────────────────────────────────────

export class KeywordClusterer implements IClusterer {
  cluster(incoming: PainSignal[], existing: OpportunityCluster[]): OpportunityCluster[] {
    const now = new Date().toISOString()
    const clusters: OpportunityCluster[] = existing.map((c) => ({ ...c, signalIds: [...c.signalIds] }))

    for (const signal of incoming) {
      const sigTermSet = new Set(signal.keyTerms)
      let bestIdx   = -1
      let bestScore = 0

      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i]
        const clusterTermSet = new Set(Object.keys(c.termFrequency))
        const sim = jaccard(sigTermSet, clusterTermSet)

        if (sim < 0.35) continue

        if (c.painTheme === signal.painType) {
          if (sim > bestScore) { bestScore = sim; bestIdx = i }
        } else {
          if (c.signalCount < 5 && sim > bestScore) { bestScore = sim; bestIdx = i }
        }
      }

      if (bestIdx >= 0) {
        const c = clusters[bestIdx]
        // Guard: skip re-processing signals already assigned to this cluster.
        // The caller passes allSignals (old + new) so without this check old
        // signal IDs would be pushed again, inflating signalCount and termFrequency.
        if (!c.signalIds.includes(signal.id)) {
          c.signalIds.push(signal.id)
          c.signalCount = c.signalIds.length
          c.termFrequency = updateTermFrequency(c.termFrequency, signal.keyTerms)
          c.clusterName   = buildClusterName(c.termFrequency)
          c.updatedAt     = now
          if (signal.detectedAt < c.firstDetected) c.firstDetected = signal.detectedAt
          if (signal.detectedAt > c.lastDetected)  c.lastDetected  = signal.detectedAt
        }
      } else {
        const tf = updateTermFrequency({}, signal.keyTerms)
        clusters.push({
          id:               makeId(),
          clusterName:      buildClusterName(tf),
          painTheme:        signal.painType,
          signalIds:        [signal.id],
          signalCount:      1,
          sourceDiversity:  1,
          avgIntensity:     signal.intensityScore,
          firstDetected:    signal.detectedAt,
          lastDetected:     signal.detectedAt,
          termFrequency:    tf,
          opportunityScore: 0,
          isBuildable:      false,
          status:           'emerging',
          createdAt:        now,
          updatedAt:        now,
        })
      }
    }

    const merged = this._mergeClusters(clusters, incoming, now)

    return merged.map((c) => ({
      ...c,
      signalCount:     c.signalIds.length,
      avgIntensity:    computeAvgIntensity(incoming, c.signalIds),
      sourceDiversity: computeSourceDiversity(incoming, c.signalIds),
      clusterName:     buildClusterName(c.termFrequency),
    }))
  }

  private _mergeClusters(
    clusters: OpportunityCluster[],
    _signals: PainSignal[],
    now: string,
  ): OpportunityCluster[] {
    const merged: OpportunityCluster[] = []
    const absorbed = new Set<string>()

    for (let i = 0; i < clusters.length; i++) {
      if (absorbed.has(clusters[i].id)) continue
      let base = { ...clusters[i], signalIds: [...clusters[i].signalIds] }

      for (let j = i + 1; j < clusters.length; j++) {
        if (absorbed.has(clusters[j].id)) continue
        if (overlapRatio(base.signalIds, clusters[j].signalIds) > 0.7) {
          const combinedIds  = [...new Set([...base.signalIds, ...clusters[j].signalIds])]
          const combinedFreq = { ...base.termFrequency }
          for (const [term, count] of Object.entries(clusters[j].termFrequency)) {
            combinedFreq[term] = (combinedFreq[term] ?? 0) + count
          }
          base = {
            ...base,
            signalIds:     combinedIds,
            signalCount:   combinedIds.length,
            termFrequency: combinedFreq,
            clusterName:   buildClusterName(combinedFreq),
            firstDetected: base.firstDetected < clusters[j].firstDetected ? base.firstDetected : clusters[j].firstDetected,
            lastDetected:  base.lastDetected  > clusters[j].lastDetected  ? base.lastDetected  : clusters[j].lastDetected,
            updatedAt:     now,
          }
          absorbed.add(clusters[j].id)
        }
      }
      merged.push(base)
    }
    return merged
  }
}
