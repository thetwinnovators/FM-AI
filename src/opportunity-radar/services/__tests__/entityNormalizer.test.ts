import { describe, it, expect } from 'vitest'
import { buildEntityRegistry, summariseClusterEntities, mergeRegistries } from '../entityNormalizer.js'
import type { PainSignal, ExtractedEntity, SignalEntity } from '../../types.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeSignal(
  id: string,
  entities: SignalEntity[] = [],
  detectedAt = '2026-05-01T00:00:00Z',
): PainSignal {
  return {
    id,
    detectedAt,
    source: 'reddit',
    sourceUrl: `https://reddit.com/${id}`,
    painText: 'test pain',
    normalizedText: 'test pain',
    keyTerms: ['test'],
    painType: 'workflow',
    intensityScore: 5,
    queryUsed: 'test',
    entities,
  }
}

function entity(type: SignalEntity['type'], value: string, confidence = 0.9): SignalEntity {
  return { type, value, confidence }
}

// ── buildEntityRegistry ───────────────────────────────────────────────────────

describe('buildEntityRegistry', () => {
  it('returns {} for empty signal list', () => {
    expect(buildEntityRegistry([])).toEqual({})
  })

  it('returns {} when all signals have no entities', () => {
    const signals = [makeSignal('s1'), makeSignal('s2')]
    expect(buildEntityRegistry(signals)).toEqual({})
  })

  it('creates one entry per unique type+value pair', () => {
    const signals = [
      makeSignal('s1', [entity('persona', 'developer')]),
      makeSignal('s2', [entity('technology', 'jira')]),
    ]
    const registry = buildEntityRegistry(signals)
    const entries = Object.values(registry)
    expect(entries).toHaveLength(2)
    const types = new Set(entries.map((e) => e.type))
    expect(types.has('persona')).toBe(true)
    expect(types.has('technology')).toBe(true)
  })

  it('entity ID is stable — same type+value always yields same ID', () => {
    const s1 = makeSignal('s1', [entity('persona', 'developer')])
    const s2 = makeSignal('s2', [entity('persona', 'developer')])
    const r1 = buildEntityRegistry([s1])
    const r2 = buildEntityRegistry([s2])
    expect(Object.keys(r1)[0]).toBe(Object.keys(r2)[0])
  })

  it('merges duplicate entity across signals — frequency counts signal occurrences', () => {
    const signals = [
      makeSignal('s1', [entity('persona', 'developer', 0.9)]),
      makeSignal('s2', [entity('persona', 'developer', 0.6)]),
      makeSignal('s3', [entity('persona', 'developer', 0.9)]),
    ]
    const registry = buildEntityRegistry(signals)
    const ent = Object.values(registry)[0]
    expect(ent.frequency).toBe(3)
  })

  it('confidence is the mean across all signal occurrences', () => {
    const signals = [
      makeSignal('s1', [entity('persona', 'developer', 0.9)]),
      makeSignal('s2', [entity('persona', 'developer', 0.6)]),
    ]
    const registry = buildEntityRegistry(signals)
    const ent = Object.values(registry)[0]
    // (0.9 + 0.6) / 2 = 0.75
    expect(ent.confidence).toBe(0.75)
  })

  it('firstSeen is the earliest signal detectedAt', () => {
    const signals = [
      makeSignal('s1', [entity('persona', 'developer')], '2026-04-01T00:00:00Z'),
      makeSignal('s2', [entity('persona', 'developer')], '2026-05-01T00:00:00Z'),
    ]
    const registry = buildEntityRegistry(signals)
    const ent = Object.values(registry)[0]
    expect(ent.firstSeen).toBe('2026-04-01T00:00:00Z')
  })

  it('lastSeen is the latest signal detectedAt', () => {
    const signals = [
      makeSignal('s1', [entity('persona', 'developer')], '2026-04-01T00:00:00Z'),
      makeSignal('s2', [entity('persona', 'developer')], '2026-05-01T00:00:00Z'),
    ]
    const registry = buildEntityRegistry(signals)
    const ent = Object.values(registry)[0]
    expect(ent.lastSeen).toBe('2026-05-01T00:00:00Z')
  })

  it('sourceSignalIds contains all signals that mention the entity (no duplicates)', () => {
    const signals = [
      makeSignal('s1', [entity('persona', 'developer')]),
      makeSignal('s2', [entity('persona', 'developer')]),
      // same signal referenced twice in entities list — should still dedup
      makeSignal('s3', [entity('persona', 'developer'), entity('persona', 'developer')]),
    ]
    const registry = buildEntityRegistry(signals)
    const ent = Object.values(registry)[0]
    expect(new Set(ent.sourceSignalIds).size).toBe(ent.sourceSignalIds.length)
    expect(ent.sourceSignalIds).toContain('s1')
    expect(ent.sourceSignalIds).toContain('s2')
    expect(ent.sourceSignalIds).toContain('s3')
  })

  it('skips legacy signals where entities is undefined', () => {
    const legacySignal = makeSignal('s1')
    delete (legacySignal as any).entities
    expect(buildEntityRegistry([legacySignal])).toEqual({})
  })
})

// ── summariseClusterEntities ──────────────────────────────────────────────────

