import type { PainSignal, OpportunityCluster, AppConcept, RadarScanMeta, CategoryChart, WinningApp, EntityGraph } from '../types.js'
import { pullFromDisk, pushToDisk } from '../../lib/sync/fileSync.js'
import { enqueue } from '../../memory-index/syncQueue.js'

const KEYS = {
  signals:     'fm_radar_signals',
  clusters:    'fm_radar_clusters',
  concepts:    'fm_radar_concepts',
  meta:        'fm_radar_meta',
  charts:      'fm_radar_charts',
  winningApps: 'fm_radar_winning_apps',
  entityGraph: 'fm_radar_entity_graph',   // Schema v1: living entity graph
} as const

const EMPTY_GRAPH: EntityGraph = { entities: {}, relationships: {}, updatedAt: '' }

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
  enqueue()
}

let _syncTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSync(): void {
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(async () => {
    try {
      const pulled = await pullFromDisk()
      const base: Record<string, unknown> =
        pulled?.exists && pulled?.data && typeof pulled.data === 'object'
          ? { ...(pulled.data as object) }
          : {}
      base.radar = {
        signals:     read<PainSignal[]>(KEYS.signals,  []),
        clusters:    read<OpportunityCluster[]>(KEYS.clusters, []),
        concepts:    read<AppConcept[]>(KEYS.concepts, []),
        meta:        read<RadarScanMeta>(KEYS.meta, { lastScanAt: null, totalSignals: 0, totalClusters: 0 }),
        charts:      read<CategoryChart[]>(KEYS.charts, []),
        winningApps: read<WinningApp[]>(KEYS.winningApps, []),
      }
      await pushToDisk(base)
    } catch {
      // Non-fatal — localStorage remains source of truth
    }
  }, 600)
}

// ── Signals ─────────────────────────────────────────────────────────────────

export function loadSignals(): PainSignal[] {
  return read<PainSignal[]>(KEYS.signals, [])
}

export function saveSignals(signals: PainSignal[]): void {
  write(KEYS.signals, signals)
  scheduleSync()
}

export function appendSignals(incoming: PainSignal[]): void {
  const existing = loadSignals()
  const existingIds = new Set(existing.map((s) => s.id))
  const merged = [...existing, ...incoming.filter((s) => !existingIds.has(s.id))]
  saveSignals(merged)
}

// ── Clusters ─────────────────────────────────────────────────────────────────

export function loadClusters(): OpportunityCluster[] {
  return read<OpportunityCluster[]>(KEYS.clusters, [])
}

export function saveClusters(clusters: OpportunityCluster[]): void {
  write(KEYS.clusters, clusters)
  scheduleSync()
}

// ── Concepts ─────────────────────────────────────────────────────────────────

export function loadConcepts(): AppConcept[] {
  return read<AppConcept[]>(KEYS.concepts, [])
}

export function saveConcept(concept: AppConcept): void {
  const existing = loadConcepts()
  const idx = existing.findIndex((c) => c.id === concept.id)
  if (idx >= 0) {
    existing[idx] = concept
  } else {
    existing.push(concept)
  }
  write(KEYS.concepts, existing)
  scheduleSync()
}

export function getConceptByClusterId(clusterId: string): AppConcept | undefined {
  return loadConcepts().find((c) => c.clusterId === clusterId)
}

// ── Meta ─────────────────────────────────────────────────────────────────────

export function loadMeta(): RadarScanMeta {
  return read<RadarScanMeta>(KEYS.meta, { lastScanAt: null, totalSignals: 0, totalClusters: 0 })
}

export function saveMeta(meta: RadarScanMeta): void {
  write(KEYS.meta, meta)
  scheduleSync()
}

// ── Charts ───────────────────────────────────────────────────────────────────

export function loadCharts(): CategoryChart[] {
  return read<CategoryChart[]>(KEYS.charts, [])
}

export function saveCharts(charts: CategoryChart[]): void {
  write(KEYS.charts, charts)
  scheduleSync()
}

// ── Winning apps ─────────────────────────────────────────────────────────────

export function loadWinningApps(): WinningApp[] {
  return read<WinningApp[]>(KEYS.winningApps, [])
}

export function saveWinningApps(apps: WinningApp[]): void {
  write(KEYS.winningApps, apps)
  scheduleSync()
}

// ── Entity graph (Schema v1) ──────────────────────────────────────────────────

export function loadEntityGraph(): EntityGraph {
  return read<EntityGraph>(KEYS.entityGraph, EMPTY_GRAPH)
}

export function saveEntityGraph(graph: EntityGraph): void {
  write(KEYS.entityGraph, graph)
  scheduleSync()
}

// ── Reset ─────────────────────────────────────────────────────────────────────

export function clearAll(): void {
  // Only clear scan data — charts and winning apps survive reset.
  // Note: removals bypass write(), so enqueue() must be called explicitly here.
  ;[KEYS.signals, KEYS.clusters, KEYS.concepts, KEYS.meta, KEYS.entityGraph].forEach((k) => localStorage.removeItem(k))
  enqueue()
  scheduleSync()
}

const radarStorage = {
  loadSignals, saveSignals, appendSignals,
  loadClusters, saveClusters,
  loadConcepts, saveConcept, getConceptByClusterId,
  loadMeta, saveMeta,
  loadCharts, saveCharts,
  loadWinningApps, saveWinningApps,
  loadEntityGraph, saveEntityGraph,
  clearAll,
}

export default radarStorage
