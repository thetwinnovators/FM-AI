import type { CategoryChart } from '../types.js'
import { loadCharts } from '../storage/radarStorage.js'

// Chart type slug as used in Apple's URL
const CHART_TYPE_SLUG: Record<string, string> = {
  top_free:     'top-free',
  top_grossing: 'top-grossing',
}

// Apple category slugs differ from our display slugs
const APPLE_SLUGS: Record<string, string> = {
  'games':          'games',
  'productivity':   'productivity',
  'finance':        'finance',
  'entertainment':  'entertainment',
  'shopping':       'shopping',
  'social':         'social-networking',
  'health-fitness': 'health-fitness',
  'utilities':      'utilities',
}

interface FetchRequest {
  category:  string
  chartType: 'top_free' | 'top_grossing'
}

async function fetchSingleChart(
  category: string,
  chartType: 'top_free' | 'top_grossing',
  limit = 50,
): Promise<CategoryChart | null> {
  const categorySlug = APPLE_SLUGS[category]
  const chartSlug    = CHART_TYPE_SLUG[chartType]
  if (!categorySlug || !chartSlug) return null

  const url =
    `https://rss.applemarketingtools.com/api/v2/us/apps/${chartSlug}/${limit}/${categorySlug}/apps.json`

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json() as { feed?: { results?: Record<string, string>[] } }
    const results = data?.feed?.results ?? []

    const apps = results.slice(0, limit).map((item, idx) => ({
      rank:      idx + 1,
      name:      String(item.name      ?? ''),
      publisher: String(item.artistName ?? ''),
      appId:     String(item.id        ?? ''),
    }))

    return { category, chartType, fetchedAt: new Date().toISOString(), apps }
  } catch {
    return null
  }
}

/**
 * Fetch Apple RSS top-chart feeds for the given category/chartType pairs.
 * On fetch failure, returns cached data for that pair (or nothing if no cache).
 * Never throws.
 *
 * Caller is responsible for persisting results via radarStorage.saveCharts().
 */
export async function fetchCharts(requests: FetchRequest[]): Promise<CategoryChart[]> {
  const cached  = loadCharts()
  const results: CategoryChart[] = []

  for (const req of requests) {
    const chart = await fetchSingleChart(req.category, req.chartType)
    if (chart) {
      results.push(chart)
    } else {
      const fallback = cached.find(
        (c) => c.category === req.category && c.chartType === req.chartType,
      )
      if (fallback) results.push(fallback)
    }
  }

  return results
}
