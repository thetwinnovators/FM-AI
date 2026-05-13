# Operator Phase 2 — AI Coding + Terminal Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the FlowMap Operator with two capability modules — AI Coding (git adapter + Node sandbox + Docker MCP context servers) and Terminal Control (Docker MCP shell/filesystem servers) — and add dedicated views for both.

**Architecture:** The daemon gains a git adapter, a Node.js sandbox adapter, and a Docker MCP bridge that can spawn/connect MCP servers as Docker containers via stdio. The frontend gets a new `'docker-mcp'` integration type, a matching provider, two new views (`/operator/coding` and `/operator/terminal`), and LeftRail navigation links.

**Tech Stack:** TypeScript ESM (daemon), simple-git, @modelcontextprotocol/sdk, React/JSX (frontend), Tailwind CSS, Vite lazy routes, Vitest

---

## File Map

**Create:**
- `daemon/src/adapters/gitAdapter.ts` — git.* tool implementations via simple-git
- `daemon/src/adapters/nodeSandboxAdapter.ts` — code.run_js via child_process
- `daemon/src/mcp/mcpClient.ts` — thin wrapper around @modelcontextprotocol/sdk Client
- `daemon/src/mcp/serverRegistry.ts` — loads ~/.flowmap/docker-mcp-servers.json
- `daemon/src/mcp/serverManager.ts` — manages live MCP connections, tool dispatch
- `src/mcp/providers/dockerMCPProvider.ts` — frontend provider for 'docker-mcp' integration
- `src/views/OperatorWorkspace.jsx` — hub page at /operator
- `src/views/AICodingView.jsx` — AI coding workspace at /operator/coding
- `src/views/TerminalControlView.jsx` — terminal control workspace at /operator/terminal

**Modify:**
- `daemon/package.json` — add simple-git, @modelcontextprotocol/sdk
- `daemon/src/types.ts` — add CapabilityGroup, extend ToolDefinition with group
- `daemon/src/tools/schemas.ts` — add git.* and code.run_js schemas
- `daemon/src/tools/registry.ts` — add git.* + code.run_js to TOOL_META + handlers; include group in list()
- `daemon/src/server.ts` — init ServerManager; add GET /docker-mcp/servers, POST /docker-mcp/sync
- `src/mcp/types.ts` — add 'docker-mcp' to IntegrationType; add capabilityGroup + toolSource to MCPToolDefinition
- `src/mcp/storage/localMCPStorage.ts` — add seed integration for docker-mcp
- `src/mcp/providers/localProvider.ts` — forward group as capabilityGroup from daemon /tools
- `src/mcp/services/mcpToolRegistry.ts` — register dockerMCPProvider for 'docker-mcp'
- `src/App.jsx` — add /operator, /operator/coding, /operator/terminal routes
- `src/components/layout/LeftRail.jsx` — add Operator section with AI Coding + Terminal links
- `src/mcp/pages/MCPToolCatalogPage.tsx` — add capability group filter tabs

---

## Task 1: Daemon — CapabilityGroup type + group field

**Files:**
- Modify: `daemon/src/types.ts`
- Modify: `daemon/src/tools/registry.ts`
- Test: `daemon/src/tools/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `daemon/src/tools/registry.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildRegistry } from './registry.js'

