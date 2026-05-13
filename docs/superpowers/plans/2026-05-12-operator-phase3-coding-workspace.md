# Operator Phase 3 — Coding Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/operator/coding` from a single-tool git-status demo into a real coding workspace — a live-editable workspace allowlist, a chat-style agent that can pick tools across the full operator surface, a read-only code viewer for files the agent reads, and a per-call approval modal for any tool with write or publish risk.

**Architecture:** The daemon's `allowedRoots` graduates from a hardcoded startup option to a live-mutable list backed by `~/.flowmap/workspace-roots.json` and exposed via REST. The frontend gets a Workspace Settings UI, a global approval modal provider, an agent-loop-powered coding view, and an inline file viewer.

**User decisions (locked):** 1=B (Settings UI with live REST), 2=A (chat agent in /operator/coding), 3=A (read-only viewer), 4=A (per-call modal approval).

**Tech Stack:** Daemon TypeScript ESM, Fastify, Vitest. Frontend React/JSX, react-router-dom, Tailwind, Prism (already in deps), existing agent loop (`runAgentLoop` in `src/flow-ai/services/agentLoopService.ts`).

---

## File Map

**Create:**
- `daemon/src/workspace/workspaceRoots.ts` — persistent allowed-roots state
- `daemon/tests/workspace/workspaceRoots.test.ts` — persistence + endpoint tests
- `src/mcp/services/daemonApi.ts` — thin TS client for daemon REST (workspace roots endpoints)
- `src/components/ui/ApprovalDialog.jsx` — modal component + provider context
- `src/components/operator/WorkspaceRootsPanel.jsx` — add/remove workspace roots UI
- `src/views/OperatorSettings.jsx` — new route `/operator/settings`
- `src/components/operator/AgentChatPanel.jsx` — chat-style agent surface for the coding view
- `src/components/operator/FileViewerPanel.jsx` — inline file viewer with Prism highlighting
- `src/components/operator/AgentEventList.jsx` — renders thought/tool_selected/step_done timeline

**Modify:**
- `daemon/src/server.ts` — wire workspaceRoots into adapters; add GET/POST/DELETE /workspace-roots; rebuild registry when roots change
- `daemon/src/adapters/fileAdapter.ts`, `daemon/src/adapters/gitAdapter.ts` — read allowedRoots from workspaceRoots store instead of static array
- `src/mcp/services/mcpExecutionService.ts` — surface approval requests to a frontend-supplied callback (or read from a global queue)
- `src/views/AICodingView.jsx` — replace single-tool form with `AgentChatPanel`
- `src/App.jsx` — add `/operator/settings` route; wrap routes in `ApprovalDialogProvider`
- `src/components/layout/LeftRail.jsx` — add Settings link under Operator section

---

## Task 1: Daemon — workspaceRoots store + persistence

**Files:**
- Create: `daemon/src/workspace/workspaceRoots.ts`
- Create: `daemon/tests/workspace/workspaceRoots.test.ts`

- [ ] **Step 1: Write the failing test.** Create `daemon/tests/workspace/workspaceRoots.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WorkspaceRoots } from '../../src/workspace/workspaceRoots.js'

describe('WorkspaceRoots', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ws-roots-'))
    file = join(dir, 'workspace-roots.json')
  })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('initialises with defaults when file missing', () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: ['/default/path'] })
    expect(store.list()).toEqual(['/default/path'])
  })

  it('loads from existing file', () => {
    writeFileSync(file, JSON.stringify(['/a', '/b']))
    const store = new WorkspaceRoots({ filePath: file, defaults: [] })
    expect(store.list()).toEqual(['/a', '/b'])
  })

  it('add() persists to disk', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: [] })
    await store.add('/new/path')
    expect(store.list()).toContain('/new/path')
    expect(JSON.parse(readFileSync(file, 'utf8'))).toContain('/new/path')
  })

  it('add() rejects duplicates', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: ['/a'] })
    await store.add('/a')
    expect(store.list().filter((p) => p === '/a')).toHaveLength(1)
  })

  it('remove() persists to disk', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: ['/a', '/b'] })
    await store.remove('/a')
    expect(store.list()).toEqual(['/b'])
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(['/b'])
  })

  it('listeners are notified on change', async () => {
    const store = new WorkspaceRoots({ filePath: file, defaults: [] })
    let count = 0
    store.onChange(() => { count++ })
    await store.add('/x')
    await store.remove('/x')
    expect(count).toBe(2)
  })
})
```

- [ ] **Step 2: Run the test — expect FAIL** (module not found):
```
cd daemon && npx vitest run tests/workspace/workspaceRoots.test.ts
```

- [ ] **Step 3: Create `daemon/src/workspace/workspaceRoots.ts`:**

