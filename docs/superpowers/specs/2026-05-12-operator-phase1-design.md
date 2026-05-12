# FlowMap Operator Phase 1 — Tool Registry & Action Runner

**Status:** Approved
**Date:** 2026-05-12
**Phase of:** [Operator Architecture](../../../memory/flowmap_operator_architecture.md)

## Goal

Give FlowMap the ability to execute local actions — shell scripts, file operations, and browser automation — through a structured tool catalog with permission gates, persistent execution logs, and a clean boundary between the browser frontend (control plane) and a local Node.js daemon (action plane).

## Non-goals

- Desktop GUI control (mouse/keyboard simulation, window management) — deferred to a later phase
- User-registered custom scripts via UI — deferred; primitives compose into anything Phase 2 scripts would do
- Multi-user / network access — daemon binds to `127.0.0.1` only
- Network HTTP fetch primitives — frontend already covers this via existing search adapters

## Architecture

Two-process model:

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│  FlowMap frontend (browser) │  HTTP   │  flowmap-operator daemon (Node)  │
│  ─────────────────────────  │ ──────► │  ──────────────────────────────  │
│  Chat / Agent loop          │         │  REST API  (POST /jobs)          │
│  MCP tool registry          │  SSE    │  SSE stream (GET /jobs/:id)      │
│  Approval gate UI           │ ◄────── │  Job queue (in-memory)           │
│  localProvider adapter      │         │  Adapters: file / shell / web    │
└─────────────────────────────┘         │  Execution log (SQLite)          │
                                        │  Token-auth + loopback bind      │
                                        └──────────────────────────────────┘
```

### Process boundary

- **Frontend** stays in the browser. Adds one new MCP provider (`localProvider`) and a Settings panel to start/stop and monitor the daemon.
- **Daemon** is a new Node.js process at `daemon/`, launched via `npm run daemon`. Binds to `127.0.0.1` only — never `0.0.0.0`. Listens on a random high port published to the frontend via `~/.flowmap/daemon.json`.

### Auth

Bearer token generated on first daemon start, stored in `<home>/.flowmap/daemon.json`. File permissioned to current user only:
- POSIX: `chmod 600`
- Windows: ACL stripped to current user via `icacls` on first write

Frontend reads the same file on load and sends `Authorization: Bearer <token>` on every request. Prevents other apps on the same machine from controlling the daemon.

`<home>` resolves via `os.homedir()` — `~/.flowmap/` on POSIX, `%USERPROFILE%\.flowmap\` on Windows. All paths in this spec use POSIX notation; daemon code uses `path.join` for portability.

### Communication

| Endpoint | Purpose |
|---|---|
| `POST /jobs` | Submit a new job → returns `{jobId}` synchronously |
| `GET /jobs/:id` (SSE) | Stream `queued → running → log → output → done\|failed\|cancelled` |
| `POST /jobs/:id/cancel` | Cancel a running job |
| `GET /tools` | List available tool primitives with schema + risk level |
| `GET /health` | Connection probe |

REST + SSE chosen over WebSockets: SSE is simpler, auto-reconnects, and the frontend only needs server-push (not bidirectional).

### Job lifecycle

```
submit → queued → running → [log + output events] → done | failed | cancelled
```

Every state transition is persisted to SQLite so the frontend can replay a job's history after reconnect or page reload.

## Daemon structure

```
daemon/
├── package.json
├── src/
│   ├── server.ts             ← HTTP + SSE routing
│   ├── auth.ts               ← token generation + validation
│   ├── config.ts             ← reads/writes ~/.flowmap/daemon.json
│   ├── queue/
│   │   ├── jobQueue.ts       ← in-memory FIFO, concurrency cap
│   │   └── jobStore.ts       ← SQLite persistence
│   ├── adapters/
│   │   ├── fileAdapter.ts
│   │   ├── shellAdapter.ts
│   │   └── browserAdapter.ts ← Playwright wrapper
│   ├── tools/
│   │   ├── registry.ts       ← toolId → adapter handler + schema
│   │   └── schemas.ts        ← Zod schemas for every primitive
│   ├── sandbox/
│   │   ├── pathPolicy.ts
│   │   └── commandPolicy.ts
│   ├── logging/
│   │   └── eventLog.ts       ← pino → file + SSE listeners
│   └── types.ts
└── data/
    ├── jobs.db               ← SQLite execution log
    └── daemon.log
