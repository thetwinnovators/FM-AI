import { searchHackerNews } from './hackerNews.js'
import { searchReddit } from './reddit.js'
import { searchYouTube } from './youtube.js'
import { searchWeb } from './web.js'
import { searchWikipedia } from './wikipedia.js'
import { searchNews } from './news.js'
import { classify, CATEGORIES, CATEGORY_LABELS } from './classify.js'
import { getCached, setCached } from './cache.js'
import { interpretQuery, buildQueries } from './intent.js'

const TTL_MS = 30 * 60 * 1000 // 30 minutes

async function fetchOneQuery(q, intent, signal) {
  const wantsArticle = intent.sourceTypes.includes('article')
  const wantsVideo = intent.sourceTypes.includes('video')

  const tasks = []
  if (wantsArticle) {
    // Tech news first (TechCrunch, The Verge, Ars, Wired, etc.) — biggest weight.
    tasks.push(['Tech News',   searchNews(q, 12, signal)])
    tasks.push(['Hacker News', searchHackerNews(q, 8, signal)])
    tasks.push(['Web',         searchWeb(q, 8, signal)])
    // Reddit + Wikipedia kept but trimmed — secondary signal, not primary.
    tasks.push(['Reddit',      searchReddit(q, { limit: 6 }, signal)])
    tasks.push(['Wikipedia',   searchWikipedia(q, 2, signal)])
  }
  if (wantsVideo) {
    tasks.push(['YouTube', searchYouTube(q, 12, signal)])
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

// fetchAll(query, signal, opts?) — opts.seed enables topic-aware expansion.
export async function fetchAll(query, signal, opts = {}) {
  const q = (query || '').trim()
  if (!q) return { items: [], errors: [], intent: null, queries: [] }

  const intent = interpretQuery(q)
  const queries = buildQueries(intent, opts.seed || null, 3)

  const cacheKey = `all:${queries.join('|').toLowerCase()}`
  const cached = getCached(cacheKey, TTL_MS)
  if (cached) return cached

  // Run each query against all matching sources in parallel, then merge.
  const perQueryResults = await Promise.all(
    queries.map((qq) => fetchOneQuery(qq, intent, signal))
  )

  const items = []
  const errors = []
  for (const r of perQueryResults) {
    items.push(...r.items)
    errors.push(...r.errors)
  }

  // Stage 6 — minimum validation: drop items missing title or URL (the things every
  // card needs to render). Image validation is best-effort on the card itself.
  const validated = items.filter((it) => Boolean(it?.title) && Boolean(it?.url))

  // Stage 7 — De-dupe across sources by URL (canonical-ish — we'd canonicalize
  // server-side in a real pipeline; here we lowercase + strip trailing slash).
  function urlKey(u) {
    if (!u) return ''
    return String(u).toLowerCase().replace(/\/+$/, '').replace(/[?#].*$/, '')
  }
  const seenUrls = new Set()
  const deduped = validated.filter((it) => {
    const key = urlKey(it.url)
    if (!key) return true
    if (seenUrls.has(key)) return false
    seenUrls.add(key)
    return true
  })

  // Recency filter — anything published 2024-01-01 or later (items without a date stay)
  const recent = deduped.filter(isRecent)

  const result = { items: recent, errors, intent, queries }
  if (recent.length > 0) setCached(cacheKey, result)
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
