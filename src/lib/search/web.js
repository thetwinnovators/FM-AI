// Jina AI Search — free general-web search API. Returns title + url + description
// from across the web. CORS-friendly, no API key required for moderate volume
// (rate-limited per IP). On failure (rate limit, downtime), returns empty silently.
const JINA_BASE = 'https://s.jina.ai'

export async function searchWeb(query, limit = 10, signal) {
  if (!query || !query.trim()) return []
  try {
    const url = `${JINA_BASE}/${encodeURIComponent(query.trim())}`
    const res = await fetch(url, {
      signal,
      headers: {
        'Accept': 'application/json',
        'X-Respond-With': 'no-content',  // skip full-page extraction, faster
      },
    })
    if (!res.ok) return []
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { return [] }
    const results = json.data || json.results || []
    return results.slice(0, limit).map(toItem).filter(Boolean)
  } catch {
    return []
  }
}

function toItem(d) {
  if (!d.url) return null
  let host = ''
  try { host = new URL(d.url).hostname.replace(/^www\./, '') } catch { return null }
  // Stable id from url so repeats dedupe
  const idHash = host + ':' + (d.title || '').slice(0, 32).replace(/\s+/g, '_')
  return {
    id: `web_${idHash}`,
    type: 'article',
    title: d.title || d.url,
    url: d.url,
    source: `Web · ${host}`,
    creatorId: null,
    publishedAt: null,
    summary: ((d.description || d.content || '').slice(0, 280)).trim() || null,
    keyPoints: [],
    topicIds: [],
    toolIds: [],
    conceptIds: [],
    tagIds: [],
  }
}
