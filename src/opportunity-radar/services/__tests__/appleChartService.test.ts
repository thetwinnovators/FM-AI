import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchCharts } from '../appleChartService.js'
import type { CategoryChart } from '../../types.js'

// Minimal Apple RSS API response shape
function makeAppleResponse(names: string[]): unknown {
  return {
    feed: {
      results: names.map((name, i) => ({
        name,
        artistName: `Publisher ${i}`,
        id: `app_${i}`,
      })),
    },
  }
}

// Module-level cache store so the hoisted vi.mock factory can close over it
let _mockCharts: CategoryChart[] = []

vi.mock('../../storage/radarStorage.js', () => ({
  loadCharts: () => _mockCharts,
  saveCharts: vi.fn(),
}))

afterEach(() => {
  vi.restoreAllMocks()
  _mockCharts = []
})

describe('fetchCharts', () => {
  it('parses Apple RSS response into CategoryChart records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeAppleResponse(['App A', 'App B', 'App C']),
    }))

    const results = await fetchCharts([{ category: 'productivity', chartType: 'top_free' }])

    expect(results).toHaveLength(1)
    expect(results[0].category).toBe('productivity')
    expect(results[0].chartType).toBe('top_free')
    expect(results[0].apps).toHaveLength(3)
    expect(results[0].apps[0]).toEqual({ rank: 1, name: 'App A', publisher: 'Publisher 0', appId: 'app_0' })
    expect(results[0].fetchedAt).toBeTruthy()
  })

  it('falls back to cached data when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    // Inject a pre-existing cache entry via the storage mock
    const cached: CategoryChart = {
      category: 'productivity',
      chartType: 'top_free',
      fetchedAt: '2026-01-01T00:00:00Z',
      apps: [{ rank: 1, name: 'Cached App', publisher: 'X', appId: 'x1' }],
    }
    _mockCharts = [cached]

    const results = await fetchCharts([{ category: 'productivity', chartType: 'top_free' }])
    expect(results).toHaveLength(1)
    expect(results[0].apps[0].name).toBe('Cached App')
  })

  it('returns empty array when fetch fails and no cache exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    _mockCharts = []

    const results = await fetchCharts([{ category: 'finance', chartType: 'top_grossing' }])
    expect(results).toHaveLength(0)
  })

  it('hits the correct Apple RSS URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeAppleResponse(['App']),
    })
    vi.stubGlobal('fetch', mockFetch)

    await fetchCharts([{ category: 'social', chartType: 'top_grossing' }])

    const calledUrl = mockFetch.mock.calls[0][0]
    expect(calledUrl).toContain('top-grossing')
    expect(calledUrl).toContain('social-networking')  // Apple slug mapping
    expect(calledUrl).toContain('50')
  })
})
