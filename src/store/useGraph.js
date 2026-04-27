import { useMemo } from 'react'
import { useSeed } from './useSeed.js'
import { buildGraph } from '../lib/graph/buildGraph.js'
import { generatePositions } from '../lib/graph/nodePositions.js'

export function useGraph() {
  const seed = useSeed()
  return useMemo(() => {
    const { nodes, edges } = buildGraph(seed)
    const positioned = generatePositions(nodes)
    return { nodes: positioned, edges }
  }, [seed])
}
