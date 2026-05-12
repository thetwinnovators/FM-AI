import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildServer } from '../../src/server.js'
import type { FastifyInstance } from 'fastify'

const TOKEN = 'a'.repeat(64)

async function pollJob(baseUrl: string, jobId: string, token: string, timeoutMs = 30_000) {
  const sse = await fetch(`${baseUrl}/jobs/${jobId}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
  })
  const reader = sse.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n'); buf = lines.pop() ?? ''
    for (const line of lines) {
      const m = line.match(/^data: (.*)$/)
      if (!m) continue
      const evt = JSON.parse(m[1]!)
      if (evt.type === 'done') { reader.cancel(); return { ok: true as const, result: evt.result } }
      if (evt.type === 'failed') { reader.cancel(); return { ok: false as const, error: evt.error } }
    }
  }
  reader.cancel()
  throw new Error('job did not terminate within timeout')
}

describe('end-to-end through HTTP', () => {
  let app: FastifyInstance
  let root: string
  let baseUrl: string

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'e2e-'))
    app = await buildServer({
      token: TOKEN,
      allowedRoots: [root],
      commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'),
      dbPath: ':memory:',
    })
    await app.listen({ port: 0, host: '127.0.0.1' })
    baseUrl = `http://127.0.0.1:${(app.server.address() as any).port}`
  })
  afterAll(async () => {
    await app.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('file.write then file.read round-trips through the daemon', async () => {
    const file = join(root, 'e2e.txt')

    const submitWrite = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ toolId: 'file.write', params: { path: file, content: 'round-trip' } }),
    })
    const { jobId: writeId } = await submitWrite.json() as { jobId: string }
    const w = await pollJob(baseUrl, writeId, TOKEN)
    expect(w.ok).toBe(true)

    const submitRead = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ toolId: 'file.read', params: { path: file } }),
    })
    const { jobId: readId } = await submitRead.json() as { jobId: string }
    const r = await pollJob(baseUrl, readId, TOKEN)
    expect(r.ok).toBe(true)
    if (r.ok) expect((r.result as any).content).toBe('round-trip')
  }, 30_000)

  it('system.exec runs node and returns stdout', async () => {
    const submit = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        toolId: 'system.exec',
        params: { command: 'node', args: ['-e', 'process.stdout.write("ok")'] },
      }),
    })
    const { jobId } = await submit.json() as { jobId: string }
    const out = await pollJob(baseUrl, jobId, TOKEN)
    expect(out.ok).toBe(true)
    if (out.ok) expect((out.result as any).stdout).toBe('ok')
  }, 30_000)
})
