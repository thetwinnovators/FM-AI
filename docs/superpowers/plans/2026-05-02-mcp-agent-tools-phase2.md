# MCP Agent Tools — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Gmail, Google Calendar, and upgraded Figma provider scaffolds; wire memory writeback into the execution service; and build a tool detail page so each tool has its own inspectable screen.

**Architecture:** All providers follow the same Phase 1 scaffold contract — tools are properly typed with `riskLevel` and `inputSchema`, `executeTool` returns a descriptive "not connected / OAuth coming Phase 3" error. Memory writeback is a pure service (`mcpMemoryService.ts`) that reads/writes `flowmap.v1` localStorage directly, decoupled from React hooks so it can be called from `mcpExecutionService.ts`. The tool detail page is a new route `/connections/tools/:toolId` built with existing hooks (`useMCPTools`, `useMCPExecutions`). `ToolCatalogList` becomes a list of `<Link>` elements pointing to each tool's detail page.

**Tech Stack:** TypeScript, Vitest, React, React Router v6 (no new dependencies)

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/mcp/providers/gmailProvider.ts` |
| Create | `src/mcp/providers/googleCalendarProvider.ts` |
| Create | `src/mcp/providers/figmaProvider.ts` |
| Delete | `src/mcp/providers/mockFigmaProvider.ts` (replaced by figmaProvider.ts) |
| Create | `src/mcp/services/mcpMemoryService.ts` |
| Create | `src/mcp/services/__tests__/mcpMemoryService.test.ts` |
| Create | `src/mcp/pages/MCPToolDetailPage.tsx` |
| Modify | `src/mcp/services/mcpToolRegistry.ts` (register gmail, google-calendar; switch figma to figmaProvider) |
| Modify | `src/mcp/services/mcpExecutionService.ts` (call writeExecutionMemory after write/publish success) |
| Modify | `src/mcp/components/ToolCatalogList.tsx` (make rows clickable Links to /connections/tools/:id) |
| Modify | `src/App.jsx` (add /connections/tools/:toolId route) |
| Modify | `src/mcp/services/__tests__/mcpToolRegistry.test.ts` (add gmail, google-calendar, figma provider tests; remove from undefined list; update discover counts) |
| Modify | `src/mcp/services/__tests__/mcpExecutionService.test.ts` (vi.mock getProvider so tests don't depend on real figma provider returning success) |

---

## Task 1: Gmail provider scaffold

**Files:**
- Create: `src/mcp/providers/gmailProvider.ts`

Three tools: `search_threads` (read), `draft_email` (write), `send_email` (publish). Same Phase 1 scaffold pattern as `googleDocsProvider.ts` — tools return descriptive errors, no real API calls.

- [ ] **Step 1: Create `src/mcp/providers/gmailProvider.ts`**

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'gmail_search_threads',
    toolName: 'search_threads',
    displayName: 'Search Gmail Threads',
    description: 'Search Gmail threads by query string.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      query: { type: 'string', description: 'Gmail search query (e.g. "from:boss subject:report")' },
      maxResults: { type: 'number', description: 'Maximum threads to return (default 10)' },
    },
    tags: ['gmail', 'search', 'read'],
  },
  {
    id: 'gmail_draft_email',
    toolName: 'draft_email',
    displayName: 'Draft Email',
    description: 'Create a Gmail draft without sending it.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject line' },
      body: { type: 'string', description: 'Email body (plain text or HTML)' },
    },
    tags: ['gmail', 'draft', 'write'],
  },
  {
    id: 'gmail_send_email',
    toolName: 'send_email',
    displayName: 'Send Email',
    description: 'Send an email via Gmail.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject line' },
      body: { type: 'string', description: 'Email body (plain text or HTML)' },
    },
    tags: ['gmail', 'send', 'publish'],
  },
]

export const gmailProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ integration, tool }) {
    if (integration.status !== 'connected') {
      return {
        success: false,
        error: `Gmail is not connected. Open Connections → Gmail to set it up.`,
      }
    }
    return {
      success: false,
      error: `Gmail tool "${tool.displayName}" requires OAuth — coming in Phase 3.`,
    }
  },

  async testConnection(integration) {
    if (integration.status !== 'connected') {
      return { success: false, error: 'Not connected' }
    }
    return { success: true }
  },
}
```

- [ ] **Step 2: Run tests — no breakage expected**

```
npx vitest run src/mcp --exclude ".claude/**" --reporter verbose
```

Expected: All existing tests PASS (new file, not yet imported)

- [ ] **Step 3: Commit**

```bash
git add src/mcp/providers/gmailProvider.ts
git commit -m "feat(mcp): add Gmail provider scaffold (search_threads, draft_email, send_email)"
```

---

## Task 2: Google Calendar provider scaffold

**Files:**
- Create: `src/mcp/providers/googleCalendarProvider.ts`

Three tools: `list_events` (read), `create_event` (publish), `cancel_event` (publish).

