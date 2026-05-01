import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'
import { realTelegramProvider } from './realTelegramProvider.js'

const TELEGRAM_TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'telegram_send_message',
    toolName: 'send_message',
    displayName: 'Send Message',
    description: 'Send a text message to a Telegram chat.',
    permissionMode: 'auto',
    tags: ['telegram', 'message'],
  },
  {
    id: 'telegram_send_summary',
    toolName: 'send_summary',
    displayName: 'Send Summary',
    description: 'Send a formatted summary or report to Telegram.',
    permissionMode: 'auto',
    tags: ['telegram', 'summary'],
  },
  {
    id: 'telegram_send_document',
    toolName: 'send_document',
    displayName: 'Send Document',
    description: 'Send a file or document link to Telegram.',
    permissionMode: 'auto',
    tags: ['telegram', 'document'],
  },
]

export const telegramMCPProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TELEGRAM_TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },
  async executeTool({ integration, tool, input }) {
    const token = integration.config?.['token'] ?? ''
    const chatId = integration.config?.['chatId'] ?? ''
    if (!token || !chatId) {
      return { success: false, error: 'Telegram bot token and chat ID are required' }
    }
    const text =
      typeof input['text'] === 'string'
        ? input['text']
        : `[FlowMap] Tool: ${tool.displayName}`
    const result = await realTelegramProvider.sendMessage({ token, chatId, text })
    return { success: result.success, output: result, error: result.error }
  },
  async testConnection(integration) {
    const token = integration.config?.['token'] ?? ''
    const chatId = integration.config?.['chatId'] ?? ''
    if (!token || !chatId) {
      return { success: false, error: 'Bot token and chat ID are required' }
    }
    return realTelegramProvider.testConnection({ token, chatId })
  },
}
