import { useMemo } from 'react'
import { useSeed } from './useSeed.js'
import { useStore } from './useStore.js'
import { buildGraph } from '../lib/graph/buildGraph.js'
import { generatePositions } from '../lib/graph/nodePositions.js'

export function useGraph() {
  const seed = useSeed()
  const { userTopics, documents, manualContent, memoryEntries, saves, views, follows } = useStore()

  return useMemo(() => {
    const { nodes, edges } = buildGraph(seed, {
      userTopics, documents, manualContent, memoryEntries, saves, views, follows,
    })
    const positioned = generatePositions(nodes)
    return { nodes: positioned, edges }
  }, [seed, userTopics, documents, manualContent, memoryEntries, saves, views, follows])
}