- [ ] **Step 1: Create `src/mcp/providers/googleCalendarProvider.ts`**

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'gcal_list_events',
    toolName: 'list_events',
    displayName: 'List Calendar Events',
    description: 'List upcoming events from a Google Calendar.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      calendarId: { type: 'string', description: 'Calendar ID to read (defaults to primary)' },
      timeMin: { type: 'string', description: 'ISO 8601 start time filter (optional)' },
      maxResults: { type: 'number', description: 'Maximum events to return (default 10)' },
    },
    tags: ['google-calendar', 'list', 'read'],
  },
  {
    id: 'gcal_create_event',
    toolName: 'create_event',
    displayName: 'Create Calendar Event',
    description: 'Create a new event in Google Calendar.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      title: { type: 'string', description: 'Event title' },
      startTime: { type: 'string', description: 'ISO 8601 start datetime (e.g. 2026-05-10T14:00:00)' },
      endTime: { type: 'string', description: 'ISO 8601 end datetime' },
      description: { type: 'string', description: 'Event description (optional)' },
      calendarId: { type: 'string', description: 'Calendar ID (defaults to primary)' },
    },
    tags: ['google-calendar', 'create', 'publish'],
  },
  {
    id: 'gcal_cancel_event',
    toolName: 'cancel_event',
    displayName: 'Cancel Calendar Event',
    description: 'Cancel (delete) an existing Google Calendar event.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      eventId: { type: 'string', description: 'Google Calendar event ID to cancel' },
      calendarId: { type: 'string', description: 'Calendar ID (defaults to primary)' },
    },
    tags: ['google-calendar', 'cancel', 'publish'],
  },
]

export const googleCalendarProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ integration, tool }) {
    if (integration.status !== 'connected') {
      return {
        success: false,
        error: `Google Calendar is not connected. Open Connections → Google Calendar to set it up.`,
      }
    }
    return {
      success: false,
      error: `Google Calendar tool "${tool.displayName}" requires OAuth — coming in Phase 3.`,
    }
  },

  async testConnection(integration) {
    if (integration.status !== 'connected') {
      return { success: false, error: 'Not connected' }
    }
    return { success: true }
  },
}
```

- [ ] **Step 2: Run tests — no breakage expected**

```
npx vitest run src/mcp --exclude ".claude/**" --reporter verbose
```

Expected: All existing tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/mcp/providers/googleCalendarProvider.ts
git commit -m "feat(mcp): add Google Calendar provider scaffold (list_events, create_event, cancel_event)"
```

---

## Task 3: Figma provider upgrade

**Files:**
- Create: `src/mcp/providers/figmaProvider.ts`
- Modify: `src/mcp/services/__tests__/mcpExecutionService.test.ts` (add vi.mock)
- Modify: `src/mcp/services/mcpToolRegistry.ts` (swap import from mockFigmaProvider → figmaProvider)
- Delete: `src/mcp/providers/mockFigmaProvider.ts`

The existing `mockFigmaProvider.ts` silently returns `{ success: true }` and has no `riskLevel`. Replace it with `figmaProvider.ts` that has 4 read-level tools from the spec and uses the Phase 1 stub pattern. The execution service test depends on the mock returning success, so it must be updated to use `vi.mock` to isolate from provider behavior.

- [ ] **Step 1: Create `src/mcp/providers/figmaProvider.ts`**

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'figma_inspect_file',
    toolName: 'inspect_file',
    displayName: 'Inspect Figma File',
    description: 'Read layers, frames, and metadata from a Figma file.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      fileId: { type: 'string', description: 'Figma file ID from the file URL' },
    },
    tags: ['figma', 'inspect', 'read'],
  },
  {
    id: 'figma_read_comments',
    toolName: 'read_comments',
    displayName: 'Read Figma Comments',
    description: 'Read all comments on a Figma file.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      fileId: { type: 'string', description: 'Figma file ID' },
    },
    tags: ['figma', 'comments', 'read'],
  },
  {
    id: 'figma_pull_design_tokens',
    toolName: 'pull_design_tokens',
    displayName: 'Pull Design Tokens',
    description: 'Extract design tokens (colors, typography, spacing) from a Figma file.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      fileId: { type: 'string', description: 'Figma file ID' },
    },
    tags: ['figma', 'tokens', 'read'],
  },
  {
    id: 'figma_list_pages',
    toolName: 'list_pages',
    displayName: 'List Figma Pages',
    description: 'List all pages in a Figma file.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      fileId: { type: 'string', description: 'Figma file ID' },
    },
    tags: ['figma', 'pages', 'read'],
  },
]

export const figmaProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ integration, tool }) {
    if (integration.status !== 'connected') {
      return {
        success: false,
        error: `Figma is not connected. Open Connections → Figma to set it up.`,
      }
    }
    return {
      success: false,
      error: `Figma tool "${tool.displayName}" requires OAuth — coming in Phase 3.`,
    }
  },

  async testConnection(integration) {
    if (integration.status !== 'connected') {
      return { success: false, error: 'Not connected' }
    }
    return { success: true }
  },
}
```

- [ ] **Step 2: Update `mcpExecutionService.test.ts` to mock the provider**

The test currently relies on `mockFigmaProvider` returning `{ success: true }`. After the registry switches to `figmaProvider`, those tests would fail because `figmaProvider.executeTool` returns Phase 3 errors. Fix by adding `vi.mock` at the top of the test file so the execution service test doesn't depend on any real provider behavior.

Replace the full content of `src/mcp/services/__tests__/mcpExecutionService.test.ts`:

```typescript
import { vi, beforeEach, describe, expect, it } from 'vitest'
import { runTool, getExecutionLog } from '../mcpExecutionService.js'
import { localMCPStorage } from '../../storage/localMCPStorage.js'

