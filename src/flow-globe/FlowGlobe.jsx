import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'
import { GEO_LABELS } from './geoLabels.js'

const EARTH_DAY       = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
const EARTH_NIGHT     = 'https://unpkg.com/three-globe/example/img/earth-night.jpg'
const GRATICULE_COLOR = 'rgba(14,210,238,0.22)'
const AUTO_ROTATE_SPEED = 0.3
const IDLE_RESUME_MS    = 10_000

// ── Sun position helpers ──────────────────────────────────────────────────────

function getSunPosition() {
  const now      = new Date()
  const utcH     = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const N        = Math.ceil((now - yearStart) / 86_400_000)
  const lat      = 23.45 * Math.sin((2 * Math.PI / 365) * (N - 81))
  let   lng      = (12 - utcH) * 15
  if (lng >  180) lng -= 360
  if (lng < -180) lng += 360
  return { lat, lng }
}

function geoToVec3(lat, lng) {
  const φ = (lat * Math.PI) / 180
  const λ = (lng * Math.PI) / 180
  return new THREE.Vector3(
    Math.cos(φ) * Math.sin(λ),
    Math.sin(φ),
    Math.cos(φ) * Math.cos(λ),
  )
}

// ── Hierarchical zoom helpers ─────────────────────────────────────────────────

// Module-level cache — survives component remounts, loaded once per session.
let _statesData    = null
let _statesPromise = null

async function fetchAllStates() {
  if (_statesData)    return _statesData
  if (_statesPromise) return _statesPromise
  _statesPromise = fetch(
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson',
  )
    .then((r) => r.json())
    .then((d) => { _statesData = d.features ?? []; return _statesData })
    .catch(() => [])
  return _statesPromise
}

// Module-level cache for populated places (cities)
let _placesData    = null
let _placesPromise = null

async function fetchPlaces() {
  if (_placesData)    return _placesData
  if (_placesPromise) return _placesPromise
  _placesPromise = fetch(
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson',
  )
    .then((r) => r.json())
    .then((d) => { _placesData = d.features ?? []; return _placesData })
    .catch(() => [])
  return _placesPromise
}

/** Returns the bounding-box centre + spans for a GeoJSON geometry. */
function getBBoxCenter(geometry) {
  const pts = []
  const collect = (arr, depth) =>
    depth === 0 ? pts.push(arr) : arr.forEach((c) => collect(c, depth - 1))
  if (geometry.type === 'Polygon')      collect(geometry.coordinates, 2)
  if (geometry.type === 'MultiPolygon') collect(geometry.coordinates, 3)
  if (!pts.length) return { lat: 0, lng: 0, latSpan: 10, lngSpan: 10 }

  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180
  for (const [lng, lat] of pts) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  return {
    lat:     (minLat + maxLat) / 2,
    lng:     (minLng + maxLng) / 2,
    latSpan: maxLat - minLat,
    lngSpan: maxLng - minLng,
  }
}

