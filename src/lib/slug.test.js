import { describe, it, expect } from 'vitest'
import { toSlug, slugMatches } from './slug.js'

describe('toSlug', () => {
  it('lowercases and dashes spaces', () => {
    expect(toSlug('Claude Agents')).toBe('claude-agents')
  })
  it('strips non-alphanumeric except dashes', () => {
    expect(toSlug('MCP & Tools!')).toBe('mcp-tools')
  })
  it('collapses multiple dashes', () => {
    expect(toSlug('a   b---c')).toBe('a-b-c')
  })
  it('trims edge dashes', () => {
    expect(toSlug('  hello  ')).toBe('hello')
  })
})

describe('slugMatches', () => {
  it('returns true for matching slug', () => {
    expect(slugMatches('claude', 'Claude')).toBe(true)
  })
  it('returns false for different content', () => {
    expect(slugMatches('claude', 'codex')).toBe(false)
  })
})
