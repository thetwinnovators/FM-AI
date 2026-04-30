import { getCached, setCached } from './cache.js'

const META_TTL = 7 * 24 * 60 * 60 * 1000
const FAIL_TTL = 60 * 60 * 1000 // retry failed fetches after 1 hour

// Wikipedia article URL? Pull metadata via Wikipedia's own REST API — faster,
// more reliable, never rate-limits us like microlink does, and CORS is allowed.
function parseWikipediaUrl(url) {
  try {
    const u = new URL(url)
    if (!/\.wikipedia\.org$/.test(u.hostname) && u.hostname !== 'wikipedia.org') return null
    const m = u.pathname.match(/^\/wiki\/(.+)$/)
    if (!m) return null
    const lang = u.hostname.split('.')[0] || 'en'
    return { lang, title: decodeURIComponent(m[1]) }
  } catch {
    return null
  }
}

async function getWikipediaMeta(url) {
  const parsed = parseWikipediaUrl(url)
  if (!parsed) return null
  try {
    const apiUrl = `https://${parsed.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(parsed.title)}`
    const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) return null
    const d = await res.json()
    return {
      image: d.thumbnail?.source || d.originalimage?.source || null,
      description: d.extract || null,
      title: d.title || null,
      author: null,
      publisher: 'Wikipedia',
      url: d.content_urls?.desktop?.page || url,
    }
  } catch {
    return null
  }
}

// Returns { image, description, title, author, publisher, url } from the page's
// Open Graph / standard metadata. Wikipedia URLs use the Wikipedia REST API
// (preferred — fast, no rate limit). Everything else falls back to microlink.
// Cached 7 days. Returns null on miss or failure.
export async function getMeta(url) {
  if (!url) return null
  const cacheKey = `meta:${url}`
  const cached = getCached(cacheKey, META_TTL)
  if (cached !== null) {
    if (cached) return cached // success — use 7-day cache
    // empty-string = cached failure; only block retry within 1 hour
    if (getCached(cacheKey, FAIL_TTL) !== null) return null
    // failure is older than 1 hour — fall through and retry
  }

  // Wikipedia path first — bypasses microlink for any /wiki/ URL.
  const wiki = await getWikipediaMeta(url)
  if (wiki && wiki.image) {
    setCached(cacheKey, wiki)
    return wiki
  }

  try {
    const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
    if (!res.ok) {
      if (res.status === 429) return null // rate-limited — don't cache so next render retries
      setCached(cacheKey, '')
      return null
    }
    const json = await res.json()
    if (json?.status !== 'success') {
      setCached(cacheKey, '')
      return null
    }
    const d = json.data || {}
    const meta = {
      image: d.image?.url || d.logo?.url || null,
      description: d.description || null,
      title: d.title || null,
      author: d.author || null,
      publisher: d.publisher || null,
      url: d.url || url,
    }
    setCached(cacheKey, meta)
    return meta
  } catch {
    setCached(cacheKey, '')
    return null
  }
}

// Back-compat thin wrapper.
export async function getOgImage(url) {
  const meta = await getMeta(url)
  return meta?.image || null
}
