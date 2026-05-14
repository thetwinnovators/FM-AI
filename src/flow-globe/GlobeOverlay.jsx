import { X, MapPin, Navigation, ExternalLink, Clock, Ruler, Loader2, BookOpen } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

// ── Local time from longitude (approximate) ───────────────────────────────────

/**
 * Returns an approximate local time string and UTC offset derived from
 * the location's longitude.  Accurate to ±30 min for most places.
 */
function approxLocalTime(lng) {
  if (lng == null) return null
  const offsetH  = Math.round(lng / 15)
  const offsetMs = offsetH * 3_600_000
  const local    = new Date(Date.now() + offsetMs)
  const hh       = String(local.getUTCHours()).padStart(2, '0')
  const mm       = String(local.getUTCMinutes()).padStart(2, '0')
  const sign     = offsetH >= 0 ? '+' : ''
  return { time: `${hh}:${mm}`, label: `UTC${sign}${offsetH}` }
}

// ── AI quick-facts hook ───────────────────────────────────────────────────────

/**
 * Calls Ollama directly (bypassing the shared OLLAMA_CONFIG.enabled flag so
 * the gear-menu toggle doesn't affect globe quick-facts).  Returns { loading, facts, aiError }.
 */
function useFacts(overlay) {
  const [loading, setLoading] = useState(false)
  const [facts,   setFacts  ] = useState(null)
  const [aiError, setAiError] = useState(false)

  useEffect(() => {
    if (!overlay || overlay.type !== 'location') { setFacts(null); return }

    setFacts(null)
    setAiError(false)
    setLoading(true)

    const ctrl = new AbortController()
    const name = overlay.address ?? `${overlay.lat?.toFixed(2)}, ${overlay.lng?.toFixed(2)}`

    const prompt =
      `You are a compact geography assistant. For the location "${name}" return ONLY ` +
      `a minified JSON object — no prose, no markdown, no extra keys.\n` +
      `Shape: {"pop":"e.g. 332 million","capital":"city or N/A","currency":"e.g. USD","flag":"emoji","note":"one short fact"}\n` +
      `If coordinates point to ocean or an uninhabited area, set all values to "—".`

    fetch('/api/ollama/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ model: 'llama3.2:3b', prompt, stream: false, options: { temperature: 0.1 } }),
      signal:  ctrl.signal,
    })
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        if (ctrl.signal.aborted) return
        const raw = json?.response
        if (!raw) { setAiError(true); setLoading(false); return }

        const match = raw.match(/\{[\s\S]*?\}/)
        if (!match) { setAiError(true); setLoading(false); return }
        try {
          setFacts(JSON.parse(match[0]))
        } catch {
          setAiError(true)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!ctrl.signal.aborted) { setAiError(true); setLoading(false) }
      })

    return () => ctrl.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay?.address, overlay?.lat])

  return { loading, facts, aiError }
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Compact floating info bar that appears over the top-left of the globe when a
 * location or directions result is available.  Styled to match the app's dark
 * semi-transparent top bar aesthetic.
 *
 * Props
 *   overlay  – null | { type:'location', lat, lng, address }
 *                    | { type:'directions', origin, dest, distance, duration, summary }
 *   onDismiss – called when the user closes the card
 */
