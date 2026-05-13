import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ExternalLink, ShieldOff, Wifi } from 'lucide-react'

// Maps tickers that live on non-NASDAQ exchanges.
const EXCHANGE = {
  SPY: 'AMEX', QQQ: 'NASDAQ', IWM: 'AMEX', DIA: 'AMEX',
  GLD: 'AMEX', SLV: 'AMEX',  USO: 'AMEX',
}
function tvSymbol(symbol) { return `${EXCHANGE[symbol] ?? 'NASDAQ'}:${symbol}` }
function clearNode(el)     { while (el.firstChild) el.removeChild(el.firstChild) }

const REASONS = [
  { icon: ShieldOff, text: 'Ad blocker or content filter blocking TradingView' },
  { icon: Wifi,      text: 'Network error or no internet connection' },
]

function ChartFallback({ symbol, entryLow, entryHigh, stop, target }) {
  const tvUrl = `https://www.tradingview.com/chart/?symbol=${tvSymbol(symbol)}&interval=5`

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-5"
      style={{ background: '#0c0e14' }}>

      {/* Icon + heading */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="rounded-full p-2.5"
          style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)' }}>
          <AlertTriangle size={18} className="text-amber-400/70" />
        </div>
        <div className="text-[13px] font-semibold text-white/60">Chart couldn't load</div>
      </div>

      {/* Reasons */}
      <div className="flex flex-col gap-1.5 w-full max-w-[280px]">
        {REASONS.map(({ icon: Icon, text }, i) => (
          <div key={i} className="flex items-start gap-2">
            <Icon size={11} className="text-white/25 flex-shrink-0 mt-0.5" />
            <span className="text-[11px] text-white/30 leading-snug">{text}</span>
          </div>
        ))}
      </div>

      {/* Open in TradingView */}
      <a
        href={tvUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors"
      >
        <ExternalLink size={11} />
        Open {symbol} on TradingView
      </a>

      {/* Price level strip */}
      <div className="absolute bottom-0 inset-x-0 flex border-t border-white/[0.06]"
        style={{ background: 'rgba(0,0,0,0.35)' }}>
        {[
          { label: 'Entry',  value: `$${entryLow?.toFixed(2)}–$${entryHigh?.toFixed(2)}`, color: 'text-white/60'       },
          { label: 'Stop',   value: `$${stop?.toFixed(2)}`,                                color: 'text-red-400/80'     },
          { label: 'Target', value: `$${target?.toFixed(2)}`,                              color: 'text-emerald-400/80' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex-1 flex flex-col items-center py-2 gap-0.5">
            <span className="text-[9px] text-white/25 uppercase tracking-wider">{label}</span>
            <span className={`text-[11px] font-mono font-semibold ${color}`}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StockChart({ symbol, entryLow, entryHigh, stop, target, height = 220, className = '' }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ok' | 'failed'

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    clearNode(el)
    setStatus('loading')

    const wrapper = document.createElement('div')
    wrapper.className = 'tradingview-widget-container'
    wrapper.style.cssText = 'width:100%;height:100%'

    const inner = document.createElement('div')
    inner.style.cssText = 'width:100%;height:100%'
    wrapper.appendChild(inner)

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.textContent = JSON.stringify({
      autosize:            true,
      symbol:              tvSymbol(symbol),
      interval:            '5',
      timezone:            'America/New_York',
      theme:               'dark',
      style:               '1',
      locale:              'en',
      backgroundColor:     'rgba(0,0,0,0)',
      gridColor:           'rgba(255,255,255,0.04)',
      hide_top_toolbar:    true,
      hide_legend:         true,
      allow_symbol_change: false,
      calendar:            false,
      hide_volume:         false,
      support_host:        'https://www.tradingview.com',
    })

    // Detect the iframe TradingView injects so we can track load/error
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeName === 'IFRAME') {
            node.addEventListener('load',  () => setStatus('ok'))
            node.addEventListener('error', () => setStatus('failed'))
          }
        }
      }
    })
    observer.observe(el, { childList: true, subtree: true })

    // If no iframe appears within 8 s the script was blocked or failed
    const timeout = setTimeout(() => {
      setStatus((s) => s === 'loading' ? 'failed' : s)
    }, 8000)

    // Script load error (e.g. network down, CSP blocking s3.tradingview.com)
    script.addEventListener('error', () => setStatus('failed'))

    wrapper.appendChild(script)
    el.appendChild(wrapper)

    return () => {
      clearNode(el)
      observer.disconnect()
      clearTimeout(timeout)
    }
  }, [symbol])

  // ── Price level overlay (shown on top of a working chart) ─────────────────
  const levels = [
    { price: entryLow,  label: 'entry', color: 'rgba(255,255,255,0.55)',  border: 'rgba(255,255,255,0.25)' },
    { price: entryHigh, label: '',      color: 'rgba(255,255,255,0.22)',  border: 'rgba(255,255,255,0.10)' },
    { price: stop,      label: 'stop',  color: 'rgba(248,113,113,0.80)',  border: 'rgba(248,113,113,0.40)' },
    { price: target,    label: 'tgt',   color: 'rgba(52,211,153,0.80)',   border: 'rgba(52,211,153,0.40)'  },
  ].filter((l) => l.price != null)

  const allPrices = levels.map((l) => l.price)
  const min   = Math.min(...allPrices) * 0.9985
  const max   = Math.max(...allPrices) * 1.0015
  const range = max - min || 1
  const pct   = (price) => ((max - price) / range) * 100

  return (
    <div
      className={`relative w-full rounded-lg overflow-hidden border border-white/[0.07] ${className}`}
      style={{ height, background: '#0c0e14' }}
    >
      <div ref={containerRef} className="w-full h-full" />

      {status === 'failed' && (
        <ChartFallback
          symbol={symbol}
          entryLow={entryLow} entryHigh={entryHigh}
          stop={stop} target={target}
        />
      )}

      {/* Price lines — only shown when chart is working */}
      {status !== 'failed' && (
        <div className="absolute inset-0 pointer-events-none">
          {levels.map((l, i) => (
            <div
              key={i}
              className="absolute left-0 right-0 flex items-center"
              style={{ top: `${pct(l.price)}%`, transform: 'translateY(-50%)' }}
            >
              <div className="absolute inset-x-0" style={{ height: '1px', background: l.color, opacity: 0.45 }} />
              {l.label && (
                <span
                  className="absolute right-1 text-[9px] font-mono font-semibold px-1 py-0.5 rounded"
                  style={{ color: l.color, background: '#0c0e14', border: `1px solid ${l.border}`, lineHeight: 1 }}
                >
                  {l.label}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
