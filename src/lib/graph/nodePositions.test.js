import { describe, it, expect } from 'vitest'
import { generatePositions } from './nodePositions.js'

const nodes = [
  { id: 'a', type: 'company' },
  { id: 'b', type: 'topic'   },
  { id: 'c', type: 'tool'    },
  { id: 'd', type: 'video'   },
  { id: 'e', type: 'creator' },
]

describe('generatePositions', () => {
  it('returns the same number of nodes', () => {
    const out = generatePositions(nodes)
    expect(out.length).toBe(nodes.length)
  })
  it('each output has bx, by, bz, phase', () => {
    const out = generatePositions(nodes)
    for (const n of out) {
      expect(typeof n.bx).toBe('number')
      expect(typeof n.by).toBe('number')
      expect(typeof n.bz).toBe('number')
      expect(typeof n.phase).toBe('number')
    }
  })
  it('clusters by type along x', () => {
    const out = generatePositions(nodes)
    const company = out.find((n) => n.id === 'a').bx
    const creator = out.find((n) => n.id === 'e').bx
    expect(company).toBeLessThan(creator)
  })
  it('is deterministic for the same input', () => {
    const a = generatePositions(nodes).map((n) => n.bx)
    const b = generatePositions(nodes).map((n) => n.bx)
    expect(a).toEqual(b)
  })
})
