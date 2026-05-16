import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition, MCPToolRiskLevel, ToolPermissionMode } from '../types.js'

// Reads daemon connection info (port + bearer token) via a Vite dev middleware
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
  // Route through Vite proxy — same-origin, no CORS needed
  const url = `/api/daemon-proxy${path}`
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined ?? {}),
    Authorization: `Bearer ${info.token}`,
    'Content-Type': 'application/json',
  }
  return fetch(url, { ...init, headers })
}

function riskToPermissionMode(risk: MCPToolRiskLevel): ToolPermissionMode {
  if (risk === 'read') return 'auto'
  return 'approval_required'  // both 'write' and 'publish' require approval at the permissionMode layer; riskLevel further distinguishes
}

// Subscribe to the daemon's SSE stream until the job terminates.
async function awaitJobCompletion(jobId: string): Promise<unknown> {
  const info = await daemonInfo()
  if (!info) throw new Error('Local daemon not running')
  const sseUrl = `/api/daemon-proxy/jobs/${jobId}`
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

export const localProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    const r = await call('/tools')
    if (!r.ok) throw new Error(`/tools failed: ${r.status}`)
    const body = await r.json() as {
      tools: Array<{
        id: string
        displayName: string
        description: string
        risk: MCPToolRiskLevel
        group?: string
      }>
    }
    return body.tools.map((t): MCPToolDefinition => ({
      id: t.id,
      integrationId: integration.id,
      toolName: t.id,
      displayName: t.displayName,
      description: t.description,
      riskLevel: t.risk,
      permissionMode: riskToPermissionMode(t.risk),
      tags: ['local', t.id.split('.')[0] ?? 'misc'],
      capabilityGroup: (t.group as MCPToolDefinition['capabilityGroup']) ?? 'general',
      toolSource: 'native',
    }))
  },

  async executeTool({ tool, input }) {
    try {
      const submit = await call('/jobs', {
        method: 'POST',
        body: JSON.stringify({ toolId: tool.toolName, params: input }),
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
      const info = await daemonInfo()
      if (!info) return { success: false, error: 'Daemon not running. Start with: npm run daemon' }
      const r = await fetch(`http://127.0.0.1:${info.port}/health`)
      if (!r.ok) return { success: false, error: `Health check returned ${r.status}` }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) }
    }
  },
}
