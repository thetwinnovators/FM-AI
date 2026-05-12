import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildServer } from '../src/server.js'
import type { FastifyInstance } from 'fastify'

describe('server SSE /jobs/:id', () => {
  let app: FastifyInstance
  let root: string
  let baseUrl: string
  const TOKEN = 'a'.repeat(64)

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'sse-'))
    app = await buildServer({
      token: TOKEN, defaultRoots: [root], commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'), dbPath: ':memory:',
    })
    await app.listen({ port: 0, host: '127.0.0.1' })
    const addr = app.server.address() as any
    baseUrl = `http://127.0.0.1:${addr.port}`
  })
  afterEach(async () => {
    await app.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('streams queued → running → done events for a file.read job', async () => {
    const f = join(root, 'x.txt'); writeFileSync(f, 'hi')
    const submit = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ toolId: 'file.read', params: { path: f } }),
    })
    const { jobId } = await submit.json() as { jobId: string }

    const sse = await fetch(`${baseUrl}/jobs/${jobId}`, {
      headers: { authorization: `Bearer ${TOKEN}`, accept: 'text/event-stream' },
    })
    expect(sse.headers.get('content-type')).toMatch(/event-stream/)

    const reader = sse.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    const types: string[] = []
    const start = Date.now()
    while (Date.now() - start < 5000) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      for (const line of buf.split('\n')) {
        const m = line.match(/^data: (.*)$/)
        if (m) {
          try {
            const evt = JSON.parse(m[1]!)
            if (evt.type && !types.includes(evt.type)) types.push(evt.type)
            if (evt.type === 'done' || evt.type === 'failed') {
              reader.cancel(); break
            }
          } catch {}
        }
      }
      if (types.includes('done') || types.includes('failed')) break
    }
    expect(types).toContain('queued')
    expect(types).toContain('running')
    expect(types).toContain('done')
  }, 10_000)
})
