import { useState, useEffect } from 'react'
import { Pin, PinOff, X, Plus } from 'lucide-react'
import { flowTradeApi } from './api.js'

export function WatchlistPanel() {
  const [watchlist, setWatchlist] = useState([])
  const [input, setInput] = useState('')

  const load = () => flowTradeApi.getWatchlist().then(setWatchlist).catch(() => {})
  useEffect(() => { load() }, [])

  async function addSymbol() {
    const sym = input.trim().toUpperCase()
    if (!sym) return
    try { await flowTradeApi.addSymbol(sym) } catch { return }
    setInput('')
    load()
  }

  async function removeSymbol(symbol) {
    try { await flowTradeApi.removeSymbol(symbol) } catch { return }
    setWatchlist((prev) => prev.filter((e) => e.symbol !== symbol))
  }

  async function pinSymbol(symbol) {
    try {
      const result = await flowTradeApi.pinSymbol(symbol)
      setWatchlist((prev) => prev.map((e) => e.symbol === symbol ? { ...e, pinned: result.pinned ? 1 : 0 } : e))
    } catch { /* ignore */ }
  }

  const sorted = [...watchlist]
    .filter((e) => e.active)
    .sort((a, b) => b.pinned - a.pinned || a.symbol.localeCompare(b.symbol))

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-1 pt-1">
        Watchlist
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-0.5">
        {sorted.length === 0 && (
          <div className="text-[11px] text-white/25 px-1 py-2">No active symbols</div>
        )}
        {sorted.map((entry) => (
          <div
            key={entry.symbol}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] group"
          >
            {entry.pinned === 1 && (
              <Pin size={9} className="text-fuchsia-400 flex-shrink-0" />
            )}
            <span className="flex-1 text-[13px] font-medium text-white/80">{entry.symbol}</span>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => pinSymbol(entry.symbol)}
                className="p-0.5 rounded text-white/40 hover:text-white/70"
                title={entry.pinned ? 'Unpin' : 'Pin'}
              >
                {entry.pinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
              <button
                onClick={() => removeSymbol(entry.symbol)}
                className="p-0.5 rounded text-red-400/60 hover:text-red-300"
                title="Remove"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 pt-1 border-t border-white/[0.06]">
        <input
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-white/20"
          placeholder="Add symbol…"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
          maxLength={8}
        />
        <button
          onClick={addSymbol}
          disabled={!input.trim()}
          className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white/90 disabled:opacity-30 transition-colors"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}
