import { getCached, setCached } from './search/cache.js'

const TTL = 7 * 24 * 60 * 60 * 1000  // 7 days

export const AVAIL_UNKNOWN = null
export const AVAIL_YES = true
export const AVAIL_NO = false

// Synchronous cache lookup. Returns true / false / null (unknown / cache miss).
export function cachedYouTubeAvailability(youtubeId) {
  if (!youtubeId) return AVAIL_NO
  const cached = getCached(`yt:${youtubeId}`, TTL)
  if (cached === 'yes') return AVAIL_YES
  if (cached === 'no') return AVAIL_NO
  return AVAIL_UNKNOWN
}

// Async check via noembed.com (CORS-enabled wrapper around YouTube's oEmbed).
// noembed returns { error: '...' } when the video is private / deleted / geoblocked.
// On network errors we return true ("permissive") so we don't blanket-hide everything.
export async function isYouTubeAvailable(youtubeId) {
  if (!youtubeId) return false
  const cached = cachedYouTubeAvailability(youtubeId)
  if (cached !== AVAIL_UNKNOWN) return cached
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`)
    if (!res.ok) return true
    const json = await res.json()
    const ok = !json.error && Boolean(json.title)
    setCached(`yt:${youtubeId}`, ok ? 'yes' : 'no')
    return ok
  } catch {
    return true
  }
}
