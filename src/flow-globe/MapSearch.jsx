import { useState, useRef, useEffect } from 'react'
import { Navigation, Loader2, AlertCircle, Car, PersonStanding, TrainFront, ExternalLink } from 'lucide-react'

// ── Free routing stack (no API keys required) ─────────────────────────────────
//   Geocoding:  Nominatim (OpenStreetMap)  — nominatim.openstreetmap.org
//   Routing:    OSRM public demo server    — router.project-osrm.org

async function geocode(place) {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(place)}&format=json&limit=1`
  const r = await fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'FlowMap/1.0' },
  })
  if (!r.ok) throw new Error(`Geocoding failed (HTTP ${r.status})`)
  const d = await r.json()
  if (!d.length) throw new Error(`Could not find "${place}"`)
  return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), name: d[0].display_name }
}

const OSRM_PROFILE = { driving: 'driving', walking: 'foot', transit: 'driving' }

async function route(startLng, startLat, endLng, endLat, mode) {
  const profile = OSRM_PROFILE[mode] ?? 'driving'
  const url =
    `https://router.project-osrm.org/route/v1/${profile}` +
    `/${startLng},${startLat};${endLng},${endLat}?overview=false`
  const r = await fetch(url, { headers: { 'User-Agent': 'FlowMap/1.0' } })
  if (!r.ok) throw new Error(`Routing failed (HTTP ${r.status})`)
  const d = await r.json()
  if (d.code !== 'Ok' || !d.routes?.length) throw new Error('No route found between those locations.')
  return d.routes[0]
}

function humanDuration(s) {
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m} min`
}

function humanDistance(m) {
  const miles = m * 0.000621371
  if (miles >= 0.1) return `${miles.toFixed(1)} mi`
  return `${Math.round(m * 3.28084)} ft`
}

// ── Nominatim autocomplete helpers ────────────────────────────────────────────

async function fetchSuggestions(q) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`
    const r = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'FlowMap/1.0' },
    })
    return r.ok ? r.json() : []
  } catch { return [] }
}

function primary(s) {
  const a = s.address ?? {}
  if (a.house_number && a.road) return `${a.house_number} ${a.road}`
  return (
    a.road || a.amenity || a.tourism || a.leisure ||
    a.city || a.town || a.village ||
    a.county || a.state ||
    s.display_name.split(',')[0]
  )
}

function secondary(s) {
  const a = s.address ?? {}
  const p = primary(s)
  const parts = []
  const city = a.city || a.town || a.village
  if (city && city !== p)   parts.push(city)
  if (a.state)              parts.push(a.state)
  if (a.country)            parts.push(a.country)
  return parts.join(', ')
}

function fullLabel(s) {
  const p = primary(s), sec = secondary(s)
  return sec ? `${p}, ${sec}` : p
}

// ── PlaceInput ─────────────────────────────────────────────────────────────────
// Text input with live Nominatim autocomplete dropdown.
// Uses position:fixed + getBoundingClientRect so the dropdown escapes every
// overflow:hidden ancestor without needing a portal.

