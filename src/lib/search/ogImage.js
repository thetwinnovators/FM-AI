import { getCached, setCached } from './cache.js'

const META_TTL = 7 * 24 * 60 * 60 * 1000

// Returns { image, description, title, author, publisher, url } from the page's
// Open Graph / standard metadata via microlink.io. Cached 7 days.
// Returns null on miss or failure.
export async function getMeta(url) {
  if (!url) return null
  const cacheKey = `meta:${url}`
  const cached = getCached(cacheKey, META_TTL)
  if (cached !== null) return cached || null

  try {
    const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
    if (!res.ok) {
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
