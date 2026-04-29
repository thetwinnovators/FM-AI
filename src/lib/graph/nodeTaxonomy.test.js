import { describe, it, expect } from 'vitest'
import { NODE_TYPES, getTypeMeta, RGB } from './nodeTaxonomy.js'

describe('nodeTaxonomy', () => {
  it('defines 13 node types', () => {
    expect(NODE_TYPES.length).toBe(13)
  })
  it('each type has id, label, color', () => {
    for (const t of NODE_TYPES) {
      expect(t.id).toBeTruthy()
      expect(t.label).toBeTruthy()
      expect(t.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
  it('getTypeMeta resolves a known type', () => {
    expect(getTypeMeta('topic').label).toBe('Topic')
  })
  it('returns a fallback for unknown', () => {
    expect(getTypeMeta('zzz').color).toBe('#94a3b8')
  })
  it('RGB has 13 entries', () => {
    expect(Object.keys(RGB).length).toBe(13)
    expect(RGB.topic).toHaveLength(3)
    expect(RGB.topic.every((n) => typeof n === 'number')).toBe(true)
  })
  it('document type exists with amber color', () => {
    const doc = getTypeMeta('document')
    expect(doc.label).toBe('Document')
    expect(doc.color).toBe('#f59e0b')
  })
})
