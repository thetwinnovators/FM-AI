import type { MCPIntegration, MCPToolDefinition, TelegramCommandMessage } from '../types.js'

export interface MCPIntegrationProvider {
  listTools(integration: MCPIntegration): Promise<MCPToolDefinition[]>
  executeTool(params: {
    integration: MCPIntegration
    tool: MCPToolDefinition
    input: Record<string, unknown>
  }): Promise<{ success: boolean; output?: unknown; error?: string }>
  testConnection(integration: MCPIntegration): Promise<{ success: boolean; error?: string }>
}

export interface TelegramProvider {
  sendMessage(params: {
    token: string
    chatId: string
    text: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }>
  testConnection(params: {
    token: string
    chatId: string
  }): Promise<{ success: boolean; error?: string }>
  handleIncomingWebhook(payload: unknown): Promise<TelegramCommandMessage>
}
