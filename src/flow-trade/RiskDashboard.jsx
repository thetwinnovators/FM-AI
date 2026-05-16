import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { flowTradeApi } from './api.js'
import { useFlowTradeSSE } from './useFlowTradeSSE.js'

const LOCAL_BALANCE  = 100_000
const LOSS_LIMIT_PCT = 0.02

function formatMarketTime(hour, min) {
  const period = hour >= 12 ? 'PM' : 'AM'
  const h12    = hour % 12 || 12
  return `${h12}:${String(min).padStart(2, '0')} ${period}`
}

export function RiskDashboard({ refreshTick = 0 }) {
  const [dailyRisk,       setDailyRisk]       = useState(null)
  const [alpacaPositions, setAlpacaPositions] = useState(null)
  const [alpacaAccount,   setAlpacaAccount]   = useState(null)
  const [pendingOrders,   setPendingOrders]   = useState([])
  const [cancellingId,    setCancellingId]    = useState(null)
  const [cancelErrorId,   setCancelErrorId]   = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [risk, apPositions, apAccount, apOrders] = await Promise.allSettled([
        flowTradeApi.getDailyRisk(),
        flowTradeApi.getAlpacaPositions(),
        flowTradeApi.getAlpacaAccount(),
        flowTradeApi.getAlpacaOrders(),
      ])
      if (risk.status        === 'fulfilled') setDailyRisk(risk.value)
      if (apPositions.status === 'fulfilled') setAlpacaPositions(apPositions.value ?? [])
      if (apAccount.status   === 'fulfilled') setAlpacaAccount(apAccount.value)
      if (apOrders.status    === 'fulfilled') setPendingOrders(apOrders.value ?? [])
    } catch { /* daemon offline */ }
  }, [])

  useEffect(() => { refresh() }, [refresh, refreshTick])

  // Poll Alpaca every 30s for live updates
  useEffect(() => {
    const id = setInterval(() => {
      Promise.allSettled([
        flowTradeApi.getAlpacaPositions(),
        flowTradeApi.getAlpacaAccount(),
        flowTradeApi.getAlpacaOrders(),
      ]).then(([apPositions, apAccount, apOrders]) => {
        if (apPositions.status === 'fulfilled') setAlpacaPositions(apPositions.value ?? [])
        if (apAccount.status   === 'fulfilled') setAlpacaAccount(apAccount.value)
        if (apOrders.status    === 'fulfilled') setPendingOrders(apOrders.value ?? [])
      })
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const handleSSE = useCallback((event) => {
    const refreshEvents = ['position_opened','position_closed','risk_blocked','risk_unblocked','market_close_sweep','positions_reset']
    if (refreshEvents.includes(event.type)) refresh()
  }, [refresh])

  useFlowTradeSSE(handleSSE)

  const handleCancelOrder = useCallback(async (orderId) => {
    setCancellingId(orderId)
    setCancelErrorId(null)
    try {
      await flowTradeApi.cancelAlpacaOrder(orderId)
      setPendingOrders(prev => prev.filter(o => o.id !== orderId))
    } catch {
      setCancelErrorId(orderId)
      setTimeout(() => setCancelErrorId(null), 3000)
    }
    setCancellingId(null)
  }, [])

  const closeTime = formatMarketTime(16, 0)   // 4:00 PM
  const resetTime = formatMarketTime(9, 30)   // 9:30 AM

  const isBlocked = dailyRisk?.blocked === 1

  // P&L: prefer live Alpaca account data, fall back to local realized_pnl
  const accountBalance = alpacaAccount ? parseFloat(alpacaAccount.last_equity) : LOCAL_BALANCE
  const pnl = alpacaAccount
    ? parseFloat(alpacaAccount.equity) - parseFloat(alpacaAccount.last_equity)
    : (dailyRisk?.realized_pnl ?? 0)
  const pnlPct   = accountBalance > 0 ? (pnl / accountBalance) * 100 : 0
  const lossLimit = accountBalance * LOSS_LIMIT_PCT
  const barPct   = Math.min(Math.abs(pnlPct) / LOSS_LIMIT_PCT / 100 * 100, 100)

  // Positions: prefer live Alpaca data, fall back to local DB
  const openPositions = alpacaPositions ?? []

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
        Risk Dashboard
      </div>

      {/* Open positions */}
      <div>
        <div className="flex justify-between text-[13px] text-white/40 mb-2">
          <span>Open Positions</span>
          <span>{openPositions.length} / 3</span>
        </div>
        {openPositions.length === 0 ? (
          <div className="text-[13px] text-white/20">None</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {openPositions.map((pos) => {
              const upl     = parseFloat(pos.unrealized_pl ?? 0)
              const qty     = parseFloat(pos.qty ?? 1)
              const entry   = parseFloat(pos.avg_entry_price ?? 0)
              const current = parseFloat(pos.current_price ?? entry)
              return (
                <div key={pos.asset_id ?? pos.symbol} className="rounded-lg bg-white/[0.02] border border-white/[0.05] px-2.5 py-2 flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="text-white/80 font-semibold">{pos.symbol}</span>
                    <span className={`text-[11px] font-semibold ${pos.side === 'long' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(pos.side ?? 'long').toUpperCase()}
                    </span>
                    <span className="text-white/30 text-[11px] ml-auto">{+qty.toFixed(4)} share{qty !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/30">
                      ${entry.toFixed(2)} → <span className="text-white/50">${current.toFixed(2)}</span>
                    </span>
                    <span className={upl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {upl >= 0 ? '+' : ''}${upl.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pending orders */}
      {pendingOrders.length > 0 && (
        <div>
          <div className="flex justify-between text-[13px] text-white/40 mb-2">
            <span>Pending Orders</span>
            <span>{pendingOrders.length}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {pendingOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-teal-500/15 px-2.5 py-2 flex flex-col gap-1"
                style={{ background: 'rgba(20,184,166,0.04)' }}>
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-white/80 font-semibold">{order.symbol}</span>
                  <span className={`text-[11px] font-semibold ${order.side === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {order.side?.toUpperCase()}
                  </span>
                  <span className="text-white/30 text-[11px] ml-auto">{+parseFloat(order.qty ?? 0).toFixed(4)} sh</span>
                  <button
                    onClick={() => handleCancelOrder(order.id)}
                    disabled={cancellingId === order.id}
                    title={cancelErrorId === order.id ? 'Cancel failed — restart daemon?' : 'Cancel order'}
                    className={`ml-1 transition-colors disabled:opacity-40 ${
                      cancelErrorId === order.id
                        ? 'text-red-400 animate-pulse'
                        : 'text-white/20 hover:text-red-400'
                    }`}
                  >
                    <X size={11} />
                  </button>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-teal-400/60 capitalize">{order.order_class === 'bracket' ? 'bracket limit' : order.type}</span>
                  <span className="font-mono text-white/40">${parseFloat(order.limit_price ?? 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily P&L */}
      <div className="space-y-2">
        <div className="flex justify-between text-[13px]">
          <span className="text-white/40">Daily P&L</span>
          <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}{' '}
            <span className="text-white/30">({pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pnl >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
        <div className="text-[11px] text-white/20">Limit: −${lossLimit.toFixed(0)} (−2%)</div>
      </div>

      {isBlocked && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
          Daily loss limit hit — trading blocked
        </div>
      )}

      {/* Timers */}
      <div className="flex flex-col gap-1.5 text-[13px]">
        <div className="flex justify-between text-white/40">
          <span>Market closes</span>
          <span className="font-mono text-white/60">{closeTime}</span>
        </div>
        <div className="flex justify-between text-white/40">
          <span>Trading resets</span>
          <span className="font-mono text-white/60">{resetTime}</span>
        </div>
      </div>

      {/* Account */}
      <div className="text-[13px] text-white/30 border-t border-white/[0.06] pt-3">
        Paper account:{' '}
        <span className="text-white/55">
          ${alpacaAccount ? parseFloat(alpacaAccount.equity).toLocaleString('en-US', { maximumFractionDigits: 2 }) : LOCAL_BALANCE.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
