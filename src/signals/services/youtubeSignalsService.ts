import type { SignalTopic, SignalSource, SignalItem, SignalEvidence, SignalCategory } from '../types.js'

const key = (import.meta as any).env?.VITE_YOUTUBE_API_KEY ?? ''

export function hasApiKey(): boolean {
  return !!key
}

interface YouTubeSearchItem {
  id: { videoId?: string }
  snippet: {
    title: string
    description: string
    publishedAt: string
    channelTitle: string
    thumbnails?: { default?: { url: string } }
  }
}

export async function searchVideosByTopic(
  topic: SignalTopic,
  maxResults = 20,
): Promise<YouTubeSearchItem[]> {
  if (!key) return []
  const query = [topic.title, ...(topic.keywords ?? [])].slice(0, 3).join(' ')
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('key', key)
  url.searchParams.set('q', query)
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('order', 'date')
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`YouTube API error ${res.status}`)
  const data = await res.json()
  return (data.items ?? []) as YouTubeSearchItem[]
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

function getNgrams(tokens: string[], n: number): string[] {
  const out: string[] = []
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i + n).join(' '))
  }
  return out
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
  items: YouTubeSearchItem[],
  source: SignalSource,
  topics: SignalTopic[],
): SignalItem[] {
  if (!items.length) return []

  // Count bigram/trigram frequency across all titles+descriptions
  const phraseCount = new Map<string, number>()
  const phraseItems = new Map<string, YouTubeSearchItem[]>()

  for (const item of items) {
    const text = `${item.snippet.title} ${item.snippet.description}`
    const tokens = tokenize(text)
    const ngrams = [...getNgrams(tokens, 2), ...getNgrams(tokens, 3)]
    const seen = new Set<string>()
    for (const ng of ngrams) {
      if (seen.has(ng)) continue
      seen.add(ng)
      phraseCount.set(ng, (phraseCount.get(ng) ?? 0) + 1)
      phraseItems.set(ng, [...(phraseItems.get(ng) ?? []), item])
    }
  }

  // Keep only phrases appearing in ≥2 items
  const repeated = [...phraseCount.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  const now = new Date().toISOString()
  const signals: SignalItem[] = []

  for (const [phrase, count] of repeated) {
    const matchedItems = phraseItems.get(phrase) ?? []

    // Auto-tag topics
    const allText = matchedItems
      .map((i) => `${i.snippet.title} ${i.snippet.description}`)
      .join(' ')
    const relatedTopicIds = topics
      .filter((t) => topicMatchesText(t, allText))
      .map((t) => t.id)

    const primaryTopicId =
      source.topicIds[0] ?? relatedTopicIds[0] ?? undefined

    // Classify category
    const category: SignalCategory = phrase.includes('how')
      ? 'recurring-question'
      : count >= 5
        ? 'entity-spike'
        : 'repeating-hook'

    const score = Math.min(100, 40 + count * 5 + relatedTopicIds.length * 5)

    const evidence: SignalEvidence[] = matchedItems.slice(0, 5).map((i) => ({
      label: i.snippet.title,
      snippet: i.snippet.description.slice(0, 200),
      url: i.id.videoId
        ? `https://www.youtube.com/watch?v=${i.id.videoId}`
        : undefined,
      publishedAt: i.snippet.publishedAt,
    }))

    const id = `sig_yt_${phrase.replace(/\s+/g, '_')}_${Date.now()}`

    signals.push({
      id,
      primaryTopicId,
      relatedTopicIds,
      sourceId: source.id,
      sourceType: 'youtube',
      category,
      title: phrase.replace(/\b\w/g, (c) => c.toUpperCase()),
      summary: `Phrase "${phrase}" appeared in ${count} recent YouTube videos across your tracked topics.`,
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
    })
  }

  return signals
}
