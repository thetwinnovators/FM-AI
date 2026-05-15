const SPHERE_RADIUS = 3.5
const MEMORY_CLUSTER_RADIUS = 0.55

function pseudoRandom(seedStr) {
  let h = 0
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) | 0
  return () => {
    h = (h * 1103515245 + 12345) | 0
    return ((h >>> 0) % 1000) / 1000
  }
}

// Fibonacci sphere — even distribution of N points on a unit sphere.
// Returns { x, y, z } at radius 1.
function fibSpherePoint(i, total) {
  const phi = Math.acos(1 - 2 * (i + 0.5) / total)
  const theta = Math.PI * (1 + Math.sqrt(5)) * i
  return {
    x: Math.cos(theta) * Math.sin(phi),
    y: Math.sin(theta) * Math.sin(phi),
    z: Math.cos(phi),
  }
}

export function generatePositions(nodes) {
  const memoryNodes = nodes.filter((n) => n.type === 'memory')
  const otherNodes  = nodes.filter((n) => n.type !== 'memory')
  const N = otherNodes.length
  const positioned = []

  // Memory nodes cluster near the origin — the gravitational center of the graph.
  memoryNodes.forEach((n) => {
    const rng = pseudoRandom(n.id)
    const r = MEMORY_CLUSTER_RADIUS * (0.2 + rng() * 0.8)
    const theta = rng() * Math.PI * 2
    const phi = Math.acos(2 * rng() - 1)
    positioned.push({
      ...n,
      bx: r * Math.cos(theta) * Math.sin(phi),
      by: r * Math.sin(theta) * Math.sin(phi),
      bz: r * Math.cos(phi),
      phase: rng() * Math.PI * 2,
    })
  })

  // Other nodes evenly distributed on a sphere shell around memory.
  // Four distinct radial shells reflecting the node taxonomy tiers —
  // tighter jitter keeps shell boundaries clean while the Fibonacci
  // distribution maintains the spherical shape.
  //
  //  Shell 1 · Intelligence  (signal, learning_path)  r ≈ 0.68–0.74
  //  Shell 2 · Structure     (tag, concept, topic)     r ≈ 0.84–0.93
  //  Shell 3 · Entity        (creator, company)        r ≈ 1.04–1.13
  //  Shell 4 · Content       (tool…article)            r ≈ 1.18–1.28
  const TYPE_RADIAL_BIAS = {
    // ── Intelligence shell (innermost — derived knowledge near the core) ──
    signal:        0.68,
    learning_path: 0.70,
    // ── Structure shell — organisational backbone ────────────────────────
    tag:           0.84,
    concept:       0.86,
    topic:         0.90,
    // ── Entity shell — content producers ────────────────────────────────
    creator:       1.05,
    company:       1.07,
    // ── Content shell (outermost — consumed artifacts) ───────────────────
    tool:          1.18,
    social_post:   1.20,
    document:      1.22,
    video:         1.23,
    article:       1.25,
  }

  otherNodes.forEach((n, i) => {
    const rng = pseudoRandom(n.id)
    const dir = fibSpherePoint(i, Math.max(1, N))
    const radialBias = TYPE_RADIAL_BIAS[n.type] ?? 1.0
    const jitter = 0.95 + rng() * 0.10   // ±5 % — tight enough to preserve shell separation
    const r = SPHERE_RADIUS * radialBias * jitter
    positioned.push({
      ...n,
      bx: dir.x * r,
      by: dir.y * r,
      bz: dir.z * r,
      phase: rng() * Math.PI * 2,
    })
  })

  return positioned
}
