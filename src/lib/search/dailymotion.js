// Dailymotion's public Data API. CORS is permissive — direct fetch from the browser
// works without auth. We previously routed through the Vite proxy but that turned out
// to interfere; direct calls are reliable. The fields list is appended raw (no
// encoding of the commas) since the API expects them literal.
const DM_BASE = 'https://api.dailymotion.com'

const FIELDS = 'id,title,description,thumbnail_360_url,thumbnail_720_url,owner.username,created_time,duration,url'

export async function searchDailymotion(query, limit = 10, signal) {
  if (!query || !query.trim()) return []
  const url = `${DM_BASE}/videos?search=${encodeURIComponent(query.trim())}&fields=${FIELDS}&limit=${limit}&sort=relevance`
  let res
  try {
    res = await fetch(url, { signal, headers: { 'Accept': 'application/json' } })
  } catch {
    return []
  }
  if (!res.ok) return []
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { return [] }
  return (json.list || []).map(toItem)
}

function toItem(d) {
  const thumbnail = d.thumbnail_720_url || d.thumbnail_360_url || null
  return {
    id: `dm_${d.id}`,
    type: 'video',
    title: d.title || '(untitled)',
    url: d.url || `https://www.dailymotion.com/video/${d.id}`,
    source: `Dailymotion · ${d['owner.username'] || 'creator'}`,
    creatorId: null,
    publishedAt: d.created_time ? new Date(d.created_time * 1000).toISOString().slice(0, 10) : null,
    summary: (d.description || '').slice(0, 240).trim() || null,
    keyPoints: [],
    topicIds: [],
    toolIds: [],
    conceptIds: [],
    tagIds: [],
    thumbnail,
    durationSec: d.duration || null,
    dailymotionId: d.id,
    raw: { author: d['owner.username'] },
  }
}
