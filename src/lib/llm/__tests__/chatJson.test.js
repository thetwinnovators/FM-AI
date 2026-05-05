import { beforeEach, describe, expect, it, vi } from 'vitest'

// chatJson is not exported yet — this test must fail first
import { chatJson } from '../ollama.js'
import { setOllamaEnabled } from '../ollamaConfig.js'

function mockFetch(responseBody, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(responseBody),
  })
}

beforeEach(() => {
  vi.unstubAllGlobals()
  setOllamaEnabled(true)
})

describe('chatJson', () => {
  it('returns null when OLLAMA_CONFIG.enabled is false', async () => {
    setOllamaEnabled(false)
    const result = await chatJson([{ role: 'user', content: 'hi' }])
    expect(result).toBeNull()
  })

  it('returns null for empty messages array', async () => {
    const result = await chatJson([])
    expect(result).toBeNull()
  })

  it('calls /api/ollama/api/chat with format: json and stream: false', async () => {
    const fetch = mockFetch({
      message: { role: 'assistant', content: '{"action":"answer","thought":"ok","answer":"done"}' },
      done: true,
    })
    vi.stubGlobal('fetch', fetch)

    await chatJson([{ role: 'system', content: 'be a json bot' }, { role: 'user', content: 'go' }])

    expect(fetch).toHaveBeenCalledOnce()
    const [, init] = fetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.format).toBe('json')
    expect(body.stream).toBe(false)
    expect(body.messages).toHaveLength(2)
  })

  it('returns parsed JSON from message.content', async () => {
    const payload = { action: 'answer', thought: 'I know this', answer: 'The result is 42' }
    const fetch = mockFetch({
      message: { role: 'assistant', content: JSON.stringify(payload) },
      done: true,
    })
    vi.stubGlobal('fetch', fetch)

    const result = await chatJson([{ role: 'user', content: 'what is the answer' }])
    expect(result).toEqual(payload)
  })

  it('returns null when message.content is not valid JSON', async () => {
    const fetch = mockFetch({
      message: { role: 'assistant', content: 'this is not json' },
      done: true,
    })
    vi.stubGlobal('fetch', fetch)

    const result = await chatJson([{ role: 'user', content: 'go' }])
    expect(result).toBeNull()
  })

  it('returns null on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetch({}, false))
    const result = await chatJson([{ role: 'user', content: 'go' }])
    expect(result).toBeNull()
  })
})
