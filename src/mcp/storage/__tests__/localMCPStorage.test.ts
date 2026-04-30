import { beforeEach, describe, expect, it } from 'vitest'
import { localMCPStorage } from '../localMCPStorage.js'

beforeEach(() => {
  localStorage.clear()
})

describe('listIntegrations', () => {
  it('seeds 5 integrations on first call', () => {
    const list = localMCPStorage.listIntegrations()
    expect(list).toHaveLength(5)
    expect(list.map((i) => i.type)).toContain('telegram')
  })

  it('does not re-seed on second call after a write', () => {
    localMCPStorage.listIntegrations()
    localMCPStorage.updateIntegration('integ_telegram', { status: 'connected' })
    const list = localMCPStorage.listIntegrations()
    const telegram = list.find((i) => i.id === 'integ_telegram')
    expect(telegram?.status).toBe('connected')
  })
})

describe('updateIntegration', () => {
  it('patches and returns the updated record', () => {
    localMCPStorage.listIntegrations()
    const updated = localMCPStorage.updateIntegration('integ_telegram', {
      status: 'connected',
    })
    expect(updated.status).toBe('connected')
    expect(localMCPStorage.getIntegration('integ_telegram')?.status).toBe('connected')
  })

  it('throws if integration does not exist', () => {
    localMCPStorage.listIntegrations()
    expect(() =>
      localMCPStorage.updateIntegration('no_such_id', { status: 'connected' })
    ).toThrow('not found')
  })
})

describe('deleteIntegration', () => {
  it('removes the integration', () => {
    localMCPStorage.listIntegrations()
    localMCPStorage.deleteIntegration('integ_figma')
    expect(localMCPStorage.getIntegration('integ_figma')).toBeNull()
    expect(localMCPStorage.listIntegrations()).toHaveLength(4)
  })

  it('is a no-op for unknown id', () => {
    localMCPStorage.listIntegrations()
    expect(() => localMCPStorage.deleteIntegration('ghost')).not.toThrow()
    expect(localMCPStorage.listIntegrations()).toHaveLength(5)
  })
})

describe('saveTools / listTools', () => {
  it('stores and retrieves tools for an integration', () => {
    localMCPStorage.saveTools('integ_telegram', [
      {
        id: 'tg_send',
        integrationId: 'integ_telegram',
        toolName: 'send_message',
        displayName: 'Send Message',
        permissionMode: 'auto',
      },
    ])
    const tools = localMCPStorage.listTools('integ_telegram')
    expect(tools).toHaveLength(1)
    expect(tools[0].toolName).toBe('send_message')
  })

  it('replaces existing tools for the same integrationId on second save', () => {
    localMCPStorage.saveTools('integ_telegram', [
      { id: 't1', integrationId: 'integ_telegram', toolName: 'old', displayName: 'Old', permissionMode: 'auto' },
    ])
    localMCPStorage.saveTools('integ_telegram', [
      { id: 't2', integrationId: 'integ_telegram', toolName: 'new', displayName: 'New', permissionMode: 'auto' },
    ])
    const tools = localMCPStorage.listTools('integ_telegram')
    expect(tools).toHaveLength(1)
    expect(tools[0].toolName).toBe('new')
  })

  it('does not affect tools for other integrations', () => {
    localMCPStorage.saveTools('integ_telegram', [
      { id: 't1', integrationId: 'integ_telegram', toolName: 'send', displayName: 'Send', permissionMode: 'auto' },
    ])
    localMCPStorage.saveTools('integ_figma', [
      { id: 'f1', integrationId: 'integ_figma', toolName: 'inspect', displayName: 'Inspect', permissionMode: 'read_only' },
    ])
    expect(localMCPStorage.listTools('integ_telegram')).toHaveLength(1)
    expect(localMCPStorage.listTools('integ_figma')).toHaveLength(1)
    expect(localMCPStorage.listTools()).toHaveLength(2)
  })
})

describe('saveExecutionRecord / listExecutionRecords', () => {
  it('returns records sorted newest-first', () => {
    localMCPStorage.saveExecutionRecord({
      id: 'exec_1',
      toolId: 't1',
      integrationId: 'integ_telegram',
      sourceSurface: 'chat',
      status: 'success',
      requestedAt: '2026-01-01T10:00:00.000Z',
    })
    localMCPStorage.saveExecutionRecord({
      id: 'exec_2',
      toolId: 't1',
      integrationId: 'integ_telegram',
      sourceSurface: 'chat',
      status: 'failed',
      requestedAt: '2026-01-01T11:00:00.000Z',
    })
    const records = localMCPStorage.listExecutionRecords()
    expect(records[0].id).toBe('exec_2')
    expect(records[1].id).toBe('exec_1')
  })

  it('filters by integrationId', () => {
    localMCPStorage.saveExecutionRecord({
      id: 'exec_a',
      toolId: 't1',
      integrationId: 'integ_telegram',
      sourceSurface: 'chat',
      status: 'success',
      requestedAt: '2026-01-01T10:00:00.000Z',
    })
    localMCPStorage.saveExecutionRecord({
      id: 'exec_b',
      toolId: 't2',
      integrationId: 'integ_figma',
      sourceSurface: 'chat',
      status: 'success',
      requestedAt: '2026-01-01T10:01:00.000Z',
    })
    const records = localMCPStorage.listExecutionRecords({ integrationId: 'integ_telegram' })
    expect(records).toHaveLength(1)
    expect(records[0].id).toBe('exec_a')
  })

  it('respects limit option', () => {
    for (let i = 0; i < 5; i++) {
      localMCPStorage.saveExecutionRecord({
        id: `exec_${i}`,
        toolId: 't1',
        integrationId: 'integ_telegram',
        sourceSurface: 'chat',
        status: 'success',
        requestedAt: new Date(2026, 0, 1, i).toISOString(),
      })
    }
    expect(localMCPStorage.listExecutionRecords({ limit: 2 })).toHaveLength(2)
  })
})

describe('updateExecutionRecord', () => {
  it('patches a record in place', () => {
    localMCPStorage.saveExecutionRecord({
      id: 'exec_x',
      toolId: 't1',
      integrationId: 'integ_telegram',
      sourceSurface: 'chat',
      status: 'queued',
      requestedAt: '2026-01-01T10:00:00.000Z',
    })
    const updated = localMCPStorage.updateExecutionRecord('exec_x', { status: 'success' })
    expect(updated.status).toBe('success')
    expect(localMCPStorage.listExecutionRecords()[0].status).toBe('success')
  })

  it('throws if execution record does not exist', () => {
    expect(() =>
      localMCPStorage.updateExecutionRecord('ghost_exec', { status: 'success' })
    ).toThrow('not found')
  })
})

describe('listTelegramMessages', () => {
  it('seeds 5 mock messages on first call', () => {
    const messages = localMCPStorage.listTelegramMessages()
    expect(messages).toHaveLength(5)
  })

  it('prepends new messages', () => {
    localMCPStorage.listTelegramMessages()
    localMCPStorage.saveTelegramMessage({
      id: 'tcm_new',
      chatId: 'test',
      messageText: 'Hello',
      receivedAt: new Date().toISOString(),
      status: 'received',
    })
    const messages = localMCPStorage.listTelegramMessages()
    expect(messages[0].id).toBe('tcm_new')
    expect(messages).toHaveLength(6)
  })
})
