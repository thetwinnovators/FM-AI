import type {
  MCPIntegration,
  MCPToolDefinition,
  MCPExecutionRecord,
  TelegramCommandMessage,
} from '../types.js'
import type { MCPStorage } from './mcpStorage.js'

const KEYS = {
  integrations: 'fm_mcp_integrations',
  tools: 'fm_mcp_tools',
  executions: 'fm_mcp_executions',
  telegramMessages: 'fm_mcp_telegram_messages',
} as const

const MAX_EXECUTIONS = 500

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
    return integrationId ? all.filter((t) => t.integrationId === integrationId) : all
  },
  saveTools(integrationId, tools) {
    const others = read<MCPToolDefinition[]>(KEYS.tools, []).filter(
      (t) => t.integrationId !== integrationId
    )
    write(KEYS.tools, [...others, ...tools])
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
