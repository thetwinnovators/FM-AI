import { spawn } from 'node:child_process'
import { isCommandAllowed } from '../sandbox/commandPolicy.js'

const DEFAULT_TIMEOUT = 60_000

export interface ShellAdapterOptions {
  allowlist: string[]
}

export interface ShellRunParams {
  command: string
  args: string[]
  cwd?: string
  timeoutMs?: number
  env?: Record<string, string>
}

export interface ShellRunResult {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
}

export function createShellAdapter(opts: ShellAdapterOptions) {
  async function run(params: ShellRunParams): Promise<ShellRunResult> {
    const check = isCommandAllowed(params.command, opts.allowlist)
    if (!check.ok) throw new Error(`sandbox_violation: ${check.reason}`)

    const start = Date.now()
    return new Promise<ShellRunResult>((resolve, reject) => {
      const child = spawn(params.command, params.args, {
        cwd: params.cwd,
        env: params.env ? { ...process.env, ...params.env } : process.env,
        shell: false,
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => { stdout += d.toString('utf8') })
      child.stderr.on('data', (d) => { stderr += d.toString('utf8') })

      const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT
      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error(`timeout: exceeded ${timeoutMs}ms`))
      }, timeoutMs)

      child.on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(`adapter_failure: ${err.message}`))
      })

      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({
          stdout, stderr,
          exitCode: code ?? -1,
          durationMs: Date.now() - start,
        })
      })
    })
  }

  return { run }
}
