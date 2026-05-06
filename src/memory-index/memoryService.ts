// ─── Memory Service ───────────────────────────────────────────────────────────
//
// The single write API for all FlowMap memory domains. Storage modules use
// writeMemory() / removeMemory() instead of calling localStorage directly.
// This gives the memory index a reliable trigger point and makes future
// backend migrations (IndexedDB, SQLite, filesystem) a one-file change.
//
// Migration path for existing callsites that already write to localStorage:
//   import { notifyWrite } from '../memory-index/memoryService.js'
//   … (your existing localStorage.setItem call) …
//   notifyWrite(key)
//
// Once notifyWrite is wired in, replace the localStorage call with writeMemory()
// at your own pace to consolidate all writes through this service.

import { enqueue } from './syncQueue.js'

// Keys (or prefixes) whose writes should trigger an index rebuild.
const WATCHED_PREFIXES: readonly string[] = [
  'flowmap.v1',
  'flowmap.ollama',
  'flowmap.voice',
  'flowmap.theme',
  'flowmap.searxng',
  'flowmap.topics',
  'flowmap.topic.',
  'flowmap.signals',
  'flowmap.mcp',
  'fm_radar_',
  'fm_signals_',
  'fm_mcp_',
]

function isWatched(key: string): boolean {
  return WATCHED_PREFIXES.some((p) => key.startsWith(p))
}

// ─── Write API ────────────────────────────────────────────────────────────────

/**
 * Serialize `value` to JSON, write to localStorage under `key`, and trigger
 * an index rebuild if the key is in a watched domain.
 *
 * Prefer this over direct `localStorage.setItem` for any key tracked by the
 * memory index.
 */
export function writeMemory(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage quota exceeded — not much we can do.
  }
  if (isWatched(key)) enqueue()
}

/**
 * Remove `key` from localStorage and trigger an index rebuild if the key is
 * in a watched domain.
 */
export function removeMemory(key: string): void {
  localStorage.removeItem(key)
  if (isWatched(key)) enqueue()
}

/**
 * Notify the index that `key` was written externally (i.e. by a callsite that
 * still calls localStorage.setItem directly). Triggers an index rebuild.
 *
 * Use this as a lightweight migration shim before fully switching to
 * writeMemory(). Pass no key to trigger unconditionally.
 */
export function notifyWrite(key?: string): void {
  if (!key || isWatched(key)) enqueue()
}
