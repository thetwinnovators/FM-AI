// ─── Memory Index — Type Definitions ─────────────────────────────────────────
//
// Seven canonical memory-node types that map the app's concepts onto a
// uniform index structure. The JSON file is the source of truth; the
// markdown file is a derived, human-readable view.

export const MEMORY_NODE_TYPES = [
  'project',
  'conversation',
  'decision',
  'workflow',
  'source_item',
  'preference',
  'insight',
] as const

export type MemoryNodeType = (typeof MEMORY_NODE_TYPES)[number]

// ─── Type → storage-key + human label mapping ───────────────────────────────

export const NODE_TYPE_META: Record<MemoryNodeType, { icon: string; label: string; storageKeys: string[] }> = {
  project:      { icon: '📦', label: 'Project',       storageKeys: ['package.json (static)'] },
  conversation: { icon: '💬', label: 'Conversations', storageKeys: ['flowmap.v1/conversations', 'flowmap.v1/chatMessages'] },
  decision:     { icon: '🔑', label: 'Decisions',     storageKeys: ['flowmap.v1/memoryEntries'] },
  workflow:     { icon: '⚙️', label: 'Workflows',     storageKeys: ['fm_mcp_integrations', 'fm_mcp_executions', 'flowmap.mcp.taskPlans'] },
  source_item:  { icon: '📄', label: 'Source Items',  storageKeys: ['flowmap.v1/documents', 'flowmap.v1/manualContent', 'flowmap.v1/saves'] },
  preference:   { icon: '🎛️', label: 'Preferences',  storageKeys: ['flowmap.v1', 'flowmap.ollama.*', 'flowmap.voice.*', 'flowmap.theme'] },
  insight:      { icon: '💡', label: 'Insights',      storageKeys: ['fm_radar_clusters', 'fm_radar_concepts', 'fm_signals_items'] },
}

// ─── Core node interface ─────────────────────────────────────────────────────

export interface MemoryNode {
  id:          string
  type:        MemoryNodeType
  label:       string           // ≤ 80 chars — used in markdown tables
  summary?:    string           // longer description for detail view
  tags?:       string[]
  createdAt?:  string           // ISO-8601
  updatedAt?:  string           // ISO-8601
  source:      string           // storage key path, e.g. "flowmap.v1/memoryEntries"
  metadata?:   Record<string, unknown>
}

// ─── Index envelope ──────────────────────────────────────────────────────────

export interface MemoryIndexStats {
  total:            number
  byType:           Record<MemoryNodeType, number>
  storageKeys:      string[]   // all known localStorage keys in the app
  generatorVersion: string
}

export interface MemoryIndex {
  schemaVersion: string        // bumped when the node shape changes
  generatedAt:   string        // ISO-8601
  appName:       string
  appVersion:    string
  stats:         MemoryIndexStats
  nodes:         MemoryNode[]
}

// ─── All localStorage keys the app uses ─────────────────────────────────────
// Canonical registry — used by the stats block in every generated index.

export const ALL_STORAGE_KEYS: string[] = [
  // Main store
  'flowmap.v1',
  // Config overrides
  'flowmap.theme',
  'flowmap.ollama.enabled',
  'flowmap.ollama.model',
  'flowmap.voice.enabled',
  'flowmap.voice.voiceId',
  'flowmap.voice.modelId',
  'flowmap.searxng.enabled',
  // View mode persistence
  'flowmap.topics.viewMode',
  'flowmap.topic.viewMode',
  'flowmap.signals.viewMode',
  // Search cache (prefix)
  'flowmap.search.cache.*',
  // VirusTotal
  'flowmap_vt_key',
  // Opportunity Radar
  'fm_radar_signals',
  'fm_radar_clusters',
  'fm_radar_concepts',
  'fm_radar_meta',
  // Signals
  'fm_signals_topics',
  'fm_signals_sources',
  'fm_signals_items',
  'fm_signals_config',
  // MCP
  'fm_mcp_integrations',
  'fm_mcp_tools',
  'fm_mcp_executions',
  'fm_mcp_telegram_messages',
  'fm_telegram_poll_offset',
  'flowmap.mcp.taskPlans',
  'flowmap.mcp.ctxfiles',
  'flowmap.mcp.ctxfile.*',
  // Embeddings (IndexedDB, not localStorage)
  'IDB:flowmap-embeddings/embeddings',
]

export const SCHEMA_VERSION = '1.0.0'
export const GENERATOR_VERSION = '1.0.0'
