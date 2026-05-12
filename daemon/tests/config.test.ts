import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadOrCreateConfig } from '../src/config.js'

describe('config', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fmcfg-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('creates daemon.json on first call with port 0 and 64-char token', () => {
    const cfg = loadOrCreateConfig(dir)
    expect(cfg.port).toBe(0)
    expect(cfg.token).toMatch(/^[a-f0-9]{64}$/)
    const onDisk = JSON.parse(readFileSync(join(dir, 'daemon.json'), 'utf8'))
    expect(onDisk.token).toBe(cfg.token)
  })

  it('returns existing config without regenerating token', () => {
    const a = loadOrCreateConfig(dir)
    const b = loadOrCreateConfig(dir)
    expect(b.token).toBe(a.token)
  })
})
