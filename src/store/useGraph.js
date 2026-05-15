import { useMemo } from 'react'
import { useSeed } from './useSeed.js'
import { useStore } from './useStore.js'
import { buildGraph } from '../lib/graph/buildGraph.js'
import { generatePositions } from '../lib/graph/nodePositions.js'

export function useGraph() {
  const seed = useSeed()
  const { userTopics, documents, manualContent, memoryEntries, saves, views, follows } = useStore()

  return useMemo(() => {
    // Read VS entity graph from isolated VS storage (fm_vs_entity_graph).
    // VS entities are injected as 'signal' nodes on the intelligence tier of the
    // 3D graph — they appear in rose-red (#f43f5e) on the innermost shell.
    // This is a best-effort read: if localStorage is unavailable or the scan
    // hasn't run yet we silently skip it.
    let vsEntityGraph = null
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('fm_vs_entity_graph')
        if (raw) vsEntityGraph = JSON.parse(raw)
      }
    } catch { /* ignore parse errors */ }

    const { nodes, edges } = buildGraph(seed, {
      userTopics, documents, manualContent, memoryEntries, saves, views, follows,
    }, vsEntityGraph)
    const positioned = generatePositions(nodes)
    return { nodes: positioned, edges }
  }, [seed, userTopics, documents, manualContent, memoryEntries, saves, views, follows])
}