describe('registry list()', () => {
  const reg = buildRegistry({
    allowedRoots: ['/tmp'],
    commandAllowlist: [],
    screenshotsDir: '/tmp',
  })

  it('includes group field on every tool', () => {
    const tools = reg.list()
    expect(tools.length).toBeGreaterThan(0)
    for (const t of tools) {
      expect(t.group, `tool ${t.id} missing group`).toBeDefined()
      expect(['file', 'system', 'browser', 'git', 'code', 'docker_mcp']).toContain(t.group)
    }
  })

  it('file.read is in file group', () => {
    const t = reg.list().find((x) => x.id === 'file.read')!
    expect(t.group).toBe('file')
  })

  it('system.exec is in system group', () => {
    const t = reg.list().find((x) => x.id === 'system.exec')!
    expect(t.group).toBe('system')
  })

  it('browser.open is in browser group', () => {
    const t = reg.list().find((x) => x.id === 'browser.open')!
    expect(t.group).toBe('browser')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
cd daemon && npx vitest run src/tools/registry.test.ts
```
Expected: FAIL — `t.group` is undefined

- [ ] **Step 3: Add CapabilityGroup to daemon/src/types.ts**

Add after the `RiskLevel` line (line 1):

```typescript
export type CapabilityGroup = 'file' | 'system' | 'browser' | 'git' | 'code' | 'docker_mcp'
```

Add `group` field to `ToolDefinition` (after `paramsSchema`):

```typescript
export interface ToolDefinition {
  id: string
  displayName: string
  description: string
  risk: RiskLevel
  group: CapabilityGroup
  paramsSchema: unknown
}
```

- [ ] **Step 4: Update TOOL_META in daemon/src/tools/registry.ts**

Import the type and add `group` field to TOOL_META:

```typescript
import type { ToolDefinition, ToolHandler, ToolHandlerContext, RiskLevel, CapabilityGroup } from '../types.js'

const TOOL_META: Record<string, { displayName: string; description: string; risk: RiskLevel; group: CapabilityGroup }> = {
  'file.read':           { displayName: 'Read file',              description: 'Read text contents of a file',           risk: 'read',    group: 'file'    },
  'file.list':           { displayName: 'List directory',         description: 'List entries in a directory',            risk: 'read',    group: 'file'    },
  'file.exists':         { displayName: 'Check file exists',      description: 'Check whether a path exists',            risk: 'read',    group: 'file'    },
  'file.write':          { displayName: 'Write file',             description: 'Write or append text to a file',         risk: 'write',   group: 'file'    },
  'file.delete':         { displayName: 'Delete file',            description: 'Delete a file or directory',             risk: 'publish', group: 'file'    },
  'system.exec':         { displayName: 'Run allowlisted command', description: 'Run an allowlisted binary with args',   risk: 'write',   group: 'system'  },
  'system.exec_inline':  { displayName: 'Run inline script',      description: 'Run an arbitrary shell script',          risk: 'publish', group: 'system'  },
  'browser.open':        { displayName: 'Open browser',           description: 'Start a new browser session',            risk: 'read',    group: 'browser' },
  'browser.navigate':    { displayName: 'Navigate browser',       description: 'Navigate to a URL',                      risk: 'read',    group: 'browser' },
  'browser.screenshot':  { displayName: 'Take screenshot',        description: 'Capture page or element as PNG',         risk: 'read',    group: 'browser' },
  'browser.extract':     { displayName: 'Extract DOM data',       description: 'Read text/html/attrs from elements',     risk: 'read',    group: 'browser' },
  'browser.evaluate':    { displayName: 'Evaluate JS',            description: 'Run JS in the page context',             risk: 'write',   group: 'browser' },
  'browser.click':       { displayName: 'Click element',          description: 'Click an element by selector',           risk: 'write',   group: 'browser' },
  'browser.fill':        { displayName: 'Fill input',             description: 'Fill an input field',                    risk: 'write',   group: 'browser' },
  'browser.close':       { displayName: 'Close browser',          description: 'Close a browser session',                risk: 'read',    group: 'browser' },
}
```

- [ ] **Step 5: Update list() in buildRegistry to include group**

```typescript
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
```

- [ ] **Step 6: Run test to verify it passes**

```
cd daemon && npx vitest run src/tools/registry.test.ts
```
Expected: PASS — 3 tests passing

- [ ] **Step 7: Commit**

```
git add daemon/src/types.ts daemon/src/tools/registry.ts daemon/src/tools/registry.test.ts
git commit -m "feat(daemon): add CapabilityGroup type and group field to ToolDefinition"
```

---

## Task 2: Daemon — Install new dependencies

**Files:**
- Modify: `daemon/package.json`

- [ ] **Step 1: Install simple-git and MCP SDK**

```
cd daemon && npm install simple-git @modelcontextprotocol/sdk
```

- [ ] **Step 2: Verify packages appear in daemon/package.json**

```
cd daemon && node -e "import('simple-git').then(m => console.log('simple-git ok', typeof m.default))"
```
Expected: `simple-git ok function`

```
cd daemon && node -e "import('@modelcontextprotocol/sdk/client/index.js').then(m => console.log('mcp sdk ok', typeof m.Client))"
```
Expected: `mcp sdk ok function`

- [ ] **Step 3: Commit**

```
git add daemon/package.json daemon/package-lock.json
git commit -m "chore(daemon): add simple-git and @modelcontextprotocol/sdk dependencies"
```

---

## Task 3: Daemon — Git adapter

**Files:**
- Create: `daemon/src/adapters/gitAdapter.ts`
- Modify: `daemon/src/tools/schemas.ts`
- Modify: `daemon/src/tools/registry.ts`
- Test: `daemon/src/adapters/gitAdapter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `daemon/src/adapters/gitAdapter.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execa } from 'execa'
import { createGitAdapter } from './gitAdapter.js'

// Bootstrap a real git repo for testing
async function makeTestRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'git-adapter-test-'))
  await execa('git', ['init', '--initial-branch=main'], { cwd: dir })
  await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: dir })
  await execa('git', ['config', 'user.name', 'Test'], { cwd: dir })
  await writeFile(join(dir, 'hello.txt'), 'hello')
  await execa('git', ['add', '.'], { cwd: dir })
  await execa('git', ['commit', '-m', 'initial'], { cwd: dir })
  return dir
}

describe('gitAdapter', () => {
  let dir: string
  let adapter: ReturnType<typeof createGitAdapter>

  beforeAll(async () => {
    dir = await makeTestRepo()
    adapter = createGitAdapter({ allowedRoots: [dir] })
  })

  it('git.status returns clean on committed repo', async () => {
    const r = await adapter.status({ repoPath: dir })
    expect(r.isClean).toBe(true)
    expect(r.files).toHaveLength(0)
  })

  it('git.log returns at least one commit', async () => {
    const r = await adapter.log({ repoPath: dir, maxCount: 5 })
    expect(r.commits.length).toBeGreaterThanOrEqual(1)
    expect(r.commits[0]!.message).toContain('initial')
  })

  it('git.diff returns empty on clean repo', async () => {
    const r = await adapter.diff({ repoPath: dir })
    expect(r.diff).toBe('')
  })

  it('git.status detects modified file', async () => {
    await writeFile(join(dir, 'hello.txt'), 'modified')
    const r = await adapter.status({ repoPath: dir })
    expect(r.isClean).toBe(false)
    expect(r.files.some((f: any) => f.path === 'hello.txt')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
cd daemon && npx vitest run src/adapters/gitAdapter.test.ts
```
Expected: FAIL — `createGitAdapter` not found

- [ ] **Step 3: Create daemon/src/adapters/gitAdapter.ts**

```typescript
import simpleGit from 'simple-git'
import { isPathAllowed } from '../sandbox/pathPolicy.js'

export interface GitAdapterOptions {
  allowedRoots: string[]
}

function assertAllowed(path: string, roots: string[]): string {
  const r = isPathAllowed(path, roots)
  if (!r.ok) throw new Error(`sandbox_violation: ${r.reason}`)
  return r.resolvedPath ?? path
}

export function createGitAdapter(opts: GitAdapterOptions) {
  const { allowedRoots } = opts

  return {
    async status(params: { repoPath: string }) {
      const resolved = assertAllowed(params.repoPath, allowedRoots)
      const git = simpleGit(resolved)
      const s = await git.status()
      return {
        isClean: s.isClean(),
        branch: s.current,
        files: s.files.map((f) => ({ path: f.path, index: f.index, working_dir: f.working_dir })),
        ahead: s.ahead,
        behind: s.behind,
      }
    },

    async log(params: { repoPath: string; maxCount?: number }) {
      const resolved = assertAllowed(params.repoPath, allowedRoots)
      const git = simpleGit(resolved)
      const log = await git.log({ maxCount: params.maxCount ?? 10 })
      return {
        commits: log.all.map((c) => ({
          hash: c.hash.slice(0, 8),
          date: c.date,
          message: c.message,
          author: c.author_name,
        })),
      }
    },

    async diff(params: { repoPath: string; staged?: boolean }) {
      const resolved = assertAllowed(params.repoPath, allowedRoots)
      const git = simpleGit(resolved)
      const diff = params.staged
        ? await git.diff(['--staged'])
        : await git.diff()
      return { diff }
    },

    async add(params: { repoPath: string; files: string[] }) {
      const resolved = assertAllowed(params.repoPath, allowedRoots)
      const git = simpleGit(resolved)
      await git.add(params.files)
      return { staged: params.files }
    },

    async commit(params: { repoPath: string; message: string }) {
      const resolved = assertAllowed(params.repoPath, allowedRoots)
      const git = simpleGit(resolved)
      const result = await git.commit(params.message)
      return {
        hash: result.commit.slice(0, 8),
        summary: result.summary,
      }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Note: The test uses `execa` for git init. If not installed, add it: `npm install -D execa` in the daemon directory. Then:

```
cd daemon && npx vitest run src/adapters/gitAdapter.test.ts
```
Expected: PASS — 4 tests passing

- [ ] **Step 5: Add git.* schemas to daemon/src/tools/schemas.ts**

Append to the `schemas` object at the end of the file:

```typescript
  'git.status': z.object({
    repoPath: NonEmptyString,
  }).strict(),

  'git.log': z.object({
    repoPath: NonEmptyString,
    maxCount: z.number().int().positive().max(100).optional(),
  }).strict(),

  'git.diff': z.object({
    repoPath: NonEmptyString,
    staged: z.boolean().optional(),
  }).strict(),

  'git.add': z.object({
    repoPath: NonEmptyString,
    files: z.array(NonEmptyString).min(1),
  }).strict(),

  'git.commit': z.object({
    repoPath: NonEmptyString,
    message: NonEmptyString,
  }).strict(),
```

- [ ] **Step 6: Register git.* in daemon/src/tools/registry.ts**

In `TOOL_META`, add:

```typescript
  'git.status':  { displayName: 'Git status',  description: 'Get working directory status',      risk: 'read',  group: 'git' },
  'git.log':     { displayName: 'Git log',      description: 'Get recent commit history',         risk: 'read',  group: 'git' },
  'git.diff':    { displayName: 'Git diff',     description: 'Show unstaged or staged changes',   risk: 'read',  group: 'git' },
  'git.add':     { displayName: 'Git add',      description: 'Stage files for commit',            risk: 'write', group: 'git' },
  'git.commit':  { displayName: 'Git commit',   description: 'Commit staged changes',             risk: 'write', group: 'git' },
```

In `buildRegistry`, add to the imports and initialization:

```typescript
import { createGitAdapter } from '../adapters/gitAdapter.js'
```

In `buildRegistry` body (after `const browser`):
```typescript
const gitAdapt = createGitAdapter({ allowedRoots: opts.allowedRoots })
```

In `handlers`, add:
```typescript
    'git.status':  async (p) => gitAdapt.status(p as any),
    'git.log':     async (p) => gitAdapt.log(p as any),
    'git.diff':    async (p) => gitAdapt.diff(p as any),
    'git.add':     async (p) => gitAdapt.add(p as any),
    'git.commit':  async (p) => gitAdapt.commit(p as any),
```

- [ ] **Step 7: Run registry test to verify all tools still pass + git tools appear**

```
cd daemon && npx vitest run src/tools/registry.test.ts
```
Expected: PASS — all tests passing, including new git tools in list

- [ ] **Step 8: Commit**

```
git add daemon/src/adapters/gitAdapter.ts daemon/src/adapters/gitAdapter.test.ts daemon/src/tools/schemas.ts daemon/src/tools/registry.ts
git commit -m "feat(daemon): add git adapter with status/log/diff/add/commit tools"
```

---

## Task 4: Daemon — Node.js sandbox adapter

**Files:**
- Create: `daemon/src/adapters/nodeSandboxAdapter.ts`
- Modify: `daemon/src/tools/schemas.ts`
- Modify: `daemon/src/tools/registry.ts`
- Test: `daemon/src/adapters/nodeSandboxAdapter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `daemon/src/adapters/nodeSandboxAdapter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createNodeSandboxAdapter } from './nodeSandboxAdapter.js'

const adapter = createNodeSandboxAdapter({ timeoutMs: 5000 })

describe('nodeSandboxAdapter', () => {
  it('runs simple expression', async () => {
    const r = await adapter.runJs({ code: 'console.log(2 + 2)' })
    expect(r.stdout.trim()).toBe('4')
    expect(r.exitCode).toBe(0)
  })

  it('captures stderr', async () => {
    const r = await adapter.runJs({ code: 'process.stderr.write("err\\n")' })
    expect(r.stderr.trim()).toBe('err')
  })

  it('returns non-zero exit code on throw', async () => {
    const r = await adapter.runJs({ code: 'throw new Error("boom")' })
    expect(r.exitCode).not.toBe(0)
    expect(r.stderr).toContain('boom')
  })

  it('times out long-running code', async () => {
    const adapter2 = createNodeSandboxAdapter({ timeoutMs: 200 })
    const r = await adapter2.runJs({ code: 'while(true){}' })
    expect(r.timedOut).toBe(true)
    expect(r.exitCode).not.toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
cd daemon && npx vitest run src/adapters/nodeSandboxAdapter.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Create daemon/src/adapters/nodeSandboxAdapter.ts**

```typescript
import { spawn } from 'node:child_process'

export interface NodeSandboxOptions {
  timeoutMs?: number
}

export function createNodeSandboxAdapter(opts: NodeSandboxOptions = {}) {
  const defaultTimeout = opts.timeoutMs ?? 30_000

  return {
    async runJs(params: { code: string; timeoutMs?: number }) {
      const timeout = params.timeoutMs ?? defaultTimeout
      return new Promise<{
        stdout: string
        stderr: string
        exitCode: number
        timedOut: boolean
      }>((resolve) => {
        let stdout = ''
        let stderr = ''
        let timedOut = false

        const child = spawn(process.execPath, ['-e', params.code], {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout,
        })

        child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
        child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

        const timer = setTimeout(() => {
          timedOut = true
          child.kill('SIGKILL')
        }, timeout)

        child.on('close', (code) => {
          clearTimeout(timer)
          resolve({ stdout, stderr, exitCode: code ?? 1, timedOut })
        })
      })
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd daemon && npx vitest run src/adapters/nodeSandboxAdapter.test.ts
```
Expected: PASS — 4 tests passing

- [ ] **Step 5: Add code.run_js schema to daemon/src/tools/schemas.ts**

```typescript
  'code.run_js': z.object({
    code: NonEmptyString,
    timeoutMs: z.number().int().positive().max(60_000).optional(),
  }).strict(),
```

- [ ] **Step 6: Register code.run_js in daemon/src/tools/registry.ts**

In `TOOL_META`, add:
```typescript
  'code.run_js': { displayName: 'Run Node.js', description: 'Execute JavaScript in a Node.js sandbox', risk: 'publish', group: 'code' },
```

Import and initialize in `buildRegistry`:
```typescript
import { createNodeSandboxAdapter } from '../adapters/nodeSandboxAdapter.js'
```

In `buildRegistry` body:
```typescript
const nodeSandbox = createNodeSandboxAdapter()
```

In `handlers`:
```typescript
    'code.run_js': async (p) => nodeSandbox.runJs(p as any),
```

- [ ] **Step 7: Run registry test again**

```
cd daemon && npx vitest run src/tools/registry.test.ts
```
Expected: PASS — code.run_js appears in tool list with group 'code'

- [ ] **Step 8: Commit**

```
git add daemon/src/adapters/nodeSandboxAdapter.ts daemon/src/adapters/nodeSandboxAdapter.test.ts daemon/src/tools/schemas.ts daemon/src/tools/registry.ts
git commit -m "feat(daemon): add code.run_js Node.js sandbox adapter"
```

---

## Task 5: Daemon — Docker MCP bridge

**Files:**
- Create: `daemon/src/mcp/mcpClient.ts`
- Create: `daemon/src/mcp/serverRegistry.ts`
- Create: `daemon/src/mcp/serverManager.ts`
- Test: `daemon/src/mcp/serverRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `daemon/src/mcp/serverRegistry.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadServerRegistry } from './serverRegistry.js'

let tmpDir: string
beforeAll(async () => { tmpDir = await mkdtemp(join(tmpdir(), 'mcp-reg-test-')) })
afterAll(async () => { await rm(tmpDir, { recursive: true, force: true }) })

describe('loadServerRegistry', () => {
  it('returns empty array when file missing', async () => {
    const servers = await loadServerRegistry(join(tmpDir, 'nonexistent.json'))
    expect(servers).toEqual([])
  })

  it('parses valid server list', async () => {
    const cfg = [
      { id: 'context7', name: 'Context7', image: 'context7/mcp:latest', enabled: true },
      { id: 'filesystem', name: 'Filesystem', image: 'mcp/filesystem:latest', enabled: false },
    ]
    const file = join(tmpDir, 'servers.json')
    await writeFile(file, JSON.stringify(cfg))
    const servers = await loadServerRegistry(file)
    expect(servers).toHaveLength(2)
    expect(servers[0]!.id).toBe('context7')
    expect(servers[1]!.enabled).toBe(false)
  })

  it('filters out entries missing required fields', async () => {
    const cfg = [
      { id: 'ok', name: 'OK', image: 'foo:latest', enabled: true },
      { name: 'Missing ID', image: 'bar:latest', enabled: true },
    ]
    const file = join(tmpDir, 'bad.json')
    await writeFile(file, JSON.stringify(cfg))
    const servers = await loadServerRegistry(file)
    expect(servers).toHaveLength(1)
    expect(servers[0]!.id).toBe('ok')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
cd daemon && npx vitest run src/mcp/serverRegistry.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Create daemon/src/mcp/serverRegistry.ts**

```typescript
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
        typeof s === 'object' &&
        typeof s.id === 'string' &&
        typeof s.name === 'string' &&
        typeof s.image === 'string'
    )
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd daemon && npx vitest run src/mcp/serverRegistry.test.ts
```
Expected: PASS — 3 tests passing

- [ ] **Step 5: Create daemon/src/mcp/mcpClient.ts**

```typescript
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
  const transport = new StdioClientTransport({
    command,
    args,
    env: env ? { ...process.env, ...env } as NodeJS.ProcessEnv : undefined,
  })

  const client = new Client({ name: 'flowmap-operator', version: '1.0.0' }, {
    capabilities: { tools: {} },
  })

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
      return res.content
    },

    async close(): Promise<void> {
      await client.close()
    },
  }
}
```

- [ ] **Step 6: Create daemon/src/mcp/serverManager.ts**

```typescript
import { connectMCPServer, MCPClientHandle, MCPServerTool } from './mcpClient.js'
import { loadServerRegistry, DockerMCPServerConfig } from './serverRegistry.js'

export interface ManagedServer {
  config: DockerMCPServerConfig
  status: 'connected' | 'disconnected' | 'error'
  tools: MCPServerTool[]
  error?: string
}

export class ServerManager {
  private handles = new Map<string, MCPClientHandle>()
  private servers = new Map<string, ManagedServer>()
  private registryPath: string

  constructor(registryPath?: string) {
    this.registryPath = registryPath ?? ''
  }

  async sync(): Promise<void> {
    const configs = await loadServerRegistry(this.registryPath || undefined)

    // Disconnect servers no longer in config
    for (const [id, handle] of this.handles) {
      if (!configs.find((c) => c.id === id)) {
        await handle.close().catch(() => {})
        this.handles.delete(id)
        this.servers.delete(id)
      }
    }

    // Connect new enabled servers
    for (const cfg of configs) {
      if (!cfg.enabled) {
        this.servers.set(cfg.id, { config: cfg, status: 'disconnected', tools: [] })
        continue
      }
      if (this.handles.has(cfg.id)) continue

      try {
        const handle = await connectMCPServer(
          cfg.id,
          'docker',
          ['run', '--rm', '-i', ...Object.entries(cfg.env ?? {}).flatMap(([k, v]) => ['-e', `${k}=${v}`]), cfg.image, ...(cfg.args ?? [])],
        )
        const tools = await handle.listTools()
        this.handles.set(cfg.id, handle)
        this.servers.set(cfg.id, { config: cfg, status: 'connected', tools })
      } catch (err: any) {
        this.servers.set(cfg.id, {
          config: cfg,
          status: 'error',
          tools: [],
          error: err?.message ?? String(err),
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

  async shutdown(): Promise<void> {
    for (const handle of this.handles.values()) {
      await handle.close().catch(() => {})
    }
    this.handles.clear()
  }
}
```

- [ ] **Step 7: Commit**

```
git add daemon/src/mcp/mcpClient.ts daemon/src/mcp/serverRegistry.ts daemon/src/mcp/serverManager.ts daemon/src/mcp/serverRegistry.test.ts
git commit -m "feat(daemon): add Docker MCP bridge — client, serverRegistry, serverManager"
```

---

## Task 6: Daemon — Docker MCP endpoints in server.ts

**Files:**
- Modify: `daemon/src/server.ts`
- Test: (manual curl test, no unit test — integration test would require Docker)

- [ ] **Step 1: Import ServerManager and extend ServerOptions**

At the top of `daemon/src/server.ts`, add:

```typescript
import { ServerManager } from './mcp/serverManager.js'
```

Extend `ServerOptions`:

```typescript
export interface ServerOptions {
  token: string
  allowedRoots: string[]
  commandAllowlist: string[]
  screenshotsDir: string
  dbPath: string
  mcpRegistryPath?: string  // path to docker-mcp-servers.json
}
```

- [ ] **Step 2: Initialize ServerManager in buildServer**

After the `const registry` line in `buildServer`:

```typescript
  const mcpManager = new ServerManager(opts.mcpRegistryPath)
  // Sync eagerly but don't block server startup — Docker may be slow
  mcpManager.sync().catch((err) => {
    console.warn('docker-mcp initial sync failed:', err?.message)
  })
```

- [ ] **Step 3: Add GET /docker-mcp/servers endpoint**

After the existing `/tools` endpoint:

```typescript
  app.get('/docker-mcp/servers', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    return { servers: mcpManager.listServers() }
  })
```

- [ ] **Step 4: Add POST /docker-mcp/sync endpoint**

```typescript
  app.post('/docker-mcp/sync', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    try {
      await mcpManager.sync()
      return { servers: mcpManager.listServers() }
    } catch (err: any) {
      reply.code(500)
      return { error: err?.message ?? String(err) }
    }
  })
```

- [ ] **Step 5: Shutdown ServerManager in onClose hook**

Replace the existing `onClose` hook:

```typescript
  app.addHook('onClose', async () => {
    await registry.shutdown()
    await mcpManager.shutdown()
  })
```

- [ ] **Step 6: Pass mcpRegistryPath in startServer**

In `startServer()`, add `mcpRegistryPath` to the options:

```typescript
  const app = await buildServer({
    token: cfg.token,
    allowedRoots: [workspace],
    commandAllowlist: ['python', 'python3', 'node', 'npm', 'git', 'curl'],
    screenshotsDir,
    dbPath: join(CONFIG_DIR, 'jobs.db'),
    mcpRegistryPath: join(CONFIG_DIR, 'docker-mcp-servers.json'),
  })
```

- [ ] **Step 7: Build TypeScript to check for errors**

```
cd daemon && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 8: Commit**

```
git add daemon/src/server.ts
git commit -m "feat(daemon): add /docker-mcp/servers and /docker-mcp/sync endpoints"
```

---

## Task 7: Frontend — Types + seed integration + localProvider forward

**Files:**
- Modify: `src/mcp/types.ts`
- Modify: `src/mcp/storage/localMCPStorage.ts`
- Modify: `src/mcp/providers/localProvider.ts`

- [ ] **Step 1: Add 'docker-mcp' to IntegrationType in src/mcp/types.ts**

Change the `IntegrationType` union:

```typescript
export type IntegrationType =
  | 'telegram'
  | 'google-drive'
  | 'gmail'
  | 'google-calendar'
  | 'google-slides'
  | 'youtube'
  | 'google-docs'
  | 'higgsfield'
  | 'instagram'
  | 'facebook'
  | 'figma'
  | 'flowmap'
  | 'local'
  | 'docker-mcp'
```

- [ ] **Step 2: Add capabilityGroup and toolSource to MCPToolDefinition**

In `MCPToolDefinition`, add two optional fields after `tags`:

```typescript
export type ToolCapabilityGroup = 'file' | 'system' | 'browser' | 'git' | 'code' | 'docker_mcp' | 'general'

export type ToolSource = 'native' | 'docker_mcp'

export interface MCPToolDefinition {
  id: string
  integrationId: string
  toolName: string
  displayName: string
  description?: string
  riskLevel?: MCPToolRiskLevel
  permissionMode: ToolPermissionMode
  inputSchema?: Record<string, unknown>
  tags?: string[]
  capabilityGroup?: ToolCapabilityGroup
  toolSource?: ToolSource
}
```

- [ ] **Step 3: Add docker-mcp seed integration to localMCPStorage.ts**

In `SEED_INTEGRATIONS`, append (find the last entry in the array and add after it):

```typescript
  {
    id: 'integ_docker_mcp',
    type: 'docker-mcp',
    name: 'Docker MCP Servers',
    description: 'AI coding and terminal control tools via Docker Desktop MCP Toolkit.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['tools.list', 'tools.execute'],
  },
```

- [ ] **Step 4: Update localProvider.ts to forward capabilityGroup**

In the `listTools` method, update the daemon response type and mapping:

```typescript
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
```

Add the import at the top of localProvider.ts (the type is already in types.ts so just update the import):

```typescript
import type { MCPToolDefinition, MCPToolRiskLevel, ToolPermissionMode } from '../types.js'
```

- [ ] **Step 5: TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors in src/mcp/

- [ ] **Step 6: Commit**

```
git add src/mcp/types.ts src/mcp/storage/localMCPStorage.ts src/mcp/providers/localProvider.ts
git commit -m "feat(frontend): add docker-mcp type, capabilityGroup to MCPToolDefinition, seed integration"
```

---

## Task 8: Frontend — Docker MCP provider

**Files:**
- Create: `src/mcp/providers/dockerMCPProvider.ts`
- Modify: `src/mcp/services/mcpToolRegistry.ts`

- [ ] **Step 1: Create src/mcp/providers/dockerMCPProvider.ts**

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition, MCPToolRiskLevel, ToolPermissionMode } from '../types.js'

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
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined ?? {}),
      Authorization: `Bearer ${info.token}`,
      'Content-Type': 'application/json',
    },
  })
}

