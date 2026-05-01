import { Plug } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MCPIntegration } from '../types.js'
import { IntegrationStatusBadge } from './IntegrationStatusBadge.js'

const TYPE_ICONS: Record<string, string> = {
  telegram: '✈️',
  'google-workspace': '📄',
  figma: '🎨',
  canva: '🖼️',
  'generic-mcp': '🔌',
}

interface Props {
  integration: MCPIntegration
  toolCount?: number
}

export function IntegrationCard({ integration, toolCount }: Props) {
  return (
    <Link
      to={`/connections/${integration.id}`}
      className="block glass-panel p-4 rounded-xl hover:brightness-110 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-base">
            {TYPE_ICONS[integration.type] ?? <Plug size={16} className="text-white/50" />}
          </div>
          <div>
            <div className="text-sm font-medium text-white/90">{integration.name}</div>
            {integration.description ? (
              <div className="text-[11px] text-white/45 mt-0.5 line-clamp-1">
                {integration.description}
              </div>
            ) : null}
          </div>
        </div>
        <IntegrationStatusBadge status={integration.status} />
      </div>
      {toolCount !== undefined && toolCount > 0 ? (
        <div className="mt-3 text-[11px] text-white/35">
          {toolCount} tool{toolCount !== 1 ? 's' : ''} available
        </div>
      ) : null}
    </Link>
  )
}
