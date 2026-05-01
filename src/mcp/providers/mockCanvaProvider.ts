import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'canva_create_design',
    toolName: 'create_design',
    displayName: 'Create Canva Design',
    description: 'Create a new Canva design from a template.',
    permissionMode: 'auto',
    tags: ['canva', 'create'],
  },
  {
    id: 'canva_generate_captions',
    toolName: 'generate_captions',
    displayName: 'Generate Captions',
    description: 'Generate social media captions from a design brief.',
    permissionMode: 'auto',
    tags: ['canva', 'captions'],
  },
]

export const mockCanvaProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },
  async executeTool({ tool, input }) {
    console.log(`[MockCanva] ${tool.toolName}`, input)
    return { success: true, output: { mock: true, tool: tool.toolName } }
  },
  async testConnection() {
    return { success: true }
  },
}
