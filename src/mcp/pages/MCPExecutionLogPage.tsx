import { useMCPExecutions } from '../hooks/useMCPExecutions.js'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { ExecutionRecordList } from '../components/ExecutionRecordList.js'

export default function MCPExecutionLogPage() {
  const { records } = useMCPExecutions()
  const { tools } = useMCPTools()

  function toolName(toolId: string): string {
    return tools.find((t) => t.id === toolId)?.displayName ?? toolId
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Execution Log</h1>
        <p className="text-[13px] text-white/45 mt-1">
          {records.length} action{records.length !== 1 ? 's' : ''} recorded.
        </p>
      </div>
      <ExecutionRecordList records={records} toolName={toolName} />
    </div>
  )
}
