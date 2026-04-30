// Phase 1 ranking refactor: each score component is its own function reading
// from `RANKING_CONFIG`, results are persisted on the item (so future phases
// and any "why was this ranked here" UI can read sub-scores without a re-rank),
// and the final number is just a transparent sum.
//
// Behavior is intentionally close to the previous ranker for first-cut parity;
// tuning happens in `rankingConfig.js`, not here.

import { RANKING_CONFIG } from './rankingConfig.js'
import { scoreTopicFit } from './topicContext.js'

function tokenize(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

// --- Component scores (each returns 0..1) ----------------------------------

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

function metadataCompleteness(item) {
  let s = 0
  if (item.title)       s += 0.30
  if (item.summary)     s += 0.30
  if (item.thumbnail)   s += 0.25
  if (item.publishedAt) s += 0.15
  return Math.min(1.0, s)
}

function freshnessScoreOf(item) {
  const cfg = RANKING_CONFIG.freshness
  if (!item.publishedAt) return cfg.unknown
  const t = Date.parse(item.publishedAt)
  if (Number.isNaN(t)) return cfg.unknown
  const ageDays = (Date.now() - t) / 86_400_000
  for (const band of cfg.bands) {
    if (ageDays < band.days) return band.score
  }
  return cfg.older
}

function intentAlignment(item, intent) {
  if (!intent || !intent.sourceTypes || intent.sourceTypes.length >= 2) return 0.7
  // intent.sourceTypes uses the rendering taxonomy ('video' | 'article'),
  // so we still align against item.type for back-compat.
  return intent.sourceTypes.includes(item.type) ? 1.0 : 0.2
}

function authorityScoreOf(item) {
  const { authorityBonus, authorityBonusSuffix } = RANKING_CONFIG
  const host = item.domain || ''
  if (!host) return 0
  if (authorityBonus[host]) return authorityBonus[host]
  for (const [suffix, bonus] of Object.entries(authorityBonusSuffix || {})) {
    if (host.endsWith(suffix)) return bonus
  }
  return 0
}

function feedbackAffinity(item, signals) {
  if (!signals) return 0.5
  if (signals.dismisses?.[item.id]) return 0
  let domainBoost = 0
  const itemHost = item.domain || ''
  if (itemHost && signals.saves) {
    for (const id of Object.keys(signals.saves)) {
      const saved = signals.saves[id]?.item
      if (saved?.url) {
        try {
          if (new URL(saved.url).hostname.replace(/^www\./, '') === itemHost) {
            domainBoost = 0.4
            break
          }
        } catch { /* ignore bad URLs */ }
      }
    }
  }
  const views = signals.views?.[item.id]?.count || 0
  const viewBoost = Math.min(0.3, views * 0.1)
  return Math.min(1.0, 0.5 + domainBoost + viewBoost)
}

// --- Composition ----------------------------------------------------------

function computeBaseScore(item, intent) {
  const split = RANKING_CONFIG.baseSplit
  const exact  = exactPhraseMatch(item, intent?.normalizedQuery)
  const tokens = tokenOverlap(item, intent?.normalizedQuery)
  const meta   = metadataCompleteness(item)
  return exact * split.exact + tokens * split.tokens + meta * split.meta
}

function sourceMultiplier(item) {
  const map = RANKING_CONFIG.sourceWeight
  if (!item.source) return map.default
  // Item source labels look like "Tech News · TechCrunch" or "YouTube · Channel".
  // Match on the prefix before " · ".
  const head = String(item.source).split(' · ')[0].trim()
  return map[head] ?? map.default
}

// Phase 2: per-(queryIntent, sourceType) multiplier from RANKING_CONFIG.intentSourceBoost.
// When the query has multiple intents (e.g. "what is mcp" → explainer + concept + reference),
// take the strongest matching boost rather than averaging — the user's strongest signal wins.
function intentSourceMultiplier(item, intent) {
  const intents = intent?.queryIntents
  if (!intents?.length) return 1.0
  const matrix = RANKING_CONFIG.intentSourceBoost
  let best = 1.0
  let touched = false
  for (const label of intents) {
    const row = matrix[label]
    if (!row) continue
    const boost = row[item.sourceType]
    if (typeof boost !== 'number') continue
    touched = true
    if (boost > best) best = boost
  }
  // If the intent matrix said nothing about this sourceType, leave neutral.
  return touched ? best : 1.0
}

// Phase 2/3: bump freshness weight when the query is freshness-sensitive
// ("latest X", "X 2026") OR when the topic's search history is mostly
// freshness-sensitive (>50% of past queries on this topic asked for "latest").
function freshnessWeightFor(intent, topicContext) {
  if (intent?.freshSensitive) return 0.20
  if (topicContext?.freshSensitiveRate >= 0.5) return 0.16
  return RANKING_CONFIG.weights.freshness
}

// Public: scores an item, mutates score sub-fields onto a copy, returns it.
// `topicContext` is optional — when null, scoreTopicFit contributes 0.
export function scoreItem(item, intent, signals, topicContext = null) {
  const w = RANKING_CONFIG.weights
  const scoreBase      = computeBaseScore(item, intent)
  const scoreFreshness = freshnessScoreOf(item)
  const scoreIntent    = intentAlignment(item, intent)
  const scoreAuthority = authorityScoreOf(item)
  const scoreFeedback  = feedbackAffinity(item, signals)
  const topicFit       = topicContext ? scoreTopicFit(item, topicContext) : 0

  const freshW = freshnessWeightFor(intent, topicContext)
  const preMul =
    w.base      * scoreBase
    + freshW      * scoreFreshness
    + w.intent    * scoreIntent
    + w.authority * scoreAuthority
    + w.feedback  * scoreFeedback
    + w.topicFit  * topicFit

  const scoreFinal = preMul * sourceMultiplier(item) * intentSourceMultiplier(item, intent)
  return {
    ...item,
    scoreBase,
    scoreFreshness,
    scoreIntent,
    scoreAuthority,
    scoreFeedback,
    scoreTopicFit: topicFit,
    scoreDiversityPenalty: item.scoreDiversityPenalty ?? 0,
    scoreFinal,
    queryIntent: intent?.queryIntents || [],
  }
}

export function rankItems(items, intent, signals, topicContext = null) {
  return items
    .map((it) => scoreItem(it, intent, signals, topicContext))
    .sort((a, b) => b.scoreFinal - a.scoreFinal)
}

// Graduated domain-diversity penalty. The first `softCap` items per domain are
// untouched; each subsequent same-domain item in the rank window has
// `penaltyPerExtra` subtracted from its `scoreFinal` and the list re-sorted.
// Items past `rankWindow` keep their order but don't count against the cap.
export function diversify(items, _legacyCap, _legacyTopN) {
  const cfg = RANKING_CONFIG.diversity
  const softCap = cfg.softCap
  const penalty = cfg.penaltyPerExtra
  const window = cfg.rankWindow

  const counts = new Map()
  const head = items.slice(0, window)
  const tail = items.slice(window)

  const adjusted = head.map((it) => {
    const host = it.domain || it.source || 'unknown'
    const c = counts.get(host) || 0
    counts.set(host, c + 1)
    if (c < softCap) return it
    const extra = c - softCap + 1
    const penaltyAmount = penalty * extra
    return {
      ...it,
      scoreDiversityPenalty: (it.scoreDiversityPenalty || 0) + penaltyAmount,
      scoreFinal: (it.scoreFinal || 0) - penaltyAmount,
    }
  })

  adjusted.sort((a, b) => (b.scoreFinal || 0) - (a.scoreFinal || 0))
  return [...adjusted, ...tail]
}
