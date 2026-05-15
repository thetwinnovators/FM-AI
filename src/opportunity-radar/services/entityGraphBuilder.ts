/**
 * entityGraphBuilder — build typed relationships between entities from signal
 * co-occurrence within the entity registry.
 *
 * Relationship logic (Schema v1 — co-occurrence based):
 *
 *   persona     → experiences   → pain_point
 *   persona     → performs       → workflow
 *   persona     → uses           → existing_solution
 *   persona     → operates_in    → industry
 *   workflow    → has_friction   → pain_point
 *   workaround  → signals_gap    → pain_point (workaround = unmet need evidence)
 *   workaround  → substitutes    → existing_solution
 *   technology  → enables        → workflow
 *
 * Relationship strength = overlap fraction:
 *   |signals containing both entities| / |signals containing either entity|
 *   (Jaccard similarity — 0 means no overlap, 1 means always co-occur)
 *
 * Minimum threshold: strength >= 0.10 to suppress noise from single signals.
 */

import type {
  ExtractedEntity,
  EntityRelationship,
  RelationshipType,
} from '../types.js'

// ─── Eligible pairs per relationship type ─────────────────────────────────────

const RELATIONSHIP_RULES: Array<{
  fromType: string
  toType:   string
  rel:      RelationshipType
}> = [
  { fromType: 'persona',   toType: 'pain_point',        rel: 'experiences'  },
  { fromType: 'persona',   toType: 'workflow',           rel: 'performs'     },
  { fromType: 'persona',   toType: 'existing_solution',  rel: 'uses'         },
  { fromType: 'persona',   toType: 'industry',           rel: 'operates_in'  },
  { fromType: 'workflow',  toType: 'pain_point',         rel: 'has_friction' },
  { fromType: 'workaround',toType: 'pain_point',         rel: 'signals_gap'  },
  { fromType: 'workaround',toType: 'existing_solution',  rel: 'substitutes'  },
  { fromType: 'technology',toType: 'workflow',           rel: 'enables'      },
]

const MIN_STRENGTH = 0.10

// ─── helpers ──────────────────────────────────────────────────────────────────

function relationshipId(fromId: string, toId: string, rel: RelationshipType): string {
  const str = `${rel}::${fromId}::${toId}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return `rel_${Math.abs(hash).toString(36)}`
}

/** Jaccard similarity between two sets of signal IDs. */
function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  let intersect = 0
  for (const id of setA) { if (setB.has(id)) intersect++ }
  const union = setA.size + setB.size - intersect
  return union === 0 ? 0 : intersect / union
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build all entity relationships from the entity registry.
 * Returns a Record<relationshipId, EntityRelationship>.
 *
 * Complexity: O(E²) over eligible pairs — acceptable for Schema v1 entity
 * counts (typically < 500 entities per scan).
 */
export function buildRelationships(
  registry: Record<string, ExtractedEntity>,
): Record<string, EntityRelationship> {
  const entities  = Object.values(registry)
  const now       = new Date().toISOString()
  const result:   Record<string, EntityRelationship> = {}

  for (const rule of RELATIONSHIP_RULES) {
    const fromEntities = entities.filter((e) => e.type === rule.fromType)
    const toEntities   = entities.filter((e) => e.type === rule.toType)

    for (const from of fromEntities) {
      for (const to of toEntities) {
        const strength = jaccard(from.sourceSignalIds, to.sourceSignalIds)
        if (strength < MIN_STRENGTH) continue

        const evidenceCount = from.sourceSignalIds.filter(
          (sid) => to.sourceSignalIds.includes(sid),
        ).length

        const lastSeen = from.lastSeen > to.lastSeen ? from.lastSeen : to.lastSeen

        const rel: EntityRelationship = {
          id:               relationshipId(from.id, to.id, rule.rel),
          fromId:           from.id,
          toId:             to.id,
          relationshipType: rule.rel,
          strength:         Math.round(strength * 100) / 100,
          evidenceCount,
          lastSeen,
          contradicted:     false,   // Phase 2: detect contradictory evidence
        }

        result[rel.id] = rel
      }
    }
  }

  return result
}

/**
 * Build the complete EntityGraph (entities + relationships).
 * Thin wrapper so callers import one function.
 */
export function buildEntityGraph(registry: Record<string, ExtractedEntity>) {
  return {
    entities:      registry,
    relationships: buildRelationships(registry),
    updatedAt:     new Date().toISOString(),
  }
}

/**
 * Return the top N entities of a given type ranked by frequency, for display.
 */
export function topEntitiesByType(
  registry:  Record<string, ExtractedEntity>,
  type:      string,
  topN = 10,
): ExtractedEntity[] {
  return Object.values(registry)
    .filter((e) => e.type === type)
    .sort((a, b) => b.frequency - a.frequency || b.confidence - a.confidence)
    .slice(0, topN)
}

/**
 * Return all relationships where the given entity is the source (from) node.
 */
export function outgoingRelationships(
  entityId:      string,
  relationships: Record<string, EntityRelationship>,
): EntityRelationship[] {
  return Object.values(relationships)
    .filter((r) => r.fromId === entityId)
    .sort((a, b) => b.strength - a.strength)
}
