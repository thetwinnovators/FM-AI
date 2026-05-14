/**
 * LiveMap — Leaflet-powered map that smoothly fly-animates to new positions
 * instead of reloading an iframe, which eliminates the flicker/blink when the
 * globe camera moves.
 *
 * Props:
 *   lat, lng   – centre coordinates
 *   zoom       – integer Leaflet zoom level (2-18)
 *   name       – optional place name (shown in attribution / title)
 */
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// CartoDB Positron — clean light map, free, no API key required
const TILE_URL  = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Derive a Leaflet zoom from globe altitude + latSpan.
// latSpan = altitude * 35 (from GlobeView's camera handler)
export function latSpanToZoom(latSpan) {
  // log2(180/span) gives a rough zoom; clamp to [3, 17]
  const z = Math.round(Math.log2(180 / Math.max(latSpan, 0.05)))
  return Math.max(3, Math.min(17, z))
}

export default function LiveMap({ lat, lng, zoom = 6 }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  // Track the last animated-to position to skip no-op updates
  const lastRef      = useRef({ lat: null, lng: null, zoom: null })

  // ── Initialise map once on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center:             [lat, lng],
      zoom,
      zoomControl:        false,
      attributionControl: true,
      // Disable all interaction — the globe is the controller
      dragging:           false,
      touchZoom:          false,
      scrollWheelZoom:    false,
      doubleClickZoom:    false,
      boxZoom:            false,
      keyboard:           false,
    })

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      maxZoom:     19,
      subdomains:  'abcd',
    }).addTo(map)

    mapRef.current = map
    lastRef.current = { lat, lng, zoom }

    return () => {
      map.remove()
      mapRef.current = null
    }
  // Run once; lat/lng/zoom at init captured intentionally
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Smooth fly-to whenever position changes ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const prev = lastRef.current
    // Skip if nothing meaningful changed (avoids micro-jitter from float rounding)
    if (
      Math.abs((prev.lat ?? 0) - lat) < 0.001 &&
      Math.abs((prev.lng ?? 0) - lng) < 0.001 &&
      prev.zoom === zoom
    ) return

    lastRef.current = { lat, lng, zoom }

    map.flyTo([lat, lng], zoom, {
      animate:  true,
      duration: 0.7,   // seconds — matches the globe's 600 ms camera debounce
      easeLinearity: 0.35,
    })
  }, [lat, lng, zoom])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      // Leaflet injects its own styles; make sure parent is positioned
      className="relative"
    />
  )
}