export function GlobeOverlay({ overlay, onDismiss }) {
  const { loading, facts, aiError } = useFacts(overlay)
  const localTime = overlay?.type === 'location' ? approxLocalTime(overlay.lng) : null

  if (!overlay) return null

  const mapsHref =
    overlay.type === 'location'
      ? `https://maps.google.com/maps?q=${overlay.lat},${overlay.lng}`
      : `https://maps.google.com/maps?saddr=${encodeURIComponent(overlay.origin ?? '')}&daddr=${encodeURIComponent(overlay.dest ?? '')}`

  return (
    <div
      className="absolute top-4 left-4 z-20 pointer-events-auto"
      style={{
        width: 'min(290px, calc(100% - 32px))',
        background: 'rgba(4,10,22,0.82)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
      }}
    >

      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {overlay.type === 'location'
          ? <MapPin size={11} className="flex-shrink-0 text-teal-400/80" />
          : <Navigation size={11} className="flex-shrink-0 text-teal-400/80" />
        }

        <span
          className="flex-1 text-[11px] text-white/75 font-mono truncate leading-none"
          title={overlay.type === 'location' ? overlay.address : `${overlay.origin} → ${overlay.dest}`}
        >
          {facts?.flag ? `${facts.flag} ` : ''}
          {overlay.type === 'location'
            ? overlay.address
            : `${overlay.origin} → ${overlay.dest}`
          }
        </span>

        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="w-5 h-5 flex items-center justify-center rounded opacity-45 hover:opacity-90 transition-opacity"
            title="Open in Google Maps"
          >
            <ExternalLink size={10} className="text-white" />
          </a>
          <button
            onClick={onDismiss}
            className="w-5 h-5 flex items-center justify-center rounded opacity-35 hover:opacity-75 transition-opacity"
          >
            <X size={10} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="px-3 py-2.5">

        {overlay.type === 'location' && (
          <div className="space-y-2">

            {/* Coordinates row */}
            {overlay.lat != null && (
              <p className="text-[10px] text-white/30 font-mono leading-none">
                {Math.abs(overlay.lat).toFixed(4)}°{overlay.lat >= 0 ? 'N' : 'S'}
                {'  ·  '}
                {Math.abs(overlay.lng).toFixed(4)}°{overlay.lng >= 0 ? 'E' : 'W'}
              </p>
            )}

            {/* Local time — always shown, no AI needed */}
            {localTime && (
              <div className="flex items-center gap-1.5">
                <Clock size={9} className="text-teal-400/50 flex-shrink-0" />
                <span className="text-[10px] text-white/50 font-mono">
                  {localTime.time}
                  <span className="text-white/25 ml-1">local  ·  {localTime.label}</span>
                </span>
              </div>
            )}

            {/* AI facts */}
            {loading && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <Loader2 size={9} className="text-white/25 animate-spin flex-shrink-0" />
                <span className="text-[10px] text-white/25">Loading facts…</span>
              </div>
            )}

            {facts && !loading && (
              <div
                className="rounded-lg px-2.5 py-2 space-y-1.5 mt-0.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <FactRow icon="👥" label="Population" value={facts.pop} />
                <FactRow icon="🏛️" label="Capital"    value={facts.capital} />
                <FactRow icon="💱" label="Currency"   value={facts.currency} />
                {facts.note && facts.note !== '—' && (
                  <p className="text-[9px] text-white/25 leading-relaxed pt-0.5 border-t border-white/[0.05]">
                    {facts.note}
                  </p>
                )}
                <a
                  href={`https://en.wikipedia.org/wiki/${encodeURIComponent(overlay.address?.split(',')[0] ?? '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 mt-0.5 text-[9px] text-teal-400/50 hover:text-teal-400/90 transition-colors w-fit"
                >
                  <BookOpen size={9} />
                  Learn more
                </a>
              </div>
            )}

            {aiError && !loading && (
              <p className="text-[9px] text-white/20 italic">
                Flow AI unavailable — start Ollama to see facts.
              </p>
            )}
          </div>
        )}

        {overlay.type === 'directions' && (
          <div className="space-y-2">
            {overlay.summary && (
              <p className="text-[10px] text-white/30 font-mono leading-none">
                via {overlay.summary}
              </p>
            )}
            <div className="flex gap-4">
              {overlay.duration && (
                <div className="flex items-center gap-1.5">
                  <Clock size={9} className="text-teal-400/60 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-wide leading-none mb-0.5">
                      Duration
                    </p>
                    <p className="text-[12px] text-white/75 font-semibold leading-none">
                      {overlay.duration}
                    </p>
                  </div>
                </div>
              )}
              {overlay.distance && (
                <div className="flex items-center gap-1.5">
                  <Ruler size={9} className="text-teal-400/60 flex-shrink-0" />
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-wide leading-none mb-0.5">
                      Distance
                    </p>
                    <p className="text-[12px] text-white/75 font-semibold leading-none">
                      {overlay.distance}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Small helper ──────────────────────────────────────────────────────────────

function FactRow({ icon, label, value }) {
  if (!value || value === '—' || value === 'N/A') return null
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[10px] flex-shrink-0">{icon}</span>
      <span className="text-[9px] text-white/25 flex-shrink-0 w-14">{label}</span>
      <span className="text-[10px] text-white/65 font-mono truncate">{value}</span>
    </div>
  )
}
