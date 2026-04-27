import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLearning } from './useLearning.js'

describe('useLearning', () => {
  beforeEach(() => localStorage.clear())

  it('returns coOccurrence and topicAffinity', () => {
    const { result } = renderHook(() => useLearning())
    expect(Array.isArray(result.current.coOccurrence)).toBe(true)
    expect(typeof result.current.topicAffinity).toBe('object')
  })
})
