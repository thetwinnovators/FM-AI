# Flow AI MCP Build Plan

## Overview

Flow AI already has important foundations in place: a local Ollama-based setup, a persistent memory retriever direction, a knowledge-graph memory direction, and a roadmap that explicitly reserves Phase 4 for retrieval-aware tool routing and agent workflows.[cite:855][cite:1093] FlowMap also already has a chat-like Ask Me Anything experience, saved conversations, and broader plans to integrate external tools and MCP-connected actions for research, content creation, and execution.[cite:642][cite:1482][cite:1483][cite:1484]

The gap is that Flow AI is not yet a full MCP agent. A full MCP agent needs an MCP client layer that can discover and invoke tools, resources, and prompts exposed by MCP servers, along with orchestration, approval controls, state management, and evaluation loops.[cite:1485][cite:1494][cite:1496] This plan defines a practical path from the current Flow AI state to a strong single-agent MCP assistant first, followed by a more robust agent platform.

## What MCP requires

Model Context Protocol is built around three key server-side primitives: tools, resources, and prompts.[cite:1485][cite:1494][cite:1496] Tools perform actions, resources expose read-oriented context, and prompts package reusable workflows or structured starting instructions for common tasks.[cite:1485][cite:1489][cite:1494]

For Flow AI to function as a real MCP agent, it needs to do more than answer with retrieved memory. It must discover available MCP servers, inspect capabilities, choose the right tool or resource for a task, execute calls with structured inputs, track state across steps, and safely decide when to continue, ask for approval, or stop.[cite:1486][cite:1491][cite:1493]

## Current state

Flow AI is already moving in the right direction because its roadmap includes ingestion, chunking, embeddings, vector retrieval, metadata filtering, reranking, typed memory, better context building, and eventually retrieval-aware tool routing with agent workflows.[cite:1093] Flow AI also has ongoing work around excessive context retrieval and a persistent memory retriever stored in the FlowMap knowledge graph, which is directly relevant to agent routing and context control.[cite:855][cite:1389]

FlowMap itself already behaves like a strong context workspace rather than a blank assistant shell. It can search multiple sources, organize saved items into a knowledge base by topics and tags, and provide a chat interface over stored memory, which gives the future agent meaningful internal context to work with.[cite:642] Planned integrations with social platforms, design tools, and workspace tools also make MCP a natural fit rather than an add-on.[cite:1482][cite:1483][cite:1484]

## Gap analysis

The following table shows the main difference between the current Flow AI state and a usable MCP agent.

| Layer | Current position | What still needs to be built |
|---|---|---|
| Chat interface | Present in FlowMap.[cite:642] | Add agent run states, tool-call status, approvals, retries, and execution history.[cite:1491] |
| Retrieval and memory | In progress through phased RAG and persistent retriever work.[cite:1093][cite:855] | Tighten typed memory, context budgeting, metadata extraction, and retrieval routing.[cite:1389][cite:1427] |
| MCP client | Not fully implemented based on current roadmap and memory context.[cite:1093][cite:1482] | Connect to MCP servers, discover tools/resources/prompts, handle invocation and errors.[cite:1485][cite:1492] |
| Tool orchestration | Planned later as Phase 4 agent workflows.[cite:1093] | Implement planner-router loop, step execution, result inspection, and handoff rules.[cite:1491][cite:1493][cite:1495] |
| Safety and approvals | No full approval system is evident yet from current context.[cite:1093][cite:642] | Add confirmations, allowlists, rate limits, secret handling, and audit logs.[cite:1491][cite:1496] |
| Evaluation and observability | Deferred to later roadmap phases.[cite:1093] | Add traces, latency metrics, tool success rates, and benchmark tasks.[cite:1491][cite:1493] |

## Recommended target

The best next target is not a broad multi-agent platform. The best target is a **single-agent MCP assistant** that can reliably use a limited set of MCP-connected tools with approval, memory-aware routing, and a visible execution trail.[cite:1491][cite:1493][cite:1495] That is much more achievable in the near term and fits FlowMap’s current maturity better than jumping straight to fully autonomous orchestration.[cite:1093][cite:642]

This target should allow Flow AI to do tasks such as:

