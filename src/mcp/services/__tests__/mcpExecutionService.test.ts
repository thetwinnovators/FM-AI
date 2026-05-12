import { vi, beforeEach, afterEach, describe, expect, it } from 'vitest'
import { runTool, getExecutionLog } from '../mcpExecutionService.js'
import { localMCPStorage } from '../../storage/localMCPStorage.js'
import { setApprovalHandler } from '../approvalBridge.js'

// Mock getProvider so execution tests don't depend on real provider implementations.
// The mock returns a controllable stub for figma that always reports success for
// read tools — the execution service logic (permission gate, record writing) is what
// this test suite exercises, not the provider's internal behavior.
vi.mock('../mcpToolRegistry.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mcpToolRegistry.js')>()
  return {
    ...original,
    getProvider: (type: string) => {
      if (type === 'figma') {
        return {
          listTools: async () => [],
          executeTool: async () => ({ success: true, output: { mock: true } }),
          testConnection: async () => ({ success: true }),
        }
      }
      return original.getProvider(type as any)
    },
  }
})

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

afterEach(() => {
  // Clear any approval handler registered during a test so it doesn't leak
  // into the next test and accidentally allow/deny unrelated executions.
  setApprovalHandler(null)
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

  // Approval flow is now driven by approvalBridge.requestApproval(). The execution
  // service asks the bridge and either proceeds (handler returns true) or marks
  // the record cancelled with error 'denied by user' (handler returns false or no
  // handler registered).
  it('proceeds when approval handler approves an approval_required tool', async () => {
    localMCPStorage.saveTools('integ_figma', [
      {
        id: 'figma_approval',
        integrationId: 'integ_figma',
        toolName: 'approval_tool',
        displayName: 'Approval Tool',
        permissionMode: 'approval_required',
      },
    ])
    const handler = vi.fn(async () => true)
    setApprovalHandler(handler)

    const result = await runTool({ toolId: 'figma_approval', input: { foo: 'bar' } })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'Approval Tool',
      }),
    )
    expect(result.success).toBe(true)
    const log = getExecutionLog()
    expect(log[0].status).toBe('success')
  })

  it('denies an approval_required tool when handler returns false', async () => {
    localMCPStorage.saveTools('integ_figma', [
      {
        id: 'figma_approval',
        integrationId: 'integ_figma',
        toolName: 'approval_tool',
        displayName: 'Approval Tool',
        permissionMode: 'approval_required',
      },
    ])
    const handler = vi.fn(async () => false)
    setApprovalHandler(handler)

    const result = await runTool({ toolId: 'figma_approval' })

    expect(handler).toHaveBeenCalledOnce()
    expect(result.success).toBe(false)
    expect(result.error).toBe('denied by user')
    const log = getExecutionLog()
    expect(log[0].status).toBe('cancelled')
    expect(log[0].errorMessage).toBe('denied by user')
  })

  it('proceeds when approval handler approves a publish-risk tool', async () => {
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
    const handler = vi.fn(async () => true)
    setApprovalHandler(handler)

    const result = await runTool({ toolId: 'figma_publish' })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'Publish Tool',
        riskLevel: 'publish',
      }),
    )
    expect(result.success).toBe(true)
    const log = getExecutionLog()
    expect(log[0].status).toBe('success')
  })

  it('denies a publish-risk tool when handler returns false', async () => {
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
    const handler = vi.fn(async () => false)
    setApprovalHandler(handler)

    const result = await runTool({ toolId: 'figma_publish' })

    expect(handler).toHaveBeenCalledOnce()
    expect(result.success).toBe(false)
    expect(result.error).toBe('denied by user')
    const log = getExecutionLog()
    expect(log[0].status).toBe('cancelled')
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
