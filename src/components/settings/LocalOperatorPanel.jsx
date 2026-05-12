import { useEffect, useState } from 'react'
import { Cpu, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { localProvider } from '../../mcp/providers/localProvider.js'

// Status indicator for the local operator daemon. Mounted in the gear-menu
// alongside the other connection toggles (Ollama, SearXNG, Voice).
export default function LocalOperatorPanel() {
  const [status, setStatus] = useState('checking')
  const [info, setInfo] = useState(null)

  async function refresh() {
    setStatus('checking')
    try {
      const r = await fetch('/api/daemon/info')
      if (!r.ok) { setStatus('disconnected'); setInfo(null); return }
      const cfg = await r.json()
      setInfo(cfg)
      const result = await localProvider.testConnection({ id: 'local' })
      setStatus(result.success ? 'connected' : 'disconnected')
    } catch {
      setStatus('disconnected'); setInfo(null)
    }
  }

  useEffect(() => { refresh() }, [])

  const badge =
    status === 'connected' ? { className: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10', text: 'on' } :
    status === 'disconnected' ? { className: 'text-amber-300 border-amber-400/40 bg-amber-500/10', text: 'off' } :
    { className: 'text-[color:var(--color-text-tertiary)] border-white/15 bg-white/[0.04]', text: '…' }

  return (
    <button
      onClick={refresh}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/90 hover:bg-white/[0.06] transition-colors"
      title={
        status === 'connected'
          ? `Local operator daemon connected on port ${info?.port}`
          : status === 'disconnected'
            ? 'Daemon not running. Start it with: npm run daemon'
            : 'Checking daemon status…'
      }
    >
      <Cpu size={14} className="text-[color:var(--color-text-tertiary)]" />
      <span className="flex-1 text-left">
        Local operator
        {status === 'connected' && info?.port ? (
          <span className="text-white/40 text-[11px] ml-1.5">:{info.port}</span>
        ) : null}
      </span>
      {status === 'checking' ? (
        <RefreshCw size={11} className="text-white/40 animate-spin" />
      ) : status === 'connected' ? (
        <CheckCircle2 size={11} className="text-emerald-300/80" />
      ) : (
        <AlertCircle size={11} className="text-amber-300/80" />
      )}
      <span className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded border ${badge.className}`}>
        {badge.text}
      </span>
    </button>
  )
}
