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

  it('places non-memory nodes on a sphere shell around the origin', () => {
    const out = generatePositions(nodes)
    for (const n of out) {
      const r = Math.sqrt(n.bx ** 2 + n.by ** 2 + n.bz ** 2)
      expect(r).toBeGreaterThan(1.5)
      expect(r).toBeLessThan(3.5)
    }
  })

  it('places memory nodes near the origin', () => {
    const out = generatePositions([{ id: 'm1', type: 'memory' }])
    const r = Math.sqrt(out[0].bx ** 2 + out[0].by ** 2 + out[0].bz ** 2)
    expect(r).toBeLessThan(0.6)
  })

  it('is deterministic for the same input', () => {
    const a = generatePositions(nodes).map((n) => [n.bx, n.by, n.bz])
    const b = generatePositions(nodes).map((n) => [n.bx, n.by, n.bz])
    expect(a).toEqual(b)
  })
})
