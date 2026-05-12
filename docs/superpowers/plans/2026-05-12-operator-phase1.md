# Operator Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Node.js daemon that gives FlowMap local-execution capabilities (file ops, shell, browser automation) via a structured tool catalog, with the frontend connecting to it through a new MCP provider.

**Architecture:** Two-process model. Daemon at `daemon/` (TypeScript, Fastify, Playwright, SQLite). Frontend gets one new MCP provider (`localProvider`) and a Settings panel. Communication = REST + Server-Sent Events on `127.0.0.1` with bearer-token auth. 15 tool primitives across 3 adapters (file, shell, browser).

**Tech Stack:** TypeScript, Fastify, better-sqlite3, Zod, Pino, Playwright, Vitest. Frontend stays React 19.

**Spec:** [docs/superpowers/specs/2026-05-12-operator-phase1-design.md](../specs/2026-05-12-operator-phase1-design.md)

---

## Conventions

- All daemon code is TypeScript, ESM modules
- Tests use Vitest, colocated under `daemon/tests/<mirror>/`
- Run daemon tests from `daemon/` dir: `npm test`
- Commit messages: `feat(daemon): ...`, `feat(frontend): ...`, `chore: ...`, `test: ...`
- Every task ends with a commit — small commits beat big ones
- Cross-platform: use `node:path`, `node:os`, `node:fs/promises` exclusively, never raw `/` paths
- Never use `child_process.exec` or `execSync` — always `execFile`/`execFileSync`/`spawn` with `shell: false` and args as arrays

---

### Task 1: Daemon project skeleton

**Files:**
- Create: `daemon/package.json`
- Create: `daemon/tsconfig.json`
- Create: `daemon/.gitignore`
- Create: `daemon/src/server.ts`
- Modify: `package.json` (root) — add `daemon` script
- Modify: `.gitignore` (root) — ignore `daemon/node_modules`, `daemon/dist`

- [ ] **Step 1: Create daemon/package.json**

```json
{
  "name": "flowmap-operator-daemon",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "better-sqlite3": "^11.0.0",
    "pino": "^9.0.0",
    "playwright": "^1.45.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create daemon/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": false,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create daemon/.gitignore**

```
node_modules
dist
data/
*.log
```

- [ ] **Step 4: Create daemon/src/server.ts (smoke entry)**

```typescript
import Fastify from 'fastify'

const app = Fastify({ logger: true })

app.get('/health', async () => ({ ok: true, version: '0.0.1' }))

const port = 0 // OS-assigned random port
const host = '127.0.0.1'

app.listen({ port, host }).then(() => {
  const address = app.server.address()
  if (address && typeof address === 'object') {
    console.log(`daemon listening on http://${host}:${address.port}`)
  }
})
```

- [ ] **Step 5: Add daemon script to root package.json**

Open root `package.json`, add to `scripts`:

```json
    "daemon": "cd daemon && npm start",
    "daemon:install": "cd daemon && npm install"
```

- [ ] **Step 6: Update root .gitignore**

Append:

```
daemon/node_modules
daemon/dist
daemon/data
```

- [ ] **Step 7: Install daemon dependencies**

Run from project root:

```bash
npm run daemon:install
```

Expected: clean install with no errors. `daemon/node_modules` created.

- [ ] **Step 8: Smoke test — daemon starts and serves /health**

Run from project root:

```bash
npm run daemon
```

Expected: log line like `daemon listening on http://127.0.0.1:54321`. In another terminal: `curl http://127.0.0.1:54321/health` returns `{"ok":true,"version":"0.0.1"}`. Stop with Ctrl-C.

- [ ] **Step 9: Commit**

```bash
git add daemon/ package.json .gitignore
git commit -m "feat(daemon): initial project skeleton with Fastify health endpoint"
```

---

### Task 2: Config module (~/.flowmap/daemon.json)

**Files:**
- Create: `daemon/src/config.ts`
- Create: `daemon/tests/config.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/config.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadOrCreateConfig, FlowMapConfig } from '../src/config.js'

describe('config', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fmcfg-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('creates daemon.json on first call with port 0 and 64-char token', () => {
    const cfg = loadOrCreateConfig(dir)
    expect(cfg.port).toBe(0)
    expect(cfg.token).toMatch(/^[a-f0-9]{64}$/)
    const onDisk = JSON.parse(readFileSync(join(dir, 'daemon.json'), 'utf8'))
    expect(onDisk.token).toBe(cfg.token)
  })

  it('returns existing config without regenerating token', () => {
    const a = loadOrCreateConfig(dir)
    const b = loadOrCreateConfig(dir)
    expect(b.token).toBe(a.token)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find module `../src/config.js`.

- [ ] **Step 3: Implement config.ts**

Create `daemon/src/config.ts`:

```typescript
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

export interface FlowMapConfig {
  port: number
  token: string
}

const DEFAULT_DIR = join(homedir(), '.flowmap')

function lockdown(path: string): void {
  if (platform() === 'win32') {
    try {
      const user = process.env.USERNAME ?? ''
      if (user) {
        execFileSync('icacls', [path, '/inheritance:r', '/grant:r', `${user}:(R,W)`], { stdio: 'ignore' })
      }
    } catch { /* best-effort */ }
  } else {
    try { chmodSync(path, 0o600) } catch { /* best-effort */ }
  }
}

export function loadOrCreateConfig(dir: string = DEFAULT_DIR): FlowMapConfig {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const file = join(dir, 'daemon.json')
  if (existsSync(file)) {
    return JSON.parse(readFileSync(file, 'utf8')) as FlowMapConfig
  }
  const cfg: FlowMapConfig = {
    port: 0, // OS-assigned at bind time, persisted later via saveActualPort
    token: randomBytes(32).toString('hex'),
  }
  writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8')
  lockdown(file)
  return cfg
}

export function saveActualPort(dir: string, port: number): void {
  const file = join(dir, 'daemon.json')
  const cfg = JSON.parse(readFileSync(file, 'utf8')) as FlowMapConfig
  cfg.port = port
  writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8')
  lockdown(file)
}

export const CONFIG_DIR = DEFAULT_DIR
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/config.ts daemon/tests/config.test.ts
git commit -m "feat(daemon): config module with token generation and file lockdown"
```

---

### Task 3: Auth middleware

**Files:**
- Create: `daemon/src/auth.ts`
- Create: `daemon/tests/auth.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/auth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { verifyAuthHeader } from '../src/auth.js'

