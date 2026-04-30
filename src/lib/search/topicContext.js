// Phase 3 search quality: build a topic context object so the ranker can bias
// results toward the user's pattern for THIS topic specifically.
//
// Inputs come from three layers:
//   - searches log (Phase 2 persisted intents/freshSensitive on each entry)
//   - manual content the user has saved into this topic
//   - seed graph (relatedTopicIds, toolIds, conceptIds) when topic is seeded
//
// Output is consumed by `scoreTopicFit` in rank.js. All counts and rates are
// derived; nothing here mutates store state.

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function deriveSourceType(item) {
  if (item.sourceType) return item.sourceType
  if (item.type === 'video') return 'video'
  if (item.type === 'social_post') return 'community'
  return 'article'
}

// Decide whether a search log entry "belongs to" this topic. Heuristic:
// - exact match on user-topic query
// - normalized topic name appears as a substring of the search
// - any expanded alias from this topic's seed graph (tools/concepts) is contained
//
// Conservative — false positives bleed unrelated patterns into the topic.
function searchesForTopic(searches, topic, relatedTerms) {
  const lcName = String(topic.name || '').trim().toLowerCase()
  const lcQuery = String(topic.query || '').trim().toLowerCase()
  const out = []
  for (const [q, info] of Object.entries(searches || {})) {
    if (lcQuery && q === lcQuery) { out.push(info); continue }
    if (lcName && q.includes(lcName)) { out.push(info); continue }
    // Strong related-term hit (full word match on the term)
    let hit = false
    for (const term of relatedTerms || []) {
      if (term && term.length >= 3 && q.includes(term)) { hit = true; break }
    }
    if (hit) out.push(info)
  }
  return out
}

export function buildTopicContext(topic, opts = {}) {
  if (!topic) return null
  const { searches = {}, manualContent = {}, seed = null } = opts

  // 1. Related graph terms (seed topics only) — names of related topics, tools,
  //    and concepts. Used both for searches-attribution and for term matching.
  const relatedTerms = new Set()
  if (seed && !topic.isUserAdded && !topic.query) {
    for (const id of topic.relatedTopicIds || []) {
      const t = seed.topicById?.(id)
      if (t?.name) relatedTerms.add(String(t.name).toLowerCase())
    }
    for (const id of topic.toolIds || []) {
      const tool = seed.toolById?.(id)
      if (tool?.name) relatedTerms.add(String(tool.name).toLowerCase())
    }
    for (const id of topic.conceptIds || []) {
      const c = seed.conceptById?.(id)
      if (c?.name) relatedTerms.add(String(c.name).toLowerCase())
    }
  }

  // 2. Search history attributed to this topic.
  const related = searchesForTopic(searches, topic, [...relatedTerms])
  const intentCounts = {}
  let totalIntents = 0
  let freshCount = 0
  for (const s of related) {
    for (const lab of s.intents || []) {
      intentCounts[lab] = (intentCounts[lab] || 0) + 1
      totalIntents++
    }
    if (s.freshSensitive) freshCount++
  }
  const intentDistribution = {}
  if (totalIntents > 0) {
    for (const [k, v] of Object.entries(intentCounts)) {
      intentDistribution[k] = v / totalIntents
    }
  }
  const freshSensitiveRate = related.length > 0 ? freshCount / related.length : 0

  // 3. Manual content + seed content shape: which domains and sourceTypes the
  //    user already keeps under this topic.
  const preferredDomains = {}
  const preferredSourceTypes = {}
  const tags = new Set()

  for (const m of Object.values(manualContent || {})) {
    if (!m.topicIds?.includes(topic.id)) continue
    const item = m.item
    if (item?.url) {
      const host = hostOf(item.url)
      if (host) preferredDomains[host] = (preferredDomains[host] || 0) + 1
    }
    const st = deriveSourceType(item || {})
    preferredSourceTypes[st] = (preferredSourceTypes[st] || 0) + 1
    for (const tag of m.tags || []) {
      const lc = String(tag).toLowerCase()
      if (lc) tags.add(lc)
    }
  }

  if (seed?.contentByTopic && !topic.isUserAdded && !topic.query) {
    const items = seed.contentByTopic(topic.id) || []
    for (const item of items) {
      if (item?.url) {
        const host = hostOf(item.url)
        if (host) preferredDomains[host] = (preferredDomains[host] || 0) + 1
      }
      const st = deriveSourceType(item)
      preferredSourceTypes[st] = (preferredSourceTypes[st] || 0) + 1
    }
  }

  return {
    topicId: topic.id,
    topicName: topic.name,
    intentDistribution,
    freshSensitiveRate,
    preferredDomains,
    preferredSourceTypes,
    tags: [...tags],
    relatedTerms: [...relatedTerms],
  }
}

// Returns 0..1. Used as a multiplied score component in rank.js.
export function scoreTopicFit(item, ctx) {
  if (!ctx || !item) return 0
  let score = 0

  // Domain familiarity — capped so a single common domain can't dominate.
  const domainCount = ctx.preferredDomains?.[item.domain] || 0
  if (domainCount > 0) {
    score += Math.min(0.40, 0.10 + 0.10 * domainCount)
  }

  // Source-type fit — proportional to how often this sourceType appears in the
  // topic's existing collection.
  const stCount = ctx.preferredSourceTypes?.[item.sourceType] || 0
  let totalST = 0
  for (const v of Object.values(ctx.preferredSourceTypes || {})) totalST += v
  if (totalST > 0) {
    score += 0.30 * (stCount / totalST)
  }

  // Tag and related-term overlap with title/summary text.
  const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase()
  let tagHits = 0
  for (const tag of ctx.tags || []) {
    if (tag && text.includes(tag)) tagHits++
  }
  if (tagHits > 0) score += Math.min(0.20, 0.10 * tagHits)

  let relHits = 0
  for (const term of ctx.relatedTerms || []) {
    if (term && term.length >= 3 && text.includes(term)) relHits++
  }
  if (relHits > 0) score += Math.min(0.20, 0.07 * relHits)

  return Math.min(1.0, score)
}
