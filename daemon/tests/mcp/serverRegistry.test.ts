import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadServerRegistry } from '../../src/mcp/serverRegistry.js'

let tmpDir: string
beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'mcp-reg-test-'))
})
afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe('loadServerRegistry', () => {
  it('returns empty array when file missing', async () => {
    const servers = await loadServerRegistry(join(tmpDir, 'nonexistent.json'))
    expect(servers).toEqual([])
  })

  it('parses valid server list', async () => {
    const cfg = [
      { id: 'context7', name: 'Context7', image: 'context7/mcp:latest', enabled: true },
      { id: 'filesystem', name: 'Filesystem', image: 'mcp/filesystem:latest', enabled: false },
    ]
    const file = join(tmpDir, 'servers.json')
    await writeFile(file, JSON.stringify(cfg))
    const servers = await loadServerRegistry(file)
    expect(servers).toHaveLength(2)
    expect(servers[0]!.id).toBe('context7')
    expect(servers[1]!.enabled).toBe(false)
  })

  it('filters out entries missing required fields', async () => {
    const cfg = [
      { id: 'ok', name: 'OK', image: 'foo:latest', enabled: true },
      { name: 'Missing ID', image: 'bar:latest', enabled: true },
      { id: 'no-image', name: 'No Image', enabled: true },
    ]
    const file = join(tmpDir, 'bad.json')
    await writeFile(file, JSON.stringify(cfg))
    const servers = await loadServerRegistry(file)
    expect(servers).toHaveLength(1)
    expect(servers[0]!.id).toBe('ok')
  })

  it('returns empty array on invalid JSON', async () => {
    const file = join(tmpDir, 'garbage.json')
    await writeFile(file, 'not json {{{')
    const servers = await loadServerRegistry(file)
    expect(servers).toEqual([])
  })

  it('returns empty array when root is not an array', async () => {
    const file = join(tmpDir, 'object.json')
    await writeFile(file, JSON.stringify({ servers: [] }))
    const servers = await loadServerRegistry(file)
    expect(servers).toEqual([])
  })
})
