import { useCallback, useEffect, useState } from 'react'
import type { MCPIntegration } from '../types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { discoverTools } from '../services/mcpToolRegistry.js'

export function useMCPIntegrations() {
  const [integrations, setIntegrations] = useState<MCPIntegration[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setIntegrations(localMCPStorage.listIntegrations())
  }, [])

  useEffect(() => {
    reload()
    setLoading(false)
  }, [reload])

  async function connect(
    integrationId: string,
    config?: Record<string, string>
  ): Promise<void> {
    const integration = localMCPStorage.getIntegration(integrationId)
    if (!integration) return
    const updated = localMCPStorage.updateIntegration(integrationId, {
      status: 'connected',
      connectedAt: new Date().toISOString(),
      config: config ?? integration.config,
    })
    await discoverTools(updated)
    reload()
  }

  function disconnect(integrationId: string): void {
    localMCPStorage.updateIntegration(integrationId, {
      status: 'disconnected',
      config: undefined,
    })
    reload()
  }

  function updateConfig(
    integrationId: string,
    config: Record<string, string>
  ): void {
    localMCPStorage.updateIntegration(integrationId, { config })
    reload()
  }

  return { integrations, loading, connect, disconnect, updateConfig, reload }
}
