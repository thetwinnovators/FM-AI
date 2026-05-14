/**
 * BottomBar — fixed status strip pinned to the bottom of the screen.
 *
 * Left:   Your current location · weather icon + temp + condition · wind · humidity
 * Middle: Selected location (when provided) · weather · local time there
 * Right:  Your local clock (HH:MM:SS)
 *
 * Data sources (all free, no API keys):
 *   Location:    navigator.geolocation (browser)
 *   Weather:     Open-Meteo
 *   Reverse geo: Nominatim
 */
import { useState, useEffect } from 'react'
import { MapPin, Wind, Droplets, Clock } from 'lucide-react'
import { fetchWeather, reverseGeocode } from './weatherService.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function fmtLocal(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })
}

/** Return HH:MM in the given IANA timezone, or null if unsupported. */
function localTimeAt(timezone) {
  if (!timezone) return null
  try {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
    })
  } catch { return null }
}

// Thin vertical divider
const Sep = () => (
  <span
    aria-hidden
    style={{
      display: 'inline-block',
      width: 1,
      height: 14,
      background: 'rgba(255,255,255,0.10)',
      margin: '0 10px',
      flexShrink: 0,
      alignSelf: 'center',
    }}
  />
)

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * @param {{ name: string, lat: number, lng: number } | null} selectedLoc
 * @param {{ icon, temp, condition, windKmh, humidity, timezone, tzAbbr } | null} selectedWeather
 */
export default function BottomBar({ selectedLoc = null, selectedWeather = null }) {
  const [myCity,    setMyCity   ] = useState(null)
  const [myWeather, setMyWeather] = useState(null)
  const [status,    setStatus   ] = useState('locating') // 'locating' | 'ready' | 'error'
  const now = useClock()

  // ── Geolocate + weather on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const [city, weather] = await Promise.all([
            reverseGeocode(coords.latitude, coords.longitude),
            fetchWeather(coords.latitude, coords.longitude),
          ])
          setMyCity(city)
          setMyWeather(weather)
          setStatus('ready')
        } catch {
          setStatus('error')
        }
      },
      () => setStatus('error'),
      { timeout: 12_000 },
    )
  }, [])

  const selLocalTime = selectedWeather?.timezone
    ? localTimeAt(selectedWeather.timezone)
    : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        flexShrink: 0,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 14,
        background: 'rgba(2,5,14,0.90)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        fontSize: 11,
        color: 'rgba(255,255,255,0.40)',
        letterSpacing: '0.015em',
        userSelect: 'none',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        zIndex: 50,
      }}
    >
      {/* ── My location + weather ─────────────────────────────────────────── */}
      <MapPin size={10} style={{ color: 'rgba(45,212,191,0.55)', flexShrink: 0, marginRight: 6 }} />

      {status === 'locating' && (
        <span style={{ color: 'rgba(255,255,255,0.22)', fontStyle: 'italic' }}>Locating…</span>
      )}

      {status === 'error' && (
        <span style={{ color: 'rgba(255,255,255,0.18)', fontStyle: 'italic' }}>Location unavailable</span>
      )}

      {status === 'ready' && myWeather && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'rgba(255,255,255,0.65)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {myCity}
          </span>
          <Sep />
          <span style={{ fontSize: 13, lineHeight: 1 }}>{myWeather.icon}</span>
          <span style={{ color: 'rgba(255,255,255,0.70)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {myWeather.temp}°C
          </span>
          <span style={{ color: 'rgba(255,255,255,0.38)' }}>{myWeather.condition}</span>
          <Sep />
          <Wind size={9} style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.36)', fontVariantNumeric: 'tabular-nums' }}>
            {myWeather.windKmh} km/h
          </span>
          <Droplets size={9} style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.36)', fontVariantNumeric: 'tabular-nums' }}>
            {myWeather.humidity}%
          </span>
        </span>
      )}

      {/* ── Selected location weather ────────────────────────────────────── */}
      {selectedLoc && selectedWeather && (
        <>
          <Sep />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>Viewing</span>
            <span style={{ color: 'rgba(255,255,255,0.60)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedLoc.name}
            </span>
            <Sep />
            <span style={{ fontSize: 13, lineHeight: 1 }}>{selectedWeather.icon}</span>
            <span style={{ color: 'rgba(255,255,255,0.70)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {selectedWeather.temp}°C
            </span>
            <span style={{ color: 'rgba(255,255,255,0.38)' }}>{selectedWeather.condition}</span>
            {selLocalTime && (
              <>
                <Sep />
                <Clock size={9} style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>
                  {selLocalTime}
                </span>
                {selectedWeather.tzAbbr && (
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
                    {selectedWeather.tzAbbr}
                  </span>
                )}
              </>
            )}
          </span>
        </>
      )}

      {/* ── Spacer ──────────────────────────────────────────────────────── */}
      <span style={{ flex: 1 }} />

      {/* ── Local clock ─────────────────────────────────────────────────── */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <Clock size={9} style={{ color: 'rgba(255,255,255,0.28)' }} />
        <span style={{ color: 'rgba(255,255,255,0.62)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
          {fmtLocal(now)}
        </span>
      </span>
    </div>
  )
}
