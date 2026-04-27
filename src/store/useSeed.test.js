import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSeed } from './useSeed.js'

describe('useSeed', () => {
  it('exposes the loaded entity arrays', () => {
    const { result } = renderHook(() => useSeed())
    expect(result.current.topics.length).toBeGreaterThanOrEqual(3)
    expect(result.current.content.length).toBeGreaterThanOrEqual(20)
    expect(result.current.creators.length).toBeGreaterThanOrEqual(3)
  })

  it('topicById returns a topic', () => {
    const { result } = renderHook(() => useSeed())
    const topic = result.current.topicById('topic_claude')
    expect(topic.name).toBe('Claude')
  })

  it('topicBySlug returns a topic', () => {
    const { result } = renderHook(() => useSeed())
    expect(result.current.topicBySlug('mcp').id).toBe('topic_mcp')
  })

  it('contentByTopic returns items tagged with that topic', () => {
    const { result } = renderHook(() => useSeed())
    const items = result.current.contentByTopic('topic_claude')
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((c) => c.topicIds.includes('topic_claude'))).toBe(true)
  })

  it('creatorById returns a creator', () => {
    const { result } = renderHook(() => useSeed())
    expect(result.current.creatorById('creator_anthropic').name).toBe('Anthropic')
  })
})
