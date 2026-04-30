import { searchHackerNews } from './hackerNews.js'
import { searchReddit } from './reddit.js'
import { searchYouTube } from './youtube.js'
import { searchWeb } from './web.js'
import { searchSearxng, searchSearxngVideos } from './searxng.js'
import { searchWikipedia } from './wikipedia.js'
import { searchNews } from './news.js'
import { classify, CATEGORIES, CATEGORY_LABELS } from './classify.js'
import { getCached, setCached } from './cache.js'
import { interpretQuery, buildQueries } from './intent.js'
import { rankItems, diversify } from './rank.js'
import { normalizeItem, dedupeItems } from './result.js'

const TTL_MS = 30 * 60 * 1000 // 30 minutes

async function fetchOneQuery(q, intent, signal) {
  const wantsArticle = intent.sourceTypes.includes('article')
  const wantsVideo = intent.sourceTypes.includes('video')

  const tasks = []
  if (wantsArticle) {
    // SearXNG broad-web metasearch — primary backbone for generic web queries
    // (when a self-hosted instance is reachable; logs cleanly + falls through
    // when not). See src/lib/search/searchConfig.js for setup.
    tasks.push(['SearXNG',     searchSearxng(q, 15, signal)])
    // Tech news (TechCrunch, The Verge, Ars, Wired, etc.) — strong domain signal.
    tasks.push(['Tech News',   searchNews(q, 12, signal)])
    // Jina single-engine web search — secondary broad-web signal that always
    // works without a local instance. Bumped from 8 to 15 so generic queries
    // surface meaningfully more web pages even when SearXNG is offline.
    tasks.push(['Web',         searchWeb(q, 15, signal)])
    // Hacker News, Reddit, and Wikipedia are intentionally disabled — too
    // much community / encyclopedia noise. Re-enable by uncommenting if you
    // want them back; their adapters are still imported.
    // tasks.push(['Hacker News', searchHackerNews(q, 8, signal)])
    // tasks.push(['Reddit',      searchReddit(q, { limit: 6 }, signal)])
    // tasks.push(['Wikipedia',   searchWikipedia(q, 2, signal)])
  }
  if (wantsVideo) {
    // Piped (free YouTube proxy) is unreliable — public instances frequently
    // fail. SearXNG's `videos` category fans out across multiple video engines
    // and surfaces YouTube hits even when Piped is down.
    tasks.push(['YouTube',         searchYouTube(q, 12, signal)])
    tasks.push(['SearXNG-videos',  searchSearxngVideos(q, 8, signal)])
  }

  const results = await Promise.allSettled(tasks.map(([, p]) => p))
  const items = []
  const errors = []
  results.forEach((r, i) => {
    const name = tasks[i][0]
    if (r.status === 'fulfilled') items.push(...r.value)
    else errors.push({ source: name, error: r.reason?.message || String(r.reason) })
  })
  return { items, errors }
}

// fetchAll(query, signal, opts?) — multi-lane retrieval with gated expansion.
//   opts.seed     — seed object (for topic-aware expansion)
//   opts.signals  — { saves, views, dismisses } from useStore (for feedback ranking)
//
// Lane 1 (exact query) always runs. Lane 2 (expansions) only runs if Lane 1
// returned fewer than EXACT_LANE_THRESHOLD results — this preserves query
// distinctness when the original query is strong, and falls back to broader
// retrieval only when needed. Final results are scored, ranked, and diversified
// per the relevance-fixes spec.
const EXACT_LANE_THRESHOLD = 12

export async function fetchAll(query, signal, opts = {}) {
  const q = (query || '').trim()
  if (!q) return { items: [], errors: [], intent: null, queries: [] }

  const intent = interpretQuery(q)

  // Cache by ORIGINAL query — different queries that happen to share expansions
  // no longer collapse to the same cached result set.
  const cacheKey = `all:${intent.normalizedQuery.toLowerCase()}`
  const cached = getCached(cacheKey, TTL_MS)
  if (cached) return cached

  // Lane 1 — exact query, all matching sources.
  const lane1 = await fetchOneQuery(intent.normalizedQuery, intent, signal)
  const items = [...lane1.items]
  const errors = [...lane1.errors]
  const queries = [intent.normalizedQuery]

  // Lane 2 — gated expansion. Only fan out when Lane 1 didn't already provide enough.
  if (items.length < EXACT_LANE_THRESHOLD) {
    const expansions = buildQueries(intent, opts.seed || null, 3).slice(1)
    if (expansions.length > 0) {
      const expansionResults = await Promise.all(
        expansions.map((qq) => fetchOneQuery(qq, intent, signal))
      )
      for (const r of expansionResults) {
        items.push(...r.items)
        errors.push(...r.errors)
      }
      queries.push(...expansions)
    }
  }

  // Stage 6 — minimum validation: drop items missing title or URL, plus a defensive
  // filter scrubbing any Dailymotion items that might surface from older state.
  const validated = items.filter((it) => {
    if (!it?.title || !it?.url) return false
    if (it.id?.startsWith('dm_')) return false
    if (it.dailymotionId) return false
    if ((it.source || '').toLowerCase().startsWith('dailymotion')) return false
    return true
  })

  // Stage 7 — Normalize into the shared ScoredItem shape (adds canonicalUrl,
  // domain, sourceType, and zeroed score sub-fields) so downstream stages see
  // a stable schema.
  const normalized = validated.map(normalizeItem)

  // Stage 8 — De-dupe by canonical URL, then collapse near-duplicate titles
  // (mirrored reposts, wire-feed republications). Honors per-source vs
  // cross-source thresholds from the ranking config.
  const deduped = dedupeItems(normalized)

  // Recency filter — anything published 2024-01-01 or later (items without a date stay)
  const recent = deduped.filter(isRecent)

  // Score by query-specific relevance with persisted sub-scores. Phase 3:
  // when a topicContext is passed, scoreTopicFit biases toward the user's
  // pattern for THIS topic specifically. Then apply graduated domain-diversity.
  const ranked = rankItems(recent, intent, opts.signals || null, opts.topicContext || null)
  const final = diversify(ranked)

  const result = { items: final, errors, intent, queries }
  if (final.length > 0) setCached(cacheKey, result)
  return result
}

export const RECENCY_CUTOFF_DATE = '2024-01-01'

export function isRecent(item) {
  if (!item?.publishedAt) return true
  // publishedAt is YYYY-MM-DD or ISO; lexical compare on the first 10 chars works for both.
  return String(item.publishedAt).slice(0, 10) >= RECENCY_CUTOFF_DATE
}

export function groupByCategory(items) {
  const groups = { uncategorized: [] }
  for (const cat of CATEGORIES) groups[cat] = []
  for (const item of items) {
    const cat = classify(item)
    const enriched = { ...item, category: cat }
    if (groups[cat]) groups[cat].push(enriched)
    else groups.uncategorized.push(enriched)
  }
  return groups
}

export function sortCategoryGroups(grouped) {
  const entries = Object.entries(grouped)
    .filter(([, items]) => items.length > 0)
    .map(([category, items]) => ({
      category,
      label: CATEGORY_LABELS[category] || (category === 'uncategorized' ? 'Uncategorized' : category),
      items,
    }))
  entries.sort((a, b) => {
    if (a.category === 'uncategorized') return 1
    if (b.category === 'uncategorized') return -1
    return b.items.length - a.items.length
  })
  return entries
}
