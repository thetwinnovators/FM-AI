// Shared shape, normalizer, and de-duplication helpers for search results.
// Adapters keep emitting their existing fields; aggregate.js runs every item
// through `normalizeItem` so downstream code (ranker, dedupe, diversifier,
// cards) sees a stable schema with score sub-fields ready to be filled in.
import { canonicalizeUrl } from '../manualIngest.js'

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

const NEWS_HOSTS = [
  'techcrunch.com', 'theverge.com', 'arstechnica.com', 'wired.com',
  'engadget.com', 'venturebeat.com', 'theinformation.com', 'axios.com',
  'reuters.com', 'bloomberg.com', 'cnbc.com', 'ft.com',
]
const REFERENCE_HOSTS = ['wikipedia.org', 'docs.anthropic.com']
const REFERENCE_HOST_SUFFIXES = ['.wikipedia.org']
const COMMUNITY_HOSTS = ['reddit.com', 'news.ycombinator.com']

function matchesHost(host, list, suffixes = []) {
  if (!host) return false
  if (list.includes(host)) return true
  for (const s of suffixes) if (host.endsWith(s)) return true
  return false
}

// Map an adapter's narrow `type` (used by cards) to the broader `sourceType`
// taxonomy used by ranking. Cards keep switching on `type`; ranking reasons
// over `sourceType`.
export function deriveSourceType(item) {
  if (item.sourceType) return item.sourceType
  if (item.type === 'pdf') return 'pdf'
  // Catch PDF URLs that slipped through without an explicit type (e.g. from SearXNG general)
  if (/\.pdf(\?[^#]*)?$/i.test(item.url || '')) return 'pdf'
  if (item.type === 'video') return 'video'
  if (item.type === 'social_post') return 'community'
  const host = hostOf(item.url || '')
  if (matchesHost(host, REFERENCE_HOSTS, REFERENCE_HOST_SUFFIXES)) return 'reference'
  if (matchesHost(host, NEWS_HOSTS)) return 'news'
  if (matchesHost(host, COMMUNITY_HOSTS)) return 'community'
  return 'article'
}

const ZERO_SCORES = Object.freeze({
  scoreBase: 0,
  scoreFreshness: 0,
  scoreIntent: 0,
  scoreAuthority: 0,
  scoreFeedback: 0,
  scoreDiversityPenalty: 0,
  scoreFinal: 0,
})

// Add canonicalUrl, domain, sourceType, and zeroed score components.
// Returns the same item shape consumers already use plus the new fields.
export function normalizeItem(raw) {
  if (!raw || !raw.url) return raw
  const canonicalUrl = canonicalizeUrl(raw.url)
  const domain = hostOf(canonicalUrl)
  const sourceType = deriveSourceType(raw)
  return {
    ...raw,
    canonicalUrl,
    domain,
    sourceType,
    ...ZERO_SCORES,
    queryIntent: raw.queryIntent || [],
    matchedExpansion: raw.matchedExpansion ?? null,
  }
}

// --- Dedupe -------------------------------------------------------------

function normTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Jaccard on normalized title word-sets (ignores 1-2 char filler tokens).
export function titleSimilarity(a, b) {
  const at = normTitle(a)
  const bt = normTitle(b)
  if (!at || !bt) return 0
  if (at === bt) return 1
  const aw = new Set(at.split(' ').filter((w) => w.length > 2))
  const bw = new Set(bt.split(' ').filter((w) => w.length > 2))
  if (aw.size === 0 || bw.size === 0) return 0
  let inter = 0
  for (const w of aw) if (bw.has(w)) inter++
  const union = aw.size + bw.size - inter
  return union === 0 ? 0 : inter / union
}

// Drop exact canonical-URL duplicates first, then collapse near-duplicates by
// title similarity. Same-domain near-dupes use the looser threshold (mirrored
// reposts), cross-domain dupes need a much higher similarity (e.g. wire-feed
// republications) to avoid eating distinct coverage of the same event.
export function dedupeItems(items, opts = {}) {
  const sameDomainThresh = opts.sameDomainThresh ?? 0.85
  const crossDomainThresh = opts.crossDomainThresh ?? 0.95

  const byUrl = new Set()
  const urlDeduped = []
  for (const it of items) {
    const key = (it.canonicalUrl || it.url || '').toLowerCase()
    if (!key) { urlDeduped.push(it); continue }
    if (byUrl.has(key)) continue
    byUrl.add(key)
    urlDeduped.push(it)
  }

  const kept = []
  outer: for (const cand of urlDeduped) {
    for (const k of kept) {
      const sim = titleSimilarity(cand.title, k.title)
      if (cand.domain && k.domain && cand.domain === k.domain) {
        if (sim >= sameDomainThresh) continue outer
      } else if (sim >= crossDomainThresh) {
        continue outer
      }
    }
    kept.push(cand)
  }
  return kept
}
