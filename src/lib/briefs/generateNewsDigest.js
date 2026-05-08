import { chatJson } from '../llm/ollama.js'
import { OLLAMA_CONFIG } from '../llm/ollamaConfig.js'

const SYSTEM_PROMPT = `You are an AI news analyst. Given a list of today's top AI stories from Hacker News and Reddit, produce a structured digest as JSON with these exact keys:
- highlights: array of strings (4-6 one-sentence bullet developments)
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
  const highlightCount = Array.isArray(raw.highlights) ? raw.highlights.length : 0

  const sections = [
    { type: 'highlights', items: Array.isArray(raw.highlights) ? raw.highlights : [] },
    { type: 'themes', items: Array.isArray(raw.themes) ? raw.themes : [] },
    { type: 'top_signal', content: raw.top_signal ?? '' },
    { type: 'risks', content: raw.risks ?? '' },
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
