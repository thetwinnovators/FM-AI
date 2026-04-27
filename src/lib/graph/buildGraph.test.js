import { describe, it, expect } from 'vitest'
import { buildGraph } from './buildGraph.js'

const seed = {
  topics:    [{ id: 'topic_x', name: 'X' }],
  tools:     [{ id: 'tool_x',  name: 'X tool', topicIds: ['topic_x'] }],
  creators:  [{ id: 'creator_x', name: 'X creator', topicIds: ['topic_x'] }],
  companies: [],
  concepts:  [{ id: 'concept_x', name: 'X concept', topicIds: ['topic_x'] }],
  tags:      [],
  content:   [
    { id: 'vid_x', type: 'video', title: 'X video', topicIds: ['topic_x'], creatorId: 'creator_x', toolIds: ['tool_x'], conceptIds: ['concept_x'], publishedAt: '2025-01-01' }
  ],
  relations: [
    { from: 'tool_x', to: 'topic_x', kind: 'implements', weight: 1.0, evidence: ['vid_x'], lastReinforced: '2025-01-01' }
  ],
}

describe('buildGraph', () => {
  it('produces a node per entity', () => {
    const g = buildGraph(seed)
    const ids = new Set(g.nodes.map((n) => n.id))
    expect(ids.has('topic_x')).toBe(true)
    expect(ids.has('tool_x')).toBe(true)
    expect(ids.has('creator_x')).toBe(true)
    expect(ids.has('concept_x')).toBe(true)
    expect(ids.has('vid_x')).toBe(true)
  })
  it('each node carries id, label, type', () => {
    const g = buildGraph(seed)
    const t = g.nodes.find((n) => n.id === 'topic_x')
    expect(t.label).toBe('X')
    expect(t.type).toBe('topic')
  })
  it('includes explicit edges from relations.json', () => {
    const g = buildGraph(seed)
    const e = g.edges.find((e) => e.from === 'tool_x' && e.to === 'topic_x')
    expect(e).toBeDefined()
    expect(e.kind).toBe('implements')
    expect(e.weight).toBe(1.0)
  })
  it('derives implicit edges from content', () => {
    const g = buildGraph(seed)
    const e1 = g.edges.find((e) => (e.from === 'vid_x' && e.to === 'topic_x') || (e.from === 'topic_x' && e.to === 'vid_x'))
    const e2 = g.edges.find((e) => (e.from === 'vid_x' && e.to === 'creator_x') || (e.from === 'creator_x' && e.to === 'vid_x'))
    expect(e1).toBeDefined()
    expect(e2).toBeDefined()
  })
  it('implicit edges have evidence and weight', () => {
    const g = buildGraph(seed)
    const e = g.edges.find((e) => (e.from === 'vid_x' && e.to === 'topic_x') || (e.from === 'topic_x' && e.to === 'vid_x'))
    expect(e.evidence).toContain('vid_x')
    expect(e.weight).toBeGreaterThan(0)
  })
})
