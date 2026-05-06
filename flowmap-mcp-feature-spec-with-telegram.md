# FlowMap MCP Feature Spec with Telegram

Use this prompt in Claude Code to implement a complete MCP feature for FlowMap, including Telegram support and a scalable tool-connector architecture.

MCP is increasingly used as a standardized way for AI agents to connect to external tools, data sources, and interactive app surfaces, reducing one-off integration work and enabling richer multi-step workflows.[cite:581][cite:633][cite:639] Telegram MCP servers already expose common bot capabilities like messaging, media sending, and chat operations through MCP-compatible tool interfaces.[cite:628][cite:631][cite:634] Google Workspace and Figma are also increasingly relevant MCP surfaces for productivity and design workflows.[cite:580][cite:637]

## Claude Code prompt

```text
You are helping me extend FlowMap with a full MCP (Model Context Protocol) feature set.

Goal:
Transform FlowMap from a research/chat workspace into an execution workspace that can connect to external tools through MCP, run actions safely, and expose a unified user experience for tool-connected workflows.

This feature must include Telegram support as a first-class integration.

Important constraints:
- No Supabase.
- Use React + TypeScript + Tailwind for the frontend.
- Use a clean backend/service architecture with provider abstractions.
- Use local mock implementations where needed, but design the architecture so real MCP servers and real auth can be plugged in later.
- Assume user authentication already exists elsewhere in FlowMap.
- The output should be production-minded, modular, and extensible.

## Product vision

FlowMap should become:
- a place to think, research, and organize
- a place to trigger actions across connected apps
- a place to run AI-assisted workflows through MCP-connected tools
- a place where Telegram can act as both a communication tool and a remote command surface

The user should be able to:
- connect tools/services to FlowMap through MCP-capable integrations
- browse available tools/capabilities
- authorize access to selected tools
- run tool-powered workflows from chat, research canvases, and future automation surfaces
- review action results, logs, and failures
- use Telegram to send commands into FlowMap and receive outputs back

## Scope

Design and implement version 1 of a FlowMap MCP platform layer with:
- MCP integration management UI
- tool registry and capability discovery
- action execution service
- workflow-safe permissioning model
- execution logs/history
- Telegram integration as a first-class MCP-backed feature
- support-ready abstractions for Google Workspace, Figma, Canva, and future toolkits

Do NOT build every real vendor integration end to end if APIs are unavailable.
Instead, create the architecture, interfaces, mock providers, and a realistic product shell that I can later wire to real MCP servers.

## Core product capabilities

### 1. MCP Integration Hub
Create a FlowMap settings/product area where users can:
- view available integrations
- connect/disconnect integrations
- see integration status
- see available tools exposed by each integration
- manage permissions/scopes
- test connection health

Suggested initial integrations:
- Telegram
- Google Workspace
- Figma
- Canva
- Generic MCP Server

### 2. Tool discovery and registry
FlowMap needs an internal registry of tool definitions discovered from integrations.
Each integration can expose one or more tools/capabilities.
Examples:
- Telegram: send message, send photo, send document, get chat info
- Google Workspace: create doc, append to sheet, create slide deck, send email, create calendar event
- Figma: inspect file, pull layer data, push content/code to canvas
- Canva: create or modify presentation/design assets

### 3. Action execution layer
Build a unified action executor that:
- accepts a tool request from FlowMap UI/chat/workflows
- checks permissions
- routes the request to the right integration/provider
- executes the tool call
- stores the result and log
- reports success/failure cleanly

### 4. Telegram as a first-class feature
Telegram must support two modes:

A. Telegram as an outbound tool
- FlowMap can send messages, files, summaries, reminders, or task outputs to Telegram.

B. Telegram as an inbound command surface
- A user can message a Telegram bot with commands or requests.
- FlowMap receives the incoming Telegram message.
- FlowMap interprets the request and triggers the corresponding workflow.
- FlowMap can reply back into Telegram with the result, status, or approval request.

Examples:
- "Summarize this link"
- "Create a new research canvas called AI competitors"
- "Turn this message into a task"
- "Send me today's agenda"
- "Draft 3 Instagram captions from this research note"

### 5. Approval and safety controls
Not every action should run automatically.
Create support for action policies like:
- auto-run allowed
- approval required
- read-only only
- restricted tool

Examples:
- reading a doc may auto-run
- sending an email may require approval
- posting social content may require approval
- deleting data should always require approval

### 6. Execution history and observability
Create a FlowMap activity/log view for MCP executions:
- what tool ran
- from which surface (chat, research canvas, telegram, automation)
- when it ran
- status: success, pending, failed, cancelled
- summary of inputs/outputs
- retry option if safe

## Architecture requirements

Design the feature using these concepts.

### Data types
Create TypeScript interfaces such as:

```ts
type IntegrationType = "telegram" | "google-workspace" | "figma" | "canva" | "generic-mcp" | "other";

