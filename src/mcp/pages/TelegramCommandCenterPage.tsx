import { useState } from 'react'
import { CheckCircle, XCircle, Radio, AlertCircle } from 'lucide-react'
import { useTelegramCommands } from '../hooks/useTelegramCommands.js'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge.js'
import { ConnectionsSubNav } from '../components/ConnectionsSubNav.js'

const COMMAND_EXAMPLES = [
  '/summary',
  '/topics',
  '/scan',
  '/help',
]

export default function TelegramCommandCenterPage() {
  const { testConnection, polling } = useTelegramCommands()
  const { integrations } = useMCPIntegrations()
  const telegramIntegration = integrations.find((i) => i.type === 'telegram')
  const isConnected = telegramIntegration?.status === 'connected'

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

      <div className="max-w-2xl">
        <h2 className="text-base font-semibold text-white mb-1">Telegram Command Center</h2>
        <p className="text-[13px] text-white/45 mb-6">
          Send commands to FlowMap AI from Telegram. Your bot listens for messages and replies automatically.
        </p>

        {/* Status card */}
        <div className="glass-panel p-4 rounded-xl mb-4 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium text-white/80">Bot Status</div>
            {telegramIntegration?.config?.['chatId'] ? (
              <div className="text-[11px] text-white/35 mt-0.5">
                Chat ID: {telegramIntegration.config['chatId']}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {telegramIntegration ? (
              <IntegrationStatusBadge status={telegramIntegration.status} />
            ) : null}
            <button
              onClick={handleTest}
              disabled={testing || !isConnected}
              className="btn text-[12px] disabled:opacity-40"
            >
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
          </div>
        </div>

        {/* Polling indicator */}
        {isConnected ? (
          <div className={`flex items-center gap-2 text-[11px] mb-5 ${polling ? 'text-emerald-400' : 'text-white/35'}`}>
            <Radio size={11} className={polling ? 'animate-pulse' : ''} />
            {polling
              ? 'Listening for commands — send a message to your bot in Telegram'
              : 'Not listening (open this page to activate)'}
          </div>
        ) : (
          <div className="flex items-start gap-2 text-[11px] text-amber-400/80 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2.5 mb-5">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>Bot not connected. Go to <b>Connections → Telegram</b> to add your bot token and chat ID.</span>
          </div>
        )}

        {testResult !== null ? (
          <div className={`flex items-center gap-2 text-[12px] mb-4 ${testResult.success ? 'text-emerald-300' : 'text-rose-300'}`}>
            {testResult.success ? <CheckCircle size={13} /> : <XCircle size={13} />}
            {testResult.success
              ? 'Connection successful — check Telegram for the confirmation message.'
              : testResult.error ?? 'Connection failed.'}
          </div>
        ) : null}

        {/* Command examples */}
        <div className="mb-8">
          <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-1">Commands your bot understands</h2>
          <p className="text-[11px] text-white/30 mb-3">Send these from Telegram and FlowAI will reply automatically.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {COMMAND_EXAMPLES.map((cmd) => (
              <button
                key={cmd}
                onClick={() => setText(cmd)}
                className="text-left px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-[12px] text-white/60 hover:text-white/90 transition-colors border border-white/[0.05] font-mono"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