function riskToPermission(risk?: string): ToolPermissionMode {
  if (risk === 'read') return 'auto'
  if (risk === 'publish') return 'restricted'
  return 'approval_required'
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
    const [, serverId, toolName] = parts as [string, string, string]
    try {
      const r = await call('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          toolId: `docker_mcp::${serverId}::${toolName}`,
          params: input,
        }),
      })
      if (!r.ok) return { success: false, error: `POST /jobs failed: ${r.status}` }
      const { jobId } = await r.json() as { jobId: string }

      // SSE wait (reuse same pattern as localProvider)
      const info = await daemonInfo()
      if (!info) return { success: false, error: 'daemon not running' }
      const sse = await fetch(`http://127.0.0.1:${info.port}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${info.token}`, Accept: 'text/event-stream' },
      })
      if (!sse.ok || !sse.body) return { success: false, error: `SSE failed: ${sse.status}` }

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
          if (evt.type === 'done') return { success: true, output: evt.result }
          if (evt.type === 'failed') return { success: false, error: evt.error?.message }
          if (evt.type === 'cancelled') return { success: false, error: 'cancelled' }
        }
      }
      return { success: false, error: 'SSE closed without terminal event' }
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
```

- [ ] **Step 2: Register in src/mcp/services/mcpToolRegistry.ts**

Import the new provider:

```typescript
import { dockerMCPProvider } from '../providers/dockerMCPProvider.js'
```

Add to the `PROVIDERS` map:

```typescript
  'docker-mcp': dockerMCPProvider,
