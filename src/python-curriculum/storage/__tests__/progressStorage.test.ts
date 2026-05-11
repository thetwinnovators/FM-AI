import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadProgress,
  saveProgress,
  loadAllProgress,
  clearAllProgress,
} from '../progressStorage'

const mockStorage: Record<string, string> = {}
const localStorageMock = {
  getItem:    (k: string) => mockStorage[k] ?? null,
  setItem:    (k: string, v: string) => { mockStorage[k] = v },
  removeItem: (k: string) => { delete mockStorage[k] },
  key:        (i: number) => Object.keys(mockStorage)[i] ?? null,
  get length() { return Object.keys(mockStorage).length },
  clear:      () => { for (const k in mockStorage) delete mockStorage[k] },
}
vi.stubGlobal('localStorage', localStorageMock)

beforeEach(() => localStorageMock.clear())

describe('loadProgress', () => {
  it('returns defaults for unknown id', () => {
    const p = loadProgress('foo')
    expect(p).toEqual({
      subLessonId: 'foo',
      viewed:      false,
      practiced:   false,
      completed:   false,
      skipped:     false,
      lastOpenedAt: '',
    })
  })
  it('returns saved values', () => {
    saveProgress('bar', { viewed: true })
    expect(loadProgress('bar').viewed).toBe(true)
  })
})

describe('saveProgress', () => {
  it('merges partial into existing', () => {
    saveProgress('x', { viewed: true })
    saveProgress('x', { completed: true })
    const p = loadProgress('x')
    expect(p.viewed).toBe(true)
    expect(p.completed).toBe(true)
  })
  it('writes ISO timestamp', () => {
    saveProgress('ts', { viewed: true })
    expect(loadProgress('ts').lastOpenedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('loadAllProgress', () => {
  it('returns all fm_pyca_ entries', () => {
    saveProgress('a', { viewed: true })
    saveProgress('b', { completed: true })
    const all = loadAllProgress()
    expect(Object.keys(all)).toHaveLength(2)
    expect(all['a'].viewed).toBe(true)
  })
})

describe('clearAllProgress', () => {
  it('removes all fm_pyca_ keys', () => {
    saveProgress('a', { viewed: true })
    saveProgress('b', { viewed: true })
    clearAllProgress()
    expect(Object.keys(loadAllProgress())).toHaveLength(0)
  })
})
