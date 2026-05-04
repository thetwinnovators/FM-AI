import { describe, it, expect } from 'vitest'
import { normalizeText, extractKeyTerms } from '../normalizationService.js'

describe('normalizeText', () => {
  it('lowercases input', () => {
    expect(normalizeText('FRUSTRATED With Pricing')).toContain('annoyed')
  })

  it('replaces multi-word phrases before tokenisation', () => {
    const result = normalizeText('I hate google sheets for this')
    expect(result).toContain('spreadsheet')
    expect(result).not.toContain('google')
    expect(result).not.toContain('sheets')
  })

  it('strips stopwords', () => {
    const result = normalizeText('the tool is broken for me')
    expect(result).not.toContain(' the ')
    expect(result).not.toContain(' is ')
    expect(result).not.toContain(' for ')
  })

  it('applies token synonyms after phrase substitution', () => {
    // 'terrible' → 'bad'
    expect(normalizeText('terrible experience')).toContain('bad')
  })

  it('collapses "takes forever" to "slow" via phrase map', () => {
    expect(normalizeText('this takes forever to load')).toContain('slow')
  })
})

describe('extractKeyTerms', () => {
  it('returns tokens with length >= 4', () => {
    const terms = extractKeyTerms('slow manual spreadsheet export')
    expect(terms).toContain('slow')
    expect(terms).toContain('manual')
    expect(terms).toContain('spreadsheet')
    expect(terms).toContain('export')
    // short tokens excluded
    expect(terms).not.toContain('a')
  })

  it('deduplicates terms', () => {
    const terms = extractKeyTerms('slow slow spreadsheet spreadsheet')
    expect(terms.filter((t) => t === 'slow').length).toBe(1)
  })

  it('returns empty array for empty string', () => {
    expect(extractKeyTerms('')).toEqual([])
  })
})
