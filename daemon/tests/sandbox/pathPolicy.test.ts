import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { isPathAllowed } from '../../src/sandbox/pathPolicy.js'

describe('pathPolicy.isPathAllowed', () => {
  let root: string
  let allowed: string
  let outside: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pp-'))
    allowed = join(root, 'workspace')
    outside = join(root, 'outside')
    mkdirSync(allowed)
    mkdirSync(outside)
  })
  afterEach(() => { rmSync(root, { recursive: true, force: true }) })

  it('allows a file inside an allowed root', () => {
    const file = join(allowed, 'a.txt')
    writeFileSync(file, 'x')
    expect(isPathAllowed(file, [allowed]).ok).toBe(true)
  })

  it('rejects a file outside allowed roots', () => {
    const file = join(outside, 'b.txt')
    writeFileSync(file, 'x')
    const r = isPathAllowed(file, [allowed])
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/not within allowed roots/i)
  })

  it('rejects path traversal via ..', () => {
    const traversal = join(allowed, '..', 'outside', 'b.txt')
    writeFileSync(join(outside, 'b.txt'), 'x')
    const r = isPathAllowed(traversal, [allowed])
    expect(r.ok).toBe(false)
  })

  it('rejects symlink escaping the allowed root', () => {
    const linkPath = join(allowed, 'link')
    try { symlinkSync(outside, linkPath, 'dir') } catch { return /* skip on Windows w/o admin */ }
    const r = isPathAllowed(join(linkPath, 'b.txt'), [allowed])
    expect(r.ok).toBe(false)
  })

  it('rejects denylisted paths even if inside allowed root', () => {
    const dotssh = join(allowed, '.ssh', 'id_rsa')
    mkdirSync(join(allowed, '.ssh'))
    writeFileSync(dotssh, 'x')
    const r = isPathAllowed(dotssh, [allowed])
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/denylist/i)
  })
})
