// SearXNG broad-web adapter. Calls a local Vite proxy (`/api/searxng`) which
// forwards to a self-hosted (or configured) SearXNG instance. The proxy hop
// sidesteps CORS; without it, every public instance rejects browser callers.
//
// Failures are surfaced via dev-only console warnings (throttled) so you can
// tell when the instance silently stops responding instead of just noticing
// strange result gaps. The adapter NEVER throws — on any failure it returns
// an empty array, leaving the rest of the search pipeline untouched.

import { SEARCH_CONFIG } from './searchConfig.js'
import { extractYouTubeId } from '../manualIngest.js'

let lastErrorAt = 0
const ERROR_LOG_INTERVAL_MS = 30_000

function devWarn(message, detail) {
  if (!import.meta.env?.DEV) return
  const now = Date.now()
  if (now - lastErrorAt < ERROR_LOG_INTERVAL_MS) return
  lastErrorAt = now
  // Single grouped line keeps the console scannable.
  console.warn('[SearXNG]', message, detail ?? '')
}

// `opts.category` overrides the default `general` category — used by the
// `videos` lane in aggregate.js to query video-specific engines.
export async function searchSearxng(query, limit = 15, signal, opts = {}) {
  if (!SEARCH_CONFIG.searxngEnabled) return []
  if (!query || !query.trim()) return []

  const category = opts.category || SEARCH_CONFIG.searxngCategories
  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    categories: category,
    language: SEARCH_CONFIG.searxngLanguage,
    safesearch: String(SEARCH_CONFIG.searxngSafeSearch),
  })
  if (SEARCH_CONFIG.searxngTimeRange) params.set('time_range', SEARCH_CONFIG.searxngTimeRange)

  const url = `${SEARCH_CONFIG.searxngBaseUrl}/search?${params.toString()}`

  // Compose a timeout signal alongside any caller-provided AbortSignal.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), SEARCH_CONFIG.searxngTimeoutMs)
  const onCallerAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onCallerAbort)

  let res
  try {
    res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } })
  } catch (err) {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onCallerAbort)
    if (signal?.aborted || err?.name === 'AbortError') return []
    devWarn(
      'Network error reaching SearXNG. Is the instance running? Check the proxy target in vite.config.js.',
      err?.message,
    )
    return []
  }
  clearTimeout(timer)
  signal?.removeEventListener('abort', onCallerAbort)

  if (!res.ok) {
    devWarn(
      `SearXNG returned HTTP ${res.status}. ` +
      (res.status === 429 ? 'Rate-limited — public instances do this aggressively; consider self-hosting.' :
       res.status === 403 ? 'Forbidden — instance is blocking programmatic clients.' :
       res.status >= 500 ? 'Instance is having problems; try again or switch instance.' :
       'Unexpected status.'),
      url,
    )
    return []
  }

  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    devWarn(
      'SearXNG returned non-JSON. The instance probably has format=json disabled or returned an HTML challenge page.',
      `content-type: ${ct}`,
    )
    return []
  }

  const results = Array.isArray(json?.results) ? json.results : []
  return results.slice(0, limit).map((r) => toItem(r, category)).filter(Boolean)
}

// Convenience wrapper for the `videos` lane — drops non-YouTube hits since
// FlowMap's VideoCard + VideoPlayerModal embed flow requires a youtubeId.
export async function searchSearxngVideos(query, limit = 8, signal) {
  return searchSearxng(query, limit, signal, { category: 'videos' })
}

function toItem(r, category) {
  if (!r?.url) return null
  let host = ''
  try { host = new URL(r.url).hostname.replace(/^www\./, '') } catch { return null }

  // Videos category — only keep YouTube hits (we can extract a watch ID and
  // embed via the existing modal). SearXNG also returns Invidious / Vimeo /
  // Bitchute results here; skip those since we can't render them.
  if (category === 'videos') {
    const youtubeId = extractYouTubeId(r.url)
    if (!youtubeId) return null
    return {
      id: `searxng_yt_${youtubeId}`,
      type: 'video',
      title: r.title || r.url,
      url: `https://www.youtube.com/watch?v=${youtubeId}`,
      source: `YouTube · ${r.author || host}`,
      creatorId: null,
      publishedAt: r.publishedDate || r.published_date || null,
      summary: ((r.content || '').slice(0, 280)).trim() || null,
      keyPoints: [],
      topicIds: [],
      toolIds: [],
      conceptIds: [],
      tagIds: [],
      thumbnail: r.img_src || r.thumbnail || `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`,
      youtubeId,
    }
  }

  const idHash = host + ':' + (r.title || '').slice(0, 32).replace(/\s+/g, '_')
  return {
    id: `searxng_${idHash}`,
    type: 'article',
    title: r.title || r.url,
    url: r.url,
    source: `Web · ${host}`,
    creatorId: null,
    publishedAt: r.publishedDate || r.published_date || null,
    summary: ((r.content || '').slice(0, 280)).trim() || null,
    keyPoints: [],
    topicIds: [],
    toolIds: [],
    conceptIds: [],
    tagIds: [],
    thumbnail: r.img_src || r.thumbnail || null,
  }
}
