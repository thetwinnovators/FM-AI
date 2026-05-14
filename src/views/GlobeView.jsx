import { useState, useRef, useCallback, lazy, Suspense } from 'react'
import FlowGlobe from '../flow-globe/FlowGlobe.jsx'
import { GlobeOverlay } from '../flow-globe/GlobeOverlay.jsx'
import { useGlobeState } from '../flow-globe/useGlobeState.js'
import {
  Search, Plane, Navigation, Map, ExternalLink,
  GripVertical, PictureInPicture2, LayoutPanelLeft,
} from 'lucide-react'
import LiveMap, { latSpanToZoom } from '../flow-globe/LiveMap.jsx'

const LocationSearch = lazy(() => import('../flow-globe/LocationSearch.jsx'))
const FlightSearch   = lazy(() => import('../flow-globe/FlightSearch.jsx'))
const MapSearch      = lazy(() => import('../flow-globe/MapSearch.jsx'))

const TABS = [
  { id: 'search',     label: 'Search',  icon: Search     },
  { id: 'flights',    label: 'Flights', icon: Plane      },
  { id: 'directions', label: 'Route',   icon: Navigation },
  { id: 'map',        label: 'Map',     icon: Map        },
]


function PanelLoader() {
  return <div className="p-4 text-[12px] text-white/25">Loading…</div>
}

// Default floating size / position
const DEFAULT_FLOAT = { x: 60, y: 52, w: 620, h: 440 }

