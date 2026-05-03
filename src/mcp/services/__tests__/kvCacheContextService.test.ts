import { describe, expect, it } from 'vitest'
import {
  buildStablePrompt,
  buildToolSection,
  serializeTranscript,
  appendTranscriptEntry,
  type PromptSection,
} from '../kvCacheContextService.js'
import type { TaskTranscriptEntry } from '../../types.js'

// ---------------------------------------------------------------------------
// buildStablePrompt
// ---------------------------------------------------------------------------

describe('buildStablePrompt', () => {
  it('places SYSTEM before TOOLS before RULES regardless of input order', () => {
    const sections: PromptSection[] = [
      { tag: '[RULES]',  body: 'rule body' },
      { tag: '[TOOLS]',  body: 'tools body' },
      { tag: '[SYSTEM]', body: 'system body' },
    ]
    const result = buildStablePrompt(sections)
    const sysIdx   = result.indexOf('[SYSTEM]')
    const toolsIdx = result.indexOf('[TOOLS]')
    const rulesIdx = result.indexOf('[RULES]')
    expect(sysIdx).toBeLessThan(toolsIdx)
    expect(toolsIdx).toBeLessThan(rulesIdx)
  })

  it('puts unknown tags after RULES, sorted alphabetically', () => {
    const sections: PromptSection[] = [
      { tag: '[ZEBRA]',  body: 'z' },
      { tag: '[ALPHA]',  body: 'a' },
      { tag: '[SYSTEM]', body: 's' },
    ]
    const result = buildStablePrompt(sections)
    const sysIdx   = result.indexOf('[SYSTEM]')
    const alphaIdx = result.indexOf('[ALPHA]')
    const zebraIdx = result.indexOf('[ZEBRA]')
    expect(sysIdx).toBeLessThan(alphaIdx)
    expect(alphaIdx).toBeLessThan(zebraIdx)
  })

  it('joins sections with \\n\\n', () => {
    const sections: PromptSection[] = [
      { tag: '[SYSTEM]', body: 'A' },
      { tag: '[TOOLS]',  body: 'B' },
    ]
    const result = buildStablePrompt(sections)
    expect(result).toBe('[SYSTEM]\nA\n\n[TOOLS]\nB')
  })

  it('formats each section as <tag>\\n<body>', () => {
    const sections: PromptSection[] = [
      { tag: '[RULES]', body: 'do not harm' },
    ]
    expect(buildStablePrompt(sections)).toBe('[RULES]\ndo not harm')
  })
})

// ---------------------------------------------------------------------------
// buildToolSection
// ---------------------------------------------------------------------------

describe('buildToolSection', () => {
  it('returns tag [TOOLS]', () => {
    expect(buildToolSection(['tool_b', 'tool_a']).tag).toBe('[TOOLS]')
  })

  it('sorts tool names ascending', () => {
    const { body } = buildToolSection(['zebra', 'apple', 'mango'])
    const lines = body.split('\n')
    expect(lines).toEqual(['- apple', '- mango', '- zebra'])
  })

  it('prefixes each name with "- "', () => {
    const { body } = buildToolSection(['read_file'])
    expect(body).toBe('- read_file')
  })

  it('handles an empty list', () => {
    const { body } = buildToolSection([])
    expect(body).toBe('')
  })
})

// ---------------------------------------------------------------------------
// serializeTranscript
// ---------------------------------------------------------------------------

