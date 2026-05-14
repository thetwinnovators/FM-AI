/**
 * daemonTools.js
 *
 * Bridge between the local daemon's Docker MCP tools and Flow.AI Chat.
 * Fetches available docker_mcp tools from the daemon's /tools endpoint,
 * and executes them via POST /jobs + SSE-based result polling.
 *
 * We cannot use EventSource for the SSE stream because it doesn't support
 * custom Authorization headers — we use fetch + ReadableStream instead.
 */

// ── Daemon connection ─────────────────────────────────────────────────────────

let _cachedInfo = null
let _cacheTs    = 0
const CACHE_TTL = 30_000 // re-fetch daemon info every 30s

async function getDaemonInfo() {
  if (_cachedInfo && Date.now() - _cacheTs < CACHE_TTL) return _cachedInfo
  try {
    const r = await fetch('/api/daemon/info')
    if (!r.ok) return null
    _cachedInfo = await r.json()
    _cacheTs    = Date.now()
    return _cachedInfo
  } catch {
    return null
  }
}

async function daemonFetch(path, init = {}) {
  const info = await getDaemonInfo()
  if (!info) throw new Error('Daemon not available')
  return fetch(`http://127.0.0.1:${info.port}${path}`, {
    ...init,
    headers: {
      ...((init.headers) ?? {}),
      Authorization: `Bearer ${info.token}`,
      'Content-Type': 'application/json',
    },
  })
}

// ── Tool discovery ────────────────────────────────────────────────────────────

/**
 * Fetch all docker_mcp tools from the daemon.
 * Returns [] if daemon is offline or returns no docker_mcp tools.
 */
export async function fetchDaemonTools() {
  try {
    const r = await daemonFetch('/tools')
    if (!r.ok) return []
    const data = await r.json()
    // Server returns { tools: [...] }; handle that as well as a bare array.
    const all = Array.isArray(data) ? data : (data?.tools ?? [])
    return all.filter((t) => t.group === 'docker_mcp')
  } catch {
    return []
  }
}

/**
 * Build a Map<toolName, fullDaemonTool> for fast lookup during tool call routing.
 * toolName is the short name the LLM sees (e.g. "fetch", "search").
 */
export function buildDaemonToolMap(daemonTools) {
  const map = new Map()
  for (const t of daemonTools) {
    // Tool id is 'docker_mcp::{serverId}::{toolName}' — extract the short name
    // as the map key so the LLM's <tool_call name="toolName"> can find it.
    const toolName = t.id?.split('::')?.[2] ?? t.toolName
    if (toolName) map.set(toolName, t)
  }
  return map
}

/**
 * Convert a daemon tool object to the { toolName, description } shape that
 * buildToolSystemBlock() expects.
 */
export function daemonToolToMCPShape(t) {
  const parts    = t.id?.split('::') ?? []
  const toolName = parts[2] ?? t.toolName ?? t.id ?? 'unknown'
  const serverId = parts[1] ?? ''
  return {
    toolName,
    description: t.description ?? (serverId ? `${serverId} / ${toolName}` : toolName),
  }
}

// ── Job execution ─────────────────────────────────────────────────────────────

const JOB_TIMEOUT_MS = 30_000

/**
 * Execute a daemon tool by submitting a job and polling the SSE stream.
 *
 * @param {string} toolId     Full daemon tool ID, e.g. "docker_mcp::mcp-fetch::fetch"
 * @param {object} params     Arguments to pass to the tool
 * @param {number} [timeoutMs]
 * @returns {{ success: boolean, output?: any, error?: string }}
 */
export async function executeDaemonTool(toolId, params, timeoutMs = JOB_TIMEOUT_MS) {
  // 1. Submit the job
  let jobId
  try {
    const r = await daemonFetch('/jobs', {
      method: 'POST',
      body: JSON.stringify({ toolId, params }),
    })
    if (!r.ok) {
      const text = await r.text()
      return { success: false, error: `POST /jobs failed (${r.status}): ${text}` }
    }
    const body = await r.json()
    jobId = body.jobId
  } catch (err) {
    return { success: false, error: `Failed to submit job: ${err?.message ?? err}` }
  }

  // 2. Poll the SSE stream for completion
  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, error: 'Tool execution timed out' })
    }, timeoutMs)

    try {
      const info = await getDaemonInfo()
      if (!info) {
        clearTimeout(timer)
        return resolve({ success: false, error: 'Daemon not available' })
      }

      const r = await fetch(`http://127.0.0.1:${info.port}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${info.token}` },
      })

      if (!r.ok || !r.body) {
        clearTimeout(timer)
        return resolve({ success: false, error: `GET /jobs/${jobId} failed (${r.status})` })
      }

      const reader  = r.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      const finish = (result) => {
        clearTimeout(timer)
        reader.cancel().catch(() => {})
        resolve(result)
      }

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const chunks = buf.split('\n\n')
        buf = chunks.pop() ?? ''

        for (const chunk of chunks) {
          if (!chunk.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(chunk.slice(6))
            if (evt.type === 'done') {
              return finish({ success: true, output: evt.result })
            }
            if (evt.type === 'failed') {
              return finish({ success: false, error: evt.error?.message ?? 'Tool failed' })
            }
          } catch { /* ignore malformed SSE line */ }
        }
      }

      // Stream ended without a done/failed event
      finish({ success: false, error: 'Job stream closed unexpectedly' })
    } catch (err) {
      clearTimeout(timer)
      resolve({ success: false, error: err?.message ?? String(err) })
    }
  })
}
