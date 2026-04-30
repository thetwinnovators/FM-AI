// Manual URL ingest — paste a YouTube link or article URL, fetch metadata via
// microlink, and turn it into a normalized content item ready to save into a topic.
import { getMeta } from './search/ogImage.js'

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'])

export function isValidUrl(s) {
  if (!s || typeof s !== 'string') return false
  try { const u = new URL(s.trim()); return u.protocol === 'http:' || u.protocol === 'https:' } catch { return false }
}

export function detectProvider(url) {
  try {
    const u = new URL(url)
    if (YOUTUBE_HOSTS.has(u.hostname)) return 'youtube'
    return 'article'
  } catch {
    return 'unknown'
  }
}

export function extractYouTubeId(url) {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null
    }
    const v = u.searchParams.get('v')
    if (v) return v
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') return parts[1] || null
    return null
  } catch {
    return null
  }
}

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid', 'mc_cid', 'mc_eid', 'igshid', 'ref', 'ref_src', 'ref_url',
]

export function canonicalizeUrl(url) {
  try {
    const u = new URL(url.trim())
    u.hash = ''
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p)
    let s = u.toString()
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1)
    return s
  } catch {
    return url.trim()
  }
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// YouTube oEmbed via noembed.com — used as a fallback when microlink doesn't
// return enough metadata. Returns the same shape as getMeta() or null.
async function fetchYouTubeOembed(url) {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`)
    if (!res.ok) return null
    const json = await res.json()
    if (!json || json.error) return null
    return {
      title: json.title || null,
      author: json.author_name || null,
      publisher: json.provider_name || 'YouTube',
      image: json.thumbnail_url || null,
      description: null,
      url: json.url || url,
    }
  } catch {
    return null
  }
}

// Returns one of:
//   { status: 'success', item: <ContentItem>, meta }
//   { status: 'error', errorCode, message }
export async function fetchPreview(rawUrl) {
  if (!isValidUrl(rawUrl)) {
    return { status: 'error', errorCode: 'invalid_url', message: 'That doesn\'t look like a valid URL.' }
  }
  const canonical = canonicalizeUrl(rawUrl)
  const provider = detectProvider(canonical)
  if (provider === 'unknown') {
    return { status: 'error', errorCode: 'unsupported', message: 'Unsupported provider.' }
  }

  if (provider === 'youtube') {
    const youtubeId = extractYouTubeId(canonical)
    if (!youtubeId) {
      return { status: 'error', errorCode: 'invalid_url', message: 'Could not find a YouTube video ID in that URL.' }
    }
    // microlink first; if it misses, fall back to YouTube oEmbed (noembed) — that
    // endpoint always returns title + thumbnail + channel for any public video.
    let meta = await getMeta(canonical)
    if (!meta?.title) {
      const oembed = await fetchYouTubeOembed(canonical)
      if (oembed?.title) meta = { ...(meta || {}), ...oembed }
    }
    const title = meta?.title || null
    const image = meta?.image || `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`
    if (!title) {
      return { status: 'error', errorCode: 'metadata_missing', message: 'Couldn\'t fetch enough metadata for this video. It may be private, deleted, or region-locked.' }
    }
    const channel = meta?.author || meta?.publisher || 'YouTube'
    return {
      status: 'success',
      provider: 'youtube',
      meta,
      item: {
        id: `manual_yt_${youtubeId}`,
        type: 'video',
        title,
        url: canonical,
        source: `YouTube · ${channel}`,
        creatorId: null,
        publishedAt: null,
        summary: meta?.description || null,
        keyPoints: [],
        topicIds: [],
        toolIds: [],
        conceptIds: [],
        tagIds: [],
        thumbnail: image,
        youtubeId,
      },
    }
  }

  // Article
  const meta = await getMeta(canonical)
  const title = meta?.title || null
  const image = meta?.image || null
  if (!title) {
    return { status: 'error', errorCode: 'metadata_missing', message: 'Couldn\'t fetch enough metadata for this URL.' }
  }
  if (!image) {
    return { status: 'error', errorCode: 'no_image', message: 'No preview image available for this URL.' }
  }
  const host = hostOf(canonical)
  return {
    status: 'success',
    provider: 'article',
    meta,
    item: {
      id: `manual_art_${host}_${title.slice(0, 40).replace(/[^a-z0-9]+/gi, '_')}`,
      type: 'article',
      title,
      url: canonical,
      source: meta?.publisher ? `Web · ${meta.publisher}` : `Web · ${host}`,
      creatorId: null,
      publishedAt: null,
      summary: meta?.description || null,
      keyPoints: [],
      topicIds: [],
      toolIds: [],
      conceptIds: [],
      tagIds: [],
      thumbnail: image,
    },
  }
}
