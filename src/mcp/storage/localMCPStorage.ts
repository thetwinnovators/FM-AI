import type {
  MCPIntegration,
  MCPToolDefinition,
  MCPExecutionRecord,
  TelegramCommandMessage,
} from '../types.js'
import type { MCPStorage } from './mcpStorage.js'
import { enqueue } from '../../memory-index/syncQueue.js'

const KEYS = {
  integrations: 'fm_mcp_integrations',
  tools: 'fm_mcp_tools',
  executions: 'fm_mcp_executions',
  telegramMessages: 'fm_mcp_telegram_messages',
} as const

const MAX_EXECUTIONS = 500

// ── In-memory schema cache ────────────────────────────────────────────────────
// inputSchema objects are large JSON blobs that quickly exhaust the 5-10 MB
// localStorage quota when 17-18 Docker MCP servers are connected. We strip
// them before persisting and hold them in memory only. They are rebuilt every
// agent-loop run via refreshDockerMCPTools() so the gap after a page reload
// is negligible in practice.
const _schemaCache = new Map<string, Record<string, unknown> | undefined>()

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
  } catch (e: any) {
    const isQuota =
      e?.name === 'QuotaExceededError' ||
      (e?.code !== undefined && (e.code === 22 || e.code === 1014)) ||
      String(e).toLowerCase().includes('quota')
    if (!isQuota) throw e

    // ── Eviction pass ─────────────────────────────────────────────────────────
    // Quota is full. Before giving up, try clearing non-critical MCP keys in
    // order of safety, then retry the write. We never evict integrations — those
    // hold user connection state. Safe eviction order:
    //   1. tools       — inputSchema blobs in _schemaCache; re-fetched each run
    //   2. executions  — execution history only, not configuration
    //   3. telegramMessages — demo seeds re-created by seedOnce() on next load
    for (const candidate of [KEYS.tools, KEYS.executions, KEYS.telegramMessages]) {
      if (candidate === key) continue            // don't clear what we're writing
      if (localStorage.getItem(candidate) === null) continue  // nothing to free
      localStorage.removeItem(candidate)
      console.info(`[FlowMap] localStorage quota: evicted "${candidate}" to free space for "${key}".`)
      try {
        localStorage.setItem(key, JSON.stringify(value))
        enqueue()
        return  // write succeeded after eviction — done
      } catch { /* still full — try next candidate */ }
    }

    // All eviction candidates exhausted. The quota is filled by non-MCP data
    // (research topics, saves, etc.). Data lives in memory only this session.
    console.warn(`[FlowMap] localStorage quota exceeded for key "${key}". Data is in-memory only for this session.`)
    return
  }
  enqueue()
}