export default function GlobeView() {
  const { pins, arcs, labels, viewpoint, focusLabel, addPins, addArcs, flyTo } = useGlobeState()
  const [activeTab,  setActiveTab ] = useState('search')
  const [mapOverlay, setMapOverlay] = useState(null)
  const [mapView,    setMapView   ] = useState(null)   // { lat, lng, latSpan, lngSpan, name }

  // ── Panel width — persisted so the user's resize survives navigation ─────────
  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem('flowmap_panel_width') ?? '', 10)
    return isNaN(saved) ? 320 : Math.max(240, Math.min(700, saved))
  })

  // ── Floating state ──────────────────────────────────────────────────────────
  const [floating, setFloating] = useState(false)
  const [floatPos, setFloatPos] = useState({ x: DEFAULT_FLOAT.x, y: DEFAULT_FLOAT.y })
  const [floatW,   setFloatW  ] = useState(DEFAULT_FLOAT.w)
  const [floatH,   setFloatH  ] = useState(DEFAULT_FLOAT.h)

  const interactRef    = useRef(null) // { kind, startX, startY, ox, oy, ow, oh }
  const prevAltRef     = useRef(999)
  const mapDebounceRef = useRef(null)

  // ── Drag (move) ─────────────────────────────────────────────────────────────
  const onDragMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    interactRef.current = {
      kind:   'drag',
      startX: e.clientX,
      startY: e.clientY,
      ox:     floatPos.x,
      oy:     floatPos.y,
    }
    bindInteract()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floatPos])

  // ── Resize edges ────────────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((kind) => (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    interactRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      ox: floatPos.x,
      oy: floatPos.y,
      ow: floatW,
      oh: floatH,
    }
    bindInteract()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floatPos, floatW, floatH])

  // ── Docked panel resize (left edge) ─────────────────────────────────────────
  const onPanelResizeMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    interactRef.current = { kind: 'resize-panel', startX: e.clientX, ow: panelWidth }
    bindInteract()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelWidth])

  function bindInteract() {
    const onMove = (e) => {
      const r = interactRef.current
      if (!r) return
      const dx = e.clientX - r.startX
      const dy = e.clientY - r.startY
      if (r.kind === 'drag') {
        setFloatPos({ x: r.ox + dx, y: r.oy + dy })
      } else if (r.kind === 'resize-right') {
        setFloatW(Math.max(280, r.ow + dx))
      } else if (r.kind === 'resize-bottom') {
        setFloatH(Math.max(220, r.oh + dy))
      } else if (r.kind === 'resize-corner') {
        setFloatW(Math.max(280, r.ow + dx))
        setFloatH(Math.max(220, r.oh + dy))
      } else if (r.kind === 'resize-panel') {
        // Panel is anchored to the right — dragging LEFT widens it (dx < 0 → width grows)
        const next = Math.max(240, Math.min(700, r.ow - dx))
        setPanelWidth(next)
        localStorage.setItem('flowmap_panel_width', String(next))
      }
    }
    const onUp = () => {
      interactRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }

  function toggleFloat() {
    setFloating((f) => {
      if (!f) {
        // Reset to default position when popping out
        setFloatPos({ x: DEFAULT_FLOAT.x, y: DEFAULT_FLOAT.y })
        setFloatW(DEFAULT_FLOAT.w)
        setFloatH(DEFAULT_FLOAT.h)
      }
      return !f
    })
  }

  // ── Globe interactions ──────────────────────────────────────────────────────
  function handleGlobeClick() {
    // Ocean / empty-space click → dismiss any open overlay card (globe itself resets)
    setMapOverlay(null)
  }

  function handleLabelClick(label) {
    if (label.lat != null && label.lng != null) {
      flyTo({ lat: label.lat, lng: label.lng, altitude: 1.8, label: label.text })
      setMapOverlay({ type: 'location', lat: label.lat, lng: label.lng, address: label.text })
      // Zoom the Leaflet map to street level for this city
      setMapView({ lat: label.lat, lng: label.lng, latSpan: 0.25, lngSpan: 0.25, name: label.text })
      setActiveTab('map')
    }
  }

  // When the user manually scrolls in, the Map tab follows the camera.
  // Only auto-*switch* to the Map tab when the camera first crosses below the
  // country-zoom threshold (altitude ~0.9); after that just keep the map updated.
  const handleCameraChange = useCallback(({ lat, lng, altitude }) => {
    const wasAbove = prevAltRef.current > 0.9
    prevAltRef.current = altitude
    if (altitude >= 0.9) return
    clearTimeout(mapDebounceRef.current)
    mapDebounceRef.current = setTimeout(() => {
      const span = Math.max(2, altitude * 35)
      setMapView((prev) => ({ lat, lng, latSpan: span, lngSpan: span, name: prev?.name ?? '' }))
      if (wasAbove) setActiveTab('map')
    }, 600)
  }, [])

  function handleFeatureClick({ lat, lng, name, latSpan, lngSpan }) {
    setMapOverlay({ type: 'location', lat, lng, address: name })
    setMapView({ lat, lng, latSpan: latSpan ?? 20, lngSpan: lngSpan ?? 20, name })
    setActiveTab('map')
  }

  // ── Shared globe panel JSX ──────────────────────────────────────────────────
  const floatToggleBtn = (
    <button
      type="button"
      onClick={toggleFloat}
      onMouseDown={(e) => e.stopPropagation()}
      title={floating ? 'Dock back' : 'Float — drag anywhere on screen'}
      className="flex-shrink-0 opacity-30 hover:opacity-75 transition-opacity"
    >
      {floating
        ? <LayoutPanelLeft size={11} />
        : <PictureInPicture2 size={11} />}
    </button>
  )

  const globeContent = (
    <>
      {/* Focus header — drag handle when floating */}
      <div
        className={`
          flex-shrink-0 flex items-center gap-2 px-3 py-2 text-[12px] text-white/40 font-mono
          border-b border-white/[0.06] select-none
          ${floating ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
        style={{ background: 'rgba(0,0,0,0.35)' }}
        onMouseDown={floating ? onDragMouseDown : undefined}
      >
        {floating && (
          <GripVertical size={12} className="text-white/25 flex-shrink-0" />
        )}
        <span className="flex-1 truncate text-[11px]">
          {focusLabel || 'Globe — click a label or anywhere to explore'}
        </span>
        {floatToggleBtn}
      </div>

      {/* Globe canvas area */}
      <div className="flex-1 relative min-h-0 overflow-hidden">
        {/* Blurred colour haze */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse at 30% 62%, rgba(0,92,128,0.60) 0%, transparent 52%),
              radial-gradient(ellipse at 70% 92%, rgba(130,0,105,0.58) 0%, transparent 46%),
              rgba(2,9,20,0.94)
            `,
            filter: 'blur(88px)',
            transform: 'scale(1.18)',
          }}
        />
        <FlowGlobe
          pins={pins}
          arcs={arcs}
          labels={labels}
          viewpoint={viewpoint}
          onGlobeClick={handleGlobeClick}
          onLabelClick={handleLabelClick}
          onFeatureClick={handleFeatureClick}
          onCameraChange={handleCameraChange}
        />
        <GlobeOverlay overlay={mapOverlay} onDismiss={() => setMapOverlay(null)} />
      </div>
    </>
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 18% 78%, rgba(0,52,80,0.28) 0%, transparent 50%),
          radial-gradient(ellipse at 72% 92%, rgba(100,0,82,0.30) 0%, transparent 44%),
          radial-gradient(ellipse at 40% 96%, rgba(80,0,100,0.18) 0%, transparent 38%),
          #020b16
        `,
      }}
    >
      {/* ── Globe — full-screen background ───────────────────────────────────── */}
      {floating ? (
        /* Floating window — fixed-position, draggable, resizable */
        <div
          style={{
            position: 'fixed',
            left:     floatPos.x,
            top:      floatPos.y,
            width:    floatW,
            height:   floatH,
            zIndex:   9998,
            display:  'flex',
            flexDirection: 'column',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.13)',
            boxShadow: '0 28px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(14,210,238,0.06)',
          }}
        >
          {globeContent}

          {/* Resize — right edge */}
          <div
            className="absolute right-0 top-8 bottom-3 w-1.5 cursor-ew-resize"
            onMouseDown={onResizeMouseDown('resize-right')}
          />
          {/* Resize — bottom edge */}
          <div
            className="absolute bottom-0 left-3 right-3 h-1.5 cursor-ns-resize"
            onMouseDown={onResizeMouseDown('resize-bottom')}
          />
          {/* Resize — bottom-right corner */}
          <div
            className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize"
            onMouseDown={onResizeMouseDown('resize-corner')}
            style={{
              background: 'linear-gradient(135deg, transparent 50%, rgba(14,210,238,0.25) 50%)',
              borderBottomRightRadius: '12px',
            }}
          />
        </div>
      ) : (
        /* Docked — globe fills only the visible area left of the side panel */
        <div className="absolute inset-0 flex flex-col" style={{ right: panelWidth }}>
          {globeContent}
        </div>
      )}

      {/* ── Side panel — glass overlay pinned to the right ───────────────────── */}
      <div
        className="absolute top-0 right-0 bottom-0 flex flex-col"
        style={{
          width: floating ? '100%' : panelWidth,
          background: 'rgba(3,8,20,0.48)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          zIndex: 10,
        }}
      >
        {/* Resize handle — left edge, only in docked mode */}
        {!floating && (
          <div
            className="absolute top-0 bottom-0 z-20 flex items-center justify-center group"
            style={{ left: -5, width: 10, cursor: 'ew-resize' }}
            onMouseDown={onPanelResizeMouseDown}
          >
            {/* Pill indicator — grows and lights up on hover */}
            <div className="h-8 w-0.5 rounded-full bg-white/10 transition-all duration-150 group-hover:h-14 group-hover:w-[3px] group-hover:bg-teal-400/50" />
          </div>
        )}
        {/* Tab switcher */}
        <div className="flex border-b border-white/[0.07] flex-shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors border-b-2 ${
                activeTab === id
                  ? 'text-teal-400 border-teal-500/60'
                  : 'text-white/30 hover:text-white/60 border-transparent'
              }`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {activeTab === 'search' && (
            <Suspense fallback={<PanelLoader />}>
              <LocationSearch addPins={addPins} flyTo={flyTo} onResult={setMapOverlay} />
            </Suspense>
          )}
          {activeTab === 'flights' && (
            <Suspense fallback={<PanelLoader />}>
              <FlightSearch />
            </Suspense>
          )}
          {activeTab === 'directions' && (
            <Suspense fallback={<PanelLoader />}>
              <MapSearch addPins={addPins} addArcs={addArcs} flyTo={flyTo} onResult={setMapOverlay} />
            </Suspense>
          )}
          {activeTab === 'map' && (
            <div className="flex flex-col h-full overflow-hidden">
              {mapView ? (
                <>
                  {/* Name + external link header */}
                  <div
                    className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <Map size={10} className="text-teal-400/60 flex-shrink-0" />
                    <span className="flex-1 text-[11px] text-white/55 truncate">{mapView.name || 'Current view'}</span>
                    <a
                      href={`https://www.openstreetmap.org/#map=${latSpanToZoom(mapView.latSpan ?? 20)}/${mapView.lat.toFixed(3)}/${mapView.lng.toFixed(3)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[9px] text-teal-400/45 hover:text-teal-400/85 transition-colors flex-shrink-0"
                    >
                      <ExternalLink size={9} />
                      Full map
                    </a>
                  </div>
                  {/* Live Leaflet map — no iframe reload, smooth flyTo transitions */}
                  <div className="flex-1 relative min-h-0">
                    <LiveMap
                      lat={mapView.lat}
                      lng={mapView.lng}
                      zoom={latSpanToZoom(mapView.latSpan ?? 20)}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                  <Map size={20} className="text-white/15" />
                  <p className="text-[11px] text-white/25 leading-relaxed">
                    Click a country or region on the globe to load its street map.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
