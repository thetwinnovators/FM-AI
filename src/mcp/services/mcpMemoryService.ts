import type { MCPExecutionRecord, MCPToolDefinition, MCPIntegration } from '../types.js'

const STORE_KEY = 'flowmap.v1'

interface MemoryEntry {
  id: string
  text: string
  tags: string[]
  category: string
  addedAt: string
  source: string
}

interface FlowMapStore {
  memoryEntries?: Record<string, MemoryEntry>
  [key: string]: unknown
}

function readStore(): FlowMapStore {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as FlowMapStore) : {}
  } catch {
    return {}
  }
}

function writeStore(data: FlowMapStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(data))
}

/**
 * Writes a memory entry to flowmap.v1 after a meaningful tool execution.
 * Call this after write or publish tools complete successfully.
 * The entry appears in the FlowMap Memory view alongside manually added entries.
 */
export function writeExecutionMemory(
  record: MCPExecutionRecord,
  tool: MCPToolDefinition,
  integration: MCPIntegration,
): void {
  const id = `mem_mcp_${record.id}`
  const outputNote = record.outputSummary
    ? ` Output: ${record.outputSummary.slice(0, 200)}`
    : ''

  const entry: MemoryEntry = {
    id,
    text: `${tool.displayName} completed via ${integration.name}.${outputNote}`,
    tags: ['mcp', 'tool-execution', integration.type],
    category: 'automation',
    addedAt: new Date().toISOString().slice(0, 10),
    source: 'mcp',
  }

  const store = readStore()
  const entries = store.memoryEntries ?? {}
  entries[id] = entry
  writeStore({ ...store, memoryEntries: entries })
}

export interface WriteAgentResultParams {
  userMessage: string
  toolsUsed: string[]
  outcome: string
  source: 'agent_run'
}

/**
 * Writes a memory entry after an agent run completes.
 * The entry appears in Memory > Memory entries like any other working memory entry.
 * Uses `content` field to match the shape expected by useStore and the retrieval pipeline.
 */
export function writeAgentResult(params: WriteAgentResultParams): void {
  const { userMessage, toolsUsed, outcome } = params
  const id = `mem_agent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

  const toolPhrase = toolsUsed.length
    ? `Used: ${toolsUsed.join(', ')}. `
    : ''
  const content = `Agent run for "${userMessage.slice(0, 80)}". ${toolPhrase}${outcome.slice(0, 200)}`

  const entry = {
    id,
    content,
    category: 'research_focus',
    addedAt: new Date().toISOString().slice(0, 10),
    source: 'agent_run',
    status: 'active',
    tags: ['agent', 'tool-execution'],
  }

  const store = readStore()
  const entries = store.memoryEntries ?? {}
  // MemoryEntry interface uses `text`; agent entries use `content` to match useStore.
  // Cast bypasses the local interface — the retrieval pipeline and UI read `content`.
  entries[id] = entry as unknown as MemoryEntry
  writeStore({ ...store, memoryEntries: entries })
}
