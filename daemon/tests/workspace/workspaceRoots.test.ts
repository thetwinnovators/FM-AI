import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WorkspaceRoots } from '../../src/workspace/workspaceRoots.js'

describe('WorkspaceRoots', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ws-roots-'))
    file = join(dir, 'workspace-roots.json')
  })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('initialises with defaults when file missing', () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: ['/default/path'] })
    expect(store.list()).toEqual(['/default/path'])
  })

  it('loads from existing file', () => {
    writeFileSync(file, JSON.stringify(['/a', '/b']))
    const store = new WorkspaceRoots({ filePath: file, defaults: [] })
    expect(store.list()).toEqual(['/a', '/b'])
  })

  it('add() persists to disk', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: [] })
    await store.add('/new/path')
    expect(store.list()).toContain('/new/path')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toContain('/new/path')
  })

  it('add() rejects duplicates silently', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: ['/a'] })
    await store.add('/a')
    expect(store.list().filter((p) => p === '/a')).toHaveLength(1)
  })

  it('add() ignores empty strings', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: [] })
    await store.add('')
    await store.add('   ')
    expect(store.list()).toEqual([])
  })

  it('remove() persists to disk', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: ['/a', '/b'] })
    await store.remove('/a')
    expect(store.list()).toEqual(['/b'])
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(['/b'])
  })

  it('remove() is a no-op when path not in list', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: ['/a'] })
    await store.remove('/not-there')
    expect(store.list()).toEqual(['/a'])
  })

  it('listeners notified on add and remove', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: [] })
    let count = 0
    store.onChange(() => { count++ })
    await store.add('/x')
    await store.remove('/x')
    expect(count).toBe(2)
  })

  it('onChange returns an unsubscribe fn', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: [] })
    let count = 0
    const off = store.onChange(() => { count++ })
    await store.add('/x')
    off()
    await store.add('/y')
    expect(count).toBe(1)
  })

  it('survives malformed JSON by falling back to defaults', () => {
    writeFileSync(file, '{ not valid json')
    const store = new WorkspaceRoots({ filePath: file, defaults: ['/fallback'] })
    expect(store.list()).toEqual(['/fallback'])
  })
})
