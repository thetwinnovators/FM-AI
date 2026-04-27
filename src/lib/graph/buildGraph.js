function nodeFromEntity(entity, type) {
  return {
    id: entity.id,
    label: entity.name || entity.title || entity.id,
    type,
    summary: entity.summary || '',
  }
}

function pushImplicit(map, from, to, contentId, kind = 'derived', weight = 0.5, lastReinforced = null) {
  const k1 = `${from}__${to}`
  const k2 = `${to}__${from}`
  const existing = map.get(k1) || map.get(k2)
  if (existing) {
    if (!existing.evidence.includes(contentId)) existing.evidence.push(contentId)
    existing.weight = Math.min(1.0, existing.weight + 0.05)
    if (lastReinforced && (!existing.lastReinforced || lastReinforced > existing.lastReinforced)) {
      existing.lastReinforced = lastReinforced
    }
    return
  }
  map.set(k1, { from, to, kind, weight, evidence: [contentId], lastReinforced })
}

export function buildGraph(seed) {
  const nodes = [
    ...seed.topics.map((x)    => nodeFromEntity(x, 'topic')),
    ...seed.tools.map((x)     => nodeFromEntity(x, 'tool')),
    ...seed.creators.map((x)  => nodeFromEntity(x, 'creator')),
    ...seed.companies.map((x) => nodeFromEntity(x, 'company')),
    ...seed.concepts.map((x)  => nodeFromEntity(x, 'concept')),
    ...seed.tags.map((x)      => nodeFromEntity(x, 'tag')),
    ...seed.content.map((x)   => nodeFromEntity(x, x.type)),
  ]

  const explicit = (seed.relations || []).map((r) => ({
    from: r.from,
    to: r.to,
    kind: r.kind || 'related',
    weight: r.weight ?? 0.5,
    evidence: r.evidence || [],
    lastReinforced: r.lastReinforced || null,
  }))

  const implicit = new Map()
  for (const c of seed.content || []) {
    const date = c.publishedAt || null
    for (const tid of c.topicIds || []) {
      pushImplicit(implicit, c.id, tid, c.id, 'covers', 0.6, date)
    }
    if (c.creatorId) pushImplicit(implicit, c.creatorId, c.id, c.id, 'authored', 0.7, date)
    for (const tid of c.toolIds   || []) pushImplicit(implicit, c.id, tid, c.id, 'discusses', 0.5, date)
    for (const cid of c.conceptIds|| []) pushImplicit(implicit, c.id, cid, c.id, 'discusses', 0.5, date)
    for (const tid of c.tagIds    || []) pushImplicit(implicit, c.id, tid, c.id, 'tagged_with', 0.3, date)
  }

  return { nodes, edges: [...explicit, ...implicit.values()] }
}
