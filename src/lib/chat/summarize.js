// Topic-collection summarization. Builds Ollama prompts from the items the
// user has gathered for a given topic and exposes two generators:
//
//   - generateTopicOverview: short 2-3 sentence card overview
//   - generateTopicReport:   full markdown report (streamed) for the modal
//
// Prompts intentionally lean on the same warm-but-precise voice as the
// chat assistant (see retrieve.js PERSONALITY) so the summary doesn't feel
// like a different product.

import { streamChat } from '../llm/ollama.js'

const ITEM_LIMIT = 30          // top-N items injected into the prompt
const SNIPPET_CHARS = 240      // per-item snippet cap
const HASH_RADIX = 36

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function snippet(text, n = SNIPPET_CHARS) {
  const s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

// Lightweight stable signature so the card can flag "out of date" when the
// user has added/removed items since the cached summary was generated. Order-
// insensitive — the same set of items in any order yields the same signature.
export function itemSignature(items) {
  const ids = (items || [])
    .map((it) => String(it.id || it._id || it.url || ''))
    .filter(Boolean)
    .sort()
  let hash = 0
  for (const id of ids) {
    for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return `${ids.length}.${(hash >>> 0).toString(HASH_RADIX)}`
}

// Quick stat line the card can render even without an AI call.
export function topicStats(items) {
  const counts = { article: 0, video: 0, social_post: 0, document: 0, other: 0 }
  const hosts = new Map()
  let lastAddedAt = null
  for (const it of items || []) {
    const t = it.type || it._kind || 'other'
    if (counts[t] != null) counts[t]++
    else counts.other++
    const h = hostOf(it.url || it.canonical_url || '')
    if (h) hosts.set(h, (hosts.get(h) || 0) + 1)
    const at = it.savedAt || it.createdAt || it.published_at
    if (at && (!lastAddedAt || at > lastAddedAt)) lastAddedAt = at
  }
  const topHosts = Array.from(hosts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h]) => h)
  return {
    counts,
    total: (items || []).length,
    topHosts,
    lastAddedAt,
  }
}

function fmtItem(it, i) {
  const title = String(it.title || it.name || '').trim().slice(0, 140)
  const host = hostOf(it.url || it.canonical_url || '')
  const type = (it.type || it._kind || 'item').replace('_', ' ')
  const lines = [`[${i + 1}] ${type.toUpperCase()}: ${title}`]
  if (host) lines.push(`Source: ${host}`)
  const desc = snippet(it.summary || it.excerpt || it.description || it.snippet || '')
  if (desc) lines.push(`About: ${desc}`)
  return lines.join('\n')
}

function corpusFor(items) {
  return (items || []).slice(0, ITEM_LIMIT).map(fmtItem).join('\n\n')
}

const PERSONALITY =
  `You are FlowMap AI, a warm, sharp, slightly witty in-product assistant. ` +
  `Speak like a smart teammate, not a corporate report writer. No emoji unless the user already used them.`

function overviewSystem(topicName) {
  return (
    `${PERSONALITY}\n\n` +
    `Task: write a 2–3 sentence overview of what the user has collected on the topic "${topicName}".\n` +
    `Rules:\n` +
    `- Read the ITEMS list below. Identify the dominant threads or angles.\n` +
    `- Mention rough proportions when useful (e.g. "most of them lean towards X, with a side thread on Y").\n` +
    `- Don't list titles. Don't number anything. Plain prose, 2–3 sentences max.\n` +
    `- If the collection is small or thin, say that plainly.\n` +
    `- Never invent items, sources, or claims that aren't in the ITEMS list.\n`
  )
}

function reportSystem(topicName) {
  return (
    `${PERSONALITY}\n\n` +
    `Task: produce a markdown report on the user's collection for the topic "${topicName}". ` +
    `Use the ITEMS list below as your only source — never invent facts, links, or sources that aren't there.\n\n` +
    `Format the output as markdown with these sections in order:\n\n` +
    `## Overview\n` +
    `One short paragraph (3–4 sentences) describing the shape of the collection — what dominates, what's secondary, where the user is leaning.\n\n` +
    `## Themes\n` +
    `3–5 bullets. Each bullet names a recurring thread you see across multiple items.\n\n` +
    `## Key claims & insights\n` +
    `5–8 bullets. Substantive points pulled from the items. End each bullet with the source title in italics, e.g. *— from "Some Article"*. ` +
    `Don't fabricate claims; if a bullet is loosely grouped from several items, say so naturally.\n\n` +
    `## Top sources\n` +
    `Bullet list of the most-represented hosts/creators, with how many items came from each.\n\n` +
    `## Open questions & gaps\n` +
    `2–3 bullets calling out angles the collection doesn't cover well, or follow-ups worth saving.\n\n` +
    `Tone: confident, concise, useful. Skip filler like "this report covers" or "in conclusion".`
  )
}

// Short overview for the SummaryCard — collected as a single string.
export async function generateTopicOverview(topic, items, opts = {}) {
  const name = topic?.name || 'this topic'
  const messages = [
    { role: 'system', content: overviewSystem(name) },
    { role: 'user', content: `ITEMS (${items.length}):\n\n${corpusFor(items)}` },
  ]
  let text = ''
  try {
    for await (const chunk of streamChat(messages, opts)) text += chunk
  } catch { /* surface as empty */ }
  return text.trim()
}

// Streamed full report for the SummaryModal — yields chunks so the modal can
// paint progressively. The caller assembles the full markdown.
export async function* streamTopicReport(topic, items, opts = {}) {
  const name = topic?.name || 'this topic'
  const messages = [
    { role: 'system', content: reportSystem(name) },
    { role: 'user', content: `ITEMS (${items.length}):\n\n${corpusFor(items)}` },
  ]
  for await (const chunk of streamChat(messages, opts)) yield chunk
}
