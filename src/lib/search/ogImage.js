import { getCached, setCached } from './cache.js'

// 7 days — OG images rarely change.
const OG_TTL = 7 * 24 * 60 * 60 * 1000

// Microlink.io free tier: ~50 requests / day per IP. For a personal tool that's plenty
// once the cache is warm. Returns the og:image URL, or null on miss / failure.
export async function getOgImage(url) {
  if (!url) return null
  const cacheKey = `og:${url}`
  const cached = getCached(cacheKey, OG_TTL)
  if (cached !== null) return cached || null

  try {
    const api = `https://api.microlink.io?url=${encodeURIComponent(url)}`
    const res = await fetch(api)
    if (!res.ok) {
      setCached(cacheKey, '')
      return null
    }
    const json = await res.json()
    const img = json?.data?.image?.url || json?.data?.logo?.url || null
    setCached(cacheKey, img || '')
    return img
  } catch {
    setCached(cacheKey, '')
    return null
  }
}
