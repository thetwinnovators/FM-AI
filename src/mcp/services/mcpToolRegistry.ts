import type { MCPIntegration, MCPToolDefinition, IntegrationType } from '../types.js'
import type { MCPIntegrationProvider } from '../providers/types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { telegramMCPProvider } from '../providers/telegramMCPProvider.js'
import { mockGoogleWorkspaceProvider } from '../providers/mockGoogleWorkspaceProvider.js'
import { mockFigmaProvider } from '../providers/mockFigmaProvider.js'
import { mockCanvaProvider } from '../providers/mockCanvaProvider.js'
import { mockGenericMCPProvider } from '../providers/mockGenericMCPProvider.js'

const PROVIDERS: Record<IntegrationType, MCPIntegrationProvider> = {
  telegram: telegramMCPProvider,
  'google-workspace': mockGoogleWorkspaceProvider,
  figma: mockFigmaProvider,
  canva: mockCanvaProvider,
  'generic-mcp': mockGenericMCPProvider,
}

export function getProvider(type: IntegrationType): MCPIntegrationProvider {
  return PROVIDERS[type]
}

export async function discoverTools(integration: MCPIntegration): Promise<MCPToolDefinition[]> {
  const provider = getProvider(integration.type)
  const tools = await provider.listTools(integration)
  localMCPStorage.saveTools(integration.id, tools)
  return tools
}

export function getTools(integrationId?: string): MCPToolDefinition[] {
  return localMCPStorage.listTools(integrationId)
}