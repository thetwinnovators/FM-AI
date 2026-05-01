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
    id: 'integ_google_workspace',
    type: 'google-workspace',
    name: 'Google Workspace',
    description: 'Create Docs, append Sheets, schedule calendar events, send Gmail.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['docs.create', 'sheets.append', 'calendar.create', 'gmail.send'],
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
    id: 'integ_canva',
    type: 'canva',
    name: 'Canva',
    description: 'Create and modify presentations, social graphics, and design assets.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['design.create', 'design.edit'],
  },
  {
    id: 'integ_generic_mcp',
    type: 'generic-mcp',
    name: 'Generic MCP Server',
    description: 'Connect any MCP-compatible server to FlowMap.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
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

function seedOnce(): void {
  const integrations = read<MCPIntegration[]>(KEYS.integrations, [])
  if (integrations.length === 0) write(KEYS.integrations, SEED_INTEGRATIONS)

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
