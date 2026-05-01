import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Unplug, Plug } from 'lucide-react'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { useMCPExecutions } from '../hooks/useMCPExecutions.js'
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge.js'
import { ToolCatalogList } from '../components/ToolCatalogList.js'
import { ExecutionRecordList } from '../components/ExecutionRecordList.js'

export default function MCPIntegrationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { integrations, connect, disconnect } = useMCPIntegrations()
  const integration = integrations.find((i) => i.id === id)
  const { tools } = useMCPTools(id)
  const { records } = useMCPExecutions(id)

  const [token, setToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  useEffect(() => {
    setToken(integration?.config?.['token'] ?? '')
    setChatId(integration?.config?.['chatId'] ?? '')
  }, [integration?.config?.['token'], integration?.config?.['chatId']])

  if (!integration) {
    return (
      <div className="p-6 text-white/40 text-sm">Integration not found.</div>
    )
  }

  const integrationId = integration.id
  const isTelegram = integration.type === 'telegram'
  const isConnected = integration.status === 'connected'

  async function handleConnect() {
    setConnecting(true)
    setConnectError(null)
    try {
      const config = isTelegram ? { token, chatId } : undefined
      await connect(integrationId, config)
    } catch (e) {
      setConnectError((e as Error).message)
    } finally {
      setConnecting(false)
    }
  }

  function handleDisconnect() {
    disconnect(integrationId)
    setToken('')
    setChatId('')
  }

  function toolName(toolId: string): string {
    return tools.find((t) => t.id === toolId)?.displayName ?? toolId
  }

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => navigate('/connections')}
        className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Connections
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{integration.name}</h1>
          {integration.description ? (
            <p className="text-[13px] text-white/45 mt-1">{integration.description}</p>
          ) : null}
        </div>
        <IntegrationStatusBadge status={integration.status} />
      </div>

      {/* Telegram config form */}
      {isTelegram && !isConnected ? (
        <div className="glass-panel p-4 rounded-xl mb-6 space-y-3">
          <p className="text-[12px] text-white/50">
            Enter your Telegram bot token and the chat ID to send to.
          </p>
          <div className="space-y-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bot token (e.g. 123456789:ABC-…)"
              className="glass-input w-full text-[13px]"
            />
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Chat ID (e.g. -100123456789)"
              className="glass-input w-full text-[13px]"
            />
          </div>
          {connectError ? (
            <p className="text-[11px] text-rose-300">{connectError}</p>
          ) : null}
        </div>
      ) : null}

      {/* Connect / Disconnect */}
      <div className="flex items-center gap-2 mb-8">
        {isConnected ? (
          <button onClick={handleDisconnect} className="btn flex items-center gap-2 text-rose-300 hover:text-rose-200">
            <Unplug size={14} /> Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting || (isTelegram && (!token || !chatId))}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-40"
          >
            {connecting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Plug size={14} />
            )}
            Connect
          </button>
        )}
      </div>

      {/* Tools */}
      {tools.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
            Tools ({tools.length})
          </h2>
          <ToolCatalogList tools={tools} integrationName={() => integration.name} />
        </section>
      ) : null}

      {/* Recent executions */}
      {records.length > 0 ? (
        <section>
          <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
            Recent Activity
          </h2>
          <ExecutionRecordList records={records.slice(0, 10)} toolName={toolName} />
        </section>
      ) : null}
    </div>
  )
}
