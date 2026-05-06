# FlowMap MCP Agent Tools Spec

This document defines how FlowMap should wire external connections into an MCP-style agent layer so Flow AI can execute tasks safely, consistently, and audibly across connected tools.

## Purpose

FlowMap already has the right conceptual layers for agentic behavior:
- inputs
- integrations
- AI
- rules
- memory
- derived signals
- outputs

The next step is to make each connected integration expose executable tools that Flow AI can call through a standardized runtime.

## Product goal

Flow AI should move from:
- answering questions
- generating summaries
- suggesting actions

To also being able to:
- inspect connected systems
- draft work in external tools
- send content
- create documents
- schedule tasks
- trigger workflows
- report outcomes back into FlowMap

## Core principle

A connection is not enough.

Each connected service must expose one or more tool capabilities through a standard MCP adapter layer.

Use this model:
- **Connection** = account link + auth state
- **Tool** = executable capability inside a connection
- **MCP adapter** = standardized wrapper around tool functions
- **Agent runtime** = selection, permissioning, execution, and result handling
- **Execution log** = full audit trail

## Why this fits FlowMap

FlowMap’s existing architecture already separates integrations, AI, rules, memory, and outputs. That makes it a strong fit for a permission-aware agent layer where:
- AI proposes the action
- rules gate the action
- tools execute the action
- logs record the action
- memory stores what happened
- outputs communicate the result

This keeps behavior explainable instead of opaque.

## Target integrations

Based on the current FlowMap connection model, the initial integrations include:
- Telegram
- Figma
- Google Drive
- Gmail
- Google Calendar
- Google Slides
- YouTube
- Google Docs
- Higgsfield AI
- Instagram
- Facebook

## Tool registry model

Every integration must register tool definitions.

### Tool definition shape

```ts
export type MCPToolRiskLevel = 'read' | 'write' | 'publish';

export interface MCPToolDefinition<Input = unknown, Output = unknown> {
  name: string;
  title: string;
  description: string;
  integrationKey: string;
  riskLevel: MCPToolRiskLevel;
  requiresConfirmation: boolean;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  enabled: boolean;
  handler: (input: Input, ctx: MCPToolContext) => Promise<Output>;
}
```

### Tool context shape

```ts
export interface MCPToolContext {
  tenantId: string;
  userId: string;
  connectionId: string;
  requestId: string;
  flowSessionId?: string;
  topicId?: string;
  signalId?: string;
  permissions: string[];
  dryRun?: boolean;
}
```

## Integration to tool mapping

| Integration | Tool examples |
|---|---|
| Telegram | `send_message`, `send_summary`, `send_file_link`, `read_latest_messages` |
| Figma | `inspect_file`, `read_comments`, `pull_design_tokens`, `list_pages` |
| Google Drive | `list_files`, `create_folder`, `upload_file`, `move_file` |
| Google Docs | `create_doc`, `append_doc`, `read_doc`, `format_doc` |
| Google Slides | `create_presentation`, `append_slide_summary`, `export_presentation` |
| Gmail | `search_threads`, `draft_email`, `send_email` |
| Google Calendar | `list_events`, `create_event`, `update_event`, `cancel_event` |
| YouTube | `read_video_metadata`, `save_video_to_topic`, `monitor_channel` |
| Instagram | `prepare_caption`, `queue_post`, `read_comments`, `draft_reply` |
| Facebook | `read_page_comments`, `draft_reply`, `queue_post` |
| Higgsfield AI | `generate_video`, `check_job_status`, `save_output` |

## Execution architecture

### Flow

```text
User request
  -> intent analysis
  -> tool candidate selection
  -> permission/rule gate
  -> confirmation check
  -> MCP adapter execution
  -> result normalization
  -> audit log write
  -> memory write
  -> Flow AI response
```

### Execution stages

#### 1. Intent analysis
Determine whether the user is:
- asking for information
- asking for a draft
- asking for a side-effecting action
- asking for a workflow
- asking for a multi-step task

