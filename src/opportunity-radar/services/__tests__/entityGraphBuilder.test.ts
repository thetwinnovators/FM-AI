import { describe, it, expect } from 'vitest'
import { buildRelationships, buildEntityGraph, topEntitiesByType, outgoingRelationships } from '../entityGraphBuilder.js'
import type { ExtractedEntity } from '../../types.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeEntity(
  id:       string,
  type:     ExtractedEntity['type'],
  value:    string,
  signalIds: string[],
  frequency = signalIds.length,
  confidence = 0.8,
): ExtractedEntity {
  const now = new Date().toISOString()
  return { id, type, value, frequency, confidence, sourceSignalIds: signalIds, firstSeen: now, lastSeen: now }
}

// ── buildRelationships ────────────────────────────────────────────────────────

describe('buildRelationships', () => {
  it('returns {} for empty registry', () => {
    expect(buildRelationships({})).toEqual({})
  })

  it('returns {} when no entities meet any relationship rule', () => {
    // Two personas — no rule maps persona→persona
    const registry = {
      e1: makeEntity('e1', 'persona', 'developer', ['s1', 's2']),
      e2: makeEntity('e2', 'persona', 'designer',  ['s2', 's3']),
    }
    expect(buildRelationships(registry)).toEqual({})
  })

  it('creates a relationship when persona and workflow share signals', () => {
    const registry = {
      e1: makeEntity('e1', 'persona',  'developer',       ['s1', 's2', 's3']),
      e2: makeEntity('e2', 'workflow', 'deploying builds', ['s2', 's3', 's4']),
    }
    const rels = buildRelationships(registry)
    const entries = Object.values(rels)
    // persona → performs → workflow
    expect(entries.length).toBeGreaterThan(0)
    const rel = entries.find((r) => r.relationshipType === 'performs')
    expect(rel).toBeDefined()
    expect(rel!.fromId).toBe('e1')
    expect(rel!.toId).toBe('e2')
  })

  it('relationship strength equals Jaccard similarity', () => {
    // Intersection {s2, s3} = 2, union {s1,s2,s3,s4} = 4, Jaccard = 0.5
    const registry = {
      e1: makeEntity('e1', 'persona',  'developer',       ['s1', 's2', 's3']),
      e2: makeEntity('e2', 'workflow', 'deploying builds', ['s2', 's3', 's4']),
    }
    const rels = buildRelationships(registry)
    const rel = Object.values(rels)[0]
    expect(rel.strength).toBe(0.5)
  })

  it('filters out pairs whose Jaccard similarity is below 0.10', () => {
    // Only s2 is shared out of 10+ total — Jaccard well below 0.10
    const registry = {
      e1: makeEntity('e1', 'persona',  'developer', ['s1','s2','s3','s4','s5','s6','s7','s8','s9','s10']),
      e2: makeEntity('e2', 'workflow', 'deploying', ['s2','s11','s12','s13','s14','s15','s16','s17','s18','s19','s20']),
    }
    // Jaccard = 1 / (10+11-1) = 1/20 = 0.05 — below threshold
    const rels = buildRelationships(registry)
    expect(Object.values(rels)).toHaveLength(0)
  })

  it('evidenceCount is the number of shared signal IDs', () => {
    const registry = {
      e1: makeEntity('e1', 'persona',  'developer',       ['s1', 's2', 's3']),
      e2: makeEntity('e2', 'workflow', 'deploying builds', ['s2', 's3', 's4']),
    }
    const rels = buildRelationships(registry)
    const rel  = Object.values(rels)[0]
    expect(rel.evidenceCount).toBe(2) // s2 and s3
  })

  it('creates workaround → substitutes → existing_solution relationship', () => {
    const registry = {
      e1: makeEntity('e1', 'workaround',         'bash script',  ['s1', 's2', 's3']),
      e2: makeEntity('e2', 'existing_solution',  'jenkins',      ['s2', 's3', 's4']),
    }
    const rels = buildRelationships(registry)
    const rel = Object.values(rels).find((r) => r.relationshipType === 'substitutes')
    expect(rel).toBeDefined()
  })

  it('creates technology → enables → workflow relationship', () => {
    const registry = {
      e1: makeEntity('e1', 'technology', 'github actions', ['s1', 's2', 's3']),
      e2: makeEntity('e2', 'workflow',   'ci/cd pipeline', ['s2', 's3', 's4']),
    }
    const rels = buildRelationships(registry)
    const rel = Object.values(rels).find((r) => r.relationshipType === 'enables')
    expect(rel).toBeDefined()
  })

  it('relationship IDs are stable — same inputs produce same ID', () => {
    const registry = {
      e1: makeEntity('e1', 'persona',  'developer',       ['s1', 's2', 's3']),
      e2: makeEntity('e2', 'workflow', 'deploying builds', ['s2', 's3', 's4']),
    }
    const r1 = buildRelationships(registry)
    const r2 = buildRelationships(registry)
    expect(Object.keys(r1)).toEqual(Object.keys(r2))
  })
})