```typescript
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export interface WorkspaceRootsOptions {
  filePath: string
  defaults: string[]
}

export class WorkspaceRoots {
  private roots: string[]
  private filePath: string
  private listeners: Array<(roots: string[]) => void> = []

  constructor(opts: WorkspaceRootsOptions) {
    this.filePath = opts.filePath
    if (existsSync(opts.filePath)) {
      try {
        const parsed = JSON.parse(require('node:fs').readFileSync(opts.filePath, 'utf8'))
        if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) {
          this.roots = parsed
          return
        }
      } catch { /* fall through to defaults */ }
    }
    this.roots = [...opts.defaults]
  }

  list(): string[] {
    return [...this.roots]
  }

  async add(path: string): Promise<void> {
    if (!path || this.roots.includes(path)) return
    this.roots.push(path)
    await this.save()
    this.notify()
  }

  async remove(path: string): Promise<void> {
    const before = this.roots.length
    this.roots = this.roots.filter((p) => p !== path)
    if (this.roots.length !== before) {
      await this.save()
      this.notify()
    }
  }

  onChange(listener: (roots: string[]) => void): () => void {
    this.listeners.push(listener)
    return () => { this.listeners = this.listeners.filter((l) => l !== listener) }
  }

  private async save(): Promise<void> {
    mkdirSync(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(this.roots, null, 2), 'utf8')
  }

  private notify(): void {
    const snapshot = this.list()
    for (const l of this.listeners) l(snapshot)
  }
}
```

Note: the `require` is intentional — used for synchronous reads in the constructor. The async `add`/`remove` use `fs/promises`.

- [ ] **Step 4: Run tests — expect PASS** (6 tests).

- [ ] **Step 5: Commit:**
```
git add daemon/src/workspace/workspaceRoots.ts daemon/tests/workspace/workspaceRoots.test.ts
git commit -m "feat(daemon): add WorkspaceRoots store with persistence and change listeners"
```

---

## Task 2: Daemon — wire WorkspaceRoots into adapters + add REST endpoints

**Files:**
- Modify: `daemon/src/server.ts`
- Modify: `daemon/src/adapters/fileAdapter.ts`
- Modify: `daemon/src/adapters/gitAdapter.ts`
- Modify: `daemon/src/tools/registry.ts`

The simplest design: make `allowedRoots` a getter function (closure over the store), instead of a fixed array. Adapters take `getAllowedRoots(): string[]` so live changes flow through.

- [ ] **Step 1: Read existing fileAdapter + gitAdapter** to confirm they take `allowedRoots: string[]` as a constructor option.

- [ ] **Step 2: Change adapter signatures to accept a getter.** In both `fileAdapter.ts` and `gitAdapter.ts`:

Replace:
```typescript
export interface FileAdapterOptions {
  allowedRoots: string[]
}
```

With:
```typescript
export interface FileAdapterOptions {
  getAllowedRoots: () => string[]
}
```

And update `assertAllowed` calls to use `opts.getAllowedRoots()` each call (live):
```typescript
function assertAllowed(path: string, roots: () => string[]): string {
  const r = isPathAllowed(path, roots())
  if (!r.ok) throw new Error(`sandbox_violation: ${r.reason}`)
  return r.resolvedPath ?? path
}
```

And inside the adapter methods, pass the getter:
```typescript
async read(params: { path: string }) {
  const resolved = assertAllowed(params.path, opts.getAllowedRoots)
  ...
}
```

Apply the same pattern to gitAdapter.ts.

- [ ] **Step 3: Update RegistryOptions in `daemon/src/tools/registry.ts`:**

Replace `allowedRoots: string[]` with `getAllowedRoots: () => string[]`. Pass it through to both adapters' factories.

- [ ] **Step 4: Update `daemon/src/server.ts` — initialise WorkspaceRoots and wire it through:**

Add imports:
```typescript
import { WorkspaceRoots } from './workspace/workspaceRoots.js'
```

Extend `ServerOptions`:
```typescript
export interface ServerOptions {
  token: string
  workspaceRootsPath?: string  // ~/.flowmap/workspace-roots.json
  defaultRoots: string[]       // initial fallback when file missing
  commandAllowlist: string[]
  screenshotsDir: string
  dbPath: string
  mcpRegistryPath?: string
}
```

Inside `buildServer`, after CORS register:
```typescript
const workspaceRoots = new WorkspaceRoots({
  filePath: opts.workspaceRootsPath ?? '',
  defaults: opts.defaultRoots,
})
```

Pass `getAllowedRoots: () => workspaceRoots.list()` into `buildRegistry` instead of `allowedRoots`.

- [ ] **Step 5: Add three endpoints in server.ts (after `/docker-mcp/sync`):**

