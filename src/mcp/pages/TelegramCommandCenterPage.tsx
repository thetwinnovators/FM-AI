import { useState } from 'react'
import { Send, CheckCircle, XCircle } from 'lucide-react'
import { useTelegramCommands } from '../hooks/useTelegramCommands.js'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { TelegramMessageList } from '../components/TelegramMessageList.js'
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge.js'

const COMMAND_EXAMPLES = [
  'Summarize this URL: https://...',
  'Create a research canvas called AI competitors',
  'Send me 3 caption ideas for this topic',
  "What's on my calendar today?",
  'Create a Google Doc from my last note',
]

export default function TelegramCommandCenterPage() {
  const { messages, sending, sendError, send, testConnection } = useTelegramCommands()
  const { integrations } = useMCPIntegrations()
  const telegramIntegration = integrations.find((i) => i.type === 'telegram')

  const [text, setText] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function handleSend() {
    if (!text.trim()) return
    const ok = await send(text.trim())
    if (ok) setText('')
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection()
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-1">Telegram</h1>
      <p className="text-[13px] text-white/45 mb-6">
        Send messages from FlowMap to Telegram. Inbound commands arrive here when connected.
      </p>

      {/* Status card */}
      <div className="glass-panel p-4 rounded-xl mb-6 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-medium text-white/80">Bot Status</div>
          {telegramIntegration?.config?.['chatId'] ? (
            <div className="text-[11px] text-white/35 mt-0.5">
              Chat: {telegramIntegration.config['chatId']}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {telegramIntegration ? (
            <IntegrationStatusBadge status={telegramIntegration.status} />
          ) : null}
          <button
            onClick={handleTest}
            disabled={testing || telegramIntegration?.status !== 'connected'}
            className="btn text-[12px] disabled:opacity-40"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>
      </div>

      {testResult !== null ? (
        <div
          className={`flex items-center gap-2 text-[12px] mb-4 ${
            testResult.success ? 'text-emerald-300' : 'text-rose-300'
          }`}
        >
          {testResult.success ? (
            <CheckCircle size={13} />
          ) : (
            <XCircle size={13} />
          )}
          {testResult.success
            ? 'Connection successful — check Telegram for the confirmation message.'
            : testResult.error ?? 'Connection failed.'}
        </div>
      ) : null}

      {/* Send message */}
      <div className="mb-8">
        <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
          Send Message
        </h2>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message to send…"
            className="glass-input flex-1 text-[13px]"
          />
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="btn btn-primary flex items-center gap-1.5 disabled:opacity-40"
          >
            <Send size={13} />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {sendError ? (
          <p className="text-[11px] text-rose-300 mt-1.5">{sendError}</p>
        ) : null}
      </div>

      {/* Command examples */}
      <div className="mb-8">
        <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
          Command Examples
        </h2>
        <div className="space-y-1.5">
          {COMMAND_EXAMPLES.map((cmd) => (
            <button
              key={cmd}
              onClick={() => setText(cmd)}
              className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-[12px] text-white/60 hover:text-white/90 transition-colors border border-white/[0.05]"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      {/* Inbound messages */}
      <div>
        <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
          Inbound Commands
          <span className="ml-2 text-white/25 normal-case tracking-normal font-normal">
            (demo — real inbound via webhook in v2)
          </span>
        </h2>
        <TelegramMessageList messages={messages} />
      </div>
    </div>
  )
}
