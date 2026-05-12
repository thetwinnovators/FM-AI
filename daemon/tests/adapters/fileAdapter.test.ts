import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createFileAdapter } from '../../src/adapters/fileAdapter.js'

describe('fileAdapter', () => {
  let root: string
  let adapter: ReturnType<typeof createFileAdapter>

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fa-'))
    adapter = createFileAdapter({ getAllowedRoots: () => [root] })
  })
  afterEach(() => { rmSync(root, { recursive: true, force: true }) })

  it('reads a file', async () => {
    const f = join(root, 'a.txt')
    writeFileSync(f, 'hello')
    const r = await adapter.read({ path: f })
    expect(r.content).toBe('hello')
    expect(r.sizeBytes).toBe(5)
  })

  it('writes a file (overwrite)', async () => {
    const f = join(root, 'b.txt')
    const r = await adapter.write({ path: f, content: 'world' })
    expect(r.bytesWritten).toBe(5)
    expect(existsSync(f)).toBe(true)
  })

  it('appends to a file', async () => {
    const f = join(root, 'c.txt')
    writeFileSync(f, 'a')
    await adapter.write({ path: f, content: 'b', mode: 'append' })
    const r = await adapter.read({ path: f })
    expect(r.content).toBe('ab')
  })

  it('lists directory entries', async () => {
    writeFileSync(join(root, 'x.txt'), '1')
    mkdirSync(join(root, 'sub'))
    const r = await adapter.list({ path: root })
    const names = r.entries.map((e) => e.name).sort()
    expect(names).toEqual(['sub', 'x.txt'])
  })

  it('rejects paths outside allowed roots', async () => {
    await expect(adapter.read({ path: '/etc/passwd' })).rejects.toThrow(/sandbox/i)
  })

  it('exists() returns false for missing path', async () => {
    const r = await adapter.exists({ path: join(root, 'nope') })
    expect(r.exists).toBe(false)
  })

  it('delete removes a file', async () => {
    const f = join(root, 'del.txt')
    writeFileSync(f, 'x')
    const r = await adapter.delete({ path: f })
    expect(r.deletedCount).toBe(1)
    expect(existsSync(f)).toBe(false)
  })
})
