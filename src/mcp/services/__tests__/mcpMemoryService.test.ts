import { beforeEach, describe, expect, it } from 'vitest'
import { writeExecutionMemory, writeAgentResult } from '../mcpMemoryService.js'
import type { MCPExecutionRecord, MCPToolDefinition, MCPIntegration } from '../../types.js'

const STORE_KEY = 'flowmap.v1'

function readMemoryEntries(): Record<string, unknown> {
  const raw = localStorage.getItem(STORE_KEY)
  if (!raw) return {}
  try {
    return (JSON.parse(raw) as { memoryEntries?: Record<string, unknown> }).memoryEntries ?? {}
  } catch {
    return {}
  }
}

function makeRecord(overrides: Partial<MCPExecutionRecord> = {}): MCPExecutionRecord {
  return {
    id: 'exec_test_1',
    toolId: 'gdocs_create_doc',
    integrationId: 'integ_google_docs',
    sourceSurface: 'chat',
    status: 'success',
    requestedAt: '2026-05-02T10:00:00.000Z',
    completedAt: '2026-05-02T10:00:01.000Z',
    outputSummary: 'Created doc: My Research Note',
    ...overrides,
  }
}

function makeTool(overrides: Partial<MCPToolDefinition> = {}): MCPToolDefinition {
  return {
    id: 'gdocs_create_doc',
    integrationId: 'integ_google_docs',
    toolName: 'create_doc',
    displayName: 'Create Google Doc',
    riskLevel: 'write',
    permissionMode: 'auto',
    ...overrides,
  }
}

function makeIntegration(overrides: Partial<MCPIntegration> = {}): MCPIntegration {
  return {
    id: 'integ_google_docs',
    type: 'google-docs',
    name: 'Google Docs',
    status: 'connected',
    updatedAt: '2026-05-02T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('writeExecutionMemory', () => {
  it('writes a memory entry to flowmap.v1', () => {
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    expect(Object.keys(entries)).toHaveLength(1)
  })

  it('entry id is prefixed with mem_mcp_', () => {
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    const key = Object.keys(entries)[0]
    expect(key).toMatch(/^mem_mcp_/)
  })

  it('entry text includes tool displayName and integration name', () => {
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    const entry = Object.values(entries)[0] as { text: string }
    expect(entry.text).toContain('Create Google Doc')
    expect(entry.text).toContain('Google Docs')
  })

  it('entry has source mcp and category automation', () => {
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    const entry = Object.values(entries)[0] as { source: string; category: string }
    expect(entry.source).toBe('mcp')
    expect(entry.category).toBe('automation')
  })

  it('entry tags include mcp, tool-execution, and the integration type', () => {
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    const entry = Object.values(entries)[0] as { tags: string[] }
    expect(entry.tags).toContain('mcp')
    expect(entry.tags).toContain('tool-execution')
    expect(entry.tags).toContain('google-docs')
  })

  it('accumulates multiple entries without overwriting', () => {
    writeExecutionMemory(makeRecord({ id: 'exec_1' }), makeTool(), makeIntegration())
    writeExecutionMemory(makeRecord({ id: 'exec_2' }), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    expect(Object.keys(entries)).toHaveLength(2)
  })

  it('preserves existing flowmap.v1 saves and other data', () => {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      saves: { item_1: { id: 'item_1' } },
      memoryEntries: {},
    }))
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const raw = localStorage.getItem(STORE_KEY)!
    const store = JSON.parse(raw) as { saves: Record<string, unknown>; memoryEntries: Record<string, unknown> }
    expect(store.saves['item_1']).toBeDefined()
    expect(Object.keys(store.memoryEntries)).toHaveLength(1)
  })

  it('does not crash when flowmap.v1 is empty', () => {
    expect(() => writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())).not.toThrow()
  })
})

describe('writeAgentResult', () => {
  it('writes a memory entry to flowmap.v1.memoryEntries', () => {
    writeAgentResult({
      userMessage: 'send a message to @dev on telegram',
      toolsUsed: ['Send Telegram Message'],
      outcome: 'Sent message to @dev.',
      source: 'agent_run',
    })
    const entries = readMemoryEntries()
    expect(Object.keys(entries)).toHaveLength(1)
  })

  it('entry id is prefixed with mem_agent_', () => {
    writeAgentResult({
      userMessage: 'list drive files',
      toolsUsed: ['List Drive Files'],
      outcome: 'Found 3 files.',
      source: 'agent_run',
    })
    const entries = readMemoryEntries()
    const key = Object.keys(entries)[0]
    expect(key).toMatch(/^mem_agent_/)
  })

  it('entry uses content field (not text)', () => {
    writeAgentResult({
      userMessage: 'create a doc',
      toolsUsed: ['Create Google Doc'],
      outcome: 'Created the doc.',
      source: 'agent_run',
    })
    const entry = Object.values(readMemoryEntries())[0] as Record<string, unknown>
    expect(entry.content).toBeDefined()
    expect(typeof entry.content).toBe('string')
  })

  it('entry content mentions tools used and outcome', () => {
    writeAgentResult({
      userMessage: 'create a doc',
      toolsUsed: ['Create Google Doc'],
      outcome: 'Created the doc.',
      source: 'agent_run',
    })
    const entry = Object.values(readMemoryEntries())[0] as { content: string }
    expect(entry.content).toContain('Create Google Doc')
    expect(entry.content).toContain('Created the doc.')
  })

  it('entry has category research_focus and source agent_run', () => {
    writeAgentResult({
      userMessage: 'do something',
      toolsUsed: [],
      outcome: 'Done.',
      source: 'agent_run',
    })
    const entry = Object.values(readMemoryEntries())[0] as { category: string; source: string }
    expect(entry.category).toBe('research_focus')
    expect(entry.source).toBe('agent_run')
  })

  it('entry has addedAt as ISO date string', () => {
    writeAgentResult({
      userMessage: 'test',
      toolsUsed: [],
      outcome: 'ok',
      source: 'agent_run',
    })
    const entry = Object.values(readMemoryEntries())[0] as { addedAt: string }
    expect(entry.addedAt).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })

  it('preserves existing flowmap.v1 data', () => {
    localStorage.setItem('flowmap.v1', JSON.stringify({
      saves: { s1: { id: 's1' } },
      memoryEntries: {},
    }))
    writeAgentResult({ userMessage: 'x', toolsUsed: [], outcome: 'ok', source: 'agent_run' })
    const raw = localStorage.getItem('flowmap.v1')!
    const store = JSON.parse(raw) as { saves: Record<string, unknown> }
    expect(store.saves['s1']).toBeDefined()
  })
})
