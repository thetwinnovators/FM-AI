// ─── Memory Index — Sync Queue ────────────────────────────────────────────────
//
// Module-level singleton. Storage modules call enqueue() after any write that
// changes data tracked by the index. The queue debounces bursts of writes into
// a single generateAndPersist() call, then notifies React subscribers.
//
// No React dependency — safe to import from any storage module.

import { generateAndPersist } from './generator.js'
import type { MemoryIndex } from './types.js'

const DEBOUNCE_MS = 2000

let timer: ReturnType<typeof setTimeout> | null = null
const subscribers = new Set<(index: MemoryIndex) => void>()

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule a memory-index rebuild. Resets the timer on every call so rapid
 * writes coalesce into one rebuild fired DEBOUNCE_MS after the last write.
 */
export function enqueue(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      const index = await generateAndPersist()
      subscribers.forEach((fn) => fn(index))
    } catch (err) {
      console.warn('[memory-index] sync failed:', err)
    }
  }, DEBOUNCE_MS)
}

/**
 * Subscribe to index-ready events. Returns an unsubscribe function.
 * Subscribers receive the freshly-built MemoryIndex after each rebuild.
 */
export function subscribe(fn: (index: MemoryIndex) => void): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}
