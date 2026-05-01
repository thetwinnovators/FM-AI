// Thin JS boundary — existing JSX views import from here.
// All implementation is in TypeScript services under src/mcp/services/.

export async function getMCPIntegrations() {
  const { localMCPStorage } = await import('./storage/localMCPStorage.js')
  return localMCPStorage.listIntegrations()
}

export async function connectIntegration(integrationId, config) {
  const { localMCPStorage } = await import('./storage/localMCPStorage.js')
  const { discoverTools } = await import('./services/mcpToolRegistry.js')
  const integration = localMCPStorage.getIntegration(integrationId)
  if (!integration) throw new Error(`Integration ${integrationId} not found`)
  const updated = localMCPStorage.updateIntegration(integrationId, {
    status: 'connected',
    connectedAt: new Date().toISOString(),
    config: config ?? integration.config,
  })
  await discoverTools(updated)
  return updated
}

export async function disconnectIntegration(integrationId) {
  const { localMCPStorage } = await import('./storage/localMCPStorage.js')
  return localMCPStorage.updateIntegration(integrationId, {
    status: 'disconnected',
    config: undefined,
  })
}

export async function getAllTools() {
  const { getTools } = await import('./services/mcpToolRegistry.js')
  return getTools()
}

export async function runTool(toolId, input = {}, sourceSurface = 'other') {
  const { runTool: run } = await import('./services/mcpExecutionService.js')
  return run({ toolId, input, sourceSurface })
}

export async function getExecutionLog(options) {
  const { getExecutionLog: getLog } = await import('./services/mcpExecutionService.js')
  return getLog(options)
}

export async function sendToTelegram(text) {
  const { sendTelegramMessage } = await import('./services/telegramService.js')
  return sendTelegramMessage(text)
}

export async function getTelegramMessages() {
  const { getTelegramMessages: getMessages } = await import('./services/telegramService.js')
  return getMessages()
}

export async function testTelegramConnection() {
  const { testTelegramConnection: test } = await import('./services/telegramService.js')
  return test()
}
