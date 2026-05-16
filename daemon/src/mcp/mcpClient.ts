import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { Agent, fetch as undiciFetch } from 'undici'

// Custom fetch that bypasses TLS certificate verification for remote MCP servers.
// These are explicitly user-configured endpoints so skipping cert checks is safe.
const _tlsRelaxedAgent = new Agent({ connect: { rejectUnauthorized: false } })
function tlsRelaxedFetch(url: URL | RequestInfo, init?: RequestInit): Promise<Response> {
  return undiciFetch(url as string | URL, {
    ...(init as Parameters<typeof undiciFetch>[1] | undefined),
    dispatcher: _tlsRelaxedAgent,
  }) as unknown as Promise<Response>
}

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

/** Connect to a remote HTTP MCP server (streamable-http or SSE transport). */
export async function connectMCPServerHTTP(
  serverId: string,
  url: string,
  transport: 'streamable-http' | 'sse' = 'streamable-http',
): Promise<MCPClientHandle> {
  const endpoint = new URL(url)

  const t =
    transport === 'sse'
      ? new SSEClientTransport(endpoint, { fetch: tlsRelaxedFetch })
      : new StreamableHTTPClientTransport(endpoint, { fetch: tlsRelaxedFetch })

  const client = new Client(
    { name: 'flowmap-operator', version: '1.0.0' },
    { capabilities: {} },
  )

  await client.connect(t)

  return {
    serverId,

    async listTools(): Promise<MCPServerTool[]> {
      const res = await client.listTools()
      return (res.tools ?? []).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
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
