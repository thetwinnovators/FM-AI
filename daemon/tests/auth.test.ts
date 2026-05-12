import { describe, it, expect } from 'vitest'
import { verifyAuthHeader } from '../src/auth.js'

describe('auth', () => {
  const token = 'a'.repeat(64)

  it('accepts valid Bearer token', () => {
    expect(verifyAuthHeader(`Bearer ${token}`, token)).toBe(true)
  })

  it('rejects missing header', () => {
    expect(verifyAuthHeader(undefined, token)).toBe(false)
  })

  it('rejects malformed header', () => {
    expect(verifyAuthHeader('Token abc', token)).toBe(false)
    expect(verifyAuthHeader('Bearer', token)).toBe(false)
  })

  it('rejects wrong token', () => {
    expect(verifyAuthHeader(`Bearer ${'b'.repeat(64)}`, token)).toBe(false)
  })

  it('uses timing-safe comparison (length mismatch returns false)', () => {
    expect(verifyAuthHeader(`Bearer short`, token)).toBe(false)
  })
})
