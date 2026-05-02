import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { useMCPExecutions } from '../hooks/useMCPExecutions.js'
import { ExecutionRecordList } from '../components/ExecutionRecordList.js'
import type { MCPToolRiskLevel, ToolPermissionMode } from '../types.js'

const RISK_META: Record<MCPToolRiskLevel, { label: string; colorClass: string }> = {
  read:    { label: 'Read',    colorClass: 'text-sky-300 bg-sky-400/10 border-sky-400/20' },
  write:   { label: 'Write',   colorClass: 'text-teal-300 bg-teal-400/10 border-teal-400/20' },
  publish: { label: 'Publish', colorClass: 'text-amber-300 bg-amber-400/10 border-amber-400/20' },
}

function policyLabel(riskLevel: MCPToolRiskLevel | undefined, permissionMode: ToolPermissionMode): string {
  if (riskLevel === 'read')    return 'Auto-run — no confirmation needed'
  if (riskLevel === 'write')   return 'Auto-run — creates or modifies content'
  if (riskLevel === 'publish') return 'Requires explicit confirmation before execution'
  if (permissionMode === 'auto')              return 'Auto-run'
  if (permissionMode === 'approval_required') return 'Requires confirmation'
  if (permissionMode === 'read_only')         return 'Read-only — auto-run'
  if (permissionMode === 'restricted')        return 'Restricted — cannot run'
  return '—'
}

export default function MCPToolDetailPage() {
  const { toolId } = useParams<{ toolId: string }>()
  const navigate = useNavigate()
  const { tools } = useMCPTools()
  const { integrations } = useMCPIntegrations()
  const { records } = useMCPExecutions()

  const tool = tools.find((t) => t.id === toolId)
  if (!tool) {
    return <div className="p-6 text-white/40 text-sm">Tool not found.</div>
  }

  const integration = integrations.find((i) => i.id === tool.integrationId)
  const riskMeta = tool.riskLevel ? RISK_META[tool.riskLevel] : null
  const toolRecords = records.filter((r) => r.toolId === toolId)
  const lastRecord = toolRecords[0] ?? null

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => navigate('/connections/tools')}
        className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Tools
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{tool.displayName}</h1>
          {tool.description ? (
            <p className="text-[13px] text-white/45 mt-1">{tool.description}</p>
          ) : null}
        </div>
        {riskMeta ? (
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${riskMeta.colorClass}`}>
            {riskMeta.label}
          </span>
        ) : null}
      </div>

      {/* Integration */}
      {integration ? (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-wide text-white/30 mb-1.5">Integration</p>
          <Link
            to={`/connections/${integration.id}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
          >
            {integration.name}
            <ChevronRight size={12} className="text-white/30" />
          </Link>
        </div>
      ) : null}

      {/* Execution policy */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-wide text-white/30 mb-1.5">Execution policy</p>
        <p className="text-[13px] text-white/60">{policyLabel(tool.riskLevel, tool.permissionMode)}</p>
      </div>

      {/* Input parameters */}
      {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 ? (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-wide text-white/30 mb-2">Parameters</p>
          <div className="space-y-1.5">
            {Object.entries(tool.inputSchema).map(([key, schema]) => (
              <div
                key={key}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]"
              >
                <code className="text-[12px] font-mono text-sky-300/80 shrink-0 mt-px">{key}</code>
                <p className="text-[11px] text-white/45 leading-relaxed">
                  {(schema as { description?: string }).description ?? ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Tags */}
      {tool.tags && tool.tags.length > 0 ? (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-wide text-white/30 mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tool.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-white/40"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Last result */}
      {lastRecord ? (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-wide text-white/30 mb-2">Last result</p>
          <div
            className={`px-3 py-2.5 rounded-lg text-[12px] border ${
              lastRecord.status === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            {lastRecord.status} · {lastRecord.outputSummary ?? lastRecord.errorMessage ?? 'No output'}
          </div>
        </div>
      ) : null}

      {/* Recent executions */}
      {toolRecords.length > 0 ? (
        <section>
          <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
            Recent Activity
          </h2>
          <ExecutionRecordList
            records={toolRecords.slice(0, 5)}
            toolName={() => tool.displayName}
          />
        </section>
      ) : null}
    </div>
  )
}
