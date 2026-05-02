import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'gdocs_create_doc',
    toolName: 'create_doc',
    displayName: 'Create Google Doc',
    description: 'Create a new Google Doc from a title and body text.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      title: { type: 'string', description: 'Document title' },
      body: { type: 'string', description: 'Initial document content' },
      folderId: { type: 'string', description: 'Google Drive folder ID to save into (optional)' },
    },
    tags: ['google-docs', 'create', 'write'],
  },
  {
    id: 'gdocs_append_doc',
    toolName: 'append_doc',
    displayName: 'Append to Google Doc',
    description: 'Append text or a section to an existing Google Doc.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      documentId: { type: 'string', description: 'Google Doc ID to append to' },
      content: { type: 'string', description: 'Text content to append' },
    },
    tags: ['google-docs', 'edit', 'write'],
  },
  {
    id: 'gdocs_read_doc',
    toolName: 'read_doc',
    displayName: 'Read Google Doc',
    description: 'Read the text content of a Google Doc by ID.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      documentId: { type: 'string', description: 'Google Doc ID to read' },
    },
    tags: ['google-docs', 'read'],
  },
]

export const googleDocsProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ integration, tool }) {
    if (integration.status !== 'connected') {
      return {
        success: false,
        error: `Google Docs is not connected. Open Connections → Google Docs to set it up.`,
      }
    }
    // OAuth execution not yet wired — Phase 3
    return {
      success: false,
      error: `Google Docs tool "${tool.displayName}" requires OAuth — coming in Phase 3.`,
    }
  },

  async testConnection(integration) {
    if (integration.status !== 'connected') {
      return { success: false, error: 'Not connected' }
    }
    return { success: true }
  },
}