type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";

type ToolPermissionMode = "auto" | "approval_required" | "read_only" | "restricted";

type ExecutionStatus = "queued" | "running" | "success" | "failed" | "cancelled" | "awaiting_approval";

interface MCPIntegration {
  id: string;
  type: IntegrationType;
  name: string;
  description?: string;
  status: IntegrationStatus;
  connectedAt?: string;
  updatedAt: string;
  scopes?: string[];
  metadata?: Record<string, any>;
}

interface MCPToolDefinition {
  id: string;
  integrationId: string;
  toolName: string;
  displayName: string;
  description?: string;
  permissionMode: ToolPermissionMode;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  tags?: string[];
}

interface MCPExecutionRecord {
  id: string;
  toolId: string;
  integrationId: string;
  sourceSurface: "chat" | "research" | "telegram" | "automation" | "other";
  status: ExecutionStatus;
  requestedAt: string;
  completedAt?: string;
  inputSummary?: string;
  outputSummary?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

interface TelegramCommandMessage {
  id: string;
  chatId: string;
  userId?: string;
  messageText: string;
  receivedAt: string;
  status: "received" | "processed" | "failed";
  linkedExecutionId?: string;
}
```

### Provider interfaces
Create clean provider abstractions like:

```ts
interface MCPIntegrationProvider {
  listTools(integration: MCPIntegration): Promise<MCPToolDefinition[]>;
  executeTool(params: {
    integration: MCPIntegration;
    tool: MCPToolDefinition;
    input: Record<string, any>;
  }): Promise<{ success: boolean; output?: any; error?: string }>;
  testConnection(integration: MCPIntegration): Promise<{ success: boolean; error?: string }>;
}

interface TelegramProvider {
  sendMessage(params: { chatId: string; text: string }): Promise<{ success: boolean; messageId?: string; error?: string }>;
  sendDocument?(params: { chatId: string; fileUrl: string; caption?: string }): Promise<{ success: boolean; error?: string }>;
  handleIncomingWebhook(payload: any): Promise<TelegramCommandMessage>;
}
```

### Storage layer
Create storage abstractions such as:

```ts
interface MCPStorage {
  listIntegrations(): Promise<MCPIntegration[]>;
  getIntegration(id: string): Promise<MCPIntegration | null>;
  saveIntegration(integration: MCPIntegration): Promise<void>;
  updateIntegration(id: string, patch: Partial<MCPIntegration>): Promise<MCPIntegration>;
  deleteIntegration(id: string): Promise<void>;

  listTools(): Promise<MCPToolDefinition[]>;
  saveTools(integrationId: string, tools: MCPToolDefinition[]): Promise<void>;
  listExecutionRecords(): Promise<MCPExecutionRecord[]>;
  saveExecutionRecord(record: MCPExecutionRecord): Promise<void>;
  updateExecutionRecord(id: string, patch: Partial<MCPExecutionRecord>): Promise<MCPExecutionRecord>;

