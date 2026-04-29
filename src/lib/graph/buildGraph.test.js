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

const emptyUserState = {
  userTopics: {}, documents: {}, manualContent: {}, memoryEntries: {},
  saves: {}, views: {}, follows: {},
}

describe('buildGraph — user entity injection', () => {
  it('injects userTopics as topic nodes', () => {
    const userState = {
      ...emptyUserState,
      userTopics: {
        'utopic_1': { id: 'utopic_1', name: 'My Topic', slug: 'my-topic', summary: 'custom' },
      },
    }
    const g = buildGraph(seed, userState)
    const node = g.nodes.find((n) => n.id === 'utopic_1')
    expect(node).toBeDefined()
    expect(node.type).toBe('topic')
    expect(node.label).toBe('My Topic')
  })

  it('injects manualContent as typed nodes with edges to their topicIds', () => {
    const userState = {
      ...emptyUserState,
      manualContent: {
        'art_1': {
          id: 'art_1',
          item: { id: 'art_1', type: 'article', title: 'A great read', summary: '' },
          topicIds: ['topic_x'],
          savedAt: '2026-01-01',
        },
      },
    }
    const g = buildGraph(seed, userState)
    const node = g.nodes.find((n) => n.id === 'art_1')
    expect(node).toBeDefined()
    expect(node.type).toBe('article')
    const edge = g.edges.find((e) =>
      (e.from === 'art_1' && e.to === 'topic_x') || (e.from === 'topic_x' && e.to === 'art_1')
    )
    expect(edge).toBeDefined()
    expect(edge.kind).toBe('covers')
  })

  it('injects documents as document type nodes', () => {
    const userState = {
      ...emptyUserState,
      documents: {
        'doc_1': { id: 'doc_1', title: 'My Notes', topics: [], excerpt: 'intro text', updatedAt: '2026-01-01' },
      },
    }
    const g = buildGraph(seed, userState)
    const node = g.nodes.find((n) => n.id === 'doc_1')
    expect(node).toBeDefined()
    expect(node.type).toBe('document')
    expect(node.label).toBe('My Notes')
    expect(node.summary).toBe('intro text')
  })

  it('generates edges from document.topics to resolved seed topic', () => {
    const userState = {
      ...emptyUserState,
      documents: {
        'doc_2': { id: 'doc_2', title: 'Notes', topics: ['topic_x'], excerpt: '', updatedAt: '2026-01-01' },
      },
    }
    const g = buildGraph(seed, userState)
    const edge = g.edges.find((e) =>
      (e.from === 'doc_2' && e.to === 'topic_x') || (e.from === 'topic_x' && e.to === 'doc_2')
    )
    expect(edge).toBeDefined()
  })

  it('injects memoryEntries as memory nodes', () => {
    const userState = {
      ...emptyUserState,
      memoryEntries: {
        'mem_1': { id: 'mem_1', content: 'Focus on interpretability research', category: 'research_focus' },
      },
    }
    const g = buildGraph(seed, userState)
    const node = g.nodes.find((n) => n.id === 'mem_1')
    expect(node).toBeDefined()
    expect(node.type).toBe('memory')
  })

  it('does not duplicate nodes already in the seed', () => {
    const userState = {
      ...emptyUserState,
      manualContent: {
        'topic_x': {
          id: 'topic_x',
          item: { id: 'topic_x', type: 'article', title: 'Duplicate' },
          topicIds: [],
        },
      },
    }
    const g = buildGraph(seed, userState)
    const dupes = g.nodes.filter((n) => n.id === 'topic_x')
    expect(dupes.length).toBe(1)
  })

  it('backward-compatible: works with no userState argument', () => {
    const g = buildGraph(seed)
    expect(g.nodes.length).toBeGreaterThan(0)
    expect(g.edges.length).toBeGreaterThan(0)
  })
})

describe('buildGraph — signal edge boosts', () => {
  const seedWithRelation = {
    ...seed,
    relations: [{ from: 'tool_x', to: 'topic_x', kind: 'implements', weight: 0.5, evidence: [], lastReinforced: null }],
  }

  it('boosts edge weight for followed topic', () => {
    const userState = { ...emptyUserState, follows: { 'topic_x': { followedAt: '2026-01-01' } } }
    const g = buildGraph(seedWithRelation, userState)
    const edge = g.edges.find((e) => e.from === 'tool_x' && e.to === 'topic_x')
    expect(edge.weight).toBeCloseTo(0.7, 1) // 0.5 * 1.4
  })

  it('boosts edge weight for saved content node', () => {
    const userState = { ...emptyUserState, saves: { 'tool_x': { savedAt: '2026-01-01' } } }
    const g = buildGraph(seedWithRelation, userState)
    const edge = g.edges.find((e) => e.from === 'tool_x' && e.to === 'topic_x')
    expect(edge.weight).toBeCloseTo(0.65, 2) // 0.5 + 0.15
  })

  it('boosts edge weight for viewed content node', () => {
    const userState = { ...emptyUserState, views: { 'tool_x': { count: 5, lastAt: '2026-01-01' } } }
    const g = buildGraph(seedWithRelation, userState)
    const edge = g.edges.find((e) => e.from === 'tool_x' && e.to === 'topic_x')
    // 0.5 + min(0.1, 5 * 0.02) = 0.5 + 0.1 = 0.6
    expect(edge.weight).toBeCloseTo(0.6, 2)
  })

  it('caps boosted weight at 1.0', () => {
    const userState = {
      ...emptyUserState,
      follows: { 'topic_x': { followedAt: '2026-01-01' } },
      saves:   { 'tool_x': { savedAt: '2026-01-01' } },
      views:   { 'tool_x': { count: 100, lastAt: '2026-01-01' } },
    }
    const g = buildGraph(seedWithRelation, userState)
    const edge = g.edges.find((e) => e.from === 'tool_x' && e.to === 'topic_x')
    expect(edge.weight).toBeLessThanOrEqual(1.0)
  })
})
