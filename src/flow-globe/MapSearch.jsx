import { useState } from 'react'
import { Navigation, Loader2, AlertCircle, Car, PersonStanding, TrainFront, ExternalLink } from 'lucide-react'

// ── Free routing stack (no API keys required) ─────────────────────────────────
//
//   Geocoding:  Nominatim (OpenStreetMap)       — nominatim.openstreetmap.org
//   Routing:    OSRM public demo server         — router.project-osrm.org
//
//   Both support CORS from the browser and require no authentication.

async function geocode(place) {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(place)}&format=json&limit=1`
  const r = await fetch(url, {
    headers: {
      'Accept-Language': 'en',
      'User-Agent': 'FlowMap/1.0 (personal research tool)',
    },
  })
  if (!r.ok) throw new Error(`Geocoding failed (HTTP ${r.status})`)
  const d = await r.json()
  if (!d.length) throw new Error(`Could not find "${place}"`)
  return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon), name: d[0].display_name }
}

// OSRM public demo supports driving and foot profiles
const OSRM_PROFILE = { driving: 'driving', walking: 'foot', transit: 'driving' }

async function route(startLng, startLat, endLng, endLat, mode) {
  const profile = OSRM_PROFILE[mode] ?? 'driving'
  const url =
    `https://router.project-osrm.org/route/v1/${profile}` +
    `/${startLng},${startLat};${endLng},${endLat}?overview=false`
  const r = await fetch(url, {
    headers: { 'User-Agent': 'FlowMap/1.0' },
  })
  if (!r.ok) throw new Error(`Routing failed (HTTP ${r.status})`)
  const d = await r.json()
  if (d.code !== 'Ok' || !d.routes?.length) throw new Error('No route found between those locations.')
  return d.routes[0]   // { duration (s), distance (m), legs[] }
}

function humanDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m} min`
}

function humanDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MapSearch({ addPins, addArcs, flyTo, onResult }) {
  const [origin,     setOrigin    ] = useState('')
  const [dest,       setDest      ] = useState('')
  const [mode,       setMode      ] = useState('driving')
  const [dirLoading, setDirLoading] = useState(false)
  const [dirResult,  setDirResult ] = useState(null)
  const [dirError,   setDirError  ] = useState(null)

  async function handleDirections(e) {
    e.preventDefault()
    if (!origin.trim() || !dest.trim()) return
    setDirLoading(true)
    setDirError(null)
    setDirResult(null)

    try {
      // Geocode both places in parallel
      const [startCoords, endCoords] = await Promise.all([
        geocode(origin.trim()),
        geocode(dest.trim()),
      ])

      // Fetch route
      const leg = await route(
        startCoords.lng, startCoords.lat,
        endCoords.lng,   endCoords.lat,
        mode,
      )

      const duration = humanDuration(leg.duration)
      const distance = humanDistance(leg.distance)

      setDirResult({ distance, duration, origin: origin.trim(), dest: dest.trim() })

      // Draw arc + pins on the globe
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
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="Origin (address or city)"
            className="glass-input w-full text-[12px]"
            required
          />
          <input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="Destination (address or city)"
            className="glass-input w-full text-[12px]"
            required
          />

          {/* Travel mode */}
          <div className="flex gap-1">
            {[
              { id: 'driving', icon: Car,             label: 'Driving' },
              { id: 'walking', icon: PersonStanding,  label: 'Walking' },
              { id: 'transit', icon: TrainFront,      label: 'Transit' },
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
