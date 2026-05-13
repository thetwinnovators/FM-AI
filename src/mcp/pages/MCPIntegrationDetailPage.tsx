import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Unplug, Plug, ExternalLink, Crosshair,
  Radio, CheckCircle, XCircle,
} from 'lucide-react'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { getProvider, discoverTools } from '../services/mcpToolRegistry.js'
import { detectTelegramChatId } from '../services/telegramService.js'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { useMCPExecutions } from '../hooks/useMCPExecutions.js'
import type { MCPToolDefinition } from '../types.js'
import { useTelegramCommands } from '../hooks/useTelegramCommands.js'
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge.js'
import { ToolCatalogList } from '../components/ToolCatalogList.js'
import { ExecutionRecordList } from '../components/ExecutionRecordList.js'
import DockerMCPPanel from '../components/DockerMCPPanel.jsx'

const COMMAND_EXAMPLES = ['/summary', '/topics', '/scan', '/help']

// Isolated component so the hook only mounts on the Telegram detail page
function TelegramCommandCenter() {
  const { testConnection, polling } = useTelegramCommands()
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection()
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div className="mb-8">
      {/* Polling indicator + test connection */}
      <div className="p-4 rounded-xl mb-4 flex items-center justify-between gap-4 bg-teal-500/15 border border-teal-500/25">
        <div className={`flex items-center gap-2 text-[12px] ${polling ? 'text-emerald-400' : 'text-white/35'}`}>
          <Radio size={13} className={polling ? 'animate-pulse' : ''} />
          {polling
            ? 'Listening — send a message to your bot in Telegram'
            : 'Not listening (keep this page open to activate)'}
        </div>
        <button
          onClick={handleTest}
          disabled={testing}
          className="btn text-[12px] shrink-0 disabled:opacity-40"
        >
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
      </div>

      {testResult !== null ? (
        <div className={`flex items-center gap-2 text-[12px] mb-4 ${testResult.success ? 'text-emerald-300' : 'text-rose-300'}`}>
          {testResult.success ? <CheckCircle size={13} /> : <XCircle size={13} />}
          {testResult.success
            ? 'Connection successful — check Telegram for the confirmation message.'
            : testResult.error ?? 'Connection failed.'}
        </div>
      ) : null}

      {/* Command reference */}
      <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-1">Commands your bot understands</h2>
      <p className="text-[11px] text-white/30 mb-3">Send these from Telegram and FlowMap AI will reply automatically.</p>
      <div className="grid grid-cols-2 gap-1.5">
        {COMMAND_EXAMPLES.map((cmd) => (
          <div
            key={cmd}
            className="px-3 py-2 rounded-lg bg-white/[0.03] text-[12px] text-white/60 border border-white/[0.05] font-mono"
          >
            {cmd}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MCPIntegrationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { integrations, connect, disconnect } = useMCPIntegrations()
  const integration = integrations.find((i) => i.id === id)
  const { tools: cachedTools } = useMCPTools(id)
  const [tools, setTools] = useState<MCPToolDefinition[]>(cachedTools)
  const { records } = useMCPExecutions(id)

  const [token, setToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [detectMsg, setDetectMsg] = useState<string | null>(null)

  useEffect(() => {
    setToken(integration?.config?.['token'] ?? '')
    setChatId(integration?.config?.['chatId'] ?? '')
  }, [integration?.config?.['token'], integration?.config?.['chatId']])

  // Auto-discover tools whenever this integration is connected
  useEffect(() => {
    if (!integration || integration.status !== 'connected') return
    discoverTools(integration).then((discovered) => {
      if (discovered.length > 0) setTools(discovered)
    }).catch(() => {/* provider not ready — cached tools stay */})
  }, [integration?.id, integration?.status])

  if (!integration) {
    return (
      <div className="p-6 text-white/40 text-sm">Integration not found.</div>
    )
  }

  const integrationId = integration.id
  const isTelegram = integration.type === 'telegram'
  const isDockerMCP = integration.type === 'docker-mcp'
  const isConnected = integration.status === 'connected'
  const hasProvider = !!getProvider(integration.type)

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

  async function handleDetectChatId() {
    if (!token.trim()) {
      setDetectMsg('Enter your bot token first.')
      return
    }
    setDetecting(true)
    setDetectMsg(null)
    const result = await detectTelegramChatId(token.trim())
    setDetecting(false)
    if (result.chatId) {
      setChatId(result.chatId)
      setDetectMsg(`✓ Chat ID detected: ${result.chatId}`)
    } else {
      setDetectMsg(result.error ?? 'Could not detect chat ID.')
    }
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

      {/* Telegram setup instructions + config form (disconnected only) */}
      {isTelegram && !isConnected ? (
        <>
          <div className="mb-5 space-y-2.5">
            <p className="text-[11px] uppercase tracking-widest font-bold text-white/30">Setup instructions</p>
            {[
              {
                n: 1,
                title: 'Create a bot via BotFather',
                body: (
                  <>
                    Open Telegram and search for{' '}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[color:var(--color-topic)] hover:underline inline-flex items-center gap-0.5"
                    >
                      @BotFather <ExternalLink size={10} />
                    </a>
                    . Send <code className="bg-white/8 px-1 py-0.5 rounded text-[11px]">/newbot</code>, follow the prompts,
                    then copy the <strong className="text-white/70">bot token</strong> (format:{' '}
                    <span className="font-mono text-white/50 text-[11px]">123456789:ABC-…</span>).
                  </>
                ),
              },
              {
                n: 2,
                title: 'Message your bot, then auto-detect your Chat ID',
                body: (
                  <>
                    Open Telegram, find your bot, and send it any message (e.g.{' '}
                    <code className="bg-white/8 px-1 py-0.5 rounded text-[11px]">/start</code>). Then paste your
                    bot token below and click <strong className="text-white/70">Detect Chat ID</strong> — FlowMap
                    will fetch it automatically.
                  </>
                ),
              },
              {
                n: 3,
                title: 'Paste both values below and click Connect',
                body: 'FlowMap stores these locally. Your bot token never leaves your device.',
              },
            ].map(({ n, title, body }) => (
              <div key={n} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[color:var(--color-topic)]/15 border border-[color:var(--color-topic)]/25 text-[color:var(--color-topic)] text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {n}
                </span>
                <div>
                  <p className="text-[12px] font-medium text-white/75">{title}</p>
                  <p className="text-[11px] text-white/45 mt-0.5 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="glass-panel p-4 rounded-xl mb-6 space-y-3">
            <p className="text-[12px] text-white/50 font-medium">Your credentials</p>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] uppercase tracking-wide text-white/30 font-medium block mb-1">Bot token</label>
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="123456789:ABC-DefGhIJKlmNoPQRsTUVwxyZ"
                  className="glass-input w-full text-[13px] font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wide text-white/30 font-medium block mb-1">Chat ID</label>
                <div className="flex gap-2">
                  <input
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="-100123456789"
                    className="glass-input flex-1 text-[13px] font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleDetectChatId}
                    disabled={detecting || !token.trim()}
                    className="btn text-[11px] flex items-center gap-1.5 shrink-0 disabled:opacity-40"
                    title="Auto-detect chat ID from recent messages"
                  >
                    {detecting
                      ? <RefreshCw size={11} className="animate-spin" />
                      : <Crosshair size={11} />}
                    {detecting ? 'Detecting…' : 'Detect Chat ID'}
                  </button>
                </div>
                {detectMsg ? (
                  <p className={`text-[11px] mt-1.5 leading-relaxed ${detectMsg.startsWith('✓') ? 'text-emerald-400' : 'text-amber-400/90'}`}>
                    {detectMsg}
                  </p>
                ) : null}
              </div>
            </div>
            {connectError ? (
              <p className="text-[11px] text-rose-300 bg-rose-500/10 rounded-lg px-3 py-2 border border-rose-500/20">{connectError}</p>
            ) : null}
          </div>
        </>
      ) : null}

      {/* Connect / Disconnect */}
      {hasProvider ? (
        <div className="flex items-center gap-2 mb-8">
          {isConnected ? (
            <button onClick={handleDisconnect} className="btn flex items-center gap-2 text-rose-300 hover:text-rose-200">
              <Unplug size={14} /> Disconnect
            </button>
          ) : (
            <>
              <button
                onClick={handleConnect}
                disabled={connecting || (isTelegram && (!token || !chatId))}
                className="btn btn-primary flex items-center gap-2 disabled:opacity-40"
              >
                {connecting ? <RefreshCw size={14} className="animate-spin" /> : <Plug size={14} />}
                Connect
              </button>
              {connectError ? (
                <p className="text-[11px] text-rose-300">{connectError}</p>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="mb-8 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.07] text-[12px] text-white/40 flex items-center gap-2">
          <Plug size={13} className="shrink-0 opacity-50" />
          OAuth connection coming in a future update. Tool definitions are ready.
        </div>
      )}

      {/* Telegram command center — only rendered when telegram + connected */}
      {isTelegram && isConnected ? <TelegramCommandCenter /> : null}

      {/* Docker MCP server management */}
      {isDockerMCP ? (
        <div className="mb-8">
          <DockerMCPPanel />
        </div>
      ) : null}

      {/* What Flow AI can do */}
      <section className="mb-8">
        <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-1">
          What Flow AI can do
        </h2>
        <p className="text-[11px] text-white/30 mb-3">
          These are the actions available to AI agents connected to your FlowMap.
        </p>
        <ToolCatalogList tools={tools} integrationName={() => integration.name} />
      </section>

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
