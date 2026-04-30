// Pulls a clean reader-mode version of an article via Jina Reader
// (https://r.jina.ai). Jina handles fetching, sandboxing, ad/nav stripping,
// and Markdown conversion server-side — so the browser just gets back the
// readable body without dealing with CORS or every site's chrome.
//
// The free tier is generous enough for personal-tool use; for higher volume
// you'd add an Authorization header with a Jina key.

import { getCached, setCached } from './cache.js'

// Effectively forever. The user explicitly opted into permanent caching for
// site content — once you've loaded an article, it stays. To force a fresh
// fetch use the "Discard" button in the modal, which evicts the cache entry.
//
// (Number.MAX_SAFE_INTEGER far exceeds any plausible Date.now() delta, so
// the freshness check `Date.now() - at > ttlMs` is always false.)
const READER_TTL = Number.MAX_SAFE_INTEGER
const READER_BASE = 'https://r.jina.ai'

function cacheKey(url) {
  return `flowmap.reader.v1:${url}`
}

// Synchronous cache lookup — used by ArticleReader to pre-populate the
// "Full article" section when re-opening an item that was loaded earlier.
// Returns the same shape as `fetchCleanArticle` or null.
export function getCachedArticle(url) {
  if (!url) return null
  return getCached(cacheKey(url), READER_TTL) || null
}

// Drop the cached reader-mode body for a URL. Used by the modal's Discard
// button so the user can ditch a junk fetch and pull fresh on demand.
export function clearCachedArticle(url) {
  if (!url) return
  try {
    localStorage.removeItem(`flowmap.search.cache.${cacheKey(url)}`)
  } catch {}
}

// Fetch and parse a URL into clean markdown + metadata. Returns null on
// network/parse failures so callers can fall back to the existing curator
// summary. Heavily cached because Jina rate-limits anonymous callers.
export async function fetchCleanArticle(url) {
  if (!url) return null
  const key = cacheKey(url)
  const cached = getCached(key, READER_TTL)
  if (cached) return cached

  try {
    // Only "simple" CORS-safelisted headers — adding X-* custom headers here
    // triggers a CORS preflight that Jina's anonymous endpoint rejects, so
    // the whole fetch fails before reaching us. JSON via Accept is enough.
    const res = await fetch(`${READER_BASE}/${url}`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const json = await res.json()
    const data = json?.data || json
    if (!data?.content) return null
    const cleaned = cleanArticleMarkdown(String(data.content || ''))
    if (!cleaned.trim()) return null
    const out = {
      title: data.title || null,
      content: cleaned,
      // First image in the markdown body — usually the article's hero / OG.
      // Jina ships a separate `images` map keyed by id; we just grab the
      // first src so the modal can show a header banner.
      image: pickHeaderImage(data),
      url: data.url || url,
      description: data.description || null,
      fetchedAt: new Date().toISOString(),
    }
    setCached(key, out, READER_TTL)
    return out
  } catch {
    return null
  }
}

// Strip the cruft that comes back from JS-heavy / login-walled pages so the
// rendered article actually reads like an article. Heuristic only — biased
// toward keeping content; we'd rather leave a stray nav line than nuke a
// real paragraph.
//
// What it removes:
//   - Empty / image-only markdown links: `[](https://x.com/)`, `![Image 1](…)`
//   - Standalone CTA lines: "Log in", "Sign up", "Subscribe", footer crumbs
//   - Cookie / copyright notices
//   - Leading link-only lines (top-of-page navigation)
//   - Trailing footer-ish runs (consecutive short link-only lines at the end)
//   - Collapses 3+ blank lines down to 2
export function cleanArticleMarkdown(md) {
  if (!md) return ''

  // Inline-level scrubbing first (operates per line so we keep paragraph shape).
  let lines = md.replace(/\r\n?/g, '\n').split('\n').map((line) => {
    return line
      // Empty link/image tokens — `[](https://...)` and `![](...)`.
      .replace(/!?\[\s*\]\([^)]*\)/g, '')
      // Profile-image style "![Image N](url)" filler.
      .replace(/!\[Image \d+\]\([^)]+\)/gi, '')
      // Tracking / sharing pixels rendered as "![](data:image/...)".
      .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, '')
      // Loose junk artifacts like `Image 1: …` left over from alt text.
      .replace(/^Image \d+:\s*/i, '')
  })

  // Drop standalone navigation / CTA / boilerplate lines.
  const JUNK_LINE = [
    /^(log\s*in|sign\s*up|sign\s*in|subscribe|register|join now|create account)$/i,
    /^(share|tweet|reply|like|retweet|follow|copy link|share this)$/i,
    /^(home|menu|about|contact|privacy(?:\s*policy)?|terms(?:\s*of\s*service)?|cookies?(?:\s*policy)?)$/i,
    /^don'?t miss what'?s happening$/i,
    /^people on .{1,40} are the first to know.?$/i,
    /^©.*$/i,
    /^all rights reserved.?$/i,
    /^skip to (?:main )?content$/i,
    /^advertisement$/i,
    // "Conversation" / "Post" as orphan headings on X.com etc.
    /^#{1,6}\s*(post|conversation|replies|comments|trending)$/i,
  ]
  lines = lines.filter((line) => {
    const t = line.trim()
    if (!t) return true
    return !JUNK_LINE.some((re) => re.test(t))
  })

  // Collapse runs of blank lines.
  const collapsed = []
  let blankRun = 0
  for (const line of lines) {
    if (!line.trim()) {
      blankRun++
      if (blankRun <= 1) collapsed.push(line)
    } else {
      blankRun = 0
      collapsed.push(line)
    }
  }

  // Trim leading nav junk: keep dropping lines that are just links / very
  // short until we hit something paragraph-shaped (>50 chars OR ends in
  // sentence punctuation OR is a heading with prose).
  while (collapsed.length > 0) {
    const t = collapsed[0].trim()
    if (!t) { collapsed.shift(); continue }
    if (looksLikeNav(t)) { collapsed.shift(); continue }
    break
  }

  // Trim trailing footer junk: same idea from the bottom.
  while (collapsed.length > 0) {
    const t = collapsed[collapsed.length - 1].trim()
    if (!t) { collapsed.pop(); continue }
    if (looksLikeNav(t)) { collapsed.pop(); continue }
    break
  }

  return collapsed.join('\n').trim()
}

