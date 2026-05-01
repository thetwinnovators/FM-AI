import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'figma_inspect_file',
    toolName: 'inspect_file',
    displayName: 'Inspect Figma File',
    description: 'Read layers and metadata from a Figma file.',
    permissionMode: 'read_only',
    tags: ['figma', 'read'],
  },
  {
    id: 'figma_push_content',
    toolName: 'push_content',
    displayName: 'Push Content to Canvas',
    description: 'Push text content to a Figma frame.',
    permissionMode: 'approval_required',
    tags: ['figma', 'write'],
  },
]

export const mockFigmaProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },
  async executeTool({ tool, input }) {
    console.log(`[MockFigma] ${tool.toolName}`, input)
    return { success: true, output: { mock: true, tool: tool.toolName } }
  },
  async testConnection() {
    return { success: true }
  },
}
