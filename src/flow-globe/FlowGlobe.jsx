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

// ── Moon position + phase helpers ─────────────────────────────────────────────

function getMoonPosition() {
  const now = new Date()
  const JD  = now.getTime() / 86400000 + 2440587.5   // Julian Date
  const T   = (JD - 2451545.0) / 36525               // centuries from J2000.0
  const rad = (d) => (d * Math.PI) / 180

  // Simplified lunar theory (< 1° positional error, Meeus Ch. 47 abridged)
  const L0 = 218.3164477 + 481267.88123421 * T   // mean longitude
  const M  = 357.5291092 +  35999.0502909  * T   // sun mean anomaly
  const Mp = 134.9633964 + 477198.8675055  * T   // moon mean anomaly
  const F  =  93.2720950 + 483202.0175233  * T   // argument of latitude

  // Ecliptic longitude and latitude (degrees)
  const λ_ecl = (L0
    + 6.288774 * Math.sin(rad(Mp))
    + 1.274027 * Math.sin(rad(2 * L0 - Mp))
    + 0.658314 * Math.sin(rad(2 * L0))
    + 0.213618 * Math.sin(rad(2 * Mp))
    - 0.185116 * Math.sin(rad(M))
    - 0.114332 * Math.sin(rad(2 * F))) % 360

  const β_ecl = 5.128122 * Math.sin(rad(F))
    + 0.280602 * Math.sin(rad(Mp + F))
    + 0.277693 * Math.sin(rad(Mp - F))
    + 0.173237 * Math.sin(rad(2 * L0 - F))

  // Obliquity of the ecliptic
  const ε  = 23.439291111 - 0.013004167 * T
  const λ  = rad(λ_ecl), β = rad(β_ecl), ε0 = rad(ε)

  // Ecliptic → equatorial (declination δ, right ascension α in radians)
  const sinδ = Math.sin(β) * Math.cos(ε0) + Math.cos(β) * Math.sin(ε0) * Math.sin(λ)
  const δ    = Math.asin(Math.max(-1, Math.min(1, sinδ)))
  const α    = Math.atan2(
    Math.sin(λ) * Math.cos(ε0) - Math.tan(β) * Math.sin(ε0),
    Math.cos(λ),
  )

  // Greenwich Mean Sidereal Time (degrees)
  const JD0  = Math.floor(JD - 0.5) + 0.5
  const H    = JD - JD0
  const T0   = (JD0 - 2451545.0) / 36525
  const GMST = ((100.4606184 + 36000.77004 * T0 + 0.000387933 * T0 * T0) % 360 + 360.98564724 * H) % 360

  // Sub-lunar geographic longitude
  let geoLng = ((α * 180 / Math.PI) - GMST + 720) % 360
  if (geoLng > 180) geoLng -= 360

  return { lat: (δ * 180) / Math.PI, lng: geoLng }
}

