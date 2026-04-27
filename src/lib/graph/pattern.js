export function computePatterns(seed, signals) {
  const { content = [] } = seed
  const { saves = {}, follows = {}, views = {} } = signals || {}

  const pairCounts = new Map()
  const topicCounts = new Map()
  for (const c of content) {
    const ids = c.topicIds || []
    for (const id of ids) topicCounts.set(id, (topicCounts.get(id) || 0) + 1)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [ids[i], ids[j]].sort()
        const key = `${a}|${b}`
        const v = pairCounts.get(key) || { a, b, count: 0, evidence: [], boost: 0 }
        v.count += 1
        v.evidence.push(c.id)
        const viewBoost = (views[c.id]?.count ?? 0) * 0.05
        const saveBoost = saves[c.id] ? 0.1 : 0
        v.boost += viewBoost + saveBoost
        pairCounts.set(key, v)
      }
    }
  }

  const coOccurrence = [...pairCounts.values()].sort((x, y) => (y.count + y.boost) - (x.count + x.boost))

  const topicAffinity = {}
  for (const [tid, baseCount] of topicCounts.entries()) {
    let score = baseCount * 0.1
    if (follows[tid]) score += 1.0
    for (const c of content) {
      if (!c.topicIds?.includes(tid)) continue
      if (saves[c.id])  score += 0.3
      const v = views[c.id]?.count ?? 0
      score += Math.min(0.5, v * 0.1)
    }
    topicAffinity[tid] = score
  }

  return { coOccurrence, topicAffinity }
}
