import type { PainSignal, OpportunityCluster, PainType } from '../types.js'

// ── Interface — drop-in replacement for semantic upgrade ─────────────────────

export interface IClusterer {
  cluster(signals: PainSignal[], existing: OpportunityCluster[]): OpportunityCluster[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(): string {
  return `cluster_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** Jaccard similarity on two sets. Returns 0 if both are empty. */
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

/**
 * Build a human-readable cluster name.
 * When entity data is available, prefer "{persona} × {workflow}" patterns.
 * Falls back to top-3 keyword terms when entities are sparse.
 */
function buildClusterName(
  termFrequency: Record<string, number>,
  entitySummary?: OpportunityCluster['entitySummary'],
): string {
  if (entitySummary) {
    const persona   = entitySummary.personas?.[0]
    const workflow  = entitySummary.workflows?.[0]
    const industry  = entitySummary.industries?.[0]

    if (persona && workflow) return `${persona} | ${workflow}`
    if (workflow && industry) return `${workflow} | ${industry}`
    if (persona && industry)  return `${persona} | ${industry}`
    if (workflow)              return workflow
    if (persona)               return persona
  }
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
  return new Set(
    relevant.map((s) =>
      s.source === 'corpus' ? (s.corpusSourceType ?? 'corpus') : s.source,
    ),
  ).size
}

function overlapRatio(idsA: string[], idsB: string[]): number {
  const setA = new Set(idsA)
  const setB = new Set(idsB)
  let common = 0
  for (const id of setA) { if (setB.has(id)) common++ }
  const smaller = Math.min(setA.size, setB.size)
  return smaller === 0 ? 0 : common / smaller
}

// ── Entity bag utilities ──────────────────────────────────────────────────────
// An entity "bag" is a Set of "type::value" strings extracted from a signal's
// entity array. High-confidence entities (≥ 0.75) are included; low-confidence
// fallbacks are excluded to reduce noise in overlap calculations.

type EntityBag = Set<string>

function sigEntityBag(signal: PainSignal): EntityBag {
  const bag: EntityBag = new Set()
  for (const e of (signal.entities ?? [])) {
    if (e.confidence >= 0.60) {
      bag.add(`${e.type}::${e.value}`)
    }
  }
  return bag
}

/** Merge signal entity bag into an existing cluster bag (mutates clusterBag). */
function mergeBagInto(clusterBag: EntityBag, signalBag: EntityBag): void {
  for (const key of signalBag) clusterBag.add(key)
}

// ── Entity summary builder ────────────────────────────────────────────────────
// Aggregates entity counts across all signals in a cluster and returns the top
// values per type. This is the primary input for 5 scoring dimensions.

function buildEntitySummary(
  signalIds: string[],
  allSignals: PainSignal[],
): OpportunityCluster['entitySummary'] {
  const clusterSignals = allSignals.filter((s) => signalIds.includes(s.id))

  const counts = new Map<string, Map<string, number>>()

  for (const sig of clusterSignals) {
    for (const entity of (sig.entities ?? [])) {
      if (entity.confidence < 0.60) continue
      if (!counts.has(entity.type)) counts.set(entity.type, new Map())
      const vals = counts.get(entity.type)!
      vals.set(entity.value, (vals.get(entity.value) ?? 0) + 1)
    }
  }

  const top = (type: string, n: number): string[] =>
    [...(counts.get(type)?.entries() ?? [])]
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([v]) => v)

  return {
    personas:          top('persona',             5),
    workflows:         top('workflow',            5),
    technologies:      top('technology',          5),
    workarounds:       top('workaround',          5),
    existingSolutions: top('existing_solution',   5),
    industries:        top('industry',            3),
    // Schema v2: corpus-aware scoring dimensions
    bottlenecks:       top('bottleneck',          3),
    emergingTech:      top('emerging_technology', 3),
    platformShifts:    top('platform_shift',      3),
    buyerRoles:        top('buyer_role',          3),
  }
}

// ── Hybrid signal-to-cluster similarity ──────────────────────────────────────
// Blends entity-overlap and keyword-term Jaccard.
// Entity overlap dominates when both signal and cluster have entity data;
// keyword Jaccard acts as the fallback for sparse / legacy signals.

function computeSignalSimilarity(
  sigTermSet: Set<string>,
  sigEntityBag: EntityBag,
  clusterTermSet: Set<string>,
  clusterEntityBag: EntityBag,
): number {
  const keywordSim = jaccard(sigTermSet, clusterTermSet)

  // When both sides have entity data, blend: 60% entity + 40% keyword.
  // This captures semantic coherence that raw tokens miss (e.g., two articles
  // about "AI agents for PMs" vs "LLM automation for product teams" share
  // entity keys like persona::product manager but differ in surface words).
  if (sigEntityBag.size > 0 && clusterEntityBag.size > 0) {
    const entitySim = jaccard(sigEntityBag, clusterEntityBag)
    return 0.6 * entitySim + 0.4 * keywordSim
  }

  return keywordSim
}

// ── KeywordClusterer ──────────────────────────────────────────────────────────

export class KeywordClusterer implements IClusterer {
  cluster(incoming: PainSignal[], existing: OpportunityCluster[]): OpportunityCluster[] {
    const now = new Date().toISOString()

    // Clone existing clusters and build their initial entity bags
    const clusters: OpportunityCluster[] = existing.map((c) => ({
      ...c,
      signalIds: [...c.signalIds],
    }))

    // Entity bags are tracked in parallel — one Set<entityKey> per cluster index
    const entityBags: EntityBag[] = clusters.map((c) => {
      // Seed from signals already in the cluster (if they're in incoming)
      const bag: EntityBag = new Set()
      for (const sig of incoming) {
        if (c.signalIds.includes(sig.id)) {
          mergeBagInto(bag, sigEntityBag(sig))
        }
      }
      return bag
    })

    for (const signal of incoming) {
      const sigTermSet = new Set(signal.keyTerms)
      const sigBag    = sigEntityBag(signal)

      // Similarity threshold: entity-enriched clusters use a lower absolute
      // threshold (0.12) because entity bags are sparser than term sets.
      // Pure keyword clusters keep the original 0.35 gate.
      const threshold = sigBag.size > 0 ? 0.12 : 0.35

      let bestIdx   = -1
      let bestScore = 0

      for (let i = 0; i < clusters.length; i++) {
        const c              = clusters[i]
        const clusterTermSet = new Set(Object.keys(c.termFrequency))
        const sim            = computeSignalSimilarity(
          sigTermSet, sigBag,
          clusterTermSet, entityBags[i],
        )

        if (sim < threshold) continue

        if (c.painTheme === signal.painType) {
          if (sim > bestScore) { bestScore = sim; bestIdx = i }
        } else {
          if (c.signalCount < 5 && sim > bestScore) { bestScore = sim; bestIdx = i }
        }
      }

      if (bestIdx >= 0) {
        const c = clusters[bestIdx]
        if (!c.signalIds.includes(signal.id)) {
          c.signalIds.push(signal.id)
          c.signalCount    = c.signalIds.length
          c.termFrequency  = updateTermFrequency(c.termFrequency, signal.keyTerms)
          c.updatedAt      = now
          if (signal.detectedAt < c.firstDetected) c.firstDetected = signal.detectedAt
          if (signal.detectedAt > c.lastDetected)  c.lastDetected  = signal.detectedAt
          // Grow the entity bag so subsequent signals can match against it
          mergeBagInto(entityBags[bestIdx], sigBag)
        }
      } else {
        const tf     = updateTermFrequency({}, signal.keyTerms)
        const newBag: EntityBag = new Set<string>(sigBag)
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
        entityBags.push(newBag)
      }
    }

    const merged = this._mergeClusters(clusters, incoming, now)

    return merged.map((c) => {
      const summary = buildEntitySummary(c.signalIds, incoming)
      return {
        ...c,
        signalCount:     c.signalIds.length,
        avgIntensity:    computeAvgIntensity(incoming, c.signalIds),
        sourceDiversity: computeSourceDiversity(incoming, c.signalIds),
        clusterName:     buildClusterName(c.termFrequency, summary),
        entitySummary:   summary,
      }
    })
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
