const DM_BASE = '/api/dm'

// Dailymotion's public Graph API. CORS is permissive but we still proxy through Vite
// for parallel symmetry with HN / Reddit and to keep the codebase consistent.
export async function searchDailymotion(query, limit = 10, signal) {
  if (!query || !query.trim()) return []
  const fields = 'id,title,description,thumbnail_360_url,thumbnail_720_url,owner.username,created_time,duration,url'
  const url = `${DM_BASE}/videos?search=${encodeURIComponent(query.trim())}&fields=${encodeURIComponent(fields)}&limit=${limit}&sort=relevance`
  const res = await fetch(url, { signal, headers: { 'Accept': 'application/json' } })
  if (!res.ok) return []  // Dailymotion sometimes returns 4xx HTML pages — fail silently
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
