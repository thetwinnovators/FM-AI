import { beforeEach, describe, expect, it } from 'vitest'
import {
  OFFLOAD_THRESHOLD_CHARS,
  shouldOffload,
  storeContextFile,
  retrieveContextFile,
  deleteContextFile,
  listContextFiles,
  maybeOffload,
  formatReference,
} from '../fileBackedContextService.js'

// ---------------------------------------------------------------------------
// localStorage is provided by jsdom (configured in vitest.setup.js)
// Clear it before each test to keep tests isolated.
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// shouldOffload
// ---------------------------------------------------------------------------

describe('shouldOffload', () => {
  it('returns false for content below the threshold', () => {
    const short = 'x'.repeat(OFFLOAD_THRESHOLD_CHARS - 1)
    expect(shouldOffload(short)).toBe(false)
  })

  it('returns false for content at exactly the threshold (not strictly greater)', () => {
    const exact = 'x'.repeat(OFFLOAD_THRESHOLD_CHARS)
    expect(shouldOffload(exact)).toBe(false)
  })

  it('returns true for content above the threshold', () => {
    const long = 'x'.repeat(OFFLOAD_THRESHOLD_CHARS + 1)
    expect(shouldOffload(long)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// storeContextFile
// ---------------------------------------------------------------------------

describe('storeContextFile', () => {
  it('returns a reference with the correct shape', () => {
    const content = 'hello world'
    const ref = storeContextFile(content, {
      title: 'Test File',
      contentType: 'text/plain',
      reasonIncluded: 'test reason',
    })

    expect(ref.title).toBe('Test File')
    expect(ref.contentType).toBe('text/plain')
    expect(ref.charCount).toBe(content.length)
    expect(ref.reasonIncluded).toBe('test reason')
    expect(ref.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('generates a fileId with ctxfile_ prefix', () => {
    const ref = storeContextFile('some content', {
      title: 'T',
      reasonIncluded: 'r',
    })
    expect(ref.fileId).toMatch(/^ctxfile_/)
  })

  it('defaults contentType to text/plain when not provided', () => {
    const ref = storeContextFile('data', {
      title: 'No type',
      reasonIncluded: 'omitted contentType',
    })
    expect(ref.contentType).toBe('text/plain')
  })

  it('makes content retrievable via retrieveContextFile', () => {
    const content = 'stored body'
    const ref = storeContextFile(content, { title: 'T', reasonIncluded: 'r' })
    expect(retrieveContextFile(ref.fileId)).toBe(content)
  })

  it('appears in listContextFiles after storing', () => {
    const ref = storeContextFile('content', { title: 'Listed', reasonIncluded: 'check' })
    const list = listContextFiles()
    expect(list.some((r) => r.fileId === ref.fileId)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// retrieveContextFile
// ---------------------------------------------------------------------------

describe('retrieveContextFile', () => {
  it('returns stored content for a known fileId', () => {
    const content = 'retrievable content'
    const ref = storeContextFile(content, { title: 'T', reasonIncluded: 'r' })
    expect(retrieveContextFile(ref.fileId)).toBe(content)
  })

  it('returns null for an unknown fileId', () => {
    expect(retrieveContextFile('ctxfile_unknown_xyz')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// deleteContextFile
// ---------------------------------------------------------------------------

describe('deleteContextFile', () => {
  it('makes content no longer retrievable after delete', () => {
    const ref = storeContextFile('deletable', { title: 'Del', reasonIncluded: 'r' })
    deleteContextFile(ref.fileId)
    expect(retrieveContextFile(ref.fileId)).toBeNull()
  })

  it('removes the reference from listContextFiles', () => {
    const ref = storeContextFile('deletable', { title: 'Del', reasonIncluded: 'r' })
    deleteContextFile(ref.fileId)
    const list = listContextFiles()
    expect(list.some((r) => r.fileId === ref.fileId)).toBe(false)
  })

  it('is a no-op for an unknown fileId (does not throw)', () => {
    expect(() => deleteContextFile('ctxfile_nonexistent_abc')).not.toThrow()
  })

  it('does not remove other files when deleting one', () => {
    const ref1 = storeContextFile('first', { title: 'F1', reasonIncluded: 'r' })
    const ref2 = storeContextFile('second', { title: 'F2', reasonIncluded: 'r' })
    deleteContextFile(ref1.fileId)
    const list = listContextFiles()
    expect(list.some((r) => r.fileId === ref2.fileId)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// listContextFiles
// ---------------------------------------------------------------------------

describe('listContextFiles', () => {
  it('returns an empty array on fresh storage', () => {
    expect(listContextFiles()).toEqual([])
  })

  it('returns all stored refs', () => {
    const ref1 = storeContextFile('a', { title: 'A', reasonIncluded: 'r1' })
    const ref2 = storeContextFile('b', { title: 'B', reasonIncluded: 'r2' })
    const list = listContextFiles()
    expect(list).toHaveLength(2)
    expect(list.map((r) => r.fileId)).toContain(ref1.fileId)
    expect(list.map((r) => r.fileId)).toContain(ref2.fileId)
  })

  it('survives multiple stores without losing earlier refs', () => {
    const refs = Array.from({ length: 5 }, (_, i) =>
      storeContextFile(`content-${i}`, { title: `T${i}`, reasonIncluded: `r${i}` })
    )
    const list = listContextFiles()
    expect(list).toHaveLength(5)
    for (const ref of refs) {
      expect(list.some((r) => r.fileId === ref.fileId)).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// maybeOffload
// ---------------------------------------------------------------------------

describe('maybeOffload', () => {
  it('returns null when content is below the threshold', () => {
    const short = 'x'.repeat(OFFLOAD_THRESHOLD_CHARS - 1)
    expect(maybeOffload(short, { title: 'T', reasonIncluded: 'r' })).toBeNull()
  })

  it('returns null when content is exactly at the threshold', () => {
    const exact = 'x'.repeat(OFFLOAD_THRESHOLD_CHARS)
    expect(maybeOffload(exact, { title: 'T', reasonIncluded: 'r' })).toBeNull()
  })

  it('returns a ContextFileReference and stores content when above threshold', () => {
    const long = 'x'.repeat(OFFLOAD_THRESHOLD_CHARS + 1)
    const ref = maybeOffload(long, { title: 'Long', reasonIncluded: 'big content' })
    expect(ref).not.toBeNull()
    expect(ref!.fileId).toMatch(/^ctxfile_/)
    expect(retrieveContextFile(ref!.fileId)).toBe(long)
  })

  it('adds the reference to the index when offloading', () => {
    const long = 'y'.repeat(OFFLOAD_THRESHOLD_CHARS + 100)
    const ref = maybeOffload(long, { title: 'Indexed', reasonIncluded: 'index test' })
    const list = listContextFiles()
    expect(list.some((r) => r.fileId === ref!.fileId)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// formatReference
// ---------------------------------------------------------------------------

describe('formatReference', () => {
  it('formats the reference as the expected string', () => {
    const ref = storeContextFile('some content', {
      title: 'My Page',
      reasonIncluded: 'webpage extract for task xyz',
    })
    const formatted = formatReference(ref)
    expect(formatted).toBe(
      `[file:${ref.fileId}] ${ref.title} (${ref.charCount} chars) — ${ref.reasonIncluded}`
    )
  })

  it('includes the fileId, title, charCount, and reason', () => {
    const ref = storeContextFile('abc', {
      title: 'Sample',
      reasonIncluded: 'test citation',
    })
    const formatted = formatReference(ref)
    expect(formatted).toContain(`[file:${ref.fileId}]`)
    expect(formatted).toContain('Sample')
    expect(formatted).toContain(`(${ref.charCount} chars)`)
    expect(formatted).toContain('test citation')
  })
})
