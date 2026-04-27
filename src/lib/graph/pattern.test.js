import { describe, it, expect } from 'vitest'
import { computePatterns } from './pattern.js'

const seed = {
  content: [
    { id: 'c1', topicIds: ['t1', 't2'] },
    { id: 'c2', topicIds: ['t1', 't2'] },
    { id: 'c3', topicIds: ['t1', 't3'] },
    { id: 'c4', topicIds: ['t1'] },
  ]
}

describe('computePatterns', () => {
  it('returns coOccurrence pairs sorted by frequency', () => {
    const p = computePatterns(seed, { saves: {}, follows: {}, views: {} })
    const top = p.coOccurrence[0]
    expect([top.a, top.b].sort()).toEqual(['t1', 't2'])
    expect(top.count).toBeGreaterThanOrEqual(2)
  })
  it('boosts edges based on user views', () => {
    const p = computePatterns(seed, { saves: {}, follows: {}, views: { c1: { count: 5, lastAt: '2025-01-01' } } })
    const co = p.coOccurrence.find((x) => [x.a, x.b].sort().join(',') === 't1,t2')
    expect(co.boost).toBeGreaterThan(0)
  })
  it('topicAffinity reflects follows + views on related content', () => {
    const p = computePatterns(seed, {
      saves: { c1: { savedAt: 'x' } },
      follows: { t1: { followedAt: 'x' } },
      views: { c1: { count: 3, lastAt: 'x' } },
    })
    expect(p.topicAffinity.t1).toBeGreaterThan(p.topicAffinity.t3 || 0)
  })
})
