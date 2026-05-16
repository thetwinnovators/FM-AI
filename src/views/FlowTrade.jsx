import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, WifiOff, AlertTriangle, Bot, BarChart2, Copy, Check, RefreshCw, Terminal } from 'lucide-react'
import { WatchlistPanel } from '../flow-trade/WatchlistPanel.jsx'
import { SignalFeed } from '../flow-trade/SignalFeed.jsx'
import { RiskDashboard } from '../flow-trade/RiskDashboard.jsx'
import { FlowTradeChat } from '../flow-trade/FlowTradeChat.jsx'
import { flowTradeApi } from '../flow-trade/api.js'
import { useFlowTradeSSE } from '../flow-trade/useFlowTradeSSE.js'

function useStatus() {
  const [status, setStatus] = useState(null)

  const check = useCallback(async () => {
    try {
      const s = await flowTradeApi.getStatus()
      setStatus({ online: true, ...s })
    } catch {
      setStatus({ online: false })
    }
  }, [])

  useEffect(() => {
    check()
    const id = setInterval(check, 10_000)
    return () => clearInterval(id)
  }, [check])

  const handleSSE = useCallback((event) => {
    if (event.type === 'status_change') check()
  }, [check])

  useFlowTradeSSE(handleSSE)

  return { status, refresh: check }
}

function CopyableCommand({ cmd }) {
  const [copied, setCopied] = useState(false)
  function doCopy() {
    try { navigator.clipboard.writeText(cmd) } catch {
      const el = document.createElement('textarea')
      el.value = cmd; el.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div
      className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2.5 cursor-text"
      style={{
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(52,211,153,0.18)',
        boxShadow: 'inset 0 1px 0 rgba(52,211,153,0.06)',
      }}
    >
      <Terminal size={11} className="text-emerald-500/60 flex-shrink-0" />
      <code className="flex-1 text-[12px] font-mono text-emerald-300/80 select-all tracking-wide">{cmd}</code>
      <button
        onClick={doCopy}
        className="flex-shrink-0 p-1 rounded text-white/25 hover:text-emerald-400 transition-colors"
        title="Copy command"
      >
        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      </button>
    </div>
  )
}

function CheckAgainButton({ onCheck }) {
  const [checking, setChecking] = useState(false)
  async function handle() {
    setChecking(true)
    await onCheck()
    setChecking(false)
  }
  return (
    <button
      onClick={handle}
      disabled={checking}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
      style={{
        background: checking
          ? 'rgba(99,102,241,0.12)'
          : 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.14) 100%)',
        border: '1px solid rgba(139,92,246,0.30)',
        color: checking ? 'rgba(167,139,250,0.7)' : 'rgba(196,181,253,0.9)',
        boxShadow: checking ? 'none' : '0 0 12px rgba(139,92,246,0.15)',
      }}
    >
      <RefreshCw size={11} className={checking ? 'animate-spin' : ''} />
      {checking ? 'Checking…' : 'Check connection'}
    </button>
  )
}

function ReconnectButton({ onReconnect, label = 'Reconnect feed' }) {
  const [state, setState] = useState('idle') // 'idle' | 'connecting' | 'error'
  async function handle() {
    setState('connecting')
    try {
      await onReconnect()
      setState('idle')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }
  const isError      = state === 'error'
  const isConnecting = state === 'connecting'
  return (
    <button
      onClick={handle}
      disabled={isConnecting}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50"
      style={{
        background: isError
          ? 'rgba(239,68,68,0.12)'
          : isConnecting
          ? 'rgba(52,211,153,0.08)'
          : 'linear-gradient(135deg, rgba(52,211,153,0.16) 0%, rgba(16,185,129,0.12) 100%)',
        border: `1px solid ${isError ? 'rgba(239,68,68,0.30)' : 'rgba(52,211,153,0.28)'}`,
        color: isError
          ? 'rgba(252,165,165,0.9)'
          : isConnecting
          ? 'rgba(110,231,183,0.6)'
          : 'rgba(110,231,183,0.9)',
        boxShadow: !isError && !isConnecting ? '0 0 12px rgba(52,211,153,0.12)' : 'none',
      }}
    >
      <RefreshCw size={11} className={isConnecting ? 'animate-spin' : ''} />
      {isConnecting ? 'Connecting…' : isError ? 'Failed — try again' : label}
    </button>
  )
}

function OfflineShell({ message, icon: Icon, children }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center p-12">
      <div
        className="rounded-full p-4"
        style={{
          background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 60%)',
          border: '1px solid rgba(239,68,68,0.18)',
          boxShadow: '0 0 24px rgba(239,68,68,0.08)',
        }}
      >
        <Icon size={26} className="text-red-400/60" />
      </div>
      <div>
        <div className="text-[15px] font-semibold text-white/70 mb-1">{message}</div>
        {children}
      </div>
    </div>
  )
}

