import { searchHackerNews } from './hackerNews.js'
import { searchReddit } from './reddit.js'
import { searchDailymotion } from './dailymotion.js'
import { searchYouTube } from './youtube.js'
import { classify, CATEGORIES, CATEGORY_LABELS } from './classify.js'
import { getCached, setCached } from './cache.js'

const TTL_MS = 30 * 60 * 1000 // 30 minutes

export async function fetchAll(query, signal) {
  const q = (query || '').trim()
  if (!q) return { items: [], errors: [] }

  const cacheKey = `all:${q.toLowerCase()}`
  const cached = getCached(cacheKey, TTL_MS)
  if (cached) return cached

  const [hnResult, redditResult, dmResult, ytResult] = await Promise.allSettled([
    searchHackerNews(q, 12, signal),
    searchReddit(q, {}, signal),
    searchDailymotion(q, 8, signal),
    searchYouTube(q, 12, signal),
  ])

  const items = []
  const errors = []
  if (hnResult.status === 'fulfilled') items.push(...hnResult.value)
  else errors.push({ source: 'Hacker News', error: hnResult.reason?.message || String(hnResult.reason) })
  if (redditResult.status === 'fulfilled') items.push(...redditResult.value)
  else errors.push({ source: 'Reddit', error: redditResult.reason?.message || String(redditResult.reason) })
  if (dmResult.status === 'fulfilled') items.push(...dmResult.value)
  else errors.push({ source: 'Dailymotion', error: dmResult.reason?.message || String(dmResult.reason) })
  if (ytResult.status === 'fulfilled') items.push(...ytResult.value)
  else errors.push({ source: 'YouTube', error: ytResult.reason?.message || String(ytResult.reason) })

  const result = { items, errors }
  if (items.length > 0) setCached(cacheKey, result)
  return result
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