- read relevant memory and workspace context before acting
- choose from a small set of approved MCP tools
- propose or execute a multi-step plan for a user request
- ask for approval before side effects
- write the outcome back into FlowMap memory
- show the user what tools were used and what happened at each step

That would already make Flow AI meaningfully agentic without requiring the full complexity of a generalized autonomous system.[cite:1482][cite:1483][cite:1484][cite:1491]

## Phase plan

## Phase 1: MCP foundation

The first phase is to add an MCP client layer inside FlowMap. This layer should connect to configured MCP servers, discover their tools, resources, and prompts, normalize those capabilities into a common internal shape, and expose them to the Flow AI orchestration layer.[cite:1485][cite:1492][cite:1494]

Recommended modules:

- `src/agent/mcp/client.ts` — connection lifecycle and capability discovery
- `src/agent/mcp/registry.ts` — normalized registry of tools, resources, and prompts
- `src/agent/mcp/types.ts` — shared capability types
- `src/agent/mcp/invoke.ts` — safe wrapper for tool and resource calls

Phase 1 completion criteria:

- FlowMap can connect to at least one MCP server.
- Flow AI can list tools, resources, and prompts from that server.
- A developer can manually call one tool and inspect the result in the UI.[cite:1485][cite:1492]

## Phase 2: Single-agent execution loop

The second phase is the first true agent step. Flow AI should classify user intent, choose between answer-only mode, retrieval-only mode, or tool-using mode, then run a simple execution loop: plan, call, inspect result, decide whether to continue, and return output.[cite:1486][cite:1491][cite:1493]

Recommended modules:

- `src/agent/core/classifyIntent.ts`
- `src/agent/core/planStep.ts`
- `src/agent/core/runAgentLoop.ts`
- `src/agent/core/inspectToolResult.ts`
- `src/agent/core/stopConditions.ts`

Phase 2 completion criteria:

- Flow AI can complete simple one-step and two-step tasks.
- Tool errors are surfaced clearly.
- Flow AI does not loop indefinitely because stop conditions are explicit.[cite:1491][cite:1495]

## Phase 3: Approval and safety

Before Flow AI can feel trustworthy, it needs explicit approval controls. Read-only actions may run automatically, but side-effecting actions such as posting, writing, deleting, or triggering external automations should require confirmation unless the user has explicitly granted standing permission.[cite:1491][cite:1496]

Recommended modules:

- `src/agent/safety/policy.ts`
- `src/agent/safety/classifyRisk.ts`
- `src/agent/safety/approvalStore.ts`
- `src/agent/safety/auditLog.ts`

Phase 3 completion criteria:

- Every tool call is labeled read-only or side-effecting.
- Side-effecting calls require approval.
- All agent runs are logged with timestamp, tool, input summary, and result summary.[cite:1491][cite:1496]

## Phase 4: Memory-aware routing

This phase ties the agent to FlowMap’s strongest differentiator: memory and structured context. Flow AI should use typed memory, metadata filters, and the knowledge-graph direction to decide which parts of memory matter for a task before selecting tools.[cite:855][cite:1093][cite:1389]

Recommended modules:

- `src/agent/memory/selectContext.ts`
- `src/agent/memory/extractMetadataHints.ts`
- `src/agent/memory/rankRelevantMemory.ts`
- `src/agent/memory/writeBackResult.ts`

Phase 4 completion criteria:

- Tool selection improves when relevant project, person, or workflow memory exists.
- Context sent to the model is bounded and traceable.
- Agent outputs are written back to memory in structured form for future reuse.[cite:1389][cite:1427][cite:1430]

## Phase 5: Workflow layer

Once the single-agent loop is stable, Flow AI can move into reusable workflows. These workflows should not be fully autonomous black boxes at first. They should be defined sequences with checkpoints, resumable state, and tool-specific fallbacks.[cite:1493][cite:1495]

Recommended modules:

- `src/agent/workflows/workflowRegistry.ts`
- `src/agent/workflows/runWorkflow.ts`
- `src/agent/workflows/workflowState.ts`
- `src/agent/workflows/checkpoints.ts`

Example early workflows:

- research a pain point and summarize findings
- draft responses to social comments, then wait for approval
- gather notes from saved items and create a project brief
- turn a discovered app idea into a build prompt and execution checklist

These workflows align with FlowMap’s broader product direction around research, idea generation, social response drafting, and project execution.[cite:1209][cite:1484][cite:1483]

## Phase 6: Evaluation and observability

The final layer needed for a dependable MCP agent is evaluation. Agent behavior is otherwise too opaque and fragile. Instrumentation should capture tool call traces, decision paths, latency, context size, approval interruptions, and failure modes.[cite:1093][cite:1491][cite:1493]

Recommended modules:

- `src/agent/evals/traceRun.ts`
- `src/agent/evals/benchmarkTasks.ts`
- `src/agent/evals/scoreRun.ts`
- `src/agent/evals/reportMetrics.ts`

Core metrics:

- task success rate
- average steps per task
- tool failure rate
- approval acceptance rate
- average context token size
- time to first useful action
- total task latency

## UI states needed

FlowMap’s current chat-style interface is a good base, but a true agent experience needs richer visible state so the user can trust what is happening.[cite:642] The interface should support:

- thinking or planning state
- selected memory/context preview
- tool chosen
- waiting for approval
- running tool
- tool success or failure
- step summary
- final answer plus what was written back to memory

A simple run timeline panel would go a long way. It should show the selected tool, short reason, inputs summary, result summary, and approval checkpoints so the user can audit the run without reading raw logs.[cite:1491][cite:1493]

## Initial MCP servers to support

The first version should stay narrow. A small number of high-value MCP connections will produce more value than a broad unstable surface area.[cite:1492][cite:1495]

Suggested early categories based on FlowMap’s direction:

| Category | Why it matters for FlowMap | Example usage |
|---|---|---|
| File or workspace access | Supports local project context and document workflows. | Read or summarize local project files. |
| Browser or web research | Strengthens pain-point research and evidence gathering. | Visit a page, extract content, summarize it. |
| Google Docs/Sheets/Slides | Matches planned execution workflows.[cite:1483] | Turn notes into briefs, sheets, or slides. |
| Social media workflow tools | Matches planned drafting and approval flows.[cite:1484] | Draft comment replies for review. |
| Design or creative tools | Matches FlowMap’s project and design execution direction.[cite:1483] | Create or update working assets. |

## Estimated effort

The effort depends on how polished the result needs to be. Based on the current Flow AI state, a realistic framing is:

| Target | Scope | Rough effort |
|---|---|---|
| MCP-enabled assistant | Connect a few servers, manual tool use, simple UI exposure | 1 to 3 weeks[cite:1485][cite:1492] |
| Strong single-agent MCP Flow AI | Planner loop, approvals, memory-aware routing, logs | 3 to 6 weeks[cite:1491][cite:1493][cite:1495] |
| Robust full MCP agent | Workflow engine, deep evaluations, stronger recovery, broad integration surface | 6 to 12+ weeks[cite:1491][cite:1493] |

These are product-engineering estimates for a focused builder working on a local-first app, not enterprise platform estimates.[cite:642][cite:1093]

## Recommendation

The best next move is to build a strong **single-agent MCP Flow AI** first, not a fully generalized agent platform. The fastest path to value is:

1. add MCP client discovery
2. build one execution loop
3. add approvals and safety
4. connect memory-aware routing
5. ship two or three high-value workflows
6. add traces and evaluation after the loop is stable

That path fits FlowMap’s current maturity and your roadmap very closely.[cite:1093][cite:855][cite:1482] It also avoids premature complexity while still giving Flow AI real agent behavior rather than just a smarter chat shell.[cite:642][cite:1491]

## Suggested milestone order

A practical milestone sequence for the codebase is:

1. `mcp client + capability registry`
2. `single-step tool execution`
3. `approval modal + audit log`
4. `memory-aware context selection`
5. `two reusable workflows`
6. `run timeline UI`
7. `basic eval traces`

That milestone order lets each layer prove itself before the next layer adds complexity.[cite:1491][cite:1495] It also gives Flow AI a believable progression from assistant, to tool-using assistant, to agentic workspace operator.[cite:1486][cite:1493]