describe('summariseClusterEntities', () => {
  it('returns all keys with empty arrays when registry is empty', () => {
    const summary = summariseClusterEntities(['s1', 's2'], {})
    expect(summary.personas).toEqual([])
    expect(summary.technologies).toEqual([])
    expect(summary.workarounds).toEqual([])
    expect(summary.industries).toEqual([])
    expect(summary.workflows).toEqual([])
    expect(summary.existingSolutions).toEqual([])
  })

  it('only includes entities whose sourceSignalIds overlap with cluster signalIds', () => {
    const signals = [
      makeSignal('cluster-s1', [entity('persona', 'developer')]),
      makeSignal('other-s1',   [entity('persona', 'designer')]),
    ]
    const registry = buildEntityRegistry(signals)
    const summary = summariseClusterEntities(['cluster-s1'], registry)
    expect(summary.personas).toContain('developer')
    expect(summary.personas).not.toContain('designer')
  })

  it('returns values sorted by overlap frequency (descending)', () => {
    // 'developer' appears in 3 cluster signals, 'engineer' in 1
    const signals = [
      makeSignal('s1', [entity('persona', 'developer')]),
      makeSignal('s2', [entity('persona', 'developer')]),
      makeSignal('s3', [entity('persona', 'developer'), entity('persona', 'engineer')]),
    ]
    const registry = buildEntityRegistry(signals)
    const summary = summariseClusterEntities(['s1', 's2', 's3'], registry)
    expect(summary.personas[0]).toBe('developer')
  })

  it('respects topN limit', () => {
    const signals = Array.from({ length: 8 }, (_, i) =>
      makeSignal(`s${i}`, [entity('technology', `tool${i}`)]),
    )
    const registry = buildEntityRegistry(signals)
    const signalIds = signals.map((s) => s.id)
    const summary = summariseClusterEntities(signalIds, registry, 3)
    expect(summary.technologies.length).toBeLessThanOrEqual(3)
  })
})

// ── mergeRegistries ───────────────────────────────────────────────────────────

describe('mergeRegistries', () => {
  /** Build a minimal ExtractedEntity for merge tests. */
  function makeEntity(
    id: string,
    type: ExtractedEntity['type'],
    value: string,
    frequency = 1,
    confidence = 0.8,
    signalIds: string[] = [],
    firstSeen = '2026-04-01T00:00:00Z',
    lastSeen  = '2026-04-01T00:00:00Z',
  ): ExtractedEntity {
    return { id, type, value, frequency, confidence, sourceSignalIds: signalIds, firstSeen, lastSeen }
  }

  it('returns persisted entries unchanged when incoming is empty', () => {
    const persisted = { e1: makeEntity('e1', 'persona', 'developer') }
    const merged = mergeRegistries(persisted, {})
    expect(merged).toEqual(persisted)
  })

  it('adds new entries from incoming when persisted is empty', () => {
    const incoming = { e1: makeEntity('e1', 'persona', 'developer') }
    const merged = mergeRegistries({}, incoming)
    expect(merged).toEqual(incoming)
  })

  it('adds a brand-new entity from incoming to the result', () => {
    const persisted = { e1: makeEntity('e1', 'persona', 'developer') }
    const incoming  = { e2: makeEntity('e2', 'technology', 'jira') }
    const merged = mergeRegistries(persisted, incoming)
    expect(Object.keys(merged)).toHaveLength(2)
    expect(merged['e2'].value).toBe('jira')
  })

  it('increments frequency when the same entity appears in both', () => {
    const persisted = { e1: makeEntity('e1', 'persona', 'developer', 3, 0.9, ['s1', 's2', 's3']) }
    const incoming  = { e1: makeEntity('e1', 'persona', 'developer', 2, 0.6, ['s4', 's5']) }
    const merged = mergeRegistries(persisted, incoming)
    expect(merged['e1'].frequency).toBe(5)
  })

  it('averages confidence weighted by frequency', () => {
    // persisted: freq=2 conf=0.9 → total=1.8; incoming: freq=2 conf=0.6 → total=1.2
    // combined: (1.8+1.2)/4 = 0.75
    const persisted = { e1: makeEntity('e1', 'persona', 'developer', 2, 0.9) }
    const incoming  = { e1: makeEntity('e1', 'persona', 'developer', 2, 0.6) }
    const merged = mergeRegistries(persisted, incoming)
    expect(merged['e1'].confidence).toBe(0.75)
  })

  it('merges sourceSignalIds without duplicates', () => {
    const persisted = { e1: makeEntity('e1', 'persona', 'developer', 1, 0.9, ['s1', 's2']) }
    const incoming  = { e1: makeEntity('e1', 'persona', 'developer', 1, 0.9, ['s2', 's3']) }
    const merged = mergeRegistries(persisted, incoming)
    const ids = merged['e1'].sourceSignalIds
    // s2 appears in both — should not be duplicated
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('s1')
    expect(ids).toContain('s2')
    expect(ids).toContain('s3')
  })

  it('lastSeen is the later of the two dates', () => {
    const persisted = { e1: makeEntity('e1', 'persona', 'developer', 1, 0.8, [], '2026-03-01T00:00:00Z', '2026-04-01T00:00:00Z') }
    const incoming  = { e1: makeEntity('e1', 'persona', 'developer', 1, 0.8, [], '2026-03-01T00:00:00Z', '2026-05-01T00:00:00Z') }
    const merged = mergeRegistries(persisted, incoming)
    expect(merged['e1'].lastSeen).toBe('2026-05-01T00:00:00Z')
  })

  it('firstSeen is the earlier of the two dates', () => {
    const persisted = { e1: makeEntity('e1', 'persona', 'developer', 1, 0.8, [], '2026-04-01T00:00:00Z', '2026-05-01T00:00:00Z') }
    const incoming  = { e1: makeEntity('e1', 'persona', 'developer', 1, 0.8, [], '2026-03-01T00:00:00Z', '2026-05-01T00:00:00Z') }
    const merged = mergeRegistries(persisted, incoming)
    expect(merged['e1'].firstSeen).toBe('2026-03-01T00:00:00Z')
  })
})
