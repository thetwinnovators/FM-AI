const X_BY_TYPE = {
  company:        -2.6,
  creator:         2.6,
  topic:          -1.0,
  concept:         0.2,
  tool:            0.2,
  tag:             0.2,
  learning_path:   1.4,
  memory:         -2.0,
  signal:          1.8,
  video:           1.5,
  article:         1.5,
  social_post:     1.5,
}

function pseudoRandom(seedStr) {
  let h = 0
  for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) | 0
  return () => {
    h = (h * 1103515245 + 12345) | 0
    return ((h >>> 0) % 1000) / 1000
  }
}

export function generatePositions(nodes) {
  return nodes.map((n) => {
    const rng = pseudoRandom(n.id)
    const bx = (X_BY_TYPE[n.type] ?? 0) + (rng() - 0.5) * 0.4
    const by = (rng() - 0.5) * 3.2
    const bz = (rng() - 0.5) * 0.8
    const phase = rng() * Math.PI * 2
    return { ...n, bx, by, bz, phase }
  })
}