```

- [ ] **Step 3: TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```
git add src/mcp/providers/dockerMCPProvider.ts src/mcp/services/mcpToolRegistry.ts
git commit -m "feat(frontend): add Docker MCP provider and register in tool registry"
```

---

## Task 9: Frontend — Daemon dispatch for Docker MCP tools

The daemon needs to route `docker_mcp::<serverId>::<toolName>` job requests through the ServerManager. Currently `registry.run()` only handles native tools.

**Files:**
- Modify: `daemon/src/tools/registry.ts`
- Modify: `daemon/src/server.ts`

- [ ] **Step 1: Pass ServerManager into buildRegistry**

Update `RegistryOptions`:

```typescript
import { ServerManager } from '../mcp/serverManager.js'

export interface RegistryOptions {
  allowedRoots: string[]
  commandAllowlist: string[]
  screenshotsDir: string
  mcpManager?: ServerManager
}
```

- [ ] **Step 2: Route docker_mcp:: tools in registry.run()**

In `buildRegistry`, update `run()` to delegate Docker MCP calls:

```typescript
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
```

- [ ] **Step 3: Pass mcpManager when building registry in server.ts**

In `buildServer`, change:

```typescript
  const registry: ToolRegistry = buildRegistry({
    allowedRoots: opts.allowedRoots,
    commandAllowlist: opts.commandAllowlist,
    screenshotsDir: opts.screenshotsDir,
    mcpManager,
  })
