import Fastify, { FastifyInstance } from 'fastify'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { loadOrCreateConfig, saveActualPort, CONFIG_DIR } from './config.js'
import { verifyAuthHeader } from './auth.js'
import { buildRegistry, ToolRegistry } from './tools/registry.js'
import { JobQueue } from './queue/jobQueue.js'
import { JobStore } from './queue/jobStore.js'
import { EventLog } from './logging/eventLog.js'
import { ServerManager } from './mcp/serverManager.js'
import type { Job, JobEvent, ErrorCode } from './types.js'

export interface ServerOptions {
  token: string
  allowedRoots: string[]
  commandAllowlist: string[]
  screenshotsDir: string
  dbPath: string
  mcpRegistryPath?: string
}

export async function buildServer(opts: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  const mcpManager = new ServerManager(opts.mcpRegistryPath)
  // Sync eagerly but don't block server startup — Docker may be slow
  mcpManager.sync().catch((err) => {
    console.warn('docker-mcp initial sync failed:', err?.message ?? err)
  })

  const registry: ToolRegistry = buildRegistry({
    allowedRoots: opts.allowedRoots,
    commandAllowlist: opts.commandAllowlist,
    screenshotsDir: opts.screenshotsDir,
    mcpManager,
  })
  const queue = new JobQueue({ concurrency: 4 })
  const store = new JobStore(opts.dbPath)
  const eventLog = new EventLog()
  const cancellers = new Map<string, AbortController>()

  function requireAuth(req: any, reply: any): boolean {
    if (!verifyAuthHeader(req.headers.authorization, opts.token)) {
      reply.code(401).send({ error: 'unauthorized' })
      return false
    }
    return true
  }

  app.get('/health', async () => ({ ok: true, version: '0.0.1' }))

  app.get('/tools', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const native = registry.list()
    const dockerTools = mcpManager.listServers()
      .filter((s) => s.status === 'connected')
      .flatMap((s) => s.tools.map((t) => ({
        id: `docker_mcp::${s.config.id}::${t.name}`,
        displayName: `${t.name} (${s.config.name})`,
        description: t.description ?? '',
        risk: 'write' as const,
        group: 'docker_mcp' as const,
        paramsSchema: t.inputSchema ?? null,
      })))
    return { tools: [...native, ...dockerTools] }
  })

  app.get('/docker-mcp/servers', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    return { servers: mcpManager.listServers() }
  })

  app.post('/docker-mcp/sync', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    try {
      await mcpManager.sync()
      return { servers: mcpManager.listServers() }
    } catch (err: any) {
      reply.code(500)
      return { error: err?.message ?? String(err) }
    }
  })

  app.post('/jobs', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const body = req.body as { toolId?: string; params?: unknown }
    if (!body?.toolId) {
      reply.code(400)
      return { error: 'toolId required' }
    }
    const isDockerMcpTool = body.toolId.startsWith('docker_mcp::')
    const known = isDockerMcpTool || registry.list().find((t) => t.id === body.toolId)
    if (!known) {
      reply.code(400)
      return { error: `unknown tool: ${body.toolId}` }
    }

    const jobId = randomBytes(8).toString('hex')
    const toolId = body.toolId
    const params = body.params
    const job: Job = {
      id: jobId, toolId, params,
      status: 'queued', createdAt: new Date().toISOString(),
    }
    store.insert(job)
    eventLog.emit({ type: 'queued', jobId })

    const ctrl = new AbortController()
    cancellers.set(jobId, ctrl)

    queue.submit(async () => {
      store.updateStatus(jobId, 'running', { startedAt: new Date().toISOString() })
      eventLog.emit({ type: 'running', jobId })
      try {
        const result = await registry.run(toolId, params, {
          jobId,
          emit: (e: JobEvent) => eventLog.emit(e),
          signal: ctrl.signal,
        })
        store.complete(jobId, result)
        eventLog.emit({ type: 'done', jobId, result })
      } catch (err: any) {
        const msg = err?.message ?? String(err)
        const codeMatch = msg.match(/^(\w+):/)
        const code = (codeMatch?.[1] as ErrorCode) ?? 'adapter_failure'
        const error = { code, message: msg }
        store.fail(jobId, error)
        eventLog.emit({ type: 'failed', jobId, error })
      } finally {
        cancellers.delete(jobId)
      }
    }).catch(() => { /* errors already captured to event log */ })

    return { jobId }
  })

  app.post('/jobs/:id/cancel', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const id = (req.params as any).id
    const ctrl = cancellers.get(id)
    if (!ctrl) {
      reply.code(404)
      return { error: 'job not found or already finished' }
    }
    ctrl.abort()
    store.cancel(id)
    eventLog.emit({ type: 'cancelled', jobId: id })
    return { ok: true }
  })

  app.get('/jobs/:id', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const id = (req.params as any).id

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const send = (event: JobEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    const unsub = eventLog.subscribe(id, send)
    req.raw.on('close', () => { unsub() })
    await new Promise<void>(() => {})
  })

  app.addHook('onClose', async () => {
    await registry.shutdown()
    await mcpManager.shutdown()
  })

  return app
}

export async function startServer(): Promise<void> {
  const cfg = loadOrCreateConfig()
  const screenshotsDir = join(CONFIG_DIR, 'workspace', 'screenshots')
  const workspace = join(CONFIG_DIR, 'workspace')
  await mkdir(workspace, { recursive: true })
  await mkdir(screenshotsDir, { recursive: true })

  const app = await buildServer({
    token: cfg.token,
    allowedRoots: [workspace],
    commandAllowlist: ['python', 'python3', 'node', 'npm', 'git', 'curl'],
    screenshotsDir,
    dbPath: join(CONFIG_DIR, 'jobs.db'),
    mcpRegistryPath: join(CONFIG_DIR, 'docker-mcp-servers.json'),
  })

  const address = await app.listen({ port: cfg.port || 0, host: '127.0.0.1' })
  const port = (app.server.address() as any).port
  saveActualPort(CONFIG_DIR, port)
  console.log(`flowmap-operator daemon listening on ${address}`)
}

// Normalize both sides to absolute OS-native paths. The previous string-equality
// check failed on Windows (forward slashes in import.meta.url vs backslashes in
// process.argv[1]) so the daemon would import cleanly and then exit with code 0
// without ever calling startServer.
async function isEntryPoint(): Promise<boolean> {
  if (!process.argv[1]) return false
  try {
    const { fileURLToPath } = await import('node:url')
    const { resolve } = await import('node:path')
    const here = resolve(fileURLToPath(import.meta.url))
    const argv1 = resolve(process.argv[1])
    return here === argv1
  } catch {
    return false
  }
}

if (await isEntryPoint()) {
  startServer().catch((err) => {
    console.error('daemon failed to start:', err)
    process.exit(1)
  })
}
