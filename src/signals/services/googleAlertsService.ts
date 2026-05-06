import type { SignalTopic, SignalSource, SignalItem, SignalEvidence } from '../types.js'

export interface AlertInput {
  title: string
  snippet?: string
  url?: string
  source?: string
  publishedAt?: string
}

export function createAlertSource(input: {
  query: string
  topicIds: string[]
  label: string
}): SignalSource {
  const now = new Date().toISOString()
  return {
    id: `src_alert_${Date.now()}`,
    type: 'google-alert',
    label: input.label || input.query,
    query: input.query,
    topicIds: input.topicIds,
    active: true,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Parse pasted Google Alert email text.
 * Supports both plain-text paste and the typical "Title - Source" line format.
 */
export function parseAlertText(text: string): AlertInput[] {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10)

  const items: AlertInput[] = []

  // Heuristic: lines that look like "Title — source.com" or contain a URL
  const urlRe = /https?:\/\/[^\s]+/
  for (const line of lines) {
    const urlMatch = line.match(urlRe)
    const cleanLine = line.replace(urlRe, '').replace(/[—–-]+\s*$/, '').trim()
    if (!cleanLine && !urlMatch) continue
    items.push({
      title: cleanLine || urlMatch?.[0] || line,
      url: urlMatch?.[0],
    })
  }
  return items
}

function topicMatchesText(topic: SignalTopic, text: string): boolean {
  const lower = text.toLowerCase()
  const allTerms = [
    topic.title.toLowerCase(),
    ...(topic.keywords ?? []).map((k) => k.toLowerCase()),
    ...(topic.aliases ?? []).map((a) => a.toLowerCase()),
  ]
  return allTerms.some((t) => lower.includes(t))
}

export function extractSignalCandidates(
  items: AlertInput[],
  source: SignalSource,
  topics: SignalTopic[],
): SignalItem[] {
  if (!items.length) return []

  const now = new Date().toISOString()
  const allText = items.map((i) => `${i.title} ${i.snippet ?? ''}`).join(' ')

  const relatedTopicIds = topics
    .filter((t) => topicMatchesText(t, allText))
    .map((t) => t.id)
  const primaryTopicId = source.topicIds[0] ?? relatedTopicIds[0] ?? undefined

  const score = Math.min(100, 40 + items.length * 3 + relatedTopicIds.length * 5)

  const evidence: SignalEvidence[] = items.slice(0, 10).map((i) => ({
    label: i.title,
    snippet: i.snippet,
    url: i.url,
    publishedAt: i.publishedAt ?? now,
  }))

  const id = `sig_alert_${source.id}_${Date.now()}`

  return [
    {
      id,
      primaryTopicId,
      relatedTopicIds,
      sourceId: source.id,
      sourceType: 'google-alert',
      category: 'news-mention',
      title: `Alert: ${source.label}`,
      summary: `${items.length} new mentions detected via Google Alert "${source.query}".`,
      score,
      direction: 'up',
      firstDetectedAt: now,
      lastDetectedAt: now,
      evidence,
      pinned: false,
      muted: false,
      memoryFileId: null,
      noteId: null,
      createdAt: now,
      updatedAt: now,
    },
  ]
}
