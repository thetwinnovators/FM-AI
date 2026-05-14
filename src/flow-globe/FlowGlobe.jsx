import { useEffect, useRef, useCallback } from 'react'
import Globe from 'react-globe.gl'

const NASA_TEXTURE = 'https://unpkg.com/three-globe/example/img/earth-dark.jpg'
const GRATICULE_COLOR = 'rgba(32,224,160,0.12)'
const AUTO_ROTATE_SPEED = 0.3
const IDLE_RESUME_MS = 10_000

export default function FlowGlobe({ pins = [], arcs = [], labels = [], viewpoint, onGlobeClick }) {
  const globeRef = useRef(null)
  const idleTimerRef = useRef(null)

  // Fly camera whenever viewpoint changes
  useEffect(() => {
    if (!viewpoint || !globeRef.current) return
    globeRef.current.pointOfView({ lat: viewpoint.lat, lng: viewpoint.lng, altitude: viewpoint.altitude ?? 1.8 }, 1200)
    // Pause auto-rotate while focused; resume after IDLE_RESUME_MS
    if (globeRef.current.controls) {
      globeRef.current.controls().autoRotate = false
    }
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (globeRef.current?.controls) {
        globeRef.current.controls().autoRotate = true
      }
    }, IDLE_RESUME_MS)
  }, [viewpoint])

  // Enable auto-rotate on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (globeRef.current?.controls) {
        const ctrl = globeRef.current.controls()
        ctrl.autoRotate = true
        ctrl.autoRotateSpeed = AUTO_ROTATE_SPEED
      }
    }, 500) // small delay — globe needs a moment to initialise controls
    return () => {
      clearTimeout(timer)
      clearTimeout(idleTimerRef.current)
    }
  }, [])

  const handleGlobeClick = useCallback((coords) => {
    if (onGlobeClick && coords) {
      onGlobeClick({ lat: coords.lat, lng: coords.lng })
    }
  }, [onGlobeClick])

  return (
    <div className="w-full h-full" style={{ background: '#05070f' }}>
      <Globe
        ref={globeRef}
        width={undefined}
        height={undefined}
        backgroundColor="#05070f"
        globeImageUrl={NASA_TEXTURE}
        showGraticules={true}
        showAtmosphere={true}
        atmosphereColor="rgba(32,224,160,0.15)"
        graticulesColor={GRATICULE_COLOR}
        onGlobeClick={handleGlobeClick}
        // Points (pins)
        pointsData={pins}
        pointLat="lat"
        pointLng="lng"
        pointLabel="label"
        pointColor={(d) => d.color === 'emerald' ? 'rgba(52,211,153,0.9)' : (d.color ?? 'rgba(52,211,153,0.9)')}
        pointAltitude={0.01}
        pointRadius={0.4}
        // Arcs
        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcLabel="label"
        arcColor={() => ['rgba(32,224,160,0.6)', 'rgba(32,224,160,0.1)']}
        arcAltitude={0.3}
        arcStroke={0.5}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={2000}
        // Labels
        labelsData={labels}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelSize={(d) => d.size ?? 1.2}
        labelColor={() => 'rgba(255,255,255,0.85)'}
        labelDotRadius={0.3}
        labelAltitude={0.01}
      />
    </div>
  )
}
