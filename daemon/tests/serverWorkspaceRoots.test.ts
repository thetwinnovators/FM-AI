import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildServer } from '../src/server.js'
import type { FastifyInstance } from 'fastify'

describe('workspace-roots endpoints', () => {
  let dir: string
  let app: FastifyInstance

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'ws-srv-'))
    app = await buildServer({
      token: 'tk',
      workspaceRootsPath: join(dir, 'roots.json'),
      defaultRoots: [dir],
      commandAllowlist: [],
      screenshotsDir: join(dir, 'shots'),
      dbPath: ':memory:',
    })
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('GET /workspace-roots returns defaults when no file', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/workspace-roots',
      headers: { authorization: 'Bearer tk' },
    })
    expect(r.statusCode).toBe(200)
    expect(JSON.parse(r.payload).roots).toEqual([dir])
  })

  it('POST /workspace-roots adds a path', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/workspace-roots',
      headers: { authorization: 'Bearer tk', 'content-type': 'application/json' },
      payload: JSON.stringify({ path: '/added' }),
    })
    expect(r.statusCode).toBe(200)
    expect(JSON.parse(r.payload).roots).toContain('/added')
  })

  it('DELETE /workspace-roots removes a path', async () => {
    await app.inject({
      method: 'POST',
      url: '/workspace-roots',
      headers: { authorization: 'Bearer tk', 'content-type': 'application/json' },
      payload: JSON.stringify({ path: '/added' }),
    })
    const r = await app.inject({
      method: 'DELETE',
      url: '/workspace-roots',
      headers: { authorization: 'Bearer tk', 'content-type': 'application/json' },
      payload: JSON.stringify({ path: '/added' }),
    })
    expect(r.statusCode).toBe(200)
    expect(JSON.parse(r.payload).roots).not.toContain('/added')
  })

  it('POST with missing path returns 400', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/workspace-roots',
      headers: { authorization: 'Bearer tk', 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    })
    expect(r.statusCode).toBe(400)
  })

  it('requires auth on GET', async () => {
    const r = await app.inject({ method: 'GET', url: '/workspace-roots' })
    expect(r.statusCode).toBe(401)
  })

  it('requires auth on POST', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/workspace-roots',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ path: '/x' }),
    })
    expect(r.statusCode).toBe(401)
  })

  it('requires auth on DELETE', async () => {
    const r = await app.inject({
      method: 'DELETE',
      url: '/workspace-roots',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ path: '/x' }),
    })
    expect(r.statusCode).toBe(401)
  })
})