describe('auth', () => {
  const token = 'a'.repeat(64)

  it('accepts valid Bearer token', () => {
    expect(verifyAuthHeader(`Bearer ${token}`, token)).toBe(true)
  })

  it('rejects missing header', () => {
    expect(verifyAuthHeader(undefined, token)).toBe(false)
  })

  it('rejects malformed header', () => {
    expect(verifyAuthHeader('Token abc', token)).toBe(false)
    expect(verifyAuthHeader('Bearer', token)).toBe(false)
  })

  it('rejects wrong token', () => {
    expect(verifyAuthHeader(`Bearer ${'b'.repeat(64)}`, token)).toBe(false)
  })

  it('uses timing-safe comparison (length mismatch returns false)', () => {
    expect(verifyAuthHeader(`Bearer short`, token)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find `../src/auth.js`.

- [ ] **Step 3: Implement auth.ts**

Create `daemon/src/auth.ts`:

```typescript
import { timingSafeEqual } from 'node:crypto'

export function verifyAuthHeader(header: string | undefined, expectedToken: string): boolean {
  if (!header) return false
  const parts = header.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return false
  const provided = parts[1]
  if (provided.length !== expectedToken.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expectedToken))
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/auth.ts daemon/tests/auth.test.ts
git commit -m "feat(daemon): bearer-token auth verification with timing-safe compare"
```

---

### Task 4: Core types

**Files:**
- Create: `daemon/src/types.ts`

- [ ] **Step 1: Implement types.ts (no test — pure types)**

Create `daemon/src/types.ts`:

```typescript
export type RiskLevel = 'read' | 'write' | 'publish'

export type JobStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'done'
  | 'failed'
  | 'cancelled'

export type ErrorCode =
  | 'validation_failed'
  | 'permission_denied'
  | 'sandbox_violation'
  | 'timeout'
  | 'adapter_failure'

export interface JobError {
  code: ErrorCode
  message: string
  details?: unknown
}

export interface Job {
  id: string
  toolId: string
  params: unknown
  status: JobStatus
  createdAt: string  // ISO
  startedAt?: string
  finishedAt?: string
  result?: unknown
  error?: JobError
}

export type JobEvent =
  | { type: 'queued'; jobId: string }
  | { type: 'running'; jobId: string }
  | { type: 'log'; jobId: string; stream: 'stdout' | 'stderr'; chunk: string }
  | { type: 'output'; jobId: string; partial: unknown }
  | { type: 'done'; jobId: string; result: unknown }
  | { type: 'failed'; jobId: string; error: JobError }
  | { type: 'cancelled'; jobId: string }

export interface ToolDefinition {
  id: string
  displayName: string
  description: string
  risk: RiskLevel
  paramsSchema: unknown
}

export interface ToolHandlerContext {
  jobId: string
  emit: (event: JobEvent) => void
  signal: AbortSignal
}

export type ToolHandler = (params: unknown, ctx: ToolHandlerContext) => Promise<unknown>
```

- [ ] **Step 2: Verify it compiles**

```bash
cd daemon && npx tsc --noEmit
```

Expected: no output (clean compile).

- [ ] **Step 3: Commit**

```bash
git add daemon/src/types.ts
git commit -m "feat(daemon): core type definitions"
```

---

### Task 5: Path policy (sandbox)

**Files:**
- Create: `daemon/src/sandbox/pathPolicy.ts`
- Create: `daemon/tests/sandbox/pathPolicy.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/sandbox/pathPolicy.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { isPathAllowed } from '../../src/sandbox/pathPolicy.js'

describe('pathPolicy.isPathAllowed', () => {
  let root: string
  let allowed: string
  let outside: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pp-'))
    allowed = join(root, 'workspace')
    outside = join(root, 'outside')
    mkdirSync(allowed)
    mkdirSync(outside)
  })
  afterEach(() => { rmSync(root, { recursive: true, force: true }) })

  it('allows a file inside an allowed root', () => {
    const file = join(allowed, 'a.txt')
    writeFileSync(file, 'x')
    expect(isPathAllowed(file, [allowed]).ok).toBe(true)
  })

  it('rejects a file outside allowed roots', () => {
    const file = join(outside, 'b.txt')
    writeFileSync(file, 'x')
    const r = isPathAllowed(file, [allowed])
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/not within allowed roots/i)
  })

  it('rejects path traversal via ..', () => {
    const traversal = join(allowed, '..', 'outside', 'b.txt')
    writeFileSync(join(outside, 'b.txt'), 'x')
    const r = isPathAllowed(traversal, [allowed])
    expect(r.ok).toBe(false)
  })

  it('rejects symlink escaping the allowed root', () => {
    const linkPath = join(allowed, 'link')
    try { symlinkSync(outside, linkPath, 'dir') } catch { return /* skip on Windows w/o admin */ }
    const r = isPathAllowed(join(linkPath, 'b.txt'), [allowed])
    expect(r.ok).toBe(false)
  })

  it('rejects denylisted paths even if inside allowed root', () => {
    const dotssh = join(allowed, '.ssh', 'id_rsa')
    mkdirSync(join(allowed, '.ssh'))
    writeFileSync(dotssh, 'x')
    const r = isPathAllowed(dotssh, [allowed])
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/denylist/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find `../../src/sandbox/pathPolicy.js`.

- [ ] **Step 3: Implement pathPolicy.ts**

Create `daemon/src/sandbox/pathPolicy.ts`:

```typescript
import { realpathSync, existsSync } from 'node:fs'
import { resolve, sep } from 'node:path'

export interface PathCheckResult {
  ok: boolean
  reason?: string
  resolvedPath?: string
}

const DENY_SEGMENTS = [
  /[\\/]\.ssh([\\/]|$)/i,
  /[\\/]\.aws([\\/]|$)/i,
  /[\\/]\.flowmap[\\/]daemon\.json$/i,
  /^\/etc([\\/]|$)/i,
  /^\/sys([\\/]|$)/i,
  /^\/proc([\\/]|$)/i,
]

function realResolve(p: string): string {
  const abs = resolve(p)
  if (existsSync(abs)) return realpathSync(abs)
  return abs
}

function withTrailingSep(p: string): string {
  return p.endsWith(sep) ? p : p + sep
}

export function isPathAllowed(candidate: string, allowedRoots: string[]): PathCheckResult {
  let resolved: string
  try {
    resolved = realResolve(candidate)
  } catch (err: any) {
    return { ok: false, reason: `cannot resolve path: ${err?.message ?? err}` }
  }

  for (const pat of DENY_SEGMENTS) {
    if (pat.test(resolved)) {
      return { ok: false, reason: `path matches denylist (${pat.source})`, resolvedPath: resolved }
    }
  }

  const resolvedWithSep = withTrailingSep(resolved)
  for (const root of allowedRoots) {
    const rootWithSep = withTrailingSep(realResolve(root))
    if (resolvedWithSep.startsWith(rootWithSep)) {
      return { ok: true, resolvedPath: resolved }
    }
  }

  return { ok: false, reason: 'resolved path is not within allowed roots', resolvedPath: resolved }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 5 tests in pathPolicy (symlink test may skip on Windows without symlink permission).

- [ ] **Step 5: Commit**

```bash
git add daemon/src/sandbox/pathPolicy.ts daemon/tests/sandbox/pathPolicy.test.ts
git commit -m "feat(daemon): path sandbox with denylist + traversal/symlink guards"
```

---

### Task 6: Command policy (sandbox)

**Files:**
- Create: `daemon/src/sandbox/commandPolicy.ts`
- Create: `daemon/tests/sandbox/commandPolicy.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/sandbox/commandPolicy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isCommandAllowed } from '../../src/sandbox/commandPolicy.js'

const ALLOW = ['python', 'python3', 'node', 'npm', 'git', 'curl']

describe('commandPolicy.isCommandAllowed', () => {
  it('accepts an exact-match logical command', () => {
    expect(isCommandAllowed('python', ALLOW).ok).toBe(true)
    expect(isCommandAllowed('node', ALLOW).ok).toBe(true)
  })

  it('strips .exe / .cmd on Windows-style names', () => {
    expect(isCommandAllowed('python.exe', ALLOW).ok).toBe(true)
    expect(isCommandAllowed('npm.cmd', ALLOW).ok).toBe(true)
    expect(isCommandAllowed('Python.EXE', ALLOW).ok).toBe(true)
  })

  it('rejects path traversal / absolute paths in command', () => {
    expect(isCommandAllowed('/usr/bin/python', ALLOW).ok).toBe(false)
    expect(isCommandAllowed('C:\\Windows\\python.exe', ALLOW).ok).toBe(false)
    expect(isCommandAllowed('../python', ALLOW).ok).toBe(false)
  })

  it('rejects shell metacharacters', () => {
    expect(isCommandAllowed('python && rm -rf /', ALLOW).ok).toBe(false)
    expect(isCommandAllowed('python | cat', ALLOW).ok).toBe(false)
    expect(isCommandAllowed('python;ls', ALLOW).ok).toBe(false)
  })

  it('rejects non-allowlisted commands', () => {
    expect(isCommandAllowed('rm', ALLOW).ok).toBe(false)
    expect(isCommandAllowed('ls', ALLOW).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find commandPolicy.

- [ ] **Step 3: Implement commandPolicy.ts**

Create `daemon/src/sandbox/commandPolicy.ts`:

```typescript
export interface CommandCheckResult {
  ok: boolean
  reason?: string
  normalized?: string
}

const SHELL_META = /[;&|`$<>(){}*?[\]"'\\]/
const PATH_SEP = /[\\/]/

export function isCommandAllowed(command: string, allowlist: string[]): CommandCheckResult {
  if (!command || typeof command !== 'string') {
    return { ok: false, reason: 'command must be a non-empty string' }
  }
  if (PATH_SEP.test(command)) {
    return { ok: false, reason: 'command must not contain path separators' }
  }
  if (SHELL_META.test(command)) {
    return { ok: false, reason: 'command contains shell metacharacters' }
  }

  const normalized = command
    .toLowerCase()
    .replace(/\.(exe|cmd|bat|ps1)$/i, '')

  const allow = allowlist.map((c) => c.toLowerCase())
  if (!allow.includes(normalized)) {
    return { ok: false, reason: `'${normalized}' is not in the allowlist` }
  }
  return { ok: true, normalized }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 5 tests in commandPolicy.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/sandbox/commandPolicy.ts daemon/tests/sandbox/commandPolicy.test.ts
git commit -m "feat(daemon): command sandbox with allowlist + metachar guard"
```

---

### Task 7: Tool schemas (Zod)

**Files:**
- Create: `daemon/src/tools/schemas.ts`
- Create: `daemon/tests/tools/schemas.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/tools/schemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { schemas } from '../../src/tools/schemas.js'

describe('tool schemas', () => {
  it('file.read requires a path string', () => {
    expect(schemas['file.read'].safeParse({ path: '/tmp/a' }).success).toBe(true)
    expect(schemas['file.read'].safeParse({}).success).toBe(false)
    expect(schemas['file.read'].safeParse({ path: 123 }).success).toBe(false)
  })

  it('file.write accepts overwrite/append modes', () => {
    expect(schemas['file.write'].safeParse({ path: '/tmp/a', content: 'x' }).success).toBe(true)
    expect(schemas['file.write'].safeParse({ path: '/tmp/a', content: 'x', mode: 'overwrite' }).success).toBe(true)
    expect(schemas['file.write'].safeParse({ path: '/tmp/a', content: 'x', mode: 'append' }).success).toBe(true)
    expect(schemas['file.write'].safeParse({ path: '/tmp/a', content: 'x', mode: 'truncate' }).success).toBe(false)
  })

  it('system.exec requires command and args array', () => {
    expect(schemas['system.exec'].safeParse({ command: 'python', args: ['-V'] }).success).toBe(true)
    expect(schemas['system.exec'].safeParse({ command: 'python', args: 'not-an-array' }).success).toBe(false)
  })

  it('browser.navigate requires sessionId + url', () => {
    expect(schemas['browser.navigate'].safeParse({ sessionId: 'abc', url: 'https://example.com' }).success).toBe(true)
    expect(schemas['browser.navigate'].safeParse({ sessionId: 'abc' }).success).toBe(false)
  })

  it('all 15 primitives have schemas defined', () => {
    const expected = [
      'file.read', 'file.list', 'file.exists', 'file.write', 'file.delete',
      'system.exec', 'system.exec_inline',
      'browser.open', 'browser.navigate', 'browser.screenshot', 'browser.extract',
      'browser.evaluate', 'browser.click', 'browser.fill', 'browser.close',
    ]
    for (const id of expected) {
      expect(schemas[id], `${id} schema missing`).toBeDefined()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find schemas module.

- [ ] **Step 3: Implement schemas.ts**

Create `daemon/src/tools/schemas.ts`:

```typescript
import { z, ZodSchema } from 'zod'

const NonEmptyString = z.string().min(1)

export const schemas: Record<string, ZodSchema> = {
  'file.read': z.object({ path: NonEmptyString }).strict(),
  'file.list': z.object({
    path: NonEmptyString,
    recursive: z.boolean().optional(),
    glob: z.string().optional(),
  }).strict(),
  'file.exists': z.object({ path: NonEmptyString }).strict(),
  'file.write': z.object({
    path: NonEmptyString,
    content: z.string(),
    mode: z.enum(['overwrite', 'append']).optional(),
  }).strict(),
  'file.delete': z.object({
    path: NonEmptyString,
    recursive: z.boolean().optional(),
  }).strict(),

  'system.exec': z.object({
    command: NonEmptyString,
    args: z.array(z.string()),
    cwd: z.string().optional(),
    timeoutMs: z.number().int().positive().max(600_000).optional(),
    env: z.record(z.string()).optional(),
  }).strict(),
  'system.exec_inline': z.object({
    script: NonEmptyString,
    shell: z.enum(['bash', 'pwsh']).optional(),
    cwd: z.string().optional(),
    timeoutMs: z.number().int().positive().max(600_000).optional(),
  }).strict(),

  'browser.open': z.object({
    headless: z.boolean().optional(),
    viewport: z.object({ width: z.number().int(), height: z.number().int() }).optional(),
  }).strict(),
  'browser.navigate': z.object({
    sessionId: NonEmptyString,
    url: NonEmptyString,
    waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
  }).strict(),
  'browser.screenshot': z.object({
    sessionId: NonEmptyString,
    fullPage: z.boolean().optional(),
    selector: z.string().optional(),
  }).strict(),
  'browser.extract': z.object({
    sessionId: NonEmptyString,
    selector: NonEmptyString,
    attr: z.enum(['text', 'html', 'href', 'value']).optional(),
  }).strict(),
  'browser.evaluate': z.object({
    sessionId: NonEmptyString,
    script: NonEmptyString,
  }).strict(),
  'browser.click': z.object({
    sessionId: NonEmptyString,
    selector: NonEmptyString,
    timeoutMs: z.number().int().positive().optional(),
  }).strict(),
  'browser.fill': z.object({
    sessionId: NonEmptyString,
    selector: NonEmptyString,
    value: z.string(),
  }).strict(),
  'browser.close': z.object({ sessionId: NonEmptyString }).strict(),
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 5 tests in schemas.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/tools/schemas.ts daemon/tests/tools/schemas.test.ts
git commit -m "feat(daemon): Zod schemas for all 15 tool primitives"
```

---

### Task 8: Event log + emitter

**Files:**
- Create: `daemon/src/logging/eventLog.ts`
- Create: `daemon/tests/logging/eventLog.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/logging/eventLog.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { EventLog } from '../../src/logging/eventLog.js'

describe('EventLog', () => {
  it('delivers events to subscribers of the matching jobId', () => {
    const log = new EventLog()
    const got: any[] = []
    log.subscribe('job-1', (e) => got.push(e))
    log.emit({ type: 'running', jobId: 'job-1' })
    log.emit({ type: 'running', jobId: 'job-2' })
    expect(got).toHaveLength(1)
    expect(got[0].jobId).toBe('job-1')
  })

  it('unsubscribe stops further events', () => {
    const log = new EventLog()
    const got: any[] = []
    const unsub = log.subscribe('j', (e) => got.push(e))
    log.emit({ type: 'running', jobId: 'j' })
    unsub()
    log.emit({ type: 'done', jobId: 'j', result: {} })
    expect(got).toHaveLength(1)
  })

  it('records all events to history accessible by jobId', () => {
    const log = new EventLog()
    log.emit({ type: 'queued', jobId: 'j' })
    log.emit({ type: 'running', jobId: 'j' })
    log.emit({ type: 'done', jobId: 'j', result: { x: 1 } })
    const hist = log.history('j')
    expect(hist).toHaveLength(3)
    expect(hist[2].type).toBe('done')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find eventLog module.

- [ ] **Step 3: Implement eventLog.ts**

Create `daemon/src/logging/eventLog.ts`:

```typescript
import pino from 'pino'
import type { JobEvent } from '../types.js'

export class EventLog {
  private subs = new Map<string, Set<(e: JobEvent) => void>>()
  private hist = new Map<string, JobEvent[]>()
  private logger: pino.Logger

  constructor(logFile?: string) {
    this.logger = logFile
      ? pino(pino.destination({ dest: logFile, sync: false, mkdir: true }))
      : pino({ level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' })
  }

  subscribe(jobId: string, listener: (e: JobEvent) => void): () => void {
    if (!this.subs.has(jobId)) this.subs.set(jobId, new Set())
    this.subs.get(jobId)!.add(listener)
    for (const e of this.hist.get(jobId) ?? []) listener(e)
    return () => this.subs.get(jobId)?.delete(listener)
  }

  emit(event: JobEvent): void {
    if (!this.hist.has(event.jobId)) this.hist.set(event.jobId, [])
    this.hist.get(event.jobId)!.push(event)
    this.logger.info(event, 'jobEvent')
    for (const fn of this.subs.get(event.jobId) ?? []) {
      try { fn(event) } catch (err) { this.logger.warn({ err }, 'subscriber threw') }
    }
  }

  history(jobId: string): JobEvent[] {
    return [...(this.hist.get(jobId) ?? [])]
  }

  clearHistory(jobId: string): void {
    this.hist.delete(jobId)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 3 tests in eventLog.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/logging/eventLog.ts daemon/tests/logging/eventLog.test.ts
git commit -m "feat(daemon): event log with pub/sub + replay for late subscribers"
```

---

### Task 9: SQLite job store

**Files:**
- Create: `daemon/src/queue/jobStore.ts`
- Create: `daemon/tests/queue/jobStore.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/queue/jobStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { JobStore } from '../../src/queue/jobStore.js'
import type { Job } from '../../src/types.js'

describe('JobStore (in-memory SQLite)', () => {
  let store: JobStore

  beforeEach(() => { store = new JobStore(':memory:') })

  const sample: Job = {
    id: 'j1', toolId: 'file.read', params: { path: '/x' },
    status: 'queued', createdAt: new Date().toISOString(),
  }

  it('inserts and retrieves a job', () => {
    store.insert(sample)
    expect(store.get('j1')?.id).toBe('j1')
    expect(store.get('j1')?.status).toBe('queued')
  })

  it('updates status and timestamps', () => {
    store.insert(sample)
    store.updateStatus('j1', 'running', { startedAt: '2026-01-01T00:00:00Z' })
    expect(store.get('j1')?.status).toBe('running')
    expect(store.get('j1')?.startedAt).toBe('2026-01-01T00:00:00Z')
  })

  it('attaches a result on completion', () => {
    store.insert(sample)
    store.complete('j1', { content: 'hi' })
    const j = store.get('j1')!
    expect(j.status).toBe('done')
    expect(j.result).toEqual({ content: 'hi' })
  })

  it('attaches an error on failure', () => {
    store.insert(sample)
    store.fail('j1', { code: 'adapter_failure', message: 'boom' })
    const j = store.get('j1')!
    expect(j.status).toBe('failed')
    expect(j.error?.code).toBe('adapter_failure')
  })

  it('lists jobs newest first', () => {
    store.insert({ ...sample, id: 'a', createdAt: '2026-01-01T00:00:00Z' })
    store.insert({ ...sample, id: 'b', createdAt: '2026-01-02T00:00:00Z' })
    const all = store.list({ limit: 10 })
    expect(all[0].id).toBe('b')
    expect(all[1].id).toBe('a')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find jobStore module.

- [ ] **Step 3: Implement jobStore.ts**

Create `daemon/src/queue/jobStore.ts`:

```typescript
import Database from 'better-sqlite3'
import type { Job, JobError, JobStatus } from '../types.js'

export interface ListOptions { limit?: number; offset?: number; status?: JobStatus }

export class JobStore {
  private db: Database.Database

  constructor(filename: string) {
    this.db = new Database(filename)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id           TEXT PRIMARY KEY,
        toolId       TEXT NOT NULL,
        params       TEXT NOT NULL,
        status       TEXT NOT NULL,
        createdAt    TEXT NOT NULL,
        startedAt    TEXT,
        finishedAt   TEXT,
        result       TEXT,
        error        TEXT
      );
      CREATE INDEX IF NOT EXISTS jobs_createdAt_idx ON jobs (createdAt DESC);
    `)
  }

  insert(job: Job): void {
    this.db.prepare(`
      INSERT INTO jobs (id, toolId, params, status, createdAt, startedAt, finishedAt, result, error)
      VALUES (@id, @toolId, @params, @status, @createdAt, @startedAt, @finishedAt, @result, @error)
    `).run({
      id: job.id, toolId: job.toolId, params: JSON.stringify(job.params),
      status: job.status, createdAt: job.createdAt,
      startedAt: job.startedAt ?? null, finishedAt: job.finishedAt ?? null,
      result: job.result === undefined ? null : JSON.stringify(job.result),
      error: job.error ? JSON.stringify(job.error) : null,
    })
  }

  updateStatus(id: string, status: JobStatus, patch: Partial<Job> = {}): void {
    this.db.prepare(`
      UPDATE jobs SET status = @status,
        startedAt = COALESCE(@startedAt, startedAt),
        finishedAt = COALESCE(@finishedAt, finishedAt)
      WHERE id = @id
    `).run({
      id, status,
      startedAt: patch.startedAt ?? null,
      finishedAt: patch.finishedAt ?? null,
    })
  }

  complete(id: string, result: unknown): void {
    this.db.prepare(`
      UPDATE jobs SET status = 'done', result = @result, finishedAt = @finishedAt WHERE id = @id
    `).run({ id, result: JSON.stringify(result), finishedAt: new Date().toISOString() })
  }

  fail(id: string, error: JobError): void {
    this.db.prepare(`
      UPDATE jobs SET status = 'failed', error = @error, finishedAt = @finishedAt WHERE id = @id
    `).run({ id, error: JSON.stringify(error), finishedAt: new Date().toISOString() })
  }

  cancel(id: string): void {
    this.db.prepare(`UPDATE jobs SET status = 'cancelled', finishedAt = @finishedAt WHERE id = @id`)
      .run({ id, finishedAt: new Date().toISOString() })
  }

  get(id: string): Job | null {
    const row = this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any
    if (!row) return null
    return this.rowToJob(row)
  }

  list(opts: ListOptions = {}): Job[] {
    const limit = opts.limit ?? 50
    const offset = opts.offset ?? 0
    const rows = opts.status
      ? this.db.prepare(`SELECT * FROM jobs WHERE status = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(opts.status, limit, offset)
      : this.db.prepare(`SELECT * FROM jobs ORDER BY createdAt DESC LIMIT ? OFFSET ?`).all(limit, offset)
    return (rows as any[]).map((r) => this.rowToJob(r))
  }

  private rowToJob(r: any): Job {
    return {
      id: r.id, toolId: r.toolId, params: JSON.parse(r.params),
      status: r.status, createdAt: r.createdAt,
      startedAt: r.startedAt ?? undefined, finishedAt: r.finishedAt ?? undefined,
      result: r.result ? JSON.parse(r.result) : undefined,
      error: r.error ? JSON.parse(r.error) : undefined,
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 5 tests in jobStore.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/queue/jobStore.ts daemon/tests/queue/jobStore.test.ts
git commit -m "feat(daemon): SQLite-backed job store"
```

---

### Task 10: Job queue (FIFO + concurrency)

**Files:**
- Create: `daemon/src/queue/jobQueue.ts`
- Create: `daemon/tests/queue/jobQueue.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/queue/jobQueue.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { JobQueue } from '../../src/queue/jobQueue.js'

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

describe('JobQueue', () => {
  it('runs jobs in submission order at concurrency 1', async () => {
    const q = new JobQueue({ concurrency: 1 })
    const order: number[] = []
    const a = q.submit(async () => { order.push(1) })
    const b = q.submit(async () => { order.push(2) })
    const c = q.submit(async () => { order.push(3) })
    await Promise.all([a, b, c])
    expect(order).toEqual([1, 2, 3])
  })

  it('respects concurrency limit', async () => {
    const q = new JobQueue({ concurrency: 2 })
    let active = 0
    let maxActive = 0
    const d1 = deferred<void>(); const d2 = deferred<void>(); const d3 = deferred<void>()
    const make = (d: { promise: Promise<void> }) => async () => {
      active++; maxActive = Math.max(maxActive, active)
      await d.promise
      active--
    }
    q.submit(make(d1)); q.submit(make(d2)); q.submit(make(d3))
    await new Promise((r) => setTimeout(r, 10))
    expect(maxActive).toBe(2)
    d1.resolve(); d2.resolve(); d3.resolve()
    await new Promise((r) => setTimeout(r, 10))
  })

  it('propagates errors via the returned promise', async () => {
    const q = new JobQueue({ concurrency: 1 })
    await expect(q.submit(async () => { throw new Error('boom') })).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find jobQueue module.

- [ ] **Step 3: Implement jobQueue.ts**

Create `daemon/src/queue/jobQueue.ts`:

```typescript
type Task<T> = () => Promise<T>

interface QueueEntry<T = unknown> {
  task: Task<T>
  resolve: (v: T) => void
  reject: (err: unknown) => void
}

export interface JobQueueOptions {
  concurrency: number
}

export class JobQueue {
  private active = 0
  private waiting: QueueEntry[] = []

  constructor(private opts: JobQueueOptions) {}

  submit<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({ task: task as Task<unknown>, resolve: resolve as any, reject })
      this.tick()
    })
  }

  private tick(): void {
    while (this.active < this.opts.concurrency && this.waiting.length > 0) {
      const entry = this.waiting.shift()!
      this.active++
      entry.task()
        .then((v) => entry.resolve(v))
        .catch((err) => entry.reject(err))
        .finally(() => { this.active--; this.tick() })
    }
  }

  get activeCount(): number { return this.active }
  get pendingCount(): number { return this.waiting.length }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 3 tests in jobQueue.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/queue/jobQueue.ts daemon/tests/queue/jobQueue.test.ts
git commit -m "feat(daemon): FIFO job queue with concurrency limit"
```

---

### Task 11: File adapter

**Files:**
- Create: `daemon/src/adapters/fileAdapter.ts`
- Create: `daemon/tests/adapters/fileAdapter.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/adapters/fileAdapter.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createFileAdapter } from '../../src/adapters/fileAdapter.js'

describe('fileAdapter', () => {
  let root: string
  let adapter: ReturnType<typeof createFileAdapter>

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fa-'))
    adapter = createFileAdapter({ allowedRoots: [root] })
  })
  afterEach(() => { rmSync(root, { recursive: true, force: true }) })

  it('reads a file', async () => {
    const f = join(root, 'a.txt')
    writeFileSync(f, 'hello')
    const r = await adapter.read({ path: f })
    expect(r.content).toBe('hello')
    expect(r.sizeBytes).toBe(5)
  })

  it('writes a file (overwrite)', async () => {
    const f = join(root, 'b.txt')
    const r = await adapter.write({ path: f, content: 'world' })
    expect(r.bytesWritten).toBe(5)
    expect(existsSync(f)).toBe(true)
  })

  it('appends to a file', async () => {
    const f = join(root, 'c.txt')
    writeFileSync(f, 'a')
    await adapter.write({ path: f, content: 'b', mode: 'append' })
    const r = await adapter.read({ path: f })
    expect(r.content).toBe('ab')
  })

  it('lists directory entries', async () => {
    writeFileSync(join(root, 'x.txt'), '1')
    mkdirSync(join(root, 'sub'))
    const r = await adapter.list({ path: root })
    const names = r.entries.map((e) => e.name).sort()
    expect(names).toEqual(['sub', 'x.txt'])
  })

  it('rejects paths outside allowed roots', async () => {
    await expect(adapter.read({ path: '/etc/passwd' })).rejects.toThrow(/sandbox/i)
  })

  it('exists() returns false for missing path', async () => {
    const r = await adapter.exists({ path: join(root, 'nope') })
    expect(r.exists).toBe(false)
  })

  it('delete removes a file', async () => {
    const f = join(root, 'del.txt')
    writeFileSync(f, 'x')
    const r = await adapter.delete({ path: f })
    expect(r.deletedCount).toBe(1)
    expect(existsSync(f)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find fileAdapter.

- [ ] **Step 3: Implement fileAdapter.ts**

Create `daemon/src/adapters/fileAdapter.ts`:

```typescript
import { readFile, writeFile, appendFile, readdir, stat, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { isPathAllowed } from '../sandbox/pathPolicy.js'

const MAX_READ_BYTES = 10 * 1024 * 1024
const MAX_WRITE_BYTES = 100 * 1024 * 1024

export interface FileAdapterOptions {
  allowedRoots: string[]
}

function assertAllowed(path: string, roots: string[]): string {
  const r = isPathAllowed(path, roots)
  if (!r.ok) throw new Error(`sandbox_violation: ${r.reason}`)
  return r.resolvedPath ?? path
}

export function createFileAdapter(opts: FileAdapterOptions) {
  const { allowedRoots } = opts

  return {
    async read(params: { path: string }) {
      const resolved = assertAllowed(params.path, allowedRoots)
      const buf = await readFile(resolved)
      if (buf.length > MAX_READ_BYTES) {
        throw new Error(`adapter_failure: file exceeds ${MAX_READ_BYTES} bytes`)
      }
      return { content: buf.toString('utf8'), encoding: 'utf8' as const, sizeBytes: buf.length }
    },

    async list(params: { path: string; recursive?: boolean }) {
      const resolved = assertAllowed(params.path, allowedRoots)
      const names = await readdir(resolved)
      const entries = await Promise.all(names.map(async (name) => {
        const full = join(resolved, name)
        const s = await stat(full)
        return {
          name,
          type: s.isDirectory() ? 'dir' : 'file',
          sizeBytes: s.size,
          mtime: s.mtime.toISOString(),
        }
      }))
      return { entries }
    },

    async exists(params: { path: string }) {
      try {
        const resolved = assertAllowed(params.path, allowedRoots)
        if (!existsSync(resolved)) return { exists: false, type: null }
        const s = await stat(resolved)
        return { exists: true, type: s.isDirectory() ? 'dir' : 'file' as const }
      } catch {
        return { exists: false, type: null }
      }
    },

    async write(params: { path: string; content: string; mode?: 'overwrite' | 'append' }) {
      const resolved = assertAllowed(params.path, allowedRoots)
      const bytes = Buffer.byteLength(params.content, 'utf8')
      if (bytes > MAX_WRITE_BYTES) {
        throw new Error(`adapter_failure: content exceeds ${MAX_WRITE_BYTES} bytes`)
      }
      if (params.mode === 'append') {
        await appendFile(resolved, params.content, 'utf8')
      } else {
        await writeFile(resolved, params.content, 'utf8')
      }
      return { bytesWritten: bytes }
    },

    async delete(params: { path: string; recursive?: boolean }) {
      const resolved = assertAllowed(params.path, allowedRoots)
      await rm(resolved, { recursive: params.recursive ?? false, force: false })
      return { deletedCount: 1 }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 7 tests in fileAdapter.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/adapters/fileAdapter.ts daemon/tests/adapters/fileAdapter.test.ts
git commit -m "feat(daemon): file adapter with sandbox enforcement"
```

---

### Task 12: Shell adapter

**Files:**
- Create: `daemon/src/adapters/shellAdapter.ts`
- Create: `daemon/tests/adapters/shellAdapter.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/adapters/shellAdapter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { createShellAdapter } from '../../src/adapters/shellAdapter.js'

const ALLOW = ['node']

describe('shellAdapter', () => {
  const adapter = createShellAdapter({ allowlist: ALLOW })

  it('runs node -e and returns stdout', async () => {
    const r = await adapter.exec({ command: 'node', args: ['-e', 'process.stdout.write("hi")'] })
    expect((r as any).exitCode).toBe(0)
    expect((r as any).stdout).toBe('hi')
  })

  it('captures non-zero exit code', async () => {
    const r = await adapter.exec({ command: 'node', args: ['-e', 'process.exit(2)'] })
    expect((r as any).exitCode).toBe(2)
  })

  it('rejects non-allowlisted commands', async () => {
    await expect(adapter.exec({ command: 'rm', args: [] })).rejects.toThrow(/sandbox/i)
  })

  it('rejects shell metacharacters', async () => {
    await expect(adapter.exec({ command: 'node && rm', args: [] })).rejects.toThrow(/sandbox/i)
  })

  it('times out long-running commands', async () => {
    await expect(adapter.exec({
      command: 'node',
      args: ['-e', 'setTimeout(()=>{}, 5000)'],
      timeoutMs: 100,
    })).rejects.toThrow(/timeout/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find shellAdapter.

- [ ] **Step 3: Implement shellAdapter.ts**

Create `daemon/src/adapters/shellAdapter.ts`:

```typescript
import { spawn } from 'node:child_process'
import { isCommandAllowed } from '../sandbox/commandPolicy.js'

const DEFAULT_TIMEOUT = 60_000

export interface ShellAdapterOptions {
  allowlist: string[]
}

export function createShellAdapter(opts: ShellAdapterOptions) {
  return {
    async exec(params: {
      command: string
      args: string[]
      cwd?: string
      timeoutMs?: number
      env?: Record<string, string>
    }) {
      const check = isCommandAllowed(params.command, opts.allowlist)
      if (!check.ok) throw new Error(`sandbox_violation: ${check.reason}`)

      const start = Date.now()
      return new Promise((resolve, reject) => {
        const child = spawn(params.command, params.args, {
          cwd: params.cwd,
          env: params.env ? { ...process.env, ...params.env } : process.env,
          shell: false,
          windowsHide: true,
        })

        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (d) => { stdout += d.toString('utf8') })
        child.stderr.on('data', (d) => { stderr += d.toString('utf8') })

        const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT
        const timer = setTimeout(() => {
          child.kill('SIGTERM')
          reject(new Error(`timeout: exceeded ${timeoutMs}ms`))
        }, timeoutMs)

        child.on('error', (err) => {
          clearTimeout(timer)
          reject(new Error(`adapter_failure: ${err.message}`))
        })

        child.on('close', (code) => {
          clearTimeout(timer)
          resolve({
            stdout, stderr,
            exitCode: code ?? -1,
            durationMs: Date.now() - start,
          })
        })
      })
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 5 tests in shellAdapter.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/adapters/shellAdapter.ts daemon/tests/adapters/shellAdapter.test.ts
git commit -m "feat(daemon): shell adapter with allowlist + timeout"
```

---

### Task 13: Browser adapter (Playwright)

**Files:**
- Create: `daemon/src/adapters/browserAdapter.ts`
- Create: `daemon/tests/adapters/browserAdapter.test.ts`

- [ ] **Step 1: Install Playwright browsers**

Run from `daemon/` dir:

```bash
cd daemon && npx playwright install chromium
```

Expected: chromium downloaded. May take several minutes on first run.

- [ ] **Step 2: Write failing test**

Create `daemon/tests/adapters/browserAdapter.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, Server } from 'node:http'
import { createBrowserAdapter, BrowserAdapter } from '../../src/adapters/browserAdapter.js'

describe('browserAdapter', () => {
  let server: Server
  let baseUrl: string
  let adapter: BrowserAdapter

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`<!doctype html><html><body>
        <h1 id="title">Hello</h1>
        <input id="name" />
        <button id="go">Go</button>
      </body></html>`)
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const addr = server.address()
    baseUrl = `http://127.0.0.1:${(addr as any).port}`
    adapter = createBrowserAdapter()
  })

  afterAll(async () => {
    await adapter.shutdown()
    await new Promise<void>((r) => server.close(() => r()))
  })

  it('opens, navigates, extracts text, and closes', async () => {
    const { sessionId } = await adapter.open({})
    await adapter.navigate({ sessionId, url: baseUrl })
    const r = await adapter.extract({ sessionId, selector: '#title', attr: 'text' })
    expect(r.matches).toEqual(['Hello'])
    await adapter.close({ sessionId })
  })

  it('fills an input and reads its value back', async () => {
    const { sessionId } = await adapter.open({})
    await adapter.navigate({ sessionId, url: baseUrl })
    await adapter.fill({ sessionId, selector: '#name', value: 'Jeno' })
    const r = await adapter.extract({ sessionId, selector: '#name', attr: 'value' })
    expect(r.matches).toEqual(['Jeno'])
    await adapter.close({ sessionId })
  })

  it('rejects calls with an unknown sessionId', async () => {
    await expect(adapter.navigate({ sessionId: 'nope', url: baseUrl })).rejects.toThrow(/session/i)
  })
}, 30_000)
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find browserAdapter.

- [ ] **Step 4: Implement browserAdapter.ts**

Create `daemon/src/adapters/browserAdapter.ts`:

```typescript
import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface BrowserAdapter {
  open(p: { headless?: boolean; viewport?: { width: number; height: number } }): Promise<{ sessionId: string }>
  navigate(p: { sessionId: string; url: string; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<{ title: string; finalUrl: string; status: number | null }>
  screenshot(p: { sessionId: string; fullPage?: boolean; selector?: string; screenshotsDir: string; jobId: string }): Promise<{ path: string; sizeBytes: number }>
  extract(p: { sessionId: string; selector: string; attr?: 'text' | 'html' | 'href' | 'value' }): Promise<{ matches: string[] }>
  evaluate(p: { sessionId: string; script: string }): Promise<{ result: unknown }>
  click(p: { sessionId: string; selector: string; timeoutMs?: number }): Promise<{ clicked: true }>
  fill(p: { sessionId: string; selector: string; value: string }): Promise<{ filled: true }>
  close(p: { sessionId: string }): Promise<{ closed: true }>
  shutdown(): Promise<void>
}

interface Session {
  context: BrowserContext
  page: Page
  lastUsed: number
}

const SESSION_IDLE_MS = 30 * 60 * 1000

export function createBrowserAdapter(): BrowserAdapter {
  let browser: Browser | null = null
  const sessions = new Map<string, Session>()

  async function ensureBrowser(headless: boolean): Promise<Browser> {
    if (browser && browser.isConnected()) return browser
    browser = await chromium.launch({ headless })
    return browser
  }

  function getSession(id: string): Session {
    const s = sessions.get(id)
    if (!s) throw new Error(`adapter_failure: unknown session '${id}'`)
    s.lastUsed = Date.now()
    return s
  }

  const gcTimer = setInterval(() => {
    const now = Date.now()
    for (const [id, s] of sessions) {
      if (now - s.lastUsed > SESSION_IDLE_MS) {
        s.context.close().catch(() => {})
        sessions.delete(id)
      }
    }
  }, 60_000)
  gcTimer.unref?.()

  return {
    async open(p) {
      const b = await ensureBrowser(p.headless ?? true)
      const context = await b.newContext({ viewport: p.viewport ?? { width: 1280, height: 800 } })
      const page = await context.newPage()
      const sessionId = randomBytes(8).toString('hex')
      sessions.set(sessionId, { context, page, lastUsed: Date.now() })
      return { sessionId }
    },

    async navigate(p) {
      const s = getSession(p.sessionId)
      const resp = await s.page.goto(p.url, { waitUntil: p.waitUntil ?? 'load' })
      return {
        title: await s.page.title(),
        finalUrl: s.page.url(),
        status: resp?.status() ?? null,
      }
    },

    async screenshot(p) {
      const s = getSession(p.sessionId)
      await mkdir(p.screenshotsDir, { recursive: true })
      const path = join(p.screenshotsDir, `${p.jobId}.png`)
      if (p.selector) {
        const el = s.page.locator(p.selector).first()
        const buf = await el.screenshot({ path })
        return { path, sizeBytes: buf.length }
      }
      const buf = await s.page.screenshot({ path, fullPage: p.fullPage ?? false })
      return { path, sizeBytes: buf.length }
    },

    async extract(p) {
      const s = getSession(p.sessionId)
      const loc = s.page.locator(p.selector)
      const count = await loc.count()
      const attr = p.attr ?? 'text'
      const matches: string[] = []
      for (let i = 0; i < count; i++) {
        const el = loc.nth(i)
        if (attr === 'text') matches.push((await el.textContent()) ?? '')
        else if (attr === 'html') matches.push(await el.innerHTML())
        else if (attr === 'href') matches.push((await el.getAttribute('href')) ?? '')
        else if (attr === 'value') matches.push(await el.inputValue())
      }
      return { matches }
    },

    async evaluate(p) {
      const s = getSession(p.sessionId)
      const result = await s.page.evaluate(p.script)
      return { result }
    },

    async click(p) {
      const s = getSession(p.sessionId)
      await s.page.locator(p.selector).first().click({ timeout: p.timeoutMs ?? 5000 })
      return { clicked: true }
    },

    async fill(p) {
      const s = getSession(p.sessionId)
      await s.page.locator(p.selector).first().fill(p.value)
      return { filled: true }
    },

    async close(p) {
      const s = sessions.get(p.sessionId)
      if (s) {
        await s.context.close()
        sessions.delete(p.sessionId)
      }
      return { closed: true }
    },

    async shutdown() {
      clearInterval(gcTimer)
      for (const [, s] of sessions) await s.context.close().catch(() => {})
      sessions.clear()
      if (browser) await browser.close().catch(() => {})
      browser = null
    },
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 3 tests in browserAdapter. Tests may take 10-20s on first run.

- [ ] **Step 6: Commit**

```bash
git add daemon/src/adapters/browserAdapter.ts daemon/tests/adapters/browserAdapter.test.ts
git commit -m "feat(daemon): Playwright browser adapter with session management"
```

---

### Task 14: Tools registry

**Files:**
- Create: `daemon/src/tools/registry.ts`
- Create: `daemon/tests/tools/registry.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/tools/registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildRegistry, ToolRegistry } from '../../src/tools/registry.js'

describe('tools registry', () => {
  let root: string
  let registry: ToolRegistry

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'reg-'))
    registry = buildRegistry({
      allowedRoots: [root],
      commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'),
    })
  })
  afterEach(async () => {
    await registry.shutdown()
    rmSync(root, { recursive: true, force: true })
  })

  it('lists all 15 tool definitions', () => {
    const defs = registry.list()
    expect(defs).toHaveLength(15)
    expect(defs.find((d) => d.id === 'file.read')?.risk).toBe('read')
    expect(defs.find((d) => d.id === 'file.delete')?.risk).toBe('publish')
    expect(defs.find((d) => d.id === 'system.exec_inline')?.risk).toBe('publish')
  })

  it('runs file.write through the registry', async () => {
    const file = join(root, 'r.txt')
    const result = await registry.run('file.write', { path: file, content: 'hi' }, {
      jobId: 't1', emit: () => {}, signal: new AbortController().signal,
    })
    expect((result as any).bytesWritten).toBe(2)
  })

  it('rejects unknown toolId', async () => {
    await expect(registry.run('nope.tool', {}, {
      jobId: 't', emit: () => {}, signal: new AbortController().signal,
    })).rejects.toThrow(/unknown tool/i)
  })

  it('rejects invalid params', async () => {
    await expect(registry.run('file.read', { wrong: 'shape' }, {
      jobId: 't', emit: () => {}, signal: new AbortController().signal,
    })).rejects.toThrow(/validation/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — cannot find registry module.

- [ ] **Step 3: Implement registry.ts**

Create `daemon/src/tools/registry.ts`:

```typescript
import { schemas } from './schemas.js'
import { createFileAdapter } from '../adapters/fileAdapter.js'
import { createShellAdapter } from '../adapters/shellAdapter.js'
import { createBrowserAdapter, BrowserAdapter } from '../adapters/browserAdapter.js'
import type { ToolDefinition, ToolHandler, ToolHandlerContext, RiskLevel } from '../types.js'

const TOOL_META: Record<string, { displayName: string; description: string; risk: RiskLevel }> = {
  'file.read':           { displayName: 'Read file',         description: 'Read text contents of a file', risk: 'read' },
  'file.list':           { displayName: 'List directory',    description: 'List entries in a directory',  risk: 'read' },
  'file.exists':         { displayName: 'Check file exists', description: 'Check whether a path exists',  risk: 'read' },
  'file.write':          { displayName: 'Write file',        description: 'Write or append text to a file', risk: 'write' },
  'file.delete':         { displayName: 'Delete file',       description: 'Delete a file or directory',   risk: 'publish' },
  'system.exec':         { displayName: 'Run allowlisted command', description: 'Run an allowlisted binary with args', risk: 'write' },
  'system.exec_inline':  { displayName: 'Run inline script', description: 'Run an arbitrary shell script (approval required)', risk: 'publish' },
  'browser.open':        { displayName: 'Open browser',      description: 'Start a new browser session',   risk: 'read' },
  'browser.navigate':    { displayName: 'Navigate browser',  description: 'Navigate to a URL',             risk: 'read' },
  'browser.screenshot':  { displayName: 'Take screenshot',   description: 'Capture page or element as PNG', risk: 'read' },
  'browser.extract':     { displayName: 'Extract DOM data',  description: 'Read text/html/attrs from elements', risk: 'read' },
  'browser.evaluate':    { displayName: 'Evaluate JS',       description: 'Run JS in the page context',    risk: 'write' },
  'browser.click':       { displayName: 'Click element',     description: 'Click an element by selector',   risk: 'write' },
  'browser.fill':        { displayName: 'Fill input',        description: 'Fill an input field',           risk: 'write' },
  'browser.close':       { displayName: 'Close browser',     description: 'Close a browser session',       risk: 'read' },
}

export interface RegistryOptions {
  allowedRoots: string[]
  commandAllowlist: string[]
  screenshotsDir: string
}

export interface ToolRegistry {
  list(): ToolDefinition[]
  run(toolId: string, params: unknown, ctx: ToolHandlerContext): Promise<unknown>
  shutdown(): Promise<void>
}

export function buildRegistry(opts: RegistryOptions): ToolRegistry {
  const file = createFileAdapter({ allowedRoots: opts.allowedRoots })
  const shell = createShellAdapter({ allowlist: opts.commandAllowlist })
  const browser: BrowserAdapter = createBrowserAdapter()

  const handlers: Record<string, ToolHandler> = {
    'file.read':           async (p) => file.read(p as any),
    'file.list':           async (p) => file.list(p as any),
    'file.exists':         async (p) => file.exists(p as any),
    'file.write':          async (p) => file.write(p as any),
    'file.delete':         async (p) => file.delete(p as any),
    'system.exec':         async (p) => shell.exec(p as any),
    'system.exec_inline':  async () => { throw new Error('adapter_failure: exec_inline not implemented in Phase 1') },
    'browser.open':        async (p) => browser.open(p as any),
    'browser.navigate':    async (p) => browser.navigate(p as any),
    'browser.screenshot':  async (p, ctx) => browser.screenshot({ ...(p as any), screenshotsDir: opts.screenshotsDir, jobId: ctx.jobId }),
    'browser.extract':     async (p) => browser.extract(p as any),
    'browser.evaluate':    async (p) => browser.evaluate(p as any),
    'browser.click':       async (p) => browser.click(p as any),
    'browser.fill':        async (p) => browser.fill(p as any),
    'browser.close':       async (p) => browser.close(p as any),
  }

  return {
    list(): ToolDefinition[] {
      return Object.keys(TOOL_META).map((id) => ({
        id,
        displayName: TOOL_META[id].displayName,
        description: TOOL_META[id].description,
        risk: TOOL_META[id].risk,
        paramsSchema: null,
      }))
    },

    async run(toolId: string, params: unknown, ctx: ToolHandlerContext): Promise<unknown> {
      const handler = handlers[toolId]
      if (!handler) throw new Error(`unknown tool: ${toolId}`)
      const schema = schemas[toolId]
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 4 tests in registry.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/tools/registry.ts daemon/tests/tools/registry.test.ts
git commit -m "feat(daemon): tools registry wiring all 15 primitives"
```

---

### Task 15: HTTP server — control endpoints

**Files:**
- Modify: `daemon/src/server.ts`
- Create: `daemon/tests/server.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/server.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildServer } from '../src/server.js'
import type { FastifyInstance } from 'fastify'

describe('server', () => {
  let app: FastifyInstance
  let root: string
  const TOKEN = 'a'.repeat(64)

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'srv-'))
    app = await buildServer({
      token: TOKEN,
      allowedRoots: [root],
      commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'),
      dbPath: ':memory:',
    })
  })
  afterEach(async () => {
    await app.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('GET /health returns ok without auth', async () => {
    const r = await app.inject({ method: 'GET', url: '/health' })
    expect(r.statusCode).toBe(200)
    expect(r.json().ok).toBe(true)
  })

  it('GET /tools requires auth', async () => {
    const noAuth = await app.inject({ method: 'GET', url: '/tools' })
    expect(noAuth.statusCode).toBe(401)
    const ok = await app.inject({
      method: 'GET', url: '/tools',
      headers: { authorization: `Bearer ${TOKEN}` },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().tools).toHaveLength(15)
  })

  it('POST /jobs returns a jobId', async () => {
    const r = await app.inject({
      method: 'POST', url: '/jobs',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { toolId: 'file.exists', params: { path: '/tmp/whatever' } },
    })
    expect(r.statusCode).toBe(200)
    expect(r.json().jobId).toMatch(/^[a-f0-9]+$/)
  })

  it('POST /jobs rejects unknown tools', async () => {
    const r = await app.inject({
      method: 'POST', url: '/jobs',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { toolId: 'nope', params: {} },
    })
    expect(r.statusCode).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — buildServer not exported.

- [ ] **Step 3: Replace daemon/src/server.ts entirely**

```typescript
import Fastify, { FastifyInstance } from 'fastify'
import { randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { loadOrCreateConfig, saveActualPort, CONFIG_DIR } from './config.js'
import { verifyAuthHeader } from './auth.js'
import { buildRegistry, ToolRegistry } from './tools/registry.js'
import { JobQueue } from './queue/jobQueue.js'
import { JobStore } from './queue/jobStore.js'
import { EventLog } from './logging/eventLog.js'
import type { Job, JobEvent } from './types.js'

export interface ServerOptions {
  token: string
  allowedRoots: string[]
  commandAllowlist: string[]
  screenshotsDir: string
  dbPath: string
}

export async function buildServer(opts: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  const registry: ToolRegistry = buildRegistry({
    allowedRoots: opts.allowedRoots,
    commandAllowlist: opts.commandAllowlist,
    screenshotsDir: opts.screenshotsDir,
  })
  const queue = new JobQueue({ concurrency: 4 })
  const store = new JobStore(opts.dbPath)
  const eventLog = new EventLog()
  const cancellers = new Map<string, AbortController>()

  function requireAuth(req: any, reply: any): boolean {
    if (!verifyAuthHeader(req.headers.authorization, opts.token)) {
      reply.code(401).send({ error: 'unauthorized' })
      return false
    }
    return true
  }

  app.get('/health', async () => ({ ok: true, version: '0.0.1' }))

  app.get('/tools', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    return { tools: registry.list() }
  })

  app.post('/jobs', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const body = req.body as { toolId?: string; params?: unknown }
    if (!body?.toolId) {
      reply.code(400)
      return { error: 'toolId required' }
    }
    const known = registry.list().find((t) => t.id === body.toolId)
    if (!known) {
      reply.code(400)
      return { error: `unknown tool: ${body.toolId}` }
    }

    const jobId = randomBytes(8).toString('hex')
    const job: Job = {
      id: jobId, toolId: body.toolId, params: body.params,
      status: 'queued', createdAt: new Date().toISOString(),
    }
    store.insert(job)
    eventLog.emit({ type: 'queued', jobId })

    const ctrl = new AbortController()
    cancellers.set(jobId, ctrl)

    queue.submit(async () => {
      store.updateStatus(jobId, 'running', { startedAt: new Date().toISOString() })
      eventLog.emit({ type: 'running', jobId })
      try {
        const result = await registry.run(body.toolId!, body.params, {
          jobId,
          emit: (e: JobEvent) => eventLog.emit(e),
          signal: ctrl.signal,
        })
        store.complete(jobId, result)
        eventLog.emit({ type: 'done', jobId, result })
      } catch (err: any) {
        const msg = err?.message ?? String(err)
        const code = (msg.match(/^(\w+):/)?.[1] as any) ?? 'adapter_failure'
        const error = { code, message: msg }
        store.fail(jobId, error)
        eventLog.emit({ type: 'failed', jobId, error })
      } finally {
        cancellers.delete(jobId)
      }
    }).catch(() => { /* errors already captured to event log */ })

    return { jobId }
  })

  app.post('/jobs/:id/cancel', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const id = (req.params as any).id
    const ctrl = cancellers.get(id)
    if (!ctrl) {
      reply.code(404)
      return { error: 'job not found or already finished' }
    }
    ctrl.abort()
    store.cancel(id)
    eventLog.emit({ type: 'cancelled', jobId: id })
    return { ok: true }
  })

  app.addHook('onClose', async () => {
    await registry.shutdown()
  })

  return app
}

export async function startServer(): Promise<void> {
  const cfg = loadOrCreateConfig()
  const screenshotsDir = join(CONFIG_DIR, 'workspace', 'screenshots')
  const workspace = join(CONFIG_DIR, 'workspace')
  await mkdir(workspace, { recursive: true })
  await mkdir(screenshotsDir, { recursive: true })

  const app = await buildServer({
    token: cfg.token,
    allowedRoots: [workspace],
    commandAllowlist: ['python', 'python3', 'node', 'npm', 'git', 'curl'],
    screenshotsDir,
    dbPath: join(CONFIG_DIR, 'jobs.db'),
  })

  const address = await app.listen({ port: cfg.port || 0, host: '127.0.0.1' })
  const port = (app.server.address() as any).port
  saveActualPort(CONFIG_DIR, port)
  console.log(`flowmap-operator daemon listening on ${address}`)
}

const isMain = import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])
if (isMain) {
  startServer().catch((err) => {
    console.error('daemon failed to start:', err)
    process.exit(1)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 4 tests in server.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/server.ts daemon/tests/server.test.ts
git commit -m "feat(daemon): HTTP server with /health /tools /jobs /jobs/:id/cancel"
```

---

### Task 16: SSE streaming for job events

**Files:**
- Modify: `daemon/src/server.ts` (add SSE route)
- Create: `daemon/tests/serverSse.test.ts`

- [ ] **Step 1: Write failing test**

Create `daemon/tests/serverSse.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildServer } from '../src/server.js'
import type { FastifyInstance } from 'fastify'

describe('server SSE /jobs/:id', () => {
  let app: FastifyInstance
  let root: string
  let baseUrl: string
  const TOKEN = 'a'.repeat(64)

  beforeEach(async () => {
    root = mkdtempSync(join(tmpdir(), 'sse-'))
    app = await buildServer({
      token: TOKEN, allowedRoots: [root], commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'), dbPath: ':memory:',
    })
    await app.listen({ port: 0, host: '127.0.0.1' })
    const addr = app.server.address() as any
    baseUrl = `http://127.0.0.1:${addr.port}`
  })
  afterEach(async () => {
    await app.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('streams queued → running → done events for a file.read job', async () => {
    const f = join(root, 'x.txt'); writeFileSync(f, 'hi')
    const submit = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ toolId: 'file.read', params: { path: f } }),
    })
    const { jobId } = await submit.json() as { jobId: string }

    const sse = await fetch(`${baseUrl}/jobs/${jobId}`, {
      headers: { authorization: `Bearer ${TOKEN}`, accept: 'text/event-stream' },
    })
    expect(sse.headers.get('content-type')).toMatch(/event-stream/)

    const reader = sse.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    const types: string[] = []
    const start = Date.now()
    while (Date.now() - start < 5000) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      for (const line of buf.split('\n')) {
        const m = line.match(/^data: (.*)$/)
        if (m) {
          try {
            const evt = JSON.parse(m[1])
            if (evt.type && !types.includes(evt.type)) types.push(evt.type)
            if (evt.type === 'done' || evt.type === 'failed') {
              reader.cancel(); break
            }
          } catch {}
        }
      }
      if (types.includes('done') || types.includes('failed')) break
    }
    expect(types).toContain('queued')
    expect(types).toContain('running')
    expect(types).toContain('done')
  }, 10_000)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd daemon && npm test
```

Expected: FAIL — SSE route doesn't exist yet.

- [ ] **Step 3: Add SSE route inside buildServer**

In `daemon/src/server.ts`, add this route after `app.post('/jobs/:id/cancel', ...)` and before `app.addHook('onClose', ...)`:

```typescript
  app.get('/jobs/:id', async (req, reply) => {
    if (!requireAuth(req, reply)) return
    const id = (req.params as any).id

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const send = (event: JobEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    const unsub = eventLog.subscribe(id, send)
    req.raw.on('close', () => { unsub() })
    await new Promise<void>(() => {})
  })
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd daemon && npm test
```

Expected: PASS, 1 test in serverSse plus all earlier tests still pass.

- [ ] **Step 5: Commit**

```bash
git add daemon/src/server.ts daemon/tests/serverSse.test.ts
git commit -m "feat(daemon): SSE streaming for /jobs/:id event subscription"
```

---

### Task 17: Frontend — IntegrationType + local provider

**Files:**
- Modify: `src/mcp/types.ts`
- Create: `src/mcp/providers/localProvider.ts`

- [ ] **Step 1: Add 'local' to IntegrationType**

Open `src/mcp/types.ts`, locate the `IntegrationType` union, and append `| 'local'`:

```typescript
export type IntegrationType =
  | 'telegram'
  | 'gmail'
  | 'google_calendar'
  | 'google_drive'
  | 'google_docs'
  | 'figma'
  | 'flowmap'
  | 'local'
```

- [ ] **Step 2: Create the local provider**

First read `src/mcp/providers/types.ts` to learn the exact `MCPIntegrationProvider` interface. Then create `src/mcp/providers/localProvider.ts` matching that interface:

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPIntegration, MCPToolDefinition } from '../types.js'

async function daemonInfo(): Promise<{ port: number; token: string } | null> {
  try {
    const r = await fetch('/api/daemon/info')
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

async function call(path: string, init: RequestInit = {}) {
  const info = await daemonInfo()
  if (!info) throw new Error('Local daemon not running')
  const url = `http://127.0.0.1:${info.port}${path}`
  const headers = {
    ...(init.headers ?? {}),
    Authorization: `Bearer ${info.token}`,
    'Content-Type': 'application/json',
  }
  return fetch(url, { ...init, headers })
}

export const localProvider: MCPIntegrationProvider = {
  type: 'local',

  async listTools(_integration: MCPIntegration): Promise<MCPToolDefinition[]> {
    const r = await call('/tools')
    if (!r.ok) throw new Error(`/tools failed: ${r.status}`)
    const { tools } = await r.json() as {
      tools: Array<{ id: string; displayName: string; description: string; risk: 'read' | 'write' | 'publish' }>
    }
    return tools.map((t) => ({
      id: t.id,
      integrationId: 'local',
      toolName: t.id,
      displayName: t.displayName,
      description: t.description,
      riskLevel: t.risk,
    }))
  },

  async executeTool(toolId: string, params: unknown): Promise<unknown> {
    const submit = await call('/jobs', {
      method: 'POST',
      body: JSON.stringify({ toolId, params }),
    })
    if (!submit.ok) throw new Error(`POST /jobs failed: ${submit.status}`)
    const { jobId } = await submit.json() as { jobId: string }

    const info = await daemonInfo()
    if (!info) throw new Error('Local daemon not running')
    const sseUrl = `http://127.0.0.1:${info.port}/jobs/${jobId}`
    const sse = await fetch(sseUrl, {
      headers: { Authorization: `Bearer ${info.token}`, Accept: 'text/event-stream' },
    })
    if (!sse.ok) throw new Error(`SSE subscribe failed: ${sse.status}`)

    const reader = sse.body!.getReader()
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
        const evt = JSON.parse(m[1])
        if (evt.type === 'done') return evt.result
        if (evt.type === 'failed') throw new Error(evt.error?.message ?? 'job failed')
        if (evt.type === 'cancelled') throw new Error('job cancelled')
      }
    }
    throw new Error('SSE stream closed without terminal event')
  },

  async healthCheck(): Promise<boolean> {
    try {
      const info = await daemonInfo()
      if (!info) return false
      const r = await fetch(`http://127.0.0.1:${info.port}/health`)
      return r.ok
    } catch {
      return false
    }
  },
}
```

If `MCPIntegrationProvider` has different method signatures (look at `src/mcp/providers/types.ts` exports), adjust the implementation to match — the property names above (`type`, `listTools`, `executeTool`, `healthCheck`) are the assumed shape.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to the new file.

- [ ] **Step 4: Commit**

```bash
git add src/mcp/types.ts src/mcp/providers/localProvider.ts
git commit -m "feat(frontend): add 'local' integration type and localProvider over HTTP+SSE"
```

---

### Task 18: Vite dev proxy for daemon discovery

**Files:**
- Modify: `vite.config.js` (or `vite.config.ts`/`vite.config.mjs`)

The browser can't read `~/.flowmap/daemon.json` directly. A Vite middleware reads it and exposes it at `/api/daemon/info`.

- [ ] **Step 1: Locate vite.config**

Find: `vite.config.js`, `vite.config.ts`, or `vite.config.mjs` at project root.

- [ ] **Step 2: Add the daemonInfoPlugin**

Inside the config file, add (before `defineConfig` call) and reference inside `plugins: []`:

```javascript
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const daemonInfoPlugin = () => ({
  name: 'flowmap-daemon-info',
  configureServer(server) {
    server.middlewares.use('/api/daemon/info', (_req, res) => {
      try {
        const file = join(homedir(), '.flowmap', 'daemon.json')
        if (!existsSync(file)) {
          res.statusCode = 404
          res.end(JSON.stringify({ error: 'daemon not started' }))
          return
        }
        const cfg = JSON.parse(readFileSync(file, 'utf8'))
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ port: cfg.port, token: cfg.token }))
      } catch (err) {
        res.statusCode = 500
        res.end(JSON.stringify({ error: String(err) }))
      }
    })
  },
})
```

Then add `daemonInfoPlugin()` to the `plugins` array alongside existing plugins.

- [ ] **Step 3: Smoke test the route**

Start daemon in one terminal: `npm run daemon`. Start dev server in another: `npm run dev`. Open in browser: `http://localhost:5173/api/daemon/info`. Expected: `{port, token}` JSON.

- [ ] **Step 4: Commit**

```bash
git add vite.config.*
git commit -m "feat(frontend): Vite middleware to expose daemon.json to the browser"
```

---

### Task 19: Settings panel — Local Operator status

**Files:**
- Create: `src/components/settings/LocalOperatorPanel.jsx`
- Modify: settings UI host file (search for where Ollama controls live)

- [ ] **Step 1: Create the panel component**

Create `src/components/settings/LocalOperatorPanel.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { Cpu, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { localProvider } from '../../mcp/providers/localProvider.js'

export default function LocalOperatorPanel() {
  const [status, setStatus] = useState('checking')
  const [info, setInfo] = useState(null)

  async function refresh() {
    setStatus('checking')
    try {
      const r = await fetch('/api/daemon/info')
      if (!r.ok) { setStatus('disconnected'); setInfo(null); return }
      const cfg = await r.json()
      setInfo(cfg)
      const ok = await localProvider.healthCheck()
      setStatus(ok ? 'connected' : 'disconnected')
    } catch {
      setStatus('disconnected'); setInfo(null)
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-indigo-400" />
          <h3 className="text-sm font-medium">Local Operator</h3>
        </div>
        <button
          onClick={refresh}
          className="text-xs text-white/40 hover:text-white/70 inline-flex items-center gap-1.5"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {status === 'connected' ? (
        <div className="flex items-center gap-2 text-xs text-emerald-300/90">
          <CheckCircle2 size={12} /> Connected on port {info?.port}
        </div>
      ) : status === 'disconnected' ? (
        <div className="flex items-start gap-2 text-xs text-amber-300/90">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <div>
            <p>Daemon not running.</p>
            <p className="text-white/40 mt-1">Start with: <code className="text-white/60">npm run daemon</code></p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-white/30">Checking…</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Locate the settings host**

Run from project root:

```bash
grep -rn "OLLAMA_CONFIG" src/components --include "*.jsx" -l
```

Open the file that hosts the Settings/gear-menu UI.

- [ ] **Step 3: Mount the panel in settings**

Add import to the settings host file:

```jsx
import LocalOperatorPanel from './LocalOperatorPanel.jsx'
```

(Adjust import path based on actual file location.)

Render `<LocalOperatorPanel />` adjacent to the existing Ollama controls.

- [ ] **Step 4: Smoke test in browser**

With both `npm run dev` and `npm run daemon` running: open the gear menu in FlowMap. Expected: "Local Operator — Connected on port XXXXX". Stop the daemon, click Refresh. Expected: "Daemon not running" message with start command.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/LocalOperatorPanel.jsx <settings-host-file>
git commit -m "feat(frontend): Local Operator settings panel with connection status"
```

---

### Task 20: End-to-end integration test

**Files:**
- Create: `daemon/tests/integration/endToEnd.test.ts`

- [ ] **Step 1: Write the integration test**

Create `daemon/tests/integration/endToEnd.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { buildServer } from '../../src/server.js'
import type { FastifyInstance } from 'fastify'

const TOKEN = 'a'.repeat(64)

async function pollJob(baseUrl: string, jobId: string, token: string, timeoutMs = 30_000) {
  const sse = await fetch(`${baseUrl}/jobs/${jobId}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
  })
  const reader = sse.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n'); buf = lines.pop() ?? ''
    for (const line of lines) {
      const m = line.match(/^data: (.*)$/)
      if (!m) continue
      const evt = JSON.parse(m[1])
      if (evt.type === 'done') { reader.cancel(); return { ok: true, result: evt.result } }
      if (evt.type === 'failed') { reader.cancel(); return { ok: false, error: evt.error } }
    }
  }
  reader.cancel()
  throw new Error('job did not terminate within timeout')
}

describe('end-to-end through HTTP', () => {
  let app: FastifyInstance
  let root: string
  let baseUrl: string

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'e2e-'))
    app = await buildServer({
      token: TOKEN,
      allowedRoots: [root],
      commandAllowlist: ['node'],
      screenshotsDir: join(root, 'screenshots'),
      dbPath: ':memory:',
    })
    await app.listen({ port: 0, host: '127.0.0.1' })
    baseUrl = `http://127.0.0.1:${(app.server.address() as any).port}`
  })
  afterAll(async () => {
    await app.close()
    rmSync(root, { recursive: true, force: true })
  })

  it('file.write then file.read round-trips through the daemon', async () => {
    const file = join(root, 'e2e.txt')

    const submitWrite = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ toolId: 'file.write', params: { path: file, content: 'round-trip' } }),
    })
    const { jobId: writeId } = await submitWrite.json() as { jobId: string }
    const w = await pollJob(baseUrl, writeId, TOKEN)
    expect(w.ok).toBe(true)

    const submitRead = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ toolId: 'file.read', params: { path: file } }),
    })
    const { jobId: readId } = await submitRead.json() as { jobId: string }
    const r = await pollJob(baseUrl, readId, TOKEN)
    expect(r.ok).toBe(true)
    expect((r.result as any).content).toBe('round-trip')
  }, 30_000)

  it('system.exec runs node and returns stdout', async () => {
    const submit = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({
        toolId: 'system.exec',
        params: { command: 'node', args: ['-e', 'process.stdout.write("ok")'] },
      }),
    })
    const { jobId } = await submit.json() as { jobId: string }
    const out = await pollJob(baseUrl, jobId, TOKEN)
    expect(out.ok).toBe(true)
    expect((out.result as any).stdout).toBe('ok')
  }, 30_000)
})
```

- [ ] **Step 2: Run the test**

```bash
cd daemon && npm test
```

Expected: PASS, 2 tests in endToEnd plus all earlier tests still pass.

- [ ] **Step 3: Commit**

```bash
git add daemon/tests/integration/endToEnd.test.ts
git commit -m "test(daemon): end-to-end HTTP+SSE round-trip for file and shell tools"
```

---

## Verification checklist (after all tasks complete)

- [ ] `cd daemon && npm test` — all suites pass
- [ ] `npm run daemon` starts daemon, logs `listening on http://127.0.0.1:PORT`
- [ ] `~/.flowmap/daemon.json` exists with `{port, token}` and is owner-readable only
- [ ] `npm run dev` + open browser → Settings panel shows "Connected on port XXXXX"
- [ ] `curl http://127.0.0.1:PORT/health` returns `{"ok":true,...}`
- [ ] `curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:PORT/tools` returns 15 tools

## Out of scope (deferred to later phases)

- `system.exec_inline` adapter implementation — registry registers it, handler throws "not implemented"
- Settings panel "Restart daemon" button — Phase 1 ships with start/stop via terminal only
- Frontend MCP integration registration (turning the daemon into a registered integration the agent loop can discover) — Phase 1.5
- ACL strip on Windows for `daemon.json` is best-effort
