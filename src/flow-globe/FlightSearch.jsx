import { useState, useRef, useEffect, useCallback } from 'react'
import { Plane, ArrowLeftRight, ExternalLink, Search, Loader2, Bell, RefreshCw, Bookmark, BookmarkCheck, X, Pencil, Send } from 'lucide-react'
import { searchAirports } from './airportData.js'
import { getWatches, addWatch, removeWatch, patchWatch } from './priceWatches.js'
import { getSavedRoutes, addRoute as saveRoute, removeRoute as deleteSavedRoute } from './savedRoutes.js'

// ── Date helpers ───────────────────────────────────────────────────────────────

function dateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function ssDate(iso)    { return iso.replace(/-/g, '').slice(2) }
function shortDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ── Daemon helpers ────────────────────────────────────────────────────────────

async function getDaemonInfo() {
  try {
    const r = await fetch('/api/daemon/info')
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

// ── Price fetching — Google Flights MCP via FlowMap daemon ────────────────────
// Submits a daemon job for:
//   docker_mcp::google-flights::get_round_trip_flights  (roundtrip)
//   docker_mcp::google-flights::get_flights_on_date     (one-way)
// Streams the SSE result and parses the cheapest price.
// Returns an integer price (e.g. 165) or null if unavailable.

function extractFlightPrice(result, tripType) {
  // MCP callTool returns content[]: [{type:"text", text:"...json..."}]
  // Parse text content items as JSON to reach the flight data object.
  let data = result
  if (Array.isArray(result)) {
    for (const item of result) {
      if (item?.type === 'text' && item?.text) {
        try { data = JSON.parse(item.text); break } catch { /* not JSON, skip */ }
      }
    }
  }
  const raw = tripType === 'roundtrip'
    ? data?.cheapest_round_trip_option?.[0]?.price
    : data?.cheapest_flight?.[0]?.price
  if (!raw) return null
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? null : n
}

export async function fetchCheapestPrice({ origin, dest, departDate, returnDate, tripType }) {
  try {
    const info = await getDaemonInfo()
    if (!info) return null

    const toolId = tripType === 'roundtrip'
      ? 'docker_mcp::google-flights::get_round_trip_flights'
      : 'docker_mcp::google-flights::get_flights_on_date'

    const params = tripType === 'roundtrip'
      ? { origin, destination: dest, departure_date: departDate, return_date: returnDate, return_cheapest_only: true }
      : { origin, destination: dest, date: departDate, return_cheapest_only: true }

    // 1. Submit job
    const jobRes = await fetch('/api/daemon-proxy/jobs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${info.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId, params }),
    })
    if (!jobRes.ok) return null
    const { jobId } = await jobRes.json()
    if (!jobId) return null

    // 2. Stream SSE until done/failed (45 s timeout — Google Flights can be slow)
    const sseRes = await fetch(`/api/daemon-proxy/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${info.token}`, Accept: 'text/event-stream' },
      signal: AbortSignal.timeout(45_000),
    })
    if (!sseRes.ok || !sseRes.body) return null

    const reader  = sseRes.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const chunks = buf.split('\n\n')
      buf = chunks.pop() ?? ''
      for (const chunk of chunks) {
        if (!chunk.startsWith('data: ')) continue
        try {
          const evt = JSON.parse(chunk.slice(6))
          if (evt.type === 'done') {
            reader.cancel().catch(() => {})
            return extractFlightPrice(evt.result, tripType)
          }
          if (evt.type === 'failed' || evt.type === 'cancelled') {
            reader.cancel().catch(() => {})
            return null
          }
        } catch { /* ignore malformed SSE frame */ }
      }
    }
  } catch {
    // timeout, network error, or daemon offline — degrade gracefully
    return null
  }
  return null
}

// ── Link builders ──────────────────────────────────────────────────────────────

