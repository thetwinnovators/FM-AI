import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Exposes the local operator daemon's connection info ({port, token}) from
// ~/.flowmap/daemon.json to the browser via a Vite dev middleware. The browser
// can't read that file directly; this proxy is the bridge.
//
// Also auto-spawns the daemon as a child of the dev server so the user does not
// need a second terminal. Daemon stdout/stderr is prefixed with "[daemon]" and
// the child is killed when Vite exits.
export default function daemonInfo() {
  let daemonProc = null

  function startDaemon() {
    if (daemonProc) return
    const daemonDir = join(__dirname, 'daemon')
    if (!existsSync(join(daemonDir, 'package.json'))) return

    // Spawn node directly with tsx's CLI entrypoint. Going through `npx tsx`
    // with `shell: true` on Windows wraps the child in cmd.exe + npm + tsx and
    // makes stdout buffering + signal forwarding unreliable — output never
    // surfaces and SIGTERM doesn't reach the actual node process.
    const tsxCli = join(daemonDir, 'node_modules', 'tsx', 'dist', 'cli.mjs')
    const serverEntry = join(daemonDir, 'src', 'server.ts')
    if (!existsSync(tsxCli)) {
      console.warn('[daemon] tsx CLI not found at', tsxCli, '— run `npm install` in daemon/')
      return
    }
    daemonProc = spawn(process.execPath, [tsxCli, serverEntry], {
      cwd: daemonDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    daemonProc.stdout?.on('data', (chunk) => {
      process.stdout.write(`\x1b[36m[daemon]\x1b[0m ${chunk}`)
    })
    daemonProc.stderr?.on('data', (chunk) => {
      process.stderr.write(`\x1b[31m[daemon]\x1b[0m ${chunk}`)
    })
    daemonProc.on('exit', (code, signal) => {
      if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
        console.warn(`[daemon] exited with code ${code} signal ${signal}`)
      }
      daemonProc = null
    })

    const stop = () => {
      if (daemonProc) {
        try { daemonProc.kill('SIGTERM') } catch { /* ignore */ }
        daemonProc = null
      }
    }
    process.once('exit', stop)
    process.once('SIGINT', () => { stop(); process.exit(0) })
    process.once('SIGTERM', () => { stop(); process.exit(0) })
  }

  return {
    name: 'flowmap-daemon-info',
    configureServer(server) {
      startDaemon()

      server.httpServer?.once('close', () => {
        if (daemonProc) {
          try { daemonProc.kill('SIGTERM') } catch { /* ignore */ }
          daemonProc = null
        }
      })

      server.middlewares.use('/api/daemon/info', (_req, res) => {
        try {
          const file = join(homedir(), '.flowmap', 'daemon.json')
          if (!existsSync(file)) {
            res.statusCode = 404
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'daemon not started' }))
            return
          }
          const cfg = JSON.parse(readFileSync(file, 'utf8'))
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ port: cfg.port, token: cfg.token }))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}
