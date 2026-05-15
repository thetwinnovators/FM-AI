function nodeFromEntity(entity, type) {
  return {
    id: entity.id,
    label: entity.name || entity.title || entity.id,
    type,
    summary: entity.summary || '',
  }
}

function nodeFromMemory(entry) {
  const text = entry.content || ''
  const label = text.length > 36 ? text.slice(0, 33).trim() + '…' : text
  return {
    id: entry.id,
    label,
    type: 'memory',
    summary: text,
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

/**
 * Build the relational graph from seed data, live user state, and optionally
 * the VS entity graph produced by VentureScope scans.
 *
 * VS entities are injected as 'signal' nodes (intelligence tier, innermost shell)
 * so they appear in the 3D graph on the main FlowMap page without touching any
 * of the fm_radar_* keys used by the old Opportunity Radar.
 *
 * @param {object} seed       - Seed entities (topics, tools, creators, etc.)
 * @param {object} userState  - Live user state (saves, views, follows, …)
 * @param {object|null} vsEntityGraph - Parsed fm_vs_entity_graph or null
 */
export function buildGraph(seed, userState = {}, vsEntityGraph = null) {
  const {
    userTopics = {},
    documents = {},
    manualContent = {},
    memoryEntries = {},
    saves = {},
    views = {},
    follows = {},
  } = userState

  const nodes = [
    ...seed.topics.map((x)    => nodeFromEntity(x, 'topic')),
    ...seed.tools.map((x)     => nodeFromEntity(x, 'tool')),
    ...seed.creators.map((x)  => nodeFromEntity(x, 'creator')),
    ...seed.companies.map((x) => nodeFromEntity(x, 'company')),
    ...seed.concepts.map((x)  => nodeFromEntity(x, 'concept')),
    ...seed.tags.map((x)      => nodeFromEntity(x, 'tag')),
    ...seed.content.map((x)   => nodeFromEntity(x, x.type)),
    ...(seed.seedMemory || []).map(nodeFromMemory),
  ]

  const existingIds = new Set(nodes.map((n) => n.id))

  for (const t of Object.values(userTopics)) {
    if (existingIds.has(t.id)) continue
    nodes.push({ id: t.id, label: t.name || t.id, type: 'topic', summary: t.summary || '' })
    existingIds.add(t.id)
  }

  for (const entry of Object.values(manualContent)) {
    const item = entry.item
    if (!item || existingIds.has(item.id)) continue
    nodes.push({ id: item.id, label: item.title || item.id, type: item.type || 'article', summary: item.summary || '' })
    existingIds.add(item.id)
  }

  for (const doc of Object.values(documents)) {
    if (existingIds.has(doc.id)) continue
    nodes.push({ id: doc.id, label: doc.title || doc.id, type: 'document', summary: doc.excerpt || '' })
    existingIds.add(doc.id)
  }

  for (const entry of Object.values(memoryEntries)) {
    if (existingIds.has(entry.id)) continue
    nodes.push(nodeFromMemory(entry))
    existingIds.add(entry.id)
  }

  // ── VS entity graph injection ────────────────────────────────────────────
  // Each VS entity becomes a 'signal' node (intelligence tier — innermost shell,
  // radius ≈ 0.68 in nodePositions.js, rendered in rose-red #f43f5e).
  // Entity IDs are prefixed by the registry (e.g. entity_persona_*) so they
  // never collide with seed node IDs.
  if (vsEntityGraph?.entities) {
    for (const entity of Object.values(vsEntityGraph.entities)) {
      if (existingIds.has(entity.id)) continue
      nodes.push({
        id: entity.id,
        label: entity.value,
        type: 'signal',
        summary: `${(entity.type ?? '').replace(/_/g, ' ')} · ${entity.frequency ?? 1} occurrences`,
      })
      existingIds.add(entity.id)
    }
  }

  const topicById = Object.fromEntries(seed.topics.map((t) => [t.id, t]))
  const topicBySlug = Object.fromEntries(
    seed.topics.filter((t) => t.slug).map((t) => [t.slug, t])
  )

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
    for (const tid of c.toolIds    || []) pushImplicit(implicit, c.id, tid, c.id, 'discusses', 0.5, date)
    for (const cid of c.conceptIds || []) pushImplicit(implicit, c.id, cid, c.id, 'discusses', 0.5, date)
    for (const tid of c.tagIds     || []) pushImplicit(implicit, c.id, tid, c.id, 'tagged_with', 0.3, date)
  }

  for (const entry of Object.values(manualContent)) {
    const item = entry.item
    if (!item || !existingIds.has(item.id)) continue
    for (const tid of entry.topicIds || []) {
      if (existingIds.has(tid)) {
        pushImplicit(implicit, item.id, tid, item.id, 'covers', 0.6, entry.savedAt || null)
      }
    }
  }

  for (const doc of Object.values(documents)) {
    if (!existingIds.has(doc.id)) continue
    for (const ref of doc.topics || []) {
      const resolved = topicById[ref] || topicBySlug[ref]
      if (resolved && existingIds.has(resolved.id)) {
        pushImplicit(implicit, doc.id, resolved.id, doc.id, 'covers', 0.6, doc.updatedAt || null)
      }
    }
  }

  // ── VS entity co-occurrence edges ────────────────────────────────────────
  // Only wired between entities that were successfully added above (existingIds
  // guard prevents dangling references if the entity graph is stale).
  if (vsEntityGraph?.edges) {
    for (const edge of vsEntityGraph.edges) {
      if (!existingIds.has(edge.source) || !existingIds.has(edge.target)) continue
      pushImplicit(
        implicit,
        edge.source,
        edge.target,
        'vs_scan',
        'co_mentioned',
        Math.min(1.0, edge.weight ?? 0.3),
        null,
      )
    }
  }

  const edges = [...explicit, ...implicit.values()]

  for (const edge of edges) {
    if (follows[edge.from] || follows[edge.to]) {
      edge.weight = Math.min(1.0, edge.weight * 1.4)
    }
    if (saves[edge.from] || saves[edge.to]) {
      edge.weight = Math.min(1.0, edge.weight + 0.15)
    }
    const vc = (views[edge.from]?.count ?? 0) + (views[edge.to]?.count ?? 0)
    if (vc > 0) {
      edge.weight = Math.min(1.0, edge.weight + Math.min(0.1, vc * 0.02))
    }
  }

  return { nodes, edges }
}
