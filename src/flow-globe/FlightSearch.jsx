import { useState, useRef, useEffect, useCallback } from 'react'
import { Plane, ArrowLeftRight, ExternalLink, Search, Loader2, Bell, RefreshCw, Bookmark, BookmarkCheck, X } from 'lucide-react'
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
function kiwiDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ── Price fetching (Kiwi public API) ──────────────────────────────────────────

export async function fetchCheapestPrice({ origin, dest, departDate, returnDate, tripType }) {
  try {
    const params = new URLSearchParams({
      flyFrom:  origin.toUpperCase(),
      to:       dest.toUpperCase(),
      dateFrom: kiwiDate(departDate),
      dateTo:   kiwiDate(departDate),
      adults:   1,
      curr:     'USD',
      partner:  'skypicker',
      v:        3,
      limit:    3,
      sort:     'price',
      locale:   'en',
    })
    if (tripType === 'roundtrip') {
      params.set('returnFrom', kiwiDate(returnDate ?? departDate))
      params.set('returnTo',   kiwiDate(returnDate ?? departDate))
      params.set('typeFlight', 'round')
    }
    const r = await fetch(`/api/kiwi/flights?${params}`)
    if (!r.ok) return null
    const d = await r.json()
    const p = d.data?.[0]?.price
    return p ? Math.round(p) : null
  } catch {
    return null
  }
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

// ── WatchCard ─────────────────────────────────────────────────────────────────

function WatchCard({ watch: w, checking, onRemove, onOpen }) {
  const dropped = w.triggered
  return (
    <div
      className="rounded-xl px-3 py-2.5 space-y-1.5"
      style={{
        background: dropped ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)',
        border:     dropped ? '1px solid rgba(52,211,153,0.22)' : '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-white/75 leading-snug">
            {w.origin} → {w.dest}
          </p>
          <p className="text-[9px] text-white/30 font-mono">
            {shortDate(w.departDate)}
            {w.returnDate ? ` – ${shortDate(w.returnDate)}` : ''}
            {' · '}{w.tripType === 'roundtrip' ? 'Round-trip' : 'One-way'}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={buildLinks(w)[0].url}
            target="_blank"
            rel="noreferrer"
            className="w-5 h-5 flex items-center justify-center rounded opacity-30 hover:opacity-75 transition-opacity"
            title="Open Google Flights"
          >
            <ExternalLink size={9} className="text-white" />
          </a>
          <button
            onClick={onRemove}
            className="w-5 h-5 flex items-center justify-center rounded opacity-30 hover:opacity-75 transition-opacity text-white"
            title="Remove alert"
          >
            ×
          </button>
        </div>
      </div>

      {/* Price row */}
      <div className="flex items-end gap-4">
        <div>
          <p className="text-[9px] text-white/25 uppercase tracking-wide leading-none mb-0.5">Current</p>
          <p
            className="text-[15px] font-mono font-bold leading-none"
            style={{ color: dropped ? 'rgba(52,211,153,0.9)' : 'rgba(255,255,255,0.70)' }}
          >
            {checking ? '…' : w.currentPrice != null ? `$${w.currentPrice}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-white/25 uppercase tracking-wide leading-none mb-0.5">Target</p>
          <p className="text-[15px] font-mono text-white/40 leading-none">${w.targetPrice}</p>
        </div>
        {w.lowestSeen != null && w.lowestSeen !== w.currentPrice && (
          <div>
            <p className="text-[9px] text-white/25 uppercase tracking-wide leading-none mb-0.5">Lowest</p>
            <p className="text-[15px] font-mono text-white/40 leading-none">${w.lowestSeen}</p>
          </div>
        )}
        {dropped && (
          <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(52,211,153,0.15)', color: 'rgba(52,211,153,0.90)', border: '1px solid rgba(52,211,153,0.25)' }}>
            ↓ Dropped!
          </span>
        )}
      </div>

      {/* Last checked */}
      <p className="text-[9px] text-white/20">
        {checking ? 'Checking prices…' : w.lastChecked ? `Checked ${timeAgo(w.lastChecked)}` : 'Not checked yet'}
      </p>
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

  // ── Is the current search already being watched? ────────────────────────
  const isWatching = links
    ? watches.find((w) =>
        w.origin === origin.trim().toUpperCase() &&
        w.dest   === dest.trim().toUpperCase()   &&
        w.departDate === departDate)
    : null

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
      const nowTriggered = newPrice != null && newPrice <= w.targetPrice
      const updates = {
        currentPrice: newPrice,
        lowestSeen:   newPrice != null
          ? (w.lowestSeen != null ? Math.min(w.lowestSeen, newPrice) : newPrice)
          : w.lowestSeen,
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

        {/* Search results */}
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

            {/* ── Price alert row ───────────────────────────────────────── */}
            <div className="pt-1">
              {isWatching ? (
                <div className="flex items-center gap-1.5 px-0.5">
                  <Bell size={10} className="text-teal-400/50 flex-shrink-0" />
                  <span className="text-[10px] text-teal-400/60">
                    Alert set · target ${isWatching.targetPrice}
                  </span>
                  <button
                    onClick={() => setWatches(removeWatch(isWatching.id))}
                    className="ml-auto text-[9px] text-white/25 hover:text-rose-400/70 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : addingAlert ? (
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
                  Alert me if price drops
                </button>
              )}
            </div>

            <p className="text-[9px] text-white/15 text-center pt-1 leading-relaxed">
              Opens booking site with route pre-filled · prices are estimates
            </p>
          </div>
        )}

        {/* Empty state / saved routes */}
        {!links && (
          <div className="space-y-3">
            {savedRoutes.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[9px] text-white/25 uppercase tracking-wide font-medium px-0.5">
                  Saved routes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {savedRoutes.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-1 rounded-lg overflow-hidden"
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
            ) : watches.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                <Plane size={20} className="text-white/15" />
                <p className="text-[11px] text-white/25">Enter airports and a date to find flights.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Price alerts section ─────────────────────────────────────── */}
        {watches.length > 0 && (
          <div className="space-y-2">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bell size={10} className="text-white/30" />
                <span className="text-[10px] text-white/30 uppercase tracking-wide font-medium">
                  Price Alerts
                </span>
                <span
                  className="text-[9px] font-mono px-1 rounded-full"
                  style={{ background: 'rgba(14,210,238,0.10)', color: 'rgba(14,210,238,0.65)' }}
                >
                  {watches.length}
                </span>
              </div>
              <button
                onClick={checkAllWatches}
                disabled={checkingIds.size > 0}
                title="Check all prices now"
                className="flex items-center gap-1 text-[9px] text-white/25 hover:text-white/55 transition-colors disabled:opacity-40"
              >
                {checkingIds.size > 0
                  ? <Loader2 size={9} className="animate-spin" />
                  : <RefreshCw size={9} />}
                {checkingIds.size > 0 ? 'Checking…' : 'Check now'}
              </button>
            </div>

            {watches.map((w) => (
              <WatchCard
                key={w.id}
                watch={w}
                checking={checkingIds.has(w.id)}
                onRemove={() => setWatches(removeWatch(w.id))}
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