```typescript
app.get('/workspace-roots', async (req, reply) => {
  if (!requireAuth(req, reply)) return
  return { roots: workspaceRoots.list() }
})

app.post('/workspace-roots', async (req, reply) => {
  if (!requireAuth(req, reply)) return
  const body = req.body as { path?: string }
  if (!body?.path || typeof body.path !== 'string') {
    reply.code(400); return { error: 'path required' }
  }
  await workspaceRoots.add(body.path)
  return { roots: workspaceRoots.list() }
})

app.delete('/workspace-roots', async (req, reply) => {
  if (!requireAuth(req, reply)) return
  const body = req.body as { path?: string }
  if (!body?.path || typeof body.path !== 'string') {
    reply.code(400); return { error: 'path required' }
  }
  await workspaceRoots.remove(body.path)
  return { roots: workspaceRoots.list() }
})
```

- [ ] **Step 6: Update `startServer` defaults:**

```typescript
const workspace = join(CONFIG_DIR, 'workspace')
const app = await buildServer({
  token: cfg.token,
  workspaceRootsPath: join(CONFIG_DIR, 'workspace-roots.json'),
  defaultRoots: [workspace],
  commandAllowlist: ['python', 'python3', 'node', 'npm', 'git', 'curl'],
  screenshotsDir,
  dbPath: join(CONFIG_DIR, 'jobs.db'),
  mcpRegistryPath: join(CONFIG_DIR, 'docker-mcp-servers.json'),
})
```

- [ ] **Step 7: Update existing daemon tests** — every test that calls `buildServer` with `allowedRoots:` needs to switch to `defaultRoots:` (or pass via `workspaceRootsPath`). Run:
```
cd daemon && npx vitest run
```
Fix any compile/test failures. Should still pass 80+ tests.

- [ ] **Step 8: Add endpoint integration test** at `daemon/tests/serverWorkspaceRoots.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildServer } from '../src/server.js'

describe('workspace-roots endpoints', () => {
  let dir: string
  let app: any

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'ws-srv-'))
    app = await buildServer({
      token: 'tk',
      workspaceRootsPath: join(dir, 'roots.json'),
      defaultRoots: [dir],
      commandAllowlist: [],
      screenshotsDir: join(dir, 'shots'),
      dbPath: ':memory:',
    })
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('GET /workspace-roots returns defaults', async () => {
    const r = await app.inject({ method: 'GET', url: '/workspace-roots', headers: { authorization: 'Bearer tk' } })
    expect(r.statusCode).toBe(200)
    expect(JSON.parse(r.payload).roots).toEqual([dir])
  })

  it('POST adds, DELETE removes', async () => {
    await app.inject({
      method: 'POST', url: '/workspace-roots',
      headers: { authorization: 'Bearer tk', 'content-type': 'application/json' },
      payload: JSON.stringify({ path: '/added' }),
    })
    let r = await app.inject({ method: 'GET', url: '/workspace-roots', headers: { authorization: 'Bearer tk' } })
    expect(JSON.parse(r.payload).roots).toContain('/added')

    await app.inject({
      method: 'DELETE', url: '/workspace-roots',
      headers: { authorization: 'Bearer tk', 'content-type': 'application/json' },
      payload: JSON.stringify({ path: '/added' }),
    })
    r = await app.inject({ method: 'GET', url: '/workspace-roots', headers: { authorization: 'Bearer tk' } })
    expect(JSON.parse(r.payload).roots).not.toContain('/added')
  })

  it('requires auth', async () => {
    const r = await app.inject({ method: 'GET', url: '/workspace-roots' })
    expect(r.statusCode).toBe(401)
  })
})
```

- [ ] **Step 9: TypeScript check + commit:**
```
cd daemon && npx tsc --noEmit
cd daemon && npx vitest run
```
```
git add daemon/src/server.ts daemon/src/adapters/fileAdapter.ts daemon/src/adapters/gitAdapter.ts daemon/src/tools/registry.ts daemon/tests/serverWorkspaceRoots.test.ts
git commit -m "feat(daemon): live-mutable allowedRoots backed by WorkspaceRoots store + REST endpoints"
```

---

## Task 3: Frontend — daemonApi helper

**Files:**
- Create: `src/mcp/services/daemonApi.ts`

A tiny TS helper that wraps the daemon's REST endpoints used by frontend operator features. Avoids re-implementing daemonInfo + bearer-auth fetch in every component.

- [ ] **Step 1: Create `src/mcp/services/daemonApi.ts`:**

```typescript
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
  if (!info) throw new Error('Local daemon not running. Start with: npm run daemon')
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
    if (!r.ok) throw new Error(`POST /workspace-roots failed: ${r.status}`)
    const body = await r.json() as { roots: string[] }
    return body.roots
  },
  async removeWorkspaceRoot(path: string): Promise<string[]> {
    const r = await call('/workspace-roots', { method: 'DELETE', body: JSON.stringify({ path }) })
    if (!r.ok) throw new Error(`DELETE /workspace-roots failed: ${r.status}`)
    const body = await r.json() as { roots: string[] }
    return body.roots
  },
}
```