function looksLikeNav(line) {
  // A line is "navigation-shaped" if it's mostly link, very short, or matches
  // a known boilerplate. We want to be conservative — false positives drop
  // real prose, which is worse than letting one extra link line through.
  if (line.length < 4) return true
  if (/^\s*\*\s*\[[^\]]+\]\(https?:\/\/[^)]+\)\s*$/.test(line)) return true   // bullet of a single link
  if (/^\s*\[[^\]]*\]\(https?:\/\/[^)]+\)\s*$/.test(line)) return true       // line is one link
  if (/^#{1,6}\s*\[[^\]]*\]\(https?:\/\/[^)]+\)\s*$/.test(line)) return true // heading of one link
  // If line is short and has zero word characters outside of a link, treat as nav.
  if (line.length < 30) {
    const stripped = line.replace(/\[[^\]]+\]\([^)]+\)/g, '').replace(/[^A-Za-z0-9]+/g, '')
    if (stripped.length === 0) return true
  }
  return false
}

// Jina returns either an `images` object ({ "Image 1": "https://..." }) or
// embeds image URLs inline in the markdown. Try both; first hit wins.
function pickHeaderImage(data) {
  if (data?.images && typeof data.images === 'object') {
    const first = Object.values(data.images).find((v) => typeof v === 'string' && /^https?:/.test(v))
    if (first) return first
  }
  // Fallback: scan the markdown for an inline image.
  const m = String(data?.content || '').match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/)
  return m ? m[1] : null
}

// Lightweight markdown → simple block list for inline rendering. Doesn't try
// to be a full parser — handles headings, bold/italic, links, lists, inline
// code, code blocks, paragraphs. Anything weirder (tables, nested lists
// deeper than 1) renders as plain text, which is acceptable for a reader view.
export function renderMarkdownLite(md) {
  if (!md) return []
  const blocks = []
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    // Code fence
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim() || null
      const buf = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++  // skip closing fence
      blocks.push({ type: 'code', lang, text: buf.join('\n') })
      continue
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.+)$/)
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() })
      i++
      continue
    }

    // List (consecutive `-`/`*`/`1.` lines)
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items = []
      const ordered = /^\s*\d+\./.test(line)
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''))
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // Image-only line → its own block so we can size it nicely
    const imgOnly = line.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/)
    if (imgOnly) {
      blocks.push({ type: 'image', alt: imgOnly[1], src: imgOnly[2] })
      i++
      continue
    }

    // Paragraph — gather consecutive non-blank lines
    const buf = [line]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
      buf.push(lines[i]); i++
    }
    blocks.push({ type: 'paragraph', text: buf.join(' ') })
  }
  return blocks
}

// Convert inline markdown (within a paragraph) to a small set of formatting
// nodes via String.matchAll — bold, italic, inline code, links. Anything
// else flows through as plain text.
export function renderInline(text) {
  if (!text) return []
  const nodes = []
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g
  let last = 0
  for (const m of String(text).matchAll(re)) {
    if (m.index > last) nodes.push({ kind: 'text', value: text.slice(last, m.index) })
    if (m[1]) nodes.push({ kind: 'link', text: m[1], href: m[2] })
    else if (m[3]) nodes.push({ kind: 'code', value: m[3] })
    else if (m[4]) nodes.push({ kind: 'bold', value: m[4] })
    else if (m[5] || m[6]) nodes.push({ kind: 'italic', value: m[5] || m[6] })
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push({ kind: 'text', value: text.slice(last) })
  return nodes
}
