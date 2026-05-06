# FlowMap MCP + Telegram Integration — Design Spec

**Date:** 2026-04-30  
**Status:** Approved  
**Scope:** v1 — Integration Hub, Tool Registry, Execution Log, Telegram outbound (real), inbound (mocked)

---

## 1. Goals

Transform FlowMap from a research workspace into an execution workspace that can connect to external tools through MCP-compatible integrations. v1 ships the platform foundation and Telegram as the first real integration.

**v1 success criteria:**
- User can connect a Telegram bot (real token + chat ID) and send messages from FlowMap
- User can browse available integrations and their tools
- All tool executions are logged with status, inputs, and outputs
- Mock providers demonstrate Google Workspace, Figma, and Canva without real API keys
- Architecture supports real inbound Telegram webhooks and additional providers without refactoring

**Out of scope for v1:**
- Real inbound Telegram commands (webhook endpoint)
- Real Google Workspace / Figma / Canva API calls
- Approval flow UI (permission mode stored, checks run, but no approval queue UI)
- Automation recipes

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  FlowMap UI (JS/JSX — untouched)                    │
│                                                     │
│  src/mcp/api.js  ←── thin JS boundary               │
└────────────────────────┬────────────────────────────┘
                         │ calls typed async functions
┌────────────────────────▼────────────────────────────┐
│  src/mcp/services/  (TypeScript)                    │
│  mcpToolRegistry.ts                                 │
│  mcpExecutionService.ts                             │
│  mcpPermissionService.ts                            │
│  telegramService.ts                                 │
│  telegramCommandRouter.ts  (stub for v2 webhooks)   │
└──────────┬──────────────────────┬───────────────────┘
           │                      │
┌──────────▼───────┐  ┌───────────▼──────────────────┐
│  providers/      │  │  storage/                    │
│  realTelegram    │  │  localMCPStorage.ts           │
│  mockTelegram    │  │  (4 localStorage namespaces)  │
│  mockGWorkspace  │  └──────────────────────────────┘
│  mockFigma       │
│  mockCanva       │
└──────────────────┘
```

**Key principle:** Services are the stable core. React hooks are thin wrappers. JS views call `src/mcp/api.js`. Future non-React surfaces (automation runner, webhook handler) call services directly — no React dependency required.

---

## 3. TypeScript Boundary Setup

### What changes
- `src/mcp/tsconfig.json` — scoped config, `include: ["src/mcp/**/*"]`, `moduleResolution: bundler`, `jsx: react-jsx`
- Vite already handles `.tsx` via `@vitejs/plugin-react` — no `vite.config.js` changes needed
- Existing `.jsx` / `.js` files are **not touched**

### JS boundary (`src/mcp/api.js`)
Plain async functions — no TypeScript types exported, no Zustand dependency:

```js
getMCPIntegrations()
connectIntegration(type, config)
disconnectIntegration(id)
getToolsForIntegration(integrationId)
getAllTools()
runTool(toolId, input)
getExecutionLog(options)
sendToTelegram(text)
getTelegramMessages()
testTelegramConnection()
```

Any JS component can `import { sendToTelegram } from '../mcp/api.js'` without importing TypeScript types.

---

## 4. Data Types (`src/mcp/types.ts`)

```ts
type IntegrationType = "telegram" | "google-workspace" | "figma" | "canva" | "generic-mcp";
type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";
type ToolPermissionMode = "auto" | "approval_required" | "read_only" | "restricted";
type ExecutionStatus = "queued" | "running" | "success" | "failed" | "cancelled" | "awaiting_approval";
type SourceSurface = "chat" | "research" | "telegram" | "automation" | "other";

interface MCPIntegration {
  id: string;
  type: IntegrationType;
  name: string;
  description?: string;
  status: IntegrationStatus;
  connectedAt?: string;
  updatedAt: string;
  config?: Record<string, string>;   // bot token, chat ID, etc. (stored locally only)
  scopes?: string[];
}