function buildLinks({ origin, dest, departDate, returnDate, tripType }) {
  const org  = origin.toUpperCase()
  const dst  = dest.toUpperCase()
  const orgL = origin.toLowerCase()
  const dstL = dest.toLowerCase()
  const rt   = tripType === 'roundtrip'
  return [
    {
      name:   'Google Flights',
      hint:   'google.com/travel/flights',
      accent: 'rgba(14,210,238,0.70)',
      bg:     'rgba(14,210,238,0.07)',
      border: 'rgba(14,210,238,0.18)',
      url:    `https://www.google.com/travel/flights?q=Flights+from+${org}+to+${dst}`,
    },
    {
      name:   'Kayak',
      hint:   'kayak.com',
      accent: 'rgba(255,106,0,0.85)',
      bg:     'rgba(255,106,0,0.06)',
      border: 'rgba(255,106,0,0.18)',
      url: rt
        ? `https://www.kayak.com/flights/${org}-${dst}/${departDate}/${returnDate}`
        : `https://www.kayak.com/flights/${org}-${dst}/${departDate}`,
    },
    {
      name:   'Skyscanner',
      hint:   'skyscanner.com',
      accent: 'rgba(0,134,255,0.85)',
      bg:     'rgba(0,134,255,0.06)',
      border: 'rgba(0,134,255,0.18)',
      url: rt
        ? `https://www.skyscanner.com/transport/flights/${orgL}/${dstL}/${ssDate(departDate)}/${ssDate(returnDate)}/`
        : `https://www.skyscanner.com/transport/flights/${orgL}/${dstL}/${ssDate(departDate)}/`,
    },
  ]
}

// ── Notification helpers ───────────────────────────────────────────────────────

function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

function sendNotification(watch, price) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  new Notification(`✈️ Price drop! ${watch.origin} → ${watch.dest}`, {
    body: `Now $${price} — your target was $${watch.targetPrice}`,
    icon: '/favicon.ico',
  })
}

// ── AirportInput ───────────────────────────────────────────────────────────────

