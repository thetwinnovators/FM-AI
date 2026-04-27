// Tech news search via Google News RSS, fetched through rss2json.com (CORS-friendly,
// free tier ~10k requests/day shared). Returns articles from mainstream tech outlets:
// TechCrunch, The Verge, Ars Technica, Wired, MIT Tech Review, Engadget, etc.
const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json'

function buildGoogleNewsRss(query) {
  const params = new URLSearchParams({ q: query, hl: 'en-US', gl: 'US', ceid: 'US:en' })
  return `https://news.google.com/rss/search?${params}`
}

function stripHtml(s) {
  return String(s || '').replace(/<[^>]*>/g, '').trim()
}

// Google News links wrap the original URL inside the description's <a href="...">.
// Pull the real one out so cards open the publisher directly, not the Google redirect.
function extractRealUrl(item) {
  const desc = item.description || item.content || ''
  const match = desc.match(/href="([^"]+)"/)
  if (match && !match[1].includes('news.google.com')) return match[1]
  return item.link
}

// Title format from Google News is usually: "Article title - Publisher Name"
function splitTitleAndPublisher(rawTitle) {
  const idx = rawTitle.lastIndexOf(' - ')
  if (idx === -1) return { title: rawTitle, publisher: null }
  return { title: rawTitle.slice(0, idx).trim(), publisher: rawTitle.slice(idx + 3).trim() }
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' }
}

export async function searchNews(query, limit = 12, signal) {
  if (!query || !query.trim()) return []
  const rssUrl = buildGoogleNewsRss(query.trim())
  const apiUrl = `${RSS2JSON_BASE}?rss_url=${encodeURIComponent(rssUrl)}&count=${limit}`

  let res
  try {
    res = await fetch(apiUrl, { signal })
  } catch { return [] }
  if (!res.ok) return []
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { return [] }
  if (json.status !== 'ok') return []
  return (json.items || []).slice(0, limit).map(toItem).filter(Boolean)
}

function toItem(it) {
  const url = extractRealUrl(it)
  if (!url) return null
  const { title, publisher } = splitTitleAndPublisher(it.title || '')
  const host = hostOf(url)
  const sourceLabel = publisher || host || 'News'
  return {
    id: `news_${host}:${(title || '').slice(0, 40).replace(/\s+/g, '_')}`,
    type: 'article',
    title: title || it.title || url,
    url,
    source: `News · ${sourceLabel}`,
    creatorId: null,
    publishedAt: it.pubDate ? new Date(it.pubDate).toISOString().slice(0, 10) : null,
    summary: stripHtml(it.description || it.content || '').slice(0, 280) || null,
    keyPoints: [],
    topicIds: [],
    toolIds: [],
    conceptIds: [],
    tagIds: [],
    thumbnail: it.thumbnail || null,
  }
}
