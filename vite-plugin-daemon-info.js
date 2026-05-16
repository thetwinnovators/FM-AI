import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { request as httprequest } from 'node:http'

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

      // Transparent HTTP proxy for all daemon API calls.
      // The browser calls /api/daemon-proxy/<path> (same-origin → no CORS),
      // and this middleware forwards to http://127.0.0.1:<port>/<path>.
      // Handles regular JSON routes and SSE streaming routes identically.
      server.middlewares.use('/api/daemon-proxy', (req, res) => {
        const file = join(homedir(), '.flowmap', 'daemon.json')
        let cfg
        try {
          if (!existsSync(file)) throw new Error('not found')
          cfg = JSON.parse(readFileSync(file, 'utf8'))
        } catch {
          res.statusCode = 503
          res.setHeader('content-type', 'application/json')
          res.end('{"error":"daemon not running"}')
          return
        }

        const targetPath = (req.url ?? '/').replace(/^\/api\/daemon-proxy/, '') || '/'

        // Strip hop-by-hop headers that must not be forwarded
        const forwardHeaders = { ...req.headers }
        delete forwardHeaders['host']
        delete forwardHeaders['connection']
        delete forwardHeaders['transfer-encoding']
        delete forwardHeaders['upgrade']

        const proxyReq = httprequest({
          hostname: '127.0.0.1',
          port: cfg.port,
          path: targetPath,
          method: req.method,
          headers: forwardHeaders,
        }, (proxyRes) => {
          const isSSE = proxyRes.headers['content-type']?.includes('text/event-stream')

          // Build outgoing headers, removing chunked encoding so Vite doesn't re-chunk
          const outHeaders = { ...proxyRes.headers }
          delete outHeaders['transfer-encoding']

          if (isSSE) {
            outHeaders['x-accel-buffering'] = 'no'
            outHeaders['cache-control'] = 'no-cache'
            outHeaders['connection'] = 'keep-alive'
          }

          res.writeHead(proxyRes.statusCode || 200, outHeaders)
          proxyRes.pipe(res)

          // Abort upstream when client disconnects
          req.on('close', () => {
            proxyReq.destroy()
            proxyRes.destroy()
          })
        })

        proxyReq.on('error', (err) => {
          if (!res.headersSent) {
            res.statusCode = 502
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: `Daemon proxy error: ${err.message}` }))
          } else {
            res.destroy()
          }
        })

        // Pipe request body for POST/PATCH/DELETE; end immediately for GET/HEAD
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          req.pipe(proxyReq)
        } else {
          proxyReq.end()
        }
      })
    },
  }
}
