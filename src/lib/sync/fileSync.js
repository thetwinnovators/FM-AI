// Cross-browser sync for the same-machine case. All browsers point at the
// Vite dev server, which exposes `/api/state` (see vite-plugin-flowmap-sync.js).
// The endpoint reads/writes a single JSON file at `~/.flowmap/state.json`,
// so multiple browsers converge on one source of truth — no auth, no cloud.
//
// Tradeoff: only works while `vite dev` is running. When it's down, each
// browser falls back to its own localStorage; on next reload they re-pull.

const SYNC_PATH = '/api/state'

// Returns { exists: false } | { exists: true, lastModified, data }
export async function pullFromDisk(signal) {
  try {
    const res = await fetch(SYNC_PATH, { signal })
    if (!res.ok) return { exists: false, error: `HTTP ${res.status}` }
    return await res.json()
  } catch (err) {
    if (signal?.aborted) return { exists: false, aborted: true }
    return { exists: false, error: String(err?.message || err) }
  }
}

// Returns { ok, lastModified } | { error }
export async function pushToDisk(payload, signal) {
  try {
    const res = await fetch(SYNC_PATH, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    })
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return await res.json()
  } catch (err) {
    return { error: String(err?.message || err) }
  }
}
