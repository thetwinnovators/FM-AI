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