```

### Module responsibilities

| Module | Owns |
|---|---|
| `server.ts` | HTTP routing, SSE plumbing — no business logic |
| `queue/jobQueue.ts` | Order + concurrency (cap at 4) |
| `queue/jobStore.ts` | Durability — every state transition persisted |
| `adapters/*` | Side effects. Each adapter independently testable, no HTTP dependency |
| `tools/registry.ts` | Single source of truth for tool definitions |
| `sandbox/*` | Pure functions: "yes/no, here's why" for paths and commands |
| `logging/eventLog.ts` | Structured events to file + SSE listeners |

### On-disk layout

```
~/.flowmap/
├── daemon.json              ← {port, token} - chmod 600
├── jobs.db                  ← SQLite database
├── workspace/               ← default sandboxed working dir
└── allowlist.json           ← user-editable: paths + commands
```

Daemon refuses to touch anything outside `~/.flowmap/workspace/` plus any extra paths the user explicitly adds to `allowlist.json`.

### Tech choices

- **TypeScript** to share types with the frontend
- **`better-sqlite3`** — synchronous, fast, no native compile issues on Windows
- **Playwright** over Puppeteer — better Windows support, more reliable selectors, native screenshot/PDF
- **Pino** for structured JSON logs
- **Zod** for schema validation at the HTTP boundary
- **Fastify** for the HTTP server — small, fast, first-class TypeScript

## Tool primitive catalog

Risk levels map to existing FlowMap MCP risk model:
- **read** — observation only → auto-run
- **write** — modifies local state → approval required by default
- **publish** — destructive or irreversible → strict approval + audit log

### File adapter (5 primitives)

| Tool | Risk | Params | Result |
|---|---|---|---|
| `file.read` | read | `{path}` | `{content, encoding, sizeBytes}` |
| `file.list` | read | `{path, recursive?, glob?}` | `{entries: [{name, type, sizeBytes, mtime}]}` |
| `file.exists` | read | `{path}` | `{exists, type}` |
| `file.write` | write | `{path, content, mode?: 'overwrite'\|'append'}` | `{bytesWritten}` |
| `file.delete` | publish | `{path, recursive?}` | `{deletedCount}` |

All paths resolved through `sandbox/pathPolicy.ts` — absolute, symlinks resolved, must fall inside an allowed root.

### Shell adapter (2 primitives)

| Tool | Risk | Params | Result |
|---|---|---|---|
| `system.exec` | write | `{command, args, cwd?, timeoutMs?, env?}` | `{stdout, stderr, exitCode, durationMs}` |
| `system.exec_inline` | publish | `{script, shell?: 'bash'\|'pwsh', cwd?, timeoutMs?}` | same |

- `system.exec`: `command` must be on the allowlist. Args passed as array — no shell interpolation.
- `system.exec_inline` is the escape hatch — always requires explicit approval, even when other tools auto-approve.
- Default `timeoutMs` = 60_000. Hard ceiling = 600_000.
- `stdout`/`stderr` streamed as SSE `log` events; full output returned on completion.

### Browser adapter (8 primitives)

| Tool | Risk | Params | Result |
|---|---|---|---|
| `browser.open` | read | `{headless?: true, viewport?}` | `{sessionId}` |
| `browser.navigate` | read | `{sessionId, url, waitUntil?}` | `{title, finalUrl, status}` |
| `browser.screenshot` | read | `{sessionId, fullPage?, selector?}` | `{path, sizeBytes}` |
| `browser.extract` | read | `{sessionId, selector, attr?: 'text'\|'html'\|'href'\|'value'}` | `{matches: string[]}` |
| `browser.evaluate` | write | `{sessionId, script}` | `{result}` |
| `browser.click` | write | `{sessionId, selector, timeoutMs?}` | `{clicked: true}` |
| `browser.fill` | write | `{sessionId, selector, value}` | `{filled: true}` |
| `browser.close` | read | `{sessionId}` | `{closed: true}` |

- One persistent Playwright instance; each `browser.open` returns a `sessionId` mapped to a `BrowserContext`. Sessions expire after 30 min idle.
- Screenshots written to `~/.flowmap/workspace/screenshots/{jobId}.png`.
- `browser.evaluate` runs inside Playwright's page context — real browser sandbox, no daemon-side filesystem or process access.

**Total: 15 primitives.** Schemas defined in `tools/schemas.ts` using Zod, validated at the HTTP boundary before the job enters the queue.

## Frontend integration

```
Existing FlowMap MCP                       Phase 1 changes
─────────────────────────                   ───────────────────────────────
src/mcp/types.ts                            IntegrationType += 'local'
src/mcp/providers/                          + localProvider.ts (HTTP wrapper)
src/mcp/services/mcpToolRegistry.ts         no changes (provider plug-in)
src/mcp/services/mcpExecutionService.ts     no changes (routes to provider)
src/flow-ai/agentLoopService.ts             no changes (consumes tools)
                                            + Settings panel: daemon status
```

The existing MCP system accepts new providers via the provider interface. We don't refactor any of it — we add **one new provider** that proxies to the daemon over HTTP.

### `localProvider.ts`

Implements the existing `MCPIntegrationProvider` interface:
- `listTools()` → `GET /tools` → returns `MCPToolDefinition[]`
- `executeTool(toolId, params)` → `POST /jobs` + subscribe to SSE → returns final result
- `healthCheck()` → `GET /health` → drives Settings panel status indicator

### Settings panel

New "Local Operator" section showing:
- Daemon status (connected / disconnected / not running)
- Port + token-file path
- Log file path
- Restart daemon button
- Link to `allowlist.json`

Lives next to existing Ollama controls in the gear menu.

### Approval flow

When a `write` or `publish` tool is invoked, the existing `agentLoopService` approval gate kicks in — the same UI used for `add_topic` permissions. **Zero new UI for approvals.**

## Safety, sandboxing, error handling

### Path policy (`sandbox/pathPolicy.ts`)

1. Resolve symlinks via `fs.realpath`
2. Normalize — no `..` traversal possible after resolution
3. Assert resolved path starts with one of the allowed roots from `allowlist.json`
4. Hardcoded denylist that overrides allowlist: `/etc`, `/sys`, `/proc`, `~/.ssh`, `~/.aws`, `~/.flowmap/daemon.json`

### Command policy (`sandbox/commandPolicy.ts`)

- Initial binary allowlist (logical names): `python`, `python3`, `node`, `npm`, `git`, `curl`
- Allowlist matching is case-insensitive and strips Windows `.exe`/`.cmd` suffixes before comparison
- `command` field must match a binary name exactly — no path traversal in command, no `&&` chains, no shell metacharacters
- `args[]` passed directly to `child_process.spawn` with `shell: false`
- `system.exec_inline` shell defaults to `pwsh` on Windows, `bash` on POSIX. User can override per call.

### Timeout enforcement

- Per-adapter default (file: 30s, shell: 60s, browser: 30s per primitive)
- Queue enforces hard ceiling of 600s per job

### Error categories

| Code | Meaning |
|---|---|
| `validation_failed` | Zod schema rejected the params |
| `permission_denied` | User denied the approval |
| `sandbox_violation` | Path or command policy rejected |
| `timeout` | Adapter exceeded timeout |
| `adapter_failure` | Underlying tool failed |

Every error includes `code`, `message`, and a debug-only `details` field. Frontend surfaces `message`; `details` only in dev console.

### Resource caps

- Max 4 concurrent jobs
- Max 600s per job
- Max 10MB per `file.read`
- Max 100MB per `file.write`
- Max 5 simultaneous Playwright browser contexts

## Testing approach

- **Adapter unit tests** — each adapter tested with a real temp directory / real Playwright instance, no HTTP layer involved
- **Sandbox policy tests** — exhaustive path-traversal and command-injection test cases
- **Schema tests** — every Zod schema validated against valid + invalid inputs
- **Integration test** — start daemon on a random port, hit it via `localProvider`, assert end-to-end behavior on a small workflow

No mocks for the file system or Playwright — these are the core of the daemon and mocking them would defeat the purpose.

## Open questions

None — all design questions resolved during brainstorming. Implementation can proceed via the writing-plans skill.
