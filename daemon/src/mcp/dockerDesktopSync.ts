/**
 * Reads the Docker Desktop MCP Toolkit SQLite database and converts a named
 * profile into FlowMap DockerMCPServerConfig objects.
 *
 * Both server types are handled:
 *   image  — run via `docker run --rm -i <image>` (stdio transport)
 *   remote — proxied via HTTP (streamable-http or SSE transport)
 */
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import type { DockerMCPServerConfig } from './serverRegistry.js'

const DOCKER_MCP_DB = join(homedir(), '.docker', 'mcp', 'mcp-toolkit.db')

export function dockerDesktopDbExists(): boolean {
  return existsSync(DOCKER_MCP_DB)
}

interface RawServer {
  type: 'image' | 'remote'
  endpoint?: string
  image?: string
  snapshot?: {
    server?: {
      name?: string
      title?: string
      image?: string
      remote?: { url?: string; transport_type?: string }
    }
  }
}

/**
 * Read the given Docker Desktop MCP profile and return server configs ready to
 * merge into the FlowMap server registry.  Skips servers with no image and no
 * remote URL so the caller never receives invalid entries.
 */
export function syncFromDockerDesktop(profileId = 'flowmap'): DockerMCPServerConfig[] {
  if (!existsSync(DOCKER_MCP_DB)) {
    throw new Error(
      `Docker Desktop MCP Toolkit database not found at ${DOCKER_MCP_DB}. ` +
      `Make sure Docker Desktop is installed and the MCP Toolkit has been opened at least once.`,
    )
  }

  const db = new Database(DOCKER_MCP_DB, { readonly: true, fileMustExist: true })
  try {
    const row = db
      .prepare('SELECT servers FROM working_set WHERE id = ?')
      .get(profileId) as { servers: string } | undefined

    if (!row) {
      throw new Error(
        `Docker Desktop MCP profile "${profileId}" not found. ` +
        `Open Docker Desktop → MCP Toolkit and create a profile named "${profileId}".`,
      )
    }

    const servers: RawServer[] = JSON.parse(row.servers)
    const configs: DockerMCPServerConfig[] = []

    for (const s of servers) {
      const snap = s.snapshot?.server ?? {}
      const id = snap.name
      const name = snap.title ?? snap.name ?? ''
      if (!id) continue

      if (s.type === 'image') {
        const image = snap.image ?? s.image ?? ''
        if (!image) continue
        configs.push({ id, name, image, enabled: true })
      } else if (s.type === 'remote') {
        const remote = snap.remote
        const url = remote?.url ?? s.endpoint ?? ''
        if (!url) continue
        const transport: 'streamable-http' | 'sse' =
          remote?.transport_type === 'sse' ? 'sse' : 'streamable-http'
        configs.push({ id, name, image: '', url, transport, enabled: true })
      }
    }

    return configs
  } finally {
    db.close()
  }
}
