/**
 * opportunityFrameBuilder — constructs a structured OpportunityFrame from the
 * entity graph for a given cluster.
 *
 * The frame is the primary input to generateConcepts(). It replaces raw pain
 * signals as the "truth" entering concept generation, so candidates reason over
 * graph structure — who, what workflow, what breaks, what technology — instead
 * of emotional keyword counts and cluster label strings.
 *
 * Design principles:
 *   - Pure function: no side-effects, no localStorage reads.
 *   - Defensive: every entity list may be empty; callers must handle that.
 *   - Ordered: each entity list is sorted by frequency descending so callers
 *     can take [0] to get the most-evidenced entity for each type.
 */

import type {
  OpportunityCluster,
  PainSignal,
  EntityGraph,
  ExtractedEntity,
  EntityRelationship,
  EntityType,
} from '../../opportunity-radar/types.js'
import type { OpportunityFrame } from '../types.js'

// ─── Entity selection ──────────────────────────────────────────────────────────

/**
 * Return all entities of a given type whose sourceSignalIds overlap with the
 * cluster's signal set, sorted by frequency descending.
 */
function pickEntities(
  graph: EntityGraph,
  clusterSignalSet: Set<string>,
  type: EntityType,
): ExtractedEntity[] {
  return Object.values(graph.entities)
    .filter(
      (e) =>
        e.type === type &&
        e.sourceSignalIds.some((sid) => clusterSignalSet.has(sid)),
    )
    .sort((a, b) => b.frequency - a.frequency)
}

// ─── Relationship selection ────────────────────────────────────────────────────

/**
 * Return relationships where BOTH endpoints exist in the cluster's entity set.
 * Sorted by strength descending so the first entries are the strongest links.
 */
function pickRelationships(
  graph: EntityGraph,
  clusterEntityIds: Set<string>,
): EntityRelationship[] {
  return Object.values(graph.relationships)
    .filter(
      (r) =>
        clusterEntityIds.has(r.fromId) &&
        clusterEntityIds.has(r.toId),
    )
    .sort((a, b) => b.strength - a.strength)
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a structured OpportunityFrame for a cluster.
 *
 * @param cluster      The OpportunityCluster to build a frame for.
 * @param allSignals   All VS signals (the full `fm_vs_signals` array).
 * @param entityGraph  The VS entity graph built in the same scan cycle.
 */
export function buildOpportunityFrame(
  cluster: OpportunityCluster,
  allSignals: PainSignal[],
  entityGraph: EntityGraph,
): OpportunityFrame {
  const clusterSignalSet = new Set(cluster.signalIds)
  const clusterSignals   = allSignals.filter((s) => clusterSignalSet.has(s.id))

  // ── Typed entity lists ──────────────────────────────────────────────────────
  const pick = (type: EntityType) =>
    pickEntities(entityGraph, clusterSignalSet, type)

  const personas          = pick('persona')
  const workflows         = pick('workflow')
  const workarounds       = pick('workaround')
  const technologies      = pick('technology')
  const bottlenecks       = pick('bottleneck')
  const platformShifts    = pick('platform_shift')
  const emergingTech      = pick('emerging_technology')
  const buyerRoles        = pick('buyer_role')
  const existingSolutions = pick('existing_solution')
  const industries        = pick('industry')

  // ── Relationships between cluster entities ──────────────────────────────────
  const allClusterEntityIds = new Set<string>([
    ...personas,
    ...workflows,
    ...workarounds,
    ...technologies,
    ...bottlenecks,
    ...platformShifts,
    ...emergingTech,
    ...buyerRoles,
    ...existingSolutions,
    ...industries,
  ].map((e) => e.id))

  const relationships = pickRelationships(entityGraph, allClusterEntityIds)

  return {
    cluster,
    signals: clusterSignals,
    personas,
    workflows,
    workarounds,
    technologies,
    bottlenecks,
    platformShifts,
    emergingTech,
    buyerRoles,
    existingSolutions,
    industries,
    relationships,
  }
}
