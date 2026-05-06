# FlowMap MCP + Telegram Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full MCP platform layer to FlowMap — Integration Hub, Tool Registry, Execution Log, and Telegram (real outbound, mocked inbound) — without touching existing JS/JSX files except `src/App.jsx` for routing.

**Architecture:** TypeScript-only `src/mcp/` directory, service-first (business logic in services, thin React hooks on top, plain `src/mcp/api.js` boundary for existing JS views). Storage is an isolated localStorage implementation behind an interface so a real backend can swap in later.

**Tech Stack:** React 19, React Router v7, TypeScript 5, Vite + @vitejs/plugin-react, Vitest + @testing-library/react (already configured), Tailwind v4, Lucide-react.

---

## File Map

**Create (TypeScript):**
- `src/mcp/tsconfig.json`
- `src/mcp/types.ts`
- `src/mcp/storage/mcpStorage.ts` — interface
- `src/mcp/storage/localMCPStorage.ts` — localStorage impl + seed data
- `src/mcp/providers/types.ts` — MCPIntegrationProvider + TelegramProvider interfaces
- `src/mcp/providers/mockTelegramProvider.ts` — TelegramProvider mock
- `src/mcp/providers/realTelegramProvider.ts` — TelegramProvider (real Bot API)
- `src/mcp/providers/telegramMCPProvider.ts` — MCPIntegrationProvider for Telegram
- `src/mcp/providers/mockGoogleWorkspaceProvider.ts`
- `src/mcp/providers/mockFigmaProvider.ts`
- `src/mcp/providers/mockCanvaProvider.ts`
- `src/mcp/providers/mockGenericMCPProvider.ts`
- `src/mcp/services/mcpPermissionService.ts`
- `src/mcp/services/mcpToolRegistry.ts`
- `src/mcp/services/mcpExecutionService.ts`
- `src/mcp/services/telegramService.ts`
- `src/mcp/services/telegramCommandRouter.ts`
- `src/mcp/hooks/useMCPIntegrations.ts`
- `src/mcp/hooks/useMCPTools.ts`
- `src/mcp/hooks/useMCPExecutions.ts`
- `src/mcp/hooks/useTelegramCommands.ts`
- `src/mcp/components/IntegrationCard.tsx`
- `src/mcp/components/IntegrationStatusBadge.tsx`
- `src/mcp/components/ToolCatalogList.tsx`
- `src/mcp/components/ExecutionRecordList.tsx`
- `src/mcp/components/TelegramMessageList.tsx`
- `src/mcp/pages/MCPIntegrationsPage.tsx`
- `src/mcp/pages/MCPIntegrationDetailPage.tsx`
- `src/mcp/pages/MCPToolCatalogPage.tsx`
- `src/mcp/pages/MCPExecutionLogPage.tsx`
- `src/mcp/pages/TelegramCommandCenterPage.tsx`

**Create (JS boundary):**
- `src/mcp/api.js`

**Create (tests):**
- `src/mcp/storage/__tests__/localMCPStorage.test.ts`
- `src/mcp/services/__tests__/mcpPermissionService.test.ts`
- `src/mcp/services/__tests__/mcpExecutionService.test.ts`

**Modify:**
- `src/App.jsx` — add `/connections/*` routes

---

## Task 1: Install TypeScript and create scoped tsconfig

**Files:**
- Install: `typescript` devDependency
- Create: `src/mcp/tsconfig.json`

- [ ] **Step 1: Install TypeScript**

```bash
npm install --save-dev typescript
```

Expected output: `added 1 package`

- [ ] **Step 2: Create `src/mcp/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["**/*"]
}
```

- [ ] **Step 3: Verify Vite can process a .tsx file**

Create `src/mcp/_probe.tsx` with `export default () => <div/>` then run `npm run build` — it must succeed. Delete the file afterwards.

```bash
echo "export default () => <div/>" > src/mcp/_probe.tsx
npm run build
rm src/mcp/_probe.tsx
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/mcp/tsconfig.json
git commit -m "feat(mcp): add TypeScript + scoped tsconfig for src/mcp"
```

---

## Task 2: Core types

**Files:**
- Create: `src/mcp/types.ts`

- [ ] **Step 1: Write `src/mcp/types.ts`**

```typescript
export type IntegrationType =
  | 'telegram'
  | 'google-workspace'
  | 'figma'
  | 'canva'
  | 'generic-mcp'

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'pending'

export type ToolPermissionMode = 'auto' | 'approval_required' | 'read_only' | 'restricted'

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'awaiting_approval'

export type SourceSurface = 'chat' | 'research' | 'telegram' | 'automation' | 'other'

export interface MCPIntegration {
  id: string
  type: IntegrationType
  name: string
  description?: string
  status: IntegrationStatus
  connectedAt?: string
  updatedAt: string
  config?: Record<string, string>
  scopes?: string[]
}

export interface MCPToolDefinition {
  id: string
  integrationId: string
  toolName: string
  displayName: string
  description?: string
  permissionMode: ToolPermissionMode
  inputSchema?: Record<string, unknown>
  tags?: string[]
}

export interface MCPExecutionRecord {
  id: string
  toolId: string
  integrationId: string
  sourceSurface: SourceSurface
  status: ExecutionStatus
  requestedAt: string
  completedAt?: string
  inputSummary?: string
  outputSummary?: string
  errorMessage?: string
}

export interface TelegramCommandMessage {
  id: string
  chatId: string
  messageText: string
  receivedAt: string
  status: 'received' | 'processed' | 'failed'
  linkedExecutionId?: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mcp/types.ts
git commit -m "feat(mcp): add core TypeScript types"
```

---

## Task 3: Storage interface and localStorage implementation

**Files:**
- Create: `src/mcp/storage/mcpStorage.ts`
- Create: `src/mcp/storage/localMCPStorage.ts`
- Create: `src/mcp/storage/__tests__/localMCPStorage.test.ts`

- [ ] **Step 1: Write `src/mcp/storage/mcpStorage.ts`**

```typescript
import type {
  MCPIntegration,
  MCPToolDefinition,
  MCPExecutionRecord,
  TelegramCommandMessage,
} from '../types.js'

export interface MCPStorage {
  listIntegrations(): MCPIntegration[]
  getIntegration(id: string): MCPIntegration | null
  saveIntegration(integration: MCPIntegration): void
  updateIntegration(id: string, patch: Partial<MCPIntegration>): MCPIntegration
  deleteIntegration(id: string): void

  listTools(integrationId?: string): MCPToolDefinition[]
  saveTools(integrationId: string, tools: MCPToolDefinition[]): void

  listExecutionRecords(options?: {
    integrationId?: string
    limit?: number
  }): MCPExecutionRecord[]
  saveExecutionRecord(record: MCPExecutionRecord): void
  updateExecutionRecord(
    id: string,
    patch: Partial<MCPExecutionRecord>
  ): MCPExecutionRecord

  saveTelegramMessage(message: TelegramCommandMessage): void
  listTelegramMessages(): TelegramCommandMessage[]
}
```

- [ ] **Step 2: Write `src/mcp/storage/localMCPStorage.ts`**

