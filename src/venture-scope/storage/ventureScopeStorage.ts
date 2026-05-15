import type { VentureConceptCandidate, VentureScanMeta } from '../types.js'

const KEYS = {
  concepts: 'fm_vs_concepts',
  meta:     'fm_vs_meta',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

// ── Concepts ──────────────────────────────────────────────────────────────────

export function loadVsConcepts(
  opts: { includeHardDeleted?: boolean } = {},
): VentureConceptCandidate[] {
  const all = read<VentureConceptCandidate[]>(KEYS.concepts, [])
  return opts.includeHardDeleted ? all : all.filter((c) => c.status !== 'hard_deleted')
}

export function saveVsConcept(concept: VentureConceptCandidate): void {
  const all = read<VentureConceptCandidate[]>(KEYS.concepts, [])
  const idx = all.findIndex((c) => c.id === concept.id)
  if (idx >= 0) {
    all[idx] = { ...concept, updatedAt: new Date().toISOString() }
  } else {
    all.push(concept)
  }
  write(KEYS.concepts, all)
}

export function archiveVsConcept(id: string): void {
  const all = read<VentureConceptCandidate[]>(KEYS.concepts, [])
  const idx = all.findIndex((c) => c.id === id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], status: 'archived', updatedAt: new Date().toISOString() }
    write(KEYS.concepts, all)
  }
}

export function softDeleteVsConcept(id: string): void {
  const all = read<VentureConceptCandidate[]>(KEYS.concepts, [])
  const idx = all.findIndex((c) => c.id === id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], status: 'deleted', updatedAt: new Date().toISOString() }
    write(KEYS.concepts, all)
  }
}

export function hardDeleteVsConcept(id: string): void {
  const all = read<VentureConceptCandidate[]>(KEYS.concepts, [])
  const idx = all.findIndex((c) => c.id === id)
  if (idx >= 0) {
    all[idx] = { ...all[idx], status: 'hard_deleted', updatedAt: new Date().toISOString() }
    write(KEYS.concepts, all)
  }
}

export function getVsConceptsByCluster(clusterId: string): VentureConceptCandidate[] {
  return loadVsConcepts().filter((c) => c.clusterId === clusterId)
}

// ── Meta ──────────────────────────────────────────────────────────────────────

export function loadVsMeta(): VentureScanMeta {
  return read<VentureScanMeta>(KEYS.meta, {
    lastScanAt: null,
    totalSignals: 0,
    totalClusters: 0,
    totalConcepts: 0,
  })
}

export function saveVsMeta(meta: VentureScanMeta): void {
  write(KEYS.meta, meta)
}

// ── Reset (scan data only — never wipes archived/saved concepts) ──────────────

export function clearVsScanData(): void {
  // Only remove non-archived auto-generated concepts; archived ones are user-preserved
  const all = read<VentureConceptCandidate[]>(KEYS.concepts, [])
  const preserved = all.filter((c) => c.status === 'archived')
  write(KEYS.concepts, preserved)
}
