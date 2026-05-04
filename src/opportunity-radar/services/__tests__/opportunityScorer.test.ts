import { describe, it, expect } from 'vitest'
import { scoreCluster, applyBuildabilityFilter, getTop3 } from '../opportunityScorer.js'
import type { OpportunityCluster, PainSignal } from '../../types.js'

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
