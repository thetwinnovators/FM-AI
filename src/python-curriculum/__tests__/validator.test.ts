import { describe, it, expect } from 'vitest'
import { simulateOutput, normalise, validate } from '../validator'

describe('simulateOutput', () => {
  it('extracts a double-quoted string', () => {
    expect(simulateOutput('print("Hello, World!")')).toBe('Hello, World!')
  })
  it('extracts a single-quoted string', () => {
    expect(simulateOutput("print('Hi there')")).toBe('Hi there')
  })
  it('evaluates integer addition', () => {
    expect(simulateOutput('print(5 + 2)')).toBe('7')
  })
  it('evaluates integer subtraction', () => {
    expect(simulateOutput('print(10 - 3)')).toBe('7')
  })
  it('evaluates integer multiplication', () => {
    expect(simulateOutput('print(3 * 4)')).toBe('12')
  })
  it('joins multiple print calls with newline', () => {
    expect(simulateOutput('print("a")\nprint("b")')).toBe('a\nb')
  })
  it('returns null when no print found', () => {
    expect(simulateOutput('x = 5')).toBeNull()
  })
  it('does not match print(variable)', () => {
    expect(simulateOutput('x = 5\nprint(x)')).toBeNull()
  })
})

describe('normalise', () => {
  it('trims leading/trailing whitespace', () => {
    expect(normalise('  hello  ')).toBe('hello')
  })
  it('preserves internal whitespace', () => {
    expect(normalise('hello world')).toBe('hello world')
  })
  it('preserves case', () => {
    expect(normalise('Hello')).toBe('Hello')
  })
})

describe('validate — code_run', () => {
  const challenge = { type: 'code_run' as const, expectedOutput: 'Hello, World!' }

  it('passes when output matches', () => {
    const r = validate('print("Hello, World!")', challenge)
    expect(r.passed).toBe(true)
  })
  it('fails when output differs', () => {
    const r = validate('print("hello, world!")', challenge)
    expect(r.passed).toBe(false)
    expect(r.userOutput).toBe('hello, world!')
  })
  it('fails when no print found', () => {
    const r = validate('x = 5', challenge)
    expect(r.passed).toBe(false)
    expect(r.userOutput).toBeNull()
  })
})

describe('validate — multiple_choice', () => {
  const challenge = { type: 'multiple_choice' as const, options: ['a', 'b', 'c'], correctOption: 1 }
  it('passes when correct index selected', () => {
    expect(validate('', challenge, 1).passed).toBe(true)
  })
  it('fails when wrong index', () => {
    expect(validate('', challenge, 0).passed).toBe(false)
  })
})

describe('validate — fill_blank', () => {
  const challenge = { type: 'fill_blank' as const, blankAnswer: 'print' }
  it('passes on exact normalised match', () => {
    expect(validate('', challenge, '  print  ').passed).toBe(true)
  })
  it('fails on wrong answer', () => {
    expect(validate('', challenge, 'input').passed).toBe(false)
  })
})

describe('validate — read_only', () => {
  it('always passes', () => {
    expect(validate('', { type: 'read_only' as const }).passed).toBe(true)
  })
})
