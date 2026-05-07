import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/llm/ollama.js', () => ({
  chatJson: vi.fn(),
  OLLAMA_CONFIG: { enabled: true },
}))

import { chatJson, OLLAMA_CONFIG } from '../../../lib/llm/ollama.js'
import { generateNewsDigest } from '../generateNewsDigest.js'

const MOCK_STORIES = [
  { id: 'hn-1', title: 'GPT-5 released', score: 300, source: 'Hacker News', url: 'https://a.com' },
  { id: 'r-1', title: 'New RLHF paper', score: 200, source: 'r/MachineLearning', url: 'https://b.com' },
]

const MOCK_LLM_RESPONSE = {
  highlights: ['GPT-5 released with multimodal capabilities.', 'New RLHF paper shows 20% improvement.'],
  themes: ['Multimodal models dominating', 'RLHF improvements continuing'],
  top_signal: 'GPT-5 represents a step change in capability.',
  risks: 'Benchmark saturation — hard to tell genuine improvement from overfitting.',
}

beforeEach(() => {
  vi.clearAllMocks()
  OLLAMA_CONFIG.enabled = true
})

describe('generateNewsDigest', () => {
  it('returns a Brief-shaped object with news_digest type', async () => {
    chatJson.mockResolvedValue(MOCK_LLM_RESPONSE)
    const result = await generateNewsDigest(MOCK_STORIES)

    expect(result).toMatchObject({
      type: 'news_digest',
      topicId: null,
      readAt: null,
    })
    expect(result.id).toBeTruthy()
    expect(result.generatedAt).toBeGreaterThan(0)
  })

  it('maps LLM response into correct section types', async () => {
    chatJson.mockResolvedValue(MOCK_LLM_RESPONSE)
    const result = await generateNewsDigest(MOCK_STORIES)

    const types = result.sections.map((s) => s.type)
    expect(types).toContain('highlights')
    expect(types).toContain('themes')
    expect(types).toContain('top_signal')
    expect(types).toContain('risks')
  })

  it('returns null when LLM is disabled', async () => {
    OLLAMA_CONFIG.enabled = false
    const result = await generateNewsDigest(MOCK_STORIES)
    expect(result).toBeNull()
    expect(chatJson).not.toHaveBeenCalled()
  })

  it('returns null when chatJson returns null', async () => {
    chatJson.mockResolvedValue(null)
    const result = await generateNewsDigest(MOCK_STORIES)
    expect(result).toBeNull()
  })

  it('returns null when no stories provided', async () => {
    const result = await generateNewsDigest([])
    expect(result).toBeNull()
    expect(chatJson).not.toHaveBeenCalled()
  })
})
