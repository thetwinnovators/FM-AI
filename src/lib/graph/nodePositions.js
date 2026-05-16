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

  // All non-memory nodes distributed evenly on a single spherical surface.
  // Fibonacci sphere gives the mathematically optimal equal-area spacing —
  // no node is significantly closer to or farther from its neighbours.
  // A tiny per-node jitter (±2 %) prevents exact coplanarity without
  // visually disrupting the spherical silhouette.
  otherNodes.forEach((n, i) => {
    const rng = pseudoRandom(n.id)
    const dir = fibSpherePoint(i, Math.max(1, N))
    const jitter = 0.98 + rng() * 0.04   // ±2 %
    const r = SPHERE_RADIUS * jitter
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
