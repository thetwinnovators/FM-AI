import { Link } from 'react-router-dom'
import type { MCPToolDefinition, ToolPermissionMode, MCPToolRiskLevel } from '../types.js'

const RISK_COLORS: Record<MCPToolRiskLevel, string> = {
  read:    'text-sky-300 bg-sky-400/10',
  write:   'text-teal-300 bg-teal-400/10',
  publish: 'text-amber-300 bg-amber-400/10',
}

const MODE_LABELS: Record<ToolPermissionMode, { label: string; color: string }> = {
  auto:             { label: 'Auto',       color: 'text-teal-300 bg-teal-400/10' },
  approval_required:{ label: 'Approval',   color: 'text-amber-300 bg-amber-400/10' },
  read_only:        { label: 'Read-only',  color: 'text-sky-300 bg-sky-400/10' },
  restricted:       { label: 'Restricted', color: 'text-rose-300 bg-rose-400/10' },
}

interface Props {
  tools: MCPToolDefinition[]
  integrationName?: (id: string) => string
}

export function ToolCatalogList({ tools, integrationName }: Props) {
  if (tools.length === 0) {
    return (
      <p className="text-[12px] text-white/35 py-8 text-center">
        No tools available. Connect an integration to discover tools.
      </p>
    )
  }

  // Group tools by integration, preserving insertion order
  const groups: [string, MCPToolDefinition[]][] = []
  const seen = new Map<string, MCPToolDefinition[]>()
  for (const tool of tools) {
    if (!seen.has(tool.integrationId)) {
      const list: MCPToolDefinition[] = []
      seen.set(tool.integrationId, list)
      groups.push([tool.integrationId, list])
    }
    seen.get(tool.integrationId)!.push(tool)
  }

  return (
    <div className="grid grid-cols-3 gap-4 items-start">
      {groups.map(([integId, groupTools]) => {
        const label = integrationName ? integrationName(integId) : integId

        return (
          <div
            key={integId}
            className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4"
          >
            {/* Group header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] uppercase tracking-wide font-semibold text-white/50">
                {label}
              </span>
              <span className="text-[10px] text-white/25">{groupTools.length}</span>
            </div>

            {/* Tool rows */}
            <div className="space-y-1.5">
              {groupTools.map((tool) => {
                const badgeClass = tool.riskLevel
                  ? RISK_COLORS[tool.riskLevel]
                  : MODE_LABELS[tool.permissionMode].color
                const badgeLabel = tool.riskLevel
                  ? tool.riskLevel.charAt(0).toUpperCase() + tool.riskLevel.slice(1)
                  : MODE_LABELS[tool.permissionMode].label

                return (
                  <Link
                    key={tool.id}
                    to={`/connections/tools/${tool.id}`}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.07] hover:border-white/[0.10] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-medium text-white/85 truncate">
                          {tool.displayName}
                        </span>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${badgeClass}`}>
                          {badgeLabel}
                        </span>
                      </div>
                      {tool.description ? (
                        <p className="text-[10px] text-white/40 mt-0.5 truncate">
                          {tool.description}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
