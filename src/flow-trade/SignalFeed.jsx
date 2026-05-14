import { useState, useEffect, useCallback } from 'react'
import { flowTradeApi } from './api.js'
import { useFlowTradeSSE } from './useFlowTradeSSE.js'
import { SignalCard } from './SignalCard.jsx'

export function SignalFeed({ isBlocked, refreshTick = 0 }) {
  const [signals,         setSignals]         = useState([])
  const [positionSymbols, setPositionSymbols] = useState(new Set())
  const [pendingSymbols,  setPendingSymbols]  = useState(new Set())

  useEffect(() => { flowTradeApi.getSignals().then(setSignals).catch(() => {}) }, [refreshTick])

  const refreshPositions = useCallback(() => {
    Promise.allSettled([
      flowTradeApi.getAlpacaPositions(),
      flowTradeApi.getAlpacaOrders(),
    ]).then(([pos, orders]) => {
      if (pos.status    === 'fulfilled') setPositionSymbols(new Set((pos.value    ?? []).map((p) => p.symbol)))
      if (orders.status === 'fulfilled') setPendingSymbols( new Set((orders.value ?? []).map((o) => o.symbol)))
    })
  }, [])

  useEffect(() => {
    refreshPositions()
    const id = setInterval(refreshPositions, 30_000)
    return () => clearInterval(id)
  }, [refreshPositions, refreshTick])

  const handleSSE = useCallback((event) => {
    if (event.type === 'signal' || event.type === 'signal_blocked') {
      setSignals((prev) => [event.data, ...prev].slice(0, 50))
    } else if (event.type === 'signal_expired') {
      setSignals((prev) => prev.map((s) => s.id === event.data?.id ? { ...s, status: 'expired' } : s))
    }
  }, [])

  useFlowTradeSSE(handleSSE)

  // Keep only the most recent signal per symbol+setup — daemon restarts clear
  // in-memory cooldowns so the same setup can fire again before expiry, producing
  // near-identical cards. Latest always wins; older ones are still stored in the DB.
  const deduped = signals.reduce((acc, s) => {
    const key = `${s.symbol}::${s.setup_type}`
    const existing = acc.get(key)
    if (!existing || s.fired_at > existing.fired_at) acc.set(key, s)
    return acc
  }, new Map())
  const visibleSignals = Array.from(deduped.values()).sort((a, b) => b.fired_at.localeCompare(a.fired_at))

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto">
      {isBlocked && (
        <div className="sticky top-0 z-10 rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-3 text-[13px] font-medium text-red-300">
          Risk limit reached — no new entries today
        </div>
      )}

      {signals.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-16 text-center gap-2">
          <div className="text-white/25 text-[13px]">No signals yet today</div>
          <div className="text-white/15 text-[11px]">Detecting: Momentum Breakout · VWAP Reclaim · ORB</div>
        </div>
      ) : (
        <div className="grid gap-3 content-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {visibleSignals.map((s) => (
            <SignalCard
              key={s.id}
              signal={s}
              inPosition={positionSymbols.has(s.symbol)}
              hasPendingOrder={!positionSymbols.has(s.symbol) && pendingSymbols.has(s.symbol)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
