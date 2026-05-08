import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/llm/ollama.js', () => ({ chatJson: vi.fn() }))
import { chatJson } from '../../lib/llm/ollama.js'

import { validateStructure, validateCode, buildIframeSrc } from '../validatorEngine.js'

const htmlExercise = {
  id: 'ex1',
  prompt: 'Create an h1 heading',
  successCriteria: ['has h1 element', 'has p element'],
  validatorType: 'structure',
  hints: [],
}

describe('validateStructure', () => {
  it('passes when all required elements exist', () => {
    const code = '<h1>Hello</h1><p>World</p>'
    const result = validateStructure(code, htmlExercise)
    expect(result.passed).toBe(true)
  })

  it('fails when required element is missing', () => {
    const code = '<h1>Hello</h1>'
    const result = validateStructure(code, htmlExercise)
    expect(result.passed).toBe(false)
    expect(result.reason).toContain('No <p>')
  })

  it('detects class selectors', () => {
    const ex = { successCriteria: ['has class container'], hints: [] }
    expect(validateStructure('<div class="container"></div>', ex).passed).toBe(true)
    expect(validateStructure('<div></div>', ex).passed).toBe(false)
  })

  it('returns passed:false and reason on parse error with empty code', () => {
    const result = validateStructure('', { successCriteria: ['has h1 element'], hints: [] })
    // DOMParser still returns a document for empty string — h1 won't be there
    expect(result.passed).toBe(false)
  })
})

describe('validateCode routing', () => {
  beforeEach(() => chatJson.mockReset())

  it('calls LLM for python language', async () => {
    chatJson.mockResolvedValueOnce({ pass: true, reason: 'Great!' })
    const ex = { prompt: 'print hello', successCriteria: ['prints hello'], validatorType: 'llm', hints: [] }
    const result = await validateCode('print("hello")', ex, 'python')
    expect(chatJson).toHaveBeenCalledTimes(1)
    expect(result.passed).toBe(true)
  })

  it('uses structure for html without calling LLM when it passes', async () => {
    const ex = { ...htmlExercise }
    const result = await validateCode('<h1>Hi</h1><p>text</p>', ex, 'html')
    expect(chatJson).not.toHaveBeenCalled()
    expect(result.passed).toBe(true)
  })
})

describe('buildIframeSrc', () => {
  it('wraps CSS in a full HTML page', () => {
    const src = buildIframeSrc('body { color: red; }', 'css')
    expect(src).toContain('<!DOCTYPE html>')
    expect(src).toContain('body { color: red; }')
    expect(src).toContain('<body>')
  })

  it('wraps bare HTML in a skeleton', () => {
    const src = buildIframeSrc('<h1>Hello</h1>', 'html')
    expect(src).toContain('<!DOCTYPE html>')
    expect(src).toContain('<h1>Hello</h1>')
  })

  it('returns full HTML as-is when it has an html tag', () => {
    const fullHtml = '<!DOCTYPE html><html><body><p>hi</p></body></html>'
    expect(buildIframeSrc(fullHtml, 'html')).toBe(fullHtml)
  })
})
