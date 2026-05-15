/**
 * entityNormalizer — aggregate SignalEntities across a full signal set into a
 * typed entity registry (Record<id, ExtractedEntity>).
 *
 * Responsibilities:
 *   1. Merge duplicate entities (same type + value) across all signals.
 *   2. Track frequency (how many signals mention each entity).
 *   3. Track mean confidence, first/last-seen timestamps.
 *   4. Produce a stable entity ID (hash of type+value) so the graph can be
 *      rebuilt incrementally without ID churn.
 *
 * This runs after a full scan, not per-signal. It reads the entities[] arrays
 * already attached to each PainSignal by the entityExtractor.
 */

import type { PainSignal, ExtractedEntity, EntityType } from '../types.js'

// ─── Stable ID generation (same hash used across rebuilds) ────────────────────

function entityId(type: EntityType, value: string): string {
  const str = `${type}::${value}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return `ent_${Math.abs(hash).toString(36)}`
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the entity registry from a set of signals.
 * Signals without the entities[] field (legacy) are skipped gracefully.
 *
 * Returns a Record<entityId, ExtractedEntity> ready to store in EntityGraph.
 */
export function buildEntityRegistry(
  signals: PainSignal[],
): Record<string, ExtractedEntity> {
  // Accumulator: entity key → { totalConf, signalIds, firstSeen, lastSeen }
  const acc = new Map<string, {
    entity:     ExtractedEntity
    totalConf:  number
  }>()

  for (const signal of signals) {
    if (!signal.entities?.length) continue

    for (const se of signal.entities) {
      const id  = entityId(se.type, se.value)
      const ts  = signal.detectedAt

      if (acc.has(id)) {
        const entry = acc.get(id)!
        entry.totalConf         += se.confidence
        entry.entity.frequency  += 1
        entry.entity.lastSeen    = entry.entity.lastSeen > ts ? entry.entity.lastSeen : ts
        entry.entity.firstSeen   = entry.entity.firstSeen < ts ? entry.entity.firstSeen : ts
        if (!entry.entity.sourceSignalIds.includes(signal.id)) {
          entry.entity.sourceSignalIds.push(signal.id)
        }
      } else {
        acc.set(id, {
          totalConf: se.confidence,
          entity: {
            id,
            type:            se.type,
            value:           se.value,
            frequency:       1,
            confidence:      se.confidence,
            sourceSignalIds: [signal.id],
            firstSeen:       ts,
            lastSeen:        ts,
          },
        })
      }
    }
  }

  // Finalise mean confidence
  const registry: Record<string, ExtractedEntity> = {}
  for (const [id, { entity, totalConf }] of acc) {
    registry[id] = {
      ...entity,
      confidence: Math.round((totalConf / entity.frequency) * 100) / 100,
    }
  }

  return registry
}

/**
 * For a given cluster (identified by its signalIds), return the top N entity
 * values per type — used to populate OpportunityCluster.entitySummary.
 */
export function summariseClusterEntities(
  signalIds: string[],
  registry:  Record<string, ExtractedEntity>,
  topN = 5,
): NonNullable<import('../types.js').OpportunityCluster['entitySummary']> {
  const idSet = new Set(signalIds)

  // Collect entities that appear in at least one cluster signal
  const byType = new Map<string, Array<{ value: string; freq: number }>>()

  for (const entity of Object.values(registry)) {
    const overlap = entity.sourceSignalIds.filter((sid) => idSet.has(sid)).length
    if (overlap === 0) continue

    if (!byType.has(entity.type)) byType.set(entity.type, [])
    byType.get(entity.type)!.push({ value: entity.value, freq: overlap })
  }

  function topValues(type: string): string[] {
    return (byType.get(type) ?? [])
      .sort((a, b) => b.freq - a.freq)
      .slice(0, topN)
      .map((e) => e.value)
  }

  return {
    personas:          topValues('persona'),
    workflows:         topValues('workflow'),
    technologies:      topValues('technology'),
    workarounds:       topValues('workaround'),
    existingSolutions: topValues('existing_solution'),
    industries:        topValues('industry'),
  }
}

/**
 * Merge an incoming registry (from latest scan) into a persisted registry.
 * Existing entries are updated; new ones are added.
 */
export function mergeRegistries(
  persisted: Record<string, ExtractedEntity>,
  incoming:  Record<string, ExtractedEntity>,
): Record<string, ExtractedEntity> {
  const result = { ...persisted }

  for (const [id, incoming_entity] of Object.entries(incoming)) {
    if (result[id]) {
      const existing = result[id]
      const totalOld = existing.confidence * existing.frequency
      const totalNew = incoming_entity.confidence * incoming_entity.frequency
      const combinedFreq = existing.frequency + incoming_entity.frequency

      const mergedSignalIds = Array.from(
        new Set([...existing.sourceSignalIds, ...incoming_entity.sourceSignalIds]),
      )

      result[id] = {
        ...existing,
        frequency:       combinedFreq,
        confidence:      Math.round(((totalOld + totalNew) / combinedFreq) * 100) / 100,
        sourceSignalIds: mergedSignalIds,
        lastSeen:        existing.lastSeen > incoming_entity.lastSeen
                          ? existing.lastSeen : incoming_entity.lastSeen,
        firstSeen:       existing.firstSeen < incoming_entity.firstSeen
                          ? existing.firstSeen : incoming_entity.firstSeen,
      }
    } else {
      result[id] = incoming_entity
    }
  }

  return result
}
