import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAiNews, deduplicateStories } from '../fetchAiNews.js'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

function makeHnResponse(hits) {
  return { ok: true, json: async () => ({ hits }) }
}

function makeRedditResponse(posts) {
  return {
    ok: true,
    json: async () => ({ data: { children: posts.map((p) => ({ data: p })) } }),
  }
}

beforeEach(() => vi.clearAllMocks())

const HN_HIT = { objectID: 'hn1', title: 'GPT-5 released', url: 'https://a.com', points: 300, num_comments: 50 }
const HN_HIT2 = { objectID: 'hn2', title: 'Claude 4 announced', url: 'https://b.com', points: 200, num_comments: 30 }
const REDDIT_POST = { id: 'r1', title: 'GPT-5 released', url: 'https://a.com', score: 400, subreddit: 'MachineLearning' }

describe('deduplicateStories', () => {
  it('removes stories with duplicate URLs', () => {
    const stories = [
      { id: 'a', url: 'https://same.com', title: 'Story A', score: 100 },
      { id: 'b', url: 'https://same.com', title: 'Story B', score: 50 },
      { id: 'c', url: 'https://other.com', title: 'Story C', score: 200 },
    ]
    const result = deduplicateStories(stories)
    expect(result).toHaveLength(2)
    // Keeps the higher-scored one
    expect(result.find((s) => s.url === 'https://same.com').score).toBe(100)
  })

  it('keeps stories with unique URLs', () => {
    const stories = [
      { id: 'a', url: 'https://a.com', title: 'A', score: 100 },
      { id: 'b', url: 'https://b.com', title: 'B', score: 50 },
    ]
    expect(deduplicateStories(stories)).toHaveLength(2)
  })
})

describe('fetchAiNews', () => {
  it('returns merged deduplicated stories from HN and Reddit', async () => {
    mockFetch
      .mockResolvedValueOnce(makeHnResponse([HN_HIT, HN_HIT2]))   // HN call
      .mockResolvedValueOnce(makeRedditResponse([REDDIT_POST]))    // Reddit call

    const stories = await fetchAiNews()

    // HN and Reddit both have "GPT-5" story at same URL → deduped to 1
    expect(stories.length).toBe(2) // GPT-5 (deduped) + Claude 4
  })

  it('returns empty array when both fetches fail', async () => {
    mockFetch.mockRejectedValue(new Error('network'))
    const stories = await fetchAiNews()
    expect(stories).toEqual([])
  })

  it('returns HN results even when Reddit fails', async () => {
    mockFetch
      .mockResolvedValueOnce(makeHnResponse([HN_HIT]))
      .mockRejectedValueOnce(new Error('reddit down'))

    const stories = await fetchAiNews()
    expect(stories.length).toBe(1)
  })
})
