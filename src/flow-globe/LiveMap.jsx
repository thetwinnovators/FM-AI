/**
 * LiveMap — Leaflet map that smoothly follows the globe camera via flyTo().
 * Fully interactive: users can also pan/zoom manually. Globe-driven updates
 * are paused for 4 s after any manual interaction so they don't fight each other.
 */
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// CartoDB Positron — clean light map, free, no API key required
const TILE_URL  = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

/** Convert globe latSpan (degrees visible) → Leaflet integer zoom level. */
export function latSpanToZoom(latSpan) {
  const z = Math.round(Math.log2(180 / Math.max(latSpan, 0.05)))
  return Math.max(3, Math.min(17, z))
}

export default function LiveMap({ lat, lng, zoom = 6 }) {
  const containerRef     = useRef(null)
  const mapRef           = useRef(null)
  const lastRef          = useRef({ lat: null, lng: null, zoom: null })
  // Prevent globe-camera updates from fighting manual map interaction
  const pausedRef        = useRef(false)
  const pauseTimerRef    = useRef(null)

  // ── Initialise map once on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center:             [lat, lng],
      zoom,
      zoomControl:        true,
      attributionControl: true,
    })

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      maxZoom:     19,
      subdomains:  'abcd',
    }).addTo(map)

    // Pause globe-driven flyTo for 4 s while the user interacts manually
    const pauseSync = () => {
      pausedRef.current = true
      clearTimeout(pauseTimerRef.current)
      pauseTimerRef.current = setTimeout(() => {
        pausedRef.current = false
      }, 4000)
    }
    map.on('dragstart', pauseSync)
    map.on('zoomstart', pauseSync)

    mapRef.current = map
    lastRef.current = { lat, lng, zoom }

    return () => {
      clearTimeout(pauseTimerRef.current)
      map.remove()
      mapRef.current = null
    }
  // Run once — lat/lng/zoom captured at init intentionally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Smooth fly-to whenever globe position changes ─────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || pausedRef.current) return

    const prev = lastRef.current
    if (
      Math.abs((prev.lat ?? 0) - lat) < 0.001 &&
      Math.abs((prev.lng ?? 0) - lng) < 0.001 &&
      prev.zoom === zoom
    ) return

    lastRef.current = { lat, lng, zoom }
    map.flyTo([lat, lng], zoom, {
      animate:       true,
      duration:      0.7,
      easeLinearity: 0.35,
    })
  }, [lat, lng, zoom])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      className="relative"
    />
  )
}
