import { describe, it, expect } from 'vitest'
import { buildNoteCandidates } from '../retrievalService.js'

const BASE_INPUT = {
  query: 'test',
  documents: {},
  documentContents: {},
  memoryEntries: {},
  saves: {},
  views: {},
  userTopics: {},
}

describe('buildNoteCandidates', () => {
  it('returns [] when userNotes is absent', () => {
    expect(buildNoteCandidates(BASE_INPUT)).toEqual([])
  })

  it('returns [] when userNotes is an empty object', () => {
    expect(buildNoteCandidates({ ...BASE_INPUT, userNotes: {} })).toEqual([])
  })

  it('maps a single flat-object note to one SearchCandidate', () => {
    const result = buildNoteCandidates({
      ...BASE_INPUT,
      userNotes: { item_abc: { content: 'This is my note' } },
    })
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('note')
    expect(result[0].snippet).toBe('This is my note')
    expect(result[0].searchBody).toBe('This is my note')
    expect(result[0].sourceLabel).toBe('Note')
    expect(result[0].id).toBe('note_item_abc_flat')
  })

  it('maps an array of notes to one candidate per entry', () => {
    const result = buildNoteCandidates({
      ...BASE_INPUT,
      userNotes: { item_abc: [{ content: 'First' }, { content: 'Second' }] },
    })
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('note_item_abc_0')
    expect(result[1].id).toBe('note_item_abc_1')
  })

  it('skips entries with empty or whitespace-only content', () => {
    const result = buildNoteCandidates({
      ...BASE_INPUT,
      userNotes: {
        item_abc: [{ content: '' }, { content: '   ' }, { content: 'Valid note' }],
      },
    })
    expect(result).toHaveLength(1)
    expect(result[0].snippet).toBe('Valid note')
  })

  it('truncates snippet to 300 chars but preserves full searchBody', () => {
    const long = 'x'.repeat(400)
    const result = buildNoteCandidates({
      ...BASE_INPUT,
      userNotes: { item_abc: { content: long } },
    })
    expect(result[0].snippet).toHaveLength(300)
    expect(result[0].searchBody).toHaveLength(400)
  })

  it('handles mixed flat-object and array notes across different item keys', () => {
    const result = buildNoteCandidates({
      ...BASE_INPUT,
      userNotes: {
        item_flat: { content: 'flat note' },
        item_arr:  [{ content: 'array note 0' }, { content: 'array note 1' }],
      },
    })
    expect(result).toHaveLength(3)
    expect(result.find((r) => r.id === 'note_item_flat_flat')).toBeDefined()
    expect(result.find((r) => r.id === 'note_item_arr_0')).toBeDefined()
    expect(result.find((r) => r.id === 'note_item_arr_1')).toBeDefined()
  })

  it('handles null values in userNotes without throwing', () => {
    expect(() =>
      buildNoteCandidates({ ...BASE_INPUT, userNotes: { item_abc: null } })
    ).not.toThrow()
    expect(
      buildNoteCandidates({ ...BASE_INPUT, userNotes: { item_abc: null } })
    ).toEqual([])
  })
})
