import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the LLM module before importing the module under test
vi.mock('../../../lib/llm/ollama.js', () => ({
  chatJson: vi.fn(),
  OLLAMA_CONFIG: { enabled: true },
}))

import { chatJson, OLLAMA_CONFIG } from '../../../lib/llm/ollama.js'
import { generateTopicBrief } from '../generateTopicBrief.js'

const MOCK_LLM_RESPONSE = {
  overview: 'Agentic AI is advancing rapidly.',
  what_changed: [
    { dot: 'rising', text: 'LangGraph adoption accelerating.' },
  ],
  strongest_signals: [
    { strength: 'Strong', source: 'HN', text: 'Tool-use reliability is the key bottleneck.' },
  ],
  open_questions: ['Does scale improve tool-call reliability?'],
  risks: 'Hype risk: enterprise adoption may be outpacing production deployment.',
}

const ITEMS = [
  { id: 'c1', title: 'LangGraph post', body: 'LangGraph is great', url: 'https://a.com', savedAt: 1000 },
  { id: 'c2', title: 'Agent evals', body: 'Evaluating agents', url: 'https://b.com', savedAt: 2000 },
]

beforeEach(() => {
  vi.clearAllMocks()
  OLLAMA_CONFIG.enabled = true
})

describe('generateTopicBrief', () => {
  it('calls chatJson and returns a Brief-shaped object', async () => {
    chatJson.mockResolvedValue(MOCK_LLM_RESPONSE)

    const result = await generateTopicBrief('Agentic AI', 't1', ITEMS)

    expect(chatJson).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      type: 'topic',
      topicId: 't1',
      title: 'Agentic AI',
      newItemCount: 2,
      sections: expect.any(Array),
    })
    expect(result.id).toBeTruthy()
    expect(result.generatedAt).toBeGreaterThan(0)
    expect(result.readAt).toBeNull()
  })

  it('maps LLM sections into BriefSection objects', async () => {
    chatJson.mockResolvedValue(MOCK_LLM_RESPONSE)
    const result = await generateTopicBrief('Agentic AI', 't1', ITEMS)

    const types = result.sections.map((s) => s.type)
    expect(types).toContain('overview')
    expect(types).toContain('what_changed')
    expect(types).toContain('strongest_signals')
    expect(types).toContain('open_questions')
    expect(types).toContain('risks')
  })

  it('returns null when LLM is disabled', async () => {
    OLLAMA_CONFIG.enabled = false
    const result = await generateTopicBrief('Agentic AI', 't1', ITEMS)
    expect(result).toBeNull()
    expect(chatJson).not.toHaveBeenCalled()
  })

  it('returns null when chatJson returns null', async () => {
    chatJson.mockResolvedValue(null)
    const result = await generateTopicBrief('Agentic AI', 't1', ITEMS)
    expect(result).toBeNull()
  })
})
