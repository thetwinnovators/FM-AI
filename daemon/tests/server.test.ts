import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildServer } from '../src/server.js'
import type { FastifyInstance } from 'fastify'

describe('server', () => {
  let app: FastifyInstance
  let root: string
  const TOKEN = 'a'.repeat(64)

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'srv-'))
    app = await buildServer({
      token: TOKEN,
      allowedRoots: [root],
      commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'),
      dbPath: ':memory:',
    })
  })
  afterEach(async () => {
    await app.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('GET /health returns ok without auth', async () => {
    const r = await app.inject({ method: 'GET', url: '/health' })
    expect(r.statusCode).toBe(200)
    expect(r.json().ok).toBe(true)
  })

  it('GET /tools requires auth', async () => {
    const noAuth = await app.inject({ method: 'GET', url: '/tools' })
    expect(noAuth.statusCode).toBe(401)
    const ok = await app.inject({
      method: 'GET', url: '/tools',
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().tools).toHaveLength(20)
  })

  it('POST /jobs returns a jobId', async () => {
    const r = await app.inject({
      method: 'POST', url: '/jobs',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { toolId: 'file.exists', params: { path: '/tmp/whatever' } },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().jobId).toMatch(/^[a-f0-9]+$/)
  })

  it('POST /jobs rejects unknown tools', async () => {
    const r = await app.inject({
      method: 'POST', url: '/jobs',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { toolId: 'nope', params: {} },
    })
    expect(r.statusCode).toBe(400)
  })
})
