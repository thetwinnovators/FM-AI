import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'
import { realTelegramProvider } from './realTelegramProvider.js'

// permissionMode is kept alongside riskLevel for backwards compat.
// The permission gate uses riskLevel when present (see mcpPermissionService.ts).
const TELEGRAM_TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'telegram_send_message',
    toolName: 'send_message',
    displayName: 'Send Message',
    description: 'Send a text message to a Telegram chat.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      text: { type: 'string', description: 'Message text to send' },
    },
    tags: ['telegram', 'message'],
  },
  {
    id: 'telegram_send_summary',
    toolName: 'send_summary',
    displayName: 'Send Summary',
    description: 'Send a formatted summary or report to Telegram.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      text: { type: 'string', description: 'Summary content to send' },
    },
    tags: ['telegram', 'summary'],
  },
  {
    id: 'telegram_send_document',
    toolName: 'send_document',
    displayName: 'Send Document',
    description: 'Send a document link or file URL as a message to Telegram.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      text: { type: 'string', description: 'Document URL or file link to send as a message' },
    },
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
