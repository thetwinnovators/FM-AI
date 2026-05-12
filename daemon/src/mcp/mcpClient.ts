import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export interface MCPServerTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface MCPClientHandle {
  serverId: string
  listTools(): Promise<MCPServerTool[]>
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
  close(): Promise<void>
}

export async function connectMCPServer(
  serverId: string,
  command: string,
  args: string[],
  env?: Record<string, string>
): Promise<MCPClientHandle> {
  // StdioClientTransport's env expects Record<string, string>. process.env may
  // contain undefined values, so filter those out when merging.
  let mergedEnv: Record<string, string> | undefined
  if (env) {
    const merged: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === 'string') merged[k] = v
    }
    Object.assign(merged, env)
    mergedEnv = merged
  }

  const transport = new StdioClientTransport({
    command,
    args,
    env: mergedEnv,
  })

  const client = new Client(
    { name: 'flowmap-operator', version: '1.0.0' },
    { capabilities: {} },
  )

  await client.connect(transport)

  return {
    serverId,

    async listTools(): Promise<MCPServerTool[]> {
      const res = await client.listTools()
      return (res.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown> | undefined,
      }))
    },

    async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
      const res = await client.callTool({ name, arguments: args })
      return (res as { content?: unknown }).content
    },

    async close(): Promise<void> {
      await client.close()
    },
  }
}
