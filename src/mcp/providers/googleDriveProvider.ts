import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'gdrive_list_files',
    toolName: 'list_files',
    displayName: 'List Drive Files',
    description: 'List files in a Google Drive folder.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      folderId: { type: 'string', description: 'Folder ID to list (defaults to root if omitted)' },
      query: { type: 'string', description: 'Search query to filter files (optional)' },
      limit: { type: 'number', description: 'Max number of results to return (default 20)' },
    },
    tags: ['google-drive', 'list', 'read'],
  },
  {
    id: 'gdrive_create_folder',
    toolName: 'create_folder',
    displayName: 'Create Drive Folder',
    description: 'Create a new folder in Google Drive.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      name: { type: 'string', description: 'Folder name' },
      parentId: { type: 'string', description: 'Parent folder ID (optional, defaults to root)' },
    },
    tags: ['google-drive', 'create', 'write'],
  },
  {
    id: 'gdrive_upload_file',
    toolName: 'upload_file',
    displayName: 'Upload to Drive',
    description: 'Upload a file or text content to Google Drive.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      name: { type: 'string', description: 'File name including extension' },
      content: { type: 'string', description: 'File content (plain text or base64-encoded data)' },
      mimeType: { type: 'string', description: 'MIME type (e.g. text/plain, application/pdf)' },
      folderId: { type: 'string', description: 'Target folder ID (optional)' },
    },
    tags: ['google-drive', 'upload', 'write'],
  },
]

export const googleDriveProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ integration, tool }) {
    if (integration.status !== 'connected') {
      return {
        success: false,
        error: `Google Drive is not connected. Open Connections → Google Drive to set it up.`,
      }
    }
    return {
      success: false,
      error: `Google Drive tool "${tool.displayName}" requires OAuth — coming in Phase 2.`,
    }
  },

  async testConnection(integration) {
    if (integration.status !== 'connected') {
      return { success: false, error: 'Not connected' }
    }
    return { success: true }
  },
}
