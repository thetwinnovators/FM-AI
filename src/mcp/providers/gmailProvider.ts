import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'gmail_search_threads',
    toolName: 'search_threads',
    displayName: 'Search Gmail Threads',
    description: 'Search Gmail threads by query string.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      query: { type: 'string', description: 'Gmail search query (e.g. "from:boss subject:report")' },
      maxResults: { type: 'number', description: 'Maximum threads to return (default 10)' },
    },
    tags: ['gmail', 'search', 'read'],
  },
  {
    id: 'gmail_draft_email',
    toolName: 'draft_email',
    displayName: 'Draft Email',
    description: 'Create a Gmail draft without sending it.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject line' },
      body: { type: 'string', description: 'Email body (plain text or HTML)' },
    },
    tags: ['gmail', 'draft', 'write'],
  },
  {
    id: 'gmail_send_email',
    toolName: 'send_email',
    displayName: 'Send Email',
    description: 'Send an email via Gmail.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject line' },
      body: { type: 'string', description: 'Email body (plain text or HTML)' },
    },
    tags: ['gmail', 'send', 'publish'],
  },
]

export const gmailProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ integration, tool }) {
    if (integration.status !== 'connected') {
      return {
        success: false,
        error: `Gmail is not connected. Open Connections → Gmail to set it up.`,
      }
    }
    return {
      success: false,
      error: `Gmail tool "${tool.displayName}" requires OAuth — coming in Phase 3.`,
    }
  },

  async testConnection(integration) {
    if (integration.status !== 'connected') {
      return { success: false, error: 'Not connected' }
    }
    return { success: true }
  },
}