export default function FlowTrade() {
  const { status, refresh } = useStatus()
  const [isBlocked,   setIsBlocked]   = useState(false)
  const [rightTab,    setRightTab]    = useState('risk')
  const [refreshTick, setRefreshTick] = useState(0)

  const handleRefresh = useCallback(() => {
    window.location.reload()
  }, [])

  const handleReconnect = useCallback(async () => {
    await flowTradeApi.reconnect()
    await refresh()
  }, [refresh])

  useEffect(() => {
    if (!status?.online) return
    flowTradeApi.getDailyRisk()
      .then((r) => setIsBlocked(r?.blocked === 1))
      .catch(() => {})
  }, [status?.online])

  const handleSSE = useCallback((event) => {
    if (event.type === 'risk_blocked')   setIsBlocked(true)
    if (event.type === 'risk_unblocked') setIsBlocked(false)
    if (event.type === 'positions_reset') setIsBlocked(false)
  }, [])

  useFlowTradeSSE(handleSSE)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <TrendingUp size={18} className="text-emerald-400" />
        <div>
          <div className="text-[15px] font-semibold text-white/85 leading-none">Flow Trade</div>
          <div className="text-[11px] text-white/35 mt-0.5">paper day-trading workspace</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {status && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  !status.online
                    ? 'bg-white/20'
                    : status.feedConnected
                    ? 'bg-emerald-400'
                    : 'bg-amber-400'
                }`} />
                <span className={
                  !status.online
                    ? 'text-white/30'
                    : status.feedConnected
                    ? 'text-emerald-400/80'
                    : 'text-amber-400/80'
                }>
                  {!status.online
                    ? 'daemon offline'
                    : status.feedConnected
                    ? 'feed connected'
                    : 'feed disconnected'}
                </span>
              </div>
              {status.online && !status.feedConnected && !status.setupRequired && (
                <ReconnectButton onReconnect={handleReconnect} />
              )}
            </div>
          )}
          <button
            onClick={handleRefresh}
            title="Refresh page"
            className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Body */}
      {status === null ? (
        <div className="flex items-center justify-center flex-1">
          <div className="text-[12px] text-white/25">Connecting…</div>
        </div>
      ) : !status.online ? (
        <OfflineShell message="Flow Trade daemon is offline" icon={WifiOff}>
          <div className="text-[12px] text-white/35 mt-1 max-w-[380px] leading-relaxed">
            The daemon isn&apos;t running. Follow these steps to start it:
          </div>
          <div className="mt-5 text-left max-w-[440px] space-y-4">
            {/* Step 1 */}
            <div className="flex gap-3 items-start">
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center mt-0.5"
                style={{ background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)', color: 'rgba(165,180,252,0.9)' }}
              >1</span>
              <div className="flex-1">
                <div className="text-[12px] font-medium text-white/60 mb-0.5">Navigate to the daemon folder</div>
                <CopyableCommand cmd="cd C:\Users\JenoU\Desktop\FlowMap\daemon" />
              </div>
            </div>
            {/* Connector line */}
            <div className="ml-3 w-px h-3 bg-white/[0.06]" />
            {/* Step 2 */}
            <div className="flex gap-3 items-start">
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center mt-0.5"
                style={{ background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.30)', color: 'rgba(110,231,183,0.9)' }}
              >2</span>
              <div className="flex-1">
                <div className="text-[12px] font-medium text-white/60 mb-0.5">Start the daemon</div>
                <CopyableCommand cmd="npm start" />
              </div>
            </div>
            {/* Connector line */}
            <div className="ml-3 w-px h-3 bg-white/[0.06]" />
            {/* Step 3 */}
            <div className="flex gap-3 items-start">
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center mt-0.5"
                style={{ background: 'rgba(139,92,246,0.16)', border: '1px solid rgba(139,92,246,0.32)', color: 'rgba(196,181,253,0.9)' }}
              >3</span>
              <div className="flex-1">
                <div className="text-[12px] font-medium text-white/60 mb-2">Check the connection</div>
                <CheckAgainButton onCheck={refresh} />
              </div>
            </div>
          </div>
        </OfflineShell>
      ) : status.setupRequired ? (
        <OfflineShell message="Alpaca credentials not configured" icon={AlertTriangle}>
          <div className="text-[12px] text-white/30 mt-2 max-w-[360px] leading-relaxed">
            Create <code className="font-mono text-white/50">~/.flowmap/alpaca-paper.json</code> with your Alpaca paper trading API key and secret, then click <strong className="text-white/45">Retry connection</strong>.
          </div>
          <pre className="mt-3 text-left text-[11px] bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 font-mono text-white/40 leading-relaxed">
{`{
  "key": "PK...",
  "secret": "..."
}`}
          </pre>
          <div className="mt-4">
            <ReconnectButton onReconnect={handleReconnect} label="Retry connection" />
          </div>
        </OfflineShell>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Watchlist — narrow left column */}
          <div className="w-[220px] flex-shrink-0 border-r border-white/[0.05] p-3 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.28)' }}>
            <WatchlistPanel />
          </div>

          {/* Signal feed — main content */}
          <div className="flex-1 min-w-0 overflow-y-auto p-4">
            <SignalFeed isBlocked={isBlocked} refreshTick={refreshTick} />
          </div>

          {/* Right panel — tabbed Risk / AI Chat */}
          <div className="w-[260px] flex-shrink-0 border-l border-white/[0.05] flex flex-col" style={{ background: 'rgba(0,0,0,0.28)' }}>
            <div className="flex border-b border-white/[0.05]">
              {[
                { id: 'risk', label: 'Risk', icon: BarChart2 },
                { id: 'chat', label: 'Flow.AI Chat', icon: Bot },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setRightTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors border-b-2 ${
                    rightTab === id
                      ? 'border-violet-500 text-white/80'
                      : 'border-transparent text-white/30 hover:text-white/55'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {rightTab === 'risk' ? (
                <div className="h-full overflow-y-auto">
                  <RiskDashboard refreshTick={refreshTick} />
                </div>
              ) : (
                <FlowTradeChat />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
