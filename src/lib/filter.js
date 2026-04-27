export function matchesQuery(item, query) {
  if (!query) return true
  const q = query.toLowerCase()
  const haystack = [item.title, item.summary, ...(item.keyPoints || [])]
    .filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q)
}

export function isRelatedToNode(item, nodeId) {
  if (!nodeId) return true
  if (item.id === nodeId) return true
  if (item.creatorId === nodeId) return true
  if ((item.topicIds || []).includes(nodeId)) return true
  if ((item.toolIds || []).includes(nodeId)) return true
  if ((item.conceptIds || []).includes(nodeId)) return true
  if ((item.companyIds || []).includes(nodeId)) return true
  if ((item.tagIds || []).includes(nodeId)) return true
  return false
}

export function filterContent(items, opts = {}) {
  const { query, type, topicIds, tagIds, relatedToNodeId, sort = 'newest' } = opts
  let out = items.filter((it) => {
    if (type && it.type !== type) return false
    if (topicIds?.length && !topicIds.some((t) => it.topicIds?.includes(t))) return false
    if (tagIds?.length && !tagIds.some((t) => it.tagIds?.includes(t))) return false
    if (relatedToNodeId && !isRelatedToNode(it, relatedToNodeId)) return false
    if (query && !matchesQuery(it, query)) return false
    return true
  })
  if (sort === 'newest') {
    out = [...out].sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
  }
  return out
}
