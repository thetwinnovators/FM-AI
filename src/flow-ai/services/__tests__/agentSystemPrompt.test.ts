import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAgentSystemPrompt } from '../agentSystemPrompt.js'

// Mock localMCPStorage so tests don't need localStorage
vi.mock('../../../mcp/storage/localMCPStorage.js', () => ({
  localMCPStorage: {
    listIntegrations: vi.fn(() => [
      { id: 'integ_telegram', type: 'telegram', name: 'Telegram', status: 'connected', updatedAt: '' },
      { id: 'integ_gdocs', type: 'google-docs', name: 'Google Docs', status: 'disconnected', updatedAt: '' },
    ]),
    listTools: vi.fn(() => [
      {
        id: 'telegram_send_message',
        integrationId: 'integ_telegram',
        toolName: 'send_message',
        displayName: 'Send Telegram Message',
        description: 'Send a message to a Telegram channel.',
        riskLevel: 'write',
        permissionMode: 'auto',
      },
      {
        id: 'gdocs_create',
        integrationId: 'integ_gdocs',
        toolName: 'create_doc',
        displayName: 'Create Google Doc',
        description: 'Create a new Google Doc.',
        riskLevel: 'write',
        permissionMode: 'auto',
      },
    ]),
  },
}))

describe('buildAgentSystemPrompt', () => {
  it('includes role instruction telling model to output JSON only', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('JSON')
    expect(prompt.toLowerCase()).toContain('tool-using assistant')
  })

  it('includes the JSON response schema', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('"thought"')
    expect(prompt).toContain('"action"')
    expect(prompt).toContain('"toolId"')
    expect(prompt).toContain('"answer"')
  })

  it('includes only tools from connected integrations', () => {
    const prompt = buildAgentSystemPrompt()
    // telegram is connected → its tool appears
    expect(prompt).toContain('telegram_send_message')
    // google-docs is disconnected → its tool does NOT appear
    expect(prompt).not.toContain('gdocs_create')
  })

  it('includes tool displayName and description in catalog', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('Send Telegram Message')
    expect(prompt).toContain('Send a message to a Telegram channel')
  })

  it('includes memory context when provided', () => {
    const prompt = buildAgentSystemPrompt([
      { category: 'research_focus', content: 'I work on AI tooling research.' },
    ])
    expect(prompt).toContain('I work on AI tooling research.')
  })

  it('includes max steps constraint', () => {
    const prompt = buildAgentSystemPrompt()
    expect(prompt).toContain('5')
  })

  it('omits memory context block when array is empty', () => {
    const prompt = buildAgentSystemPrompt([])
    expect(prompt).not.toContain('MEMORY CONTEXT')
  })
})
