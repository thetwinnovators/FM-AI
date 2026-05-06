# MCP Agent Tools — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `riskLevel` into the existing MCP type system, update the permission gate to enforce publish-requires-confirmation, and add properly-typed Google Docs and Google Drive provider scaffolds alongside the existing Telegram provider.

**Architecture:** All changes land in the existing `src/mcp/` tree — no new top-level directories. The `MCPToolDefinition` type gains a `riskLevel` field that takes precedence over the legacy `permissionMode` in the permission gate. New provider files follow the same `MCPIntegrationProvider` contract as `telegramMCPProvider.ts`. The PROVIDERS registry in `mcpToolRegistry.ts` switches from `Record<…>` (requires every type) to `Partial<Record<…>>` (opt-in) and drops the dead canva/workspace/generic-mcp entries.

**Tech Stack:** TypeScript, Vitest, React (no new dependencies)

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/mcp/types.ts` |
| Modify | `src/mcp/services/mcpPermissionService.ts` |
| Modify | `src/mcp/providers/telegramMCPProvider.ts` |
| Modify | `src/mcp/services/mcpToolRegistry.ts` |
| Modify | `src/mcp/services/__tests__/mcpPermissionService.test.ts` |
| Modify | `src/mcp/services/__tests__/mcpToolRegistry.test.ts` |
| Modify | `src/mcp/services/__tests__/mcpExecutionService.test.ts` |
| Create | `src/mcp/providers/googleDocsProvider.ts` |
| Create | `src/mcp/providers/googleDriveProvider.ts` |

---

## Task 1: Add `MCPToolRiskLevel` to the type system

**Files:**
- Modify: `src/mcp/types.ts`

This task adds the spec-defined `MCPToolRiskLevel` union type and the optional `riskLevel` field to `MCPToolDefinition`. The field is optional so existing tool definitions (Telegram, mock providers) continue to compile without change.

- [ ] **Step 1: Add the type and field to `src/mcp/types.ts`**

Current `MCPToolDefinition` starts at line 43. Add `MCPToolRiskLevel` **before** the interface, then add `riskLevel` as an optional field inside the interface:

```typescript
// Add this line before the MCPToolDefinition interface:
export type MCPToolRiskLevel = 'read' | 'write' | 'publish'

