import { useMCPExecutions } from '../hooks/useMCPExecutions.js'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { ExecutionRecordList } from '../components/ExecutionRecordList.js'
import { ConnectionsSubNav } from '../components/ConnectionsSubNav.js'

export default function MCPExecutionLogPage() {
  const { records } = useMCPExecutions()
  const { tools } = useMCPTools()

  function toolName(toolId: string): string {
    return tools.find((t) => t.id === toolId)?.displayName ?? toolId
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5">
          <span className="text-[color:var(--color-creator)]">⚡</span>
          Connections
        </h1>
        <p className="text-[13px] text-white/45 mt-1">
          Connect tools and services to FlowMap. Run actions from chat, research canvases, and Telegram.
        </p>
      </div>

      <ConnectionsSubNav />

      <div className="mb-4">
        <p className="text-[13px] text-white/45">
          {records.length} action{records.length !== 1 ? 's' : ''} recorded.
        </p>
      </div>
      <ExecutionRecordList records={records} toolName={toolName} />
    </div>
  )
}
