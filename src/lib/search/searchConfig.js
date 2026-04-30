// SearXNG broad-web adapter configuration.
//
// FlowMap proxies SearXNG calls through Vite (`/api/searxng` block in
// vite.config.js) to bypass browser CORS. The default points at a locally
// self-hosted SearXNG instance — public instances rate-limit programmatic
// clients aggressively in 2026 and aren't reliable for personal-tool use.
//
// To run SearXNG locally:
//   docker run -d --name searxng -p 8888:8080 searxng/searxng
//   (any port works; update vite.config.js's proxy target to match)
//
// To point at a different self-hosted or public instance:
//   1. Edit the `target:` URL in vite.config.js (`/api/searxng` block)
//   2. Restart `vite dev`
//   The `searxngBaseUrl` field below stays as `/api/searxng` regardless —
//   it's the client-side path the adapter calls; Vite handles the rewrite.
//
// To disable SearXNG entirely (e.g. before you've spun up Docker):
//   toggle it off in the gear-icon menu (top right), or set the default below
//   to `false`. The runtime override in localStorage takes precedence over
//   this default — so the gear-menu choice persists across reloads.

const ENABLED_OVERRIDE_KEY = 'flowmap.searxng.enabled'

function readEnabledOverride() {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(ENABLED_OVERRIDE_KEY)
    if (raw === null) return null
    return raw === 'true'
  } catch { return null }
}

const _override = readEnabledOverride()

export const SEARCH_CONFIG = {
  // Master switch. Default true; runtime override persisted in localStorage.
  searxngEnabled:    _override !== null ? _override : true,

  // Client-side path. Vite proxy handles the actual instance URL — see comment
  // block above for how to change which instance you're hitting.
  searxngBaseUrl:    '/api/searxng',

  // SearXNG /search query parameters. Most users won't need to change these.
  searxngCategories: 'general',
  searxngLanguage:   'en-US',
  searxngSafeSearch: 1,
  searxngTimeRange:  '', // '', 'day', 'week', 'month', 'year'

  // Per-request timeout. Public-instance latency is variable; localhost is fast.
  searxngTimeoutMs:  8000,
}

// Live toggle from the gear-icon Settings menu. Persists across reloads.
export function setSearxngEnabled(enabled) {
  SEARCH_CONFIG.searxngEnabled = !!enabled
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ENABLED_OVERRIDE_KEY, String(!!enabled))
    }
  } catch { /* quota / privacy mode — runtime override still applies for this session */ }
}