- [ ] **Step 2: Commit:**
```
git add src/mcp/services/daemonApi.ts
git commit -m "feat(frontend): add daemonApi helper for workspace-roots REST"
```

---

## Task 4: Frontend — WorkspaceRootsPanel + OperatorSettings route

**Files:**
- Create: `src/components/operator/WorkspaceRootsPanel.jsx`
- Create: `src/views/OperatorSettings.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/layout/LeftRail.jsx`

- [ ] **Step 1: Create `src/components/operator/WorkspaceRootsPanel.jsx`:**

```jsx
import { useEffect, useState } from 'react'
import { Folder, Plus, X, RefreshCw, AlertCircle } from 'lucide-react'
import { daemonApi } from '../../mcp/services/daemonApi.js'

export default function WorkspaceRootsPanel() {
  const [roots, setRoots] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function refresh() {
    setError(null)
    try {
      setRoots(await daemonApi.listWorkspaceRoots())
    } catch (err) { setError(err?.message ?? String(err)) }
  }

  useEffect(() => { refresh() }, [])

  async function handleAdd() {
    if (!draft.trim() || busy) return
    setBusy(true); setError(null)
    try {
      setRoots(await daemonApi.addWorkspaceRoot(draft.trim()))
      setDraft('')
    } catch (err) { setError(err?.message ?? String(err)) }
    finally { setBusy(false) }
  }

  async function handleRemove(path) {
    if (busy) return
    setBusy(true); setError(null)
    try {
      setRoots(await daemonApi.removeWorkspaceRoot(path))
    } catch (err) { setError(err?.message ?? String(err)) }
    finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-white/8 p-5 bg-white/3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[14px] font-medium text-white/90">Workspace Roots</h2>
          <p className="text-[12px] text-white/45 mt-0.5">
            Directories the operator daemon is allowed to read, write, and run commands in.
          </p>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 rounded-md text-white/45 hover:text-white/80 hover:bg-white/5"
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-[12px] mb-3">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5 mb-3">
        {roots.length === 0 && (
          <div className="text-[12px] text-white/30 italic">No workspace roots configured.</div>
        )}
        {roots.map((path) => (
          <div key={path} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/4 border border-white/6">
            <Folder size={13} className="text-white/40 flex-shrink-0" />
            <span className="flex-1 text-[12px] font-mono text-white/80 truncate" title={path}>{path}</span>
            <button
              onClick={() => handleRemove(path)}
              disabled={busy}
              className="p-1 rounded text-white/40 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              title="Remove"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="C:\Users\JenoU\Desktop\Clari"
          className="glass-input flex-1 text-[12px] font-mono"
          disabled={busy}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !draft.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-[12px] hover:bg-indigo-500/30 disabled:opacity-40 transition-colors"
        >
          <Plus size={12} /> Add root
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/views/OperatorSettings.jsx`:**

```jsx
import { Settings as SettingsIcon } from 'lucide-react'
import WorkspaceRootsPanel from '../components/operator/WorkspaceRootsPanel.jsx'

export default function OperatorSettings() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <SettingsIcon size={18} className="text-[color:var(--color-text-tertiary)]" />
        <h1 className="text-xl font-semibold tracking-tight">Operator Settings</h1>
      </div>
      <p className="text-[13px] text-white/45 mb-6">
        Configure workspace roots, approval policy, and other daemon controls.
      </p>

      <div className="flex flex-col gap-4">
        <WorkspaceRootsPanel />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add lazy import + route in `src/App.jsx`:**

After the other `lazy()` imports:
```jsx
const OperatorSettings = lazy(() => import('./views/OperatorSettings.jsx'))
```

In `<Routes>`, after `/operator/terminal`:
```jsx
<Route path="/operator/settings" element={<OperatorSettings />} />
```

- [ ] **Step 4: Add Settings link to LeftRail Operator section.** In `src/components/layout/LeftRail.jsx`, import `Settings as SettingsIcon` from lucide-react, then add a third entry to the Operator NavLinks array:

```jsx
{ to: '/operator/settings', label: 'Settings', icon: SettingsIcon },
```

- [ ] **Step 5: Commit:**
```
git add src/components/operator/WorkspaceRootsPanel.jsx src/views/OperatorSettings.jsx src/App.jsx src/components/layout/LeftRail.jsx
git commit -m "feat(frontend): add Operator Settings view with workspace roots panel + LeftRail link"
```

---

## Task 5: Frontend — ApprovalDialog component + provider

**Files:**
- Create: `src/components/ui/ApprovalDialog.jsx`
- Modify: `src/App.jsx`

The provider exposes an `await requestApproval({ toolName, integrationName, inputSummary, riskLevel })` async function that any code can call. The modal renders on top of the app, and resolves the promise when the user clicks Approve or Deny.

- [ ] **Step 1: Create `src/components/ui/ApprovalDialog.jsx`:**

```jsx
import { createContext, useContext, useState, useCallback } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'

