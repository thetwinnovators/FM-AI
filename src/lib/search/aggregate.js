import { searchHackerNews } from './hackerNews.js'
import { searchReddit } from './reddit.js'
import { searchDailymotion } from './dailymotion.js'
import { searchYouTube } from './youtube.js'
import { searchWeb } from './web.js'
import { searchWikipedia } from './wikipedia.js'
import { classify, CATEGORIES, CATEGORY_LABELS } from './classify.js'
import { getCached, setCached } from './cache.js'

const TTL_MS = 30 * 60 * 1000 // 30 minutes

export async function fetchAll(query, signal) {
  const q = (query || '').trim()
  if (!q) return { items: [], errors: [] }

  const cacheKey = `all:${q.toLowerCase()}`
  const cached = getCached(cacheKey, TTL_MS)
  if (cached) return cached

  const [hnResult, redditResult, dmResult, ytResult, webResult, wikiResult] = await Promise.allSettled([
    searchHackerNews(q, 12, signal),
    searchReddit(q, {}, signal),
    searchDailymotion(q, 8, signal),
    searchYouTube(q, 12, signal),
    searchWeb(q, 12, signal),
    searchWikipedia(q, 6, signal),
  ])

  const items = []
  const errors = []
  function collect(name, r) {
    if (r.status === 'fulfilled') items.push(...r.value)
    else errors.push({ source: name, error: r.reason?.message || String(r.reason) })
  }
  collect('Hacker News', hnResult)
  collect('Reddit', redditResult)
  collect('Dailymotion', dmResult)
  collect('YouTube', ytResult)
  collect('Web', webResult)
  collect('Wikipedia', wikiResult)

  // De-dupe across sources by URL — the same article often shows up in multiple feeds
  const seenUrls = new Set()
  const deduped = items.filter((it) => {
    const key = (it.url || '').toLowerCase()
    if (!key) return true
    if (seenUrls.has(key)) return false
    seenUrls.add(key)
    return true
  })

  // Recency filter — past 9 months only (items without a date stay; we can't verify)
  const cutoff = Date.now() - RECENCY_WINDOW_MS
  const recent = deduped.filter((it) => {
    if (!it.publishedAt) return true
    const t = Date.parse(it.publishedAt)
    if (Number.isNaN(t)) return true
    return t >= cutoff
  })

  const result = { items: recent, errors }
  if (recent.length > 0) setCached(cacheKey, result)
  return result
}

export const RECENCY_WINDOW_MS = 9 * 30 * 24 * 60 * 60 * 1000  // ~9 months

export function isRecent(item) {
  if (!item?.publishedAt) return true
  const t = Date.parse(item.publishedAt)
  if (Number.isNaN(t)) return true
  return t >= Date.now() - RECENCY_WINDOW_MS
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
