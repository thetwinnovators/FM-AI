export type IntegrationType =
  | 'telegram'
  | 'google-drive'
  | 'gmail'
  | 'google-calendar'
  | 'google-slides'
  | 'youtube'
  | 'google-docs'
  | 'higgsfield'
  | 'instagram'
  | 'facebook'
  | 'figma'
  | 'flowmap'

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

export type MCPToolRiskLevel = 'read' | 'write' | 'publish'

export interface MCPToolDefinition {
  id: string
  integrationId: string
  toolName: string
  displayName: string
  description?: string
  riskLevel?: MCPToolRiskLevel        // new — takes precedence when set
  permissionMode: ToolPermissionMode  // kept for backwards compat
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

export interface ContextFileReference {
  fileId: string          // unique id, e.g. "ctxfile_<timestamp>_<random>"
  title: string           // human-readable label
  contentType: string     // e.g. "text/plain", "text/markdown", "application/json"
  charCount: number       // character length of stored content (content.length)
  reasonIncluded: string  // why this was captured, e.g. "webpage extract for task xyz"
  createdAt: string       // ISO timestamp
}

export type TaskTranscriptEntryType = 'tool_call' | 'tool_result' | 'note' | 'recitation'

export type TaskTranscriptEntryStatus = 'success' | 'failed'

export interface TaskTranscriptEntry {
  seq: number                     // monotonically increasing sequence number
  type: TaskTranscriptEntryType
  toolName?: string               // set for tool_call and tool_result entries
  content: string                 // summary text or recitation body
  status?: TaskTranscriptEntryStatus  // set for tool_result entries
  errorReason?: string            // set when status === 'failed', kept visible per spec
  retryOf?: number                // seq of the entry this retries, if applicable
  timestamp: string               // ISO timestamp
}

export type AgentTaskPlanStatus = 'planned' | 'running' | 'blocked' | 'completed' | 'failed'
export type AgentTaskStepStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AgentTaskStep {
  id: string
  title: string
  toolName?: string
  status: AgentTaskStepStatus
  notes?: string
}

export interface AgentTaskPlan {
  id: string
  goal: string
  status: AgentTaskPlanStatus
  currentStep?: string            // id of the currently active step
  steps: AgentTaskStep[]
  recitationSummary: string       // short paragraph rewritten after each step
  createdAt: string
  updatedAt: string
  contextFiles?: ContextFileReference[]  // files accumulated; defaults to [] on creation
  transcript?: TaskTranscriptEntry[]     // append-only log; defaults to [] on creation
}
