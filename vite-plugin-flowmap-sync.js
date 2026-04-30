// Vite middleware that backs FlowMap's cross-browser sync. Exposes
// `/api/state` (GET + PUT) reading/writing a single JSON file at
// `~/.flowmap/state.json`. Same-machine browsers all hit `http://localhost`
// and converge on the file. Sync only runs while `vite dev` is up; that's
// the documented tradeoff.
//
// File format mirrors the existing snapshot envelope from `src/lib/snapshot.js`,
// so Tauri Phase A can read this file directly when SQLite migration lands.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const FILE_DIR = join(homedir(), '.flowmap')
const FILE_PATH = join(FILE_DIR, 'state.json')
const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB cap — way above any realistic personal-tool snapshot

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    req.on('data', (c) => {
      total += c.length
      if (total > MAX_BODY_BYTES) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export default function flowmapSyncPlugin() {
  return {
    name: 'flowmap-state-sync',
    configureServer(server) {
      server.middlewares.use('/api/state', async (req, res, next) => {
        // Forward anything that isn't this exact path (Vite middleware splits)
        if (req.url && req.url !== '/' && req.url !== '') return next()

        res.setHeader('Content-Type', 'application/json')

        try {
          if (req.method === 'GET') {
            if (!existsSync(FILE_PATH)) {
              res.statusCode = 200
              res.end(JSON.stringify({ exists: false }))
              return
            }
            const stat = statSync(FILE_PATH)
            const raw = readFileSync(FILE_PATH, 'utf8')
            let parsed
            try { parsed = JSON.parse(raw) } catch {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'state file is not valid JSON' }))
              return
            }
            res.statusCode = 200
            res.end(JSON.stringify({ exists: true, lastModified: stat.mtimeMs, data: parsed }))
            return
          }

          if (req.method === 'PUT') {
            const body = await readBody(req)
            // Validate it parses before writing — never overwrite the file with junk.
            try { JSON.parse(body) } catch {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'body is not valid JSON' }))
              return
            }
            mkdirSync(dirname(FILE_PATH), { recursive: true })
            writeFileSync(FILE_PATH, body, 'utf8')
            const stat = statSync(FILE_PATH)
            res.statusCode = 200
            res.end(JSON.stringify({ ok: true, lastModified: stat.mtimeMs, path: FILE_PATH }))
            return
          }

          res.statusCode = 405
          res.end(JSON.stringify({ error: 'method not allowed' }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err?.message || err) }))
        }
      })
    },
  }
}
