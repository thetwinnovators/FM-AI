// ─── Memory Index — Generator ────────────────────────────────────────────────
//
// Builds a MemoryIndex envelope from all collectors, computes stats, renders
// markdown, and ships both to the Vite dev-server endpoint for disk persistence.
// Call generateAndPersist() from the useMemoryIndex hook.

import { renderMarkdown } from './renderer.js'
import { collectAll } from './collectors.js'
import type { MemoryIndex, MemoryNodeType } from './types.js'
import { ALL_STORAGE_KEYS, GENERATOR_VERSION, MEMORY_NODE_TYPES, SCHEMA_VERSION } from './types.js'

const APP_NAME    = 'FlowMap'
const APP_VERSION = '0.0.0'

// ─── Build ────────────────────────────────────────────────────────────────────

export function buildIndex(): MemoryIndex {
  const nodes = collectAll()

  const byType = Object.fromEntries(
    MEMORY_NODE_TYPES.map((t) => [t, nodes.filter((n) => n.type === t).length])
  ) as Record<MemoryNodeType, number>

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt:   new Date().toISOString(),
    appName:       APP_NAME,
    appVersion:    APP_VERSION,
    stats: {
      total:            nodes.length,
      byType,
      storageKeys:      ALL_STORAGE_KEYS,
      generatorVersion: GENERATOR_VERSION,
    },
    nodes,
  }
}

// ─── Persist (fire-and-forget to Vite dev-server endpoint) ───────────────────

export async function persistIndex(index: MemoryIndex): Promise<void> {
  const markdown = renderMarkdown(index)
  try {
    await fetch('/api/memory-index', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ index, markdown }),
    })
  } catch {
    // Vite dev-server not available (production build) — silently skip.
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateAndPersist(): Promise<MemoryIndex> {
  const index = buildIndex()
  await persistIndex(index)
  return index
}
