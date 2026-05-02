import { describe, expect, it } from 'vitest'
import { checkPermission } from '../mcpPermissionService.js'
import type { MCPToolDefinition, MCPToolRiskLevel } from '../../types.js'

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
    expect(result.requiresApproval).toBe(false)
  })
})

describe('checkPermission — riskLevel takes precedence', () => {
  function makeToolWithRisk(
    riskLevel: MCPToolRiskLevel,
    permissionMode: MCPToolDefinition['permissionMode'] = 'auto',
  ): MCPToolDefinition {
    return {
      id: 't_risk',
      integrationId: 'i1',
      toolName: 'risk_test',
      displayName: 'Risk Test Tool',
      riskLevel,
      permissionMode,
    }
  }

  it('read → allowed, no confirmation', () => {
    const r = checkPermission(makeToolWithRisk('read'))
    expect(r.allowed).toBe(true)
    expect(r.requiresApproval).toBe(false)
  })

  it('write → allowed, no confirmation', () => {
    const r = checkPermission(makeToolWithRisk('write'))
    expect(r.allowed).toBe(true)
    expect(r.requiresApproval).toBe(false)
  })

  it('publish → allowed, requires confirmation', () => {
    const r = checkPermission(makeToolWithRisk('publish'))
    expect(r.allowed).toBe(true)
    expect(r.requiresApproval).toBe(true)
    expect(r.reason).toMatch(/Risk Test Tool/)
  })

  it('publish overrides permissionMode=auto', () => {
    const r = checkPermission(makeToolWithRisk('publish', 'auto'))
    expect(r.requiresApproval).toBe(true)
  })

  it('read overrides permissionMode=approval_required', () => {
    const r = checkPermission(makeToolWithRisk('read', 'approval_required'))
    expect(r.requiresApproval).toBe(false)
  })
})