```typescript
import type {
  MCPIntegration,
  MCPToolDefinition,
  MCPExecutionRecord,
  TelegramCommandMessage,
} from '../types.js'
import type { MCPStorage } from './mcpStorage.js'

const KEYS = {
  integrations: 'fm_mcp_integrations',
  tools: 'fm_mcp_tools',
  executions: 'fm_mcp_executions',
  telegramMessages: 'fm_mcp_telegram_messages',
} as const

const MAX_EXECUTIONS = 500

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

const now = Date.now()

const SEED_INTEGRATIONS: MCPIntegration[] = [
  {
    id: 'integ_telegram',
    type: 'telegram',
    name: 'Telegram',
    description: 'Send messages, files, and summaries. Receive commands from a bot.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['send_message', 'send_document'],
  },
  {
    id: 'integ_google_workspace',
    type: 'google-workspace',
    name: 'Google Workspace',
    description: 'Create Docs, append Sheets, schedule calendar events, send Gmail.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['docs.create', 'sheets.append', 'calendar.create', 'gmail.send'],
  },
  {
    id: 'integ_figma',
    type: 'figma',
    name: 'Figma',
    description: 'Inspect files, pull layer data, push content to canvases.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['file.read', 'canvas.write'],
  },
  {
    id: 'integ_canva',
    type: 'canva',
    name: 'Canva',
    description: 'Create and modify presentations, social graphics, and design assets.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
    scopes: ['design.create', 'design.edit'],
  },
  {
    id: 'integ_generic_mcp',
    type: 'generic-mcp',
    name: 'Generic MCP Server',
    description: 'Connect any MCP-compatible server to FlowMap.',
    status: 'disconnected',
    updatedAt: new Date().toISOString(),
  },
]

const SEED_TELEGRAM_MESSAGES: TelegramCommandMessage[] = [
  {
    id: 'tcm_1',
    chatId: 'demo',
    messageText: 'Summarize this URL: https://example.com/article',
    receivedAt: new Date(now - 60_000 * 5).toISOString(),
    status: 'processed',
  },
  {
    id: 'tcm_2',
    chatId: 'demo',
    messageText: 'Create a research canvas called AI competitors',
    receivedAt: new Date(now - 60_000 * 15).toISOString(),
    status: 'received',
  },
  {
    id: 'tcm_3',
    chatId: 'demo',
    messageText: 'Send me 3 caption ideas for this topic',
    receivedAt: new Date(now - 60_000 * 45).toISOString(),
    status: 'failed',
  },
  {
    id: 'tcm_4',
    chatId: 'demo',
    messageText: "What's on my calendar today?",
    receivedAt: new Date(now - 60_000 * 90).toISOString(),
    status: 'processed',
  },
  {
    id: 'tcm_5',
    chatId: 'demo',
    messageText: 'Create a Google Doc from my last note',
    receivedAt: new Date(now - 60_000 * 180).toISOString(),
    status: 'processed',
  },
]

function seedOnce(): void {
  if (!localStorage.getItem(KEYS.integrations)) {
    write(KEYS.integrations, SEED_INTEGRATIONS)
  }
  if (!localStorage.getItem(KEYS.telegramMessages)) {
    write(KEYS.telegramMessages, SEED_TELEGRAM_MESSAGES)
  }
}

export const localMCPStorage: MCPStorage = {
  listIntegrations() {
    seedOnce()
    return read<MCPIntegration[]>(KEYS.integrations, [])
  },
  getIntegration(id) {
    return this.listIntegrations().find((i) => i.id === id) ?? null
  },
  saveIntegration(integration) {
    const list = this.listIntegrations().filter((i) => i.id !== integration.id)
    write(KEYS.integrations, [...list, integration])
  },
  updateIntegration(id, patch) {
    const existing = this.getIntegration(id)
    if (!existing) throw new Error(`Integration ${id} not found`)
    const updated: MCPIntegration = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    this.saveIntegration(updated)
    return updated
  },
  deleteIntegration(id) {
    write(KEYS.integrations, this.listIntegrations().filter((i) => i.id !== id))
  },

  listTools(integrationId) {
    const all = read<MCPToolDefinition[]>(KEYS.tools, [])
    return integrationId ? all.filter((t) => t.integrationId === integrationId) : all
  },
  saveTools(integrationId, tools) {
    const others = read<MCPToolDefinition[]>(KEYS.tools, []).filter(
      (t) => t.integrationId !== integrationId
    )
    write(KEYS.tools, [...others, ...tools])
  },

  listExecutionRecords(options) {
    let records = read<MCPExecutionRecord[]>(KEYS.executions, [])
    if (options?.integrationId) {
      records = records.filter((r) => r.integrationId === options.integrationId)
    }
    records.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    return options?.limit ? records.slice(0, options.limit) : records
  },
  saveExecutionRecord(record) {
    const records = read<MCPExecutionRecord[]>(KEYS.executions, [])
    records.unshift(record)
    if (records.length > MAX_EXECUTIONS) records.splice(MAX_EXECUTIONS)
    write(KEYS.executions, records)
  },
  updateExecutionRecord(id, patch) {
    const records = read<MCPExecutionRecord[]>(KEYS.executions, [])
    const idx = records.findIndex((r) => r.id === id)
    if (idx === -1) throw new Error(`Execution record ${id} not found`)
    const updated = { ...records[idx], ...patch } as MCPExecutionRecord
    records[idx] = updated
    write(KEYS.executions, records)
    return updated
  },

  saveTelegramMessage(message) {
    seedOnce()
    const messages = read<TelegramCommandMessage[]>(KEYS.telegramMessages, [])
    write(KEYS.telegramMessages, [message, ...messages])
  },
  listTelegramMessages() {
    seedOnce()
    return read<TelegramCommandMessage[]>(KEYS.telegramMessages, [])
  },
}
```

- [ ] **Step 3: Write failing test `src/mcp/storage/__tests__/localMCPStorage.test.ts`**

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { localMCPStorage } from '../localMCPStorage.js'

beforeEach(() => {
  localStorage.clear()
})

describe('localMCPStorage.listIntegrations', () => {
  it('seeds 5 integrations on first call', () => {
    const list = localMCPStorage.listIntegrations()
    expect(list).toHaveLength(5)
    expect(list.map((i) => i.type)).toContain('telegram')
  })

  it('does not re-seed on second call', () => {
    localMCPStorage.listIntegrations()
    localMCPStorage.saveIntegration({
      id: 'integ_telegram',
      type: 'telegram',
      name: 'Telegram',
      status: 'connected',
      updatedAt: new Date().toISOString(),
    })
    const list = localMCPStorage.listIntegrations()
    const telegram = list.find((i) => i.id === 'integ_telegram')
    expect(telegram?.status).toBe('connected')
  })
})

describe('localMCPStorage.updateIntegration', () => {
  it('patches and returns the updated record', () => {
    localMCPStorage.listIntegrations()
    const updated = localMCPStorage.updateIntegration('integ_telegram', {
      status: 'connected',
    })
    expect(updated.status).toBe('connected')
    expect(localMCPStorage.getIntegration('integ_telegram')?.status).toBe('connected')
  })

  it('throws if integration does not exist', () => {
    localMCPStorage.listIntegrations()
    expect(() =>
      localMCPStorage.updateIntegration('no_such_id', { status: 'connected' })
    ).toThrow('not found')
  })
})

describe('localMCPStorage.saveTools / listTools', () => {
  it('stores and retrieves tools for an integration', () => {
    localMCPStorage.saveTools('integ_telegram', [
      {
        id: 'tg_send',
        integrationId: 'integ_telegram',
        toolName: 'send_message',
        displayName: 'Send Message',
        permissionMode: 'auto',
      },
    ])
    const tools = localMCPStorage.listTools('integ_telegram')
    expect(tools).toHaveLength(1)
    expect(tools[0].toolName).toBe('send_message')
  })

  it('replaces existing tools for the same integrationId', () => {
    localMCPStorage.saveTools('integ_telegram', [
      { id: 't1', integrationId: 'integ_telegram', toolName: 'old', displayName: 'Old', permissionMode: 'auto' },
    ])
    localMCPStorage.saveTools('integ_telegram', [
      { id: 't2', integrationId: 'integ_telegram', toolName: 'new', displayName: 'New', permissionMode: 'auto' },
    ])
    expect(localMCPStorage.listTools('integ_telegram')).toHaveLength(1)
    expect(localMCPStorage.listTools('integ_telegram')[0].toolName).toBe('new')
  })
})

describe('localMCPStorage.saveExecutionRecord', () => {
  it('prepends records and returns them in newest-first order', () => {
    localMCPStorage.saveExecutionRecord({
      id: 'exec_1',
      toolId: 't1',
      integrationId: 'integ_telegram',
      sourceSurface: 'chat',
      status: 'success',
      requestedAt: '2026-01-01T10:00:00.000Z',
    })
    localMCPStorage.saveExecutionRecord({
      id: 'exec_2',
      toolId: 't1',
      integrationId: 'integ_telegram',
      sourceSurface: 'chat',
      status: 'failed',
      requestedAt: '2026-01-01T11:00:00.000Z',
    })
    const records = localMCPStorage.listExecutionRecords()
    expect(records[0].id).toBe('exec_2')
  })
})
```

- [ ] **Step 4: Run failing test**

```bash
npm run test:run -- src/mcp/storage/__tests__/localMCPStorage.test.ts
```

Expected: FAIL — `localMCPStorage` not found (file doesn't exist yet — you already wrote it in Step 2, so tests should actually pass after writing both files together).

- [ ] **Step 5: Run test to confirm passing**

```bash
npm run test:run -- src/mcp/storage/__tests__/localMCPStorage.test.ts
```

Expected: all 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/mcp/storage/
git commit -m "feat(mcp): storage interface and localStorage implementation"
```

---

## Task 4: Provider interfaces and mock providers