function AirportInput({ value, onChange, placeholder, required }) {
  const [query,  setQuery ] = useState(value)
  const [open,   setOpen  ] = useState(false)
  const [active, setActive] = useState(-1)
  const listRef   = useRef(null)
  const blurTimer = useRef(null)

  useEffect(() => { setQuery(value) }, [value])

  const suggestions = query.length >= 1 ? searchAirports(query, 7) : []

  function select(airport) {
    setQuery(airport.iata); onChange(airport.iata); setOpen(false); setActive(-1)
  }
  function handleChange(e) {
    const v = e.target.value.toUpperCase()
    setQuery(v); onChange(v); setOpen(true); setActive(-1)
  }
  function handleKeyDown(e) {
    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); select(suggestions[active]) }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1) }
  }
  useEffect(() => {
    if (active >= 0 && listRef.current)
      listRef.current.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])
  const handleFocus = useCallback(() => { clearTimeout(blurTimer.current); if (query.length >= 1) setOpen(true) }, [query])
  const handleBlur  = useCallback(() => { blurTimer.current = setTimeout(() => setOpen(false), 150) }, [])

  return (
    <div className="relative flex-1">
      <input
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        required={required}
        maxLength={10}
        autoComplete="off"
        className="glass-input w-full text-[12px] font-mono uppercase"
      />
      {open && suggestions.length > 0 && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden overflow-y-auto"
          style={{
            maxHeight: 256,
            background: 'rgba(4,12,26,0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          }}
        >
          {suggestions.map((a, i) => (
            <button
              key={a.iata}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(a) }}
              onMouseEnter={() => setActive(i)}
              className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors"
              style={{
                background:   i === active ? 'rgba(14,210,238,0.08)' : 'transparent',
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <span className="text-[11px] font-mono font-bold flex-shrink-0 w-8 text-center"
                style={{ color: 'rgba(14,210,238,0.85)' }}>{a.iata}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/75 truncate leading-snug">{a.city}</p>
                <p className="text-[10px] text-white/30 truncate leading-tight">{a.name}</p>
              </div>
              <span className="text-[9px] text-white/20 font-mono flex-shrink-0">{a.country}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Telegram helper ───────────────────────────────────────────────────────────

async function sendFlightToTelegram(watch) {
  // Load Telegram config from the MCP integration storage
  let integrations = []
  try { integrations = JSON.parse(localStorage.getItem('fm_mcp_integrations') || '[]') } catch { /* ignore */ }
  const tg = integrations.find((i) => i.id === 'integ_telegram')
  const token  = tg?.config?.token  ?? ''
  const chatId = tg?.config?.chatId ?? ''
  if (!token || !chatId) {
    return { success: false, error: 'Telegram not configured — add your bot token and chat ID in Connections.' }
  }

  const status = watch.currentPrice != null && watch.currentPrice <= watch.targetPrice
    ? `✅ Below your target by $${watch.targetPrice - watch.currentPrice}!`
    : watch.currentPrice != null
      ? `$${watch.currentPrice - watch.targetPrice} above target`
      : 'Price not yet fetched'

  const lines = [
    `✈️ ${watch.origin} → ${watch.dest}`,
    `${shortDate(watch.departDate)}${watch.returnDate ? ` – ${shortDate(watch.returnDate)}` : ''} · ${watch.tripType === 'roundtrip' ? 'Round-trip' : 'One-way'}`,
    '',
    watch.currentPrice != null ? `Current fare:  $${watch.currentPrice}` : 'Current fare:  unknown',
    `Your target:   $${watch.targetPrice}`,
    `Status:        ${status}`,
    '',
    buildLinks(watch)[0].url,
  ]

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n') }),
    })
    const data = await res.json()
    return data.ok ? { success: true } : { success: false, error: data.description ?? 'Telegram error' }
  } catch (err) {
    return { success: false, error: err?.message ?? 'Network error' }
  }
}

// ── WatchCard ─────────────────────────────────────────────────────────────────

function WatchCard({ watch: w, checking, onRemove, onLogPrice, onEdit }) {
  const [editingPrice,  setEditingPrice ] = useState(false)
  const [priceInput,    setPriceInput   ] = useState('')
  const [editMode,      setEditMode     ] = useState(false)
  const [editTarget,    setEditTarget   ] = useState('')
  const [editDepart,    setEditDepart   ] = useState('')
  const [editReturn,    setEditReturn   ] = useState('')
  const [tgState,       setTgState      ] = useState('idle') // 'idle'|'sending'|'sent'|'error'
  const [tgError,       setTgError      ] = useState(null)
  const dropped = w.triggered

  async function handleSendToTelegram() {
    setTgState('sending')
    setTgError(null)
    const result = await sendFlightToTelegram(w)
    if (result.success) {
      setTgState('sent')
      setTimeout(() => setTgState('idle'), 3000)
    } else {
      setTgState('error')
      setTgError(result.error ?? 'Failed to send')
      setTimeout(() => setTgState('idle'), 4000)
    }
  }

  function submitPrice() {
    const p = parseInt(priceInput, 10)
    if (p > 0) onLogPrice(p)
    setEditingPrice(false)
    setPriceInput('')
  }

  function openEdit() {
    setEditTarget(String(w.targetPrice))
    setEditDepart(w.departDate)
    setEditReturn(w.returnDate ?? '')
    setEditMode(true)
  }

  function saveEdit() {
    const t = parseInt(editTarget, 10)
    if (!t || t <= 0) return
    onEdit({
      targetPrice: t,
      departDate:  editDepart || w.departDate,
      returnDate:  w.returnDate != null ? (editReturn || null) : null,
    })
    setEditMode(false)
  }

  return (
    <div
      className="rounded-xl px-4 py-3 space-y-2"
      style={{
        background: dropped ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)',
        border:     dropped ? '1px solid rgba(52,211,153,0.22)' : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-white/85 leading-snug">
            {w.origin} → {w.dest}
          </p>
          <p className="text-[12px] text-white/40 font-mono mt-0.5">
            {shortDate(w.departDate)}
            {w.returnDate ? ` – ${shortDate(w.returnDate)}` : ''}
            {' · '}{w.tripType === 'roundtrip' ? 'Round-trip' : 'One-way'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <a
            href={buildLinks(w)[0].url}
            target="_blank"
            rel="noreferrer"
            className="w-6 h-6 flex items-center justify-center rounded opacity-30 hover:opacity-75 transition-opacity"
            title="Open Google Flights"
          >
            <ExternalLink size={12} className="text-white" />
          </a>

          {/* Telegram send button */}
          <button
            onClick={handleSendToTelegram}
            disabled={tgState === 'sending'}
            title={tgState === 'sent' ? 'Sent!' : tgState === 'error' ? tgError : 'Send to Telegram'}
            className="w-6 h-6 flex items-center justify-center rounded transition-all disabled:opacity-40"
            style={{
              color: tgState === 'sent'  ? 'rgba(52,211,153,0.80)' :
                     tgState === 'error' ? 'rgba(248,113,113,0.80)' :
                                          'rgba(255,255,255,0.30)',
              opacity: tgState === 'idle' ? undefined : 1,
            }}
          >
            {tgState === 'sending'
              ? <Loader2 size={12} className="animate-spin" />
              : <Send size={12} />}
          </button>

          <button
            onClick={openEdit}
            className="w-6 h-6 flex items-center justify-center rounded opacity-30 hover:opacity-75 transition-opacity text-white"
            title="Edit alert"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onRemove}
            className="w-6 h-6 flex items-center justify-center rounded opacity-30 hover:opacity-75 transition-opacity text-white"
            title="Remove alert"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Price row */}
      <div className="flex items-end gap-6">
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wide leading-none mb-1">Current</p>
          {editingPrice ? (
            <div className="flex items-center gap-0.5">
              <span className="text-[17px] font-mono text-white/40">$</span>
              <input
                type="number"
                min="1"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter')  submitPrice()
                  if (e.key === 'Escape') { setEditingPrice(false); setPriceInput('') }
                }}
                onBlur={() => { if (!priceInput) setEditingPrice(false); else submitPrice() }}
                className="w-16 bg-transparent border-b border-white/25 outline-none text-[20px] font-mono font-bold text-white/80"
                placeholder="0"
                autoFocus
              />
            </div>
          ) : (
            <button
              onClick={() => { setPriceInput(w.currentPrice != null ? String(w.currentPrice) : ''); setEditingPrice(true) }}
              className="group flex items-baseline gap-1 text-left"
              title="Log the price you saw"
            >
              <span
                className="text-[20px] font-mono font-bold leading-none"
                style={{ color: dropped ? 'rgba(52,211,153,0.9)' : 'rgba(255,255,255,0.75)' }}
              >
                {checking ? '…' : w.currentPrice != null ? `$${w.currentPrice}` : '—'}
              </span>
              {!checking && (
                <span className="text-[10px] text-white/25 opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
              )}
            </button>
          )}
        </div>
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wide leading-none mb-1">Target</p>
          <p className="text-[20px] font-mono text-white/45 leading-none">${w.targetPrice}</p>
        </div>
        {w.lowestSeen != null && w.lowestSeen !== w.currentPrice && (
          <div>
            <p className="text-[11px] text-white/30 uppercase tracking-wide leading-none mb-1">Lowest</p>
            <p className="text-[20px] font-mono text-white/45 leading-none">${w.lowestSeen}</p>
          </div>
        )}
        {dropped && (
          <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(52,211,153,0.15)', color: 'rgba(52,211,153,0.90)', border: '1px solid rgba(52,211,153,0.25)' }}>
            ↓ Dropped!
          </span>
        )}
      </div>

      {/* Telegram error */}
      {tgState === 'error' && tgError && (
        <p className="text-[10px] leading-snug px-0.5" style={{ color: 'rgba(248,113,113,0.80)' }}>
          {tgError}
        </p>
      )}

      {/* Inline edit form */}
      {editMode && (
        <div className="pt-2.5 border-t border-white/[0.06] space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-white/35 uppercase tracking-wide w-14 flex-shrink-0">Target</span>
            <div className="flex items-center gap-0.5">
              <span className="text-[13px] text-white/40 font-mono">$</span>
              <input
                type="number"
                min="1"
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditMode(false) }}
                className="w-20 bg-transparent border-b border-white/20 outline-none text-[14px] font-mono text-white/80"
                autoFocus
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-white/35 uppercase tracking-wide w-14 flex-shrink-0">Depart</span>
            <input
              type="date"
              value={editDepart}
              onChange={(e) => setEditDepart(e.target.value)}
              className="glass-input text-[12px]"
            />
          </div>
          {w.returnDate != null && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-white/35 uppercase tracking-wide w-14 flex-shrink-0">Return</span>
              <input
                type="date"
                value={editReturn}
                onChange={(e) => setEditReturn(e.target.value)}
                className="glass-input text-[12px]"
              />
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              onClick={saveEdit}
              className="text-[12px] font-medium text-teal-400/80 hover:text-teal-400 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="text-[12px] text-white/30 hover:text-white/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Last checked */}
      {!editMode && (
        <p className="text-[11px] text-white/25">
          {checking ? 'Checking prices…' : w.lastChecked ? `Checked ${timeAgo(w.lastChecked)}` : 'Not checked yet'}
        </p>
      )}
    </div>
  )
}

// ── FlightSearch ───────────────────────────────────────────────────────────────

export default function FlightSearch() {
  const [tripType,     setTripType    ] = useState('roundtrip')
  const [origin,       setOrigin      ] = useState('')
  const [dest,         setDest        ] = useState('')
  const [departDate,   setDepartDate  ] = useState(dateOffset(7))
  const [returnDate,   setReturnDate  ] = useState(dateOffset(14))
  const [links,        setLinks       ] = useState(null)
  const [price,        setPrice       ] = useState(null)
  const [priceLoading, setPriceLoading] = useState(false)

  // ── Saved routes ───────────────────────────────────────────────────────────
  const [savedRoutes, setSavedRoutes] = useState(() => getSavedRoutes())

  const isSaved = links
    ? savedRoutes.find(
        (r) => r.origin === origin.trim().toUpperCase() && r.dest === dest.trim().toUpperCase(),
      )
    : null

  function handleSaveRoute() {
    if (!origin.trim() || !dest.trim()) return
    const route = {
      id:       Math.random().toString(36).slice(2),
      origin:   origin.trim().toUpperCase(),
      dest:     dest.trim().toUpperCase(),
      tripType,
    }
    setSavedRoutes(saveRoute(route))
  }

  function handleUnsaveRoute() {
    if (!isSaved) return
    setSavedRoutes(deleteSavedRoute(isSaved.id))
  }

  function applyRoute(r) {
    setOrigin(r.origin)
    setDest(r.dest)
    setTripType(r.tripType ?? 'roundtrip')
  }

  // ── Price watches ──────────────────────────────────────────────────────────
  const [watches,     setWatches    ] = useState(() => getWatches())
  const [checkingIds, setCheckingIds] = useState(new Set())
  const [addingAlert, setAddingAlert] = useState(false)
  const [alertTarget, setAlertTarget] = useState('')

  // ── All alerts for the current search (may be multiple) ──────────────
  const currentWatches = links
    ? watches.filter((w) =>
        w.origin === origin.trim().toUpperCase() &&
        w.dest   === dest.trim().toUpperCase()   &&
        w.departDate === departDate)
    : []

  // ── Check all watch prices (reads fresh from localStorage) ────────────
  const checkAllWatches = useCallback(async () => {
    const current = getWatches()
    if (!current.length) return
    setCheckingIds(new Set(current.map((w) => w.id)))

    for (const w of current) {
      const newPrice = await fetchCheapestPrice({
        origin:     w.origin,
        dest:       w.dest,
        departDate: w.departDate,
        returnDate: w.returnDate ?? w.departDate,
        tripType:   w.tripType,
      })
      if (newPrice == null) {
        // Live API unavailable — re-evaluate any manually-logged price so that
        // "Check now" can still fire a notification the user is waiting for.
        if (w.currentPrice != null && w.currentPrice <= w.targetPrice && !w.triggered) {
          const updated = patchWatch(w.id, { triggered: true })
          setWatches([...updated])
          sendNotification(w, w.currentPrice)
        }
        setCheckingIds((ids) => { const n = new Set(ids); n.delete(w.id); return n })
        continue
      }

      const nowTriggered = newPrice <= w.targetPrice
      const updates = {
        currentPrice: newPrice,
        lowestSeen:   w.lowestSeen != null ? Math.min(w.lowestSeen, newPrice) : newPrice,
        lastChecked:  new Date().toISOString(),
        triggered:    nowTriggered,
      }
      const updated = patchWatch(w.id, updates)
      setWatches([...updated])

      // Notify if this is the first time hitting the target
      if (nowTriggered && !w.triggered) sendNotification(w, newPrice)

      setCheckingIds((ids) => { const n = new Set(ids); n.delete(w.id); return n })
    }
  }, [])

  // ── Edit watch fields ─────────────────────────────────────────────────────
  function editWatch(watchId, updates) {
    setWatches([...patchWatch(watchId, updates)])
  }

  // ── Manual price log (used when live API is unavailable) ─────────────────
  function logManualPrice(watchId, price) {
    const w = watches.find((ww) => ww.id === watchId)
    if (!w) return
    const nowTriggered = price <= w.targetPrice
    const updated = patchWatch(watchId, {
      currentPrice: price,
      lowestSeen:   w.lowestSeen != null ? Math.min(w.lowestSeen, price) : price,
      lastChecked:  new Date().toISOString(),
      triggered:    nowTriggered,
    })
    setWatches([...updated])
    if (nowTriggered && !w.triggered) sendNotification(w, price)
  }

  // ── Poll every 5 minutes while the app is open ─────────────────────────
  useEffect(() => {
    if (!watches.length) return

    // On mount: check if any watch is stale (> 10 min since last check)
    const isStale = watches.some((w) =>
      !w.lastChecked || Date.now() - new Date(w.lastChecked).getTime() > 10 * 60 * 1000,
    )
    if (isStale) checkAllWatches()

    const id = setInterval(checkAllWatches, 5 * 60 * 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watches.length])

  // ── Search ─────────────────────────────────────────────────────────────────
  function handleSearch(e) {
    e.preventDefault()
    if (!origin.trim() || !dest.trim()) return
    const params = { origin: origin.trim(), dest: dest.trim(), departDate, returnDate, tripType }
    setLinks(buildLinks(params))
    setPrice(null)
    setPriceLoading(true)
    setAddingAlert(false)
    fetchCheapestPrice(params).then((p) => { setPrice(p); setPriceLoading(false) })
  }

  // ── Add alert ──────────────────────────────────────────────────────────────
  function handleAddAlert() {
    const target = parseInt(alertTarget)
    if (!target || !origin.trim() || !dest.trim()) return
    const watch = {
      id:           Math.random().toString(36).slice(2),
      origin:       origin.trim().toUpperCase(),
      dest:         dest.trim().toUpperCase(),
      departDate,
      returnDate:   tripType === 'roundtrip' ? returnDate : null,
      tripType,
      targetPrice:  target,
      currentPrice: price ?? null,
      lowestSeen:   price ?? null,
      lastChecked:  price != null ? new Date().toISOString() : null,
      triggered:    price != null && price <= target,
    }
    setWatches(addWatch(watch))
    // Show spinner immediately on the new card — checkAllWatches will
    // fire via the stale-check effect, but add the ID now to prevent
    // the "—" flash on the first render.
    setCheckingIds((prev) => new Set([...prev, watch.id]))
    setAddingAlert(false)
    setAlertTarget('')
    requestNotifPermission()
  }

  const summary = links
    ? `${origin.toUpperCase()} → ${dest.toUpperCase()}  ·  ${shortDate(departDate)}${
        tripType === 'roundtrip' ? ` – ${shortDate(returnDate)}` : ''
      }`
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Search form card ─────────────────────────────────────────────── */}
      <div
        className="m-3 rounded-2xl flex-shrink-0"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <form onSubmit={handleSearch} className="p-3 space-y-2.5">
          {/* Trip type */}
          <div className="flex gap-1">
            {['oneway', 'roundtrip'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTripType(t)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                  tripType === t
                    ? 'border-teal-500/30 text-teal-400/80 bg-teal-500/10'
                    : 'border-white/[0.08] text-white/30 hover:text-white/50'
                }`}
              >
                {t === 'oneway' ? 'One-way' : 'Round-trip'}
              </button>
            ))}
          </div>

          {/* Route */}
          <div className="flex gap-1.5 items-center">
            <AirportInput value={origin} onChange={setOrigin} placeholder="From (e.g. JFK)" required />
            <ArrowLeftRight size={11} className="text-white/20 flex-shrink-0" />
            <AirportInput value={dest}   onChange={setDest}   placeholder="To (e.g. LHR)"   required />
          </div>

          {/* Dates */}
          <div className="flex gap-1.5">
            <div className="flex-1">
              <label className="text-[10px] text-white/25 block mb-0.5">Depart</label>
              <input type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)}
                className="glass-input w-full text-[11px]" required />
            </div>
            {tripType === 'roundtrip' && (
              <div className="flex-1">
                <label className="text-[10px] text-white/25 block mb-0.5">Return</label>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                  className="glass-input w-full text-[11px]" required />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!origin.trim() || !dest.trim()}
            className="btn btn-primary w-full text-[12px] flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Search size={13} />
            Find Flights
          </button>
        </form>
      </div>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0 space-y-4">

        {/* ── Saved routes — always visible ───────────────────────────── */}
        {savedRoutes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] text-white/25 uppercase tracking-wide font-medium px-0.5">
              Saved routes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {savedRoutes.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-0 rounded-lg overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <button
                    onClick={() => applyRoute(r)}
                    className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 text-[11px] text-white/55 hover:text-white/85 transition-colors"
                  >
                    <Plane size={9} className="text-teal-400/50" />
                    {r.origin} → {r.dest}
                  </button>
                  <button
                    onClick={() => setSavedRoutes(deleteSavedRoute(r.id))}
                    className="px-1.5 py-1.5 text-white/20 hover:text-rose-400/70 transition-colors"
                    title="Remove"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Search results ───────────────────────────────────────────── */}
        {links && (
          <div className="space-y-2">
            {/* Summary + save button */}
            <div className="flex items-center justify-between px-0.5">
              <p className="text-[10px] text-white/25 font-mono">{summary}</p>
              <button
                onClick={isSaved ? handleUnsaveRoute : handleSaveRoute}
                title={isSaved ? 'Remove saved route' : 'Save this route'}
                className="flex items-center gap-1 text-[10px] transition-colors"
                style={{ color: isSaved ? 'rgba(52,211,153,0.75)' : 'rgba(255,255,255,0.25)' }}
              >
                {isSaved
                  ? <><BookmarkCheck size={11} /> Saved</>
                  : <><Bookmark size={11} /> Save route</>}
              </button>
            </div>

            {links.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 transition-all group"
                style={{ background: link.bg, border: `1px solid ${link.border}` }}
              >
                <div className="flex items-center gap-2.5">
                  <Plane size={13} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: link.accent }} />
                  <div>
                    <p className="text-[13px] font-semibold text-white/80 leading-snug">{link.name}</p>
                    <p className="text-[9px] font-mono" style={{ color: link.accent, opacity: 0.7 }}>{link.hint}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {priceLoading
                    ? <Loader2 size={10} className="animate-spin text-white/20" />
                    : price != null
                      ? <span className="text-[12px] font-mono font-semibold tabular-nums"
                          style={{ color: link.accent }}>from ${price}</span>
                      : null}
                  <ExternalLink size={11} className="text-white/20 group-hover:text-white/50 transition-colors" />
                </div>
              </a>
            ))}

            {/* ── Price alerts ──────────────────────────────────────────── */}
            <div className="pt-1 space-y-1.5">
              {/* One row per existing alert for this route */}
              {currentWatches.map((w) => (
                <div key={w.id} className="flex items-center gap-1.5 px-0.5">
                  <Bell size={10} className="text-teal-400/50 flex-shrink-0" />
                  <span className="text-[10px] text-teal-400/60">
                    Alert below ${w.targetPrice}
                  </span>
                  <button
                    onClick={() => setWatches(removeWatch(w.id))}
                    className="ml-auto text-[9px] text-white/25 hover:text-rose-400/70 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}

              {/* Inline form when adding, otherwise the add button */}
              {addingAlert ? (
                <div className="flex items-center gap-1.5 rounded-xl px-3 py-2"
                  style={{ background: 'rgba(14,210,238,0.05)', border: '1px solid rgba(14,210,238,0.12)' }}>
                  <Bell size={10} className="text-teal-400/60 flex-shrink-0" />
                  <span className="text-[10px] text-white/40 flex-shrink-0">Alert below $</span>
                  <input
                    type="number"
                    min="1"
                    value={alertTarget}
                    onChange={(e) => setAlertTarget(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAlert()}
                    placeholder={price ? String(Math.max(1, price - 15)) : '300'}
                    className="glass-input text-[11px] font-mono w-16 px-1.5 py-0.5"
                    autoFocus
                  />
                  <button
                    onClick={handleAddAlert}
                    className="text-[10px] text-teal-400/80 hover:text-teal-400 transition-colors font-medium ml-0.5"
                  >
                    Set
                  </button>
                  <button
                    onClick={() => setAddingAlert(false)}
                    className="text-[10px] text-white/25 hover:text-white/55 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setAddingAlert(true)
                    setAlertTarget(price ? String(Math.max(1, price - 15)) : '')
                  }}
                  className="flex items-center gap-1.5 text-[10px] text-white/35 hover:text-teal-400/70 transition-colors px-0.5"
                >
                  <Bell size={10} />
                  {currentWatches.length > 0 ? 'Add another alert' : 'Alert me if price drops'}
                </button>
              )}
            </div>

            <p className="text-[9px] text-white/15 text-center pt-1 leading-relaxed">
              Opens booking site with route pre-filled · prices are estimates
            </p>
          </div>
        )}

        {/* Empty state — only when nothing at all to show */}
        {!links && savedRoutes.length === 0 && watches.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <Plane size={20} className="text-white/15" />
            <p className="text-[11px] text-white/25">Enter airports and a date to find flights.</p>
          </div>
        )}

        {/* ── Price alerts section ─────────────────────────────────────── */}
        {watches.length > 0 && (
          <div className="space-y-2">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bell size={12} className="text-white/35" />
                <span className="text-[12px] text-white/40 uppercase tracking-wide font-medium">
                  Price Alerts
                </span>
                <span
                  className="text-[11px] font-mono px-1.5 rounded-full"
                  style={{ background: 'rgba(14,210,238,0.10)', color: 'rgba(14,210,238,0.70)' }}
                >
                  {watches.length}
                </span>
              </div>
              <button
                onClick={checkAllWatches}
                disabled={checkingIds.size > 0}
                title="Check all prices now"
                className="flex items-center gap-1.5 text-[12px] text-white/35 hover:text-white/65 transition-colors disabled:opacity-40"
              >
                {checkingIds.size > 0
                  ? <Loader2 size={12} className="animate-spin" />
                  : <RefreshCw size={12} />}
                {checkingIds.size > 0 ? 'Checking…' : 'Check now'}
              </button>
            </div>

            {watches.map((w) => (
              <WatchCard
                key={w.id}
                watch={w}
                checking={checkingIds.has(w.id)}
                onRemove={() => setWatches(removeWatch(w.id))}
                onLogPrice={(price) => logManualPrice(w.id, price)}
                onEdit={(updates) => editWatch(w.id, updates)}
              />
            ))}

            <p className="text-[9px] text-white/15 text-center leading-relaxed">
              Checks every 5 min while this tab is open · browser notification on drop
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
