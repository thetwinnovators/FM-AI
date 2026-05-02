import { beforeEach, describe, expect, it } from 'vitest'
import { discoverTools, getTools, getProvider } from '../mcpToolRegistry.js'
import { localMCPStorage } from '../../storage/localMCPStorage.js'
import type { MCPIntegration } from '../../types.js'

beforeEach(() => {
  localStorage.clear()
})

function makeIntegration(overrides: Partial<MCPIntegration> = {}): MCPIntegration {
  return {
    id: 'integ_telegram',
    type: 'telegram',
    name: 'Telegram',
    status: 'connected',
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('getProvider', () => {
  it('returns telegram provider', () => {
    const p = getProvider('telegram')
    expect(p).toBeDefined()
    expect(typeof p!.listTools).toBe('function')
    expect(typeof p!.executeTool).toBe('function')
    expect(typeof p!.testConnection).toBe('function')
  })

  it('returns google-docs provider', () => {
    const p = getProvider('google-docs')
    expect(p).toBeDefined()
    expect(typeof p!.listTools).toBe('function')
  })

  it('returns google-drive provider', () => {
    const p = getProvider('google-drive')
    expect(p).toBeDefined()
    expect(typeof p!.listTools).toBe('function')
  })

  it('returns undefined for types without a registered provider', () => {
    expect(getProvider('gmail')).toBeUndefined()
    expect(getProvider('google-calendar')).toBeUndefined()
    expect(getProvider('youtube')).toBeUndefined()
    expect(getProvider('instagram')).toBeUndefined()
    expect(getProvider('facebook')).toBeUndefined()
    expect(getProvider('higgsfield')).toBeUndefined()
  })
})

describe('discoverTools', () => {
  it('saves telegram tools to storage', async () => {
    const integration = makeIntegration()
    const tools = await discoverTools(integration)
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.every((t) => t.integrationId === 'integ_telegram')).toBe(true)
    expect(localMCPStorage.listTools('integ_telegram')).toHaveLength(tools.length)
  })

  it('replaces tools on second discoverTools call (no duplicates)', async () => {
    const integration = makeIntegration()
    await discoverTools(integration)
    await discoverTools(integration)
    expect(localMCPStorage.listTools('integ_telegram')).toHaveLength(3) // 3 telegram tools
  })

  it('discovers correct tool count for registered providers', async () => {
    const cases: Array<{ id: string; type: MCPIntegration['type']; expectedCount: number }> = [
      { id: 'integ_telegram', type: 'telegram', expectedCount: 3 },
      { id: 'integ_google_docs', type: 'google-docs', expectedCount: 3 },
      { id: 'integ_google_drive', type: 'google-drive', expectedCount: 3 },
    ]
    for (const { id, type, expectedCount } of cases) {
      const tools = await discoverTools(makeIntegration({ id, type }))
      expect(tools).toHaveLength(expectedCount)
    }
  })

  it('throws when no provider registered for integration type', async () => {
    const integration = makeIntegration({ type: 'gmail' })
    await expect(discoverTools(integration)).rejects.toThrow(/no provider/i)
  })
})

describe('getTools', () => {
  it('returns all tools across integrations when no id given', async () => {
    await discoverTools(makeIntegration({ id: 'integ_telegram', type: 'telegram' }))
    await discoverTools(makeIntegration({ id: 'integ_google_docs', type: 'google-docs' }))
    expect(getTools().length).toBe(6) // 3 telegram + 3 google-docs
  })

  it('filters by integrationId', async () => {
    await discoverTools(makeIntegration({ id: 'integ_telegram', type: 'telegram' }))
    await discoverTools(makeIntegration({ id: 'integ_google_docs', type: 'google-docs' }))
    expect(getTools('integ_google_docs')).toHaveLength(3)
    expect(getTools('integ_telegram')).toHaveLength(3)
  })

  it('returns empty array for integration with no discovered tools', () => {
    expect(getTools('integ_unknown')).toHaveLength(0)
  })
})
