// YouTube search via Piped — an open-source YouTube proxy network. No API key needed.
// Public instances come and go; we try a few in priority order. Returns standard
// video items with `youtubeId` set so the existing VideoPlayerModal embeds them via
// the YouTube iframe (works regardless of whether Piped's hosting stays up).
const PIPED_BASES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api-piped.mha.fi',
]

export async function searchYouTube(query, limit = 10, signal) {
  if (!query || !query.trim()) return []
  for (const base of PIPED_BASES) {
    try {
      const url = `${base}/search?q=${encodeURIComponent(query.trim())}&filter=videos`
      const res = await fetch(url, { signal, headers: { 'Accept': 'application/json' } })
      if (!res.ok) continue
      const text = await res.text()
      let json
      try { json = JSON.parse(text) } catch { continue }
      const items = (json.items || []).slice(0, limit).map(toItem).filter(Boolean)
      if (items.length > 0) return items
    } catch {
      // try next instance
    }
  }
  return []
}

function toItem(p) {
  if (p.type && p.type !== 'stream') return null
  const m = (p.url || '').match(/[?&]v=([\w-]+)/)
  const id = m?.[1]
  if (!id) return null
  return {
    id: `yt_${id}`,
    type: 'video',
    title: p.title || '(untitled)',
    url: `https://www.youtube.com/watch?v=${id}`,
    source: `YouTube · ${p.uploaderName || 'creator'}`,
    creatorId: null,
    publishedAt: p.uploaded ? new Date(p.uploaded).toISOString().slice(0, 10) : null,
    summary: p.shortDescription || null,
    keyPoints: [],
    topicIds: [],
    toolIds: [],
    conceptIds: [],
    tagIds: [],
    thumbnail: p.thumbnail || `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    durationSec: p.duration || null,
    youtubeId: id,
  }
}
