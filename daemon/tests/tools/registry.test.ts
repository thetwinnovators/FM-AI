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
      getAllowedRoots: () => [root],
      commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'),
    })
  })
  afterEach(async () => {
    await registry.shutdown()
    rmSync(root, { recursive: true, force: true })
  })

  it('lists all 21 tool definitions', () => {
    const defs = registry.list()
    expect(defs).toHaveLength(21)
    expect(defs.find((d) => d.id === 'file.read')?.risk).toBe('read')
    expect(defs.find((d) => d.id === 'file.delete')?.risk).toBe('publish')
    expect(defs.find((d) => d.id === 'system.exec_inline')?.risk).toBe('publish')
    expect(defs.find((d) => d.id === 'git.status')?.group).toBe('git')
    expect(defs.find((d) => d.id === 'git.commit')?.risk).toBe('write')
    expect(defs.find((d) => d.id === 'code.run_js')?.group).toBe('code')
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

  it('includes group on every tool with valid CapabilityGroup', () => {
    const defs = registry.list()
    const validGroups = ['file', 'system', 'browser', 'git', 'code', 'docker_mcp']
    for (const d of defs) {
      expect(d.group, `tool ${d.id} missing group`).toBeDefined()
      expect(validGroups).toContain(d.group)
    }
  })

  it('groups native tools correctly by id prefix', () => {
    const defs = registry.list()
    expect(defs.find((d) => d.id === 'file.read')?.group).toBe('file')
    expect(defs.find((d) => d.id === 'system.exec')?.group).toBe('system')
    expect(defs.find((d) => d.id === 'browser.open')?.group).toBe('browser')
  })

  it('routes docker_mcp:: ids through mcpManager.callTool', async () => {
    let captured: any = null
    const fakeManager = {
      callTool: async (serverId: string, toolName: string, args: any) => {
        captured = { serverId, toolName, args }
        return { ok: true }
      },
    }
    const reg2 = buildRegistry({
      getAllowedRoots: () => [root],
      commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'),
      mcpManager: fakeManager as any,
    })
    const result = await reg2.run('docker_mcp::context7::resolve-library-id', { name: 'react' }, {
      jobId: 't', emit: () => {}, signal: new AbortController().signal,
    })
    expect(captured).toEqual({ serverId: 'context7', toolName: 'resolve-library-id', args: { name: 'react' } })
    expect(result).toEqual({ ok: true })
    await reg2.shutdown()
  })

  it('rejects docker_mcp:: id when mcpManager is not configured', async () => {
    await expect(registry.run('docker_mcp::context7::tool', {}, {
      jobId: 't', emit: () => {}, signal: new AbortController().signal,
    })).rejects.toThrow(/docker-mcp not configured/)
  })

  it('rejects malformed docker_mcp id', async () => {
    const fakeManager = { callTool: async () => ({}) }
    const reg2 = buildRegistry({
      getAllowedRoots: () => [root],
      commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'),
      mcpManager: fakeManager as any,
    })
    await expect(reg2.run('docker_mcp::onlyone', {}, {
      jobId: 't', emit: () => {}, signal: new AbortController().signal,
    })).rejects.toThrow(/malformed/)
    await reg2.shutdown()
  })
})