  saveTelegramMessage(message: TelegramCommandMessage): Promise<void>;
  listTelegramMessages(): Promise<TelegramCommandMessage[]>;
}
```

Requirements:
- implement a localStorage-backed version for now
- keep storage isolated so I can swap in a real backend later

## Frontend requirements

Build a FlowMap-native frontend with these views/components.

### 1. MCP Integrations Page
A page where users can:
- see connected integrations
- browse available integrations
- connect/disconnect them
- inspect tool counts and status
- click into a detail page

### 2. Integration Detail Page
For each integration, show:
- connection status
- scopes/permissions
- discovered tools
- per-tool permission mode
- test connection action
- recent executions for that integration

### 3. Tool Catalog
A searchable list/grid of tools with:
- tool name
- integration
- description
- permission mode
- tags
- quick run/test button where appropriate

### 4. Execution Log / Activity Page
Show:
- latest tool runs
- status badges
- source surface
- timestamps
- error details
- retry button for safe failures

### 5. Telegram Command Center
A UI for Telegram-specific behavior:
- bot connection status
- webhook/config status
- recent inbound Telegram messages
- linked actions/executions
- test outbound message action
- command examples the user can send from Telegram

## Telegram workflow requirements

Implement Telegram as both inbound and outbound.

### Inbound command flow
- Telegram message arrives through webhook or mocked input
- FlowMap stores the message
- FlowMap classifies the command/request
- FlowMap optionally creates an execution record
- FlowMap runs a tool or queues an approval-required action
- FlowMap sends a response back to Telegram

### Outbound use cases
- send summaries to Telegram
- send reminders
- send workflow completion notices
- send approval requests or status updates
- send links to created docs/slides/canvases if available

### Telegram examples to support in mocked/demo form
- "Create a research canvas called Creator Trends"
- "What’s on my calendar today?"
- "Summarize this URL: ..."
- "Send me 3 caption ideas for this topic"
- "Create a Google Doc from this note"

## FlowMap surfaces that should use MCP

Design the architecture so MCP actions can be triggered from:
- AI chat
- Research canvas/workspace
- Social inbox or other moderation features
- Telegram command messages
- future automation recipes

## Suggested file structure

```text
src/mcp/
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
    ToolPermissionSelect.tsx
    ExecutionRecordList.tsx
    ExecutionRecordCard.tsx
    TelegramMessageList.tsx
    TelegramCommandExamples.tsx
  hooks/
    useMCPIntegrations.ts
    useMCPTools.ts
    useMCPExecutions.ts
    useTelegramCommands.ts
  storage/
    mcpStorage.ts
    localMCPStorage.ts
  providers/
    mcpIntegrationProvider.ts
    mockTelegramProvider.ts
    mockGoogleWorkspaceProvider.ts
    mockFigmaProvider.ts
    mockCanvaProvider.ts
    mockGenericMCPProvider.ts
  services/
    mcpToolRegistry.ts
    mcpExecutionService.ts
    mcpPermissionService.ts
    telegramCommandRouter.ts
    telegramWebhookService.ts
  utils/
    ids.ts
    dates.ts
    text.ts
    schemas.ts
```

## UX and product rules

- Make the feature feel premium, calm, and operationally clear.
- Avoid exposing confusing protocol jargon in every UI surface.
- Use “Tools”, “Connections”, “Actions”, and “Approvals” as primary user-facing language.
- Use “MCP” more in settings/admin/integration detail views than in everyday task surfaces.
- Make approval-gated actions obvious and safe.
- Keep logs readable for non-technical users.
- Fit the UI into FlowMap’s dark, modern product aesthetic.

## Nice-to-have features (design for later, do not fully build unless easy)

- tool packs (Creator Pack, Research Pack, Ops Pack, Design Pack)
- approval policies by integration or tool
- read-only vs write-enabled profiles
- background task queue
- webhook secret management
- connector templates for future MCP servers
- rich embedded tool UIs if later supported

## Output requirements

Provide the implementation in labeled code sections by filename.
Use production-quality React + TypeScript.
Use localStorage-backed mock persistence and mock providers for now.
Create a clear path for replacing the mocks with real MCP servers and real Telegram/webhook integrations later.
Do not use Supabase anywhere.
```
