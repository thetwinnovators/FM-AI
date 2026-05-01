import type { MCPToolDefinition, ToolPermissionMode } from '../types.js'

const MODE_LABELS: Record<ToolPermissionMode, { label: string; color: string }> = {
  auto: { label: 'Auto', color: 'text-teal-300 bg-teal-400/10' },
  approval_required: { label: 'Approval', color: 'text-amber-300 bg-amber-400/10' },
  read_only: { label: 'Read-only', color: 'text-sky-300 bg-sky-400/10' },
  restricted: { label: 'Restricted', color: 'text-rose-300 bg-rose-400/10' },
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

  return (
    <div className="space-y-2">
      {tools.map((tool) => {
        const mode = MODE_LABELS[tool.permissionMode]
        return (
          <div
            key={tool.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-white/90">
                  {tool.displayName}
                </span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${mode.color}`}
                >
                  {mode.label}
                </span>
              </div>
              {tool.description ? (
                <p className="text-[11px] text-white/45 mt-0.5 truncate">{tool.description}</p>
              ) : null}
            </div>
            {integrationName ? (
              <span className="text-[10px] text-white/30 flex-shrink-0">
                {integrationName(tool.integrationId)}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
