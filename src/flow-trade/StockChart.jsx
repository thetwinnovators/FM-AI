import { useEffect, useRef, useState } from 'react'
import { createChart, CandlestickSeries, LineStyle } from 'lightweight-charts'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { flowTradeApi } from './api.js'

function ChartLoading() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
      style={{ background: '#0c0e14' }}>
      <div className="relative w-24 h-px overflow-hidden rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="absolute inset-y-0 w-12 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.20), transparent)',
            animation: 'tv-scan 1.6s ease-in-out infinite',
          }}
        />
      </div>
      <span className="text-[10px] text-white/20 tracking-wide">Loading chart…</span>
      <style>{`@keyframes tv-scan { 0%{left:-3rem} 100%{left:6rem} }`}</style>
    </div>
  )
}

function ChartFallback({ symbol, error }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5"
      style={{ background: '#0c0e14' }}>
      <div className="rounded-full p-2.5"
        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)' }}>
        <AlertTriangle size={16} className="text-amber-400/70" />
      </div>
      <div className="text-center">
        <div className="text-[12px] font-semibold text-white/50">No chart data</div>
        {error && <div className="text-[10px] text-white/25 mt-1">{error}</div>}
      </div>
      <a
        href={`https://www.tradingview.com/chart/?symbol=${symbol}&interval=5`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-white/60 transition-colors"
      >
        <ExternalLink size={10} />
        Open on TradingView
      </a>
    </div>
  )
}

export function StockChart({ symbol, entryLow, entryHigh, stop, target, height = 220, className = '' }) {
  const containerRef = useRef(null)
  const [status,    setStatus]    = useState('loading') // 'loading' | 'ok' | 'failed'
  const [errorMsg,  setErrorMsg]  = useState('')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    setStatus('loading')
    setErrorMsg('')

    let chart   = null
    let aborted = false

    ;(async () => {
      try {
        const raw  = await flowTradeApi.getAlpacaBars(symbol)
        if (aborted) return

        const bars = (raw?.bars ?? [])
        if (bars.length === 0) {
          setErrorMsg('Market may be closed or no data available')
          setStatus('failed')
          return
        }

        // ── Create chart ──────────────────────────────────────────────────
        chart = createChart(el, {
          autoSize: true,
          layout: {
            background:  { color: '#0c0e14' },
            textColor:   'rgba(255,255,255,0.30)',
            fontSize:    10,
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.03)' },
            horzLines: { color: 'rgba(255,255,255,0.03)' },
          },
          crosshair: {
            mode: 1, // normal
            vertLine: { color: 'rgba(255,255,255,0.15)', labelBackgroundColor: '#1e2230' },
            horzLine: { color: 'rgba(255,255,255,0.15)', labelBackgroundColor: '#1e2230' },
          },
          rightPriceScale: {
            borderColor:   'rgba(255,255,255,0.05)',
            scaleMargins:  { top: 0.08, bottom: 0.08 },
          },
          timeScale: {
            borderColor:    'rgba(255,255,255,0.05)',
            timeVisible:    true,
            secondsVisible: false,
            fixLeftEdge:    true,
            fixRightEdge:   false,
          },
          handleScroll: true,
          handleScale:  true,
        })

        // ── Candlestick series ─────────────────────────────────────────────
        const series = chart.addSeries(CandlestickSeries, {
          upColor:         '#34d399',
          downColor:       '#f87171',
          borderUpColor:   '#34d399',
          borderDownColor: '#f87171',
          wickUpColor:     '#6ee7b7',
          wickDownColor:   '#fca5a5',
        })

        series.setData(bars.map(b => ({
          time:  Math.floor(new Date(b.t).getTime() / 1000),
          open:  b.o,
          high:  b.h,
          low:   b.l,
          close: b.c,
        })))

        // ── Price lines ────────────────────────────────────────────────────
        if (entryLow  != null)
          series.createPriceLine({ price: entryLow,  color: 'rgba(255,255,255,0.55)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true,  title: 'entry' })
        if (entryHigh != null)
          series.createPriceLine({ price: entryHigh, color: 'rgba(255,255,255,0.20)', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' })
        if (stop      != null)
          series.createPriceLine({ price: stop,      color: '#f87171',               lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true,  title: 'stop' })
        if (target    != null)
          series.createPriceLine({ price: target,    color: '#34d399',               lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true,  title: 'tgt' })

        chart.timeScale().fitContent()
        setStatus('ok')

      } catch (e) {
        if (!aborted) {
          setErrorMsg(e?.message ?? 'Failed to fetch bar data')
          setStatus('failed')
        }
      }
    })()

    return () => {
      aborted = true
      chart?.remove()
    }
  }, [symbol]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height, background: '#0c0e14' }}
    >
      {/* Chart mounts here — always in DOM so lightweight-charts can measure it */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Overlays */}
      {status === 'loading' && <ChartLoading />}
      {status === 'failed'  && <ChartFallback symbol={symbol} error={errorMsg} />}
    </div>
  )
}
