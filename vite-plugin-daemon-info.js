import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

// Exposes the local operator daemon's connection info ({port, token}) from
// ~/.flowmap/daemon.json to the browser via a Vite dev middleware. The browser
// can't read that file directly; this proxy is the bridge.
export default function daemonInfo() {
  return {
    name: 'flowmap-daemon-info',
    configureServer(server) {
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
