import { searchReddit }     from '../../lib/search/reddit.js'
import { searchHackerNews } from '../../lib/search/hackerNews.js'
import { searchYouTube }    from '../../lib/search/youtube.js'
import { PAIN_QUERIES }     from '../constants/painQueries.js'
import type { RawSearchResult } from './signalExtractor.js'

export type ScanSource = 'reddit' | 'hackernews' | 'youtube'

export interface ScanProgress {
  source:    ScanSource
  status:    'running' | 'done' | 'error'
  resultCount?: number
  error?:    string
}

type ProgressCallback = (p: ScanProgress) => void

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Run at most `concurrency` promises at a time from a list of factories. */
async function pLimit<T>(
  factories: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(factories.length)
  let idx = 0

  async function worker() {
    while (idx < factories.length) {
      const i = idx++
      results[i] = await factories[i]()
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, factories.length) }, worker)
  await Promise.all(workers)
  return results
}

function mapRedditItem(item: any, _query: string): RawSearchResult | null {
  try {
    const title = item.title ?? item.raw?.title ?? ''
    const body  = item.summary ?? item.selftext ?? item.raw?.selftext ?? item.body ?? ''
    const url   = item.url ?? item.raw?.url ?? ''
    if (!url) return null
    return {
      title,
      body,
      url,
      source:      'reddit',
      author:      item.author ?? item.raw?.author,
      publishedAt: item.created_utc
        ? new Date(item.created_utc * 1000).toISOString()
        : item.publishedAt,
    }
  } catch { return null }
}

function mapHNItem(item: any): RawSearchResult | null {
  try {
    const title = item.title ?? ''
    const body  = item.story_text ?? item.comment_text ?? item.text ?? ''
    const url   = item.url ?? `https://news.ycombinator.com/item?id=${item.objectID}`
    return {
      title,
      body,
      url,
      source:      'hackernews',
      author:      item.author ?? item.raw?.author,
      publishedAt: item.created_at ?? item.publishedAt,
    }
  } catch { return null }
}

function mapYouTubeItem(item: any): RawSearchResult | null {
  try {
    const title = item.title ?? item.raw?.title ?? ''
    const body  = item.description ?? item.raw?.description ?? ''
    const url   = item.url ?? item.raw?.url ?? ''
    if (!url) return null
    return {
      title,
      body,
      url,
      source:      'youtube',
      author:      item.author ?? item.raw?.author,
      publishedAt: item.publishedAt ?? item.raw?.publishedAt,
    }
  } catch { return null }
}

// ── Source runners ────────────────────────────────────────────────────────────

async function runSource(
  source: ScanSource,
  onProgress: ProgressCallback,
): Promise<RawSearchResult[]> {
  onProgress({ source, status: 'running' })
  const abortController = new AbortController()
  const results: RawSearchResult[] = []

  try {
    const factories = PAIN_QUERIES.map((query) => async () => {
      try {
        let items: any[] = []
        if (source === 'reddit') {
          const raw = await searchReddit(query, { limit: 10 }, abortController.signal)
          items = Array.isArray(raw) ? raw : (raw?.results ?? raw?.data ?? [])
          return items.map((i: any) => mapRedditItem(i, query)).filter((x): x is RawSearchResult => x !== null)
        } else if (source === 'hackernews') {
          const raw = await searchHackerNews(query, 10, abortController.signal)
          items = Array.isArray(raw) ? raw : (raw?.results ?? raw?.hits ?? [])
          return items.map(mapHNItem).filter((x): x is RawSearchResult => x !== null)
        } else {
          const raw = await searchYouTube(query, 10, abortController.signal)
          items = Array.isArray(raw) ? raw : (raw?.results ?? raw?.data ?? [])
          return items.map(mapYouTubeItem).filter((x): x is RawSearchResult => x !== null)
        }
      } catch {
        return [] as RawSearchResult[]
      }
    })

    const batches = await pLimit(factories, 5)
    for (const batch of batches) results.push(...batch)

    // Deduplicate by URL
    const seen = new Set<string>()
    const deduped = results.filter((r) => {
      if (seen.has(r.url)) return false
      seen.add(r.url)
      return true
    })

    onProgress({ source, status: 'done', resultCount: deduped.length })
    return deduped
  } catch (err: any) {
    onProgress({ source, status: 'error', error: err?.message ?? String(err) })
    return results
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run all pain queries across Reddit, then HN, then YouTube.
 * Source-sequential, max 5 concurrent queries per source.
 */
export async function runPainSearch(
  sources: ScanSource[] = ['reddit', 'hackernews', 'youtube'],
  onProgress: ProgressCallback = () => {},
): Promise<RawSearchResult[]> {
  const all: RawSearchResult[] = []

  for (const source of sources) {
    const sourceResults = await runSource(source, onProgress)
    all.push(...sourceResults)
  }

  return all
}