**Files:**
- Create: `src/mcp/providers/types.ts`
- Create: `src/mcp/providers/mockTelegramProvider.ts`
- Create: `src/mcp/providers/telegramMCPProvider.ts`
- Create: `src/mcp/providers/mockGoogleWorkspaceProvider.ts`
- Create: `src/mcp/providers/mockFigmaProvider.ts`
- Create: `src/mcp/providers/mockCanvaProvider.ts`
- Create: `src/mcp/providers/mockGenericMCPProvider.ts`

- [ ] **Step 1: Write `src/mcp/providers/types.ts`**

```typescript
import type { MCPIntegration, MCPToolDefinition, TelegramCommandMessage } from '../types.js'

export interface MCPIntegrationProvider {
  listTools(integration: MCPIntegration): Promise<MCPToolDefinition[]>
  executeTool(params: {
    integration: MCPIntegration
    tool: MCPToolDefinition
    input: Record<string, unknown>
  }): Promise<{ success: boolean; output?: unknown; error?: string }>
  testConnection(integration: MCPIntegration): Promise<{ success: boolean; error?: string }>
}

export interface TelegramProvider {
  sendMessage(params: {
    token: string
    chatId: string
    text: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }>
  testConnection(params: {
    token: string
    chatId: string
  }): Promise<{ success: boolean; error?: string }>
  handleIncomingWebhook(payload: unknown): Promise<TelegramCommandMessage>
}
```

- [ ] **Step 2: Write `src/mcp/providers/mockTelegramProvider.ts`**

```typescript
import type { TelegramProvider } from './types.js'
import type { TelegramCommandMessage } from '../types.js'

export const mockTelegramProvider: TelegramProvider = {
  async sendMessage({ text }) {
    console.log('[MockTelegram] sendMessage:', text)
    return { success: true, messageId: `mock_${Date.now()}` }
  },
  async testConnection() {
    return { success: true }
  },
  async handleIncomingWebhook(payload): Promise<TelegramCommandMessage> {
    return {
      id: `tcm_${Date.now()}`,
      chatId: 'mock',
      messageText: String((payload as Record<string, unknown>)?.['text'] ?? ''),
      receivedAt: new Date().toISOString(),
      status: 'received',
    }
  },
}
```

- [ ] **Step 3: Write `src/mcp/providers/telegramMCPProvider.ts`**

This is the MCPIntegrationProvider facade for Telegram — it lists Telegram-specific tools and routes `executeTool` through the appropriate TelegramProvider based on whether a real token is configured.

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'
import { realTelegramProvider } from './realTelegramProvider.js'
import { mockTelegramProvider } from './mockTelegramProvider.js'

const TELEGRAM_TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'telegram_send_message',
    toolName: 'send_message',
    displayName: 'Send Message',
    description: 'Send a text message to a Telegram chat.',
    permissionMode: 'auto',
    tags: ['telegram', 'message'],
  },
  {
    id: 'telegram_send_summary',
    toolName: 'send_summary',
    displayName: 'Send Summary',
    description: 'Send a formatted summary or report to Telegram.',
    permissionMode: 'auto',
    tags: ['telegram', 'summary'],
  },
  {
    id: 'telegram_send_document',
    toolName: 'send_document',
    displayName: 'Send Document',
    description: 'Send a file or document link to Telegram.',
    permissionMode: 'auto',
    tags: ['telegram', 'document'],
  },
]

export const telegramMCPProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TELEGRAM_TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },
  async executeTool({ integration, tool, input }) {
    const token = integration.config?.['token'] ?? ''
    const chatId = integration.config?.['chatId'] ?? ''
    const provider = token ? realTelegramProvider : mockTelegramProvider
    const text = typeof input['text'] === 'string'
      ? input['text']
      : `[FlowMap] Tool: ${tool.displayName}`
    const result = await provider.sendMessage({ token, chatId, text })
    return { success: result.success, output: result, error: result.error }
  },
  async testConnection(integration) {
    const token = integration.config?.['token'] ?? ''
    const chatId = integration.config?.['chatId'] ?? ''
    if (!token || !chatId) return { success: false, error: 'Bot token and chat ID are required' }
    return realTelegramProvider.testConnection({ token, chatId })
  },
}
```

- [ ] **Step 4: Write `src/mcp/providers/mockGoogleWorkspaceProvider.ts`**

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'gws_create_doc',
    toolName: 'create_doc',
    displayName: 'Create Google Doc',
    description: 'Create a new Google Doc with provided content.',
    permissionMode: 'auto',
    tags: ['docs', 'create'],
  },
  {
    id: 'gws_append_sheet',
    toolName: 'append_sheet',
    displayName: 'Append to Sheet',
    description: 'Append rows to a Google Sheet.',
    permissionMode: 'approval_required',
    tags: ['sheets', 'write'],
  },
  {
    id: 'gws_create_calendar_event',
    toolName: 'create_calendar_event',
    displayName: 'Create Calendar Event',
    description: 'Create a new event in Google Calendar.',
    permissionMode: 'approval_required',
    tags: ['calendar', 'create'],
  },
  {
    id: 'gws_send_email',
    toolName: 'send_email',
    displayName: 'Send Email',
    description: 'Send an email via Gmail.',
    permissionMode: 'approval_required',
    tags: ['gmail', 'send'],
  },
]

export const mockGoogleWorkspaceProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },
  async executeTool({ tool, input }) {
    console.log(`[MockGoogleWorkspace] ${tool.toolName}`, input)
    return {
      success: true,
      output: { mock: true, tool: tool.toolName, note: 'Mock — no real API call made.' },
    }
  },
  async testConnection() {
    return { success: true }
  },
}
```

- [ ] **Step 5: Write `src/mcp/providers/mockFigmaProvider.ts`**

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'figma_inspect_file',
    toolName: 'inspect_file',
    displayName: 'Inspect Figma File',
    description: 'Read layers and metadata from a Figma file.',
    permissionMode: 'read_only',
    tags: ['figma', 'read'],
  },
  {
    id: 'figma_push_content',
    toolName: 'push_content',
    displayName: 'Push Content to Canvas',
    description: 'Push text content to a Figma frame.',
    permissionMode: 'approval_required',
    tags: ['figma', 'write'],
  },
]

export const mockFigmaProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },
  async executeTool({ tool, input }) {
    console.log(`[MockFigma] ${tool.toolName}`, input)
    return { success: true, output: { mock: true, tool: tool.toolName } }
  },
  async testConnection() {
    return { success: true }
  },
}
```

- [ ] **Step 6: Write `src/mcp/providers/mockCanvaProvider.ts`**

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'canva_create_design',
    toolName: 'create_design',
    displayName: 'Create Canva Design',
    description: 'Create a new Canva design from a template.',
    permissionMode: 'auto',
    tags: ['canva', 'create'],
  },
  {
    id: 'canva_generate_captions',
    toolName: 'generate_captions',
    displayName: 'Generate Captions',
    description: 'Generate social media captions from a design brief.',
    permissionMode: 'auto',
    tags: ['canva', 'captions'],
  },
]

export const mockCanvaProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },
  async executeTool({ tool, input }) {
    console.log(`[MockCanva] ${tool.toolName}`, input)
    return { success: true, output: { mock: true, tool: tool.toolName } }
  },
  async testConnection() {
    return { success: true }
  },
}
```

- [ ] **Step 7: Write `src/mcp/providers/mockGenericMCPProvider.ts`**

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'generic_ping',
    toolName: 'ping',
    displayName: 'Ping',
    description: 'Test connectivity to the MCP server.',
    permissionMode: 'auto',
    tags: ['generic', 'test'],
  },
]

export const mockGenericMCPProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },
  async executeTool({ tool, input }) {
    console.log(`[MockGenericMCP] ${tool.toolName}`, input)
    return { success: true, output: { pong: true } }
  },
  async testConnection() {
    return { success: true }
  },
}
```

- [ ] **Step 8: Commit**

```bash
git add src/mcp/providers/
git commit -m "feat(mcp): provider interfaces and all mock providers"
```

---

## Task 5: Real Telegram provider

**Files:**
- Create: `src/mcp/providers/realTelegramProvider.ts`

- [ ] **Step 1: Write `src/mcp/providers/realTelegramProvider.ts`**

```typescript
import type { TelegramProvider } from './types.js'
import type { TelegramCommandMessage } from '../types.js'

const BASE = 'https://api.telegram.org'

