import { schemas } from './schemas.js'
import { createFileAdapter } from '../adapters/fileAdapter.js'
import { createShellAdapter } from '../adapters/shellAdapter.js'
import { createBrowserAdapter, BrowserAdapter } from '../adapters/browserAdapter.js'
import { createGitAdapter } from '../adapters/gitAdapter.js'
import { createNodeSandboxAdapter } from '../adapters/nodeSandboxAdapter.js'
import { ServerManager } from '../mcp/serverManager.js'
import type { ToolDefinition, ToolHandler, ToolHandlerContext, RiskLevel, CapabilityGroup } from '../types.js'

const TOOL_META: Record<string, { displayName: string; description: string; risk: RiskLevel; group: CapabilityGroup }> = {
  'file.read':           { displayName: 'Read file',         description: 'Read text contents of a file', risk: 'read', group: 'file' },
  'file.list':           { displayName: 'List directory',    description: 'List entries in a directory',  risk: 'read', group: 'file' },
  'file.exists':         { displayName: 'Check file exists', description: 'Check whether a path exists',  risk: 'read', group: 'file' },
  'file.write':          { displayName: 'Write file',        description: 'Write or append text to a file', risk: 'write', group: 'file' },
  'file.delete':         { displayName: 'Delete file',       description: 'Delete a file or directory',   risk: 'publish', group: 'file' },
  'system.exec':         { displayName: 'Run allowlisted command', description: 'Run an allowlisted binary with args', risk: 'write', group: 'system' },
  'system.exec_inline':  { displayName: 'Run inline script', description: 'Run an arbitrary shell script (approval required)', risk: 'publish', group: 'system' },
  'browser.open':        { displayName: 'Open browser',      description: 'Start a new browser session',   risk: 'read', group: 'browser' },
  'browser.navigate':    { displayName: 'Navigate browser',  description: 'Navigate to a URL',             risk: 'read', group: 'browser' },
  'browser.screenshot':  { displayName: 'Take screenshot',   description: 'Capture page or element as PNG', risk: 'read', group: 'browser' },
  'browser.extract':     { displayName: 'Extract DOM data',  description: 'Read text/html/attrs from elements', risk: 'read', group: 'browser' },
  'browser.evaluate':    { displayName: 'Evaluate JS',       description: 'Run JS in the page context',    risk: 'write', group: 'browser' },
  'browser.click':       { displayName: 'Click element',     description: 'Click an element by selector',   risk: 'write', group: 'browser' },
  'browser.fill':        { displayName: 'Fill input',        description: 'Fill an input field',           risk: 'write', group: 'browser' },
  'browser.close':       { displayName: 'Close browser',     description: 'Close a browser session',       risk: 'read', group: 'browser' },
  'git.status':  { displayName: 'Git status',  description: 'Get working directory status',      risk: 'read',  group: 'git' },
  'git.log':     { displayName: 'Git log',     description: 'Get recent commit history',         risk: 'read',  group: 'git' },
  'git.diff':    { displayName: 'Git diff',    description: 'Show unstaged or staged changes',   risk: 'read',  group: 'git' },
  'git.add':     { displayName: 'Git add',     description: 'Stage files for commit',            risk: 'write', group: 'git' },
  'git.commit':  { displayName: 'Git commit',  description: 'Commit staged changes',             risk: 'write', group: 'git' },
  'code.run_js': { displayName: 'Run Node.js', description: 'Execute JavaScript in a Node.js sandbox', risk: 'publish', group: 'code' },
}

export interface RegistryOptions {
  getAllowedRoots: () => string[]
  commandAllowlist: string[]
  screenshotsDir: string
  mcpManager?: ServerManager
}

export interface ToolRegistry {
  list(): ToolDefinition[]
  run(toolId: string, params: unknown, ctx: ToolHandlerContext): Promise<unknown>
  shutdown(): Promise<void>
}

export function buildRegistry(opts: RegistryOptions): ToolRegistry {
  const file = createFileAdapter({ getAllowedRoots: opts.getAllowedRoots })
  const shell = createShellAdapter({ allowlist: opts.commandAllowlist })
  const browser: BrowserAdapter = createBrowserAdapter()
  const gitAdapt = createGitAdapter({ getAllowedRoots: opts.getAllowedRoots })
  const nodeSandbox = createNodeSandboxAdapter()

  const handlers: Record<string, ToolHandler> = {
    'file.read':           async (p) => file.read(p as any),
    'file.list':           async (p) => file.list(p as any),
    'file.exists':         async (p) => file.exists(p as any),
    'file.write':          async (p) => file.write(p as any),
    'file.delete':         async (p) => file.delete(p as any),
    'system.exec':         async (p) => shell.run(p as any),
    'system.exec_inline':  async () => { throw new Error('adapter_failure: exec_inline not implemented in Phase 1') },
    'browser.open':        async (p) => browser.open(p as any),
    'browser.navigate':    async (p) => browser.navigate(p as any),
    'browser.screenshot':  async (p, ctx) => browser.screenshot({ ...(p as any), screenshotsDir: opts.screenshotsDir, jobId: ctx.jobId }),
    'browser.extract':     async (p) => browser.extract(p as any),
    'browser.evaluate':    async (p) => browser.evaluate(p as any),
    'browser.click':       async (p) => browser.click(p as any),
    'browser.fill':        async (p) => browser.fill(p as any),
    'browser.close':       async (p) => browser.close(p as any),
    'git.status':  async (p) => gitAdapt.status(p as any),
    'git.log':     async (p) => gitAdapt.log(p as any),
    'git.diff':    async (p) => gitAdapt.diff(p as any),
    'git.add':     async (p) => gitAdapt.add(p as any),
    'git.commit':  async (p) => gitAdapt.commit(p as any),
    'code.run_js': async (p) => nodeSandbox.runJs(p as any),
  }

  return {
    list(): ToolDefinition[] {
      return Object.keys(TOOL_META).map((id) => ({
        id,
        displayName: TOOL_META[id]!.displayName,
        description: TOOL_META[id]!.description,
        risk: TOOL_META[id]!.risk,
        group: TOOL_META[id]!.group,
        paramsSchema: null,
      }))
    },

    async run(toolId: string, params: unknown, ctx: ToolHandlerContext): Promise<unknown> {
      // Docker MCP tool — delegate to ServerManager
      if (toolId.startsWith('docker_mcp::')) {
        if (!opts.mcpManager) throw new Error('adapter_failure: docker-mcp not configured')
        const parts = toolId.split('::')
        if (parts.length !== 3) throw new Error(`validation_failed: malformed tool id: ${toolId}`)
        const [, serverId, toolName] = parts as [string, string, string]
        return opts.mcpManager.callTool(serverId, toolName, params as Record<string, unknown>)
      }
      const handler = handlers[toolId]
      if (!handler) throw new Error(`unknown tool: ${toolId}`)
      const schema = schemas[toolId]
      if (!schema) throw new Error(`schema missing for tool: ${toolId}`)
      const parsed = schema.safeParse(params)
      if (!parsed.success) {
        throw new Error(`validation_failed: ${parsed.error.message}`)
      }
      return handler(parsed.data, ctx)
    },

    async shutdown(): Promise<void> {
      await browser.shutdown()
    },
  }
}
