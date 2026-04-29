const KEY_STORAGE = 'flowmap.vt.apikey'

function readKey() {
  try { return localStorage.getItem(KEY_STORAGE) || '' } catch { return '' }
}

export const VT_CONFIG = { apiKey: readKey() }

export function setVtApiKey(key) {
  VT_CONFIG.apiKey = key || ''
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key)
    else localStorage.removeItem(KEY_STORAGE)
  } catch { /* in-memory only */ }
}

function urlId(url) {
  try {
    return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  } catch {
    return btoa(encodeURIComponent(url)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }
}

// Returns:
//   { clean: bool, malicious: N, suspicious: N, total: N, permalink: string|null }
//   { unknown: true }   — URL not yet in VT database (not inherently unsafe)
//   null                — no API key configured, or request failed
export async function checkUrl(url) {
  if (!VT_CONFIG.apiKey) return null
  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId(url)}`, {
      headers: { 'x-apikey': VT_CONFIG.apiKey },
    })
    if (res.status === 404) return { unknown: true }
    if (!res.ok) return null
    const json = await res.json()
    const stats = json?.data?.attributes?.last_analysis_stats || {}
    const malicious  = stats.malicious  || 0
    const suspicious = stats.suspicious || 0
    const total = malicious + suspicious + (stats.undetected || 0) + (stats.harmless || 0)
    const permalink = json?.data?.attributes?.permalink || null
    return { clean: malicious === 0 && suspicious === 0, malicious, suspicious, total, permalink }
  } catch {
    return null
  }
}
