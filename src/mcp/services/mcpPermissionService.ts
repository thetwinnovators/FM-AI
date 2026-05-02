import type { MCPToolDefinition, ToolPermissionMode, MCPToolRiskLevel } from '../types.js'

export interface PermissionResult {
  allowed: boolean
  requiresApproval: boolean
  reason?: string
}

function checkByRiskLevel(level: MCPToolRiskLevel, name: string): PermissionResult {
  switch (level) {
    case 'read':
    case 'write':
      return { allowed: true, requiresApproval: false }
    case 'publish':
      return {
        allowed: true,
        requiresApproval: true,
        reason: `"${name}" is a publish action and requires confirmation.`,
      }
    default: {
      const _exhaustive: never = level
      throw new Error(`Unhandled risk level: ${_exhaustive}`)
    }
  }
}

function checkByPermissionMode(mode: ToolPermissionMode, name: string): PermissionResult {
  switch (mode) {
    case 'auto':
      return { allowed: true, requiresApproval: false }
    case 'approval_required':
      return {
        allowed: true,
        requiresApproval: true,
        reason: `"${name}" requires approval before running.`,
      }
    case 'read_only':
      return { allowed: true, requiresApproval: false }
    case 'restricted':
      return {
        allowed: false,
        requiresApproval: false,
        reason: `"${name}" is restricted and cannot be run.`,
      }
    default: {
      const _exhaustive: never = mode
      throw new Error(`Unhandled permission mode: ${_exhaustive}`)
    }
  }
}

export function checkPermission(tool: MCPToolDefinition): PermissionResult {
  if (tool.riskLevel) {
    return checkByRiskLevel(tool.riskLevel, tool.displayName)
  }
  return checkByPermissionMode(tool.permissionMode, tool.displayName)
}

