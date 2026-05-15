import { describe, it, expect } from 'vitest'
import { scoreCluster, applyBuildabilityFilter, getTop3, scoreOpportunity, scoreDimensions, buildScoreExplanations } from '../opportunityScorer.js'
import type { OpportunityCluster, PainSignal, CategoryChart, WinningApp } from '../../types.js'

function makeCluster(overrides: Partial<OpportunityCluster> = {}): OpportunityCluster {
  const now = new Date().toISOString()
  return {
    id: 'c1',
    clusterName: 'manual spreadsheet export pain',
    painTheme: 'workflow',
    signalIds: Array.from({ length: 12 }, (_, i) => `s${i}`),
    signalCount: 12,
    sourceDiversity: 2,
    avgIntensity: 6,
    firstDetected: '2026-03-01T00:00:00Z',
    lastDetected: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    termFrequency: { manual: 8, spreadsheet: 7, export: 6 },
    opportunityScore: 0,
    isBuildable: true,
    status: 'emerging',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeSignals(cluster: OpportunityCluster, highIntensityCount = 3): PainSignal[] {
  return cluster.signalIds.map((id, i) => ({
    id,
    detectedAt: cluster.lastDetected,
    source: (i % 2 === 0 ? 'reddit' : 'hackernews') as 'reddit' | 'hackernews',
    sourceUrl: `https://example.com/${id}`,
    painText: 'manual spreadsheet export is terrible',
    normalizedText: 'manual spreadsheet export bad',
    keyTerms: ['manual', 'spreadsheet', 'export'],
    painType: 'workflow' as const,
    intensityScore: i < highIntensityCount ? 8 : 4,
    queryUsed: 'test',
  }))
}

describe('applyBuildabilityFilter', () => {
  it('passes buildable cluster', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    expect(applyBuildabilityFilter(c, signals)).toBe(true)
  })

  it('fails cluster with enterprise terms', () => {
    const c = makeCluster({ termFrequency: { 'multi-user': 5, admin: 3 } })
    const signals = makeSignals(c)
    expect(applyBuildabilityFilter(c, signals)).toBe(false)
  })

  it('fails cluster with oauth in signal texts', () => {
    const c = makeCluster()
    const signals = makeSignals(c).map((s) => ({ ...s, painText: 'needs oauth integration' }))
    expect(applyBuildabilityFilter(c, signals)).toBe(false)
  })
})

describe('scoreCluster', () => {
  it('scores a valid cluster above 20', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    const score = scoreCluster(c, signals)
    expect(score).toBeGreaterThan(20)
  })

  it('adds recency bonus for signals within 7 days', () => {
    const recent = makeCluster({ lastDetected: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() })
    const old    = makeCluster({ lastDetected: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() })
    const signals = makeSignals(recent)
    expect(scoreCluster(recent, signals)).toBeGreaterThan(scoreCluster(old, signals))
  })

  it('applies saturation penalty for solved-problem keywords', () => {
    const saturated = makeCluster({ termFrequency: { notion: 5, jira: 4, slack: 3 } })
    const normal    = makeCluster()
    const sSat  = makeSignals(saturated)
    const sNorm = makeSignals(normal)
    expect(scoreCluster(saturated, sSat)).toBeLessThan(scoreCluster(normal, sNorm))
  })
})

describe('getTop3', () => {
  it('returns top 3 qualifying clusters sorted by score', () => {
    const clusters = [
      makeCluster({ id: 'a', opportunityScore: 50, signalCount: 15, signalIds: Array.from({ length: 15 }, (_, i) => `a${i}`) }),
      makeCluster({ id: 'b', opportunityScore: 40, signalCount: 12, signalIds: Array.from({ length: 12 }, (_, i) => `b${i}`) }),
      makeCluster({ id: 'c', opportunityScore: 35, signalCount: 11, signalIds: Array.from({ length: 11 }, (_, i) => `c${i}`) }),
      makeCluster({ id: 'd', opportunityScore: 25, signalCount: 10, signalIds: Array.from({ length: 10 }, (_, i) => `d${i}`) }),
    ]
    const allSignals = clusters.flatMap((c) => makeSignals(c))
    const top3 = getTop3(clusters, allSignals)
    expect(top3).toHaveLength(3)
    expect(top3[0].id).toBe('a')
  })

  it('excludes clusters that fail the qualification gate', () => {
    const small = makeCluster({ id: 'z', signalCount: 5, signalIds: ['a','b','c','d','e'] })
    const good  = [
      makeCluster({ id: 'a', opportunityScore: 50, signalIds: Array.from({ length: 12 }, (_, i) => `a${i}`) }),
      makeCluster({ id: 'b', opportunityScore: 40, signalIds: Array.from({ length: 12 }, (_, i) => `b${i}`) }),
      makeCluster({ id: 'c', opportunityScore: 35, signalIds: Array.from({ length: 12 }, (_, i) => `c${i}`) }),
    ]
    const allSignals = [...good, small].flatMap((c) => makeSignals(c))
    const top3 = getTop3([small, ...good], allSignals)
    expect(top3.map((c) => c.id)).not.toContain('z')
  })
})

