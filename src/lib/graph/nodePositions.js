const SPHERE_RADIUS = 2.6
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
  // Slight per-type radial bias so types form soft "layers" while staying spherical.
  const TYPE_RADIAL_BIAS = {
    topic:         1.00,
    concept:       0.92,
    tool:          0.96,
    company:       1.06,
    creator:       1.04,
    video:         0.86,
    article:       0.84,
    social_post:   0.88,
    tag:           0.78,
    learning_path: 0.94,
    signal:        1.10,
  }

  otherNodes.forEach((n, i) => {
    const rng = pseudoRandom(n.id)
    const dir = fibSpherePoint(i, Math.max(1, N))
    const radialBias = TYPE_RADIAL_BIAS[n.type] ?? 1.0
    const jitter = 0.92 + rng() * 0.16
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
