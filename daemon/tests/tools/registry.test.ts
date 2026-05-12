import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildRegistry, ToolRegistry } from '../../src/tools/registry.js'

describe('tools registry', () => {
  let root: string
  let registry: ToolRegistry

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'reg-'))
    registry = buildRegistry({
      allowedRoots: [root],
      commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'),
    })
  })
  afterEach(async () => {
    await registry.shutdown()
    rmSync(root, { recursive: true, force: true })
  })

  it('lists all 15 tool definitions', () => {
    const defs = registry.list()
    expect(defs).toHaveLength(15)
    expect(defs.find((d) => d.id === 'file.read')?.risk).toBe('read')
    expect(defs.find((d) => d.id === 'file.delete')?.risk).toBe('publish')
    expect(defs.find((d) => d.id === 'system.exec_inline')?.risk).toBe('publish')
  })

  it('runs file.write through the registry', async () => {
    const file = join(root, 'r.txt')
    const result = await registry.run('file.write', { path: file, content: 'hi' }, {
      jobId: 't1', emit: () => {}, signal: new AbortController().signal,
    })
    expect((result as any).bytesWritten).toBe(2)
  })

  it('rejects unknown toolId', async () => {
    await expect(registry.run('nope.tool', {}, {
      jobId: 't', emit: () => {}, signal: new AbortController().signal,
    })).rejects.toThrow(/unknown tool/i)
  })

  it('rejects invalid params', async () => {
    await expect(registry.run('file.read', { wrong: 'shape' }, {
      jobId: 't', emit: () => {}, signal: new AbortController().signal,
    })).rejects.toThrow(/validation/i)
  })
})