// Mock getProvider so execution tests don't depend on real provider implementations.
// The mock returns a controllable stub for figma that always reports success for
// read tools — the execution service logic (permission gate, record writing) is what
// this test suite exercises, not the provider's internal behavior.
vi.mock('../mcpToolRegistry.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mcpToolRegistry.js')>()
  return {
    ...original,
    getProvider: (type: string) => {
      if (type === 'figma') {
        return {
          listTools: async () => [],
          executeTool: async () => ({ success: true, output: { mock: true } }),
          testConnection: async () => ({ success: true }),
        }
      }
      return original.getProvider(type as any)
    },
  }
})

beforeEach(() => {
  localStorage.clear()
  localMCPStorage.listIntegrations() // triggers seed
  localMCPStorage.updateIntegration('integ_figma', { status: 'connected' })
  localMCPStorage.saveTools('integ_figma', [
    {
      id: 'figma_auto_tool',
      integrationId: 'integ_figma',
      toolName: 'inspect_file',
      displayName: 'Inspect Figma File',
      riskLevel: 'read' as const,
      permissionMode: 'auto' as const,
      tags: ['figma'],
    },
    {
      id: 'figma_restricted',
      integrationId: 'integ_figma',
      toolName: 'restricted_tool',
      displayName: 'Restricted',
      permissionMode: 'restricted' as const,
    },
  ])
})

