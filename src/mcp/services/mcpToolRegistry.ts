import type { MCPIntegration, MCPToolDefinition, IntegrationType } from '../types.js'
import type { MCPIntegrationProvider } from '../providers/types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { telegramMCPProvider } from '../providers/telegramMCPProvider.js'
import { googleDocsProvider } from '../providers/googleDocsProvider.js'
import { googleDriveProvider } from '../providers/googleDriveProvider.js'
import { gmailProvider } from '../providers/gmailProvider.js'
import { googleCalendarProvider } from '../providers/googleCalendarProvider.js'
import { figmaProvider } from '../providers/figmaProvider.js'
import { flowmapProvider } from '../providers/flowmapProvider.js'

// Only integrations with a real or mock provider are registered here.
// Adding a new integration to the seed does NOT require a provider entry —
// omit it until the adapter is built.
const PROVIDERS: Partial<Record<IntegrationType, MCPIntegrationProvider>> = {
  telegram: telegramMCPProvider,
  'google-docs': googleDocsProvider,
  'google-drive': googleDriveProvider,
  gmail: gmailProvider,
  'google-calendar': googleCalendarProvider,
  figma: figmaProvider,
  flowmap: flowmapProvider,
}

export function getProvider(type: IntegrationType): MCPIntegrationProvider | undefined {
  return PROVIDERS[type]
}

export async function discoverTools(integration: MCPIntegration): Promise<MCPToolDefinition[]> {
  const provider = getProvider(integration.type)
  if (!provider) {
    throw new Error(
      `No provider registered for integration type: "${integration.type}". ` +
      `Add an adapter in src/mcp/providers/ and register it in PROVIDERS.`,
    )
  }
  const tools = await provider.listTools(integration)
  localMCPStorage.saveTools(integration.id, tools)
  return tools
}

export function getTools(integrationId?: string): MCPToolDefinition[] {
  return localMCPStorage.listTools(integrationId)
}
