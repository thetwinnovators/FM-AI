import type { MCPToolDefinition } from '../types.js'

export interface ApprovalRequest {
  toolName: string
  integrationName: string
  inputSummary: string
  riskLevel: 'read' | 'write' | 'publish' | 'unknown'
}

export type ApprovalFn = (req: ApprovalRequest) => Promise<boolean>

let active: ApprovalFn | null = null

export function setApprovalHandler(fn: ApprovalFn | null): void {
  active = fn
}

export async function requestApproval(req: ApprovalRequest): Promise<boolean> {
  if (!active) {
    console.warn('No approval handler registered — denying by default')
    return false
  }
  return active(req)
}

export function shouldGate(tool: MCPToolDefinition): boolean {
  return tool.riskLevel === 'write' || tool.riskLevel === 'publish'
}

export function buildInputSummary(input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  return Object.entries(input as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
    .join('\n')
    .slice(0, 400)
}