```

(Move `const mcpManager = new ServerManager(...)` BEFORE the registry construction.)

- [ ] **Step 4: Also expose docker-mcp tools in GET /tools**

In the `/tools` handler, merge native + Docker MCP tools:

```typescript
  app.get('/tools', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const native = registry.list()
    const dockerTools = mcpManager.listServers()
      .filter((s) => s.status === 'connected')
      .flatMap((s) => s.tools.map((t) => ({
        id: `docker_mcp::${s.config.id}::${t.name}`,
        displayName: `${t.name} (${s.config.name})`,
        description: t.description ?? '',
        risk: 'write' as const,
        group: 'docker_mcp' as const,
        paramsSchema: t.inputSchema ?? null,
      })))
    return { tools: [...native, ...dockerTools] }
  })
```

- [ ] **Step 5: TypeScript check**

```
cd daemon && npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 6: Commit**

```
git add daemon/src/tools/registry.ts daemon/src/server.ts
git commit -m "feat(daemon): route docker_mcp:: tool calls through ServerManager, expose in /tools"
```

---

## Task 10: Frontend — Operator views and routing

**Files:**
- Create: `src/views/OperatorWorkspace.jsx`
- Create: `src/views/AICodingView.jsx`
- Create: `src/views/TerminalControlView.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create src/views/OperatorWorkspace.jsx**

```jsx
import { Link } from 'react-router-dom'
import { Code2, Terminal, Cpu } from 'lucide-react'