#### 2. Tool candidate selection
Select valid tools using:
- user intent
- current surface, such as chat, signal card, topic, note, or Telegram
- connected account availability
- tool risk level
- recent task context

#### 3. Permission/rule gate
Run deterministic checks before execution.

Rules can include:
- integration is connected
- required scope exists
- tool is enabled for this tenant
- task is allowed in this surface
- content meets execution preconditions
- confidence threshold is satisfied
- human confirmation exists for publish actions

#### 4. Confirmation check
Require explicit approval when actions are high risk.

#### 5. Execution
Run the adapter handler and normalize the output.

#### 6. Result handling
Write back:
- execution log
- result summary
- generated artifact references
- memory entries when useful
- topic/signal associations

## Risk model

Use three risk classes.

### Read
Low-risk data retrieval.
Examples:
- inspect Figma file
- list Google Drive files
- read comments
- check Higgsfield job status

### Write
Creates or updates drafts or internal artifacts.
Examples:
- create Google Doc
- append slide summary
- upload file to Drive
- draft email

### Publish
External side effects or communication.
Examples:
- send Gmail message
- send Telegram message
- queue Instagram post
- create Calendar event
- publish Facebook content

## Confirmation policy

| Risk level | Default behavior |
|---|---|
| Read | Auto-run allowed |
| Write | Auto-run allowed only when rules permit |
| Publish | Requires explicit confirmation by default |

### Example policy rules
- `send_email` requires confirmation unless used in a pre-approved workflow
- `queue_post` requires confirmation
- `create_event` requires confirmation unless initiated from a saved template
- `draft_email` can auto-run
- `create_doc` can auto-run
- `inspect_file` can auto-run

## Tool selection service

Create a dedicated service that ranks which tool should be called.

### Responsibilities
- map intent to candidate tools
- remove unavailable tools
- filter by permission
- filter by connected state
- rank by contextual fit
- return the best tool or tool chain

### Example output

```ts
interface ToolSelectionResult {
  mode: 'single' | 'chain' | 'none';
  tools: Array<{
    toolName: string;
    score: number;
    reason: string;
  }>;
}
```

## Multi-step task chaining

Some requests will require multiple tools.

Example:
- summarize research
- create a Google Doc
- save the doc to Drive
- send the summary to Telegram

Use a lightweight task plan structure.

```ts
interface AgentTaskPlan {
  id: string;
  goal: string;
  steps: Array<{
    toolName: string;
    input: Record<string, unknown>;
    requiresConfirmation: boolean;
  }>;
}
```

## Adapter design

Each integration should have its own adapter.

### Example structure

```text
src/flow-ai/mcp/
  registry/
    toolRegistry.ts
    integrationRegistry.ts
  runtime/
    toolSelectionService.ts
    permissionGateService.ts
    confirmationService.ts
    toolExecutionService.ts
    resultNormalizationService.ts
    executionLogService.ts
    taskPlanningService.ts
    taskChainService.ts
    resultMemoryService.ts
  adapters/
    telegramAdapter.ts
    figmaAdapter.ts
    googleDriveAdapter.ts
    googleDocsAdapter.ts
    googleSlidesAdapter.ts
    gmailAdapter.ts
    googleCalendarAdapter.ts
    youtubeAdapter.ts
    instagramAdapter.ts
    facebookAdapter.ts
    higgsfieldAdapter.ts
  schemas/
    telegramSchemas.ts
    figmaSchemas.ts
    googleSchemas.ts
    socialSchemas.ts
    higgsfieldSchemas.ts
```

## Database tables

Add core tables to support connections, tool registry, execution, and permissions.

### 1. connections

