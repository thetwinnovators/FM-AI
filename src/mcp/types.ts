export type IntegrationType =
  | 'telegram'
  | 'google-workspace'
  | 'figma'
  | 'canva'
  | 'generic-mcp'

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending'

export type ToolPermissionMode = 'auto' | 'approval_required' | 'read_only' | 'restricted'

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'awaiting_approval'

export type SourceSurface = 'chat' | 'research' | 'telegram' | 'automation' | 'other'

export interface MCPIntegration {
  id: string
  type: IntegrationType
  name: string
  description?: string
  status: IntegrationStatus
  connectedAt?: string
  updatedAt: string
  config?: Record<string, string>
  scopes?: string[]
}

export interface MCPToolDefinition {
  id: string
  integrationId: string
  toolName: string
  displayName: string
  description?: string
  permissionMode: ToolPermissionMode
  inputSchema?: Record<string, unknown>
  tags?: string[]
}

export interface MCPExecutionRecord {
  id: string
  toolId: string
  integrationId: string
  sourceSurface: SourceSurface
  status: ExecutionStatus
  requestedAt: string
  completedAt?: string
  inputSummary?: string
  outputSummary?: string
  errorMessage?: string
}

export interface TelegramCommandMessage {
  id: string
  chatId: string
  messageText: string
  receivedAt: string
  status: 'received' | 'processed' | 'failed'
  linkedExecutionId?: string
}