const SEED_INTEGRATIONS: MCPIntegration[] = [
  {
    id: 'integ_telegram',
    type: 'telegram',
    name: 'Telegram',
    description: 'Send messages, files, and summaries. Receive commands from a bot.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['send_message', 'send_document'],
  },
  {
    id: 'integ_figma',
    type: 'figma',
    name: 'Figma',
    description: 'Inspect files, pull layer data, push content to canvases.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['file.read', 'canvas.write'],
  },
  {
    id: 'integ_google_drive',
    type: 'google-drive',
    name: 'Google Drive',
    description: 'Browse, upload, and organize files. Attach Drive links to research notes.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['drive.read', 'drive.upload'],
  },
  {
    id: 'integ_gmail',
    type: 'gmail',
    name: 'Gmail',
    description: 'Send research summaries, drafts, and reports directly from FlowMap.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['gmail.send', 'gmail.read'],
  },
  {
    id: 'integ_google_calendar',
    type: 'google-calendar',
    name: 'Google Calendar',
    description: 'Schedule research sessions, reminders, and deadlines from FlowMap.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['calendar.read', 'calendar.create'],
  },
  {
    id: 'integ_google_slides',
    type: 'google-slides',
    name: 'Google Slides',
    description: 'Export research summaries and topic overviews as presentation decks.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['slides.create', 'slides.edit'],
  },
  {
    id: 'integ_youtube',
    type: 'youtube',
    name: 'YouTube',
    description: 'Save videos to topics, pull transcripts, and track creator signals.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['youtube.read', 'youtube.save'],
  },
  {
    id: 'integ_google_docs',
    type: 'google-docs',
    name: 'Google Docs',
    description: 'Create, edit, and sync research notes and summaries with Google Docs.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['docs.create', 'docs.edit'],
  },
  {
    id: 'integ_higgsfield',
    type: 'higgsfield',
    name: 'Higgsfield AI',
    description: 'Generate AI video content from research topics and summaries.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['video.generate'],
  },
  {
    id: 'integ_instagram',
    type: 'instagram',
    name: 'Instagram',
    description: 'Track creator posts, monitor hashtag trends, and save content to topics.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['instagram.read'],
  },
  {
    id: 'integ_facebook',
    type: 'facebook',
    name: 'Facebook',
    description: 'Monitor pages, groups, and trend signals from your Facebook feed.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['facebook.read'],
  },
  {
    id: 'integ_flowmap',
    type: 'flowmap',
    name: 'FlowMap',
    description: 'Automate your research graph — save articles, manage memory, search knowledge, and trigger topic sweeps.',
    status: 'connected',
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scopes: ['topics.read', 'topics.write', 'memory.read', 'memory.write', 'search.read', 'saves.read', 'saves.write'],
  },
  {
    id: 'integ_local',
    type: 'local',
    name: 'Local Operator',
    description: 'FlowMap operator daemon — file access, shell, browser automation, git, and code sandbox.',
    status: 'connected',
    updatedAt: new Date().toISOString(),
    scopes: ['file', 'system', 'browser', 'git', 'code'],
  },
  {
    id: 'integ_docker_mcp',
    type: 'docker-mcp',
    name: 'Docker MCP Servers',
    description: 'AI coding and terminal control tools via Docker Desktop MCP Toolkit.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['tools.list', 'tools.execute'],
  },
]

function makeSeedTelegramMessages(): TelegramCommandMessage[] {
  const ts = Date.now()
  return [
    {
      id: 'tcm_1',
      chatId: 'demo',
      messageText: 'Summarize this URL: https://example.com/article',
      receivedAt: new Date(ts - 60_000 * 5).toISOString(),
      status: 'processed',
    },
    {
      id: 'tcm_2',
      chatId: 'demo',
      messageText: 'Create a research canvas called AI competitors',
      receivedAt: new Date(ts - 60_000 * 15).toISOString(),
      status: 'received',
    },
    {
      id: 'tcm_3',
      chatId: 'demo',
      messageText: 'Send me 3 caption ideas for this topic',
      receivedAt: new Date(ts - 60_000 * 45).toISOString(),
      status: 'failed',
    },
    {
      id: 'tcm_4',
      chatId: 'demo',
      messageText: "What's on my calendar today?",
      receivedAt: new Date(ts - 60_000 * 90).toISOString(),
      status: 'processed',
    },
    {
      id: 'tcm_5',
      chatId: 'demo',
      messageText: 'Create a Google Doc from my last note',
      receivedAt: new Date(ts - 60_000 * 180).toISOString(),
      status: 'processed',
    },
  ]
}

// IDs that have been retired and should be removed from existing storage.
const REMOVED_IDS = new Set(['integ_google_workspace', 'integ_canva', 'integ_generic_mcp'])

// ── One-time storage migration ────────────────────────────────────────────────
// Older versions persisted full inputSchema blobs in fm_mcp_tools, which
// could exceed the 5-10 MB localStorage quota when many Docker MCP servers
// are connected. On the first load after this change, clear any oversized
// entry so the quota is freed immediately. Tools are re-fetched automatically
// on the next agent run (refreshDockerMCPTools) or Docker MCP reconnect.
function migrateToolStorage(): void {
  try {
    const raw = localStorage.getItem(KEYS.tools)
    if (!raw) return
    if (raw.length > 500_000) { // > 500 KB almost certainly contains full schemas
      localStorage.removeItem(KEYS.tools)
      console.info('[FlowMap] Cleared oversized tool catalog from localStorage (schemas are now in-memory only).')
    }
  } catch { /* silently ignore */ }
}
migrateToolStorage()

