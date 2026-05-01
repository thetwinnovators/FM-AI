import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'gws_create_doc',
    toolName: 'create_doc',
    displayName: 'Create Google Doc',
    description: 'Create a new Google Doc with provided content.',
    permissionMode: 'auto',
    tags: ['docs', 'create'],
  },
  {
    id: 'gws_append_sheet',
    toolName: 'append_sheet',
    displayName: 'Append to Sheet',
    description: 'Append rows to a Google Sheet.',
    permissionMode: 'approval_required',
    tags: ['sheets', 'write'],
  },
  {
    id: 'gws_create_calendar_event',
    toolName: 'create_calendar_event',
    displayName: 'Create Calendar Event',
    description: 'Create a new event in Google Calendar.',
    permissionMode: 'approval_required',
    tags: ['calendar', 'create'],
  },
  {
    id: 'gws_send_email',
    toolName: 'send_email',
    displayName: 'Send Email',
    description: 'Send an email via Gmail.',
    permissionMode: 'approval_required',
    tags: ['gmail', 'send'],
  },
]

export const mockGoogleWorkspaceProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },
  async executeTool({ tool, input }) {
    console.log(`[MockGoogleWorkspace] ${tool.toolName}`, input)
    return {
      success: true,
      output: { mock: true, tool: tool.toolName, note: 'Mock — no real API call made.' },
    }
  },
  async testConnection() {
    return { success: true }
  },
}
