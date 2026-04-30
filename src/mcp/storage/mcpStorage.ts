import type {
  MCPIntegration,
  MCPToolDefinition,
  MCPExecutionRecord,
  TelegramCommandMessage,
} from '../types.js'

export interface MCPStorage {
  listIntegrations(): MCPIntegration[]
  getIntegration(id: string): MCPIntegration | null
  saveIntegration(integration: MCPIntegration): void
  updateIntegration(id: string, patch: Partial<MCPIntegration>): MCPIntegration
  deleteIntegration(id: string): void

  listTools(integrationId?: string): MCPToolDefinition[]
  saveTools(integrationId: string, tools: MCPToolDefinition[]): void

  listExecutionRecords(options?: {
    integrationId?: string
    limit?: number
  }): MCPExecutionRecord[]
  saveExecutionRecord(record: MCPExecutionRecord): void
  updateExecutionRecord(
    id: string,
    patch: Partial<MCPExecutionRecord>
  ): MCPExecutionRecord

  saveTelegramMessage(message: TelegramCommandMessage): void
  listTelegramMessages(): TelegramCommandMessage[]
}
