import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Clock } from 'lucide-react'
import { streamChat } from '../lib/llm/ollama.js'
import { SignalDetailModal } from './SignalDetailModal.jsx'

const SETUP_META = {
  momentum_breakout: { label: 'MOMENTUM',     color: 'bg-blue-500/15 text-blue-300 border-blue-500/25'    },
  vwap_reclaim:      { label: 'VWAP RECLAIM', color: 'bg-violet-500/15 text-violet-300 border-violet-500/25' },
  orb:               { label: 'ORB',          color: 'bg-orange-500/15 text-orange-300 border-orange-500/25' },
}

const STATUS_COLOR = {
  active:       'text-emerald-400',
  expired:      'text-white/25',
  risk_blocked: 'text-red-400',
}

function useRecommendation(signal) {
  const [rec, setRec] = useState('')

  useEffect(() => {
    if (signal.status !== 'active') return
    const ctrl = new AbortController()
    const setup = (signal.setup_type ?? '').replace(/_/g, ' ').toUpperCase()
    const messages = [
      { role: 'system', content: 'You are a concise day trading assistant. Give a single direct actionable recommendation in 1-2 sentences. No disclaimers. No "I" statements.' },
      { role: 'user', content: `Signal: ${signal.symbol} ${setup} ${signal.direction?.toUpperCase()} — entry $${signal.entry_zone_low?.toFixed(2)}–$${signal.entry_zone_high?.toFixed(2)}, stop $${signal.stop_level?.toFixed(2)}, target $${signal.target_level?.toFixed(2)}, R/R ${signal.risk_reward}:1. ${signal.rationale}. What should the trader do right now?` },
    ]
    ;(async () => {
      let text = ''
      for await (const token of streamChat(messages, { signal: ctrl.signal, temperature: 0.4, num_ctx: 4096, num_predict: 80 })) {
        text += token
        setRec(text)
      }
    })()
    return () => ctrl.abort()
  }, [signal.id, signal.status]) // eslint-disable-line react-hooks/exhaustive-deps

  return rec
}

export function SignalCard({ signal, inPosition = false }) {
  const meta     = SETUP_META[signal.setup_type] ?? SETUP_META.momentum_breakout
  const isActive = signal.status === 'active'
  const isLong   = signal.direction === 'long'
  const rec      = useRecommendation(signal)
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
    {modalOpen && (
      <SignalDetailModal
        signal={signal}
        recommendation={rec}
        onClose={() => setModalOpen(false)}
      />
    )}
    <article
      onClick={isActive ? () => setModalOpen(true) : undefined}
      className={`rounded-xl border p-4 transition-all duration-150 ${
        isActive
          ? 'bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.08] hover:border-white/[0.15] hover:shadow-[0_4px_24px_rgba(0,0,0,0.45)] cursor-pointer'
          : 'border-white/[0.04] opacity-50'
      }`}
    >
      <div className="flex flex-col gap-2">
        <span className={`self-start text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
          {meta.label}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-white">{signal.symbol}</span>
            {isLong
              ? <TrendingUp  size={13} className="text-emerald-400" />
              : <TrendingDown size={13} className="text-red-400" />
            }
            <span className={`text-[11px] font-medium ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
              {isLong ? 'LONG' : 'SHORT'}
            </span>
            {inPosition ? (
              <span className="ml-auto text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/25 px-1.5 py-0.5 rounded-full">
                IN POSITION
              </span>
            ) : (
              <span className={`ml-auto text-[10px] font-medium ${STATUS_COLOR[signal.status] ?? 'text-white/40'}`}>
                {signal.status.replace('_', ' ').toUpperCase()}
              </span>
            )}
          </div>

          <p className="mt-1.5 text-[12px] text-white/50 leading-relaxed">{signal.rationale}</p>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <div className="text-[12px] text-white/30 mb-0.5">Entry zone</div>
              <div className="text-[14px] text-white/70 font-mono">
                ${signal.entry_zone_low.toFixed(2)}–${signal.entry_zone_high.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[12px] text-white/30 mb-0.5">Stop</div>
              <div className="text-[14px] text-red-400 font-mono">${signal.stop_level.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[12px] text-white/30 mb-0.5">Target</div>
              <div className="text-[14px] text-emerald-400 font-mono">${signal.target_level.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[12px] text-white/30 mb-0.5">R/R</div>
              <div className="text-[14px] text-white/70">{signal.risk_reward}:1</div>
            </div>
          </div>

          {isActive && (
            <button
              onClick={() => setModalOpen(true)}
              className="w-full mt-3 text-left group cursor-pointer"
            >
              <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 flex items-start gap-2 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.45)] group-hover:bg-white/[0.05] group-hover:border-white/[0.12] transition-all">
                {isLong
                  ? <TrendingUp size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  : <TrendingDown size={11} className="text-red-400 mt-0.5 flex-shrink-0" />
                }
                <p className="text-[11px] text-white/55 leading-relaxed group-hover:text-white/75 transition-colors">
                  {rec || <span className="text-white/20 italic">Thinking…</span>}
                </p>
              </div>
            </button>
          )}

          <div className="flex items-center gap-1 mt-3 text-[10px] text-white/20">
            <Clock size={9} />
            <span>{new Date(signal.fired_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </article>
    </>
  )
}
