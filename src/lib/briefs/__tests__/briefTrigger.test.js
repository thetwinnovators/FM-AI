import { describe, it, expect } from 'vitest'
import {
  newItemsSinceLastBrief,
  shouldGenerateTopicBrief,
} from '../briefTrigger.js'

const topicId = 't1'

function makeItem(topicId, savedAt) {
  return { id: `item-${savedAt}`, topicId, savedAt }
}

function makeBrief(topicId, generatedAt) {
  return { id: `b-${generatedAt}`, type: 'topic', topicId, generatedAt }
}

describe('newItemsSinceLastBrief', () => {
  it('counts items saved after the last brief for this topic', () => {
    const items = [
      makeItem(topicId, 100),
      makeItem(topicId, 200),
      makeItem(topicId, 300),
    ]
    const briefs = { b1: makeBrief(topicId, 150) }
    expect(newItemsSinceLastBrief(topicId, items, briefs)).toBe(2)
  })

  it('counts all items when no prior brief exists', () => {
    const items = [makeItem(topicId, 100), makeItem(topicId, 200)]
    expect(newItemsSinceLastBrief(topicId, items, {})).toBe(2)
  })

  it('ignores items from other topics', () => {
    const items = [makeItem('other', 300), makeItem(topicId, 300)]
    expect(newItemsSinceLastBrief(topicId, items, {})).toBe(1)
  })

  it('returns 0 when no items at all', () => {
    expect(newItemsSinceLastBrief(topicId, [], {})).toBe(0)
  })
})

describe('shouldGenerateTopicBrief', () => {
  it('returns true when 3 or more new items since last brief', () => {
    const items = [
      makeItem(topicId, 200),
      makeItem(topicId, 300),
      makeItem(topicId, 400),
    ]
    const briefs = { b1: makeBrief(topicId, 100) }
    expect(shouldGenerateTopicBrief(topicId, items, briefs)).toBe(true)
  })

  it('returns false when fewer than 3 new items', () => {
    const items = [makeItem(topicId, 200), makeItem(topicId, 300)]
    const briefs = { b1: makeBrief(topicId, 100) }
    expect(shouldGenerateTopicBrief(topicId, items, briefs)).toBe(false)
  })

  it('returns false when a brief was just generated (same items)', () => {
    const items = [makeItem(topicId, 200), makeItem(topicId, 300), makeItem(topicId, 400)]
    // Brief generated AFTER all items — nothing new
    const briefs = { b1: makeBrief(topicId, 500) }
    expect(shouldGenerateTopicBrief(topicId, items, briefs)).toBe(false)
  })
})