function getMoonPhase() {
  // Reference new moon: 6 Jan 2000 18:14:00 UTC (JD 2451550.26)
  const REF_NM  = 947182440000     // new Date('2000-01-06T18:14:00Z').getTime()
  const SYNODIC = 29.53059 * 86400000               // ms per synodic month
  const phase   = ((Date.now() - REF_NM) % SYNODIC + SYNODIC) % SYNODIC / SYNODIC

  if (phase < 0.025) return { name: 'New Moon',        emoji: '🌑', phase }
  if (phase < 0.250) return { name: 'Waxing Crescent', emoji: '🌒', phase }
  if (phase < 0.275) return { name: 'First Quarter',   emoji: '🌓', phase }
  if (phase < 0.500) return { name: 'Waxing Gibbous',  emoji: '🌔', phase }
  if (phase < 0.525) return { name: 'Full Moon',       emoji: '🌕', phase }
  if (phase < 0.750) return { name: 'Waning Gibbous',  emoji: '🌖', phase }
  if (phase < 0.775) return { name: 'Last Quarter',    emoji: '🌗', phase }
  if (phase < 0.975) return { name: 'Waning Crescent', emoji: '🌘', phase }
  return { name: 'New Moon', emoji: '🌑', phase }
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
  const starsMeshRef    = useRef(null)
  const sunSphereRef    = useRef(null)
  const sunCoronaRef    = useRef(null)
  const moonSphereRef   = useRef(null)
  const moonCoronaRef   = useRef(null)
  const ctrlCleanupRef  = useRef(null)
  const [globeView, setGlobeView] = useState('wire')   // 'wire' | 'normal'
  const moonPhase = useMemo(() => getMoonPhase(), [])
  const [celestialPos, setCelestialPos] = useState({ sun: null, moon: null })
  const skipGlobeClick  = useRef(false)   // prevent polygon click → globe click double-fire
  const onLabelClickRef = useRef(onLabelClick)
  useEffect(() => { onLabelClickRef.current = onLabelClick }, [onLabelClick])
  const allLabelsRef  = useRef([])
  const [screenLabels, setScreenLabels] = useState([])

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
  const [viewMode,        setViewMode      ] = useState('globe')
  const [statePolygons,   setStatePolygons ] = useState([])
  const [hoveredPolygon,  setHoveredPolygon] = useState(null)
  const [loadingPoly,     setLoadingPoly   ] = useState(null)   // tinted while states load
  const selectedCountryRef = useRef(null)   // { name, iso } — set on country click, used to qualify state names
  const allCityFeats    = useRef([])  // mapped city objects for current state (altitude slicer reads this)
  const countryPlacesRef = useRef([]) // raw NE place features for selected country (per-state filter source)
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
        countryPlacesRef.current = []
        selectedCountryRef.current = null
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
      // ── Country clicked → load state outlines only (no cities yet) ────
      const name  = polygon.properties.ADMIN ?? polygon.properties.NAME ?? ''
      onFeatureClick?.({ lat, lng, latSpan, lngSpan, name })
      setLoadingPoly(polygon)

      const iso   = polygon.properties.ISO_A2
      const isoA3 = polygon.properties.ISO_A3
      const admin = polygon.properties.ADMIN ?? polygon.properties.NAME ?? ''

      // Remember the selected country so state clicks can be fully qualified
      selectedCountryRef.current = { name: admin, iso, isoA3 }

      const [all, places] = await Promise.all([fetchAllStates(), fetchPlaces()])

      // State / province outlines
      const filtered = all.filter((f) =>
        (iso && iso !== '-99' && f.properties.iso_a2 === iso) ||
        f.properties.admin === admin,
      )
      setStatePolygons(filtered)
      setViewMode('region')
      setLoadingPoly(null)

      // Pre-filter country places into ref — cities only shown after a state is clicked
      countryPlacesRef.current = places
        .filter((p) => isoA3 && isoA3 !== '-99'
          ? p.properties.adm0_a3 === isoA3
          : p.properties.adm0_name === admin)
        .sort((a, b) => (b.properties.pop_max ?? 0) - (a.properties.pop_max ?? 0))
      allCityFeats.current = []
      setCityLabels([])

    } else {
      // ── State / province clicked → show cities for this state ─────────
      const stateName = polygon.properties.name_en ?? polygon.properties.name ?? ''
      const country   = selectedCountryRef.current
      // Qualify with country so AI doesn't confuse e.g. "Georgia" state vs country
      const fullName  = country?.name ? `${stateName}, ${country.name}` : stateName
      onFeatureClick?.({ lat, lng, latSpan, lngSpan, name: fullName })

      // Match cities whose adm1 field equals either the English or native state name
      const sNameLo  = stateName.toLowerCase()
      const sNameAlt = (polygon.properties.name ?? '').toLowerCase()
      const stateFeats = countryPlacesRef.current.filter((p) => {
        const pAdm1 = (p.properties.adm1 ?? '').toLowerCase()
        return pAdm1 === sNameLo || pAdm1 === sNameAlt
      })

      // Fall back to a top-N country slice if adm1 data is missing
      const source = stateFeats.length > 0 ? stateFeats : countryPlacesRef.current.slice(0, 30)

      const mapped = source.slice(0, 80).map((p) => {
        const isCapital = p.properties.featurecla?.includes('capital') ?? false
        return {
          lat:       p.geometry.coordinates[1],
          lng:       p.geometry.coordinates[0],
          text:      p.properties.name ?? '',
          isCity:    true,
          isCapital,
          color:     isCapital ? 'rgba(255,210,80,0.92)' : 'rgba(210,228,255,0.72)',
        }
      })

      allCityFeats.current = mapped
      const initCount =
        altitude > 1.2 ? 12 :
        altitude > 0.8 ? 25 :
        altitude > 0.5 ? 50 : 80
      setCityLabels(mapped.slice(0, initCount))
    }
  }, [viewMode, onFeatureClick])

  // All labels: static geo labels + AI-placed + city labels (city labels have isCity flag)
  const allLabels = useMemo(
    () => [...GEO_LABELS, ...labels, ...cityLabels],
    [labels, cityLabels],
  )
  useEffect(() => { allLabelsRef.current = allLabels }, [allLabels])

  // ── Project labels to screen coords every 50 ms ───────────────────────────
  // We own the label DOM elements (React JSX overlay) so there is no
  // duplication risk — the Globe receives no labelsData / htmlElementsData.
  useEffect(() => {
    const GLOBE_R = 100
    const id = setInterval(() => {
      const globe = globeRef.current
      if (!globe) return
      const camera   = globe.camera?.()
      const renderer = globe.renderer?.()
      if (!camera || !renderer) return

      const cw      = renderer.domElement.clientWidth
      const ch      = renderer.domElement.clientHeight
      const camNorm = camera.position.clone().normalize()

      const next = allLabelsRef.current.flatMap((d) => {
        // geoToVec3 matches react-globe.gl's coordinate system exactly
        const v = geoToVec3(d.lat, d.lng).multiplyScalar(GLOBE_R * 1.01)
        // Cull labels on the back hemisphere
        if (v.clone().normalize().dot(camNorm) < 0.08) return []
        const p = v.project(camera)
        return [{ ...d, x: (p.x * 0.5 + 0.5) * cw, y: (-p.y * 0.5 + 0.5) * ch }]
      })
      setScreenLabels(next)
    }, 50)
    return () => clearInterval(id)
  }, [])

  // ── Project sun + moon spheres to screen coords every 100 ms ─────────────
  useEffect(() => {
    const id = setInterval(() => {
      const globe = globeRef.current
      if (!globe) return
      const camera   = globe.camera?.()
      const renderer = globe.renderer?.()
      if (!camera || !renderer) return
      const cw      = renderer.domElement.clientWidth
      const ch      = renderer.domElement.clientHeight
      const camNorm = camera.position.clone().normalize()

      function projectMesh(mesh) {
        if (!mesh) return null
        // Cull when the body is on the far side of the globe from the camera
        if (mesh.position.clone().normalize().dot(camNorm) < 0.08) return null
        const p = mesh.position.clone().project(camera)
        return { x: (p.x * 0.5 + 0.5) * cw, y: (-p.y * 0.5 + 0.5) * ch }
      }
      setCelestialPos({
        sun:  projectMesh(sunSphereRef.current),
        moon: projectMesh(moonSphereRef.current),
      })
    }, 100)
    return () => clearInterval(id)
  }, [])

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

  // "Normal" view — blue-marble texture, no custom shader
  const normalMaterial = useMemo(() => {
    const mat = new THREE.MeshPhongMaterial({ shininess: 12 })
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

  // ── Stars + Sun lighting + Sun sphere ────────────────────────────────────
  useEffect(() => {
    const setup = setTimeout(() => {
      const scene = globeRef.current?.scene?.()
      if (!scene) return

      // Kill the default ambient/directional lights react-globe.gl adds
      const ambients     = []
      const directionals = []
      scene.traverse((obj) => {
        if (obj.isAmbientLight)     ambients.push(obj)
        if (obj.isDirectionalLight) directionals.push(obj)
      })
      ambients.forEach((l) => { l.intensity *= 0.02 })  // near-zero → night side truly dark
      directionals.forEach((l) => l.parent?.remove(l))

      // ── Star field ──
      const STAR_COUNT = 2500
      const starPositions = new Float32Array(STAR_COUNT * 3)
      for (let i = 0; i < STAR_COUNT; i++) {
        // Uniform random point on sphere shell, r ∈ [700, 1100]
        const theta = Math.random() * Math.PI * 2
        const phi   = Math.acos(2 * Math.random() - 1)
        const r     = 700 + Math.random() * 400
        starPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
        starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
        starPositions[i * 3 + 2] = r * Math.cos(phi)
      }
      const starGeom = new THREE.BufferGeometry()
      starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
      const starMat  = new THREE.PointsMaterial({
        color: 0xffffff, size: 0.9, transparent: true, opacity: 0.75,
        sizeAttenuation: true,
      })
      const stars = new THREE.Points(starGeom, starMat)
      stars.name = 'flowmap-stars'
      scene.add(stars)
      starsMeshRef.current = stars

      // ── Directional sun light ──
      const sun = new THREE.DirectionalLight(0xfff8f0, 4.0)
      sun.name = 'flowmap-sun'
      scene.add(sun)
      sunLightRef.current = sun

      // ── Sun visual sphere (core) ──
      // Placed at 490 units — well past the camera's max orbit of 280 at default
      // altitude, so it reads as a distant object rather than a nearby orb.
      const sunSphere = new THREE.Mesh(
        new THREE.SphereGeometry(11, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xfff9e0 }),
      )
      sunSphere.name = 'flowmap-sun-sphere'
      scene.add(sunSphere)
      sunSphereRef.current = sunSphere

      // ── Sun corona glow (outer soft halo) ──
      const corona = new THREE.Mesh(
        new THREE.SphereGeometry(22, 24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffe880, transparent: true, opacity: 0.16 }),
      )
      corona.name = 'flowmap-sun-corona'
      scene.add(corona)
      sunCoronaRef.current = corona

      // ── Moon visual sphere — lunar surface texture + Phong shading ──
      const MOON_TEX = 'https://raw.githubusercontent.com/mrdoob/three.js/r155/examples/textures/planets/moon_1024.jpg'
      const moonMat = new THREE.MeshPhongMaterial({ shininess: 3 })
      new THREE.TextureLoader().load(MOON_TEX, (tex) => {
        moonMat.map = tex
        moonMat.needsUpdate = true
      })
      const moonSphere = new THREE.Mesh(
        new THREE.SphereGeometry(4.5, 32, 32),
        moonMat,
      )
      moonSphere.name = 'flowmap-moon-sphere'
      scene.add(moonSphere)
      moonSphereRef.current = moonSphere

      // ── Moon glow (soft silver halo) ──
      const moonGlow = new THREE.Mesh(
        new THREE.SphereGeometry(8, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xe0eaf2, transparent: true, opacity: 0.06 }),
      )
      moonGlow.name = 'flowmap-moon-glow'
      scene.add(moonGlow)
      moonCoronaRef.current = moonGlow

      function updateBodies() {
        // Sun — light source at 600 units, visual sphere at 490
        const { lat: sLat, lng: sLng } = getSunPosition()
        const sv = geoToVec3(sLat, sLng)
        sun.position.set(sv.x * 600, sv.y * 600, sv.z * 600)
        sunSphere.position.set(sv.x * 490, sv.y * 490, sv.z * 490)
        corona.position.set(sv.x * 490, sv.y * 490, sv.z * 490)
        // Moon — visual sphere at 440 units
        const { lat: mLat, lng: mLng } = getMoonPosition()
        const mv = geoToVec3(mLat, mLng)
        moonSphere.position.set(mv.x * 440, mv.y * 440, mv.z * 440)
        moonGlow.position.set(mv.x * 440, mv.y * 440, mv.z * 440)
      }
      updateBodies()
      sunTimerRef.current = setInterval(updateBodies, 60_000)
    }, 600)

    return () => {
      clearTimeout(setup)
      clearInterval(sunTimerRef.current)
      try {
        const scene = globeRef.current?.scene?.()
        if (scene) {
          if (sunLightRef.current)  scene.remove(sunLightRef.current)
          if (starsMeshRef.current) scene.remove(starsMeshRef.current)
          if (sunSphereRef.current) scene.remove(sunSphereRef.current)
          if (sunCoronaRef.current) scene.remove(sunCoronaRef.current)
          if (moonSphereRef.current) scene.remove(moonSphereRef.current)
          if (moonCoronaRef.current) scene.remove(moonCoronaRef.current)
        }
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
    countryPlacesRef.current = []
    selectedCountryRef.current = null
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
    <div ref={containerRef} className="w-full h-full" style={{ background: 'transparent', position: 'relative' }}>
      <Globe
        ref={globeRef}
        width={dims.w  || undefined}
        height={dims.h || undefined}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeView === 'wire' ? globeMaterial : normalMaterial}
        showGraticules={globeView === 'wire'}
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
        // Labels are rendered by our own React overlay below — no labelsData here
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

      {/* ── Wire / Normal view toggle ────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 20,
        display: 'flex', gap: 2,
        background: 'rgba(0,0,0,0.52)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 8, padding: 3,
        pointerEvents: 'auto',
      }}>
        {[
          { id: 'wire',   label: 'Wire' },
          { id: 'normal', label: 'Normal' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setGlobeView(id)}
            style={{
              padding: '4px 11px',
              borderRadius: 5,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 500,
              letterSpacing: '0.05em',
              transition: 'all 0.15s ease',
              background: globeView === id ? 'rgba(14,210,238,0.18)' : 'transparent',
              color: globeView === id ? 'rgba(14,210,238,0.92)' : 'rgba(255,255,255,0.32)',
              boxShadow: globeView === id ? '0 0 10px rgba(14,210,238,0.14)' : 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Moon phase badge ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(0,0,0,0.50)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, padding: '5px 10px',
        pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 15, lineHeight: 1 }}>{moonPhase.emoji}</span>
        <span style={{
          fontSize: 11, color: 'rgba(255,255,255,0.60)',
          fontFamily: 'system-ui, sans-serif', letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}>
          {moonPhase.name}
        </span>
      </div>

      {/* ── Label overlay — React-managed divs, no duplication risk ─────────── */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {screenLabels.map((d) => (
          <div
            key={`${d.lat},${d.lng},${d.text}`}
            style={{
              position:      'absolute',
              left:          d.x,
              top:           d.y,
              transform:     'translate(6px, -50%)',
              display:       'flex',
              alignItems:    'center',
              gap:           4,
              pointerEvents: 'auto',
              cursor:        'pointer',
              userSelect:    'none',
            }}
            onClick={() => onLabelClickRef.current?.(d)}
          >
            {/* Coloured dot */}
            <div style={{
              width:        d.isCapital ? 5 : 3,
              height:       d.isCapital ? 5 : 3,
              borderRadius: '50%',
              background:   d.color ?? 'rgba(14,210,238,0.9)',
              flexShrink:   0,
            }} />
            {/* Text with hard shadow for legibility on any background */}
            <span style={{
              fontSize:    d.isCapital ? 12 : d.isCity ? 10 : 11,
              fontWeight:  d.isCapital ? 600 : 400,
              fontFamily:  'system-ui, sans-serif',
              color:       'rgba(255,255,255,0.95)',
              letterSpacing: '0.04em',
              whiteSpace:  'nowrap',
              textShadow:
                '0 0 6px rgba(0,0,0,1),' +
                '0 0 14px rgba(0,0,0,0.9),' +
                '0 1px 3px rgba(0,0,0,1),' +
                '-1px 0 3px rgba(0,0,0,0.9),' +
                '1px 0 3px rgba(0,0,0,0.9)',
            }}>
              {d.text}
            </span>
          </div>
        ))}

        {/* ── Sun label ── */}
        {celestialPos.sun && (
          <div style={{
            position:      'absolute',
            left:          celestialPos.sun.x,
            top:           celestialPos.sun.y,
            transform:     'translate(10px, -50%)',
            display:       'flex',
            alignItems:    'center',
            gap:           3,
            pointerEvents: 'none',
          }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#ffe87a', flexShrink: 0 }} />
            <span style={{
              fontSize:     11,
              fontWeight:   600,
              fontFamily:   'system-ui, sans-serif',
              color:        'rgba(255,232,100,0.92)',
              letterSpacing: '0.05em',
              whiteSpace:   'nowrap',
              textShadow:   '0 0 6px rgba(0,0,0,1),0 0 14px rgba(0,0,0,0.9),0 1px 3px rgba(0,0,0,1)',
            }}>Sun</span>
          </div>
        )}

        {/* ── Moon label ── */}
        {celestialPos.moon && (
          <div style={{
            position:      'absolute',
            left:          celestialPos.moon.x,
            top:           celestialPos.moon.y,
            transform:     'translate(8px, -50%)',
            display:       'flex',
            alignItems:    'center',
            gap:           3,
            pointerEvents: 'none',
          }}>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#b8c9d9', flexShrink: 0 }} />
            <span style={{
              fontSize:     11,
              fontWeight:   500,
              fontFamily:   'system-ui, sans-serif',
              color:        'rgba(184,201,217,0.85)',
              letterSpacing: '0.05em',
              whiteSpace:   'nowrap',
              textShadow:   '0 0 6px rgba(0,0,0,1),0 0 12px rgba(0,0,0,0.9),0 1px 3px rgba(0,0,0,1)',
            }}>Moon</span>
          </div>
        )}
      </div>
    </div>
  )
}