interface MCPToolDefinition {
  id: string;
  integrationId: string;
  toolName: string;
  displayName: string;
  description?: string;
  permissionMode: ToolPermissionMode;
  inputSchema?: Record<string, any>;
  tags?: string[];
}

interface MCPExecutionRecord {
  id: string;
  toolId: string;
  integrationId: string;
  sourceSurface: SourceSurface;
  status: ExecutionStatus;
  requestedAt: string;
  completedAt?: string;
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string;
}

interface TelegramCommandMessage {
  id: string;
  chatId: string;
  messageText: string;
  receivedAt: string;
  status: "received" | "processed" | "failed";
  linkedExecutionId?: string;
}
```

---

## 5. Storage Layer

**File:** `src/mcp/storage/localMCPStorage.ts`  
**Interface:** `src/mcp/storage/mcpStorage.ts`

Four localStorage namespaces:

| Key | Contents |
|---|---|
| `fm_mcp_integrations` | `MCPIntegration[]` |
| `fm_mcp_tools` | `MCPToolDefinition[]` |
| `fm_mcp_executions` | `MCPExecutionRecord[]` (capped at 500) |
| `fm_mcp_telegram_messages` | `TelegramCommandMessage[]` |

`localMCPStorage.ts` implements the full `MCPStorage` interface. Nothing else reads or writes these keys. A future `supabaseMCPStorage.ts` or `sqliteMCPStorage.ts` can drop in by implementing the same interface.

On first load, storage is seeded with:
- 5 catalog integrations (Telegram, Google Workspace, Figma, Canva, Generic MCP) — all `disconnected`
- 5 mock `TelegramCommandMessage` records (demo inbound commands)

---

## 6. Provider Layer

### Interface (`src/mcp/providers/types.ts`)
```ts
interface MCPIntegrationProvider {
  listTools(integration: MCPIntegration): Promise<MCPToolDefinition[]>;
  executeTool(params: { integration, tool, input }): Promise<{ success: boolean; output?: any; error?: string }>;
  testConnection(integration: MCPIntegration): Promise<{ success: boolean; error?: string }>;
}

interface TelegramProvider {
  sendMessage(params: { token: string; chatId: string; text: string }): Promise<{ success: boolean; messageId?: string; error?: string }>;
  testConnection(params: { token: string; chatId: string }): Promise<{ success: boolean; error?: string }>;
  handleIncomingWebhook(payload: any): Promise<TelegramCommandMessage>; // stub — wires real inbound in v2
}
```

### v1 providers

| File | Type | Notes |
|---|---|---|
| `realTelegramProvider.ts` | Real | `POST https://api.telegram.org/bot{token}/sendMessage` |
| `mockTelegramProvider.ts` | Mock | Console log + fake execution record |
| `mockGoogleWorkspaceProvider.ts` | Mock | Returns canned tool list + fake results |
| `mockFigmaProvider.ts` | Mock | Same pattern |
| `mockCanvaProvider.ts` | Mock | Same pattern |

`telegramService.ts` selects `realTelegramProvider` when the integration has a `config.token`, otherwise falls back to `mockTelegramProvider`.

---

## 7. Service Layer

### `mcpToolRegistry.ts`
- `discoverTools(integration)` — calls provider `listTools()`, upserts into storage
- `getTools(integrationId?)` — reads from storage (cached)
- Called automatically on integration connect

### `mcpPermissionService.ts`
- `checkPermission(tool)` — returns `{ allowed: boolean; requiresApproval: boolean }`
- `auto` → allowed immediately
- `approval_required` → logs to execution record with `awaiting_approval` status (approval UI in v2)
- `read_only` → allowed only for read-tagged tools
- `restricted` → blocked, execution record written as `failed`

### `mcpExecutionService.ts`
Single entry point for all tool runs:
1. Resolve tool + integration from storage
2. Call `mcpPermissionService.checkPermission(tool)`
3. If blocked → write `failed` record, return error
4. Write `queued` execution record
5. Call `provider.executeTool()`
6. Update record to `success` or `failed` with output/error summary
7. Return typed result

