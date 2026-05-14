import { useState, useRef, useEffect, useCallback } from 'react'
import { Plane, ArrowLeftRight, ExternalLink, Search, Loader2 } from 'lucide-react'
import { searchAirports } from './airportData.js'

// ── Date helpers ───────────────────────────────────────────────────────────────

function dateOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// YYMMDD for Skyscanner
function ssDate(iso) { return iso.replace(/-/g, '').slice(2) }

// Readable date for display  e.g. "May 14"
function shortDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// DD/MM/YYYY for Kiwi API
function kiwiDate(iso) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Price fetching (Kiwi public API, no auth required) ─────────────────────────

async function fetchCheapestPrice({ origin, dest, departDate, returnDate, tripType }) {
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
      params.set('returnFrom',  kiwiDate(returnDate))
      params.set('returnTo',    kiwiDate(returnDate))
      params.set('typeFlight',  'round')
    }
    const r = await fetch(`/api/kiwi/flights?${params}`)
    if (!r.ok) return null
    const d = await r.json()
    const price = d.data?.[0]?.price
    return price ? Math.round(price) : null
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
      url: `https://www.google.com/travel/flights?q=Flights+from+${org}+to+${dst}`,
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
    setQuery(airport.iata)
    onChange(airport.iata)
    setOpen(false)
    setActive(-1)
  }

  function handleChange(e) {
    const v = e.target.value.toUpperCase()
    setQuery(v)
    onChange(v)
    setOpen(true)
    setActive(-1)
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
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

// ── FlightSearch ───────────────────────────────────────────────────────────────

export default function FlightSearch() {
  const [tripType,      setTripType     ] = useState('roundtrip')   // default round-trip
  const [origin,        setOrigin       ] = useState('')
  const [dest,          setDest         ] = useState('')
  const [departDate,    setDepartDate   ] = useState(dateOffset(7))
  const [returnDate,    setReturnDate   ] = useState(dateOffset(14))
  const [links,         setLinks        ] = useState(null)
  const [price,         setPrice        ] = useState(null)   // number | null
  const [priceLoading,  setPriceLoading ] = useState(false)

  function handleSearch(e) {
    e.preventDefault()
    if (!origin.trim() || !dest.trim()) return
    const params = { origin: origin.trim(), dest: dest.trim(), departDate, returnDate, tripType }
    setLinks(buildLinks(params))
    setPrice(null)
    setPriceLoading(true)
    fetchCheapestPrice(params).then((p) => {
      setPrice(p)
      setPriceLoading(false)
    })
  }

  const summary = links
    ? `${origin.toUpperCase()} → ${dest.toUpperCase()}  ·  ${shortDate(departDate)}${
        tripType === 'roundtrip' ? ` – ${shortDate(returnDate)}` : ''
      }`
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Search card */}
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
              <input
                type="date"
                value={departDate}
                onChange={(e) => setDepartDate(e.target.value)}
                className="glass-input w-full text-[11px]"
                required
              />
            </div>
            {tripType === 'roundtrip' && (
              <div className="flex-1">
                <label className="text-[10px] text-white/25 block mb-0.5">Return</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="glass-input w-full text-[11px]"
                  required
                />
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

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {links ? (
          <div className="space-y-2">
            {/* Route summary */}
            <p className="text-[10px] text-white/25 font-mono px-0.5 mb-3">{summary}</p>

            {links.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 transition-all group"
                style={{
                  background: link.bg,
                  border: `1px solid ${link.border}`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Plane
                    size={13}
                    className="flex-shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: link.accent }}
                  />
                  <div>
                    <p className="text-[13px] font-semibold text-white/80 leading-snug">{link.name}</p>
                    <p className="text-[9px] font-mono" style={{ color: link.accent, opacity: 0.7 }}>{link.hint}</p>
                  </div>
                </div>

                {/* Price + external link */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {priceLoading ? (
                    <Loader2 size={10} className="animate-spin text-white/20" />
                  ) : price != null ? (
                    <span
                      className="text-[12px] font-mono font-semibold tabular-nums"
                      style={{ color: link.accent }}
                    >
                      from ${price}
                    </span>
                  ) : null}
                  <ExternalLink size={11} className="text-white/20 group-hover:text-white/50 flex-shrink-0 transition-colors" />
                </div>
              </a>
            ))}

            <p className="text-[9px] text-white/15 text-center pt-2 leading-relaxed">
              Opens booking site with route pre-filled · prices are estimates
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <Plane size={20} className="text-white/15" />
            <p className="text-[11px] text-white/25">
              Enter airports and a date to find flights.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
