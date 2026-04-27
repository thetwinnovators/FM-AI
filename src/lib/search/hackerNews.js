const HN_BASE = '/api/hn/api/v1'

export async function searchHackerNews(query, limit = 10, signal) {
  if (!query || !query.trim()) return []
  const url = `${HN_BASE}/search?query=${encodeURIComponent(query.trim())}&tags=story&hitsPerPage=${limit}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`HN search failed: ${res.status}`)
  const json = await res.json()
  return (json.hits || []).map(toItem)
}

function toItem(hit) {
  const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`
  const isExternal = Boolean(hit.url)
  return {
    id: `hn_${hit.objectID}`,
    type: 'article',
    title: hit.title || hit.story_title || '(untitled)',
    url,
    source: isExternal ? `Hacker News · ${new URL(url).hostname.replace(/^www\./, '')}` : 'Hacker News',
    creatorId: null,
    publishedAt: hit.created_at?.slice(0, 10) || null,
    summary: buildSummary(hit),
    keyPoints: [],
    topicIds: [],
    toolIds: [],
    conceptIds: [],
    tagIds: [],
    raw: { points: hit.points, comments: hit.num_comments, author: hit.author },
  }
}

function buildSummary(hit) {
  const parts = []
  if (hit.author) parts.push(`by ${hit.author}`)
  if (typeof hit.points === 'number') parts.push(`${hit.points} pts`)
  if (typeof hit.num_comments === 'number') parts.push(`${hit.num_comments} comments`)
  return parts.join(' · ')
}
