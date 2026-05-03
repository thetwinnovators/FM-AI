import { vi, describe, it, expect } from 'vitest'

vi.mock('../../lib/search/queryIntent.js', () => ({
  classifyQueryIntent: vi.fn(),
  isFreshnessSensitiveQuery: vi.fn(),
}))
vi.mock('../../lib/llm/ollama.js', () => ({ generateSummary: vi.fn() }))
vi.mock('../../lib/llm/ollamaConfig.js', () => ({ OLLAMA_CONFIG: {} }))
vi.mock('../../lib/sync/fileSync.js', () => ({
  pullFromDisk: vi.fn(),
  pushToDisk: vi.fn(),
}))

import { backfillIdentityPins, IDENTITY_DEFAULT_CATEGORIES } from '../useStore.js'

describe('IDENTITY_DEFAULT_CATEGORIES', () => {
  it('includes identity-relevant categories', () => {
    expect(IDENTITY_DEFAULT_CATEGORIES.has('personal_rule')).toBe(true)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('preference')).toBe(true)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('behavior')).toBe(true)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('personal_fact')).toBe(true)
  })
  it('excludes non-identity categories', () => {
    expect(IDENTITY_DEFAULT_CATEGORIES.has('research_focus')).toBe(false)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('topic_rule')).toBe(false)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('source_pref')).toBe(false)
    expect(IDENTITY_DEFAULT_CATEGORIES.has('personal_stack')).toBe(false)
  })
})

describe('backfillIdentityPins', () => {
  it('returns empty object for empty/null/undefined input', () => {
    expect(backfillIdentityPins({})).toEqual({})
    expect(backfillIdentityPins(null)).toEqual({})
    expect(backfillIdentityPins(undefined)).toEqual({})
  })
  it('sets isIdentityPinned=true for identity categories when field is absent', () => {
    const result = backfillIdentityPins({
      m1: { id: 'm1', category: 'personal_rule', content: 'Be direct' },
    })
    expect(result.m1.isIdentityPinned).toBe(true)
  })
  it('sets isIdentityPinned=false for non-identity categories when field is absent', () => {
    const result = backfillIdentityPins({
      m2: { id: 'm2', category: 'research_focus', content: 'AI agents' },
    })
    expect(result.m2.isIdentityPinned).toBe(false)
  })
  it('does not overwrite an existing isIdentityPinned value', () => {
    const result = backfillIdentityPins({
      m3: { id: 'm3', category: 'research_focus', content: 'test', isIdentityPinned: true },
    })
    expect(result.m3.isIdentityPinned).toBe(true)
  })
  it('preserves false when explicitly set', () => {
    const result = backfillIdentityPins({
      m4: { id: 'm4', category: 'personal_rule', content: 'test', isIdentityPinned: false },
    })
    expect(result.m4.isIdentityPinned).toBe(false)
  })
  it('preserves all other entry fields unchanged', () => {
    const result = backfillIdentityPins({
      m5: { id: 'm5', category: 'preference', content: 'always be direct', confidence: 0.9, status: 'active' },
    })
    expect(result.m5.content).toBe('always be direct')
    expect(result.m5.confidence).toBe(0.9)
    expect(result.m5.status).toBe('active')
  })
})
