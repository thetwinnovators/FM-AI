import { spawn } from 'node:child_process'

export interface NodeSandboxOptions {
  timeoutMs?: number
}

export interface NodeSandboxResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

export function createNodeSandboxAdapter(opts: NodeSandboxOptions = {}) {
  const defaultTimeout = opts.timeoutMs ?? 30_000

  return {
    async runJs(params: { code: string; timeoutMs?: number }): Promise<NodeSandboxResult> {
      const timeout = params.timeoutMs ?? defaultTimeout
      return new Promise<NodeSandboxResult>((resolve) => {
        let stdout = ''
        let stderr = ''
        let timedOut = false
        let settled = false

        const child = spawn(process.execPath, ['-e', params.code], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
        child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })

        const timer = setTimeout(() => {
          timedOut = true
          try { child.kill('SIGKILL') } catch { /* ignore */ }
        }, timeout)

        child.on('close', (code) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve({ stdout, stderr, exitCode: code ?? 1, timedOut })
        })

        child.on('error', (err) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve({ stdout, stderr: stderr + String(err), exitCode: 1, timedOut })
        })
      })
    },
  }
}
