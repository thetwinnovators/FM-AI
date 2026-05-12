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
  if (!info) throw new Error('Local daemon not running. Start it with: npm run daemon')
  return fetch(`http://127.0.0.1:${info.port}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined ?? {}),
      Authorization: `Bearer ${info.token}`,
      'Content-Type': 'application/json',
    },
  })
}

export const daemonApi = {
  async listWorkspaceRoots(): Promise<string[]> {
    const r = await call('/workspace-roots')
    if (!r.ok) throw new Error(`/workspace-roots failed: ${r.status}`)
    const body = await r.json() as { roots: string[] }
    return body.roots
  },
  async addWorkspaceRoot(path: string): Promise<string[]> {
    const r = await call('/workspace-roots', { method: 'POST', body: JSON.stringify({ path }) })
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`POST /workspace-roots failed (${r.status}): ${text}`)
    }
    const body = await r.json() as { roots: string[] }
    return body.roots
  },
  async removeWorkspaceRoot(path: string): Promise<string[]> {
    const r = await call('/workspace-roots', { method: 'DELETE', body: JSON.stringify({ path }) })
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`DELETE /workspace-roots failed (${r.status}): ${text}`)
    }
    const body = await r.json() as { roots: string[] }
    return body.roots
  },
}
