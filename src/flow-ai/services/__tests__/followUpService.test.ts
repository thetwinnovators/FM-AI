import { describe, it, expect } from 'vitest'
import {
  generateHeuristicFollowUps,
  pickActions,
} from '../followUpService.js'

describe('generateHeuristicFollowUps', () => {
  it('returns 3 questions for retrieval intent', () => {
    const result = generateHeuristicFollowUps('retrieval', 'Some answer about AI agents.')
    expect(result).toHaveLength(3)
    result.forEach((q) => expect(typeof q).toBe('string'))
    result.forEach((q) => expect(q.length).toBeGreaterThan(0))
  })

  it('returns questions for signal_analysis intent', () => {
    const result = generateHeuristicFollowUps('signal_analysis', 'Rising signal detected.')
    expect(result).toHaveLength(3)
  })

  it('returns questions for unknown/undefined intent', () => {
    const result = generateHeuristicFollowUps('unclear', '')
    expect(result).toHaveLength(3)
  })

  it('never returns duplicate questions', () => {
    const result = generateHeuristicFollowUps('retrieval', 'test')
    const unique = new Set(result)
    expect(unique.size).toBe(result.length)
  })
})

describe('pickActions', () => {
  it('returns empty array for casual_chat', () => {
    expect(pickActions('casual_chat')).toEqual([])
  })

  it('returns save-as-note for retrieval', () => {
    const actions = pickActions('retrieval')
    expect(actions).toContain('save-as-note')
  })

  it('returns at most 2 actions', () => {
    const actions = pickActions('content_ideation')
    expect(actions.length).toBeLessThanOrEqual(2)
  })
})