describe('serializeTranscript', () => {
  it('returns empty string for empty array', () => {
    expect(serializeTranscript([])).toBe('')
  })

  it('formats a single success entry correctly', () => {
    const entry: TaskTranscriptEntry = {
      seq: 0,
      type: 'tool_call',
      toolName: 'read_file',
      content: 'reading package.json',
      status: 'success',
      timestamp: '2026-05-02T12:34:56.789Z',
    }
    const result = serializeTranscript([entry])
    expect(result).toContain('[TOOL_CALL #0]')
    expect(result).toContain('read_file')
    expect(result).toContain('(2026-05-02)')
    expect(result).toContain('reading package.json')
    expect(result).toContain('[status: success]')
    expect(result).not.toContain('[error:')
  })

  it('includes [error: ...] line for failed entries', () => {
    const entry: TaskTranscriptEntry = {
      seq: 1,
      type: 'tool_result',
      toolName: 'write_file',
      content: 'write failed',
      status: 'failed',
      errorReason: 'permission denied',
      timestamp: '2026-05-02T13:00:00.000Z',
    }
    const result = serializeTranscript([entry])
    expect(result).toContain('[status: failed]')
    expect(result).toContain('[error: permission denied]')
  })

  it('does not include [error: ...] when status is success', () => {
    const entry: TaskTranscriptEntry = {
      seq: 2,
      type: 'tool_result',
      content: 'ok',
      status: 'success',
      timestamp: '2026-05-02T14:00:00.000Z',
    }
    const result = serializeTranscript([entry])
    expect(result).not.toContain('[error:')
  })

  it('includes [retry of #N] when retryOf is set', () => {
    const entry: TaskTranscriptEntry = {
      seq: 3,
      type: 'tool_call',
      content: 'retrying',
      retryOf: 1,
      timestamp: '2026-05-02T15:00:00.000Z',
    }
    const result = serializeTranscript([entry])
    expect(result).toContain('[retry of #1]')
  })

  it('separates multiple entries with a blank line', () => {
    const entries: TaskTranscriptEntry[] = [
      {
        seq: 0,
        type: 'note',
        content: 'first',
        timestamp: '2026-05-02T10:00:00.000Z',
      },
      {
        seq: 1,
        type: 'note',
        content: 'second',
        timestamp: '2026-05-02T10:01:00.000Z',
      },
    ]
    const result = serializeTranscript(entries)
    // There should be a blank line (double newline) between the two entries
    expect(result).toContain('\n\n')
    // Both entries present
    expect(result).toContain('first')
    expect(result).toContain('second')
  })

  it('omits status line when status is not set', () => {
    const entry: TaskTranscriptEntry = {
      seq: 0,
      type: 'note',
      content: 'just a note',
      timestamp: '2026-05-02T10:00:00.000Z',
    }
    const result = serializeTranscript([entry])
    expect(result).not.toContain('[status:')
  })
})

// ---------------------------------------------------------------------------
// appendTranscriptEntry
// ---------------------------------------------------------------------------

describe('appendTranscriptEntry', () => {
  it('assigns seq 0 when appending to an empty transcript', () => {
    const result = appendTranscriptEntry([], {
      type: 'note',
      content: 'first entry',
    })
    expect(result).toHaveLength(1)
    expect(result[0].seq).toBe(0)
  })

  it('assigns seq = last seq + 1 for subsequent entries', () => {
    const base: TaskTranscriptEntry[] = [
      { seq: 5, type: 'note', content: 'earlier', timestamp: '2026-05-01T00:00:00.000Z' },
    ]
    const result = appendTranscriptEntry(base, {
      type: 'note',
      content: 'newer',
    })
    expect(result[1].seq).toBe(6)
  })

  it('sets timestamp to a valid ISO string', () => {
    const result = appendTranscriptEntry([], {
      type: 'note',
      content: 'test',
    })
    const ts = result[0].timestamp
    expect(() => new Date(ts).toISOString()).not.toThrow()
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('does not mutate the original array', () => {
    const original: TaskTranscriptEntry[] = [
      { seq: 0, type: 'note', content: 'existing', timestamp: '2026-05-01T00:00:00.000Z' },
    ]
    const lengthBefore = original.length
    appendTranscriptEntry(original, { type: 'note', content: 'new' })
    expect(original.length).toBe(lengthBefore)
  })

  it('preserves all existing entries in the returned array', () => {
    const existing: TaskTranscriptEntry = {
      seq: 0, type: 'note', content: 'first', timestamp: '2026-05-01T00:00:00.000Z',
    }
    const result = appendTranscriptEntry([existing], {
      type: 'note',
      content: 'second',
    })
    expect(result[0]).toEqual(existing)
    expect(result[1].content).toBe('second')
  })
})