export const realTelegramProvider: TelegramProvider = {
  async sendMessage({ token, chatId, text }) {
    try {
      const res = await fetch(`${BASE}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      })
      const data = (await res.json()) as {
        ok: boolean
        description?: string
        result?: { message_id?: number }
      }
      if (!data.ok) {
        return { success: false, error: data.description ?? 'Telegram API error' }
      }
      return { success: true, messageId: String(data.result?.message_id ?? '') }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },

  async testConnection({ token, chatId }) {
    try {
      const res = await fetch(`${BASE}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ FlowMap connected successfully.',
        }),
      })
      const data = (await res.json()) as { ok: boolean; description?: string }
      if (!data.ok) {
        return { success: false, error: data.description ?? 'Telegram API error' }
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },

  async handleIncomingWebhook(payload): Promise<TelegramCommandMessage> {
    const p = payload as {
      message?: { chat?: { id?: number }; text?: string }
    }
    return {
      id: `tcm_${Date.now()}`,
      chatId: String(p.message?.chat?.id ?? ''),
      messageText: p.message?.text ?? '',
      receivedAt: new Date().toISOString(),
      status: 'received',
    }
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mcp/providers/realTelegramProvider.ts
git commit -m "feat(mcp): real Telegram Bot API provider"
```

---

## Task 6: Service layer

**Files:**
- Create: `src/mcp/services/mcpPermissionService.ts`
- Create: `src/mcp/services/mcpToolRegistry.ts`
- Create: `src/mcp/services/mcpExecutionService.ts`
- Create: `src/mcp/services/telegramService.ts`
- Create: `src/mcp/services/telegramCommandRouter.ts`
- Create: `src/mcp/services/__tests__/mcpPermissionService.test.ts`
- Create: `src/mcp/services/__tests__/mcpExecutionService.test.ts`

- [ ] **Step 1: Write `src/mcp/services/mcpPermissionService.ts`**

```typescript
import type { MCPToolDefinition, ToolPermissionMode } from '../types.js'

export interface PermissionResult {
  allowed: boolean
  requiresApproval: boolean
  reason?: string
}

export function checkPermission(tool: MCPToolDefinition): PermissionResult {
  const mode: ToolPermissionMode = tool.permissionMode
  switch (mode) {
    case 'auto':
      return { allowed: true, requiresApproval: false }
    case 'approval_required':
      return {
        allowed: true,
        requiresApproval: true,
        reason: `"${tool.displayName}" requires approval before running.`,
      }
    case 'read_only':
      return { allowed: true, requiresApproval: false }
    case 'restricted':
      return {
        allowed: false,
        requiresApproval: false,
        reason: `"${tool.displayName}" is restricted and cannot be run.`,
      }
  }
}
```

- [ ] **Step 2: Write failing permission service test**

Create `src/mcp/services/__tests__/mcpPermissionService.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { checkPermission } from '../mcpPermissionService.js'
import type { MCPToolDefinition } from '../../types.js'

function makeTool(permissionMode: MCPToolDefinition['permissionMode']): MCPToolDefinition {
  return {
    id: 't1',
    integrationId: 'i1',
    toolName: 'test',
    displayName: 'Test Tool',
    permissionMode,
  }
}

describe('checkPermission', () => {
  it('auto → allowed immediately', () => {
    const result = checkPermission(makeTool('auto'))
    expect(result.allowed).toBe(true)
    expect(result.requiresApproval).toBe(false)
  })

  it('approval_required → allowed but needs approval', () => {
    const result = checkPermission(makeTool('approval_required'))
    expect(result.allowed).toBe(true)
    expect(result.requiresApproval).toBe(true)
    expect(result.reason).toBeTruthy()
  })

  it('read_only → allowed without approval', () => {
    const result = checkPermission(makeTool('read_only'))
    expect(result.allowed).toBe(true)
    expect(result.requiresApproval).toBe(false)
  })

  it('restricted → blocked', () => {
    const result = checkPermission(makeTool('restricted'))
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run test — confirm PASS**

```bash
npm run test:run -- src/mcp/services/__tests__/mcpPermissionService.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 4: Write `src/mcp/services/mcpToolRegistry.ts`**

```typescript
import type { MCPIntegration, MCPToolDefinition, IntegrationType } from '../types.js'
import type { MCPIntegrationProvider } from '../providers/types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { telegramMCPProvider } from '../providers/telegramMCPProvider.js'
import { mockGoogleWorkspaceProvider } from '../providers/mockGoogleWorkspaceProvider.js'
import { mockFigmaProvider } from '../providers/mockFigmaProvider.js'
import { mockCanvaProvider } from '../providers/mockCanvaProvider.js'
import { mockGenericMCPProvider } from '../providers/mockGenericMCPProvider.js'

const PROVIDERS: Record<IntegrationType, MCPIntegrationProvider> = {
  telegram: telegramMCPProvider,
  'google-workspace': mockGoogleWorkspaceProvider,
  figma: mockFigmaProvider,
  canva: mockCanvaProvider,
  'generic-mcp': mockGenericMCPProvider,
}

export function getProvider(type: IntegrationType): MCPIntegrationProvider {
  return PROVIDERS[type]
}

export async function discoverTools(integration: MCPIntegration): Promise<MCPToolDefinition[]> {
  const provider = getProvider(integration.type)
  const tools = await provider.listTools(integration)
  localMCPStorage.saveTools(integration.id, tools)
  return tools
}

export function getTools(integrationId?: string): MCPToolDefinition[] {
  return localMCPStorage.listTools(integrationId)
}
```

- [ ] **Step 5: Write `src/mcp/services/mcpExecutionService.ts`**

```typescript
import type { MCPExecutionRecord, SourceSurface } from '../types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { checkPermission } from './mcpPermissionService.js'
import { getProvider } from './mcpToolRegistry.js'

export interface RunToolParams {
  toolId: string
  input?: Record<string, unknown>
  sourceSurface?: SourceSurface
}

export interface RunToolResult {
  success: boolean
  executionId: string
  output?: unknown
  error?: string
  requiresApproval?: boolean
}

function makeId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export async function runTool(params: RunToolParams): Promise<RunToolResult> {
  const { toolId, input = {}, sourceSurface = 'other' } = params

  const tool = localMCPStorage.listTools().find((t) => t.id === toolId)
  if (!tool) {
    return { success: false, executionId: makeId(), error: `Tool ${toolId} not found` }
  }

  const integration = localMCPStorage.getIntegration(tool.integrationId)
  if (!integration) {
    return {
      success: false,
      executionId: makeId(),
      error: `Integration ${tool.integrationId} not found`,
    }
  }

  const permission = checkPermission(tool)

  const id = makeId()
  const record: MCPExecutionRecord = {
    id,
    toolId: tool.id,
    integrationId: integration.id,
    sourceSurface,
    status: 'queued',
    requestedAt: new Date().toISOString(),
    inputSummary: Object.keys(input).length
      ? JSON.stringify(input).slice(0, 120)
      : undefined,
  }
  localMCPStorage.saveExecutionRecord(record)

  if (!permission.allowed) {
    localMCPStorage.updateExecutionRecord(id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage: permission.reason,
    })
    return { success: false, executionId: id, error: permission.reason }
  }

  if (permission.requiresApproval) {
    localMCPStorage.updateExecutionRecord(id, { status: 'awaiting_approval' })
    return {
      success: false,
      executionId: id,
      requiresApproval: true,
      error: permission.reason,
    }
  }

  localMCPStorage.updateExecutionRecord(id, { status: 'running' })

  try {
    const provider = getProvider(integration.type)
    const result = await provider.executeTool({ integration, tool, input })
    localMCPStorage.updateExecutionRecord(id, {
      status: result.success ? 'success' : 'failed',
      completedAt: new Date().toISOString(),
      outputSummary: result.output
        ? JSON.stringify(result.output).slice(0, 120)
        : undefined,
      errorMessage: result.error,
    })
    return { success: result.success, executionId: id, output: result.output, error: result.error }
  } catch (e) {
    const message = (e as Error).message
    localMCPStorage.updateExecutionRecord(id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage: message,
    })
    return { success: false, executionId: id, error: message }
  }
}

export function getExecutionLog(options?: {
  integrationId?: string
  limit?: number
}): MCPExecutionRecord[] {
  return localMCPStorage.listExecutionRecords(options)
}
```

- [ ] **Step 6: Write execution service test**

Create `src/mcp/services/__tests__/mcpExecutionService.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { runTool, getExecutionLog } from '../mcpExecutionService.js'
import { localMCPStorage } from '../../storage/localMCPStorage.js'

beforeEach(() => {
  localStorage.clear()
  // Seed a connected integration + tool for tests to use
  localMCPStorage.listIntegrations() // triggers seed
  localMCPStorage.updateIntegration('integ_canva', { status: 'connected' })
  localMCPStorage.saveTools('integ_canva', [
    {
      id: 'canva_create_design',
      integrationId: 'integ_canva',
      toolName: 'create_design',
      displayName: 'Create Canva Design',
      permissionMode: 'auto',
      tags: ['canva'],
    },
    {
      id: 'canva_restricted',
      integrationId: 'integ_canva',
      toolName: 'restricted_tool',
      displayName: 'Restricted',
      permissionMode: 'restricted',
    },
  ])
})

describe('runTool', () => {
  it('succeeds for an auto-permission tool', async () => {
    const result = await runTool({ toolId: 'canva_create_design', input: { brief: 'test' } })
    expect(result.success).toBe(true)
    expect(result.executionId).toBeTruthy()
  })

  it('writes a success execution record', async () => {
    await runTool({ toolId: 'canva_create_design' })
    const log = getExecutionLog()
    expect(log[0].status).toBe('success')
    expect(log[0].toolId).toBe('canva_create_design')
  })

  it('blocks a restricted tool and writes a failed record', async () => {
    const result = await runTool({ toolId: 'canva_restricted' })
    expect(result.success).toBe(false)
    const log = getExecutionLog()
    expect(log[0].status).toBe('failed')
  })

  it('returns error for unknown toolId', async () => {
    const result = await runTool({ toolId: 'no_such_tool' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })
})
```

- [ ] **Step 7: Run test — confirm PASS**

```bash
npm run test:run -- src/mcp/services/__tests__/mcpExecutionService.test.ts
```

Expected: 4 tests PASS

- [ ] **Step 8: Write `src/mcp/services/telegramService.ts`**

```typescript
import type { TelegramCommandMessage } from '../types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { realTelegramProvider } from '../providers/realTelegramProvider.js'
import { mockTelegramProvider } from '../providers/mockTelegramProvider.js'

function getTelegramConfig(): { token: string; chatId: string } | null {
  const integration = localMCPStorage.getIntegration('integ_telegram')
  const token = integration?.config?.['token'] ?? ''
  const chatId = integration?.config?.['chatId'] ?? ''
  return token && chatId ? { token, chatId } : null
}

export async function sendTelegramMessage(
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getTelegramConfig()
  const provider = config ? realTelegramProvider : mockTelegramProvider
  const params = config
    ? { token: config.token, chatId: config.chatId, text }
    : { token: '', chatId: '', text }
  return provider.sendMessage(params)
}

export async function testTelegramConnection(): Promise<{
  success: boolean
  error?: string
}> {
  const config = getTelegramConfig()
  if (!config) return { success: false, error: 'No bot token or chat ID configured' }
  return realTelegramProvider.testConnection(config)
}

export function getTelegramMessages(): TelegramCommandMessage[] {
  return localMCPStorage.listTelegramMessages()
}
```

- [ ] **Step 9: Write `src/mcp/services/telegramCommandRouter.ts`**

```typescript
import type { TelegramCommandMessage } from '../types.js'

// v2 stub — wire real webhook parsing and execution routing here.
// Called by a future webhook endpoint; signature is stable.
export async function routeIncomingCommand(
  _payload: unknown
): Promise<TelegramCommandMessage | null> {
  return null
}
```

- [ ] **Step 10: Commit**

```bash
git add src/mcp/services/
git commit -m "feat(mcp): service layer — permission, registry, execution, telegram"
```

---

## Task 7: React hooks

**Files:**
- Create: `src/mcp/hooks/useMCPIntegrations.ts`
- Create: `src/mcp/hooks/useMCPTools.ts`
- Create: `src/mcp/hooks/useMCPExecutions.ts`
- Create: `src/mcp/hooks/useTelegramCommands.ts`

- [ ] **Step 1: Write `src/mcp/hooks/useMCPIntegrations.ts`**

```typescript
import { useCallback, useEffect, useState } from 'react'
import type { MCPIntegration, IntegrationType } from '../types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { discoverTools } from '../services/mcpToolRegistry.js'

export function useMCPIntegrations() {
  const [integrations, setIntegrations] = useState<MCPIntegration[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setIntegrations(localMCPStorage.listIntegrations())
  }, [])

  useEffect(() => {
    reload()
    setLoading(false)
  }, [reload])

  async function connect(
    integrationId: string,
    config?: Record<string, string>
  ): Promise<void> {
    const integration = localMCPStorage.getIntegration(integrationId)
    if (!integration) return
    const updated = localMCPStorage.updateIntegration(integrationId, {
      status: 'connected',
      connectedAt: new Date().toISOString(),
      config: config ?? integration.config,
    })
    await discoverTools(updated)
    reload()
  }

  function disconnect(integrationId: string): void {
    localMCPStorage.updateIntegration(integrationId, {
      status: 'disconnected',
      config: undefined,
    })
    reload()
  }

  function updateConfig(
    integrationId: string,
    config: Record<string, string>
  ): void {
    localMCPStorage.updateIntegration(integrationId, { config })
    reload()
  }

  return { integrations, loading, connect, disconnect, updateConfig, reload }
}
```

- [ ] **Step 2: Write `src/mcp/hooks/useMCPTools.ts`**

```typescript
import { useEffect, useState } from 'react'
import type { MCPToolDefinition } from '../types.js'
import { getTools } from '../services/mcpToolRegistry.js'

export function useMCPTools(integrationId?: string) {
  const [tools, setTools] = useState<MCPToolDefinition[]>([])

  useEffect(() => {
    setTools(getTools(integrationId))
  }, [integrationId])

  return { tools }
}
```

- [ ] **Step 3: Write `src/mcp/hooks/useMCPExecutions.ts`**

```typescript
import { useCallback, useEffect, useState } from 'react'
import type { MCPExecutionRecord } from '../types.js'
import { getExecutionLog, runTool } from '../services/mcpExecutionService.js'
import type { RunToolParams, RunToolResult } from '../services/mcpExecutionService.js'

export function useMCPExecutions(integrationId?: string) {
  const [records, setRecords] = useState<MCPExecutionRecord[]>([])
  const [running, setRunning] = useState(false)

  const reload = useCallback(() => {
    setRecords(getExecutionLog({ integrationId }))
  }, [integrationId])

  useEffect(() => {
    reload()
  }, [reload])

  async function execute(params: RunToolParams): Promise<RunToolResult> {
    setRunning(true)
    try {
      const result = await runTool(params)
      reload()
      return result
    } finally {
      setRunning(false)
    }
  }

  return { records, running, execute, reload }
}
```

- [ ] **Step 4: Write `src/mcp/hooks/useTelegramCommands.ts`**

```typescript
import { useCallback, useEffect, useState } from 'react'
import type { TelegramCommandMessage } from '../types.js'
import {
  getTelegramMessages,
  sendTelegramMessage,
  testTelegramConnection,
} from '../services/telegramService.js'

export function useTelegramCommands() {
  const [messages, setMessages] = useState<TelegramCommandMessage[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setMessages(getTelegramMessages())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function send(text: string): Promise<boolean> {
    setSending(true)
    setSendError(null)
    try {
      const result = await sendTelegramMessage(text)
      if (!result.success) setSendError(result.error ?? 'Failed to send')
      reload()
      return result.success
    } finally {
      setSending(false)
    }
  }

  async function testConnection(): Promise<{ success: boolean; error?: string }> {
    return testTelegramConnection()
  }

  return { messages, sending, sendError, send, testConnection, reload }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/mcp/hooks/
git commit -m "feat(mcp): React hooks — integrations, tools, executions, telegram"
```

---

## Task 8: JS boundary

**Files:**
- Create: `src/mcp/api.js`

- [ ] **Step 1: Write `src/mcp/api.js`**

This file has no TypeScript — it's plain JS so any existing `.jsx` file can import from it without any type configuration.

```javascript
// Thin JS boundary — existing JSX views import from here.
// All implementation is in TypeScript services under src/mcp/services/.

export async function getMCPIntegrations() {
  const { localMCPStorage } = await import('./storage/localMCPStorage.js')
  return localMCPStorage.listIntegrations()
}

export async function connectIntegration(integrationId, config) {
  const { localMCPStorage } = await import('./storage/localMCPStorage.js')
  const { discoverTools } = await import('./services/mcpToolRegistry.js')
  const integration = localMCPStorage.getIntegration(integrationId)
  if (!integration) throw new Error(`Integration ${integrationId} not found`)
  const updated = localMCPStorage.updateIntegration(integrationId, {
    status: 'connected',
    connectedAt: new Date().toISOString(),
    config: config ?? integration.config,
  })
  await discoverTools(updated)
  return updated
}

export async function disconnectIntegration(integrationId) {
  const { localMCPStorage } = await import('./storage/localMCPStorage.js')
  return localMCPStorage.updateIntegration(integrationId, {
    status: 'disconnected',
    config: undefined,
  })
}

export async function getAllTools() {
  const { getTools } = await import('./services/mcpToolRegistry.js')
  return getTools()
}

export async function runTool(toolId, input = {}, sourceSurface = 'other') {
  const { runTool: run } = await import('./services/mcpExecutionService.js')
  return run({ toolId, input, sourceSurface })
}

export async function getExecutionLog(options) {
  const { getExecutionLog: getLog } = await import('./services/mcpExecutionService.js')
  return getLog(options)
}

export async function sendToTelegram(text) {
  const { sendTelegramMessage } = await import('./services/telegramService.js')
  return sendTelegramMessage(text)
}

export async function getTelegramMessages() {
  const { getTelegramMessages: getMessages } = await import('./services/telegramService.js')
  return getMessages()
}

export async function testTelegramConnection() {
  const { testTelegramConnection: test } = await import('./services/telegramService.js')
  return test()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mcp/api.js
git commit -m "feat(mcp): JS boundary for existing views"
```

---

## Task 9: UI components

**Files:**
- Create: `src/mcp/components/IntegrationStatusBadge.tsx`
- Create: `src/mcp/components/IntegrationCard.tsx`
- Create: `src/mcp/components/ToolCatalogList.tsx`
- Create: `src/mcp/components/ExecutionRecordList.tsx`
- Create: `src/mcp/components/TelegramMessageList.tsx`

- [ ] **Step 1: Write `src/mcp/components/IntegrationStatusBadge.tsx`**

```tsx
import type { IntegrationStatus } from '../types.js'

const CONFIG: Record<IntegrationStatus, { label: string; color: string; dot: string }> = {
  connected: { label: 'Connected', color: 'text-teal-300', dot: 'bg-teal-400' },
  disconnected: { label: 'Disconnected', color: 'text-white/40', dot: 'bg-white/30' },
  error: { label: 'Error', color: 'text-rose-300', dot: 'bg-rose-400' },
  pending: { label: 'Pending', color: 'text-amber-300', dot: 'bg-amber-400 animate-pulse' },
}

export function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  const c = CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}
```

- [ ] **Step 2: Write `src/mcp/components/IntegrationCard.tsx`**

```tsx
import { Plug } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { MCPIntegration } from '../types.js'
import { IntegrationStatusBadge } from './IntegrationStatusBadge.js'

const TYPE_ICONS: Record<string, string> = {
  telegram: '✈️',
  'google-workspace': '📄',
  figma: '🎨',
  canva: '🖼️',
  'generic-mcp': '🔌',
}

interface Props {
  integration: MCPIntegration
  toolCount?: number
}

export function IntegrationCard({ integration, toolCount }: Props) {
  return (
    <Link
      to={`/connections/${integration.id}`}
      className="block glass-panel p-4 rounded-xl hover:brightness-110 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-base">
            {TYPE_ICONS[integration.type] ?? <Plug size={16} className="text-white/50" />}
          </div>
          <div>
            <div className="text-sm font-medium text-white/90">{integration.name}</div>
            {integration.description ? (
              <div className="text-[11px] text-white/45 mt-0.5 line-clamp-1">
                {integration.description}
              </div>
            ) : null}
          </div>
        </div>
        <IntegrationStatusBadge status={integration.status} />
      </div>
      {toolCount !== undefined && toolCount > 0 ? (
        <div className="mt-3 text-[11px] text-white/35">
          {toolCount} tool{toolCount !== 1 ? 's' : ''} available
        </div>
      ) : null}
    </Link>
  )
}
```

- [ ] **Step 3: Write `src/mcp/components/ToolCatalogList.tsx`**

```tsx
import type { MCPToolDefinition, ToolPermissionMode } from '../types.js'

const MODE_LABELS: Record<ToolPermissionMode, { label: string; color: string }> = {
  auto: { label: 'Auto', color: 'text-teal-300 bg-teal-400/10' },
  approval_required: { label: 'Approval', color: 'text-amber-300 bg-amber-400/10' },
  read_only: { label: 'Read-only', color: 'text-sky-300 bg-sky-400/10' },
  restricted: { label: 'Restricted', color: 'text-rose-300 bg-rose-400/10' },
}

interface Props {
  tools: MCPToolDefinition[]
  integrationName?: (id: string) => string
}

export function ToolCatalogList({ tools, integrationName }: Props) {
  if (tools.length === 0) {
    return (
      <p className="text-[12px] text-white/35 py-8 text-center">
        No tools available. Connect an integration to discover tools.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {tools.map((tool) => {
        const mode = MODE_LABELS[tool.permissionMode]
        return (
          <div
            key={tool.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-white/90">
                  {tool.displayName}
                </span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${mode.color}`}
                >
                  {mode.label}
                </span>
              </div>
              {tool.description ? (
                <p className="text-[11px] text-white/45 mt-0.5 truncate">{tool.description}</p>
              ) : null}
            </div>
            {integrationName ? (
              <span className="text-[10px] text-white/30 flex-shrink-0">
                {integrationName(tool.integrationId)}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/mcp/components/ExecutionRecordList.tsx`**

```tsx
import type { MCPExecutionRecord, ExecutionStatus } from '../types.js'

const STATUS_CONFIG: Record<ExecutionStatus, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'text-amber-300' },
  running: { label: 'Running', color: 'text-amber-300' },
  success: { label: 'Success', color: 'text-emerald-300' },
  failed: { label: 'Failed', color: 'text-rose-300' },
  cancelled: { label: 'Cancelled', color: 'text-white/40' },
  awaiting_approval: { label: 'Awaiting Approval', color: 'text-purple-300' },
}

interface Props {
  records: MCPExecutionRecord[]
  toolName?: (toolId: string) => string
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function ExecutionRecordList({ records, toolName }: Props) {
  if (records.length === 0) {
    return (
      <p className="text-[12px] text-white/35 py-8 text-center">
        No executions yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {records.map((rec) => {
        const s = STATUS_CONFIG[rec.status]
        return (
          <div
            key={rec.id}
            className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[11px] font-semibold ${s.color}`}>{s.label}</span>
                <span className="text-[12px] text-white/80 truncate">
                  {toolName ? toolName(rec.toolId) : rec.toolId}
                </span>
                <span className="text-[10px] text-white/30 px-1.5 py-0.5 rounded bg-white/[0.04]">
                  {rec.sourceSurface}
                </span>
              </div>
              <span className="text-[11px] text-white/30 flex-shrink-0">
                {relativeTime(rec.requestedAt)}
              </span>
            </div>
            {rec.errorMessage ? (
              <p className="text-[11px] text-rose-300/80 mt-1 truncate">{rec.errorMessage}</p>
            ) : null}
            {rec.outputSummary && !rec.errorMessage ? (
              <p className="text-[11px] text-white/35 mt-1 truncate">{rec.outputSummary}</p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Write `src/mcp/components/TelegramMessageList.tsx`**

```tsx
import type { TelegramCommandMessage } from '../types.js'

const STATUS_CONFIG: Record<TelegramCommandMessage['status'], { label: string; color: string }> = {
  received: { label: 'Received', color: 'text-amber-300' },
  processed: { label: 'Processed', color: 'text-emerald-300' },
  failed: { label: 'Failed', color: 'text-rose-300' },
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function TelegramMessageList({ messages }: { messages: TelegramCommandMessage[] }) {
  if (messages.length === 0) {
    return (
      <p className="text-[12px] text-white/35 py-8 text-center">
        No inbound messages yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {messages.map((msg) => {
        const s = STATUS_CONFIG[msg.status]
        return (
          <div
            key={msg.id}
            className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] text-white/85 leading-snug flex-1">
                {msg.messageText}
              </p>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-[10px] font-semibold ${s.color}`}>{s.label}</span>
                <span className="text-[10px] text-white/30">{relativeTime(msg.receivedAt)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/mcp/components/
git commit -m "feat(mcp): UI components — status badge, cards, lists"
```

---

## Task 10: Pages — MCPIntegrationsPage and sub-nav

**Files:**
- Create: `src/mcp/pages/MCPIntegrationsPage.tsx`

- [ ] **Step 1: Write `src/mcp/pages/MCPIntegrationsPage.tsx`**

```tsx
import { LayoutGrid, List, Activity, MessageCircle } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { IntegrationCard } from '../components/IntegrationCard.js'

const SUB_NAV = [
  { to: '/connections', label: 'Integrations', Icon: LayoutGrid, end: true },
  { to: '/connections/tools', label: 'Tools', Icon: List },
  { to: '/connections/log', label: 'Log', Icon: Activity },
  { to: '/connections/telegram', label: 'Telegram', Icon: MessageCircle },
]

function SubNav() {
  return (
    <div className="flex items-center gap-1 mb-6 border-b border-white/[0.07] pb-4">
      {SUB_NAV.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
              isActive
                ? 'text-white bg-white/[0.08]'
                : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
            }`
          }
        >
          <Icon size={14} />
          {label}
        </NavLink>
      ))}
    </div>
  )
}

export default function MCPIntegrationsPage() {
  const { integrations, connect, disconnect } = useMCPIntegrations()
  const { tools } = useMCPTools()
  const navigate = useNavigate()

  const connected = integrations.filter((i) => i.status === 'connected')
  const available = integrations.filter((i) => i.status !== 'connected')

  function toolCountFor(integrationId: string): number {
    return tools.filter((t) => t.integrationId === integrationId).length
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-2.5">
          <span className="text-[color:var(--color-topic)]">⚡</span>
          Connections
        </h1>
        <p className="text-[13px] text-white/45 mt-1">
          Connect tools and services to FlowMap. Run actions from chat, research canvases, and Telegram.
        </p>
      </div>

      <SubNav />

      {connected.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
            Connected ({connected.length})
          </h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {connected.map((i) => (
              <IntegrationCard key={i.id} integration={i} toolCount={toolCountFor(i.id)} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
          Available ({available.length})
        </h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {available.map((i) => (
            <IntegrationCard key={i.id} integration={i} toolCount={toolCountFor(i.id)} />
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mcp/pages/MCPIntegrationsPage.tsx
git commit -m "feat(mcp): MCPIntegrationsPage with sub-nav"
```

---

## Task 11: Integration Detail Page

**Files:**
- Create: `src/mcp/pages/MCPIntegrationDetailPage.tsx`

- [ ] **Step 1: Write `src/mcp/pages/MCPIntegrationDetailPage.tsx`**

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Unplug, Plug } from 'lucide-react'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { useMCPExecutions } from '../hooks/useMCPExecutions.js'
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge.js'
import { ToolCatalogList } from '../components/ToolCatalogList.js'
import { ExecutionRecordList } from '../components/ExecutionRecordList.js'

export default function MCPIntegrationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { integrations, connect, disconnect, updateConfig } = useMCPIntegrations()
  const integration = integrations.find((i) => i.id === id)
  const { tools } = useMCPTools(id)
  const { records } = useMCPExecutions(id)

  const [token, setToken] = useState(integration?.config?.['token'] ?? '')
  const [chatId, setChatId] = useState(integration?.config?.['chatId'] ?? '')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  if (!integration) {
    return (
      <div className="p-6 text-white/40 text-sm">Integration not found.</div>
    )
  }

  const isTelegram = integration.type === 'telegram'
  const isConnected = integration.status === 'connected'

  async function handleConnect() {
    setConnecting(true)
    setConnectError(null)
    try {
      const config = isTelegram ? { token, chatId } : undefined
      await connect(integration.id, config)
    } catch (e) {
      setConnectError((e as Error).message)
    } finally {
      setConnecting(false)
    }
  }

  function handleDisconnect() {
    disconnect(integration.id)
    setToken('')
    setChatId('')
  }

  function toolName(toolId: string): string {
    return tools.find((t) => t.id === toolId)?.displayName ?? toolId
  }

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => navigate('/connections')}
        className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Connections
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{integration.name}</h1>
          {integration.description ? (
            <p className="text-[13px] text-white/45 mt-1">{integration.description}</p>
          ) : null}
        </div>
        <IntegrationStatusBadge status={integration.status} />
      </div>

      {/* Telegram config form */}
      {isTelegram && !isConnected ? (
        <div className="glass-panel p-4 rounded-xl mb-6 space-y-3">
          <p className="text-[12px] text-white/50">
            Enter your Telegram bot token and the chat ID to send to.
          </p>
          <div className="space-y-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bot token (e.g. 123456789:ABC-…)"
              className="glass-input w-full text-[13px]"
            />
            <input
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Chat ID (e.g. -100123456789)"
              className="glass-input w-full text-[13px]"
            />
          </div>
          {connectError ? (
            <p className="text-[11px] text-rose-300">{connectError}</p>
          ) : null}
        </div>
      ) : null}

      {/* Connect / Disconnect */}
      <div className="flex items-center gap-2 mb-8">
        {isConnected ? (
          <button onClick={handleDisconnect} className="btn flex items-center gap-2 text-rose-300 hover:text-rose-200">
            <Unplug size={14} /> Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting || (isTelegram && (!token || !chatId))}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-40"
          >
            {connecting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Plug size={14} />
            )}
            Connect
          </button>
        )}
      </div>

      {/* Tools */}
      {tools.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
            Tools ({tools.length})
          </h2>
          <ToolCatalogList tools={tools} />
        </section>
      ) : null}

      {/* Recent executions */}
      {records.length > 0 ? (
        <section>
          <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
            Recent Activity
          </h2>
          <ExecutionRecordList records={records.slice(0, 10)} toolName={toolName} />
        </section>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mcp/pages/MCPIntegrationDetailPage.tsx
git commit -m "feat(mcp): MCPIntegrationDetailPage"
```

---

## Task 12: Telegram Command Center

**Files:**
- Create: `src/mcp/pages/TelegramCommandCenterPage.tsx`

- [ ] **Step 1: Write `src/mcp/pages/TelegramCommandCenterPage.tsx`**

```tsx
import { useState } from 'react'
import { Send, CheckCircle, XCircle } from 'lucide-react'
import { useTelegramCommands } from '../hooks/useTelegramCommands.js'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { TelegramMessageList } from '../components/TelegramMessageList.js'
import { IntegrationStatusBadge } from '../components/IntegrationStatusBadge.js'

const COMMAND_EXAMPLES = [
  'Summarize this URL: https://...',
  'Create a research canvas called AI competitors',
  'Send me 3 caption ideas for this topic',
  "What's on my calendar today?",
  'Create a Google Doc from my last note',
]

export default function TelegramCommandCenterPage() {
  const { messages, sending, sendError, send, testConnection } = useTelegramCommands()
  const { integrations } = useMCPIntegrations()
  const telegramIntegration = integrations.find((i) => i.type === 'telegram')

  const [text, setText] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)

  async function handleSend() {
    if (!text.trim()) return
    const ok = await send(text.trim())
    if (ok) setText('')
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection()
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-1">Telegram</h1>
      <p className="text-[13px] text-white/45 mb-6">
        Send messages from FlowMap to Telegram. Inbound commands arrive here when connected.
      </p>

      {/* Status card */}
      <div className="glass-panel p-4 rounded-xl mb-6 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-medium text-white/80">Bot Status</div>
          {telegramIntegration?.config?.['chatId'] ? (
            <div className="text-[11px] text-white/35 mt-0.5">
              Chat: {telegramIntegration.config['chatId']}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {telegramIntegration ? (
            <IntegrationStatusBadge status={telegramIntegration.status} />
          ) : null}
          <button
            onClick={handleTest}
            disabled={testing || telegramIntegration?.status !== 'connected'}
            className="btn text-[12px] disabled:opacity-40"
          >
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>
      </div>

      {testResult !== null ? (
        <div
          className={`flex items-center gap-2 text-[12px] mb-4 ${
            testResult.success ? 'text-emerald-300' : 'text-rose-300'
          }`}
        >
          {testResult.success ? (
            <CheckCircle size={13} />
          ) : (
            <XCircle size={13} />
          )}
          {testResult.success
            ? 'Connection successful — check Telegram for the confirmation message.'
            : testResult.error ?? 'Connection failed.'}
        </div>
      ) : null}

      {/* Send message */}
      <div className="mb-8">
        <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
          Send Message
        </h2>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message to send…"
            className="glass-input flex-1 text-[13px]"
          />
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="btn btn-primary flex items-center gap-1.5 disabled:opacity-40"
          >
            <Send size={13} />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {sendError ? (
          <p className="text-[11px] text-rose-300 mt-1.5">{sendError}</p>
        ) : null}
      </div>

      {/* Command examples */}
      <div className="mb-8">
        <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
          Command Examples
        </h2>
        <div className="space-y-1.5">
          {COMMAND_EXAMPLES.map((cmd) => (
            <button
              key={cmd}
              onClick={() => setText(cmd)}
              className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-[12px] text-white/60 hover:text-white/90 transition-colors border border-white/[0.05]"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      {/* Inbound messages */}
      <div>
        <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
          Inbound Commands
          <span className="ml-2 text-white/25 normal-case tracking-normal font-normal">
            (demo — real inbound via webhook in v2)
          </span>
        </h2>
        <TelegramMessageList messages={messages} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/mcp/pages/TelegramCommandCenterPage.tsx
git commit -m "feat(mcp): TelegramCommandCenterPage"
```

---

## Task 13: Tool Catalog and Execution Log pages

**Files:**
- Create: `src/mcp/pages/MCPToolCatalogPage.tsx`
- Create: `src/mcp/pages/MCPExecutionLogPage.tsx`

- [ ] **Step 1: Write `src/mcp/pages/MCPToolCatalogPage.tsx`**

```tsx
import { useState } from 'react'
import { Search } from 'lucide-react'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { ToolCatalogList } from '../components/ToolCatalogList.js'

export default function MCPToolCatalogPage() {
  const { tools } = useMCPTools()
  const { integrations } = useMCPIntegrations()
  const [query, setQuery] = useState('')
  const [filterIntegration, setFilterIntegration] = useState('')

  function integrationName(id: string): string {
    return integrations.find((i) => i.id === id)?.name ?? id
  }

  const filtered = tools.filter((t) => {
    const matchesQuery =
      !query ||
      t.displayName.toLowerCase().includes(query.toLowerCase()) ||
      t.description?.toLowerCase().includes(query.toLowerCase()) ||
      t.tags?.some((tag) => tag.toLowerCase().includes(query.toLowerCase()))
    const matchesIntegration = !filterIntegration || t.integrationId === filterIntegration
    return matchesQuery && matchesIntegration
  })

  const connectedIntegrations = integrations.filter((i) => i.status === 'connected')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Tools</h1>
        <p className="text-[13px] text-white/45 mt-1">
          {tools.length} tool{tools.length !== 1 ? 's' : ''} available across connected integrations.
        </p>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            className="glass-input w-full pl-8 text-[13px]"
          />
        </div>
        {connectedIntegrations.length > 0 ? (
          <select
            value={filterIntegration}
            onChange={(e) => setFilterIntegration(e.target.value)}
            className="glass-input text-[13px]"
          >
            <option value="">All integrations</option>
            {connectedIntegrations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <ToolCatalogList tools={filtered} integrationName={integrationName} />
    </div>
  )
}
```

- [ ] **Step 2: Write `src/mcp/pages/MCPExecutionLogPage.tsx`**

```tsx
import { useMCPExecutions } from '../hooks/useMCPExecutions.js'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { ExecutionRecordList } from '../components/ExecutionRecordList.js'

export default function MCPExecutionLogPage() {
  const { records } = useMCPExecutions()
  const { tools } = useMCPTools()

  function toolName(toolId: string): string {
    return tools.find((t) => t.id === toolId)?.displayName ?? toolId
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Execution Log</h1>
        <p className="text-[13px] text-white/45 mt-1">
          {records.length} action{records.length !== 1 ? 's' : ''} recorded.
        </p>
      </div>
      <ExecutionRecordList records={records} toolName={toolName} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/mcp/pages/MCPToolCatalogPage.tsx src/mcp/pages/MCPExecutionLogPage.tsx
git commit -m "feat(mcp): Tool Catalog and Execution Log pages"
```

---

## Task 14: Wire routes into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add MCP routes to `src/App.jsx`**

Open `src/App.jsx`. Add these imports at the top alongside the existing imports:

```jsx
import MCPIntegrationsPage from './mcp/pages/MCPIntegrationsPage.jsx'
import MCPIntegrationDetailPage from './mcp/pages/MCPIntegrationDetailPage.jsx'
import MCPToolCatalogPage from './mcp/pages/MCPToolCatalogPage.jsx'
import MCPExecutionLogPage from './mcp/pages/MCPExecutionLogPage.jsx'
import TelegramCommandCenterPage from './mcp/pages/TelegramCommandCenterPage.jsx'
```

Note: React Router and Vite resolve `.tsx` files when imported as `.jsx` — Vite's default resolution handles both extensions transparently.

Then inside `<Routes>`, after the last existing `<Route>`, add:

```jsx
<Route path="/connections" element={<MCPIntegrationsPage />} />
<Route path="/connections/tools" element={<MCPToolCatalogPage />} />
<Route path="/connections/log" element={<MCPExecutionLogPage />} />
<Route path="/connections/telegram" element={<TelegramCommandCenterPage />} />
<Route path="/connections/:id" element={<MCPIntegrationDetailPage />} />
```

**Order matters:** `/connections/tools`, `/connections/log`, and `/connections/telegram` must appear **before** `/connections/:id` so that literal paths match before the param route.

- [ ] **Step 2: Verify dev server starts without errors**

```bash
npm run dev
```

Navigate to `http://localhost:5173/connections` — the Integrations Hub should render with the 5 seeded integrations.

- [ ] **Step 3: Verify sub-nav routing**

- `/connections/tools` → Tools page (empty "No tools" state expected since nothing is connected yet)
- `/connections/log` → Execution Log (empty)
- `/connections/telegram` → Telegram Command Center (shows mock inbound messages + send form)
- `/connections/integ_telegram` → Telegram Detail page with Connect form

- [ ] **Step 4: Run all tests**

```bash
npm run test:run
```

Expected: all tests in `src/mcp/` PASS. Any failures indicate a type mismatch or import path error — fix before committing.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(mcp): wire /connections routes into App.jsx"
```

- [ ] **Step 6: Final integration test — connect Telegram in mock mode**

1. Navigate to `/connections/integ_telegram`
2. Enter any dummy token and chat ID (e.g. `fake_token`, `12345`)
3. Click Connect — page should reload with "Connected" badge and show 3 Telegram tools
4. Navigate to `/connections/telegram` → Send a test message → confirm it appears in the execution log at `/connections/log`

---

## Self-Review Checklist

- [x] **TypeScript setup:** Task 1 installs `typescript` and creates scoped `tsconfig.json` — covered
- [x] **Storage interface + impl:** Task 3 — covered with tests
- [x] **All 5 integrations seeded:** SEED_INTEGRATIONS in Task 3 — covered
- [x] **5 mock inbound messages seeded:** SEED_TELEGRAM_MESSAGES in Task 3 — covered
- [x] **Real Telegram provider:** Task 5 — `realTelegramProvider.sendMessage` + `testConnection` both hit `api.telegram.org`
- [x] **Mock fallback when no token:** `telegramMCPProvider` and `telegramService` both select mock when `token` is empty
- [x] **Permission service:** Task 6 — 4 modes tested, `restricted` blocks execution
- [x] **Tool registry:** Task 6 — `discoverTools` caches results to storage, `getTools` reads cache
- [x] **Execution service:** Task 6 — full lifecycle: queued → running → success/failed, permission check gated
- [x] **Telegram service + command router stub:** Task 6 — `routeIncomingCommand` returns null in v1, stable signature for v2
- [x] **4 React hooks:** Task 7 — thin wrappers, each calls services directly
- [x] **JS boundary:** Task 8 — dynamic imports keep types out of boundary, any `.js` file can import
- [x] **5 UI components:** Task 9 — matches FlowMap glass aesthetic
- [x] **5 pages:** Tasks 10–13 — all pages covered
- [x] **Routes before `:id` param:** Task 14 — explicit ordering documented
- [x] **Type names consistent across tasks:** `MCPIntegration`, `MCPToolDefinition`, `MCPExecutionRecord`, `TelegramCommandMessage` used uniformly
- [x] **`telegramMCPProvider` imports `realTelegramProvider`:** referenced in Task 4 Step 3, defined in Task 5 — build order fine since Vite resolves lazily
- [x] **Spec section 12 (out of scope):** Approval queue UI, real inbound webhooks, real GWS/Figma/Canva — none built, all noted
