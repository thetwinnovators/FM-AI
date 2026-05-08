import { chatJson } from '../llm/ollama.js'
import { OLLAMA_CONFIG } from '../llm/ollamaConfig.js'

const SYSTEM_PROMPT = `You are an AI news analyst. Given a numbered list of today's top AI stories, produce a structured digest as JSON with these exact keys:
- highlights: array of strings, each a one-sentence bullet summarising a key development (4-6 items). Each bullet MUST begin with the exact story title it is drawn from, followed by a colon and your summary. Example: "Anthropic raises $4B: OpenAI's rival secures record funding to scale model training."
- themes: array of strings (2-3 cross-story patterns or trends)
- top_signal: string (single highest-confidence development to pay attention to)
- risks: string (1-2 sentences on what looks hyped, premature, or contradicted)

Respond ONLY with the JSON object, no markdown, no explanation.`

/**
 * Generates an AI News Digest brief from the provided stories.
 *
 * @param {object[]} stories  — from fetchAiNews: { id, title, score, source, url }
 * @returns {Promise<object|null>}  Brief record or null if LLM unavailable / no stories
 */
export async function generateNewsDigest(stories) {
  if (!OLLAMA_CONFIG.enabled) return null
  if (!stories || stories.length === 0) return null

  const storiesText = stories
    .slice(0, 25)
    .map((s, i) => `${i + 1}. [${s.source}] ${s.title} (score: ${s.score})`)
    .join('\n')

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Today's AI stories:\n${storiesText}` },
  ]

  const raw = await chatJson(messages)
  if (!raw) return null

  const uniqueSources = new Set(stories.map((s) => s.source).filter(Boolean))
  const slicedStories = stories.slice(0, 25)

  // Fuzzy-match a highlight text back to the closest story title.
  // The LLM is instructed to start each bullet with the story title; we
  // tokenise both strings and count word overlap, falling back to null when
  // the best score is too low (avoids wrong matches on short titles).
  function tokenise(str) {
    return str.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean)
  }
  function bestStoryUrl(highlightText) {
    const hTokens = new Set(tokenise(highlightText))
    let best = null, bestScore = 0
    for (const s of slicedStories) {
      if (!s.url) continue
      const sTokens = tokenise(s.title)
      const overlap = sTokens.filter((t) => hTokens.has(t)).length
      const score   = overlap / Math.max(sTokens.length, 1)
      if (score > bestScore) { bestScore = score; best = s }
    }
    // Require at least 30 % of the story's title words to match
    return bestScore >= 0.3 ? best?.url ?? null : null
  }

  // Normalise highlights — LLM returns strings; attach URL via fuzzy match
  const rawHighlights  = Array.isArray(raw.highlights) ? raw.highlights : []
  const highlightItems = rawHighlights.map((h) => {
    const text = typeof h === 'string' ? h : String(h?.text ?? h)
    return { text, url: bestStoryUrl(text) }
  })
  const highlightCount = highlightItems.length

  const sections = [
    { type: 'highlights', items: highlightItems },
    { type: 'themes',     items: Array.isArray(raw.themes) ? raw.themes : [] },
    { type: 'top_signal', content: raw.top_signal ?? '' },
    { type: 'risks',      content: raw.risks ?? '' },
  ]

  // Stable date-scoped ID: one news_digest per calendar day.
  // Concurrent generations on the same day use the same key, so the second
  // addBrief call simply overwrites the first — no duplicates accumulate.
  const todayKey = new Date().toISOString().slice(0, 10)  // e.g. "2026-05-07"

  return {
    id: `news_digest_${todayKey}`,
    type: 'news_digest',
    title: `Today in AI — ${highlightCount} development${highlightCount !== 1 ? 's' : ''}`,
    topicId: null,
    generatedAt: Date.now(),
    readAt: null,
    newItemCount: stories.length,
    sourceCount: uniqueSources.size,
    sections,
  }
}
