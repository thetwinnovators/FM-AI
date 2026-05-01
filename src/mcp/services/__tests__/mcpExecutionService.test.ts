import { beforeEach, describe, expect, it } from 'vitest'
import { runTool, getExecutionLog } from '../mcpExecutionService.js'
import { localMCPStorage } from '../../storage/localMCPStorage.js'

beforeEach(() => {
  localStorage.clear()
  // Seed a connected integration + tool for tests to use
  localMCPStorage.listIntegrations() // triggers seed
  localMCPStorage.updateIntegration('integ_canva', { status: 'connected' })
  localMCPStorage.saveTools('integ_canva', [
    {
      id: 'canva_create_design',
      integrationId: 'integ_canva',
      toolName: 'create_design',
      displayName: 'Create Canva Design',
      permissionMode: 'auto',
      tags: ['canva'],
    },
    {
      id: 'canva_restricted',
      integrationId: 'integ_canva',
      toolName: 'restricted_tool',
      displayName: 'Restricted',
      permissionMode: 'restricted',
    },
  ])
})

describe('runTool', () => {
  it('succeeds for an auto-permission tool', async () => {
    const result = await runTool({ toolId: 'canva_create_design', input: { brief: 'test' } })
    expect(result.success).toBe(true)
    expect(result.executionId).toBeTruthy()
  })

  it('writes a success execution record', async () => {
    await runTool({ toolId: 'canva_create_design' })
    const log = getExecutionLog()
    expect(log[0].status).toBe('success')
    expect(log[0].toolId).toBe('canva_create_design')
  })

  it('blocks a restricted tool and writes a failed record', async () => {
    const result = await runTool({ toolId: 'canva_restricted' })
    expect(result.success).toBe(false)
    const log = getExecutionLog()
    expect(log[0].status).toBe('failed')
  })

  it('returns error for unknown toolId', async () => {
    const result = await runTool({ toolId: 'no_such_tool' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })

  it('queues awaiting_approval record for approval_required tool', async () => {
    localMCPStorage.saveTools('integ_canva', [
      {
        id: 'canva_approval',
        integrationId: 'integ_canva',
        toolName: 'approval_tool',
        displayName: 'Approval Tool',
        permissionMode: 'approval_required',
      },
    ])
    const result = await runTool({ toolId: 'canva_approval' })
    expect(result.success).toBe(false)
    expect(result.requiresApproval).toBe(true)
    const log = getExecutionLog()
    expect(log[0].status).toBe('awaiting_approval')
  })

  it('returns error when tool integration is missing', async () => {
    localMCPStorage.saveTools('integ_canva', [
      {
        id: 'orphan_tool',
        integrationId: 'integ_nonexistent',
        toolName: 'orphan',
        displayName: 'Orphan',
        permissionMode: 'auto',
      },
    ])
    const result = await runTool({ toolId: 'orphan_tool' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })
})

