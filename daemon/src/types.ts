export type RiskLevel = 'read' | 'write' | 'publish'

export type JobStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'done'
  | 'failed'
  | 'cancelled'

export type ErrorCode =
  | 'validation_failed'
  | 'permission_denied'
  | 'sandbox_violation'
  | 'timeout'
  | 'adapter_failure'

export interface JobError {
  code: ErrorCode
  message: string
  details?: unknown
}

export interface Job {
  id: string
  toolId: string
  params: unknown
  status: JobStatus
  createdAt: string
  startedAt?: string
  finishedAt?: string
  result?: unknown
  error?: JobError
}

export type JobEvent =
  | { type: 'queued'; jobId: string }
  | { type: 'running'; jobId: string }
  | { type: 'log'; jobId: string; stream: 'stdout' | 'stderr'; chunk: string }
  | { type: 'output'; jobId: string; partial: unknown }
  | { type: 'done'; jobId: string; result: unknown }
  | { type: 'failed'; jobId: string; error: JobError }
  | { type: 'cancelled'; jobId: string }

export interface ToolDefinition {
  id: string
  displayName: string
  description: string
  risk: RiskLevel
  paramsSchema: unknown
}

export interface ToolHandlerContext {
  jobId: string
  emit: (event: JobEvent) => void
  signal: AbortSignal
}

export type ToolHandler = (params: unknown, ctx: ToolHandlerContext) => Promise<unknown>
