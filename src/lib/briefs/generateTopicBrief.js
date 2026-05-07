import { chatJson, OLLAMA_CONFIG } from '../llm/ollama.js'

const SYSTEM_PROMPT = `You are an intelligence analyst. Given a list of saved content items on a topic, produce a structured brief as JSON with these exact keys:
- overview: string (2-3 sentences summarising the topic's current state)
- what_changed: array of { dot: "rising"|"shift"|"new", text: string } (3-5 items)
- strongest_signals: array of { strength: "Strong"|"Medium", source: string, text: string } (2-3 items)
- open_questions: array of strings (2-4 questions worth watching)
- risks: string (1-2 sentences on the strongest contrarian view or evidence gap)

Respond ONLY with the JSON object, no markdown, no explanation.`

/**
 * Generates a Topic Brief for the given topic using the provided content items.
 *
 * @param {string}   topicTitle
 * @param {string}   topicId
 * @param {object[]} items  — content objects { id, title, body, url, savedAt }
 * @returns {Promise<object|null>}  Brief record or null if LLM unavailable
 */
export async function generateTopicBrief(topicTitle, topicId, items) {
  if (!OLLAMA_CONFIG.enabled) return null

  // Cap at 30 most recent items to stay within LLM context
  const sorted = [...items].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)).slice(0, 30)

  const itemsText = sorted
    .map((item, i) => `${i + 1}. ${item.title ?? '(no title)'}\n${item.body ?? item.url ?? ''}`)
    .join('\n\n')

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Topic: ${topicTitle}\n\nContent items:\n${itemsText}`,
    },
  ]

  const raw = await chatJson(messages)
  if (!raw) return null

  const sections = [
    { type: 'overview', content: raw.overview ?? '' },
    { type: 'what_changed', items: Array.isArray(raw.what_changed) ? raw.what_changed : [] },
    { type: 'strongest_signals', items: Array.isArray(raw.strongest_signals) ? raw.strongest_signals : [] },
    { type: 'open_questions', items: Array.isArray(raw.open_questions) ? raw.open_questions : [] },
    { type: 'risks', content: raw.risks ?? '' },
  ]

  return {
    id: crypto.randomUUID(),
    type: 'topic',
    title: topicTitle,
    topicId,
    generatedAt: Date.now(),
    readAt: null,
    newItemCount: items.length,
    sourceCount: new Set(items.map((i) => i.source).filter(Boolean)).size,
    sections,
  }
}
