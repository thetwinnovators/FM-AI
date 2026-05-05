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

// Memory-index output paths (project root, not ~/.flowmap)
const MEM_JSON_PATH = join(process.cwd(), 'memory-index.json')
const MEM_MD_PATH   = join(process.cwd(), 'memory-index.md')

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
      // ── /api/memory-index  (POST only) ─────────────────────────────────────────
      // Receives { index: MemoryIndex, markdown: string } from the browser,
      // writes memory-index.json and memory-index.md to the project root.
      server.middlewares.use('/api/memory-index', async (req, res, next) => {
        if (req.url && req.url !== '/' && req.url !== '') return next()

        res.setHeader('Content-Type', 'application/json')

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'method not allowed' }))
          return
        }

        try {
          const body = await readBody(req)
          let parsed
          try { parsed = JSON.parse(body) } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'body is not valid JSON' }))
            return
          }

          const { index, markdown } = parsed

          if (index) {
            writeFileSync(MEM_JSON_PATH, JSON.stringify(index, null, 2), 'utf8')
          }
          if (markdown) {
            writeFileSync(MEM_MD_PATH, markdown, 'utf8')
          }

          res.statusCode = 200
          res.end(JSON.stringify({ ok: true, jsonPath: MEM_JSON_PATH, mdPath: MEM_MD_PATH }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err?.message || err) }))
        }
      })

      // ── /api/state  (GET + PUT) ─────────────────────────────────────────────────
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
