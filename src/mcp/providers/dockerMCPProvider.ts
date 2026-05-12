import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition, ToolPermissionMode } from '../types.js'

// Reads daemon connection info (port + bearer token) via the Vite dev middleware
// that exposes ~/.flowmap/daemon.json to the browser.
async function daemonInfo(): Promise<{ port: number; token: string } | null> {
  try {
    const r = await fetch('/api/daemon/info')
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const info = await daemonInfo()
  if (!info) throw new Error('Local daemon not running')
  const url = `http://127.0.0.1:${info.port}${path}`
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined ?? {}),
    Authorization: `Bearer ${info.token}`,
    'Content-Type': 'application/json',
  }
  return fetch(url, { ...init, headers })
}

function riskToPermission(risk?: string): ToolPermissionMode {
  if (risk === 'read') return 'auto'
  if (risk === 'publish') return 'restricted'
  return 'approval_required'
}

// Subscribe to the daemon's SSE stream until the job terminates.
async function awaitJobCompletion(jobId: string): Promise<unknown> {
  const info = await daemonInfo()
  if (!info) throw new Error('Local daemon not running')
  const sseUrl = `http://127.0.0.1:${info.port}/jobs/${jobId}`
  const sse = await fetch(sseUrl, {
    headers: { Authorization: `Bearer ${info.token}`, Accept: 'text/event-stream' },
  })
  if (!sse.ok || !sse.body) throw new Error(`SSE subscribe failed: ${sse.status}`)

  const reader = sse.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const m = line.match(/^data: (.*)$/)
      if (!m) continue
      const evt = JSON.parse(m[1]!)
      if (evt.type === 'done') return evt.result
      if (evt.type === 'failed') throw new Error(evt.error?.message ?? 'job failed')
      if (evt.type === 'cancelled') throw new Error('job cancelled')
    }
  }
  throw new Error('SSE stream closed without terminal event')
}

export const dockerMCPProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    const r = await call('/docker-mcp/servers')
    if (!r.ok) throw new Error(`/docker-mcp/servers failed: ${r.status}`)
    const body = await r.json() as {
      servers: Array<{
        config: { id: string; name: string; image: string; enabled: boolean }
        status: 'connected' | 'disconnected' | 'error'
        tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>
      }>
    }

    const tools: MCPToolDefinition[] = []
    for (const server of body.servers) {
      if (server.status !== 'connected') continue
      for (const t of server.tools) {
        tools.push({
          id: `docker_mcp::${server.config.id}::${t.name}`,
          integrationId: integration.id,
          toolName: t.name,
          displayName: `${t.name} (${server.config.name})`,
          description: t.description,
          riskLevel: 'write',
          permissionMode: riskToPermission('write'),
          inputSchema: t.inputSchema,
          tags: ['docker-mcp', server.config.id],
          capabilityGroup: 'docker_mcp',
          toolSource: 'docker_mcp',
        })
      }
    }
    return tools
  },

  async executeTool({ tool, input }) {
    // tool.id format: docker_mcp::<serverId>::<toolName>
    const parts = tool.id.split('::')
    if (parts.length !== 3) {
      return { success: false, error: 'malformed docker-mcp tool id' }
    }
    try {
      const submit = await call('/jobs', {
        method: 'POST',
        body: JSON.stringify({ toolId: tool.id, params: input }),
      })
      if (!submit.ok) {
        const text = await submit.text()
        return { success: false, error: `POST /jobs failed (${submit.status}): ${text}` }
      }
      const { jobId } = await submit.json() as { jobId: string }
      const output = await awaitJobCompletion(jobId)
      return { success: true, output }
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) }
    }
  },

  async testConnection(_integration) {
    try {
      const r = await call('/docker-mcp/servers')
      if (!r.ok) return { success: false, error: `Daemon returned ${r.status}` }
      const body = await r.json() as { servers: Array<{ status: string }> }
      const connected = body.servers.filter((s) => s.status === 'connected').length
      if (connected === 0) {
        return { success: false, error: 'No Docker MCP servers connected. Add servers to ~/.flowmap/docker-mcp-servers.json' }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Daemon not running' }
    }
  },
}
