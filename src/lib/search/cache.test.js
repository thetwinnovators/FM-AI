import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCached, setCached, clearCache, CACHE_PREFIX } from './cache.js'

describe('cache', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  it('setCached writes a value with a timestamp under the prefix', () => {
    setCached('foo', { hits: [1, 2, 3] })
    const raw = localStorage.getItem(`${CACHE_PREFIX}foo`)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw)
    expect(parsed.data.hits).toEqual([1, 2, 3])
    expect(typeof parsed.at).toBe('number')
  })

  it('getCached returns the value when fresh', () => {
    setCached('foo', { x: 1 })
    expect(getCached('foo', 60000)).toEqual({ x: 1 })
  })

  it('getCached returns null when expired', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 1, 12, 0, 0))
    setCached('foo', { x: 1 })
    vi.setSystemTime(new Date(2025, 0, 1, 14, 0, 0)) // 2 hours later
    expect(getCached('foo', 30 * 60 * 1000)).toBeNull()
  })

  it('getCached returns null when missing', () => {
    expect(getCached('nope', 60000)).toBeNull()
  })

  it('clearCache only clears entries under the prefix', () => {
    setCached('foo', 1)
    localStorage.setItem('unrelated', 'keep')
    clearCache()
    expect(localStorage.getItem(`${CACHE_PREFIX}foo`)).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep')
  })

  it('handles malformed JSON gracefully', () => {
    localStorage.setItem(`${CACHE_PREFIX}bad`, 'not json')
    expect(getCached('bad', 60000)).toBeNull()
  })
})
