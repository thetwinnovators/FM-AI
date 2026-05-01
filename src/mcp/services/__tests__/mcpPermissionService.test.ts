import { describe, expect, it } from 'vitest'
import { checkPermission } from '../mcpPermissionService.js'
import type { MCPToolDefinition } from '../../types.js'

function makeTool(permissionMode: MCPToolDefinition['permissionMode']): MCPToolDefinition {
  return {
    id: 't1',
    integrationId: 'i1',
    toolName: 'test',
    displayName: 'Test Tool',
    permissionMode,
  }
}

describe('checkPermission', () => {
  it('auto → allowed immediately', () => {
    const result = checkPermission(makeTool('auto'))
    expect(result.allowed).toBe(true)
    expect(result.requiresApproval).toBe(false)
  })

  it('approval_required → allowed but needs approval', () => {
    const result = checkPermission(makeTool('approval_required'))
    expect(result.allowed).toBe(true)
    expect(result.requiresApproval).toBe(true)
    expect(result.reason).toContain('Test Tool')
  })

  it('read_only → allowed without approval', () => {
    const result = checkPermission(makeTool('read_only'))
    expect(result.allowed).toBe(true)
    expect(result.requiresApproval).toBe(false)
  })

  it('restricted → blocked with reason', () => {
    const result = checkPermission(makeTool('restricted'))
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Test Tool')
  })

  it('restricted → blocked', () => {
    const result = checkPermission(makeTool('restricted'))
    expect(result.allowed).toBe(false)
    expect(result.requiresApproval).toBe(false)
    expect(result.reason).toBeTruthy()
  })
})
