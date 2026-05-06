// ─── Memory Index — React Hook ────────────────────────────────────────────────
//
// Provides a React component with the latest MemoryIndex and a "refreshing"
// flag. Rebuilds happen automatically whenever storage modules call
// notifyWrite() / writeMemory() / removeMemory() — no localStorage monkey-
// patching required.

import { useCallback, useEffect, useState } from 'react'
import { generateAndPersist } from './generator.js'
import { subscribe } from './syncQueue.js'
import type { MemoryIndex } from './types.js'

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMemoryIndex() {
  const [index, setIndex]           = useState<MemoryIndex | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // ── One-shot rebuild (used on mount and when the caller wants a force-refresh)
  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const idx = await generateAndPersist()
      setIndex(idx)
    } catch (err) {
      console.warn('[memory-index] refresh failed:', err)
    } finally {
      setRefreshing(false)
    }
  }, [])

  // ── Subscribe to syncQueue: receives the index after every debounced rebuild
  useEffect(() => subscribe(setIndex), [])

  // ── Generate once on mount so the index is populated immediately
  useEffect(() => { refresh() }, [refresh])

  return { index, refreshing, refresh }
}
