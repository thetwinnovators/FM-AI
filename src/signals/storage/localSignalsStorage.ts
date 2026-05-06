import type { SignalTopic, SignalSource, SignalItem, ScanConfig } from '../types.js'
import { pullFromDisk, pushToDisk } from '../../lib/sync/fileSync.js'
import { enqueue } from '../../memory-index/syncQueue.js'

const KEYS = {
  topics: 'fm_signals_topics',
  sources: 'fm_signals_sources',
  items: 'fm_signals_items',
  config: 'fm_signals_config',
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
  enqueue()
}

const DEFAULT_CONFIG: ScanConfig = {
  youtubeFrequency: 'manual',
  alertsFrequency: 'manual',
}

// ── Cross-browser disk sync ───────────────────────────────────────────────────
// Signals are merged into the same ~/.flowmap/state.json that the main store
// uses (see vite-plugin-flowmap-sync.js). All browsers on the same machine
// hit the Vite dev server and converge on a single file.

let _syncTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSync(): void {
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(async () => {
    try {
      // Read current disk payload so we don't clobber the main store keys.
      const pulled = await pullFromDisk()
      const base: Record<string, unknown> =
        pulled?.exists && pulled?.data && typeof pulled.data === 'object'
          ? { ...(pulled.data as object) }
          : {}

      base.signals = {
        topics:  read<SignalTopic[]>(KEYS.topics,  []),
        sources: read<SignalSource[]>(KEYS.sources, []),
        items:   read<SignalItem[]>(KEYS.items,   []),
        config:  read<ScanConfig>(KEYS.config,  DEFAULT_CONFIG),
      }

      await pushToDisk(base)
    } catch {
      // Non-fatal — localStorage remains the local source of truth.
    }
  }, 600)
}

// Call on app / Signals page mount so every browser loads the latest data.
export async function hydrateSignalsFromDisk(): Promise<void> {
  try {
    const res = await pullFromDisk()
    if (!res?.exists || !res?.data?.signals) return
    const { topics, sources, items, config } = res.data.signals as {
      topics?: SignalTopic[]
      sources?: SignalSource[]
      items?: SignalItem[]
      config?: ScanConfig
    }
    if (Array.isArray(topics))  write(KEYS.topics,  topics)
    if (Array.isArray(sources)) write(KEYS.sources, sources)
    if (Array.isArray(items))   write(KEYS.items,   items)
    if (config && typeof config === 'object') write(KEYS.config, config)
  } catch {
    // Offline or dev server not running — silently fall back to localStorage.
  }
}

// ── Storage API ───────────────────────────────────────────────────────────────

export const localSignalsStorage = {
  // Topics
  listTopics(): SignalTopic[] {
    return read<SignalTopic[]>(KEYS.topics, [])
  },
  saveTopic(topic: SignalTopic): void {
    const list = this.listTopics().filter((t) => t.id !== topic.id)
    write(KEYS.topics, [...list, topic])
    scheduleSync()
  },
  deleteTopic(id: string): void {
    write(KEYS.topics, this.listTopics().filter((t) => t.id !== id))
    scheduleSync()
  },

  // Sources
  listSources(): SignalSource[] {
    return read<SignalSource[]>(KEYS.sources, [])
  },
  saveSource(source: SignalSource): void {
    const list = this.listSources().filter((s) => s.id !== source.id)
    write(KEYS.sources, [...list, source])
    scheduleSync()
  },
  deleteSource(id: string): void {
    write(KEYS.sources, this.listSources().filter((s) => s.id !== id))
    scheduleSync()
  },

  // Signal items
  listSignals(): SignalItem[] {
    return read<SignalItem[]>(KEYS.items, [])
  },
  saveSignal(signal: SignalItem): void {
    const list = this.listSignals().filter((s) => s.id !== signal.id)
    write(KEYS.items, [...list, signal])
    scheduleSync()
  },
  updateSignal(id: string, patch: Partial<SignalItem>): SignalItem {
    const signals = this.listSignals()
    const idx = signals.findIndex((s) => s.id === id)
    if (idx === -1) throw new Error(`Signal ${id} not found`)
    const updated: SignalItem = { ...signals[idx], ...patch, updatedAt: new Date().toISOString() }
    signals[idx] = updated
    write(KEYS.items, signals)
    scheduleSync()
    return updated
  },
  deleteSignal(id: string): void {
    write(KEYS.items, this.listSignals().filter((s) => s.id !== id))
    scheduleSync()
  },
  saveSignals(signals: SignalItem[]): void {
    const existing = this.listSignals()
    const map = new Map(existing.map((s) => [s.id, s]))
    for (const s of signals) map.set(s.id, s)
    write(KEYS.items, Array.from(map.values()))
    scheduleSync()
  },

  // Config
  getConfig(): ScanConfig {
    return read<ScanConfig>(KEYS.config, DEFAULT_CONFIG)
  },
  saveConfig(config: ScanConfig): void {
    write(KEYS.config, config)
    scheduleSync()
  },
}
