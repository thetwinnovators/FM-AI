export const CACHE_PREFIX = 'flowmap.search.cache.'

export function getCached(key, ttlMs) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`)
    if (!raw) return null
    const { at, data } = JSON.parse(raw)
    if (typeof at !== 'number') return null
    if (Date.now() - at > ttlMs) return null
    return data
  } catch {
    return null
  }
}

export function setCached(key, data) {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({ at: Date.now(), data })
    )
  } catch {}
}

export function clearCache() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k && k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k)
  }
}
