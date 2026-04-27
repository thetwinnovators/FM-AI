// Query-specific scoring and diversity controls. Replaces the previous "merge then
// sort by date" approach so distinct queries actually produce distinct top results.
//
// Scoring weights (per the relevance-fixes spec):
//   exact phrase match  0.30
//   token overlap       0.20
//   intent alignment    0.15
//   feedback affinity   0.15
//   freshness           0.10
//   metadata complete   0.10

function tokenize(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function exactPhraseMatch(item, query) {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return 0
  const title = String(item.title || '').toLowerCase()
  const summary = String(item.summary || '').toLowerCase()
  if (title === q) return 1.0
  if (title.includes(q)) return 0.75
  if (summary.includes(q)) return 0.4
  return 0
}

function tokenOverlap(item, query) {
  const qTokens = new Set(tokenize(query))
  if (qTokens.size === 0) return 0
  const itemTokens = new Set(tokenize(`${item.title || ''} ${item.summary || ''}`))
  let hits = 0
  for (const t of qTokens) if (itemTokens.has(t)) hits++
  return Math.min(1.0, hits / qTokens.size)
}

function freshnessScore(item) {
  if (!item.publishedAt) return 0.4
  const t = Date.parse(item.publishedAt)
  if (Number.isNaN(t)) return 0.4
  const ageDays = (Date.now() - t) / 86_400_000
  if (ageDays < 7)   return 1.0
  if (ageDays < 30)  return 0.85
  if (ageDays < 90)  return 0.7
  if (ageDays < 365) return 0.55
  return 0.3
}

function metadataCompleteness(item) {
  let s = 0
  if (item.title)        s += 0.30
  if (item.summary)      s += 0.30
  if (item.thumbnail)    s += 0.25
  if (item.publishedAt)  s += 0.15
  return s
}

function intentAlignment(item, intent) {
  if (intent.sourceTypes.length >= 2) return 0.7
  return intent.sourceTypes.includes(item.type) ? 1.0 : 0.2
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Feedback affinity: domain of the item gets a boost if the user has saved items
// from that domain before. Dismissed items get a penalty.
function feedbackAffinity(item, signals) {
  if (!signals) return 0.5
  if (signals.dismisses?.[item.id]) return 0
  const itemHost = hostOf(item.url)
  let domainBoost = 0
  if (itemHost && signals.saves) {
    for (const id of Object.keys(signals.saves)) {
      const saved = signals.saves[id]?.item
      if (saved?.url && hostOf(saved.url) === itemHost) {
        domainBoost = 0.4
        break
      }
    }
  }
  // Repeat-view boost
  const views = signals.views?.[item.id]?.count || 0
  const viewBoost = Math.min(0.3, views * 0.1)
  return Math.min(1.0, 0.5 + domainBoost + viewBoost)
}

export function scoreItem(item, intent, signals) {
  const exact    = exactPhraseMatch(item, intent.normalizedQuery)
  const tokens   = tokenOverlap(item, intent.normalizedQuery)
  const align    = intentAlignment(item, intent)
  const feedback = feedbackAffinity(item, signals)
  const fresh    = freshnessScore(item)
  const meta     = metadataCompleteness(item)

  return (
    exact    * 0.30 +
    tokens   * 0.20 +
    align    * 0.15 +
    feedback * 0.15 +
    fresh    * 0.10 +
    meta     * 0.10
  )
}

export function rankItems(items, intent, signals) {
  return items
    .map((it) => ({ it, s: scoreItem(it, intent, signals) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.it)
}

// Domain diversity: cap each domain to `perDomainCap` results in the top `topN`,
// then append the rest in their original (already-ranked) order.
export function diversify(items, perDomainCap = 2, topN = 30) {
  const counts = new Map()
  const top = []
  const overflow = []
  for (const it of items) {
    const host = hostOf(it.url) || it.source || 'unknown'
    const c = counts.get(host) || 0
    if (c < perDomainCap && top.length < topN) {
      counts.set(host, c + 1)
      top.push(it)
    } else {
      overflow.push(it)
    }
  }
  return [...top, ...overflow]
}