function PlaceInput({ value, onChange, onSelect, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [open,        setOpen        ] = useState(false)
  const [hi,          setHi          ] = useState(-1)    // keyboard-highlighted index
  const [dropStyle,   setDropStyle   ] = useState({})
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  // When parent resets value to '' (e.g. after clearing the form), close dropdown
  useEffect(() => {
    if (!value) { setSuggestions([]); setOpen(false) }
  }, [value])

  // Position the dropdown directly below the input in viewport coordinates
  function positionDrop() {
    if (!inputRef.current) return
    const r = inputRef.current.getBoundingClientRect()
    setDropStyle({
      position: 'fixed',
      top:   Math.round(r.bottom + 3),
      left:  Math.round(r.left),
      width: Math.round(r.width),
      zIndex: 99999,
    })
  }

  function showDrop(list) {
    if (!list.length) { setOpen(false); return }
    positionDrop()
    setSuggestions(list)
    setOpen(true)
  }

  function handleChange(e) {
    const v = e.target.value
    onChange(v)
    setHi(-1)
    clearTimeout(timerRef.current)
    if (v.trim().length < 2) { setSuggestions([]); setOpen(false); return }
    timerRef.current = setTimeout(async () => {
      const list = await fetchSuggestions(v.trim())
      showDrop(list)
    }, 300)
  }

  function pick(s) {
    const label = fullLabel(s)
    onChange(label)
    onSelect?.({ lat: parseFloat(s.lat), lng: parseFloat(s.lon), name: label })
    setSuggestions([])
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setHi(h => Math.min(h + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); setHi(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && hi >= 0) {
      e.preventDefault(); pick(suggestions[hi])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && showDrop(suggestions)}
        // Delay close by 180 ms so onMouseDown on a suggestion fires first
        onBlur={() => { clearTimeout(timerRef.current); setTimeout(() => setOpen(false), 180) }}
        placeholder={placeholder}
        className="glass-input w-full text-[12px]"
        autoComplete="off"
        spellCheck="false"
      />

      {open && (
        <div
          style={{
            ...dropStyle,
            background: 'rgba(5,12,26,0.97)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(14,210,238,0.04)',
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={s.place_id}
              type="button"
              onMouseDown={() => pick(s)}
              onMouseEnter={() => setHi(i)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 11px',
                background: i === hi ? 'rgba(45,212,191,0.09)' : 'transparent',
                borderBottom: i < suggestions.length - 1
                  ? '1px solid rgba(255,255,255,0.045)'
                  : 'none',
                transition: 'background 100ms',
                cursor: 'pointer',
              }}
            >
              <div style={{
                fontSize: 11,
                fontWeight: 500,
                color: i === hi ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.68)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {primary(s)}
              </div>
              {secondary(s) && (
                <div style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.32)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginTop: 1,
                }}>
                  {secondary(s)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

// ── MapSearch component ───────────────────────────────────────────────────────

export default function MapSearch({ addPins, addArcs, flyTo, onResult }) {
  const [origin,       setOrigin      ] = useState('')
  const [originCoords, setOriginCoords] = useState(null) // pre-geocoded from autocomplete
  const [dest,         setDest        ] = useState('')
  const [destCoords,   setDestCoords  ] = useState(null)
  const [mode,         setMode        ] = useState('driving')
  const [dirLoading,   setDirLoading  ] = useState(false)
  const [dirResult,    setDirResult   ] = useState(null)
  const [dirError,     setDirError    ] = useState(null)

  async function handleDirections(e) {
    e.preventDefault()
    if (!origin.trim() || !dest.trim()) return
    setDirLoading(true)
    setDirError(null)
    setDirResult(null)

    try {
      // Use pre-geocoded coords when available (autocomplete selection),
      // otherwise fall back to a fresh Nominatim lookup.
      const [startCoords, endCoords] = await Promise.all([
        originCoords ?? geocode(origin.trim()),
        destCoords   ?? geocode(dest.trim()),
      ])

      const leg      = await route(startCoords.lng, startCoords.lat, endCoords.lng, endCoords.lat, mode)
      const duration = humanDuration(leg.duration)
      const distance = humanDistance(leg.distance)

      setDirResult({ distance, duration, origin: origin.trim(), dest: dest.trim() })

      addArcs?.([{
        startLat: startCoords.lat, startLng: startCoords.lng,
        endLat:   endCoords.lat,   endLng:   endCoords.lng,
        label: `${origin} → ${dest}`,
      }])
      addPins?.([
        { lat: startCoords.lat, lng: startCoords.lng, label: origin, color: 'rgba(14,210,238,0.9)' },
        { lat: endCoords.lat,   lng: endCoords.lng,   label: dest,   color: 'rgba(14,210,238,0.9)' },
      ])
      flyTo?.({
        lat: (startCoords.lat + endCoords.lat) / 2,
        lng: (startCoords.lng + endCoords.lng) / 2,
        altitude: 2.8,
      })
      onResult?.({ type: 'directions', origin, dest, distance, duration })

    } catch (err) {
      setDirError(err.message ?? 'Directions failed.')
    }
    setDirLoading(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Glass form card */}
      <div
        className="m-3 rounded-2xl flex-shrink-0"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <form onSubmit={handleDirections} className="p-3 space-y-2">

          <PlaceInput
            value={origin}
            onChange={(v) => { setOrigin(v); setOriginCoords(null) }}
            onSelect={(coords) => setOriginCoords(coords)}
            placeholder="Origin (address or city)"
          />

          <PlaceInput
            value={dest}
            onChange={(v) => { setDest(v); setDestCoords(null) }}
            onSelect={(coords) => setDestCoords(coords)}
            placeholder="Destination (address or city)"
          />

          {/* Travel mode */}
          <div className="flex gap-1">
            {[
              { id: 'driving', icon: Car,            label: 'Driving' },
              { id: 'walking', icon: PersonStanding, label: 'Walking' },
              { id: 'transit', icon: TrainFront,     label: 'Transit' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => setMode(id)}
                className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded transition-colors text-[10px] ${
                  mode === id
                    ? 'text-teal-400/80 bg-teal-500/12'
                    : 'text-white/30 hover:text-white/55'
                }`}
              >
                <Icon size={11} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={dirLoading || !origin.trim() || !dest.trim()}
            className="btn btn-primary w-full text-[12px] flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {dirLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <Navigation size={13} />}
            {dirLoading ? 'Getting directions…' : 'Get Directions'}
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {dirError && (
          <div className="flex items-start gap-2 text-[11px] text-rose-300/80 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2.5">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{dirError}</span>
          </div>
        )}

        {dirResult && !dirError && (
          <div className="space-y-2">
            {/* Stats strip */}
            <div
              className="rounded-xl border border-white/[0.07] px-3 py-2.5 flex items-center justify-between"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div className="flex gap-5">
                {dirResult.duration && (
                  <div>
                    <p className="text-[10px] text-white/25 uppercase tracking-wide">Duration</p>
                    <p className="text-[14px] text-white/70 font-semibold">{dirResult.duration}</p>
                  </div>
                )}
                {dirResult.distance && (
                  <div>
                    <p className="text-[10px] text-white/25 uppercase tracking-wide">Distance</p>
                    <p className="text-[14px] text-white/70 font-semibold">{dirResult.distance}</p>
                  </div>
                )}
              </div>
              <a
                href={`https://www.google.com/maps/dir/${encodeURIComponent(dirResult.origin)}/${encodeURIComponent(dirResult.dest)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[9px] text-teal-400/50 hover:text-teal-400/90 transition-colors flex-shrink-0"
              >
                <ExternalLink size={9} />
                Open
              </a>
            </div>

            {/* Google Maps embed */}
            <div
              className="rounded-xl overflow-hidden border border-white/[0.07]"
              style={{ height: 320 }}
            >
              <iframe
                key={`${dirResult.origin}|${dirResult.dest}`}
                title="Route map"
                width="100%"
                height="100%"
                style={{ border: 0, display: 'block' }}
                src={`https://maps.google.com/maps?saddr=${encodeURIComponent(dirResult.origin)}&daddr=${encodeURIComponent(dirResult.dest)}&output=embed`}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {mode === 'transit' && (
              <p className="text-[9px] text-white/20 italic px-0.5">
                Transit routing uses road estimate — real transit times vary.
              </p>
            )}
          </div>
        )}

        {!dirResult && !dirError && !dirLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <Navigation size={20} className="text-white/15" />
            <p className="text-[11px] text-white/25">
              Get directions to draw a route arc on the globe.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
