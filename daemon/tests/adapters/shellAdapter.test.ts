import { describe, it, expect } from 'vitest'
import { createShellAdapter } from '../../src/adapters/shellAdapter.js'

const ALLOW = ['node']

describe('shellAdapter', () => {
  const adapter = createShellAdapter({ allowlist: ALLOW })

  it('runs node -e and returns stdout', async () => {
    const r = await adapter.run({ command: 'node', args: ['-e', 'process.stdout.write("hi")'] })
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toBe('hi')
  })

  it('captures non-zero exit code', async () => {
    const r = await adapter.run({ command: 'node', args: ['-e', 'process.exit(2)'] })
    expect(r.exitCode).toBe(2)
  })

  it('rejects non-allowlisted commands', async () => {
    await expect(adapter.run({ command: 'rm', args: [] })).rejects.toThrow(/sandbox/i)
  })

  it('rejects shell metacharacters', async () => {
    await expect(adapter.run({ command: 'node && rm', args: [] })).rejects.toThrow(/sandbox/i)
  })

  it('times out long-running commands', async () => {
    await expect(adapter.run({
      command: 'node',
      args: ['-e', 'setTimeout(()=>{}, 5000)'],
      timeoutMs: 100,
    })).rejects.toThrow(/timeout/i)
  })
})
