import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'figma_inspect_file',
    toolName: 'inspect_file',
    displayName: 'Inspect Figma File',
    description: 'Read layers, frames, and metadata from a Figma file.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      fileId: { type: 'string', description: 'Figma file ID from the file URL' },
    },
    tags: ['figma', 'inspect', 'read'],
  },
  {
    id: 'figma_read_comments',
    toolName: 'read_comments',
    displayName: 'Read Figma Comments',
    description: 'Read all comments on a Figma file.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      fileId: { type: 'string', description: 'Figma file ID' },
    },
    tags: ['figma', 'comments', 'read'],
  },
  {
    id: 'figma_pull_design_tokens',
    toolName: 'pull_design_tokens',
    displayName: 'Pull Design Tokens',
    description: 'Extract design tokens (colors, typography, spacing) from a Figma file.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      fileId: { type: 'string', description: 'Figma file ID' },
    },
    tags: ['figma', 'tokens', 'read'],
  },
  {
    id: 'figma_list_pages',
    toolName: 'list_pages',
    displayName: 'List Figma Pages',
    description: 'List all pages in a Figma file.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      fileId: { type: 'string', description: 'Figma file ID' },
    },
    tags: ['figma', 'pages', 'read'],
  },
]

export const figmaProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ integration, tool }) {
    if (integration.status !== 'connected') {
      return {
        success: false,
        error: `Figma is not connected. Open Connections → Figma to set it up.`,
      }
    }
    return {
      success: false,
      error: `Figma tool "${tool.displayName}" requires OAuth — coming in Phase 3.`,
    }
  },

  async testConnection(integration) {
    if (integration.status !== 'connected') {
      return { success: false, error: 'Not connected' }
    }
    return { success: true }
  },
}
