import { searchReddit }     from '../../lib/search/reddit.js'
import { searchHackerNews } from '../../lib/search/hackerNews.js'
import { searchYouTube }    from '../../lib/search/youtube.js'
import { searchStackOverflow } from '../../lib/search/stackOverflow.js'
import { searchGitHubIssues }  from '../../lib/search/github.js'
import { searchSite }          from '../../lib/search/siteSearch.js'
import { PAIN_QUERIES }     from '../constants/painQueries.js'
import { DESIGN_QUERIES }   from '../constants/designQueries.js'
import type { RawSearchResult } from './signalExtractor.js'

export type ScanSource =
  | 'reddit' | 'hackernews' | 'youtube'
  | 'stackoverflow' | 'github'
  | 'producthunt' | 'indiehackers' | 'g2' | 'capterra'
  | 'twitter' | 'linkedin' | 'discord'
  | 'mobbin' | 'behance' | 'dribbble' | 'thefwa'

export const SOURCE_LABELS: Record<ScanSource, string> = {
  reddit:       'Reddit',
  hackernews:   'Hacker News',
  youtube:      'YouTube',
  stackoverflow: 'Stack Overflow',
  github:       'GitHub',
  producthunt:  'Product Hunt',
  indiehackers: 'Indie Hackers',
  g2:           'G2',
  capterra:     'Capterra',
  twitter:      'Twitter/X',
  linkedin:     'LinkedIn',
  discord:      'Discord',
  mobbin:       'Mobbin',
  behance:      'Behance',
  dribbble:     'Dribbble',
  thefwa:       'FWA',
}

// Subset of pain queries used for site: SearXNG sources (fewer = less hammering)
const SITE_PAIN_QUERIES = PAIN_QUERIES.slice(0, 6)

// Design inspiration sources use topic-focused queries instead of pain queries
const DESIGN_SOURCES = new Set<ScanSource>(['mobbin', 'behance', 'dribbble', 'thefwa'])

export interface ScanProgress {
  source:      ScanSource
  status:      'running' | 'done' | 'error'
  resultCount?: number
  error?:      string
}

type ProgressCallback = (p: ScanProgress) => void

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

function mapRedditItem(item: any): RawSearchResult | null {
  try {
    const title = item.title ?? item.raw?.title ?? ''
    const body  = item.summary ?? item.selftext ?? item.raw?.selftext ?? item.body ?? ''
    const url   = item.url ?? item.raw?.url ?? ''
    if (!url) return null
    return { title, body, url, source: 'reddit', author: item.author ?? item.raw?.author, publishedAt: item.created_utc ? new Date(item.created_utc * 1000).toISOString() : item.publishedAt }
  } catch { return null }
}

function mapHNItem(item: any): RawSearchResult | null {
  try {
    const title = item.title ?? ''
    const body  = item.story_text ?? item.comment_text ?? item.text ?? ''
    const url   = item.url ?? `https://news.ycombinator.com/item?id=${item.objectID}`
    return { title, body, url, source: 'hackernews', author: item.author ?? item.raw?.author, publishedAt: item.created_at ?? item.publishedAt }
  } catch { return null }
}

function mapYouTubeItem(item: any): RawSearchResult | null {
  try {
    const title = item.title ?? item.raw?.title ?? ''
    const body  = item.description ?? item.raw?.description ?? ''
    const url   = item.url ?? item.raw?.url ?? ''
    if (!url) return null
    return { title, body, url, source: 'youtube', author: item.author ?? item.raw?.author, publishedAt: item.publishedAt ?? item.raw?.publishedAt }
  } catch { return null }
}

function mapGenericItem(item: any, source: string): RawSearchResult | null {
  try {
    const title = item.title ?? ''
    const body  = item.summary ?? item.body ?? item.description ?? ''
    const url   = item.url ?? item.raw?.url ?? ''
    if (!url) return null
    return { title, body, url, source, author: item.author ?? null, publishedAt: item.publishedAt ?? null }
  } catch { return null }
}