### `telegramService.ts`
- `sendMessage(text)` — resolves Telegram integration config, selects provider, calls send, writes execution record
- `getMessages()` — reads `TelegramCommandMessage[]` from storage
- `testConnection()` — calls `provider.testConnection()`

### `telegramCommandRouter.ts` (v2 stub)
```ts
export async function routeIncomingCommand(payload: any): Promise<void> {
  // No-op in v1. Wire real webhook parsing + execution routing here in v2.
}
```

---

## 8. React Hooks (thin wrappers)

| Hook | Wraps |
|---|---|
| `useMCPIntegrations.ts` | storage CRUD + `mcpToolRegistry.discoverTools` |
| `useMCPTools.ts` | `mcpToolRegistry.getTools` |
| `useMCPExecutions.ts` | storage read + `mcpExecutionService.run` |
| `useTelegramCommands.ts` | `telegramService.getMessages` + `sendMessage` |

Each hook owns local `useState` for loading/error state and re-fetches from storage on mount. No global React context required.

---

## 9. Pages and Routes

All pages live under `/connections`. Added to React Router alongside existing routes.

| Route | Component | Description |
|---|---|---|
| `/connections` | `MCPIntegrationsPage` | Hub: connected + available integrations |
| `/connections/:id` | `MCPIntegrationDetailPage` | Tools list, status, recent executions |
| `/connections/tools` | `MCPToolCatalogPage` | Searchable/filterable tool grid |
| `/connections/log` | `MCPExecutionLogPage` | Full execution history with status badges |
| `/connections/telegram` | `TelegramCommandCenterPage` | Bot config, test send, mock inbound messages |

### Navigation within Connections
`MCPIntegrationsPage` renders a sub-nav row: **Integrations · Tools · Log · Telegram** — consistent with FlowMap's existing section tabs pattern.

---

## 10. UI Design Rules

- All pages use FlowMap's existing `glass-panel`, `glass-scroll`, `btn`, `chip` CSS utilities
- No new design tokens introduced
- User-facing language: **Connections**, **Tools**, **Actions**, **Approvals** — not "MCP" on everyday surfaces
- "MCP" appears only in settings/detail/admin contexts
- Status badges: `connected` = teal, `error` = rose, `disconnected` = white/30, `pending` = amber
- Execution status: `success` = emerald, `failed` = rose, `queued`/`running` = amber pulse, `awaiting_approval` = purple

---

## 11. File Structure

```
src/mcp/
  types.ts
  api.js                              ← JS boundary
  tsconfig.json
  storage/
    mcpStorage.ts                     ← interface
    localMCPStorage.ts                ← localStorage impl
  providers/
    types.ts
    realTelegramProvider.ts
    mockTelegramProvider.ts
    mockGoogleWorkspaceProvider.ts
    mockFigmaProvider.ts
    mockCanvaProvider.ts
  services/
    mcpToolRegistry.ts
    mcpExecutionService.ts
    mcpPermissionService.ts
    telegramService.ts
    telegramCommandRouter.ts          ← v2 stub
  hooks/
    useMCPIntegrations.ts
    useMCPTools.ts
    useMCPExecutions.ts
    useTelegramCommands.ts
  pages/
    MCPIntegrationsPage.tsx
    MCPIntegrationDetailPage.tsx
    MCPToolCatalogPage.tsx
    MCPExecutionLogPage.tsx
    TelegramCommandCenterPage.tsx
  components/
    IntegrationCard.tsx
    IntegrationStatusBadge.tsx
    ToolCatalogList.tsx
    ExecutionRecordList.tsx
    TelegramMessageList.tsx
```

---

## 12. What Stays Out of v1

| Feature | When |
|---|---|
| Approval queue UI | v2 — permission check runs but no UI |
| Real inbound Telegram webhooks | v2 — `telegramCommandRouter.ts` stub ready |
| Real Google Workspace / Figma / Canva | After MCP layer proves stable |
| Full TypeScript migration of existing JS | Only if MCP layer proves stable and valuable |
| Tool packs (Creator Pack, Research Pack, etc.) | Nice-to-have, post-v1 |
| Background task queue | Post-v1 |
