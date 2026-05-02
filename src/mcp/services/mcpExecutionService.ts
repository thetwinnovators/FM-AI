import type { MCPExecutionRecord, SourceSurface } from '../types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { checkPermission } from './mcpPermissionService.js'
import { getProvider } from './mcpToolRegistry.js'

export interface RunToolParams {
  toolId: string
  input?: Record<string, unknown>
  sourceSurface?: SourceSurface
}

export interface RunToolResult {
  success: boolean
  executionId: string
  output?: unknown
  error?: string
  requiresApproval?: boolean
}

function makeId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export async function runTool(params: RunToolParams): Promise<RunToolResult> {
  const { toolId, input = {}, sourceSurface = 'other' } = params

  const tool = localMCPStorage.listTools().find((t) => t.id === toolId)
  if (!tool) {
    return { success: false, executionId: makeId(), error: `Tool ${toolId} not found` }
  }

  const integration = localMCPStorage.getIntegration(tool.integrationId)
  if (!integration) {
    return {
      success: false,
      executionId: makeId(),
      error: `Integration ${tool.integrationId} not found`,
    }
  }

  const id = makeId()
  const record: MCPExecutionRecord = {
    id,
    toolId: tool.id,
    integrationId: integration.id,
    sourceSurface,
    status: 'queued',
    requestedAt: new Date().toISOString(),
    inputSummary: Object.keys(input).length
      ? JSON.stringify(input).slice(0, 120)
      : undefined,
  }
  localMCPStorage.saveExecutionRecord(record)

  const permission = checkPermission(tool)

  if (!permission.allowed) {
    localMCPStorage.updateExecutionRecord(id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage: permission.reason,
    })
    return { success: false, executionId: id, error: permission.reason }
  }

  if (permission.requiresApproval) {
    localMCPStorage.updateExecutionRecord(id, { status: 'awaiting_approval' })
    return {
      success: false,
      executionId: id,
      requiresApproval: true,
      error: permission.reason ?? 'Approval required',
    }
  }

  localMCPStorage.updateExecutionRecord(id, { status: 'running' })

  try {
    // Note: unlike discoverTools(), we do not throw here because there is an
    // in-flight execution record that must be completed with a failure status.
    const provider = getProvider(integration.type)
    if (!provider) {
      localMCPStorage.updateExecutionRecord(id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errorMessage: `No provider registered for type "${integration.type}"`,
      })
      return { success: false, executionId: id, error: `No provider registered for type "${integration.type}"` }
    }
    const result = await provider.executeTool({ integration, tool, input })
    localMCPStorage.updateExecutionRecord(id, {
      status: result.success ? 'success' : 'failed',
      completedAt: new Date().toISOString(),
      outputSummary: result.output
        ? JSON.stringify(result.output).slice(0, 120)
        : undefined,
      errorMessage: result.error,
    })
    return { success: result.success, executionId: id, output: result.output, error: result.error }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    localMCPStorage.updateExecutionRecord(id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage: message,
    })
    return { success: false, executionId: id, error: message }
  }
}

export function getExecutionLog(options?: {
  integrationId?: string
  limit?: number
}): MCPExecutionRecord[] {
  return localMCPStorage.listExecutionRecords(options)
}
