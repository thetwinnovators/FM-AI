import type { VentureConceptCandidate, VentureScanMeta } from '../types.js'
import type { PainSignal, OpportunityCluster, EntityGraph } from '../../opportunity-radar/types.js'

const EMPTY_GRAPH: EntityGraph = { entities: {}, relationships: {}, updatedAt: '' }

const KEYS = {
  // Corpus-only stores — completely separate from fm_radar_* keys which
  // may contain externally-scraped Reddit/HN data from the old Opportunity Radar
  signals:     'fm_vs_signals',
  clusters:    'fm_vs_clusters',
  entityGraph: 'fm_vs_entity_graph',
  concepts:    'fm_vs_concepts',
  meta:        'fm_vs_meta',
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
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err: unknown) {
    // QuotaExceededError — rethrow with a clear message so the scan UI shows
    // something actionable rather than the raw DOMException.
    if (err instanceof DOMException && (
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err.code === 22
    )) {
      throw new Error(
        'Storage full — click "Reset" in the header to clear old scan data, then run the scan again.',
      )
    }
    throw err
  }
}

/** Maximum number of signals to keep in localStorage.
 *  Keeps the highest-intensity signals to stay within browser storage limits. */
const MAX_VS_SIGNALS = 200

/** Strip heavy text fields from a signal before persisting.
 *  Only the fields actually read after the scan are kept.
 *  painText is truncated to 280 chars — enough for evidence display. */
function slimSignal(s: PainSignal): PainSignal {
  return {
    id:               s.id,
    source:           s.source,
    sourceUrl:        s.sourceUrl,
    painText:         (s.painText ?? '').slice(0, 280),
    painPoint:        s.painPoint ? (s.painPoint as string).slice(0, 200) : s.painPoint,
    intensityScore:   s.intensityScore,
    detectedAt:       s.detectedAt,
    corpusSourceId:   s.corpusSourceId,
    corpusSourceType: s.corpusSourceType,
    corpusTopicId:    s.corpusTopicId,
    documentId:       (s as Record<string, unknown>).documentId as string | undefined,
    entities:         s.entities,
    // intentionally dropped: rawText, content, author, body, summary
  } as PainSignal
}

// ── Signals (corpus-only) ─────────────────────────────────────────────────────
// VS signals come exclusively from ingestCorpus() — saves, documents,
// manualContent, topicSummaries, briefs. No external web-scraping ever touches
// this bucket.

export function loadVsSignals(): PainSignal[] {
  return read<PainSignal[]>(KEYS.signals, [])
}

export function saveVsSignals(signals: PainSignal[]): void {
  write(KEYS.signals, signals)
}

/** Append new signals, deduplicating by id.
 *  Each signal is slimmed (heavy text fields stripped/truncated) and the
 *  merged set is capped to MAX_VS_SIGNALS highest-intensity signals so
 *  repeated scans on large corpora never overflow localStorage. */
export function appendVsSignals(incoming: PainSignal[]): void {
  const existing = loadVsSignals()
  const seen = new Set(existing.map((s) => s.id))
  const merged = [
    ...existing,
    ...incoming.filter((s) => !seen.has(s.id)).map(slimSignal),
  ]

  const pruned = merged.length > MAX_VS_SIGNALS
    ? [...merged]
        .sort((a, b) => (b.intensityScore ?? 0) - (a.intensityScore ?? 0))
        .slice(0, MAX_VS_SIGNALS)
    : merged

  write(KEYS.signals, pruned)
}

// ── Clusters (corpus-only) ────────────────────────────────────────────────────

export function loadVsClusters(): OpportunityCluster[] {
  return read<OpportunityCluster[]>(KEYS.clusters, [])
}

export function saveVsClusters(clusters: OpportunityCluster[]): void {
  write(KEYS.clusters, clusters)
}

// ── Entity graph (corpus-only) ────────────────────────────────────────────────

export function loadVsEntityGraph(): EntityGraph {
  return read<EntityGraph>(KEYS.entityGraph, EMPTY_GRAPH)
}

export function saveVsEntityGraph(graph: EntityGraph): void {
  write(KEYS.entityGraph, graph)
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

  // Primary path: stable ID match — upsert in-place.
  const byId = all.findIndex((c) => c.id === concept.id)
  if (byId >= 0) {
    all[byId] = { ...concept, updatedAt: new Date().toISOString() }
    write(KEYS.concepts, all)
    return
  }

  // Migration path: concept IDs were previously random (Date.now + random).
  // If a record exists for the same cluster + rank, replace it in-place so old
  // random-ID records don't accumulate alongside the new stable-ID records.
  // Skips hard-deleted records (user made an explicit irreversible choice).
  const byClusterRank = all.findIndex(
    (c) => c.clusterId === concept.clusterId &&
           c.rank === concept.rank &&
           c.status !== 'hard_deleted',
  )
  if (byClusterRank >= 0) {
    all[byClusterRank] = { ...concept, updatedAt: new Date().toISOString() }
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

// ── Reset ─────────────────────────────────────────────────────────────────────

/** Wipe clusters, entity graph AND non-archived concepts.
 *  Called from the manual "Reset" button.
 *  Signals are memory-only so no localStorage entry to clear. */
export function clearVsScanData(): void {
  try { localStorage.removeItem(KEYS.signals) } catch {} // remove legacy key if present
  write(KEYS.clusters, [])
  write(KEYS.entityGraph, EMPTY_GRAPH)
  // Only remove non-archived auto-generated concepts; archived ones are user-preserved
  const all = read<VentureConceptCandidate[]>(KEYS.concepts, [])
  const preserved = all.filter((c) => c.status === 'archived')
  write(KEYS.concepts, preserved)
}

/** Wipe clusters and entity graph — but keep ALL concepts intact.
 *  Signals are never persisted (memory-only), so no need to clear them.
 *  Called automatically at the start of every scan. */
export function clearVsScanDataOnly(): void {
  // Remove any legacy fm_vs_signals key left from before this change
  try { localStorage.removeItem(KEYS.signals) } catch {}
  write(KEYS.clusters, [])
  write(KEYS.entityGraph, EMPTY_GRAPH)
}
