import { connectMCPServer, MCPClientHandle, MCPServerTool } from './mcpClient.js'
import { loadServerRegistry, saveServerRegistry, DockerMCPServerConfig } from './serverRegistry.js'

export interface ManagedServer {
  config: DockerMCPServerConfig
  status: 'connected' | 'disconnected' | 'error'
  tools: MCPServerTool[]
  error?: string
}

export class ServerManager {
  private handles = new Map<string, MCPClientHandle>()
  private servers = new Map<string, ManagedServer>()
  private registryPath: string | undefined

  constructor(registryPath?: string) {
    this.registryPath = registryPath
  }

  async sync(): Promise<void> {
    const configs = await loadServerRegistry(this.registryPath)

    // Disconnect servers no longer in config
    for (const id of Array.from(this.handles.keys())) {
      if (!configs.find((c) => c.id === id)) {
        const handle = this.handles.get(id)!
        await handle.close().catch(() => {})
        this.handles.delete(id)
        this.servers.delete(id)
      }
    }

    // Connect new enabled servers, leave disabled as 'disconnected'
    for (const cfg of configs) {
      if (!cfg.enabled) {
        // If we previously had a connection, close it
        const existing = this.handles.get(cfg.id)
        if (existing) {
          await existing.close().catch(() => {})
          this.handles.delete(cfg.id)
        }
        this.servers.set(cfg.id, { config: cfg, status: 'disconnected', tools: [] })
        continue
      }

      // Already connected — skip
      if (this.handles.has(cfg.id)) continue

      try {
        const dockerArgs = ['run', '--rm', '-i']
        for (const [k, v] of Object.entries(cfg.env ?? {})) {
          dockerArgs.push('-e', `${k}=${v}`)
        }
        dockerArgs.push(cfg.image, ...(cfg.args ?? []))
        const handle = await connectMCPServer(cfg.id, 'docker', dockerArgs)
        const tools = await handle.listTools()
        this.handles.set(cfg.id, handle)
        this.servers.set(cfg.id, { config: cfg, status: 'connected', tools })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        this.servers.set(cfg.id, {
          config: cfg,
          status: 'error',
          tools: [],
          error: message,
        })
      }
    }
  }

  listServers(): ManagedServer[] {
    return Array.from(this.servers.values())
  }

  getHandle(serverId: string): MCPClientHandle | undefined {
    return this.handles.get(serverId)
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const handle = this.handles.get(serverId)
    if (!handle) throw new Error(`adapter_failure: MCP server ${serverId} not connected`)
    return handle.callTool(toolName, args)
  }

  async addServer(cfg: DockerMCPServerConfig): Promise<void> {
    const configs = await loadServerRegistry(this.registryPath)
    if (configs.find((c) => c.id === cfg.id)) throw new Error(`Server "${cfg.id}" already exists`)
    configs.push(cfg)
    await saveServerRegistry(configs, this.registryPath)
    await this.sync()
  }

  async patchServer(id: string, patch: Partial<DockerMCPServerConfig>): Promise<void> {
    const configs = await loadServerRegistry(this.registryPath)
    const idx = configs.findIndex((c) => c.id === id)
    if (idx === -1) throw new Error(`Server "${id}" not found`)
    configs[idx] = { ...configs[idx], ...patch, id }
    await saveServerRegistry(configs, this.registryPath)
    await this.sync()
  }

  async removeServer(id: string): Promise<void> {
    const configs = await loadServerRegistry(this.registryPath)
    const next = configs.filter((c) => c.id !== id)
    if (next.length === configs.length) throw new Error(`Server "${id}" not found`)
    await saveServerRegistry(next, this.registryPath)
    await this.sync()
  }

  async shutdown(): Promise<void> {
    for (const handle of this.handles.values()) {
      await handle.close().catch(() => {})
    }
    this.handles.clear()
  }
}