// ── scoreOpportunity ──────────────────────────────────────────────────────────

function makeChart(category: string): CategoryChart {
  return {
    category, chartType: 'top_free', fetchedAt: new Date().toISOString(),
    apps: Array.from({ length: 10 }, (_, i) => ({ rank: i + 1, name: `App ${i}`, publisher: 'Pub', appId: `a${i}` })),
  }
}

function makeWinningApp(category: string, pricing: WinningApp['pricingModel'] = 'subscription', notes = 'complaints here'): WinningApp {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), name: 'App', category, pricingModel: pricing, notes, addedAt: now, updatedAt: now }
}

describe('scoreOpportunity', () => {
  it('returns a totalScore between 0 and 100', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    const result = scoreOpportunity(c, signals, [], [])
    expect(result.totalScore).toBeGreaterThanOrEqual(0)
    expect(result.totalScore).toBeLessThanOrEqual(100)
  })

  it('totalScore = Math.round(0.40*gap + 0.40*market + 0.20*buildability)', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    const result = scoreOpportunity(c, signals, [], [])
    const expected = Math.round(0.40 * result.gapScore + 0.40 * result.marketScore + 0.20 * result.buildabilityScore)
    expect(result.totalScore).toBe(expected)
  })

  it('marketScore increases when chart data is provided for the inferred category', () => {
    // Use a cluster with productivity terms so inferCategory returns 'productivity'
    const c = makeCluster({ termFrequency: { task: 8, todo: 6, organize: 4, plan: 3 } })
    const signals = makeSignals(c)
    const withoutMarket = scoreOpportunity(c, signals, [], [])
    const chart = makeChart('productivity')
    const withMarket = scoreOpportunity(c, signals, [chart], [])
    expect(withMarket.marketScore).toBeGreaterThan(withoutMarket.marketScore)
  })

  it('buildable cluster scores higher buildabilityScore than unbuildable cluster', () => {
    const buildable   = makeCluster({ termFrequency: { task: 8, todo: 6, organize: 4, plan: 3 } })
    const unbuildable = makeCluster({ termFrequency: { 'multi-user': 5, admin: 3, oauth: 2 } })
    const signals     = makeSignals(buildable)
    const b = scoreOpportunity(buildable,   signals, [], [])
    const u = scoreOpportunity(unbuildable, signals, [], [])
    expect(b.buildabilityScore).toBeGreaterThan(u.buildabilityScore)
  })

  it('unbuildable cluster has feasibility = 0', () => {
    const c = makeCluster({ termFrequency: { 'multi-user': 5, admin: 3, oauth: 2 } })
    const signals = makeSignals(c)
    const result = scoreOpportunity(c, signals, [], [])
    expect(result.dimensionScores.feasibility).toBe(0)
  })

  it('dimensionScores is present and contains all 11 keys (10 dimensions + confidence)', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    const result = scoreOpportunity(c, signals, [], [])
    expect(result.dimensionScores).toBeDefined()
    expect(Object.keys(result.dimensionScores)).toHaveLength(11)
  })
})

// ── scoreDimensions ───────────────────────────────────────────────────────────

