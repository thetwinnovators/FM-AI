// ── Price-watch persistence ────────────────────────────────────────────────────
// Each watch: { id, origin, dest, departDate, returnDate|null, tripType,
//              targetPrice, currentPrice|null, lowestSeen|null,
//              lastChecked|null, triggered }

const KEY = 'flowmap_price_watches'

export function getWatches() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
  catch { return [] }
}

function save(watches) {
  localStorage.setItem(KEY, JSON.stringify(watches))
}

export function addWatch(watch) {
  const w = [watch, ...getWatches()]
  save(w)
  return w
}

export function removeWatch(id) {
  const w = getWatches().filter((x) => x.id !== id)
  save(w)
  return w
}

export function patchWatch(id, updates) {
  const w = getWatches().map((x) => (x.id === id ? { ...x, ...updates } : x))
  save(w)
  return w
}
