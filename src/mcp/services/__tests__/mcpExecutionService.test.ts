import { beforeEach, describe, expect, it } from 'vitest'
import { runTool, getExecutionLog } from '../mcpExecutionService.js'
import { localMCPStorage } from '../../storage/localMCPStorage.js'

beforeEach(() => {
  localStorage.clear()
  localMCPStorage.listIntegrations() // triggers seed
  localMCPStorage.updateIntegration('integ_figma', { status: 'connected' })
  localMCPStorage.saveTools('integ_figma', [
    {
      id: 'figma_auto_tool',
      integrationId: 'integ_figma',
      toolName: 'inspect_file',
      displayName: 'Inspect Figma File',
      riskLevel: 'read' as const,
      permissionMode: 'auto' as const,
      tags: ['figma'],
    },
    {
      id: 'figma_restricted',
      integrationId: 'integ_figma',
      toolName: 'restricted_tool',
      displayName: 'Restricted',
      permissionMode: 'restricted' as const,
    },
  ])
})

describe('runTool', () => {
  it('succeeds for a read-risk tool', async () => {
    const result = await runTool({ toolId: 'figma_auto_tool', input: { brief: 'test' } })
    expect(result.success).toBe(true)
    expect(result.executionId).toBeTruthy()
  })

  it('writes a success execution record', async () => {
    await runTool({ toolId: 'figma_auto_tool' })
    const log = getExecutionLog()
    expect(log[0].status).toBe('success')
    expect(log[0].toolId).toBe('figma_auto_tool')
  })

  it('blocks a restricted tool and writes a failed record', async () => {
    const result = await runTool({ toolId: 'figma_restricted' })
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
    localMCPStorage.saveTools('integ_figma', [
      {
        id: 'figma_approval',
        integrationId: 'integ_figma',
        toolName: 'approval_tool',
        displayName: 'Approval Tool',
        permissionMode: 'approval_required',
      },
    ])
    const result = await runTool({ toolId: 'figma_approval' })
    expect(result.success).toBe(false)
    expect(result.requiresApproval).toBe(true)
    const log = getExecutionLog()
    expect(log[0].status).toBe('awaiting_approval')
  })

  it('awaits confirmation for a publish-risk tool', async () => {
    localMCPStorage.saveTools('integ_figma', [
      {
        id: 'figma_publish',
        integrationId: 'integ_figma',
        toolName: 'publish_tool',
        displayName: 'Publish Tool',
        riskLevel: 'publish' as const,
        permissionMode: 'auto' as const,
      },
    ])
    const result = await runTool({ toolId: 'figma_publish' })
    expect(result.success).toBe(false)
    expect(result.requiresApproval).toBe(true)
    const log = getExecutionLog()
    expect(log[0].status).toBe('awaiting_approval')
  })

  it('returns error when tool integration is missing', async () => {
    localMCPStorage.saveTools('integ_figma', [
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

describe('getExecutionLog', () => {
  it('returns empty array when no executions', () => {
    expect(getExecutionLog()).toHaveLength(0)
  })
})
