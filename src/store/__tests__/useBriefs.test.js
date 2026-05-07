import { describe, it, expect, beforeEach } from 'vitest'

// We test the pure selectors directly — no React needed.
// Import the module-level helpers once they exist.
import {
  unreadBriefCount,
  allBriefsSorted,
} from '../../store/useStore.js'

const TOPIC_BRIEF = {
  id: 'b1',
  type: 'topic',
  title: 'Agentic AI',
  topicId: 't1',
  generatedAt: 1000,
  readAt: null,
  newItemCount: 3,
  sourceCount: 2,
  sections: [],
}

const NEWS_BRIEF = {
  id: 'b2',
  type: 'news_digest',
  title: 'Today in AI',
  topicId: null,
  generatedAt: 2000,
  readAt: null,
  newItemCount: 6,
  sourceCount: 3,
  sections: [],
}

const READ_BRIEF = {
  id: 'b3',
  type: 'topic',
  title: 'Old topic',
  topicId: 't2',
  generatedAt: 500,
  readAt: 600,
  newItemCount: 3,
  sourceCount: 1,
  sections: [],
}

describe('unreadBriefCount', () => {
  it('counts briefs where readAt is null', () => {
    const briefs = { b1: TOPIC_BRIEF, b2: NEWS_BRIEF, b3: READ_BRIEF }
    expect(unreadBriefCount(briefs)).toBe(2)
  })

  it('returns 0 when all are read', () => {
    expect(unreadBriefCount({ b3: READ_BRIEF })).toBe(0)
  })

  it('returns 0 for empty object', () => {
    expect(unreadBriefCount({})).toBe(0)
  })
})

describe('allBriefsSorted', () => {
  it('puts news_digest first among unread', () => {
    const briefs = { b1: TOPIC_BRIEF, b2: NEWS_BRIEF }
    const sorted = allBriefsSorted(briefs)
    expect(sorted[0].id).toBe('b2')
  })

  it('puts read briefs after unread', () => {
    const briefs = { b1: TOPIC_BRIEF, b2: NEWS_BRIEF, b3: READ_BRIEF }
    const sorted = allBriefsSorted(briefs)
    expect(sorted[sorted.length - 1].id).toBe('b3')
  })

  it('sorts unread topic briefs by generatedAt descending', () => {
    const older = { ...TOPIC_BRIEF, id: 'b_old', generatedAt: 100 }
    const newer = { ...TOPIC_BRIEF, id: 'b_new', generatedAt: 900 }
    const sorted = allBriefsSorted({ b_old: older, b_new: newer })
    expect(sorted[0].id).toBe('b_new')
  })
})
