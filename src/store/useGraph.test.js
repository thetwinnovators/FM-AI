import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useGraph } from './useGraph.js'

describe('useGraph', () => {
  it('returns nodes with positions and edges from seed data', () => {
    const { result } = renderHook(() => useGraph())
    expect(result.current.nodes.length).toBeGreaterThan(10)
    expect(result.current.nodes[0].bx).toBeDefined()
    expect(result.current.edges.length).toBeGreaterThan(0)
  })

  it('every node has bx, by, bz position fields from generatePositions', () => {
    const { result } = renderHook(() => useGraph())
    for (const node of result.current.nodes) {
      expect(typeof node.bx).toBe('number')
      expect(typeof node.by).toBe('number')
      expect(typeof node.bz).toBe('number')
    }
  })
})
