import { describe, it, expect } from 'vitest'
import { matchesQuery, filterContent } from './filter.js'

const items = [
  { id: 'a', title: 'Building effective agents with Claude', summary: 'agent patterns', type: 'video', topicIds: ['topic_claude'], tagIds: ['tag_walkthrough'], publishedAt: '2024-12-19' },
  { id: 'b', title: 'Tool use overview',       summary: 'tool use',        type: 'article', topicIds: ['topic_claude'], tagIds: ['tag_tutorial'],     publishedAt: '2024-08-01' },
  { id: 'c', title: 'Intro to MCP',            summary: 'protocol',        type: 'video',   topicIds: ['topic_mcp'],     tagIds: ['tag_announcement'], publishedAt: '2024-11-25' },
]

describe('matchesQuery', () => {
  it('matches by title substring (case-insensitive)', () => {
    expect(matchesQuery(items[0], 'claude')).toBe(true)
    expect(matchesQuery(items[0], 'CLAUDE')).toBe(true)
  })
  it('matches by summary', () => {
    expect(matchesQuery(items[1], 'tool')).toBe(true)
  })
  it('returns true for empty query', () => {
    expect(matchesQuery(items[0], '')).toBe(true)
  })
  it('returns false when nothing matches', () => {
    expect(matchesQuery(items[0], 'zzz')).toBe(false)
  })
})

describe('filterContent', () => {
  it('filters by type', () => {
    expect(filterContent(items, { type: 'video' })).toHaveLength(2)
  })
  it('filters by topic', () => {
    expect(filterContent(items, { topicIds: ['topic_mcp'] })).toHaveLength(1)
  })
  it('filters by tag', () => {
    expect(filterContent(items, { tagIds: ['tag_tutorial'] })).toHaveLength(1)
  })
  it('combines filters with AND', () => {
    expect(filterContent(items, { type: 'video', topicIds: ['topic_claude'] })).toHaveLength(1)
  })
  it('returns all when filters empty', () => {
    expect(filterContent(items, {})).toHaveLength(3)
  })
  it('sorts newest first when sort=newest', () => {
    const out = filterContent(items, { sort: 'newest' })
    expect(out[0].id).toBe('a')
    expect(out[2].id).toBe('b')
  })
})
