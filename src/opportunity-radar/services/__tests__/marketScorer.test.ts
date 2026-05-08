import { describe, it, expect } from 'vitest'
import { inferCategory, computeMarketScore } from '../marketScorer.js'
import type { OpportunityCluster, CategoryChart, WinningApp } from '../../types.js'

function makeCluster(terms: Record<string, number> = {}): OpportunityCluster {
  const now = new Date().toISOString()
  return {
    id: 'c1', clusterName: 'test', painTheme: 'workflow',
    signalIds: [], signalCount: 10, sourceDiversity: 2,
    avgIntensity: 5, firstDetected: now, lastDetected: now,
    termFrequency: terms, opportunityScore: 0, isBuildable: true,
    status: 'emerging', createdAt: now, updatedAt: now,
  }
}

function makeChart(category: string, rankCount = 10): CategoryChart {
  return {
    category, chartType: 'top_free', fetchedAt: new Date().toISOString(),
    apps: Array.from({ length: rankCount }, (_, i) => ({
      rank: i + 1, name: `App ${i}`, publisher: 'Pub', appId: `app${i}`,
    })),
  }
}

function makeWinningApp(category: string, pricingModel: WinningApp['pricingModel'] = 'free', notes = ''): WinningApp {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), name: 'TestApp', category, pricingModel, notes, addedAt: now, updatedAt: now }
}

// ── inferCategory ─────────────────────────────────────────────────────────────

describe('inferCategory', () => {
  it('infers productivity from task/todo terms', () => {
    const c = makeCluster({ task: 5, todo: 4, organize: 3 })
    expect(inferCategory(c)).toBe('productivity')
  })

  it('infers finance from budget/expense terms', () => {
    const c = makeCluster({ budget: 6, expense: 5, tax: 2 })
    expect(inferCategory(c)).toBe('finance')
  })

  it('returns null when no category exceeds 20% keyword overlap', () => {
    const c = makeCluster({ random: 5, irrelevant: 3 })
    expect(inferCategory(c)).toBeNull()
  })

  it('picks the category with the highest overlap', () => {
    // social has more matching terms than productivity here
    const c = makeCluster({ post: 4, share: 3, follow: 2, friend: 2, task: 1 })
    expect(inferCategory(c)).toBe('social')
  })
})

// ── computeMarketScore ────────────────────────────────────────────────────────

describe('computeMarketScore', () => {
  it('returns marketScore=0 and no inferredCategory when terms are unrecognised', () => {
    const c = makeCluster({ foo: 1, bar: 1 })
    const result = computeMarketScore(c, [], [])
    expect(result.marketScore).toBe(0)
    expect(result.inferredCategory).toBeNull()
  })

  it('awards CategoryChartPresence=100 when charts exist for the inferred category', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const chart = makeChart('productivity')
    const result = computeMarketScore(c, [chart], [])
    expect(result.breakdown.categoryChartPresence).toBe(100)
  })

  it('awards CategoryChartPresence=0 when no charts exist for the inferred category', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const result = computeMarketScore(c, [], [])  // no charts at all
    expect(result.breakdown.categoryChartPresence).toBe(0)
  })

  it('WinningAppDensity scales with number of apps (cap at 5)', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const apps = Array.from({ length: 3 }, () => makeWinningApp('productivity'))
    const result = computeMarketScore(c, [], apps)
    // 3/5 * 100 = 60
    expect(result.breakdown.winningAppDensity).toBe(60)
  })

  it('WinningAppDensity caps at 100 with 5+ apps', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const apps = Array.from({ length: 7 }, () => makeWinningApp('productivity'))
    const result = computeMarketScore(c, [], apps)
    expect(result.breakdown.winningAppDensity).toBe(100)
  })

  it('CompetitorWeaknessSignal is fraction of apps with non-empty notes', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const apps = [
      makeWinningApp('productivity', 'free', 'has complaints'),
      makeWinningApp('productivity', 'free', ''),
    ]
    const result = computeMarketScore(c, [], apps)
    expect(result.breakdown.competitorWeakness).toBe(50) // 1/2 = 50%
  })

  it('total marketScore is weighted blend of four components', () => {
    const c = makeCluster({ task: 5, todo: 4, calendar: 3 })
    const chart = makeChart('productivity')
    const apps  = Array.from({ length: 5 }, () => makeWinningApp('productivity', 'subscription', 'some notes'))
    const result = computeMarketScore(c, [chart], apps)

    const expected = Math.round(
      0.35 * result.breakdown.categoryChartPresence +
      0.25 * result.breakdown.chartRankStrength +
      0.25 * result.breakdown.winningAppDensity +
      0.15 * result.breakdown.competitorWeakness,
    )
    expect(result.marketScore).toBe(expected)
    expect(result.marketScore).toBeGreaterThan(0)
  })
})