// SearXNG site: sources use a smaller query set to reduce request volume
const SITE_SOURCES = new Set<ScanSource>(['producthunt', 'indiehackers', 'g2', 'capterra', 'twitter', 'linkedin', 'discord', 'mobbin', 'behance', 'dribbble', 'thefwa'])

async function runSource(
  source: ScanSource,
  onProgress: ProgressCallback,
  externalSignal?: AbortSignal,
): Promise<RawSearchResult[]> {
  if (externalSignal?.aborted) return []
  onProgress({ source, status: 'running' })
  const abortController = new AbortController()
  // When the caller aborts (e.g. the scan-level timeout), propagate to our fetch calls
  externalSignal?.addEventListener('abort', () => abortController.abort(), { once: true })
  const results: RawSearchResult[] = []
  const queries = DESIGN_SOURCES.has(source) ? DESIGN_QUERIES : SITE_SOURCES.has(source) ? SITE_PAIN_QUERIES : PAIN_QUERIES

  try {
    const factories = queries.map((query) => async (): Promise<RawSearchResult[]> => {
      try {
        if (source === 'reddit') {
          const raw = await searchReddit(query, { limit: 10 }, abortController.signal)
          const items = Array.isArray(raw) ? raw : (raw?.results ?? raw?.data ?? [])
          return items.map((i: any) => mapRedditItem(i)).filter((x): x is RawSearchResult => x !== null)
        }
        if (source === 'hackernews') {
          const raw = await searchHackerNews(query, 10, abortController.signal)
          const items = Array.isArray(raw) ? raw : (raw?.results ?? raw?.hits ?? [])
          return items.map(mapHNItem).filter((x): x is RawSearchResult => x !== null)
        }
        if (source === 'youtube') {
          const raw = await searchYouTube(query, 10, abortController.signal)
          const items = Array.isArray(raw) ? raw : (raw?.results ?? raw?.data ?? [])
          return items.map(mapYouTubeItem).filter((x): x is RawSearchResult => x !== null)
        }
        if (source === 'stackoverflow') {
          const raw = await searchStackOverflow(query, 10, abortController.signal)
          return (Array.isArray(raw) ? raw : []).map((i: any) => mapGenericItem(i, 'stackoverflow')).filter((x): x is RawSearchResult => x !== null)
        }
        if (source === 'github') {
          const raw = await searchGitHubIssues(query, 10, abortController.signal)
          return (Array.isArray(raw) ? raw : []).map((i: any) => mapGenericItem(i, 'github')).filter((x): x is RawSearchResult => x !== null)
        }
        // SearXNG site: sources
        const raw = await searchSite(source as string, query, 8, abortController.signal)
        return (Array.isArray(raw) ? raw : []).map((i: any) => mapGenericItem(i, source)).filter((x): x is RawSearchResult => x !== null)
      } catch {
        return []
      }
    })

    const batches = await pLimit(factories, 5)
    for (const batch of batches) results.push(...batch)

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

export const ALL_SOURCES: ScanSource[] = [
  'reddit', 'hackernews', 'youtube',
  'stackoverflow', 'github',
  'producthunt', 'indiehackers', 'g2', 'capterra',
  'twitter', 'linkedin', 'discord',
  'mobbin', 'behance', 'dribbble', 'thefwa',
]

export async function runPainSearch(
  sources: ScanSource[] = ALL_SOURCES,
  onProgress: ProgressCallback = () => {},
  signal?: AbortSignal,
): Promise<RawSearchResult[]> {
  // Run all sources in parallel so one slow/hung source never blocks the rest.
  // Promise.allSettled ensures we collect whatever finished before abort.
  const settled = await Promise.allSettled(
    sources.map((source) => runSource(source, onProgress, signal)),
  )
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}
