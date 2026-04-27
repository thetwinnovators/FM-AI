// Wikipedia full-text search via the public MediaWiki API.
// CORS is allowed via origin=*. Always reliable, free, no key.
// Use as a stable fallback / supplement to general-web sources.
const WIKI_BASE = 'https://en.wikipedia.org/w/api.php'

export async function searchWikipedia(query, limit = 6, signal) {
  if (!query || !query.trim()) return []
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query.trim(),
    srlimit: String(limit),
    format: 'json',
    origin: '*',
  })
  let res
  try {
    res = await fetch(`${WIKI_BASE}?${params}`, { signal })
  } catch { return [] }
  if (!res.ok) return []
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { return [] }
  const results = json?.query?.search || []
  return results.map(toItem)
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, '')
}

function toItem(s) {
  const slug = (s.title || '').replace(/\s+/g, '_')
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`
  return {
    id: `wiki_${s.pageid}`,
    type: 'article',
    title: s.title || '(untitled)',
    url,
    source: 'Wikipedia',
    creatorId: null,
    publishedAt: s.timestamp ? s.timestamp.slice(0, 10) : null,
    summary: stripHtml(s.snippet) || null,
    keyPoints: [],
    topicIds: [],
    toolIds: [],
    conceptIds: [],
    tagIds: [],
  }
}
