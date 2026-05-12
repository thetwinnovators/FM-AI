import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface DockerMCPServerConfig {
  id: string
  name: string
  image: string
  enabled: boolean
  args?: string[]
  env?: Record<string, string>
}

const DEFAULT_PATH = join(homedir(), '.flowmap', 'docker-mcp-servers.json')

export async function loadServerRegistry(
  filePath: string = DEFAULT_PATH
): Promise<DockerMCPServerConfig[]> {
  if (!existsSync(filePath)) return []
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s): s is DockerMCPServerConfig =>
        s !== null &&
        typeof s === 'object' &&
        typeof s.id === 'string' &&
        typeof s.name === 'string' &&
        typeof s.image === 'string' &&
        typeof s.enabled === 'boolean'
    )
  } catch {
    return []
  }
}
