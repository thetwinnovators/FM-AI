import { useState, useEffect } from 'react'
import { Pin, PinOff, X, Plus } from 'lucide-react'
import { flowTradeApi } from './api.js'

export function WatchlistPanel() {
  const [watchlist,   setWatchlist]   = useState([])
  const [input,       setInput]       = useState('')
  const [removingId,  setRemovingId]  = useState(null)
  const [removeError, setRemoveError] = useState(null)
  const [adding,      setAdding]      = useState(false)
  const [addError,    setAddError]    = useState(null)

  const load = () => flowTradeApi.getWatchlist().then(setWatchlist).catch(() => {})
  useEffect(() => { load() }, [])

  async function addSymbol() {
    const sym = input.trim().toUpperCase()
    if (!sym || adding) return
    setAdding(true)
    setAddError(null)
    try {
      await flowTradeApi.addSymbol(sym)
      setInput('')
      load()
    } catch (err) {
      console.error('[WatchlistPanel] add failed:', err?.message ?? err)
      setAddError(err?.message ?? 'Add failed')
      setTimeout(() => setAddError(null), 3000)
    } finally {
      setAdding(false)
    }
  }

  async function removeSymbol(symbol) {
    setRemovingId(symbol)
    setRemoveError(null)
    try {
      await flowTradeApi.removeSymbol(symbol)
      load()
    } catch (err) {
      console.error('[WatchlistPanel] remove failed:', err?.message ?? err)
      setRemoveError(symbol)
      setTimeout(() => setRemoveError(null), 3000)
    } finally {
      setRemovingId(null)
    }
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
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]"
          >
            {entry.pinned === 1 && (
              <Pin size={9} className="text-fuchsia-400 flex-shrink-0" />
            )}
            <span className="flex-1 text-[13px] font-medium text-white/80">{entry.symbol}</span>
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => pinSymbol(entry.symbol)}
                className="p-1 rounded text-white/25 hover:text-white/70 transition-colors"
                title={entry.pinned ? 'Unpin' : 'Pin'}
              >
                {entry.pinned ? <PinOff size={11} /> : <Pin size={11} />}
              </button>
              <button
                onClick={() => removeSymbol(entry.symbol)}
                disabled={removingId === entry.symbol}
                className={`p-1 rounded transition-colors disabled:opacity-40 ${
                  removeError === entry.symbol
                    ? 'text-red-300 animate-pulse'
                    : 'text-white/25 hover:text-red-400'
                }`}
                title={removeError === entry.symbol ? 'Remove failed — try again' : 'Remove'}
              >
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex gap-1.5 pt-1 border-t border-white/[0.06]">
          <input
            className={`flex-1 bg-white/[0.04] border rounded-lg px-2.5 py-1.5 text-[12px] text-white/80 placeholder:text-white/25 focus:outline-none transition-colors ${
              addError ? 'border-red-500/50' : 'border-white/[0.08] focus:border-white/20'
            }`}
            placeholder="Add symbol…"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && addSymbol()}
            maxLength={8}
            disabled={adding}
          />
          <button
            onClick={addSymbol}
            disabled={!input.trim() || adding}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/60 hover:text-white/90 disabled:opacity-30 transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>
        {addError && (
          <div className="text-[10px] text-red-400/80 px-1">{addError}</div>
        )}
      </div>
    </div>
  )
}
