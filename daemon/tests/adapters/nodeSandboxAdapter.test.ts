import { describe, it, expect } from 'vitest'
import { createNodeSandboxAdapter } from '../../src/adapters/nodeSandboxAdapter.js'

describe('nodeSandboxAdapter', () => {
  it('runs simple expression and captures stdout', async () => {
    const adapter = createNodeSandboxAdapter({ timeoutMs: 5000 })
    const r = await adapter.runJs({ code: 'console.log(2 + 2)' })
    expect(r.stdout.trim()).toBe('4')
    expect(r.exitCode).toBe(0)
    expect(r.timedOut).toBe(false)
  })

  it('captures stderr', async () => {
    const adapter = createNodeSandboxAdapter({ timeoutMs: 5000 })
    const r = await adapter.runJs({ code: 'process.stderr.write("err\\n")' })
    expect(r.stderr.trim()).toBe('err')
  })

  it('returns non-zero exit code on throw', async () => {
    const adapter = createNodeSandboxAdapter({ timeoutMs: 5000 })
    const r = await adapter.runJs({ code: 'throw new Error("boom")' })
    expect(r.exitCode).not.toBe(0)
    expect(r.stderr).toContain('boom')
  })

  it('times out long-running code', async () => {
    const adapter = createNodeSandboxAdapter({ timeoutMs: 200 })
    const r = await adapter.runJs({ code: 'while(true){}' })
    expect(r.timedOut).toBe(true)
    expect(r.exitCode).not.toBe(0)
  })

  it('per-call timeoutMs overrides factory default', async () => {
    const adapter = createNodeSandboxAdapter({ timeoutMs: 30_000 })
    const r = await adapter.runJs({ code: 'while(true){}', timeoutMs: 200 })
    expect(r.timedOut).toBe(true)
  })
})