// ── buildEntityGraph ──────────────────────────────────────────────────────────

describe('buildEntityGraph', () => {
  it('returns an object with entities, relationships, and updatedAt', () => {
    const registry = {
      e1: makeEntity('e1', 'persona',  'developer',       ['s1', 's2']),
      e2: makeEntity('e2', 'workflow', 'deploying builds', ['s1', 's2']),
    }
    const graph = buildEntityGraph(registry)
    expect(graph.entities).toBe(registry)
    expect(typeof graph.relationships).toBe('object')
    expect(typeof graph.updatedAt).toBe('string')
    expect(() => new Date(graph.updatedAt)).not.toThrow()
  })

  it('updatedAt is a valid ISO 8601 date string', () => {
    const graph = buildEntityGraph({})
    expect(new Date(graph.updatedAt).toISOString()).toBe(graph.updatedAt)
  })
})

// ── topEntitiesByType ─────────────────────────────────────────────────────────

describe('topEntitiesByType', () => {
  it('returns [] when no entities match the requested type', () => {
    const registry = { e1: makeEntity('e1', 'persona', 'developer', ['s1']) }
    expect(topEntitiesByType(registry, 'technology')).toEqual([])
  })

  it('filters to only the requested type', () => {
    const registry = {
      e1: makeEntity('e1', 'persona',    'developer', ['s1']),
      e2: makeEntity('e2', 'technology', 'jira',      ['s1']),
    }
    const result = topEntitiesByType(registry, 'persona')
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('persona')
  })

  it('sorts by frequency descending', () => {
    const registry = {
      e1: makeEntity('e1', 'persona', 'developer', ['s1'],              1),
      e2: makeEntity('e2', 'persona', 'designer',  ['s1','s2','s3'],    3),
      e3: makeEntity('e3', 'persona', 'pm',        ['s1','s2'],         2),
    }
    const result = topEntitiesByType(registry, 'persona')
    expect(result[0].value).toBe('designer')  // freq 3
    expect(result[1].value).toBe('pm')         // freq 2
    expect(result[2].value).toBe('developer')  // freq 1
  })

  it('breaks frequency ties by confidence descending', () => {
    const registry = {
      e1: makeEntity('e1', 'persona', 'developer', ['s1'], 2, 0.60),
      e2: makeEntity('e2', 'persona', 'designer',  ['s1'], 2, 0.90),
    }
    const result = topEntitiesByType(registry, 'persona')
    expect(result[0].value).toBe('designer') // higher confidence wins tie
  })

  it('respects topN limit (default 10)', () => {
    const registry = Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => {
        const id = `e${i}`
        return [id, makeEntity(id, 'persona', `person${i}`, ['s1'])]
      }),
    )
    expect(topEntitiesByType(registry, 'persona')).toHaveLength(10)
    expect(topEntitiesByType(registry, 'persona', 3)).toHaveLength(3)
  })
})

// ── outgoingRelationships ─────────────────────────────────────────────────────

describe('outgoingRelationships', () => {
  it('returns [] when the entity has no outgoing relationships', () => {
    const registry = {
      e1: makeEntity('e1', 'persona',  'developer',       ['s1', 's2', 's3']),
      e2: makeEntity('e2', 'workflow', 'deploying builds', ['s2', 's3', 's4']),
    }
    const rels = buildRelationships(registry)
    // e2 (workflow) is never a fromId under current rules
    const result = outgoingRelationships('e2', rels)
    expect(result).toEqual([])
  })

  it('returns all relationships where fromId matches', () => {
    const registry = {
      e1: makeEntity('e1', 'persona',  'developer',         ['s1','s2','s3']),
      e2: makeEntity('e2', 'workflow', 'onboarding',        ['s2','s3','s4']),
      e3: makeEntity('e3', 'workflow', 'deploying builds',  ['s1','s2','s3']),
    }
    const rels = buildRelationships(registry)
    const outgoing = outgoingRelationships('e1', rels)
    // persona → performs → both workflows
    expect(outgoing.length).toBeGreaterThanOrEqual(2)
    expect(outgoing.every((r) => r.fromId === 'e1')).toBe(true)
  })

  it('sorts by strength descending', () => {
    // s1+s2+s3 overlap e2 in 3/4 signals (strength=0.75)
    // s1 overlap e3 in 1/6 signals (strength~=0.25)
    const registry = {
      e1: makeEntity('e1', 'persona',  'developer',        ['s1','s2','s3']),
      e2: makeEntity('e2', 'workflow', 'onboarding',       ['s1','s2','s3','s4']),
      e3: makeEntity('e3', 'workflow', 'deploying builds', ['s1','s4','s5','s6']),
    }
    const rels = buildRelationships(registry)
    const outgoing = outgoingRelationships('e1', rels)
    // The first result should be the stronger relationship
    if (outgoing.length >= 2) {
      expect(outgoing[0].strength).toBeGreaterThanOrEqual(outgoing[1].strength)
    }
  })
})
