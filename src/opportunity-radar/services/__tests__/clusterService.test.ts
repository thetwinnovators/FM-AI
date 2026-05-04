import { describe, it, expect } from 'vitest'
import { KeywordClusterer } from '../clusterService.js'
import type { PainSignal } from '../../types.js'

function makeSignal(overrides: Partial<PainSignal> = {}): PainSignal {
  return {
    id: Math.random().toString(36).slice(2),
    detectedAt: '2026-04-01T00:00:00Z',
    source: 'reddit',
    sourceUrl: 'https://reddit.com/1',
    painText: 'I hate manual spreadsheet export every day',
    normalizedText: 'manual spreadsheet export annoyed',
    keyTerms: ['manual', 'spreadsheet', 'export', 'annoyed'],
    painType: 'workflow',
    intensityScore: 5,
    queryUsed: 'test',
    ...overrides,
  }
}

describe('KeywordClusterer', () => {
  it('creates a new cluster for first signal', () => {
    const clusterer = new KeywordClusterer()
    const s = makeSignal()
    const clusters = clusterer.cluster([s], [])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].signalIds).toContain(s.id)
  })

  it('adds similar signal to existing cluster (Jaccard >= 0.35)', () => {
    const clusterer = new KeywordClusterer()
    const s1 = makeSignal({ id: 'a', keyTerms: ['manual', 'spreadsheet', 'export', 'pain'] })
    const s2 = makeSignal({ id: 'b', keyTerms: ['manual', 'spreadsheet', 'export', 'slow'] })
    const clusters = clusterer.cluster([s1, s2], [])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].signalIds).toContain('a')
    expect(clusters[0].signalIds).toContain('b')
  })

  it('creates separate clusters for dissimilar signals', () => {
    const clusterer = new KeywordClusterer()
    const s1 = makeSignal({ id: 'a', keyTerms: ['manual', 'spreadsheet', 'export'] })
    const s2 = makeSignal({ id: 'b', keyTerms: ['pricing', 'expensive', 'costly', 'budget'], painType: 'cost' })
    const clusters = clusterer.cluster([s1, s2], [])
    expect(clusters).toHaveLength(2)
  })

  it('merges clusters with >70% overlapping signalIds', () => {
    const clusterer = new KeywordClusterer()
    const shared = ['a','b','c','d','e'].map((id) => makeSignal({ id }))
    const s6 = makeSignal({ id: 'f', keyTerms: ['manual','spreadsheet','export','report'] })
    const s7 = makeSignal({ id: 'g', keyTerms: ['manual','spreadsheet','slow','export'] })
    const all = [...shared, s6, s7]
    const clusters = clusterer.cluster(all, [])
    const totalSignalIds = clusters.flatMap((c) => c.signalIds)
    const unique = new Set(totalSignalIds)
    expect(unique.size).toBe(7)
  })

  it('updates termFrequency with every signal\'s keyTerms', () => {
    const clusterer = new KeywordClusterer()
    const s = makeSignal({ keyTerms: ['manual', 'spreadsheet'] })
    const clusters = clusterer.cluster([s], [])
    expect(clusters[0].termFrequency['manual']).toBeGreaterThanOrEqual(1)
    expect(clusters[0].termFrequency['spreadsheet']).toBeGreaterThanOrEqual(1)
  })

  it('sets clusterName to top 3 terms by frequency', () => {
    const clusterer = new KeywordClusterer()
    const signals = [
      makeSignal({ id: '1', keyTerms: ['manual', 'spreadsheet', 'export', 'pain'] }),
      makeSignal({ id: '2', keyTerms: ['manual', 'spreadsheet', 'export', 'slow'] }),
      makeSignal({ id: '3', keyTerms: ['manual', 'spreadsheet', 'report', 'annoy'] }),
    ]
    const clusters = clusterer.cluster(signals, [])
    expect(clusters[0].clusterName).toContain('manual')
    expect(clusters[0].clusterName).toContain('spreadsheet')
  })
})
