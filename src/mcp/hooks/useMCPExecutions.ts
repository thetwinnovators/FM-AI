import { useCallback, useEffect, useState } from 'react'
import type { MCPExecutionRecord } from '../types.js'
import { getExecutionLog, runTool } from '../services/mcpExecutionService.js'
import type { RunToolParams, RunToolResult } from '../services/mcpExecutionService.js'

export function useMCPExecutions(integrationId?: string) {
  const [records, setRecords] = useState<MCPExecutionRecord[]>([])
  const [running, setRunning] = useState(false)

  const reload = useCallback(() => {
    setRecords(getExecutionLog({ integrationId }))
  }, [integrationId])

  useEffect(() => {
    reload()
  }, [reload])

  async function execute(params: RunToolParams): Promise<RunToolResult> {
    setRunning(true)
    try {
      const result = await runTool(params)
      reload()
      return result
    } finally {
      setRunning(false)
    }
  }

  return { records, running, execute, reload }
}