const MODULES = [
  {
    to: '/operator/coding',
    icon: Code2,
    title: 'AI Coding',
    description: 'Git-aware coding assistant. Run code, inspect repos, and use Context7 docs lookup.',
    accent: 'rgba(99,102,241,0.25)',
  },
  {
    to: '/operator/terminal',
    icon: Terminal,
    title: 'Terminal Control',
    description: 'Execute shell commands, inspect the filesystem, and automate tasks via Desktop Commander.',
    accent: 'rgba(16,185,129,0.20)',
  },
]

export default function OperatorWorkspace() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-1">
        <Cpu size={20} className="text-[color:var(--color-creator)]" />
        <h1 className="text-2xl font-semibold tracking-tight">Operator</h1>
      </div>
      <p className="text-[13px] text-white/45 mb-8">
        Local AI-powered tools. Requires the FlowMap daemon running (<code className="font-mono text-white/60">npm run daemon</code>).
      </p>

      <div className="flex flex-col gap-4">
        {MODULES.map(({ to, icon: Icon, title, description, accent }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-4 p-5 rounded-xl border border-white/8 hover:border-white/15 transition-colors"
            style={{ background: accent }}
          >
            <div className="mt-0.5 p-2 rounded-lg bg-white/8">
              <Icon size={18} className="text-white/80" />
            </div>
            <div>
              <div className="text-[15px] font-medium text-white/90 mb-1">{title}</div>
              <div className="text-[13px] text-white/50">{description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create src/views/AICodingView.jsx**

```jsx
import { useState } from 'react'
import { Code2, Play, GitBranch, Loader } from 'lucide-react'
import { localMCPStorage } from '../mcp/storage/localMCPStorage.js'
import { getProvider } from '../mcp/services/mcpToolRegistry.js'

export default function AICodingView() {
  const [task, setTask] = useState('')
  const [output, setOutput] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)

  async function handleRun() {
    if (!task.trim() || running) return
    setRunning(true)
    setError(null)
    setOutput(null)

    try {
      // Resolve coding tools (git group + code group)
      const tools = localMCPStorage.listTools()
      const gitStatusTool = tools.find((t) => t.toolName === 'git.status')
      if (!gitStatusTool) {
        setError('git.status tool not available. Is the daemon running?')
        return
      }

      const integration = localMCPStorage.getIntegration(gitStatusTool.integrationId)
      if (!integration) {
        setError('Local integration not found.')
        return
      }

      const provider = getProvider(integration.type)
      if (!provider) {
        setError('No provider for integration type: ' + integration.type)
        return
      }

      const result = await provider.executeTool({
        integration,
        tool: gitStatusTool,
        input: { repoPath: task.trim() },
      })

      setOutput(result)
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Code2 size={18} className="text-[color:var(--color-creator)]" />
        <h1 className="text-xl font-semibold tracking-tight">AI Coding</h1>
      </div>
      <p className="text-[13px] text-white/45 mb-6">
        Enter a repo path below to inspect its git status. Full coding agent loop coming in Phase 3.
      </p>

      <div className="flex gap-2 mb-4">
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRun()}
          placeholder="Repo path, e.g. C:\Users\JenoU\Desktop\FlowMap"
          className="glass-input flex-1 text-[13px]"
        />
        <button
          onClick={handleRun}
          disabled={running || !task.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-[13px] hover:bg-indigo-500/30 disabled:opacity-40 transition-colors"
        >
          {running ? <Loader size={14} className="animate-spin" /> : <Play size={14} />}
          Run
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[13px] mb-4">
          {error}
        </div>
      )}

      {output && (
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-white/3">
            <GitBranch size={13} className="text-white/50" />
            <span className="text-[12px] text-white/50">Git Status</span>
          </div>
          <pre className="p-4 text-[12px] text-white/75 font-mono overflow-auto max-h-96 whitespace-pre-wrap">
            {JSON.stringify(output.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create src/views/TerminalControlView.jsx**

```jsx
import { useState, useRef, useEffect } from 'react'
import { Terminal, Play, Loader } from 'lucide-react'
import { localMCPStorage } from '../mcp/storage/localMCPStorage.js'
import { getProvider } from '../mcp/services/mcpToolRegistry.js'

function OutputLine({ line }) {
  const isErr = line.startsWith('[stderr]')
  return (
    <div className={`font-mono text-[12px] ${isErr ? 'text-red-300/80' : 'text-white/70'}`}>
      {line}
    </div>
  )
}

export default function TerminalControlView() {
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState([])
  const [running, setRunning] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  async function handleRun() {
    if (!command.trim() || running) return
    const cmd = command.trim()
    setCommand('')
    setRunning(true)

    setHistory((h) => [...h, { type: 'input', text: `$ ${cmd}` }])

    try {
      const tools = localMCPStorage.listTools()
      const execTool = tools.find((t) => t.toolName === 'system.exec' || t.toolName === 'system.exec_inline')
      if (!execTool) {
        setHistory((h) => [...h, { type: 'error', text: 'system.exec not available. Is the daemon running?' }])
        return
      }

      const [bin, ...args] = cmd.split(' ')
      const integration = localMCPStorage.getIntegration(execTool.integrationId)
      if (!integration) {
        setHistory((h) => [...h, { type: 'error', text: 'Local integration not found.' }])
        return
      }

      const provider = getProvider(integration.type)
      if (!provider) {
        setHistory((h) => [...h, { type: 'error', text: 'No provider for integration: ' + integration.type }])
        return
      }

      const result = await provider.executeTool({
        integration,
        tool: execTool,
        input: { command: bin, args },
      })

      if (result.success) {
        const out = result.output
        if (out?.stdout) {
          for (const line of String(out.stdout).split('\n').filter(Boolean)) {
            setHistory((h) => [...h, { type: 'stdout', text: line }])
          }
        }
        if (out?.stderr) {
          for (const line of String(out.stderr).split('\n').filter(Boolean)) {
            setHistory((h) => [...h, { type: 'stderr', text: `[stderr] ${line}` }])
          }
        }
        if (!out?.stdout && !out?.stderr) {
          setHistory((h) => [...h, { type: 'stdout', text: '(no output)' }])
        }
      } else {
        setHistory((h) => [...h, { type: 'error', text: `Error: ${result.error}` }])
      }
    } catch (err) {
      setHistory((h) => [...h, { type: 'error', text: err?.message ?? String(err) }])
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl flex flex-col gap-4">
      <div className="flex items-center gap-3 mb-1">
        <Terminal size={18} className="text-emerald-400" />
        <h1 className="text-xl font-semibold tracking-tight">Terminal Control</h1>
      </div>
      <p className="text-[13px] text-white/45">
        Run allowlisted system commands via the operator daemon. Commands execute in the daemon workspace.
      </p>

      <div className="rounded-xl border border-white/8 overflow-hidden flex flex-col min-h-[300px] max-h-[500px]">
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-0.5 bg-black/30">
          {history.length === 0 && (
            <div className="text-[12px] text-white/25 font-mono">Ready. Type a command below.</div>
          )}
          {history.map((line, i) => (
            <OutputLine key={i} line={line.text} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border-t border-white/8 bg-white/3">
          <span className="text-emerald-400 font-mono text-[13px]">$</span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            placeholder="git status, node --version, npm list…"
            className="flex-1 bg-transparent outline-none text-[13px] font-mono text-white/80 placeholder:text-white/25"
            autoFocus
          />
          <button
            onClick={handleRun}
            disabled={running || !command.trim()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[12px] hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
          >
            {running ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
            Run
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add routes to src/App.jsx**

Add lazy imports after the `Briefs` import:

```jsx
const OperatorWorkspace    = lazy(() => import('./views/OperatorWorkspace.jsx'))
const AICodingView         = lazy(() => import('./views/AICodingView.jsx'))
const TerminalControlView  = lazy(() => import('./views/TerminalControlView.jsx'))
```

Add routes in `AnimatedRoutes` after the `/briefs` route:

```jsx
          <Route path="/operator"          element={<OperatorWorkspace />} />
          <Route path="/operator/coding"   element={<AICodingView />} />
          <Route path="/operator/terminal" element={<TerminalControlView />} />
```

- [ ] **Step 5: TypeScript/build check**

```
npm run build 2>&1 | head -30
```
Expected: build succeeds (or only pre-existing TS errors — no new ones)

- [ ] **Step 6: Commit**

```
git add src/views/OperatorWorkspace.jsx src/views/AICodingView.jsx src/views/TerminalControlView.jsx src/App.jsx
git commit -m "feat(frontend): add Operator workspace, AI Coding, Terminal Control views + routes"
```

---

## Task 11: Frontend — LeftRail Operator section

**Files:**
- Modify: `src/components/layout/LeftRail.jsx`

- [ ] **Step 1: Add Operator nav section**

Update LeftRail.jsx — add imports and a new bottom section before the Connections link:

```jsx
import { NavLink } from 'react-router-dom'
import { BookOpen, LayoutDashboard, Brain, FileText, Bot, Compass, Plug, Activity, Radar, GraduationCap, Code2, Terminal, Cpu } from 'lucide-react'
```

Add a new group to `NAV_GROUPS` (or add as a separate bottom section). Add before the `mt-auto` div:

The full updated bottom section:

```jsx
      <div className="mt-auto flex flex-col gap-1">
        <div className="my-2 border-t border-[color:var(--color-border-subtle)]" />

        {/* Operator section */}
        <div className="px-3 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Operator</span>
        </div>
        {[
          { to: '/operator/coding',   label: 'AI Coding',   icon: Code2     },
          { to: '/operator/terminal', label: 'Terminal',    icon: Terminal  },
        ].map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'text-[color:var(--color-text-primary)]'
                  : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-glass)] hover:text-[color:var(--color-text-primary)]',
              ].join(' ')
            }
            style={({ isActive }) => isActive ? {
              background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(217,70,239,0.22) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            } : undefined}
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}

        <div className="my-2 border-t border-[color:var(--color-border-subtle)]" />

        <NavLink
          to="/connections"
          className={({ isActive }) =>
            [
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              isActive
                ? 'text-[color:var(--color-text-primary)]'
                : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-glass)] hover:text-[color:var(--color-text-primary)]',
            ].join(' ')
          }
          style={({ isActive }) => isActive ? {
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(217,70,239,0.22) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          } : undefined}
        >
          <Plug size={17} />
          <span>Connections</span>
        </NavLink>
      </div>
```

- [ ] **Step 2: Remove old `mt-auto` Connections-only div**

Delete the old bottom div (lines 71-91 in original LeftRail.jsx):

```jsx
      <div className="mt-auto">
        <NavLink ...>
          <Plug size={17} />
          <span>Connections</span>
        </NavLink>
      </div>
```

Replace it entirely with the new `mt-auto` div from Step 1.

- [ ] **Step 3: Build and verify no errors**

```
npm run build 2>&1 | head -20
```
Expected: no new errors

- [ ] **Step 4: Commit**

```
git add src/components/layout/LeftRail.jsx
git commit -m "feat(frontend): add Operator section to LeftRail nav with AI Coding + Terminal links"
```

---

## Task 12: Frontend — Tool catalog capability group filter

**Files:**
- Modify: `src/mcp/pages/MCPToolCatalogPage.tsx`

- [ ] **Step 1: Read current MCPToolCatalogPage.tsx**

Read the full file to understand the current filter UI before modifying.

- [ ] **Step 2: Add group filter state**

After the existing state declarations:

```typescript
  const [filterGroup, setFilterGroup] = useState<string>('')
```

- [ ] **Step 3: Apply group filter to the filtered tools computation**

Update `filtered`:

```typescript
  const filtered = tools.filter((t) => {
    const matchesQuery =
      !query ||
      t.displayName.toLowerCase().includes(query.toLowerCase()) ||
      t.description?.toLowerCase().includes(query.toLowerCase()) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
    const matchesIntegration = !filterIntegration || t.integrationId === filterIntegration
    const matchesGroup = !filterGroup || t.capabilityGroup === filterGroup
    return matchesQuery && matchesIntegration && matchesGroup
  })
```

- [ ] **Step 4: Add group tab bar above the search row**

Add the following JSX block after the `<ConnectionsSubNav />` and before the count paragraph:

```tsx
      {/* Capability group filter */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[
          { value: '', label: 'All' },
          { value: 'file', label: 'File' },
          { value: 'system', label: 'System' },
          { value: 'browser', label: 'Browser' },
          { value: 'git', label: 'Git' },
          { value: 'code', label: 'Code' },
          { value: 'docker_mcp', label: 'Docker MCP' },
          { value: 'general', label: 'Other' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilterGroup(value)}
            className={[
              'px-3 py-1 rounded-full text-[12px] border transition-colors',
              filterGroup === value
                ? 'bg-white/12 border-white/20 text-white/90'
                : 'bg-transparent border-white/10 text-white/45 hover:text-white/70 hover:border-white/20',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
```

- [ ] **Step 5: TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors (capabilityGroup is now typed on MCPToolDefinition)

- [ ] **Step 6: Commit**

```
git add src/mcp/pages/MCPToolCatalogPage.tsx
git commit -m "feat(frontend): add capability group filter tabs to tool catalog"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|---|---|
| Git adapter (status, log, diff, add, commit) | Task 3 |
| Node.js sandbox (code.run_js) | Task 4 |
| Docker MCP bridge (client, server registry, manager) | Task 5 |
| Docker MCP daemon endpoints | Task 6 + Task 9 |
| docker-mcp frontend type + seed integration | Task 7 |
| Docker MCP provider (listTools, executeTool, testConnection) | Task 8 |
| CapabilityGroup on tools | Task 1 |
| Operator views (hub, coding, terminal) | Task 10 |
| LeftRail navigation | Task 11 |
| Tool catalog group filter | Task 12 |

### Placeholder Check

None — all code blocks are complete.

### Type Consistency

- `CapabilityGroup` defined in `daemon/src/types.ts` — referenced in registry.ts, server.ts
- `ToolCapabilityGroup` defined in `src/mcp/types.ts` — referenced in localProvider.ts, dockerMCPProvider.ts, MCPToolCatalogPage.tsx
- `getProvider(type)` — confirmed: exported from `src/mcp/services/mcpToolRegistry.ts`. Views use `getProvider(integration.type)` then call `provider.executeTool(...)`.
- `localMCPStorage.getIntegration(id)` — confirmed: method exists in localMCPStorage.ts.
