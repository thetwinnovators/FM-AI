import { describe, it, expect } from 'vitest'
import { extractSignal, extractSignals } from '../signalExtractor.js'

const MOCK_RESULT = {
  title: 'I hate how excel takes forever to export',
  body:  'I have to manually copy paste every day. Terrible nightmare.',
  url:   'https://reddit.com/r/excel/1',
  source: 'reddit' as const,
  author: 'testuser',
  publishedAt: '2026-04-01T10:00:00Z',
}

describe('extractSignal', () => {
  it('returns null for weak signals (intensityScore < 3)', () => {
    const weak = { ...MOCK_RESULT, title: 'Nice tool', body: 'Works okay' }
    expect(extractSignal(weak, 'test query')).toBeNull()
  })

  it('returns a PainSignal for strong signals', () => {
    const signal = extractSignal(MOCK_RESULT, 'test query')
    expect(signal).not.toBeNull()
    expect(signal!.intensityScore).toBeGreaterThanOrEqual(3)
    expect(signal!.source).toBe('reddit')
    expect(signal!.sourceUrl).toBe(MOCK_RESULT.url)
    expect(signal!.queryUsed).toBe('test query')
  })

  it('classifies pain type from text', () => {
    const signal = extractSignal(MOCK_RESULT, 'test query')
    expect(signal!.painType).toBeDefined()
  })

  it('populates normalizedText and keyTerms', () => {
    const signal = extractSignal(MOCK_RESULT, 'test query')
    expect(signal!.normalizedText.length).toBeGreaterThan(0)
    expect(signal!.keyTerms.length).toBeGreaterThan(0)
  })

  it('generates a stable id from url + source', () => {
    const s1 = extractSignal(MOCK_RESULT, 'q1')
    const s2 = extractSignal(MOCK_RESULT, 'q2')
    // same content → same id regardless of query
    expect(s1!.id).toBe(s2!.id)
  })
})

describe('extractSignals', () => {
  it('filters out null signals', () => {
    const results = [
      MOCK_RESULT,
      { ...MOCK_RESULT, url: 'https://reddit.com/2', title: 'Fine', body: 'All good' },
    ]
    const signals = extractSignals(results, 'test')
    expect(signals.every((s) => s.intensityScore >= 3)).toBe(true)
  })

  it('deduplicates by id', () => {
    const results = [MOCK_RESULT, MOCK_RESULT]
    const signals = extractSignals(results, 'test')
    expect(signals.length).toBe(1)
  })
})
