import type { MCPToolDefinition, ToolPermissionMode } from '../types.js'

export interface PermissionResult {
  allowed: boolean
  requiresApproval: boolean
  reason?: string
}

export function checkPermission(tool: MCPToolDefinition): PermissionResult {
  const mode: ToolPermissionMode = tool.permissionMode
  switch (mode) {
    case 'auto':
      return { allowed: true, requiresApproval: false }
    case 'approval_required':
      return {
        allowed: true,
        requiresApproval: true,
        reason: `"${tool.displayName}" requires approval before running.`,
      }
    case 'read_only':
      return { allowed: true, requiresApproval: false }
    case 'restricted':
      return {
        allowed: false,
        requiresApproval: false,
        reason: `"${tool.displayName}" is restricted and cannot be run.`,
      }
    default: {
      const _exhaustive: never = mode
      throw new Error(`Unhandled permission mode: ${_exhaustive}`)
    }
  }
}

