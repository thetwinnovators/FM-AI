import { useState } from 'react'
import { Search } from 'lucide-react'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { ToolCatalogList } from '../components/ToolCatalogList.js'
import { ConnectionsSubNav } from '../components/ConnectionsSubNav.js'

export default function MCPToolCatalogPage() {
  const { tools } = useMCPTools()
  const { integrations } = useMCPIntegrations()
  const [query, setQuery] = useState('')
  const [filterIntegration, setFilterIntegration] = useState('')

  function integrationName(id: string): string {
    return integrations.find((i) => i.id === id)?.name ?? id
  }

  const filtered = tools.filter((t) => {
    const matchesQuery =
      !query ||
      t.displayName.toLowerCase().includes(query.toLowerCase()) ||
      t.description?.toLowerCase().includes(query.toLowerCase()) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
    const matchesIntegration = !filterIntegration || t.integrationId === filterIntegration
    return matchesQuery && matchesIntegration
  })

  const connectedIntegrations = integrations.filter((i) => i.status === 'connected')

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
          {tools.length} tool{tools.length !== 1 ? 's' : ''} available across connected integrations.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="glass-input w-full pl-8 text-[13px]"
          />
        </div>
        {connectedIntegrations.length > 0 ? (
          <select
            value={filterIntegration}
            onChange={(e) => setFilterIntegration(e.target.value)}
            className="glass-input text-[13px]"
          >
            <option value="">All integrations</option>
            {connectedIntegrations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <ToolCatalogList tools={filtered} integrationName={integrationName} />
    </div>
  )
}