const ApprovalContext = createContext({ requestApproval: async () => true })

export function useApproval() { return useContext(ApprovalContext) }

export function ApprovalDialogProvider({ children }) {
  const [pending, setPending] = useState(null)

  const requestApproval = useCallback(({ toolName, integrationName, inputSummary, riskLevel }) => {
    return new Promise((resolve) => {
      setPending({
        toolName, integrationName, inputSummary, riskLevel,
        resolve: (ok) => { setPending(null); resolve(ok) },
      })
    })
  }, [])

  return (
    <ApprovalContext.Provider value={{ requestApproval }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-[color:var(--color-bg-panel)] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/25">
                <AlertTriangle size={16} className="text-amber-300" />
              </div>
              <div>
                <h2 className="text-[15px] font-medium text-white/90">Approval required</h2>
                <p className="text-[12px] text-white/50">
                  {pending.riskLevel === 'publish' ? 'Destructive operation' : 'Write operation'} on {pending.integrationName}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-white/8 bg-white/3 p-3 mb-5">
              <div className="text-[11px] uppercase tracking-widest text-white/35 mb-1">Tool</div>
              <div className="text-[13px] font-mono text-white/85 mb-3">{pending.toolName}</div>
              {pending.inputSummary && (
                <>
                  <div className="text-[11px] uppercase tracking-widest text-white/35 mb-1">Input</div>
                  <div className="text-[12px] font-mono text-white/70 whitespace-pre-wrap break-all">{pending.inputSummary}</div>
                </>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => pending.resolve(false)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] text-white/70 hover:bg-white/5 transition-colors"
              >
                <X size={14} /> Deny
              </button>
              <button
                onClick={() => pending.resolve(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-[13px] hover:bg-emerald-500/30 transition-colors"
              >
                <Check size={14} /> Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </ApprovalContext.Provider>
  )
}
```

- [ ] **Step 2: Wrap routes in `src/App.jsx`:**

Import:
```jsx
import { ApprovalDialogProvider } from './components/ui/ApprovalDialog.jsx'
```

Wrap the `<ConfirmProvider>` body (or alongside it) — inside `<BrowserRouter>`, the order should be:
```jsx
<BrowserRouter>
  <ConfirmProvider>
    <ApprovalDialogProvider>
      <DeferredWorkers />
      <div className="flex h-full">
        ...
      </div>
    </ApprovalDialogProvider>
  </ConfirmProvider>
</BrowserRouter>
```

- [ ] **Step 3: Commit:**
```
git add src/components/ui/ApprovalDialog.jsx src/App.jsx
git commit -m "feat(frontend): add ApprovalDialog modal + provider context"
```

---

## Task 6: Frontend — wire approval into runTool for write/publish tools

**Files:**
- Modify: `src/mcp/services/mcpExecutionService.ts` (or create wrapper if untouchable)
- Create: `src/mcp/services/approvalBridge.ts`

The existing `runTool` (in `mcpExecutionService.ts`) calls `checkPermission` from `mcpPermissionService` and rejects or proceeds. It needs a way to surface approval requests to the React tree. We add an `approvalBridge` singleton that holds the active `requestApproval` callback, set by the ApprovalDialogProvider on mount.

- [ ] **Step 1: Read `src/mcp/services/mcpExecutionService.ts` and `src/mcp/services/mcpPermissionService.ts`** to understand the existing approval flow.

- [ ] **Step 2: Create `src/mcp/services/approvalBridge.ts`:**

```typescript
import type { MCPToolDefinition } from '../types.js'

export interface ApprovalRequest {
  toolName: string
  integrationName: string
  inputSummary: string
  riskLevel: 'read' | 'write' | 'publish' | 'unknown'
}

type ApprovalFn = (req: ApprovalRequest) => Promise<boolean>

let active: ApprovalFn | null = null

export function setApprovalHandler(fn: ApprovalFn | null): void {
  active = fn
}

export async function requestApproval(req: ApprovalRequest): Promise<boolean> {
  if (!active) {
    console.warn('No approval handler registered — denying by default')
    return false
  }
  return active(req)
}

export function shouldGate(tool: MCPToolDefinition): boolean {
  return tool.riskLevel === 'write' || tool.riskLevel === 'publish'
}

export function buildInputSummary(input: Record<string, unknown>): string {
  return Object.entries(input)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
    .join('\n')
    .slice(0, 400)
}
```

- [ ] **Step 3: Register the handler from `ApprovalDialogProvider`.** Update `src/components/ui/ApprovalDialog.jsx` to register itself:

Add to the top:
```jsx
import { useEffect } from 'react'
import { setApprovalHandler } from '../../mcp/services/approvalBridge.js'
```

In `ApprovalDialogProvider`, before `return`:
```jsx
useEffect(() => {
  setApprovalHandler(requestApproval)
  return () => setApprovalHandler(null)
}, [requestApproval])
```

- [ ] **Step 4: Gate `runTool` in `src/mcp/services/mcpExecutionService.ts`.** Find the spot where the tool is about to be executed (after permission check passes for `approval_required` permissionMode, OR add a new gate). Before calling `provider.executeTool`, call:

```typescript
import { requestApproval, shouldGate, buildInputSummary } from './approvalBridge.js'
// ...
if (shouldGate(tool)) {
  const approved = await requestApproval({
    toolName: tool.displayName,
    integrationName: integration.name,
    inputSummary: buildInputSummary(input as Record<string, unknown>),
    riskLevel: tool.riskLevel ?? 'unknown',
  })
  if (!approved) {
    return { success: false, error: 'denied by user' }
  }
}
const result = await provider.executeTool({ integration, tool, input })
```

(Adjust signature to match the actual `runTool` shape — read first.)

- [ ] **Step 5: TS check + commit:**
```
npx tsc --noEmit -p src/mcp/tsconfig.json
```
```
git add src/mcp/services/approvalBridge.ts src/components/ui/ApprovalDialog.jsx src/mcp/services/mcpExecutionService.ts
git commit -m "feat(frontend): gate write/publish tool execution behind ApprovalDialog modal"
```

---

## Task 7: Frontend — AgentChatPanel using runAgentLoop

**Files:**
- Create: `src/components/operator/AgentEventList.jsx`
- Create: `src/components/operator/AgentChatPanel.jsx`

- [ ] **Step 1: Read `src/flow-ai/services/agentLoopService.ts`** to confirm exports: `runAgentLoop(text, options)`, `AgentEvent` types, `awaiting_approval` event has `approve()`/`deny()` callbacks.

- [ ] **Step 2: Create `src/components/operator/AgentEventList.jsx`** — renders the step timeline:

```jsx
import { Brain, Wrench, Check, X } from 'lucide-react'

function StepLine({ icon: Icon, label, text, tone = 'default' }) {
  const colorMap = {
    default: 'text-white/70',
    thought: 'text-white/60',
    tool: 'text-indigo-200',
    done: 'text-emerald-200',
    denied: 'text-red-200',
  }
  return (
    <div className="flex items-start gap-2.5 text-[12px]">
      <Icon size={12} className={`mt-0.5 flex-shrink-0 ${colorMap[tone] ?? colorMap.default}`} />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] uppercase tracking-widest text-white/35 mr-2">{label}</span>
        <span className={colorMap[tone] ?? colorMap.default}>{text}</span>
      </div>
    </div>
  )
}

export default function AgentEventList({ steps }) {
  if (steps.length === 0) return null
  return (
    <div className="flex flex-col gap-2 py-3 px-4 rounded-xl border border-white/8 bg-white/2">
      {steps.map((s, i) => {
        if (s.type === 'thought')
          return <StepLine key={i} icon={Brain} label="Thinking" text={s.text} tone="thought" />
        if (s.type === 'tool_selected')
          return <StepLine key={i} icon={Wrench} label="Using" text={s.toolName} tone="tool" />
        if (s.type === 'step_done')
          return <StepLine key={i} icon={Check} label={s.toolName} text={s.resultSummary} tone="done" />
        if (s.type === 'denied')
          return <StepLine key={i} icon={X} label="Denied" text={s.toolName} tone="denied" />
        return null
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/operator/AgentChatPanel.jsx`:**

```jsx
import { useState, useRef } from 'react'
import { Send, Loader, AlertCircle } from 'lucide-react'
import { runAgentLoop } from '../../flow-ai/services/agentLoopService.js'
import AgentEventList from './AgentEventList.jsx'

export default function AgentChatPanel({ placeholder, onFileRead }) {
  const [input, setInput] = useState('')
  const [steps, setSteps] = useState([])
  const [finalAnswer, setFinalAnswer] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const ctrlRef = useRef(null)

  async function handleSend() {
    if (!input.trim() || running) return
    const text = input.trim()
    setInput('')
    setSteps([])
    setFinalAnswer('')
    setError(null)
    setRunning(true)
    ctrlRef.current = new AbortController()

    try {
      const { steps: result, finalAnswer: answer } = await runAgentLoop(text, {
        ctrl: ctrlRef.current,
        onEvent: (event) => {
          if (event.type === 'awaiting_approval') {
            // Approval is handled by the global ApprovalDialog via approvalBridge.
            // runTool inside the agent loop will hit that path.
            return
          }
          // Detect file.read tool calls to push to the viewer
          if (event.type === 'step_done' && onFileRead && event.toolName === 'file.read') {
            // The agent emits resultSummary which is a truncated JSON. We can't
            // easily fish out the full content here; future enhancement: a
            // dedicated callback on tool execution. For now, ignore.
          }
          setSteps((prev) => [...prev, event])
        },
      })
      setFinalAnswer(answer)
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <AgentEventList steps={steps} />

      {finalAnswer && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-[13px] text-white/85 whitespace-pre-wrap">
          {finalAnswer}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-[12px]">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={placeholder ?? 'Ask the agent — e.g. "summarize this repo"'}
          className="glass-input flex-1 text-[13px]"
          disabled={running}
        />
        <button
          onClick={handleSend}
          disabled={running || !input.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-[13px] hover:bg-indigo-500/30 disabled:opacity-40 transition-colors"
        >
          {running ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
          Send
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit:**
```
git add src/components/operator/AgentEventList.jsx src/components/operator/AgentChatPanel.jsx
git commit -m "feat(frontend): add AgentChatPanel + AgentEventList components"
```

---

## Task 8: Frontend — replace AICodingView with agent chat

**Files:**
- Modify: `src/views/AICodingView.jsx`

- [ ] **Step 1: Rewrite `src/views/AICodingView.jsx`:**

```jsx
import { Code2 } from 'lucide-react'
import AgentChatPanel from '../components/operator/AgentChatPanel.jsx'

export default function AICodingView() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Code2 size={18} className="text-indigo-300" />
        <h1 className="text-xl font-semibold tracking-tight">AI Coding</h1>
      </div>
      <p className="text-[13px] text-white/45 mb-6">
        Chat-style coding agent. Add a project under <a href="/operator/settings" className="text-indigo-300 hover:underline">Operator Settings → Workspace Roots</a> before asking the agent to read files.
      </p>

      <AgentChatPanel
        placeholder='"What does daemon/src/server.ts do?" or "show me the git diff of master"'
      />
    </div>
  )
}
```

- [ ] **Step 2: Build check:**
```
npm run build 2>&1 | tail -20
```
Should succeed (modulo pre-existing unrelated errors).

- [ ] **Step 3: Commit:**
```
git add src/views/AICodingView.jsx
git commit -m "feat(frontend): replace AICodingView with chat-style agent panel"
```

---

## Task 9: Frontend — FileViewerPanel with Prism syntax highlighting

**Files:**
- Create: `src/components/operator/FileViewerPanel.jsx`
- Modify: `src/views/AICodingView.jsx` (add the panel + wire file.read interception)

`prism-react-renderer` is already in `package.json`. The panel takes `{ path, content }` and renders highlighted source.

- [ ] **Step 1: Create `src/components/operator/FileViewerPanel.jsx`:**

```jsx
import { Highlight, themes } from 'prism-react-renderer'
import { FileCode, X } from 'lucide-react'

function detectLanguage(path) {
  const ext = path.split('.').pop()?.toLowerCase()
  return {
    js: 'jsx', jsx: 'jsx', ts: 'tsx', tsx: 'tsx',
    py: 'python', go: 'go', rs: 'rust', java: 'java',
    css: 'css', html: 'markup', json: 'json',
    md: 'markdown', sh: 'bash', yml: 'yaml', yaml: 'yaml',
  }[ext] ?? 'tsx'
}

export default function FileViewerPanel({ path, content, onClose }) {
  if (!path || !content) return null
  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-white/3">
        <FileCode size={13} className="text-white/55" />
        <span className="flex-1 text-[12px] text-white/70 font-mono truncate" title={path}>{path}</span>
        <button onClick={onClose} className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/5">
          <X size={13} />
        </button>
      </div>
      <Highlight code={content} language={detectLanguage(path)} theme={themes.vsDark}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`${className} p-4 text-[11.5px] overflow-auto max-h-[480px]`} style={style}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="inline-block w-7 mr-3 text-right text-white/25 select-none">{i + 1}</span>
                {line.map((token, j) => <span key={j} {...getTokenProps({ token })} />)}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  )
}
```

- [ ] **Step 2: Wire file.read interception in AICodingView.** Update `src/views/AICodingView.jsx`:

```jsx
import { useState } from 'react'
import { Code2 } from 'lucide-react'
import AgentChatPanel from '../components/operator/AgentChatPanel.jsx'
import FileViewerPanel from '../components/operator/FileViewerPanel.jsx'

export default function AICodingView() {
  const [viewer, setViewer] = useState(null)

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Code2 size={18} className="text-indigo-300" />
        <h1 className="text-xl font-semibold tracking-tight">AI Coding</h1>
      </div>
      <p className="text-[13px] text-white/45 mb-6">
        Chat-style coding agent. Add a project under <a href="/operator/settings" className="text-indigo-300 hover:underline">Operator Settings → Workspace Roots</a> before asking the agent to read files.
      </p>

      <div className="flex flex-col gap-4">
        <AgentChatPanel
          placeholder='"What does daemon/src/server.ts do?" or "show me the git diff of master"'
          onFileRead={(path, content) => setViewer({ path, content })}
        />
        {viewer && (
          <FileViewerPanel path={viewer.path} content={viewer.content} onClose={() => setViewer(null)} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Wire the `onFileRead` callback in AgentChatPanel.** Update the `onEvent` handler inside `runAgentLoop`. The cleanest path: extend `agentLoopService` to emit a richer `step_done` with full result, OR intercept in the panel by listening to `step_done` and re-fetching via the tool.

For the simplest implementation, add a new event type emitted from agent loop: `{ type: 'tool_result_full', toolName, result }`. That requires a small change to `agentLoopService.ts`. Alternatively, hook directly: when `tool_selected` fires with name `file.read`, store the toolInput; when `step_done` fires for the same step, call the file content endpoint directly.

Approach for this task (smallest diff): patch `agentLoopService.ts` to also emit a `tool_result_full` event alongside `step_done` for `file.read` specifically (or in general). In `src/flow-ai/services/agentLoopService.ts`, find where it calls `summariseResult(result)` after `runTool`. Add:

```typescript
// After step_done emit, also surface full result for select tools
if (tool.toolName === 'file.read' && (result as any)?.content) {
  onEvent({ type: 'file_read', path: (toolInput as any).path, content: (result as any).content })
}
```

And add to `AgentEvent` type:
```typescript
| { type: 'file_read'; path: string; content: string }
```

Then in `AgentChatPanel.jsx`, handle the event:
```javascript
if (event.type === 'file_read') {
  onFileRead?.(event.path, event.content)
  return
}
```

- [ ] **Step 4: Build + commit:**
```
git add src/components/operator/FileViewerPanel.jsx src/views/AICodingView.jsx src/flow-ai/services/agentLoopService.ts src/components/operator/AgentChatPanel.jsx
git commit -m "feat(frontend): add FileViewerPanel with Prism, wire file.read into AICodingView"
```

---

## Task 10: End-to-end smoke test + plan recap

**Files:** none (manual verification + docs)

- [ ] **Step 1: Restart dev server** (Vite + auto-spawned daemon) — `npm run dev`.

- [ ] **Step 2: Open `/operator/settings`** — add `C:\Users\JenoU\Desktop\Clari` (or any actual project path) as a workspace root. Verify it persists to `~/.flowmap/workspace-roots.json`.

- [ ] **Step 3: Open `/operator/coding`** — ask: `"Show me the git status of C:\Users\JenoU\Desktop\Clari"`. Agent should pick `git.status`, run it (read-only — no approval), display the JSON result.

- [ ] **Step 4: Ask: `"Read the file C:\Users\JenoU\Desktop\Clari\package.json"`**. Agent picks `file.read`. Result content lands in the `FileViewerPanel` below the chat.

- [ ] **Step 5: Ask: `"Write 'hello' to C:\Users\JenoU\Desktop\Clari\test.txt"`**. Approval modal appears (file.write is risk `write`). Approve. File is written. Deny on a second attempt — verify the agent reports "denied by user."

- [ ] **Step 6: Update plan retrospective notes** at the bottom of this file. Add any learnings about agent loop quirks, Ollama model behavior, approval UX friction.

---

## Self-Review

### Spec coverage

| User decision | Task |
|---|---|
| 1 = B Settings UI with live REST | Tasks 2, 3, 4 |
| 2 = A Chat-style agent in /operator/coding | Tasks 7, 8 |
| 3 = A Read-only code viewer | Task 9 |
| 4 = A Modal approval per write/publish | Tasks 5, 6 |

### Placeholder check

None — every code step has full content.

### Type consistency

- `WorkspaceRoots` exported from `daemon/src/workspace/workspaceRoots.ts` is used by `server.ts` (Task 2 step 4) — class signature matches.
- `daemonApi` exports `listWorkspaceRoots / addWorkspaceRoot / removeWorkspaceRoot` — used by `WorkspaceRootsPanel` in Task 4.
- `setApprovalHandler` / `requestApproval` signatures match between `approvalBridge.ts` and `ApprovalDialog.jsx` (Task 6).
- `runAgentLoop` is the existing exported function in `src/flow-ai/services/agentLoopService.ts` — used by `AgentChatPanel` in Task 7. The `AgentEvent` type gains a new `file_read` variant in Task 9 — make sure that change is included in Task 9's commit.

### Known parking-lot items (defer to Phase 4 or hot-fix)

- `system.exec` and `system.exec_inline` cwd defaults to daemon workspace, not the user's added roots. After Phase 3, the agent may say "run npm install" but the command runs in the wrong dir. Phase 4 should allow `cwd` to be any of the workspace roots.
- `code.run_js` sandbox is still timer-only (no `--experimental-permission` or env restriction) — flagged by Phase 2 reviewer. Address in Phase 4.
- Docker MCP server config (`~/.flowmap/docker-mcp-servers.json`) is still text-edit only — add a Settings UI alongside Workspace Roots in Phase 4.
- Context7 needs HTTP-MCP transport, not stdio — Phase 4.
- ServerManager concurrency race + Docker arg denylist — Phase 4 hardening.