describe('scoreDimensions', () => {
  it('all 10 dimension scores are between 0 and 100', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    const dim = scoreDimensions(c, signals)
    for (const val of Object.values(dim)) {
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThanOrEqual(100)
    }
  })

  it('feasibility is 0 when BUILDABILITY_REGEX matches cluster terms', () => {
    const c = makeCluster({ termFrequency: { oauth: 5, websocket: 3, 'real-time-collab': 2 } })
    const signals = makeSignals(c)
    expect(scoreDimensions(c, signals).feasibility).toBe(0)
  })

  it('feasibility is > 0 for a cleanly buildable cluster', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    expect(scoreDimensions(c, signals).feasibility).toBeGreaterThan(0)
  })

  it('urgency is higher for a recent cluster than a 6-month-old one', () => {
    const recent = makeCluster({ lastDetected: new Date(Date.now() - 2 * 86_400_000).toISOString() })
    const old    = makeCluster({ lastDetected: new Date(Date.now() - 200 * 86_400_000).toISOString() })
    const signals = makeSignals(recent)
    expect(scoreDimensions(recent, signals).urgency).toBeGreaterThan(
      scoreDimensions(old, makeSignals(old)).urgency,
    )
  })

  it('painSeverity increases with higher avgIntensity', () => {
    const lo = makeCluster({ avgIntensity: 3 })
    const hi = makeCluster({ avgIntensity: 9 })
    const signals = makeSignals(lo)
    expect(scoreDimensions(hi, signals).painSeverity).toBeGreaterThan(
      scoreDimensions(lo, signals).painSeverity,
    )
  })

  it('poorSolutionFit gets a 20-point bonus for workaround pain theme', () => {
    const workaround = makeCluster({ painTheme: 'workaround' })
    const cost       = makeCluster({ painTheme: 'cost' })
    const signals    = makeSignals(workaround)
    expect(scoreDimensions(workaround, signals).poorSolutionFit).toBeGreaterThan(
      scoreDimensions(cost, signals).poorSolutionFit,
    )
  })

  it('whyNow is boosted by AI-momentum keywords in cluster terms', () => {
    const aiCluster  = makeCluster({ termFrequency: { llm: 10, ai: 8, automation: 6 } })
    const noAi       = makeCluster({ termFrequency: { manual: 10, export: 8, report: 6 } })
    const signals = makeSignals(aiCluster)
    expect(scoreDimensions(aiCluster, signals).whyNow).toBeGreaterThan(
      scoreDimensions(noAi, signals).whyNow,
    )
  })

  it('frequency grows with signal count and source diversity', () => {
    const small = makeCluster({ signalCount: 5,  sourceDiversity: 1, signalIds: Array.from({ length: 5 },  (_, i) => `s${i}`) })
    const large = makeCluster({ signalCount: 40, sourceDiversity: 3, signalIds: Array.from({ length: 40 }, (_, i) => `l${i}`) })
    const sSmall = makeSignals(small)
    const sLarge = makeSignals(large)
    expect(scoreDimensions(large, sLarge).frequency).toBeGreaterThan(
      scoreDimensions(small, sSmall).frequency,
    )
  })
})

// ── buildScoreExplanations ────────────────────────────────────────────────────

describe('buildScoreExplanations', () => {
  it('returns 10 entries with dimension, score, explanation, and confidence', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    const dim = scoreDimensions(c, signals)
    const explanations = buildScoreExplanations(dim, c.signalCount)
    expect(explanations).toHaveLength(10)
    for (const entry of explanations) {
      expect(entry.dimension).toBeTruthy()
      expect(typeof entry.score).toBe('number')
      expect(typeof entry.explanation).toBe('string')
      expect(typeof entry.confidence).toBe('number')
    }
  })

  it('includes all 10 dimensions in the correct order', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    const dim = scoreDimensions(c, signals)
    const explanations = buildScoreExplanations(dim, c.signalCount)
    const dimensions = explanations.map((e) => e.dimension)
    expect(dimensions).toEqual([
      'Pain Severity',
      'Frequency',
      'Urgency',
      'Willingness to Pay',
      'Market Breadth',
      'Weak Solution Fit',
      'Feasibility',
      'Why Now',
      'Defensibility',
      'GTM Clarity',
    ])
  })

  it('uses provided confidence from dimensionScores when available', () => {
    const c = makeCluster({ signalCount: 15 })
    const signals = makeSignals(c)
    const dim = { ...scoreDimensions(c, signals), confidence: 0.88 }
    const explanations = buildScoreExplanations(dim, c.signalCount)
    for (const entry of explanations) {
      expect(entry.confidence).toBe(0.88)
    }
  })

  it('computes confidence from signalCount when not in dimensionScores', () => {
    const c = makeCluster({ signalCount: 25 })
    const signals = makeSignals(c)
    const dim = scoreDimensions(c, signals)
    const explanations = buildScoreExplanations(dim, c.signalCount)
    // signalCount >= 20 → confidence = 0.95
    for (const entry of explanations) {
      expect(entry.confidence).toBe(0.95)
    }
  })

  it('includes signalCount in Frequency explanation when score is high', () => {
    // Need signalCount * 2 + sourceDiversity * 5 >= 65
    // With sourceDiversity = 2, need signalCount * 2 + 10 >= 65, so signalCount >= 28
    const c = makeCluster({ signalCount: 30, sourceDiversity: 2, signalIds: Array.from({ length: 30 }, (_, i) => `s${i}`) })
    const signals = makeSignals(c)
    const dim = scoreDimensions(c, signals)
    const explanations = buildScoreExplanations(dim, c.signalCount)
    const freqExpl = explanations.find((e) => e.dimension === 'Frequency')
    expect(freqExpl?.explanation).toContain('30 signals')
  })

  it('explanation changes based on score tier (high/mid/low)', () => {
    const low = { ...scoreDimensions(makeCluster(), makeSignals(makeCluster())), painSeverity: 20 }
    const high = { ...scoreDimensions(makeCluster(), makeSignals(makeCluster())), painSeverity: 80 }
    const lowExpl = buildScoreExplanations(low, 10)
    const highExpl = buildScoreExplanations(high, 10)
    const lowPain = lowExpl.find((e) => e.dimension === 'Pain Severity')
    const highPain = highExpl.find((e) => e.dimension === 'Pain Severity')
    expect(lowPain?.explanation).not.toBe(highPain?.explanation)
  })
})
