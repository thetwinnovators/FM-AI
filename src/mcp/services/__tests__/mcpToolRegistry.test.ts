import { beforeEach, describe, expect, it } from 'vitest'
import { discoverTools, getTools, getProvider } from '../mcpToolRegistry.js'
import { localMCPStorage } from '../../storage/localMCPStorage.js'
import type { MCPIntegration } from '../../types.js'

beforeEach(() => {
  localStorage.clear()
})

function makeIntegration(overrides: Partial<MCPIntegration> = {}): MCPIntegration {
  return {
    id: 'integ_canva',
    type: 'canva',
    name: 'Canva',
    status: 'connected',
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('getProvider', () => {
  it('returns a provider for every IntegrationType', () => {
    const types = ['telegram', 'google-workspace', 'figma', 'canva', 'generic-mcp'] as const
    for (const type of types) {
      const provider = getProvider(type)
      expect(provider).toBeDefined()
      expect(typeof provider.listTools).toBe('function')
      expect(typeof provider.executeTool).toBe('function')
      expect(typeof provider.testConnection).toBe('function')
    }
  })
})

describe('discoverTools', () => {
  it('calls provider.listTools and saves results to storage', async () => {
    const integration = makeIntegration()
    const tools = await discoverTools(integration)
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.every((t) => t.integrationId === 'integ_canva')).toBe(true)
    // Verify persisted
    expect(localMCPStorage.listTools('integ_canva')).toHaveLength(tools.length)
  })

  it('replaces tools on second discoverTools call for same integration', async () => {
    const integration = makeIntegration()
    await discoverTools(integration)
    await discoverTools(integration)
    // saveTools replaces — no duplicates
    expect(localMCPStorage.listTools('integ_canva').length).toBe(2) // Canva has 2 tools
  })

  it('discovers correct tool count for each integration type', async () => {
    const cases: Array<{ id: string; type: MCPIntegration['type']; expectedCount: number }> = [
      { id: 'integ_telegram', type: 'telegram', expectedCount: 3 },
      { id: 'integ_google_workspace', type: 'google-workspace', expectedCount: 4 },
      { id: 'integ_figma', type: 'figma', expectedCount: 2 },
      { id: 'integ_canva', type: 'canva', expectedCount: 2 },
      { id: 'integ_generic_mcp', type: 'generic-mcp', expectedCount: 1 },
    ]
    for (const { id, type, expectedCount } of cases) {
      const tools = await discoverTools(makeIntegration({ id, type }))
      expect(tools).toHaveLength(expectedCount)
    }
  })
})

describe('getTools', () => {
  it('returns all tools when no integrationId provided', async () => {
    await discoverTools(makeIntegration({ id: 'integ_canva', type: 'canva' }))
    await discoverTools(makeIntegration({ id: 'integ_figma', type: 'figma' }))
    expect(getTools().length).toBe(4) // 2 canva + 2 figma
  })

  it('filters by integrationId', async () => {
    await discoverTools(makeIntegration({ id: 'integ_canva', type: 'canva' }))
    await discoverTools(makeIntegration({ id: 'integ_figma', type: 'figma' }))
    expect(getTools('integ_figma')).toHaveLength(2)
    expect(getTools('integ_canva')).toHaveLength(2)
  })

  it('returns empty array for integration with no discovered tools', () => {
    expect(getTools('integ_unknown')).toHaveLength(0)
  })
})
