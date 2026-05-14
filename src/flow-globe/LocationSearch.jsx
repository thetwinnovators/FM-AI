import { useState } from 'react'
import { MapPin, Search, Loader2, AlertCircle, Navigation } from 'lucide-react'

// ── Nominatim (OpenStreetMap) geocoding — no API key, CORS-safe ───────────────

async function nominatimSearch(query) {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`
  const r = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'FlowMap/1.0 (personal research tool)',
    },
  })
  if (!r.ok) throw new Error(`Geocoding failed (HTTP ${r.status})`)
  return r.json()
}

function formatType(item) {
  const cls  = item.class ?? ''
  const type = item.type  ?? ''
  if (cls === 'boundary' || type === 'administrative') return 'Region'
  if (type === 'city' || type === 'town' || type === 'village') return 'City'
  if (cls === 'aeroway') return 'Airport'
  if (cls === 'railway') return 'Station'
  if (cls === 'place') return type.charAt(0).toUpperCase() + type.slice(1)
  return type || cls || 'Place'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LocationSearch({ addPins, flyTo, onResult }) {
  const [query,   setQuery  ] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [error,   setError  ] = useState(null)

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults([])

    try {
      const data = await nominatimSearch(query)
      if (!data.length) {
        setError('No results found for that location.')
      } else {
        setResults(data.map((d) => ({
          lat:     parseFloat(d.lat),
          lng:     parseFloat(d.lon),
          address: d.display_name,
          short:   d.name ?? d.display_name.split(',')[0],
          kind:    formatType(d),
        })))
      }
    } catch (err) {
      setError(err.message ?? 'Search failed.')
    }
    setLoading(false)
  }

  function flyToResult(r) {
    addPins?.([{ lat: r.lat, lng: r.lng, label: r.short, color: 'rgba(14,210,238,0.9)' }])
    flyTo?.({ lat: r.lat, lng: r.lng, altitude: 1.5, label: r.short })
    onResult?.({ type: 'location', lat: r.lat, lng: r.lng, address: r.short })
  }

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
        <form onSubmit={handleSearch} className="flex gap-1.5 p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any place…"
            className="glass-input flex-1 text-[12px]"
            required
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400/80 hover:bg-teal-500/20 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            {loading
              ? <Loader2 size={13} className="animate-spin" />
              : <Search size={13} />}
          </button>
        </form>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0 space-y-1.5">
        {error && (
          <div className="flex items-start gap-2 text-[11px] text-rose-300/80 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2.5">
            <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {results.map((r, i) => (
          <button
            key={i}
            type="button"
            onClick={() => flyToResult(r)}
            className="w-full text-left rounded-xl border border-white/[0.06] px-3 py-2.5 flex items-start gap-2.5 transition-colors hover:border-teal-500/30 hover:bg-teal-500/5 group"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <MapPin size={12} className="text-teal-400/60 flex-shrink-0 mt-0.5 group-hover:text-teal-400" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white/75 font-medium truncate leading-snug">
                {r.short}
              </p>
              <p className="text-[10px] text-white/30 truncate leading-tight mt-0.5">
                {r.address}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-[9px] text-white/20 border border-white/[0.08] rounded px-1 py-0.5">
                {r.kind}
              </span>
              <Navigation size={9} className="text-white/15 group-hover:text-teal-400/60 transition-colors" />
            </div>
          </button>
        ))}

        {!results.length && !error && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <MapPin size={20} className="text-white/15" />
            <p className="text-[11px] text-white/25">
              Search any place to drop a pin and fly to it.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
