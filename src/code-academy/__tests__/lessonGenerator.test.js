import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../lib/llm/ollama.js', () => ({ chatJson: vi.fn() }))

import { chatJson } from '../../lib/llm/ollama.js'
import { generateCodeLesson } from '../lessonGenerator.js'

const MOCK_STRUCTURE = {
  title: 'What is a Variable',
  summary: 'You will create your first Python variable.',
  difficulty: 'beginner',
  objectives: ['You will learn to create a variable'],
  prerequisites: [],
  terminology: [{ term: 'variable', plainMeaning: 'A box for a value', example: 'x = 5', whyItMatters: 'Stores info' }],
  workedExample: { code: 'name = "Alice"\nprint(name)', explanationSteps: ['Line 1: store Alice', 'Line 2: print it'], expectedOutput: 'Alice' },
  commonMistakes: ['Forgetting quotes around text'],
}

const MOCK_EXERCISES = {
  exercises: [
    { id: 'ex1', prompt: 'Create a variable', starterCode: '', successCriteria: ['has variable'], validatorType: 'llm', hints: ['use ='] },
    { id: 'ex2', prompt: 'Print a variable',  starterCode: '', successCriteria: ['uses print'],   validatorType: 'llm', hints: ['use print()'] },
    { id: 'ex3', prompt: 'Two variables',     starterCode: '', successCriteria: ['two vars'],     validatorType: 'llm', hints: ['name = ...'] },
  ],
}

beforeEach(() => { chatJson.mockReset() })

describe('generateCodeLesson', () => {
  it('returns null when language is empty', async () => {
    expect(await generateCodeLesson('', 'Variables')).toBeNull()
  })

  it('returns null when concept is empty', async () => {
    expect(await generateCodeLesson('python', '')).toBeNull()
  })

  it('shapes lesson correctly from valid Ollama response', async () => {
    chatJson.mockResolvedValueOnce(MOCK_STRUCTURE).mockResolvedValueOnce(MOCK_EXERCISES)
    const lesson = await generateCodeLesson('python', 'Variables')
    expect(lesson).not.toBeNull()
    expect(lesson.id).toBe('python_variables')
    expect(lesson.language).toBe('python')
    expect(lesson.title).toBe('What is a Variable')
    expect(lesson.workedExample.language).toBe('python')
    expect(lesson.exercises).toHaveLength(3)
    expect(lesson.terminology[0].term).toBe('variable')
  })

  it('returns null when Ollama returns null for structure', async () => {
    chatJson.mockResolvedValueOnce(null)
    expect(await generateCodeLesson('python', 'Variables')).toBeNull()
  })

  it('returns null when structure response is missing title', async () => {
    chatJson.mockResolvedValueOnce({ ...MOCK_STRUCTURE, title: '' })
    expect(await generateCodeLesson('python', 'Variables')).toBeNull()
  })

  it('returns null when structure response is missing workedExample.code', async () => {
    chatJson.mockResolvedValueOnce({ ...MOCK_STRUCTURE, workedExample: {} })
    expect(await generateCodeLesson('python', 'Variables')).toBeNull()
  })

  it('returns null when exercises array is empty', async () => {
    chatJson.mockResolvedValueOnce(MOCK_STRUCTURE).mockResolvedValueOnce({ exercises: [] })
    expect(await generateCodeLesson('python', 'Variables')).toBeNull()
  })

  it('generates a stable lessonKey from concept name', async () => {
    chatJson.mockResolvedValueOnce(MOCK_STRUCTURE).mockResolvedValueOnce(MOCK_EXERCISES)
    const lesson = await generateCodeLesson('html', 'Headings and paragraphs')
    expect(lesson.id).toBe('html_headings_and_paragraphs')
  })
})