function seedOnce(): void {
  const integrations = read<MCPIntegration[]>(KEYS.integrations, [])
  if (integrations.length === 0) {
    write(KEYS.integrations, SEED_INTEGRATIONS)
  } else {
    // Purge retired integrations, then merge any new seed entries.
    const pruned  = integrations.filter((i) => !REMOVED_IDS.has(i.id))
    const existingIds = new Set(pruned.map((i) => i.id))
    const missing = SEED_INTEGRATIONS.filter((s) => !existingIds.has(s.id))
    if (pruned.length !== integrations.length || missing.length > 0) {
      write(KEYS.integrations, [...pruned, ...missing])
    }
  }

  const messages = read<TelegramCommandMessage[]>(KEYS.telegramMessages, [])
  if (messages.length === 0) write(KEYS.telegramMessages, makeSeedTelegramMessages())
}

export const localMCPStorage: MCPStorage = {
  listIntegrations() {
    seedOnce()
    return read<MCPIntegration[]>(KEYS.integrations, [])
  },
  getIntegration(id) {
    return this.listIntegrations().find((i) => i.id === id) ?? null
  },
  saveIntegration(integration) {
    const list = this.listIntegrations().filter((i) => i.id !== integration.id)
    write(KEYS.integrations, [...list, integration])
  },
  updateIntegration(id, patch) {
    const existing = this.getIntegration(id)
    if (!existing) throw new Error(`Integration ${id} not found`)
    const updated: MCPIntegration = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    this.saveIntegration(updated)
    return updated
  },
  deleteIntegration(id) {
    write(KEYS.integrations, this.listIntegrations().filter((i) => i.id !== id))
  },

  listTools(integrationId) {
    const all = read<MCPToolDefinition[]>(KEYS.tools, [])
    // Merge in-memory schemas back — stripped at persist time to save quota
    const withSchemas = all.map((t) =>
      _schemaCache.has(t.id) ? { ...t, inputSchema: _schemaCache.get(t.id) } : t
    )
    return integrationId
      ? withSchemas.filter((t) => t.integrationId === integrationId)
      : withSchemas
  },
  saveTools(integrationId, tools) {
    // Cache schemas in memory and strip them before writing to localStorage.
    // inputSchema objects can be 2-10 KB each; 17-18 servers × 5-15 tools each
    // easily blows the 5-10 MB localStorage quota.
    for (const t of tools) {
      if (t.inputSchema !== undefined) _schemaCache.set(t.id, t.inputSchema)
    }
    const slim = tools.map(({ inputSchema: _dropped, ...rest }) => rest as MCPToolDefinition)
    const others = read<MCPToolDefinition[]>(KEYS.tools, []).filter(
      (t) => t.integrationId !== integrationId
    )
    write(KEYS.tools, [...others, ...slim])
  },

  listExecutionRecords(options) {
    let records = read<MCPExecutionRecord[]>(KEYS.executions, [])
    if (options?.integrationId) {
      records = records.filter((r) => r.integrationId === options.integrationId)
    }
    records.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    return options?.limit ? records.slice(0, options.limit) : records
  },
  saveExecutionRecord(record) {
    const records = read<MCPExecutionRecord[]>(KEYS.executions, [])
    records.push(record)
    if (records.length > MAX_EXECUTIONS) records.shift()
    write(KEYS.executions, records)
  },
  updateExecutionRecord(id, patch) {
    const records = read<MCPExecutionRecord[]>(KEYS.executions, [])
    const idx = records.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error(`Execution record ${id} not found`)
    const updated = { ...records[idx], ...patch } as MCPExecutionRecord
    records[idx] = updated
    write(KEYS.executions, records)
    return updated
  },

  saveTelegramMessage(message) {
    seedOnce()
    const messages = read<TelegramCommandMessage[]>(KEYS.telegramMessages, [])
    write(KEYS.telegramMessages, [message, ...messages])
  },
  listTelegramMessages() {
    seedOnce()
    return read<TelegramCommandMessage[]>(KEYS.telegramMessages, [])
  },
}