describe('runTool', () => {
  it('succeeds for a read-risk tool', async () => {
    const result = await runTool({ toolId: 'figma_auto_tool', input: { brief: 'test' } })
    expect(result.success).toBe(true)
    expect(result.executionId).toBeTruthy()
  })

  it('writes a success execution record', async () => {
    await runTool({ toolId: 'figma_auto_tool' })
    const log = getExecutionLog()
    expect(log[0].status).toBe('success')
    expect(log[0].toolId).toBe('figma_auto_tool')
  })

  it('blocks a restricted tool and writes a failed record', async () => {
    const result = await runTool({ toolId: 'figma_restricted' })
    expect(result.success).toBe(false)
    const log = getExecutionLog()
    expect(log[0].status).toBe('failed')
  })

  it('returns error for unknown toolId', async () => {
    const result = await runTool({ toolId: 'no_such_tool' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })

  it('queues awaiting_approval record for approval_required tool', async () => {
    localMCPStorage.saveTools('integ_figma', [
      {
        id: 'figma_approval',
        integrationId: 'integ_figma',
        toolName: 'approval_tool',
        displayName: 'Approval Tool',
        permissionMode: 'approval_required',
      },
    ])
    const result = await runTool({ toolId: 'figma_approval' })
    expect(result.success).toBe(false)
    expect(result.requiresApproval).toBe(true)
    const log = getExecutionLog()
    expect(log[0].status).toBe('awaiting_approval')
  })

  it('awaits confirmation for a publish-risk tool', async () => {
    localMCPStorage.saveTools('integ_figma', [
      {
        id: 'figma_publish',
        integrationId: 'integ_figma',
        toolName: 'publish_tool',
        displayName: 'Publish Tool',
        riskLevel: 'publish' as const,
        permissionMode: 'auto' as const,
      },
    ])
    const result = await runTool({ toolId: 'figma_publish' })
    expect(result.success).toBe(false)
    expect(result.requiresApproval).toBe(true)
    const log = getExecutionLog()
    expect(log[0].status).toBe('awaiting_approval')
  })

  it('returns error when tool integration is missing', async () => {
    localMCPStorage.saveTools('integ_figma', [
      {
        id: 'orphan_tool',
        integrationId: 'integ_nonexistent',
        toolName: 'orphan',
        displayName: 'Orphan',
        permissionMode: 'auto',
      },
    ])
    const result = await runTool({ toolId: 'orphan_tool' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not found/i)
  })
})

describe('getExecutionLog', () => {
  it('returns empty array when no executions', () => {
    expect(getExecutionLog()).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run execution tests to confirm they still pass**

```
npx vitest run src/mcp/services/__tests__/mcpExecutionService.test.ts --reporter verbose
```

Expected: 8/8 PASS (mock intercepted, same test logic)

- [ ] **Step 4: Update `mcpToolRegistry.ts` — swap figma import**

Replace the figma import line and the PROVIDERS entry. Full updated file:

```typescript
import type { MCPIntegration, MCPToolDefinition, IntegrationType } from '../types.js'
import type { MCPIntegrationProvider } from '../providers/types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { telegramMCPProvider } from '../providers/telegramMCPProvider.js'
import { googleDocsProvider } from '../providers/googleDocsProvider.js'
import { googleDriveProvider } from '../providers/googleDriveProvider.js'
import { figmaProvider } from '../providers/figmaProvider.js'

// Only integrations with a real or mock provider are registered here.
// Adding a new integration to the seed does NOT require a provider entry —
// omit it until the adapter is built.
const PROVIDERS: Partial<Record<IntegrationType, MCPIntegrationProvider>> = {
  telegram: telegramMCPProvider,
  'google-docs': googleDocsProvider,
  'google-drive': googleDriveProvider,
  figma: figmaProvider,
}

export function getProvider(type: IntegrationType): MCPIntegrationProvider | undefined {
  return PROVIDERS[type]
}

export async function discoverTools(integration: MCPIntegration): Promise<MCPToolDefinition[]> {
  const provider = getProvider(integration.type)
  if (!provider) {
    throw new Error(
      `No provider registered for integration type: "${integration.type}". ` +
      `Add an adapter in src/mcp/providers/ and register it in PROVIDERS.`,
    )
  }
  const tools = await provider.listTools(integration)
  localMCPStorage.saveTools(integration.id, tools)
  return tools
}

export function getTools(integrationId?: string): MCPToolDefinition[] {
  return localMCPStorage.listTools(integrationId)
}
```

- [ ] **Step 5: Delete `mockFigmaProvider.ts`**

```bash
rm src/mcp/providers/mockFigmaProvider.ts
```

- [ ] **Step 6: Run all tests**

```
npx vitest run src/mcp --exclude ".claude/**" --reporter verbose
```

Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/mcp/providers/figmaProvider.ts src/mcp/services/mcpToolRegistry.ts src/mcp/services/__tests__/mcpExecutionService.test.ts
git rm src/mcp/providers/mockFigmaProvider.ts
git commit -m "feat(mcp): upgrade figma provider to Phase 1 stub (4 read tools); decouple execution tests from provider via vi.mock"
```

---

## Task 4: Register Gmail + Google Calendar providers; update registry tests

**Files:**
- Modify: `src/mcp/services/mcpToolRegistry.ts` (add gmail + google-calendar)
- Modify: `src/mcp/services/__tests__/mcpToolRegistry.test.ts` (add provider tests, update counts)

- [ ] **Step 1: Write failing tests for gmail and google-calendar providers**

Replace the full content of `src/mcp/services/__tests__/mcpToolRegistry.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { discoverTools, getTools, getProvider } from '../mcpToolRegistry.js'
import { localMCPStorage } from '../../storage/localMCPStorage.js'
import type { MCPIntegration } from '../../types.js'

beforeEach(() => {
  localStorage.clear()
})

function makeIntegration(overrides: Partial<MCPIntegration> = {}): MCPIntegration {
  return {
    id: 'integ_telegram',
    type: 'telegram',
    name: 'Telegram',
    status: 'connected',
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('getProvider', () => {
  it('returns telegram provider', () => {
    const p = getProvider('telegram')
    expect(p).toBeDefined()
    expect(typeof p!.listTools).toBe('function')
    expect(typeof p!.executeTool).toBe('function')
    expect(typeof p!.testConnection).toBe('function')
  })

  it('returns google-docs provider', () => {
    const p = getProvider('google-docs')
    expect(p).toBeDefined()
    expect(typeof p!.listTools).toBe('function')
  })

  it('returns google-drive provider', () => {
    const p = getProvider('google-drive')
    expect(p).toBeDefined()
    expect(typeof p!.listTools).toBe('function')
  })

  it('returns gmail provider', () => {
    const p = getProvider('gmail')
    expect(p).toBeDefined()
    expect(typeof p!.listTools).toBe('function')
  })

  it('returns google-calendar provider', () => {
    const p = getProvider('google-calendar')
    expect(p).toBeDefined()
    expect(typeof p!.listTools).toBe('function')
  })

  it('returns figma provider', () => {
    const p = getProvider('figma')
    expect(p).toBeDefined()
    expect(typeof p!.listTools).toBe('function')
  })

  it('returns undefined for types without a registered provider', () => {
    expect(getProvider('google-slides')).toBeUndefined()
    expect(getProvider('youtube')).toBeUndefined()
    expect(getProvider('instagram')).toBeUndefined()
    expect(getProvider('facebook')).toBeUndefined()
    expect(getProvider('higgsfield')).toBeUndefined()
  })
})

describe('discoverTools', () => {
  it('saves telegram tools to storage', async () => {
    const integration = makeIntegration()
    const tools = await discoverTools(integration)
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.every((t) => t.integrationId === 'integ_telegram')).toBe(true)
    expect(localMCPStorage.listTools('integ_telegram')).toHaveLength(tools.length)
  })

  it('replaces tools on second discoverTools call (no duplicates)', async () => {
    const integration = makeIntegration()
    await discoverTools(integration)
    await discoverTools(integration)
    expect(localMCPStorage.listTools('integ_telegram')).toHaveLength(3) // 3 telegram tools
  })

  it('discovers correct tool count for all registered providers', async () => {
    const cases: Array<{ id: string; type: MCPIntegration['type']; expectedCount: number }> = [
      { id: 'integ_telegram',          type: 'telegram',          expectedCount: 3 },
      { id: 'integ_google_docs',       type: 'google-docs',       expectedCount: 3 },
      { id: 'integ_google_drive',      type: 'google-drive',      expectedCount: 3 },
      { id: 'integ_gmail',             type: 'gmail',             expectedCount: 3 },
      { id: 'integ_google_calendar',   type: 'google-calendar',   expectedCount: 3 },
      { id: 'integ_figma',             type: 'figma',             expectedCount: 4 },
    ]
    for (const { id, type, expectedCount } of cases) {
      const tools = await discoverTools(makeIntegration({ id, type }))
      expect(tools).toHaveLength(expectedCount)
    }
  })

  it('throws when no provider registered for integration type', async () => {
    const integration = makeIntegration({ type: 'youtube' })
    await expect(discoverTools(integration)).rejects.toThrow(/no provider/i)
  })
})

describe('getTools', () => {
  it('returns all tools across integrations when no id given', async () => {
    await discoverTools(makeIntegration({ id: 'integ_telegram', type: 'telegram' }))
    await discoverTools(makeIntegration({ id: 'integ_google_docs', type: 'google-docs' }))
    expect(getTools().length).toBe(6) // 3 telegram + 3 google-docs
  })

  it('filters by integrationId', async () => {
    await discoverTools(makeIntegration({ id: 'integ_telegram', type: 'telegram' }))
    await discoverTools(makeIntegration({ id: 'integ_gmail', type: 'gmail' }))
    expect(getTools('integ_gmail')).toHaveLength(3)
    expect(getTools('integ_telegram')).toHaveLength(3)
  })

  it('returns empty array for integration with no discovered tools', () => {
    expect(getTools('integ_unknown')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to confirm new tests fail**

```
npx vitest run src/mcp/services/__tests__/mcpToolRegistry.test.ts --reporter verbose
```

Expected: FAIL — `getProvider('gmail')` and `getProvider('google-calendar')` return undefined; figma count 4 doesn't match yet (still returning 2 tools from old mock... actually figma is already swapped in Task 3, so figma tests pass; gmail and google-calendar fail)

- [ ] **Step 3: Update `mcpToolRegistry.ts` to register gmail and google-calendar**

Full updated file:

```typescript
import type { MCPIntegration, MCPToolDefinition, IntegrationType } from '../types.js'
import type { MCPIntegrationProvider } from '../providers/types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { telegramMCPProvider } from '../providers/telegramMCPProvider.js'
import { googleDocsProvider } from '../providers/googleDocsProvider.js'
import { googleDriveProvider } from '../providers/googleDriveProvider.js'
import { gmailProvider } from '../providers/gmailProvider.js'
import { googleCalendarProvider } from '../providers/googleCalendarProvider.js'
import { figmaProvider } from '../providers/figmaProvider.js'

// Only integrations with a real or mock provider are registered here.
// Adding a new integration to the seed does NOT require a provider entry —
// omit it until the adapter is built.
const PROVIDERS: Partial<Record<IntegrationType, MCPIntegrationProvider>> = {
  telegram: telegramMCPProvider,
  'google-docs': googleDocsProvider,
  'google-drive': googleDriveProvider,
  gmail: gmailProvider,
  'google-calendar': googleCalendarProvider,
  figma: figmaProvider,
}

export function getProvider(type: IntegrationType): MCPIntegrationProvider | undefined {
  return PROVIDERS[type]
}

export async function discoverTools(integration: MCPIntegration): Promise<MCPToolDefinition[]> {
  const provider = getProvider(integration.type)
  if (!provider) {
    throw new Error(
      `No provider registered for integration type: "${integration.type}". ` +
      `Add an adapter in src/mcp/providers/ and register it in PROVIDERS.`,
    )
  }
  const tools = await provider.listTools(integration)
  localMCPStorage.saveTools(integration.id, tools)
  return tools
}

export function getTools(integrationId?: string): MCPToolDefinition[] {
  return localMCPStorage.listTools(integrationId)
}
```

- [ ] **Step 4: Update `MCPIntegrationDetailPage.tsx` — gmail and google-calendar now have providers**

The detail page uses `hasProvider = !!getProvider(integration.type)` to decide whether to show the Connect button or the "coming soon" notice. Gmail and Google Calendar now have providers, so they will show a Connect button. This is correct because connecting them will `discoverTools()` and populate the tool catalog. No code change needed — it works automatically.

Verify by running the app and navigating to `/connections/integ_gmail`.

- [ ] **Step 5: Run all tests**

```
npx vitest run src/mcp --exclude ".claude/**" --reporter verbose
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/mcp/services/mcpToolRegistry.ts src/mcp/services/__tests__/mcpToolRegistry.test.ts
git commit -m "feat(mcp): register gmail and google-calendar providers; update registry tests for all 6 providers"
```

---

## Task 5: Memory writeback service

**Files:**
- Create: `src/mcp/services/mcpMemoryService.ts`
- Create: `src/mcp/services/__tests__/mcpMemoryService.test.ts`
- Modify: `src/mcp/services/mcpExecutionService.ts` (call writeExecutionMemory after write/publish success)

When a `write` or `publish` tool succeeds, write a memory entry to `flowmap.v1` in localStorage. This uses the same storage key and entry shape as `useStore.js`, so memory entries appear in the FlowMap Memory view. The service is a pure module (no React hooks) so it can be called from the execution service.

- [ ] **Step 1: Write failing tests**

Create `src/mcp/services/__tests__/mcpMemoryService.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { writeExecutionMemory } from '../mcpMemoryService.js'
import type { MCPExecutionRecord, MCPToolDefinition, MCPIntegration } from '../../types.js'

const STORE_KEY = 'flowmap.v1'

function readMemoryEntries(): Record<string, unknown> {
  const raw = localStorage.getItem(STORE_KEY)
  if (!raw) return {}
  try {
    return (JSON.parse(raw) as { memoryEntries?: Record<string, unknown> }).memoryEntries ?? {}
  } catch {
    return {}
  }
}

function makeRecord(overrides: Partial<MCPExecutionRecord> = {}): MCPExecutionRecord {
  return {
    id: 'exec_test_1',
    toolId: 'gdocs_create_doc',
    integrationId: 'integ_google_docs',
    sourceSurface: 'chat',
    status: 'success',
    requestedAt: '2026-05-02T10:00:00.000Z',
    completedAt: '2026-05-02T10:00:01.000Z',
    outputSummary: 'Created doc: My Research Note',
    ...overrides,
  }
}

function makeTool(overrides: Partial<MCPToolDefinition> = {}): MCPToolDefinition {
  return {
    id: 'gdocs_create_doc',
    integrationId: 'integ_google_docs',
    toolName: 'create_doc',
    displayName: 'Create Google Doc',
    riskLevel: 'write',
    permissionMode: 'auto',
    ...overrides,
  }
}

function makeIntegration(overrides: Partial<MCPIntegration> = {}): MCPIntegration {
  return {
    id: 'integ_google_docs',
    type: 'google-docs',
    name: 'Google Docs',
    status: 'connected',
    updatedAt: '2026-05-02T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('writeExecutionMemory', () => {
  it('writes a memory entry to flowmap.v1', () => {
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    expect(Object.keys(entries)).toHaveLength(1)
  })

  it('entry id is prefixed with mem_mcp_', () => {
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    const key = Object.keys(entries)[0]
    expect(key).toMatch(/^mem_mcp_/)
  })

  it('entry text includes tool displayName and integration name', () => {
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    const entry = Object.values(entries)[0] as { text: string }
    expect(entry.text).toContain('Create Google Doc')
    expect(entry.text).toContain('Google Docs')
  })

  it('entry has source mcp and category automation', () => {
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    const entry = Object.values(entries)[0] as { source: string; category: string }
    expect(entry.source).toBe('mcp')
    expect(entry.category).toBe('automation')
  })

  it('entry tags include mcp, tool-execution, and the integration type', () => {
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    const entry = Object.values(entries)[0] as { tags: string[] }
    expect(entry.tags).toContain('mcp')
    expect(entry.tags).toContain('tool-execution')
    expect(entry.tags).toContain('google-docs')
  })

  it('accumulates multiple entries without overwriting', () => {
    writeExecutionMemory(makeRecord({ id: 'exec_1' }), makeTool(), makeIntegration())
    writeExecutionMemory(makeRecord({ id: 'exec_2' }), makeTool(), makeIntegration())
    const entries = readMemoryEntries()
    expect(Object.keys(entries)).toHaveLength(2)
  })

  it('preserves existing flowmap.v1 saves and other data', () => {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      saves: { item_1: { id: 'item_1' } },
      memoryEntries: {},
    }))
    writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())
    const raw = localStorage.getItem(STORE_KEY)!
    const store = JSON.parse(raw) as { saves: Record<string, unknown>; memoryEntries: Record<string, unknown> }
    expect(store.saves['item_1']).toBeDefined()
    expect(Object.keys(store.memoryEntries)).toHaveLength(1)
  })

  it('does not crash when flowmap.v1 is empty', () => {
    expect(() => writeExecutionMemory(makeRecord(), makeTool(), makeIntegration())).not.toThrow()
  })
})
```

- [ ] **Step 2: Run to confirm tests fail**

```
npx vitest run src/mcp/services/__tests__/mcpMemoryService.test.ts --reporter verbose
```

Expected: FAIL — module `mcpMemoryService.js` does not exist

- [ ] **Step 3: Create `src/mcp/services/mcpMemoryService.ts`**

```typescript
import type { MCPExecutionRecord, MCPToolDefinition, MCPIntegration } from '../types.js'

const STORE_KEY = 'flowmap.v1'

interface MemoryEntry {
  id: string
  text: string
  tags: string[]
  category: string
  addedAt: string
  source: string
}

interface FlowMapStore {
  memoryEntries?: Record<string, MemoryEntry>
  [key: string]: unknown
}

function readStore(): FlowMapStore {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as FlowMapStore) : {}
  } catch {
    return {}
  }
}

function writeStore(data: FlowMapStore): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(data))
}

/**
 * Writes a memory entry to flowmap.v1 after a meaningful tool execution.
 * Call this after write or publish tools complete successfully.
 * The entry appears in the FlowMap Memory view alongside manually added entries.
 */
export function writeExecutionMemory(
  record: MCPExecutionRecord,
  tool: MCPToolDefinition,
  integration: MCPIntegration,
): void {
  const id = `mem_mcp_${record.id}`
  const outputNote = record.outputSummary
    ? ` Output: ${record.outputSummary.slice(0, 200)}`
    : ''

  const entry: MemoryEntry = {
    id,
    text: `${tool.displayName} completed via ${integration.name}.${outputNote}`,
    tags: ['mcp', 'tool-execution', integration.type],
    category: 'automation',
    addedAt: new Date().toISOString().slice(0, 10),
    source: 'mcp',
  }

  const store = readStore()
  const entries = store.memoryEntries ?? {}
  entries[id] = entry
  writeStore({ ...store, memoryEntries: entries })
}
```

- [ ] **Step 4: Run memory service tests — all should pass**

```
npx vitest run src/mcp/services/__tests__/mcpMemoryService.test.ts --reporter verbose
```

Expected: 8/8 PASS

- [ ] **Step 5: Wire writeback into `mcpExecutionService.ts`**

Add the import and call. Replace only the import block and the success-path block inside the `try {}`:

At the top of `src/mcp/services/mcpExecutionService.ts`, add the import after the existing imports:

```typescript
import { writeExecutionMemory } from './mcpMemoryService.js'
```

Inside the `try {}` block, after the `updateExecutionRecord` call that sets `status: result.success ? 'success' : 'failed'`, add the writeback. The full updated `try {}` block:

```typescript
  try {
    const provider = getProvider(integration.type)
    if (!provider) {
      localMCPStorage.updateExecutionRecord(id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        errorMessage: `No provider registered for type "${integration.type}"`,
      })
      return { success: false, executionId: id, error: `No provider registered for type "${integration.type}"` }
    }
    const result = await provider.executeTool({ integration, tool, input })
    const outputSummary = result.output
      ? JSON.stringify(result.output).slice(0, 120)
      : undefined
    localMCPStorage.updateExecutionRecord(id, {
      status: result.success ? 'success' : 'failed',
      completedAt: new Date().toISOString(),
      outputSummary,
      errorMessage: result.error,
    })
    // Write memory for write/publish tools that completed successfully.
    // Read tools (inspect, list, search) don't produce memorable artifacts.
    if (result.success && (tool.riskLevel === 'write' || tool.riskLevel === 'publish')) {
      writeExecutionMemory(
        { ...record, status: 'success', outputSummary },
        tool,
        integration,
      )
    }
    return { success: result.success, executionId: id, output: result.output, error: result.error }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    localMCPStorage.updateExecutionRecord(id, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      errorMessage: message,
    })
    return { success: false, executionId: id, error: message }
  }
```

- [ ] **Step 6: Run all tests**

```
npx vitest run src/mcp --exclude ".claude/**" --reporter verbose
```

Expected: All tests PASS (memory writeback doesn't trigger in execution tests because the mock figma tool has `riskLevel: 'read'`, not write/publish)

- [ ] **Step 7: Commit**

```bash
git add \
  src/mcp/services/mcpMemoryService.ts \
  src/mcp/services/__tests__/mcpMemoryService.test.ts \
  src/mcp/services/mcpExecutionService.ts
git commit -m "feat(mcp): memory writeback service; write flowmap.v1 memory entry after write/publish tool success"
```

---

## Task 6: Tool detail page

**Files:**
- Create: `src/mcp/pages/MCPToolDetailPage.tsx`
- Modify: `src/mcp/components/ToolCatalogList.tsx` (rows → Links)
- Modify: `src/App.jsx` (add /connections/tools/:toolId route)

Each tool gets a detail page at `/connections/tools/:toolId` showing: risk level, execution policy, input parameters, integration link, tags, last result, and recent execution records. `ToolCatalogList` rows become clickable links. No tests needed for this task (pure UI, no new logic).

- [ ] **Step 1: Create `src/mcp/pages/MCPToolDetailPage.tsx`**

```tsx
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useMCPTools } from '../hooks/useMCPTools.js'
import { useMCPIntegrations } from '../hooks/useMCPIntegrations.js'
import { useMCPExecutions } from '../hooks/useMCPExecutions.js'
import { ExecutionRecordList } from '../components/ExecutionRecordList.js'
import type { MCPToolRiskLevel, ToolPermissionMode } from '../types.js'

const RISK_META: Record<MCPToolRiskLevel, { label: string; colorClass: string }> = {
  read:    { label: 'Read',    colorClass: 'text-sky-300 bg-sky-400/10 border-sky-400/20' },
  write:   { label: 'Write',   colorClass: 'text-teal-300 bg-teal-400/10 border-teal-400/20' },
  publish: { label: 'Publish', colorClass: 'text-amber-300 bg-amber-400/10 border-amber-400/20' },
}

function policyLabel(riskLevel: MCPToolRiskLevel | undefined, permissionMode: ToolPermissionMode): string {
  if (riskLevel === 'read')    return 'Auto-run — no confirmation needed'
  if (riskLevel === 'write')   return 'Auto-run — creates or modifies content'
  if (riskLevel === 'publish') return 'Requires explicit confirmation before execution'
  if (permissionMode === 'auto')             return 'Auto-run'
  if (permissionMode === 'approval_required') return 'Requires confirmation'
  if (permissionMode === 'read_only')         return 'Read-only — auto-run'
  if (permissionMode === 'restricted')        return 'Restricted — cannot run'
  return '—'
}

export default function MCPToolDetailPage() {
  const { toolId } = useParams<{ toolId: string }>()
  const navigate = useNavigate()
  const { tools } = useMCPTools()
  const { integrations } = useMCPIntegrations()
  const { records } = useMCPExecutions()

  const tool = tools.find((t) => t.id === toolId)
  if (!tool) {
    return <div className="p-6 text-white/40 text-sm">Tool not found.</div>
  }

  const integration = integrations.find((i) => i.id === tool.integrationId)
  const riskMeta = tool.riskLevel ? RISK_META[tool.riskLevel] : null
  const toolRecords = records.filter((r) => r.toolId === toolId)
  const lastRecord = toolRecords[0] ?? null

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => navigate('/connections/tools')}
        className="flex items-center gap-1.5 text-[12px] text-white/40 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft size={13} /> Back to Tools
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">{tool.displayName}</h1>
          {tool.description ? (
            <p className="text-[13px] text-white/45 mt-1">{tool.description}</p>
          ) : null}
        </div>
        {riskMeta ? (
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${riskMeta.colorClass}`}>
            {riskMeta.label}
          </span>
        ) : null}
      </div>

      {/* Integration */}
      {integration ? (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-wide text-white/30 mb-1.5">Integration</p>
          <Link
            to={`/connections/${integration.id}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
          >
            {integration.name}
            <ChevronRight size={12} className="text-white/30" />
          </Link>
        </div>
      ) : null}

      {/* Execution policy */}
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-wide text-white/30 mb-1.5">Execution policy</p>
        <p className="text-[13px] text-white/60">{policyLabel(tool.riskLevel, tool.permissionMode)}</p>
      </div>

      {/* Input parameters */}
      {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 ? (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-wide text-white/30 mb-2">Parameters</p>
          <div className="space-y-1.5">
            {Object.entries(tool.inputSchema).map(([key, schema]) => (
              <div
                key={key}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]"
              >
                <code className="text-[12px] font-mono text-sky-300/80 shrink-0 mt-px">{key}</code>
                <p className="text-[11px] text-white/45 leading-relaxed">
                  {(schema as { description?: string }).description ?? ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Tags */}
      {tool.tags && tool.tags.length > 0 ? (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-wide text-white/30 mb-2">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {tool.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-white/40"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Last result */}
      {lastRecord ? (
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-wide text-white/30 mb-2">Last result</p>
          <div
            className={`px-3 py-2.5 rounded-lg text-[12px] border ${
              lastRecord.status === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            {lastRecord.status} · {lastRecord.outputSummary ?? lastRecord.errorMessage ?? 'No output'}
          </div>
        </div>
      ) : null}

      {/* Recent executions */}
      {toolRecords.length > 0 ? (
        <section>
          <h2 className="text-[11px] uppercase tracking-wide text-white/40 mb-3">
            Recent Activity
          </h2>
          <ExecutionRecordList
            records={toolRecords.slice(0, 5)}
            toolName={() => tool.displayName}
          />
        </section>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Make `ToolCatalogList` rows clickable links**

Replace the full content of `src/mcp/components/ToolCatalogList.tsx`:

```tsx
import { Link } from 'react-router-dom'
import type { MCPToolDefinition, ToolPermissionMode, MCPToolRiskLevel } from '../types.js'

const RISK_COLORS: Record<MCPToolRiskLevel, string> = {
  read:    'text-sky-300 bg-sky-400/10',
  write:   'text-teal-300 bg-teal-400/10',
  publish: 'text-amber-300 bg-amber-400/10',
}

const MODE_LABELS: Record<ToolPermissionMode, { label: string; color: string }> = {
  auto:             { label: 'Auto',       color: 'text-teal-300 bg-teal-400/10' },
  approval_required:{ label: 'Approval',   color: 'text-amber-300 bg-amber-400/10' },
  read_only:        { label: 'Read-only',  color: 'text-sky-300 bg-sky-400/10' },
  restricted:       { label: 'Restricted', color: 'text-rose-300 bg-rose-400/10' },
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
        const badgeClass = tool.riskLevel
          ? RISK_COLORS[tool.riskLevel]
          : MODE_LABELS[tool.permissionMode].color
        const badgeLabel = tool.riskLevel
          ? tool.riskLevel.charAt(0).toUpperCase() + tool.riskLevel.slice(1)
          : MODE_LABELS[tool.permissionMode].label

        return (
          <Link
            key={tool.id}
            to={`/connections/tools/${tool.id}`}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10] transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-white/90">
                  {tool.displayName}
                </span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badgeClass}`}>
                  {badgeLabel}
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
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Add the route to `src/App.jsx`**

Add the import and route. The full updated imports block and routes:

Add this import after the existing MCP page imports:
```jsx
import MCPToolDetailPage from './mcp/pages/MCPToolDetailPage.jsx'
```

Add this route inside `<Routes>`, between `/connections/tools` and `/connections/:id`:
```jsx
<Route path="/connections/tools/:toolId" element={<MCPToolDetailPage />} />
```

The relevant section of `AnimatedRoutes` after the change:
```jsx
<Route path="/connections" element={<MCPIntegrationsPage />} />
<Route path="/connections/tools" element={<MCPToolCatalogPage />} />
<Route path="/connections/tools/:toolId" element={<MCPToolDetailPage />} />
<Route path="/connections/log" element={<MCPExecutionLogPage />} />
<Route path="/connections/:id" element={<MCPIntegrationDetailPage />} />
```

- [ ] **Step 4: Run all tests**

```
npx vitest run src/mcp --exclude ".claude/**" --reporter verbose
```

Expected: All tests PASS (no new logic — this is pure UI)

- [ ] **Step 5: Commit**

```bash
git add \
  src/mcp/pages/MCPToolDetailPage.tsx \
  src/mcp/components/ToolCatalogList.tsx \
  src/App.jsx
git commit -m "feat(mcp): tool detail page at /connections/tools/:toolId; ToolCatalogList rows are clickable links"
```

---

## Self-review

### Spec coverage

| Phase 2 item | Covered by |
|---|---|
| Gmail draft tools | Task 1 — `draft_email` (write), `search_threads` (read), `send_email` (publish) |
| Google Calendar draft tools | Task 2 — `list_events` (read), `create_event` (publish), `cancel_event` (publish) |
| Figma inspect tools | Task 3 — 4 read tools replacing the silent mock |
| Memory writeback | Task 5 — `mcpMemoryService.ts` wired into execution service for write/publish successes |
| Tool detail screens | Task 6 — `MCPToolDetailPage.tsx` with risk level, policy, parameters, tags, last result, recent activity |

### Placeholder scan

No TBD or incomplete steps. All provider tools return "OAuth coming Phase 3" errors — this is the designed Phase 2 behavior, not a placeholder.

### Type consistency

- `MCPToolRiskLevel` imported from `types.js` in all provider files — consistent
- `figmaProvider` export name matches the import in `mcpToolRegistry.ts`
- `gmailProvider` / `googleCalendarProvider` export names match their imports in the registry
- `writeExecutionMemory(record, tool, integration)` — same signature in service, test, and call site in `mcpExecutionService.ts`
- `MCPToolDetailPage` reads `tool.inputSchema` as `Record<string, { description?: string }>` — matches the `Record<string, unknown>` type on `MCPToolDefinition.inputSchema`
- Route `/connections/tools/:toolId` uses `useParams<{ toolId: string }>()` — param name matches

---

*Phase 3 (not in scope here): OAuth flows for Google Docs, Drive, Gmail, Calendar; multi-step task plans; approval UI for publish tools; social publishing confirmations; Higgsfield generation tools.*