```sql
create table connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  integration_key text not null,
  provider_account_id text,
  status text not null,
  scopes jsonb default '[]'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 2. mcp_tools

```sql
create table mcp_tools (
  id uuid primary key default gen_random_uuid(),
  integration_key text not null,
  tool_name text not null unique,
  title text not null,
  description text,
  risk_level text not null,
  requires_confirmation boolean default false,
  enabled boolean default true,
  input_schema jsonb not null,
  output_schema jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 3. mcp_tool_permissions

```sql
create table mcp_tool_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  tool_name text not null,
  is_allowed boolean default true,
  require_confirmation_override boolean,
  allowed_surfaces jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 4. mcp_execution_logs

```sql
create table mcp_execution_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid,
  request_id text not null,
  flow_session_id text,
  connection_id uuid,
  tool_name text not null,
  risk_level text not null,
  status text not null,
  input_payload jsonb default '{}'::jsonb,
  output_payload jsonb default '{}'::jsonb,
  error_payload jsonb default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);
```

### 5. mcp_task_plans

```sql
create table mcp_task_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid,
  goal text not null,
  status text not null,
  plan jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### 6. mcp_execution_artifacts

```sql
create table mcp_execution_artifacts (
  id uuid primary key default gen_random_uuid(),
  execution_log_id uuid references mcp_execution_logs(id) on delete cascade,
  artifact_type text not null,
  artifact_ref text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
```

## Memory writeback

Each meaningful tool execution should optionally create memory artifacts.

Write memory when:
- a draft is created
- a publish action completes
- a recurring workflow pattern is detected
- user approval or rejection provides learning signal
- an output should be retrievable later

Suggested memory fields:
- action type
- target system
- object created or updated
- linked topic or signal
- approval state
- result summary
- timestamp

## Rule engine integration

Tool execution should always pass through FlowMap’s deterministic rule layer.

Rules should decide:
- whether execution is allowed
- whether confirmation is required
- whether fallback behavior is needed
- whether a task should be routed to a workflow instead of a direct tool call

This is important because FlowMap should not become a black-box agent. It should remain auditable and predictable.

## Prompt and response contract

Flow AI should expose execution plans clearly.

### Example assistant behavior

1. identify requested task
2. state intended tool use
3. ask for confirmation when needed
4. execute
5. report outcome
6. offer suggested next actions

### Example response structure

```ts
interface FlowAIToolResponse {
  answer: string;
  plannedTools?: string[];
  requiresConfirmation?: boolean;
  executionStatus?: 'planned' | 'running' | 'completed' | 'failed';
  suggestedQuestions?: string[];
  suggestedActions?: string[];
}
```

## UI implications

The Connections page should evolve from a status page into a capability registry.

Each integration card should show:
- connection state
- number of available tools
- tool categories
- permission level
- last execution
- recent errors
- manage button

Each tool detail view should show:
- tool name
- description
- risk level
- allowed surfaces
- auto-run policy
- last result
- logs

## Suggested surfaces

The MCP tool layer should be usable from:
- Ask Flow AI chat
- signal cards
- topic detail pages
- notes/documents
- Telegram
- future workflow builder

## Recommended rollout

### Phase 1
- tool registry
- connection registry
- Telegram adapter
- Google Docs adapter
- Google Drive adapter
- execution logs
- permission gate

### Phase 2
- Gmail draft tools
- Google Calendar draft tools
- Figma inspect tools
- memory writeback
- tool detail screens

### Phase 3
- multi-step task plans
- workflow routing
- social publishing confirmations
- Higgsfield generation tools
- suggested action chips tied to tool calls

## Success criteria

The MCP tool layer is working when:
- connected integrations expose executable tools
- Flow AI can choose the right tool for a task
- publish actions require proper confirmation
- every tool execution is logged
- useful outputs are written back into memory
- the user can run real tasks from chat and other FlowMap surfaces
- the system remains explainable and deterministic at the rule layer

## Final implementation direction

Build FlowMap’s agent layer as a standardized tool runtime, not as scattered integration-specific logic.

That means:
- one registry model
- one permission model
- one execution log model
- one adapter contract
- one writeback strategy into memory and outputs

This will let Flow AI grow from a chat layer into a reliable execution layer across research, content, communication, and workflow tasks.
EOF && ls -l /home/user/output/flowmap-mcp-agent-tools-spec.md
