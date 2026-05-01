import { LayoutGrid, List, Activity, MessageCircle } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { IntegrationCard } from '../components/IntegrationCard.js'

const SUB_NAV = [
  { to: '/connections', label: 'Integrations', Icon: LayoutGrid, end: true },
  { to: '/connections/tools', label: 'Tools', Icon: List },
  { to: '/connections/log', label: 'Log', Icon: Activity },
  { to: '/connections/telegram', label: 'Telegram', Icon: MessageCircle },
]

function SubNav() {
  return (
    <div className="flex items-center gap-1 mb-6 border-b border-white/[0.07] pb-4">
      {SUB_NAV.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              isActive
                ? 'text-white bg-white/[0.08]'
                : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
            }`
          }
        >
          <Icon size={14} />
          {label}
        </NavLink>
      ))}
    </div>
  )
}

export default function MCPIntegrationsPage() {
  const { integrations, connect, disconnect } = useMCPIntegrations()
  const { tools } = useMCPTools()

  const connected = integrations.filter((i) => i.status === 'connected')
  const available = integrations.filter((i) => i.status !== 'connected')

  function toolCountFor(integrationId: string): number {
    return tools.filter((t) => t.integrationId === integrationId).length
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5">
          <span className="text-[color:var(--color-topic)]">⚡</span>
          Connections
        </h1>
        <p className="text-[13px] text-white/45 mt-1">
          Connect tools and services to FlowMap. Run actions from chat, research canvases, and Telegram.
        </p>
      </div>

      <SubNav />

      {connected.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
            Connected ({connected.length})
          </h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {connected.map((i) => (
              <IntegrationCard key={i.id} integration={i} toolCount={toolCountFor(i.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
          Available ({available.length})
        </h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {available.map((i) => (
            <IntegrationCard key={i.id} integration={i} toolCount={toolCountFor(i.id)} />
          ))}
        </div>
      </section>
    </div>
  )
}
