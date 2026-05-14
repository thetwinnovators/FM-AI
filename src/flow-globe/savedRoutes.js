// ── Saved-route persistence ────────────────────────────────────────────────────
// Each route: { id, origin, dest, tripType }

const KEY = 'flowmap_saved_routes'

export function getSavedRoutes() {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') }
  catch { return [] }
}

function save(routes) {
  localStorage.setItem(KEY, JSON.stringify(routes))
}

/** Add or bump-to-top a route (deduplicated by origin+dest). */
export function addRoute(route) {
  const existing = getSavedRoutes().filter(
    (r) => !(r.origin === route.origin && r.dest === route.dest),
  )
  const r = [route, ...existing]
  save(r)
  return r
}

export function removeRoute(id) {
  const r = getSavedRoutes().filter((x) => x.id !== id)
  save(r)
  return r
}
