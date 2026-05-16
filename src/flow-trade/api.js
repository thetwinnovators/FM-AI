// Reads port + token from ~/.flowmap/daemon.json via the Vite proxy at
// /api/daemon/info — the same pattern used by daemonApi.ts. The result is
// cached for 30 s so we don't hit the file on every single API call.
let _infoCache = null
let _infoCacheTs = 0
const INFO_TTL = 30_000

async function getDaemonInfo() {
  const now = Date.now()
  if (_infoCache && now - _infoCacheTs < INFO_TTL) return _infoCache
  try {
    const r = await fetch('/api/daemon/info')
    if (!r.ok) { _infoCache = null; return null }
    _infoCache = await r.json()
    _infoCacheTs = now
    return _infoCache
  } catch {
    _infoCache = null
    return null
  }
}

async function req(method, path, body) {
  const info = await getDaemonInfo()
  if (!info) throw new Error('Flow Trade daemon not running')
  const headers = { authorization: `Bearer ${info.token}` }
  if (body != null) headers['content-type'] = 'application/json'
  // Route through Vite proxy — same-origin, no CORS needed
  const res = await fetch(`/api/daemon-proxy${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail = ''
    try { const j = await res.json(); detail = j?.error ?? j?.message ?? '' } catch {}
    throw new Error(detail || `${method} ${path} → ${res.status}`)
  }
  if (res.status === 204) return undefined
  return res.json()
}

export const flowTradeApi = {
  getStatus:           ()            => req('GET',    '/flow-trade/status'),
  getWatchlist:        ()            => req('GET',    '/flow-trade/watchlist'),
  addSymbol:           (symbol)      => req('POST',   '/flow-trade/watchlist', { symbol }),
  removeSymbol:        (symbol)      => req('DELETE', `/flow-trade/watchlist/${symbol}`),
  pinSymbol:           (symbol)      => req('PATCH',  `/flow-trade/watchlist/${symbol}/pin`),
  getSignals:          ()            => req('GET',    '/flow-trade/signals'),
  getPositions:        ()            => req('GET',    '/flow-trade/positions'),
  getDailyRisk:        ()            => req('GET',    '/flow-trade/daily-risk'),
  getAlpacaPositions:  ()            => req('GET',    '/flow-trade/alpaca/positions'),
  getAlpacaAccount:    ()            => req('GET',    '/flow-trade/alpaca/account'),
  getAlpacaOrders:     ()            => req('GET',    '/flow-trade/alpaca/orders'),
  getAlpacaBars:       (symbol)      => req('GET',    `/flow-trade/alpaca/bars/${symbol}`),
  placeOrder:          (signalId, qty) => req('POST', '/flow-trade/orders', { signalId, qty }),
  cancelAlpacaOrder:   (orderId)     => req('DELETE', `/flow-trade/alpaca/orders/${orderId}`),
  reconnect:           ()            => req('POST',   '/flow-trade/reconnect'),
  getCredentials:      ()            => req('GET',    '/flow-trade/credentials'),
  saveCredentials:     (key, secret) => req('POST',   '/flow-trade/credentials', { key, secret }),
}
