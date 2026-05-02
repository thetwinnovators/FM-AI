import { Plug } from 'lucide-react'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { IntegrationCard } from '../components/IntegrationCard.js'
import { ConnectionsSubNav } from '../components/ConnectionsSubNav.js'


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
          <Plug size={20} className="text-[color:var(--color-creator)]" />
          Connections
        </h1>
        <p className="text-[13px] text-white/45 mt-1">
          Connect tools and services to Flow AI. Run actions from chat, research canvases, and Telegram.
        </p>
      </div>

      <ConnectionsSubNav />

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
            <IntegrationCard
              key={i.id}
              integration={i}
              toolCount={toolCountFor(i.id)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
