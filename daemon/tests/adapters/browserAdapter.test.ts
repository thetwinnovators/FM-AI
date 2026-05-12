import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, Server } from 'node:http'
import { createBrowserAdapter, BrowserAdapter } from '../../src/adapters/browserAdapter.js'

describe('browserAdapter', () => {
  let server: Server
  let baseUrl: string
  let adapter: BrowserAdapter

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<!doctype html><html><body>
        <h1 id="title">Hello</h1>
        <input id="name" />
        <button id="go">Go</button>
      </body></html>`)
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const addr = server.address()
    baseUrl = `http://127.0.0.1:${(addr as any).port}`
    adapter = createBrowserAdapter()
  })

  afterAll(async () => {
    await adapter.shutdown()
    await new Promise<void>((r) => server.close(() => r()))
  })

  it('opens, navigates, extracts text, and closes', async () => {
    const { sessionId } = await adapter.open({})
    await adapter.navigate({ sessionId, url: baseUrl })
    const r = await adapter.extract({ sessionId, selector: '#title', attr: 'text' })
    expect(r.matches).toEqual(['Hello'])
    await adapter.close({ sessionId })
  })

  it('fills an input and reads its value back', async () => {
    const { sessionId } = await adapter.open({})
    await adapter.navigate({ sessionId, url: baseUrl })
    await adapter.fill({ sessionId, selector: '#name', value: 'Jeno' })
    const r = await adapter.extract({ sessionId, selector: '#name', attr: 'value' })
    expect(r.matches).toEqual(['Jeno'])
    await adapter.close({ sessionId })
  })

  it('rejects calls with an unknown sessionId', async () => {
    await expect(adapter.navigate({ sessionId: 'nope', url: baseUrl })).rejects.toThrow(/session/i)
  })
}, 30_000)
