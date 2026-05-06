import type { SignalItem, SignalTopic, SignalSource } from '../types.js'
import { searchVideosByTopic, extractSignalCandidates as ytExtract } from './youtubeSignalsService.js'

export interface ScanResult {
  newSignals: SignalItem[]
  sourcesScanned: number
  errors: Array<{ sourceId: string; error: string }>
}

/**
 * Recalculate a signal's score based on evidence count, recency, and direction.
 */
export function scoreSignal(signal: SignalItem): number {
  const evidenceBonus = Math.min(30, signal.evidence.length * 6)
  const directionBonus = signal.direction === 'up' ? 10 : signal.direction === 'down' ? -10 : 0

  // Recency: signals detected within the last 7 days get a bonus
  const ageMs = Date.now() - new Date(signal.lastDetectedAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  const recencyBonus = ageDays < 1 ? 20 : ageDays < 3 ? 10 : ageDays < 7 ? 5 : 0

  return Math.max(0, Math.min(100, 40 + evidenceBonus + directionBonus + recencyBonus))
}

/**
 * Auto-match topics to a signal by scanning title + summary + evidence text.
 */
export function tagSignalTopics(signal: SignalItem, topics: SignalTopic[]): string[] {
  const corpus = [
    signal.title,
    signal.summary,
    ...signal.evidence.map((e) => `${e.label} ${e.snippet ?? ''}`),
  ]
    .join(' ')
    .toLowerCase()

  return topics
    .filter((t) => {
      const terms = [
        t.title.toLowerCase(),
        ...(t.keywords ?? []).map((k) => k.toLowerCase()),
        ...(t.aliases ?? []).map((a) => a.toLowerCase()),
      ]
      return terms.some((term) => corpus.includes(term))
    })
    .map((t) => t.id)
}

/**
 * Run a YouTube scan directly from user store topics (no manual source setup required).
 * Synthesises a SignalSource and SignalTopic per store topic, then delegates to runYoutubeScan.
 */
export async function runYoutubeScanFromUserTopics(
  userTopics: Array<{ id: string; name: string; query?: string; followed?: boolean }>,
): Promise<ScanResult> {
  const activeTopics = userTopics.filter((t) => t.followed !== false)
  if (!activeTopics.length) return { newSignals: [], sourcesScanned: 0, errors: [] }

  const signalTopics: SignalTopic[] = activeTopics.map((t) => ({
    id: t.id,
    title: t.name,
    keywords: t.query ? [t.query] : [t.name],
    aliases: [],
    watchStatus: 'active' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  const syntheticSource: SignalSource = {
    id: 'auto-user-topics',
    type: 'youtube',
    label: 'My Topics',
    query: '',
    topicIds: signalTopics.map((t) => t.id),
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return runYoutubeScan([syntheticSource], signalTopics)
}

/**
 * Run a YouTube scan across all active YouTube sources, return new SignalItems.
 */
export async function runYoutubeScan(
  sources: SignalSource[],
  topics: SignalTopic[],
): Promise<ScanResult> {
  const activeSources = sources.filter((s) => s.type === 'youtube' && s.active)
  const newSignals: SignalItem[] = []
  const errors: Array<{ sourceId: string; error: string }> = []

  await Promise.allSettled(
    activeSources.map(async (source) => {
      // Find matching topics for this source
      const sourceTopics = topics.filter(
        (t) => source.topicIds.includes(t.id) && t.watchStatus === 'active',
      )
      if (!sourceTopics.length) return

      for (const topic of sourceTopics) {
        try {
          const items = await searchVideosByTopic(topic, 20)
          const candidates = ytExtract(items, source, topics)
          newSignals.push(...candidates)
        } catch (err) {
          errors.push({
            sourceId: source.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }),
  )

  return {
    newSignals,
    sourcesScanned: activeSources.length,
    errors,
  }
}
