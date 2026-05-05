import { describe, it, expect } from 'vitest'

// retrieve.js has no imports — it is a self-contained module.
// No mocks needed for these pure function tests.
import { buildIdentityBlock, buildTaskState, classifyIntent } from '../retrieve.js'

// ─── buildIdentityBlock ───────────────────────────────────────────────────────

describe('buildIdentityBlock', () => {
  it('returns "" for empty/null/undefined input', () => {
    expect(buildIdentityBlock([])).toBe('')
    expect(buildIdentityBlock(null)).toBe('')
    expect(buildIdentityBlock(undefined)).toBe('')
  })

  it('returns "" when no entries are pinned', () => {
    const entries = [
      { id: 'm1', content: 'focus on AI', status: 'active', isIdentityPinned: false },
    ]
    expect(buildIdentityBlock(entries)).toBe('')
  })

  it('builds a [IDENTITY] block from a single pinned active entry', () => {
    const entries = [
      { id: 'm1', content: 'Call me Uche', status: 'active', isIdentityPinned: true },
    ]
    expect(buildIdentityBlock(entries)).toBe('[IDENTITY]\n- Call me Uche\n\n')
  })

  it('excludes dismissed entries even if pinned', () => {
    const entries = [
      { id: 'm1', content: 'Be direct', status: 'dismissed', isIdentityPinned: true },
      { id: 'm2', content: 'No emoji', status: 'active', isIdentityPinned: true },
    ]
    const result = buildIdentityBlock(entries)
    expect(result).toContain('No emoji')
    expect(result).not.toContain('Be direct')
  })

  it('truncates each entry content to 100 chars', () => {
    const long = 'a'.repeat(150)
    const entries = [{ id: 'm1', content: long, status: 'active', isIdentityPinned: true }]
    const result = buildIdentityBlock(entries)
    expect(result).toContain('- ' + 'a'.repeat(100))
    expect(result).not.toContain('a'.repeat(101))
  })

  it('caps at 8 pinned entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({
      id: `m${i}`,
      content: `Rule ${i}`,
      status: 'active',
      isIdentityPinned: true,
      addedAt: `2026-01-${String(i + 1).padStart(2, '0')}`,
    }))
    const result = buildIdentityBlock(entries)
    const lines = result.trim().split('\n')
    // [IDENTITY] header + 8 bullet lines = 9 lines total
    expect(lines).toHaveLength(9)
  })

  it('sorts pinned entries by addedAt descending (most recent first)', () => {
    const entries = [
      { id: 'm1', content: 'Older rule', status: 'active', isIdentityPinned: true, addedAt: '2026-01-01' },
      { id: 'm2', content: 'Newer rule', status: 'active', isIdentityPinned: true, addedAt: '2026-02-01' },
    ]
    const result = buildIdentityBlock(entries)
    expect(result.indexOf('Newer rule')).toBeLessThan(result.indexOf('Older rule'))
  })
})

// ─── buildTaskState ───────────────────────────────────────────────────────────

describe('buildTaskState', () => {
  it('returns "" for empty/null/undefined messages', () => {
    expect(buildTaskState([], 'hi')).toBe('')
    expect(buildTaskState(null, 'hi')).toBe('')
    expect(buildTaskState(undefined, 'hi')).toBe('')
  })

  it('returns "" when no assistant message exists', () => {
    const msgs = [{ role: 'user', content: 'hello' }]
    expect(buildTaskState(msgs, 'hi')).toBe('')
  })

  it('derives task state from the last assistant message', () => {
    const msgs = [
      { role: 'user', content: 'explain AI agents' },
      { role: 'assistant', content: 'AI agents are autonomous programs that can use tools.' },
    ]
    const result = buildTaskState(msgs, 'tell me more')
    expect(result).toContain('Task state: continuing from "AI agents are autonomous programs')
    expect(result).toMatch(/\n\n$/)
  })

  it('uses the LAST assistant message when there are multiple', () => {
    const msgs = [
      { role: 'assistant', content: 'First response' },
      { role: 'user', content: 'ok' },
      { role: 'assistant', content: 'Second response' },
    ]
    const result = buildTaskState(msgs, 'continue')
    expect(result).toContain('Second response')
    expect(result).not.toContain('First response')
  })

  it('truncates summary to 100 chars', () => {
    const msgs = [{ role: 'assistant', content: 'x'.repeat(200) }]
    const result = buildTaskState(msgs, 'next')
    const match = result.match(/"([^"]+)"/)
    expect(match).not.toBeNull()
    expect(match[1].length).toBeLessThanOrEqual(100)
  })

  it('collapses whitespace in the assistant content', () => {
    const msgs = [
      { role: 'assistant', content: 'Here is\na multi\n\nline response.' },
    ]
    const result = buildTaskState(msgs, 'continue')
    expect(result).toContain('Here is a multi')
    expect(result.match(/"([^"]+)"/)[1]).not.toContain('\n')
  })
})

// ─── classifyIntent — tool_use ────────────────────────────────────────────────
describe('classifyIntent — tool_use', () => {
  it('detects send + telegram as tool_use', () => {
    expect(classifyIntent('send a message to @channel on telegram saying hi')).toBe('tool_use')
  })

  it('detects post + figma as tool_use', () => {
    expect(classifyIntent('post this design note to figma')).toBe('tool_use')
  })

  it('detects create + google docs as tool_use', () => {
    expect(classifyIntent('create a google docs document from my summary')).toBe('tool_use')
  })

  it('detects "use [tool]" phrase as tool_use', () => {
    expect(classifyIntent('use telegram to notify the team')).toBe('tool_use')
  })

  it('detects "via gmail" phrase as tool_use', () => {
    expect(classifyIntent('draft a report and send it via gmail')).toBe('tool_use')
  })

  it('detects schedule + calendar as tool_use', () => {
    expect(classifyIntent('schedule a reminder on google calendar for tomorrow')).toBe('tool_use')
  })

  it('detects fetch + drive as tool_use', () => {
    expect(classifyIntent('fetch the latest file from google drive')).toBe('tool_use')
  })

  it('does NOT classify casual greeting as tool_use', () => {
    expect(classifyIntent('hi')).toBe('casual_chat')
    expect(classifyIntent('hey')).toBe('casual_chat')
  })

  it('does NOT classify a plain knowledge question as tool_use', () => {
    expect(classifyIntent('what is n8n?')).not.toBe('tool_use')
  })

  it('does NOT classify a telegram-mentioning knowledge question as tool_use', () => {
    // mentions telegram but no imperative action verb
    expect(classifyIntent('what is telegram used for?')).not.toBe('tool_use')
  })
})
