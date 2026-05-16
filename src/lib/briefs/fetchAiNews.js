// HN Algolia serves Access-Control-Allow-Origin: * — call directly, no proxy needed.
const HN_API = 'https://hn.algolia.com/api/v1/search_by_date'

// Reddit's JSON API now requires OAuth. Use their public RSS feed via rss2json
// (same intermediary used by aggregate.js) so no auth or proxy is needed.
const REDDIT_RSS_URL = encodeURIComponent(
  'https://www.reddit.com/r/MachineLearning+artificial/top.rss?t=day&limit=25',
)
const REDDIT_RSS2JSON = `https://api.rss2json.com/v1/api.json?rss_url=${REDDIT_RSS_URL}`

/**
 * Deduplicates stories by URL, keeping the one with the highest score.
 *
 * @param {object[]} stories — array of { id, url, title, score, source }
 * @returns {object[]}
 */
export function deduplicateStories(stories) {
  const byUrl = new Map()
  for (const story of stories) {
    const key = story.url ?? story.id
    const existing = byUrl.get(key)
    if (!existing || story.score > existing.score) {
      byUrl.set(key, story)
    }
  }
  return Array.from(byUrl.values())
}

async function fetchHnAiStories() {
  const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
  const url = `${HN_API}?query=AI+machine+learning+LLM&tags=story&numericFilters=created_at_i>${since},points>=50&hitsPerPage=30`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HN fetch failed: ${res.status}`)
  const data = await res.json()
  return (data.hits ?? []).map((h) => ({
    id: `hn-${h.objectID}`,
    url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
    title: h.title,
    score: h.points ?? 0,
    comments: h.num_comments ?? 0,
    source: 'Hacker News',
  }))
}

async function fetchRedditAiStories() {
  const res = await fetch(REDDIT_RSS2JSON)
  if (!res.ok) throw new Error(`Reddit RSS fetch failed: ${res.status}`)
  const data = await res.json()
  if (data.status !== 'ok') throw new Error(`rss2json error: ${data.message ?? data.status}`)
  return (data.items ?? []).map((item) => ({
    id: `reddit-${encodeURIComponent(item.link ?? item.guid ?? item.title)}`,
    url: item.link ?? '',
    title: item.title ?? '',
    score: 0, // RSS feeds don't include upvote scores
    comments: 0,
    source: 'r/MachineLearning',
  }))
}

/**
 * Fetches AI news stories from Hacker News and Reddit, deduplicates by URL,
 * and returns the merged list sorted by score descending.
 *
 * Failures from individual sources are swallowed — the other source's
 * results are still returned.
 *
 * @returns {Promise<object[]>}
 */
export async function fetchAiNews() {
  const [hnResult, redditResult] = await Promise.allSettled([
    fetchHnAiStories(),
    fetchRedditAiStories(),
  ])

  const hnStories = hnResult.status === 'fulfilled' ? hnResult.value : []
  const redditStories = redditResult.status === 'fulfilled' ? redditResult.value : []

  const merged = [...hnStories, ...redditStories]
  const deduped = deduplicateStories(merged)

  return deduped.sort((a, b) => b.score - a.score)
}