/** Derive a sensible altitude from how many degrees the feature spans. */
function spanToAlt(latSpan, lngSpan) {
  return Math.min(2.4, Math.max(0.18, Math.max(latSpan, lngSpan) / 55))
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FlowGlobe({
  pins = [], arcs = [], labels = [], viewpoint,
  onGlobeClick, onLabelClick, onFeatureClick, onCameraChange,
}) {
  const globeRef        = useRef(null)
  const idleTimerRef    = useRef(null)
  const sunLightRef     = useRef(null)
  const sunTimerRef     = useRef(null)
  const ctrlCleanupRef  = useRef(null)
  const skipGlobeClick  = useRef(false)   // prevent polygon click → globe click double-fire

  // ── Countries (always loaded) ─────────────────────────────────────────────
  const [countries, setCountries] = useState([])
  useEffect(() => {
    fetch(
      'https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson',
    )
      .then((r) => r.json())
      .then((d) => setCountries(d.features ?? []))
      .catch(() => {})
  }, [])

  // ── Hierarchical zoom state ───────────────────────────────────────────────
  // viewMode: 'globe' → show countries  |  'region' → show states/provinces
  const [viewMode,       setViewMode      ] = useState('globe')
  const [statePolygons,  setStatePolygons ] = useState([])
  const [hoveredPolygon, setHoveredPolygon] = useState(null)
  const [loadingPoly,    setLoadingPoly   ] = useState(null)   // tinted while states load
  const allCityFeats  = useRef([])          // full sorted list, set on country click
  const [cityLabels,  setCityLabels    ] = useState([])
  const [currentAlt,  setCurrentAlt    ] = useState(2.5)

  const activePolygons = viewMode === 'globe' ? countries : statePolygons

  // Auto-reset to globe view when user scrolls back out to altitude > 2.5.
  // Also tracks currentAlt so city-count can be capped at each zoom level.
  useEffect(() => {
    const id = setInterval(() => {
      if (!globeRef.current) return
      const { altitude } = globeRef.current.pointOfView()
      setCurrentAlt(altitude)

      if (viewMode !== 'globe' && altitude > 2.5) {
        setViewMode('globe')
        setStatePolygons([])
        setHoveredPolygon(null)
        allCityFeats.current = []
        setCityLabels([])
      } else if (allCityFeats.current.length) {
        // Recompute visible city count based on zoom
        const count =
          altitude > 1.2 ? 12 :
          altitude > 0.8 ? 25 :
          altitude > 0.5 ? 50 : 100
        const next = allCityFeats.current.slice(0, count)
        setCityLabels((prev) =>
          prev.length === next.length ? prev : next,
        )
      }
    }, 600)
    return () => clearInterval(id)
  }, [viewMode])

  // ── Polygon click — country → states → cities ─────────────────────────────
  const handlePolygonClick = useCallback(async (polygon) => {
    // Block the globe-surface click that sometimes fires simultaneously
    skipGlobeClick.current = true
    setTimeout(() => { skipGlobeClick.current = false }, 80)

    const { lat, lng, latSpan, lngSpan } = getBBoxCenter(polygon.geometry)
    const altitude = spanToAlt(latSpan, lngSpan)

    // Fly to the feature
    globeRef.current?.pointOfView({ lat, lng, altitude }, 1200)
    if (globeRef.current?.controls) globeRef.current.controls().autoRotate = false
    clearTimeout(idleTimerRef.current)

    if (viewMode === 'globe') {
      // ── Country clicked → load its states / provinces + city labels ────
      const name  = polygon.properties.ADMIN ?? polygon.properties.NAME ?? ''
      onFeatureClick?.({ lat, lng, latSpan, lngSpan, name })
      setLoadingPoly(polygon)

      const iso   = polygon.properties.ISO_A2
      const isoA3 = polygon.properties.ISO_A3
      const admin = polygon.properties.ADMIN ?? polygon.properties.NAME ?? ''

      const [all, places] = await Promise.all([fetchAllStates(), fetchPlaces()])

      const filtered = all.filter((f) =>
        (iso && iso !== '-99' && f.properties.iso_a2 === iso) ||
        f.properties.admin === admin,
      )
      setStatePolygons(filtered)
      setViewMode('region')
      setLoadingPoly(null)

      // City / town labels — store full sorted list in ref; the polling interval
      // slices it to the right count for the current altitude.
      const mapped = places
        .filter((p) => isoA3 && isoA3 !== '-99'
          ? p.properties.adm0_a3 === isoA3
          : p.properties.adm0_name === admin)
        .sort((a, b) => (b.properties.pop_max ?? 0) - (a.properties.pop_max ?? 0))
        .slice(0, 100)
        .map((p) => {
          const isCapital = p.properties.featurecla?.includes('capital') ?? false
          return {
            lat:       p.geometry.coordinates[1],
            lng:       p.geometry.coordinates[0],
            text:      p.properties.name ?? '',
            isCity:    true,
            isCapital,
            size:      isCapital ? 0.44 : 0.30,
            color:     isCapital ? 'rgba(255,210,80,0.92)' : 'rgba(210,228,255,0.72)',
            dotRadius: isCapital ? 0.055 : 0.038,
          }
        })
      allCityFeats.current = mapped
      // Show an initial slice appropriate for the landing altitude
      const initCount =
        altitude > 1.2 ? 12 :
        altitude > 0.8 ? 25 :
        altitude > 0.5 ? 50 : 100
      setCityLabels(mapped.slice(0, initCount))

    } else {
      // ── State / province clicked → zoom in further ────────────────────
      const name = polygon.properties.name_en ?? polygon.properties.name ?? ''
      onFeatureClick?.({ lat, lng, latSpan, lngSpan, name })
    }
  }, [viewMode, onFeatureClick])

  // All labels: static geo labels + AI-placed + city labels (city labels have isCity flag)
  const allLabels = useMemo(
    () => [...GEO_LABELS, ...labels, ...cityLabels],
    [labels, cityLabels],
  )

  // ── Globe surface material ────────────────────────────────────────────────
  // Navy sphere with translucent ocean — the night texture drives the
  // Ocean is 50 % transparent — the blue-marble texture drives the water
  // mask (blue channel > red = ocean) while the sphere colour stays navy.
  // Three.js renders the back-hemisphere graticule lines through the
  // transparent ocean, giving a "far-side wires show through blurry" look.
  const globeMaterial = useMemo(() => {
    const mat = new THREE.MeshPhongMaterial({
      color:       new THREE.Color(0x0a1628),
      emissive:    new THREE.Color(0x000000),
      shininess:   4,
      transparent: true,
      side:        THREE.FrontSide,
    })

    // Replace map_fragment so the texture is used ONLY as a water mask —
    // it never changes the surface colour (stays navy throughout).
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
           vec4  _bm    = texture2D(map, vMapUv);
           // Blue channel dominates over red in ocean pixels of the blue marble
           float _water = smoothstep(0.04, 0.22, _bm.b - _bm.r);
           diffuseColor.a = mix(0.88, 0.50, _water); // land 88 %, ocean 50 %
         #endif`,
      )
    }
    mat.customProgramCacheKey = () => 'flowmap-globe-ocean-alpha-v2'

    // Blue marble loaded only to drive the water mask; colour stays navy
    new THREE.TextureLoader().load(EARTH_DAY, (tex) => {
      mat.map = tex
      mat.needsUpdate = true
    })

    return mat
  }, [])

  // ── Controls + auto-rotate ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (globeRef.current?.controls) {
        const ctrl = globeRef.current.controls()
        ctrl.enableRotate      = true
        ctrl.enableZoom        = true
        ctrl.enablePan         = true
        ctrl.rotateSpeed       = 0.8
        ctrl.zoomSpeed         = 1.2
        ctrl.panSpeed          = 0.8
        ctrl.minDistance       = 112
        ctrl.maxDistance       = 800
        ctrl.screenSpacePanning = true
        ctrl.mouseButtons = {
          LEFT:   THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  THREE.MOUSE.PAN,
        }

        const onKeyDown = (e) => {
          if (e.key === 'Shift' && ctrl.mouseButtons) ctrl.mouseButtons.LEFT = THREE.MOUSE.PAN
        }
        const onKeyUp = (e) => {
          if (e.key === 'Shift' && ctrl.mouseButtons) ctrl.mouseButtons.LEFT = THREE.MOUSE.ROTATE
        }
        const onBlur = () => {
          if (ctrl.mouseButtons) ctrl.mouseButtons.LEFT = THREE.MOUSE.ROTATE
        }
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('keyup',   onKeyUp)
        window.addEventListener('blur',      onBlur)

        ctrlCleanupRef.current = () => {
          document.removeEventListener('keydown', onKeyDown)
          document.removeEventListener('keyup',   onKeyUp)
          window.removeEventListener('blur',      onBlur)
        }

        ctrl.enableDamping   = true
        ctrl.dampingFactor   = 0.10
        ctrl.autoRotate      = true
        ctrl.autoRotateSpeed = AUTO_ROTATE_SPEED
      }
    }, 500)
    return () => {
      clearTimeout(timer)
      clearTimeout(idleTimerRef.current)
      ctrlCleanupRef.current?.()
    }
  }, [])

  // ── Fly-to on viewpoint change ────────────────────────────────────────────
  useEffect(() => {
    if (!viewpoint || !globeRef.current) return
    globeRef.current.pointOfView(
      { lat: viewpoint.lat, lng: viewpoint.lng, altitude: viewpoint.altitude ?? 1.8 },
      1200,
    )
    if (globeRef.current.controls) globeRef.current.controls().autoRotate = false
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (globeRef.current?.controls) globeRef.current.controls().autoRotate = true
    }, IDLE_RESUME_MS)
  }, [viewpoint])

  // ── Sun lighting ──────────────────────────────────────────────────────────
  useEffect(() => {
    const setup = setTimeout(() => {
      const scene = globeRef.current?.scene?.()
      if (!scene) return

      const ambients     = []
      const directionals = []
      scene.traverse((obj) => {
        if (obj.isAmbientLight)     ambients.push(obj)
        if (obj.isDirectionalLight) directionals.push(obj)
      })

      ambients.forEach((l) => { l.intensity *= 0.02 })  // near-zero so night side is truly dark
      directionals.forEach((l) => l.parent?.remove(l))

      const sun = new THREE.DirectionalLight(0xfff8f0, 4.0)  // brighter sun → more contrast
      sun.name = 'flowmap-sun'
      scene.add(sun)
      sunLightRef.current = sun

      function updateSunPos() {
        const { lat, lng } = getSunPosition()
        const v = geoToVec3(lat, lng)
        sun.position.set(v.x * 300, v.y * 300, v.z * 300)
      }
      updateSunPos()
      sunTimerRef.current = setInterval(updateSunPos, 60_000)
    }, 600)

    return () => {
      clearTimeout(setup)
      clearInterval(sunTimerRef.current)
      try {
        const scene = globeRef.current?.scene?.()
        if (scene && sunLightRef.current) scene.remove(sunLightRef.current)
      } catch { /* ignore unmount-race */ }
    }
  }, [])

  // ── Camera position → parent Map tab sync ─────────────────────────────────
  useEffect(() => {
    if (!onCameraChange) return
    const id = setInterval(() => {
      if (globeRef.current) onCameraChange(globeRef.current.pointOfView())
    }, 600)
    return () => clearInterval(id)
  }, [onCameraChange])

  // ── Globe click (ocean / empty space) — reset to default globe state ────────
  const handleGlobeClick = useCallback((coords) => {
    if (skipGlobeClick.current) return

    // Clear any region-zoom state
    setViewMode('globe')
    setStatePolygons([])
    setHoveredPolygon(null)
    allCityFeats.current = []
    setCityLabels([])

    // Zoom back out to a comfortable global altitude from the current centre
    if (globeRef.current) {
      const { lat, lng } = globeRef.current.pointOfView()
      globeRef.current.pointOfView({ lat, lng, altitude: 2.5 }, 1000)
    }

    // Resume auto-rotation once the fly-out animation finishes
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      if (globeRef.current?.controls) globeRef.current.controls().autoRotate = true
    }, 1100)

    onGlobeClick?.(coords ? { lat: coords.lat, lng: coords.lng } : {})
  }, [onGlobeClick])

  // ── Polygon colours ───────────────────────────────────────────────────────
  const polyCapColor = useCallback((d) => {
    if (d === loadingPoly)    return 'rgba(14,210,238,0.22)'
    if (d === hoveredPolygon) return viewMode === 'globe' ? 'rgba(14,210,238,0.13)' : 'rgba(14,210,238,0.18)'
    // Must be non-zero so react-globe.gl renders a cap mesh — raycasting
    // won't detect clicks on fully transparent (opacity=0) geometries.
    return 'rgba(14,210,238,0.03)'
  }, [loadingPoly, hoveredPolygon, viewMode])

  const polyStrokeColor = useCallback((d) => {
    if (d === loadingPoly || d === hoveredPolygon) return 'rgba(14,210,238,0.80)'
    return viewMode === 'globe' ? 'rgba(14,210,238,0.28)' : 'rgba(14,210,238,0.40)'
  }, [loadingPoly, hoveredPolygon, viewMode])

  const polyAltitude = useCallback((d) =>
    (d === hoveredPolygon || d === loadingPoly) ? 0.012 : 0.006,
  [hoveredPolygon, loadingPoly])

  const polyLabel = useCallback((d) =>
    viewMode === 'globe'
      ? (d.properties.ADMIN ?? d.properties.NAME ?? '')
      : (d.properties.name_en ?? d.properties.name ?? ''),
  [viewMode])

  // ── Container size — drives Globe width/height so it centres in its box ────
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Snapshot immediately so the first paint is already correct
    const { width, height } = el.getBoundingClientRect()
    if (width && height) setDims({ w: Math.round(width), h: Math.round(height) })
    // Keep in sync when the container resizes (panel drag, window resize, etc.)
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width && height) setDims({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="w-full h-full" style={{ background: 'transparent' }}>
      <Globe
        ref={globeRef}
        width={dims.w  || undefined}
        height={dims.h || undefined}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        showGraticules={true}
        showAtmosphere={true}
        graticulesColor={GRATICULE_COLOR}
        onGlobeClick={handleGlobeClick}
        // ── Points ───────────────────────────────────────────────────────────
        pointsData={pins}
        pointLat="lat"
        pointLng="lng"
        pointLabel="label"
        pointColor={(d) =>
          d.color === 'emerald' ? 'rgba(52,211,153,0.9)' : (d.color ?? 'rgba(52,211,153,0.9)')
        }
        pointAltitude={0.01}
        pointRadius={0.4}
        // ── Arcs ─────────────────────────────────────────────────────────────
        arcsData={arcs}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcLabel="label"
        arcColor={() => ['rgba(14,210,238,0.6)', 'rgba(14,210,238,0.1)']}
        arcAltitude={0.3}
        arcStroke={0.5}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={2000}
        // ── Labels ───────────────────────────────────────────────────────────
        labelsData={allLabels}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelSize={(d) => {
          const base = d.size ?? 1.2
          if (!d.isCity) return base
          // Labels are 3D sprites: they scale with camera distance.
          // labelSize ∝ altitude keeps screen-pixel size constant across zoom.
          const scale = Math.max(0.08, currentAlt) / 1.6
          return Math.max(0.03, base * scale)
        }}
        labelColor={(d) => d.color ?? 'rgba(255,255,255,0.85)'}
        labelDotRadius={(d) => {
          const base = d.dotRadius ?? 0.3
          if (!d.isCity) return base
          const scale = Math.max(0.08, currentAlt) / 1.6
          return Math.max(0.01, base * scale)
        }}
        labelAltitude={0.01}
        onLabelClick={(label) => onLabelClick?.(label)}
        // ── Country / state polygons ──────────────────────────────────────────
        polygonsData={activePolygons}
        polygonGeoJsonGeometry={(d) => d.geometry}
        polygonCapColor={polyCapColor}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={polyStrokeColor}
        polygonAltitude={polyAltitude}
        polygonLabel={polyLabel}
        onPolygonHover={(polygon) => setHoveredPolygon(polygon ?? null)}
        onPolygonClick={handlePolygonClick}
      />
    </div>
  )
}
