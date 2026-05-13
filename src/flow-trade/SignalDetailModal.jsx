import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, TrendingUp, TrendingDown, Sparkles, ArrowRight, Zap, Check, Loader, ArrowUpRight, Scale } from 'lucide-react'
import { streamChat } from '../lib/llm/ollama.js'
import { StockChart } from './StockChart.jsx'
import { flowTradeApi } from './api.js'

const LIQUID_GLASS = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.07) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.13)',
  boxShadow: '0 30px 80px rgba(0,0,0,0.65), 0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.05)',
}

const SETUP_META = {
  momentum_breakout: { label: 'MOMENTUM',     color: 'bg-blue-500/15 text-blue-300 border-blue-500/25'       },
  vwap_reclaim:      { label: 'VWAP RECLAIM', color: 'bg-violet-500/15 text-violet-300 border-violet-500/25' },
  orb:               { label: 'ORB',          color: 'bg-orange-500/15 text-orange-300 border-orange-500/25' },
}

function useNextSteps(signal, enabled) {
  const [steps, setSteps] = useState('')
  useEffect(() => {
    if (!enabled) return
    const ctrl = new AbortController()
    const setup = (signal.setup_type ?? '').replace(/_/g, ' ').toUpperCase()
    const messages = [
      { role: 'system', content: 'You are a day trading coach. Give clear, numbered next steps a trader should take right now. Be specific with prices. Max 5 steps. No disclaimers.' },
      { role: 'user', content: `Signal: ${signal.symbol} ${setup} ${signal.direction?.toUpperCase()}\nEntry zone: $${signal.entry_zone_low?.toFixed(2)}–$${signal.entry_zone_high?.toFixed(2)}\nStop: $${signal.stop_level?.toFixed(2)} | Target: $${signal.target_level?.toFixed(2)} | R/R: ${signal.risk_reward}:1\nRationale: ${signal.rationale}\n\nGive me numbered next steps for what to do right now with this trade.` },
    ]
    ;(async () => {
      let text = ''
      for await (const token of streamChat(messages, { signal: ctrl.signal, temperature: 0.35, num_ctx: 4096, num_predict: 200 })) {
        text += token; setSteps(text)
      }
    })()
    return () => ctrl.abort()
  }, [signal.id, enabled]) // eslint-disable-line react-hooks/exhaustive-deps
  return steps
}

// ── Inline markdown renderer — light-mode colours (used inside StepsRenderer) ─
function renderInline(text) {
  const parts = text.split(/(\*\*.*?\*\*|\$[\d,]+(?:\.\d{1,4})?)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return (
        <strong key={i} style={{ fontWeight: 700, color: '#1a120a' }}>
          {part.slice(2, -2)}
        </strong>
      )
    if (part.startsWith('$'))
      return (
        <span
          key={i}
          style={{
            fontFamily: '"Lora", Georgia, serif',
            fontWeight: 600,
            color: '#8b5a14',
            background: 'rgba(180,110,20,0.09)',
            borderRadius: '3px',
            padding: '0 3px',
          }}
        >
          {part}
        </span>
      )
    return part
  })
}

function StepsRenderer({ text }) {
  if (!text) return (
    <p style={{ fontFamily: '"Lora", Georgia, serif', fontSize: 13, color: '#b8a48a', fontStyle: 'italic' }}>
      Generating…
    </p>
  )

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {lines.map((line, i) => {
        const numbered = line.match(/^(\d+)\.\s+(.*)$/)
        if (numbered) {
          const isLast = !lines.slice(i + 1).some((l) => l.match(/^(\d+)\.\s+/))
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '14px',
                padding: '13px 0',
                borderBottom: isLast ? 'none' : '1px solid rgba(160,130,90,0.13)',
                alignItems: 'flex-start',
              }}
            >
              {/* Step number */}
              <span
                style={{
                  flexShrink: 0,
                  fontFamily: '"Lora", Georgia, serif',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#c4a87a',
                  minWidth: 18,
                  paddingTop: 3,
                  lineHeight: 1,
                  textAlign: 'right',
                }}
              >
                {numbered[1]}
              </span>
              {/* Step text */}
              <p
                style={{
                  flex: 1,
                  fontFamily: '"Lora", Georgia, serif',
                  fontSize: 13.5,
                  fontWeight: 400,
                  lineHeight: 1.72,
                  color: '#2c1f0e',
                  margin: 0,
                }}
              >
                {renderInline(numbered[2])}
              </p>
            </div>
          )
        }
        // Intro / plain paragraph
        return (
          <p
            key={i}
            style={{
              fontFamily: '"Lora", Georgia, serif',
              fontSize: 12,
              fontStyle: 'italic',
              color: '#9a8060',
              marginBottom: 10,
              lineHeight: 1.6,
            }}
          >
            {renderInline(line)}
          </p>
        )
      })}
    </div>
  )
}

