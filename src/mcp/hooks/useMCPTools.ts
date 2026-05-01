import { useEffect, useState } from 'react'
import type { MCPToolDefinition } from '../types.js'
import { getTools } from '../services/mcpToolRegistry.js'

export function useMCPTools(integrationId?: string) {
  const [tools, setTools] = useState<MCPToolDefinition[]>([])

  useEffect(() => {
    setTools(getTools(integrationId))
  }, [integrationId])

  return { tools }
}

