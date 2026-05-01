import type { MCPExecutionRecord, ExecutionStatus } from '../types.js'

const STATUS_CONFIG: Record<ExecutionStatus, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'text-amber-300' },
  running: { label: 'Running', color: 'text-amber-300' },
  success: { label: 'Success', color: 'text-emerald-300' },
  failed: { label: 'Failed', color: 'text-rose-300' },
  cancelled: { label: 'Cancelled', color: 'text-white/40' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'text-purple-300' },
}

interface Props {
  records: MCPExecutionRecord[]
  toolName?: (toolId: string) => string
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function ExecutionRecordList({ records, toolName }: Props) {
  if (records.length === 0) {
    return (
      <p className="text-[12px] text-white/35 py-8 text-center">
        No executions yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {records.map((rec) => {
        const s = STATUS_CONFIG[rec.status]
        return (
          <div
            key={rec.id}
            className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[11px] font-semibold ${s.color}`}>{s.label}</span>
                <span className="text-[12px] text-white/80 truncate">
                  {toolName ? toolName(rec.toolId) : rec.toolId}
                </span>
                <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded bg-white/[0.04]">
                  {rec.sourceSurface}
                </span>
              </div>
              <span className="text-[11px] text-white/30 flex-shrink-0">
                {relativeTime(rec.requestedAt)}
              </span>
            </div>
            {rec.errorMessage ? (
              <p className="text-[11px] text-rose-300/80 mt-1 truncate">{rec.errorMessage}</p>
            ) : null}
            {rec.outputSummary && !rec.errorMessage ? (
              <p className="text-[11px] text-white/35 mt-1 truncate">{rec.outputSummary}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
