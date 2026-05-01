import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'generic_ping',
    toolName: 'ping',
    displayName: 'Ping',
    description: 'Test connectivity to the MCP server.',
    permissionMode: 'auto',
    tags: ['generic', 'test'],
  },
]

export const mockGenericMCPProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },
  async executeTool({ tool, input }) {
    console.log(`[MockGenericMCP] ${tool.toolName}`, input)
    return { success: true, output: { pong: true } }
  },
  async testConnection() {
    return { success: true }
  },
}