export function SignalDetailModal({ signal, recommendation, onClose }) {
  const meta   = SETUP_META[signal.setup_type] ?? SETUP_META.momentum_breakout
  const isLong = signal.direction === 'long'
  const steps  = useNextSteps(signal, true)

  const [qty, setQty]                 = useState(1)
  const [orderState, setOrderState]   = useState('idle')
  const [orderResult, setOrderResult] = useState(null)
  const [orderError, setOrderError]   = useState('')

  const entryMid = ((signal.entry_zone_low + signal.entry_zone_high) / 2).toFixed(2)

  async function handlePlaceOrder() {
    setOrderState('loading'); setOrderError('')
    try {
      const result = await flowTradeApi.placeOrder(signal.id, qty)
      setOrderResult(result); setOrderState('success')
    } catch (err) {
      setOrderError(err?.message ?? 'Order failed'); setOrderState('error')
    }
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[780px] rounded-2xl overflow-hidden flex flex-col"
        style={{ ...LIQUID_GLASS, height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-white/[0.07]">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
            {meta.label}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[19px] font-bold text-white/90">{signal.symbol}</span>
            {isLong ? <TrendingUp size={16} className="text-emerald-400" /> : <TrendingDown size={16} className="text-red-400" />}
            <span className={`text-[13px] font-semibold ${isLong ? 'text-emerald-400' : 'text-red-400'}`}>
              {isLong ? 'LONG' : 'SHORT'}
            </span>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* ── Chart — pinned below header, never scrolls ── */}
        <div className="flex-shrink-0 border-b border-white/[0.06]">
          <StockChart
            symbol={signal.symbol}
            entryLow={signal.entry_zone_low}
            entryHigh={signal.entry_zone_high}
            stop={signal.stop_level}
            target={signal.target_level}
            height={270}
            className="rounded-none border-0"
          />
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">

          {/* Price level strip — pipeline style */}
          <div
            className="overflow-hidden rounded-xl border border-white/[0.09]"
            style={{
              background: 'linear-gradient(160deg, #0d0f1c 0%, #07090f 100%)',
              boxShadow: 'rgba(0,0,0,0.50) 0px 8px 24px, rgba(255,255,255,0.07) 0px 1px 0px inset',
            }}
          >
            <div className="grid grid-cols-4 divide-x divide-white/[0.06]">

              {/* Entry zone */}
              <div className="px-4 pt-3.5 pb-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <ArrowUpRight size={11} className="text-white/35" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Entry zone</span>
                </div>
                <div className="text-[16px] font-mono font-semibold text-white/85">
                  ${signal.entry_zone_low?.toFixed(2)}
                </div>
                <div className="text-[10px] font-mono text-white/30 mt-0.5">
                  –${signal.entry_zone_high?.toFixed(2)}
                </div>
              </div>

              {/* Stop */}
              <div className="px-4 pt-3.5 pb-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <TrendingDown size={11} className="text-red-400/55" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Stop loss</span>
                </div>
                <div className="text-[16px] font-mono font-semibold text-red-400">
                  ${signal.stop_level?.toFixed(2)}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">Max risk / share</div>
              </div>

              {/* Target */}
              <div className="px-4 pt-3.5 pb-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <TrendingUp size={11} className="text-emerald-400/55" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Target</span>
                </div>
                <div className="text-[16px] font-mono font-semibold text-emerald-400">
                  ${signal.target_level?.toFixed(2)}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">Take profit level</div>
              </div>

              {/* R/R */}
              <div className="px-4 pt-3.5 pb-3">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Scale size={11} className="text-violet-400/55" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">R / R ratio</span>
                </div>
                <div className="text-[16px] font-mono font-semibold text-white/80">
                  {signal.risk_reward}:1
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">Reward vs risk</div>
              </div>

            </div>
          </div>

          {/* Rationale */}
          <p className="text-[13px] text-white/45 leading-relaxed">{signal.rationale}</p>

          {/* AI quick take */}
          {recommendation && (
            <div className="flex items-start gap-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3">
              <Sparkles size={14} className="text-violet-400 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-white/65 leading-relaxed">{recommendation}</p>
            </div>
          )}

          {/* Next steps — paper card */}
          <div
            style={{
              borderRadius: 14,
              background: 'linear-gradient(160deg, #fdf9f3 0%, #f7f0e6 100%)',
              border: '1px solid rgba(190,155,100,0.22)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.90)',
              overflow: 'clip',
              marginBottom: 8,
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 18px 10px',
                borderBottom: '1px solid rgba(190,155,100,0.14)',
                background: 'rgba(255,255,255,0.40)',
              }}
            >
              <ArrowRight size={11} style={{ color: '#c4a060' }} />
              <span
                style={{
                  fontFamily: '"Lora", Georgia, serif',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: '#a07840',
                }}
              >
                Next Steps
              </span>
              {/* decorative line */}
              <div style={{ flex: 1, height: 1, background: 'rgba(190,155,100,0.18)', marginLeft: 4 }} />
            </div>

            {/* Card body */}
            <div style={{ padding: '4px 18px 10px' }}>
              <StepsRenderer text={steps} />
            </div>
          </div>
        </div>

        {/* ── Execute trade — pinned to bottom ── */}
        <div
          className="flex-shrink-0 px-5 py-4 border-t border-white/[0.07]"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}
        >
          {/* ── Order placed ── */}
          {orderState === 'success' ? (
            <div className="rounded-xl border border-emerald-500/25 px-4 py-3 flex items-start gap-2.5"
              style={{ background: 'rgba(52,211,153,0.07)' }}>
              <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-[13px] font-semibold text-emerald-300">Bracket order placed</div>
                <div className="text-[11px] text-white/35 mt-1">
                  {orderResult.qty} × {orderResult.symbol} · entry&nbsp;
                  <span className="font-mono text-white/55">${orderResult.entryPrice}</span>
                  &nbsp;· stop&nbsp;
                  <span className="font-mono text-red-400/70">${orderResult.stopLevel?.toFixed(2)}</span>
                  &nbsp;· target&nbsp;
                  <span className="font-mono text-emerald-400/70">${orderResult.targetLevel?.toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-white/20 mt-1 font-mono">{orderResult.orderId}</div>
              </div>
            </div>

          /* ── Signal not tradeable (expired / risk_blocked) ── */
          ) : signal.status !== 'active' ? (
            <div className="flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white/15 flex-shrink-0" />
              <span className="text-[12px] text-white/30">
                Signal {signal.status === 'risk_blocked' ? 'risk-blocked' : 'expired'} — order unavailable
              </span>
            </div>

          /* ── Failed — do not allow retry without reopening ── */
          ) : orderState === 'error' ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 text-[11px] leading-relaxed">
                <div className="text-white/30">
                  Limit&nbsp;<span className="font-mono text-white/45">${entryMid}</span>
                  &nbsp;·&nbsp;Stop&nbsp;<span className="font-mono text-red-400/50">${signal.stop_level.toFixed(2)}</span>
                  &nbsp;·&nbsp;Target&nbsp;<span className="font-mono text-emerald-400/50">${signal.target_level.toFixed(2)}</span>
                </div>
                <div className="mt-1.5 text-[11px] text-red-400/70">{orderError}</div>
                <div className="mt-0.5 text-[10px] text-white/20">Close and reopen this signal to try again</div>
              </div>
              <button
                disabled
                className="flex-shrink-0 flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[13px] font-semibold opacity-30 cursor-not-allowed"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                {isLong ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {isLong ? 'Buy' : 'Sell'}
              </button>
            </div>

          /* ── Normal: ready to place ── */
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider">Shares</div>
                <input
                  type="number" min="1" value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-[68px] rounded-lg px-3 py-2 text-[13px] font-mono text-white/85 outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                  onBlur={(e)  => e.target.style.borderColor = 'rgba(255,255,255,0.10)'}
                />
              </div>
              <div className="flex-1 text-[11px] text-white/30 leading-relaxed">
                Limit&nbsp;<span className="font-mono text-white/50">${entryMid}</span>
                &nbsp;·&nbsp;Stop&nbsp;<span className="font-mono text-red-400/70">${signal.stop_level.toFixed(2)}</span>
                &nbsp;·&nbsp;Target&nbsp;<span className="font-mono text-emerald-400/70">${signal.target_level.toFixed(2)}</span>
              </div>
              <button
                onClick={handlePlaceOrder}
                disabled={orderState === 'loading'}
                className="flex-shrink-0 flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-50"
                style={{
                  background: isLong
                    ? 'linear-gradient(135deg, rgba(45,212,191,0.18) 0%, rgba(20,184,166,0.12) 100%)'
                    : 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(220,38,38,0.12) 100%)',
                  border: isLong ? '1px solid rgba(45,212,191,0.30)' : '1px solid rgba(239,68,68,0.30)',
                  color: isLong ? 'rgba(94,234,212,0.90)' : 'rgba(252,165,165,0.9)',
                  boxShadow: orderState === 'loading' ? 'none'
                    : isLong ? '0 0 14px rgba(45,212,191,0.18)' : '0 0 14px rgba(239,68,68,0.15)',
                }}
              >
                {orderState === 'loading'
                  ? <Loader size={13} className="animate-spin" />
                  : isLong ? <TrendingUp size={13} /> : <TrendingDown size={13} />
                }
                {orderState === 'loading' ? 'Placing…' : isLong ? 'Buy' : 'Sell'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