// Update MCPToolDefinition to add riskLevel:
export interface MCPToolDefinition {
  id: string
  integrationId: string
  toolName: string
  displayName: string
  description?: string
  riskLevel?: MCPToolRiskLevel        // new — takes precedence when set
  permissionMode: ToolPermissionMode  // kept for backwards compat
  inputSchema?: Record<string, unknown>
  tags?: string[]
}
```

The complete updated block for `types.ts` (replacing lines 43–52):

```typescript
export type MCPToolRiskLevel = 'read' | 'write' | 'publish'

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
}
```

- [ ] **Step 2: Run existing tests to confirm no breakage**

```
npx vitest run --reporter verbose
```

Expected: All tests PASS (no behavior changes yet — `riskLevel` is optional)

- [ ] **Step 3: Commit**

```bash
git add src/mcp/types.ts
git commit -m "feat(mcp): add MCPToolRiskLevel type and optional riskLevel field to MCPToolDefinition"
```

---

## Task 2: Update permission gate to use `riskLevel`

**Files:**
- Modify: `src/mcp/services/mcpPermissionService.ts`
- Modify: `src/mcp/services/__tests__/mcpPermissionService.test.ts`

The spec's confirmation policy:
- `read` → auto-run, no confirmation
- `write` → auto-run, no confirmation
- `publish` → always requires explicit confirmation

When `riskLevel` is set on a tool, it overrides `permissionMode`. When absent, the existing `permissionMode` logic applies unchanged.

- [ ] **Step 1: Write failing tests for `riskLevel` behavior**

Append this `describe` block to `src/mcp/services/__tests__/mcpPermissionService.test.ts` (after the existing `describe('checkPermission', ...)`):

```typescript
describe('checkPermission — riskLevel takes precedence', () => {
  function makeToolWithRisk(
    riskLevel: import('../../types.js').MCPToolRiskLevel,
    permissionMode: import('../../types.js').MCPToolDefinition['permissionMode'] = 'auto',
  ): import('../../types.js').MCPToolDefinition {
    return {
      id: 't_risk',
      integrationId: 'i1',
      toolName: 'risk_test',
      displayName: 'Risk Test Tool',
      riskLevel,
      permissionMode,
    }
  }

  it('read → allowed, no confirmation', () => {
    const r = checkPermission(makeToolWithRisk('read'))
    expect(r.allowed).toBe(true)
    expect(r.requiresApproval).toBe(false)
  })

  it('write → allowed, no confirmation', () => {
    const r = checkPermission(makeToolWithRisk('write'))
    expect(r.allowed).toBe(true)
    expect(r.requiresApproval).toBe(false)
  })

  it('publish → allowed, requires confirmation', () => {
    const r = checkPermission(makeToolWithRisk('publish'))
    expect(r.allowed).toBe(true)
    expect(r.requiresApproval).toBe(true)
    expect(r.reason).toMatch(/Risk Test Tool/)
  })

  it('publish overrides permissionMode=auto', () => {
    const r = checkPermission(makeToolWithRisk('publish', 'auto'))
    expect(r.requiresApproval).toBe(true)
  })

  it('read overrides permissionMode=approval_required', () => {
    const r = checkPermission(makeToolWithRisk('read', 'approval_required'))
    expect(r.requiresApproval).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm the new tests fail**

```
npx vitest run src/mcp/services/__tests__/mcpPermissionService.test.ts --reporter verbose
```

Expected: FAIL — `checkPermission` doesn't inspect `riskLevel` yet. Existing 4 tests still pass.

- [ ] **Step 3: Replace `mcpPermissionService.ts` with the updated implementation**

Full file replacement:

```typescript
import type { MCPToolDefinition, ToolPermissionMode, MCPToolRiskLevel } from '../types.js'

export interface PermissionResult {
  allowed: boolean
  requiresApproval: boolean
  reason?: string
}

function checkByRiskLevel(level: MCPToolRiskLevel, name: string): PermissionResult {
  switch (level) {
    case 'read':
      return { allowed: true, requiresApproval: false }
    case 'write':
      return { allowed: true, requiresApproval: false }
    case 'publish':
      return {
        allowed: true,
        requiresApproval: true,
        reason: `"${name}" is a publish action and requires confirmation.`,
      }
    default: {
      const _exhaustive: never = level
      throw new Error(`Unhandled risk level: ${_exhaustive}`)
    }
  }
}

function checkByPermissionMode(mode: ToolPermissionMode, name: string): PermissionResult {
  switch (mode) {
    case 'auto':
      return { allowed: true, requiresApproval: false }
    case 'approval_required':
      return {
        allowed: true,
        requiresApproval: true,
        reason: `"${name}" requires approval before running.`,
      }
    case 'read_only':
      return { allowed: true, requiresApproval: false }
    case 'restricted':
      return {
        allowed: false,
        requiresApproval: false,
        reason: `"${name}" is restricted and cannot be run.`,
      }
    default: {
      const _exhaustive: never = mode
      throw new Error(`Unhandled permission mode: ${_exhaustive}`)
    }
  }
}

export function checkPermission(tool: MCPToolDefinition): PermissionResult {
  if (tool.riskLevel) {
    return checkByRiskLevel(tool.riskLevel, tool.displayName)
  }
  return checkByPermissionMode(tool.permissionMode, tool.displayName)
}
```

- [ ] **Step 4: Run tests — all should pass**

```
npx vitest run src/mcp/services/__tests__/mcpPermissionService.test.ts --reporter verbose
```

Expected: 9/9 PASS (4 existing + 5 new)

- [ ] **Step 5: Commit**

```bash
git add src/mcp/services/mcpPermissionService.ts src/mcp/services/__tests__/mcpPermissionService.test.ts
git commit -m "feat(mcp): permission gate uses riskLevel when set; publish level always requires confirmation"
```

---

## Task 3: Tag Telegram tools with `riskLevel`

**Files:**
- Modify: `src/mcp/providers/telegramMCPProvider.ts`

Telegram send actions are publish-level: they send messages outside FlowMap to a live chat. This task adds `riskLevel: 'publish'` to all three Telegram tools. The matching `permissionMode` is updated to `'approval_required'` for consistency (legacy callers that check `permissionMode` directly will now agree with the risk gate).

- [ ] **Step 1: Update `TELEGRAM_TOOLS` in `telegramMCPProvider.ts`**

Replace the `TELEGRAM_TOOLS` array (lines 5–30) with:

```typescript
const TELEGRAM_TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'telegram_send_message',
    toolName: 'send_message',
    displayName: 'Send Message',
    description: 'Send a text message to a Telegram chat.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      text: { type: 'string', description: 'Message text to send' },
    },
    tags: ['telegram', 'message'],
  },
  {
    id: 'telegram_send_summary',
    toolName: 'send_summary',
    displayName: 'Send Summary',
    description: 'Send a formatted summary or report to Telegram.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      text: { type: 'string', description: 'Summary content to send' },
    },
    tags: ['telegram', 'summary'],
  },
  {
    id: 'telegram_send_document',
    toolName: 'send_document',
    displayName: 'Send Document',
    description: 'Send a file or document link to Telegram.',
    riskLevel: 'publish',
    permissionMode: 'approval_required',
    inputSchema: {
      text: { type: 'string', description: 'Message or file link to send' },
    },
    tags: ['telegram', 'document'],
  },
]
```

- [ ] **Step 2: Run tests**

```
npx vitest run --reporter verbose
```

Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/mcp/providers/telegramMCPProvider.ts
git commit -m "feat(mcp): tag Telegram send tools with riskLevel: publish and add inputSchema"
```

---

## Task 4: Create Google Docs provider

**Files:**
- Create: `src/mcp/providers/googleDocsProvider.ts`

Phase 1 scaffold: tools are properly typed with `riskLevel` and `inputSchema`. `executeTool` returns a descriptive "not connected" or "coming in Phase 2" error. The tool catalog is real and gets saved to localStorage on `discoverTools()`, so the Connections page shows "3 tools available" once the integration card links to this provider.

- [ ] **Step 1: Create `src/mcp/providers/googleDocsProvider.ts`**

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'gdocs_create_doc',
    toolName: 'create_doc',
    displayName: 'Create Google Doc',
    description: 'Create a new Google Doc from a title and body text.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      title: { type: 'string', description: 'Document title' },
      body: { type: 'string', description: 'Initial document content' },
      folderId: { type: 'string', description: 'Google Drive folder ID to save into (optional)' },
    },
    tags: ['google-docs', 'create', 'write'],
  },
  {
    id: 'gdocs_append_doc',
    toolName: 'append_doc',
    displayName: 'Append to Google Doc',
    description: 'Append text or a section to an existing Google Doc.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      documentId: { type: 'string', description: 'Google Doc ID to append to' },
      content: { type: 'string', description: 'Text content to append' },
    },
    tags: ['google-docs', 'edit', 'write'],
  },
  {
    id: 'gdocs_read_doc',
    toolName: 'read_doc',
    displayName: 'Read Google Doc',
    description: 'Read the text content of a Google Doc by ID.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      documentId: { type: 'string', description: 'Google Doc ID to read' },
    },
    tags: ['google-docs', 'read'],
  },
]

export const googleDocsProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ integration, tool }) {
    if (integration.status !== 'connected') {
      return {
        success: false,
        error: `Google Docs is not connected. Open Connections → Google Docs to set it up.`,
      }
    }
    // OAuth execution not yet wired — Phase 2
    return {
      success: false,
      error: `Google Docs tool "${tool.displayName}" requires OAuth — coming in Phase 2.`,
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
npx vitest run --reporter verbose
```

Expected: All existing tests PASS (new file, no tests yet — those come in Task 6)

- [ ] **Step 3: Commit**

```bash
git add src/mcp/providers/googleDocsProvider.ts
git commit -m "feat(mcp): add Google Docs provider scaffold (create_doc, append_doc, read_doc)"
```

---

## Task 5: Create Google Drive provider

**Files:**
- Create: `src/mcp/providers/googleDriveProvider.ts`

Same scaffold pattern as Google Docs. Three tools: one read-level (list_files), two write-level (create_folder, upload_file).

- [ ] **Step 1: Create `src/mcp/providers/googleDriveProvider.ts`**

```typescript
import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  {
    id: 'gdrive_list_files',
    toolName: 'list_files',
    displayName: 'List Drive Files',
    description: 'List files in a Google Drive folder.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      folderId: { type: 'string', description: 'Folder ID to list (defaults to root if omitted)' },
      query: { type: 'string', description: 'Search query to filter files (optional)' },
      limit: { type: 'number', description: 'Max number of results to return (default 20)' },
    },
    tags: ['google-drive', 'list', 'read'],
  },
  {
    id: 'gdrive_create_folder',
    toolName: 'create_folder',
    displayName: 'Create Drive Folder',
    description: 'Create a new folder in Google Drive.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      name: { type: 'string', description: 'Folder name' },
      parentId: { type: 'string', description: 'Parent folder ID (optional, defaults to root)' },
    },
    tags: ['google-drive', 'create', 'write'],
  },
  {
    id: 'gdrive_upload_file',
    toolName: 'upload_file',
    displayName: 'Upload to Drive',
    description: 'Upload a file or text content to Google Drive.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      name: { type: 'string', description: 'File name including extension' },
      content: { type: 'string', description: 'File content (plain text or base64-encoded data)' },
      mimeType: { type: 'string', description: 'MIME type (e.g. text/plain, application/pdf)' },
      folderId: { type: 'string', description: 'Target folder ID (optional)' },
    },
    tags: ['google-drive', 'upload', 'write'],
  },
]

export const googleDriveProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ integration, tool }) {
    if (integration.status !== 'connected') {
      return {
        success: false,
        error: `Google Drive is not connected. Open Connections → Google Drive to set it up.`,
      }
    }
    return {
      success: false,
      error: `Google Drive tool "${tool.displayName}" requires OAuth — coming in Phase 2.`,
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
npx vitest run --reporter verbose
```

Expected: All existing tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/mcp/providers/googleDriveProvider.ts
git commit -m "feat(mcp): add Google Drive provider scaffold (list_files, create_folder, upload_file)"
```

---

## Task 6: Update PROVIDERS registry and fix tests

**Files:**
- Modify: `src/mcp/services/mcpToolRegistry.ts`
- Modify: `src/mcp/services/__tests__/mcpToolRegistry.test.ts`
- Modify: `src/mcp/services/__tests__/mcpExecutionService.test.ts`

**Context:** `PROVIDERS` is currently typed as `Record<IntegrationType, MCPIntegrationProvider>`, which requires a provider for every `IntegrationType`. Since we now have 11 integration types but providers for only 4, this must become `Partial<Record<…>>`. `getProvider` return type changes from `MCPIntegrationProvider` to `MCPIntegrationProvider | undefined`. The execution service already null-checks the provider (line 80–86), so that path needs no change.

Also: `mcpToolRegistry.test.ts` currently creates integrations with `type: 'canva'` — a removed integration. `mcpExecutionService.test.ts` seeds `integ_canva`. Both need to switch to telegram-based seeds.

- [ ] **Step 1: Write failing tests for the updated registry**

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

  it('returns undefined for types without a registered provider', () => {
    expect(getProvider('gmail')).toBeUndefined()
    expect(getProvider('google-calendar')).toBeUndefined()
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

  it('discovers correct tool count for registered providers', async () => {
    const cases: Array<{ id: string; type: MCPIntegration['type']; expectedCount: number }> = [
      { id: 'integ_telegram', type: 'telegram', expectedCount: 3 },
      { id: 'integ_google_docs', type: 'google-docs', expectedCount: 3 },
      { id: 'integ_google_drive', type: 'google-drive', expectedCount: 3 },
    ]
    for (const { id, type, expectedCount } of cases) {
      const tools = await discoverTools(makeIntegration({ id, type }))
      expect(tools).toHaveLength(expectedCount)
    }
  })

  it('throws when no provider registered for integration type', async () => {
    const integration = makeIntegration({ type: 'figma' })
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
    await discoverTools(makeIntegration({ id: 'integ_google_docs', type: 'google-docs' }))
    expect(getTools('integ_google_docs')).toHaveLength(3)
    expect(getTools('integ_telegram')).toHaveLength(3)
  })

  it('returns empty array for integration with no discovered tools', () => {
    expect(getTools('integ_unknown')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to see the tests fail**

```
npx vitest run src/mcp/services/__tests__/mcpToolRegistry.test.ts --reporter verbose
```

Expected: FAIL — `getProvider('google-docs')` returns undefined; `discoverTools` for figma doesn't throw yet

- [ ] **Step 3: Replace `mcpToolRegistry.ts`**

```typescript
import type { MCPIntegration, MCPToolDefinition, IntegrationType } from '../types.js'
import type { MCPIntegrationProvider } from '../providers/types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { telegramMCPProvider } from '../providers/telegramMCPProvider.js'
import { googleDocsProvider } from '../providers/googleDocsProvider.js'
import { googleDriveProvider } from '../providers/googleDriveProvider.js'
import { mockFigmaProvider } from '../providers/mockFigmaProvider.js'

// Only integrations with a real or mock provider are registered here.
// Adding a new integration to the seed (localMCPStorage) does NOT require
// a provider entry — omit it until the adapter is built.
const PROVIDERS: Partial<Record<IntegrationType, MCPIntegrationProvider>> = {
  telegram: telegramMCPProvider,
  'google-docs': googleDocsProvider,
  'google-drive': googleDriveProvider,
  figma: mockFigmaProvider,
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

- [ ] **Step 4: Run registry tests — should now pass**

```
npx vitest run src/mcp/services/__tests__/mcpToolRegistry.test.ts --reporter verbose
```

Expected: All tests PASS

- [ ] **Step 5: Fix `mcpExecutionService.test.ts` to use telegram instead of canva**

Replace the `beforeEach` block (lines 6–27) with:

```typescript
beforeEach(() => {
  localStorage.clear()
  localMCPStorage.listIntegrations() // triggers seed
  localMCPStorage.updateIntegration('integ_telegram', { status: 'connected' })
  localMCPStorage.saveTools('integ_telegram', [
    {
      id: 'tg_auto_tool',
      integrationId: 'integ_telegram',
      toolName: 'test_auto',
      displayName: 'Test Auto Tool',
      riskLevel: 'read' as const,
      permissionMode: 'auto' as const,
      tags: ['test'],
    },
    {
      id: 'tg_restricted',
      integrationId: 'integ_telegram',
      toolName: 'restricted_tool',
      displayName: 'Restricted',
      permissionMode: 'restricted' as const,
    },
  ])
})
```

Update tool IDs referenced in the test cases:
- `canva_create_design` → `tg_auto_tool`
- `canva_restricted` → `tg_restricted`
- In the `approval_required` test, change `integrationId: 'integ_canva'` to `integrationId: 'integ_telegram'` and the `saveTools` first arg from `'integ_canva'` to `'integ_telegram'`
- In the orphan-tool test, `integrationId: 'integ_nonexistent'` — leave as-is, this tests the missing-integration error path

The full updated describe block:

```typescript
describe('runTool', () => {
  it('succeeds for a read-risk tool', async () => {
    const result = await runTool({ toolId: 'tg_auto_tool', input: { brief: 'test' } })
    expect(result.success).toBe(true)
    expect(result.executionId).toBeTruthy()
  })

  it('writes a success execution record', async () => {
    await runTool({ toolId: 'tg_auto_tool' })
    const log = getExecutionLog()
    expect(log[0].status).toBe('success')
    expect(log[0].toolId).toBe('tg_auto_tool')
  })

  it('blocks a restricted tool and writes a failed record', async () => {
    const result = await runTool({ toolId: 'tg_restricted' })
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
    localMCPStorage.saveTools('integ_telegram', [
      {
        id: 'tg_approval',
        integrationId: 'integ_telegram',
        toolName: 'approval_tool',
        displayName: 'Approval Tool',
        permissionMode: 'approval_required',
      },
    ])
    const result = await runTool({ toolId: 'tg_approval' })
    expect(result.success).toBe(false)
    expect(result.requiresApproval).toBe(true)
    const log = getExecutionLog()
    expect(log[0].status).toBe('awaiting_approval')
  })

  it('awaits confirmation for a publish-risk tool', async () => {
    localMCPStorage.saveTools('integ_telegram', [
      {
        id: 'tg_publish',
        integrationId: 'integ_telegram',
        toolName: 'publish_tool',
        displayName: 'Publish Tool',
        riskLevel: 'publish' as const,
        permissionMode: 'auto' as const,
      },
    ])
    const result = await runTool({ toolId: 'tg_publish' })
    expect(result.success).toBe(false)
    expect(result.requiresApproval).toBe(true)
    const log = getExecutionLog()
    expect(log[0].status).toBe('awaiting_approval')
  })

  it('returns error when tool integration is missing', async () => {
    localMCPStorage.saveTools('integ_telegram', [
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
```

- [ ] **Step 6: Run all tests**

```
npx vitest run --reporter verbose
```

Expected: All tests PASS (including the new `publish-risk tool → awaiting_approval` test)

- [ ] **Step 7: Commit**

```bash
git add \
  src/mcp/services/mcpToolRegistry.ts \
  src/mcp/services/__tests__/mcpToolRegistry.test.ts \
  src/mcp/services/__tests__/mcpExecutionService.test.ts
git commit -m "feat(mcp): register google-docs and google-drive providers; remove dead canva/workspace/generic-mcp entries; fix tests"
```

---

## Self-review

### Spec coverage

| Spec Phase 1 item | Covered by |
|---|---|
| Tool registry | Task 6 — PROVIDERS updated, `discoverTools` throws on missing provider |
| Connection registry | Already exists in `localMCPStorage` + `useMCPIntegrations` — no changes needed |
| Telegram adapter | Task 3 — `riskLevel: 'publish'` added to all send tools |
| Google Docs adapter | Task 4 — 3 tools with correct `riskLevel` and `inputSchema` |
| Google Drive adapter | Task 5 — 3 tools with correct `riskLevel` and `inputSchema` |
| Execution logs | Already exists in `mcpExecutionService.ts` + `MCPExecutionLogPage` — no changes needed |
| Permission gate | Task 2 — `checkPermission` uses `riskLevel` when present; `publish` → confirmation |

### Placeholder scan

No TBD, TODO, or incomplete steps. Every task has actual code. The Google Docs and Drive providers intentionally return "coming in Phase 2" errors — this is the designed behavior for Phase 1, not a placeholder.

### Type consistency

- `MCPToolRiskLevel` is defined once in `types.ts` and imported by `mcpPermissionService.ts`, `telegramMCPProvider.ts`, `googleDocsProvider.ts`, `googleDriveProvider.ts`
- `riskLevel` field is `MCPToolRiskLevel` (not string) throughout
- Tool IDs in test fixtures match those defined in the provider files
- `getProvider` return type is `MCPIntegrationProvider | undefined` — the execution service already has the null guard at line 80

---

*Phase 2 (not in scope here): Gmail draft tools, Google Calendar draft tools, Figma inspect tools, memory writeback, OAuth flows for Google Docs and Drive.*
