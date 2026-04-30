// Versioned JSON snapshot layer for FlowMap's localStorage state. This is the
// Phase 1 protection per flowmap-persistence-strategy.md — exports cover
// portability + manual disaster recovery while we still rely on localStorage
// as the canonical store. The cache (flowmap.search.cache.v2.*) is treated as
// rebuildable and intentionally excluded.
import { STORAGE_KEY } from '../store/useStore.js'

export const SNAPSHOT_SCHEMA_VERSION = 1

export function buildSnapshot() {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  let data = {}
  try { data = raw ? JSON.parse(raw) : {} } catch { data = {} }
  return {
    app: 'flowmap',
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function snapshotFilename(date = new Date()) {
  const ts = date.toISOString().replace(/[:.]/g, '-').slice(0, 16)
  return `flowmap-backup-${ts}.json`
}

export function downloadSnapshot() {
  const envelope = buildSnapshot()
  const json = JSON.stringify(envelope, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = snapshotFilename()
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return envelope
}

export function validateSnapshot(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'File is not a JSON object.' }
  if (parsed.app !== 'flowmap') return { ok: false, error: 'Not a FlowMap export (missing app marker).' }
  if (typeof parsed.schemaVersion !== 'number') return { ok: false, error: 'Missing schemaVersion.' }
  if (parsed.schemaVersion > SNAPSHOT_SCHEMA_VERSION) {
    return { ok: false, error: `Export is from a newer FlowMap (schema v${parsed.schemaVersion}). Update the app first.` }
  }
  if (!parsed.data || typeof parsed.data !== 'object') return { ok: false, error: 'Missing data payload.' }
  return { ok: true }
}

export function summarizeSnapshot(envelope) {
  const d = envelope?.data || {}
  return {
    saves:         Object.keys(d.saves         || {}).length,
    follows:       Object.keys(d.follows       || {}).length,
    userTopics:    Object.keys(d.userTopics    || {}).length,
    manualContent: Object.keys(d.manualContent || {}).length,
    memoryEntries: Object.keys(d.memoryEntries || {}).length,
    searches:      Object.keys(d.searches      || {}).length,
  }
}

// Replace strategy: localStorage is overwritten with the snapshot's data.
// Caller is responsible for confirming with the user and reloading the page
// so useStore re-initializes from the new state.
export function importSnapshotReplace(envelope) {
  const v = validateSnapshot(envelope)
  if (!v.ok) throw new Error(v.error)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope.data))
}

export async function readSnapshotFile(file) {
  const text = await file.text()
  return JSON.parse(text)
}
