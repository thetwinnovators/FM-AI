import { chatJson } from '../../lib/llm/ollama.js'
import { localMCPStorage } from '../../mcp/storage/localMCPStorage.js'
import { runTool } from '../../mcp/services/mcpExecutionService.js'
import { writeAgentResult } from '../../mcp/services/mcpMemoryService.js'
import { buildAgentSystemPrompt } from './agentSystemPrompt.js'
import type { MCPToolDefinition } from '../../mcp/types.js'

// ─── Public types ─────────────────────────────────────────────────────────────

export type AgentStep =
  | { type: 'thought'; text: string; step: number }
  | { type: 'tool_selected'; toolName: string; step: number }
  | { type: 'step_done'; toolName: string; resultSummary: string; step: number }
  | { type: 'denied'; toolName: string; step: number }
  | { type: 'done'; answer: string }

export interface PendingApprovalState {
  toolName: string
  integrationId: string
  inputSummary: string
}

export type AgentEvent =
  | AgentStep
  | {
      type: 'awaiting_approval'
      pendingApproval: PendingApprovalState
      approve: () => void
      deny: () => void
    }

export interface MemoryContextEntry {
  category: string
  content: string
}

export interface RunAgentLoopOptions {
  ctrl: AbortController
  memoryContext?: MemoryContextEntry[]
  onEvent: (event: AgentEvent) => void
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const MAX_STEPS = 5

interface ModelResponse {
  thought: string
  action: 'tool' | 'answer'
  toolId?: string
  toolInput?: Record<string, unknown>
  answer?: string
}

function isValidResponse(v: unknown): v is ModelResponse {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return typeof r.thought === 'string' && (r.action === 'tool' || r.action === 'answer')
}

function summariseResult(result: unknown): string {
  if (result === undefined || result === null) return 'No output'
  const str = typeof result === 'string' ? result : JSON.stringify(result)
  return str.slice(0, 200)
}

function buildInputSummary(toolInput: Record<string, unknown>): string {
  return Object.entries(toolInput)
    .map(([k, v]) => `${k}: ${String(v).slice(0, 60)}`)
    .join(', ')
    .slice(0, 120)
}

function awaitApproval(
  tool: MCPToolDefinition,
  toolInput: Record<string, unknown>,
  onEvent: (event: AgentEvent) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    onEvent({
      type: 'awaiting_approval',
      pendingApproval: {
        toolName: tool.displayName,
        integrationId: tool.integrationId,
        inputSummary: buildInputSummary(toolInput),
      },
      approve: () => resolve(true),
      deny: () => resolve(false),
    })
  })
}

// ─── Main loop ────────────────────────────────────────────────────────────────

export async function runAgentLoop(
  text: string,
  options: RunAgentLoopOptions,
): Promise<{ steps: AgentStep[]; finalAnswer: string }> {
  const { ctrl, memoryContext = [], onEvent } = options

  const systemPrompt = buildAgentSystemPrompt(memoryContext)
  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: text },
  ]

  const steps: AgentStep[] = []
  let finalAnswer = ''
  let step = 0

  function emit(event: AgentStep): void {
    steps.push(event)
    onEvent(event)
  }

  while (step < MAX_STEPS) {
    if (ctrl.signal.aborted) break

    // Try up to 2 times to get a valid JSON response from the model.
    const fullMessages = [{ role: 'system', content: systemPrompt }, ...messages]
    let parsed: ModelResponse | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      if (ctrl.signal.aborted) break
      const raw = await chatJson(fullMessages, { signal: ctrl.signal })
      if (isValidResponse(raw)) {
        parsed = raw
        break
      }
    }

    if (!parsed) {
      finalAnswer = "I couldn't produce a valid action for that request — the model returned unexpected output. Try rephrasing."
      emit({ type: 'done', answer: finalAnswer })
      break
    }

    emit({ type: 'thought', text: parsed.thought, step })

    // ── Answer action → done ───────────────────────────────────────────────
    if (parsed.action === 'answer') {
      finalAnswer = parsed.answer ?? ''
      emit({ type: 'done', answer: finalAnswer })
      break
    }

    // ── Tool action ────────────────────────────────────────────────────────
    const toolId = parsed.toolId ?? ''
    const toolInput = parsed.toolInput ?? {}

    const tool = localMCPStorage.listTools().find((t) => t.id === toolId) ?? null
    if (!tool) {
      const msg = `Tool "${toolId}" not found in the registry.`
      messages.push({ role: 'tool', content: msg })
      emit({ type: 'step_done', toolName: toolId, resultSummary: msg, step })
      step++
      continue
    }

    emit({ type: 'tool_selected', toolName: tool.displayName, step })

    // Approval gate for non-read tools
    if (tool.riskLevel !== 'read') {
      const approved = await awaitApproval(tool, toolInput, onEvent)
      if (!approved) {
        emit({ type: 'denied', toolName: tool.displayName, step })
        finalAnswer = `I would have used ${tool.displayName} to complete that action. Let me know if you'd like to proceed.`
        emit({ type: 'done', answer: finalAnswer })
        break
      }
    }

    // Execute — retry once on failure
    let runResult = await runTool({ toolId: tool.id, input: toolInput, sourceSurface: 'chat' })
    if (!runResult.success) {
      runResult = await runTool({ toolId: tool.id, input: toolInput, sourceSurface: 'chat' })
    }

    if (!runResult.success) {
      const errMsg = runResult.error ?? 'Tool execution failed after retry.'
      messages.push({ role: 'tool', content: errMsg })
      emit({ type: 'step_done', toolName: tool.displayName, resultSummary: errMsg, step })
      step++
      continue
    }

    const summary = summariseResult(runResult.output)
    messages.push({ role: 'tool', content: JSON.stringify(runResult.output) })
    emit({ type: 'step_done', toolName: tool.displayName, resultSummary: summary, step })
    step++
  }

  // Max-steps fallback
  if (!finalAnswer) {
    const doneSteps = steps.filter((s) => s.type === 'step_done') as Array<{
      type: 'step_done'; toolName: string; resultSummary: string; step: number
    }>
    finalAnswer = doneSteps.length
      ? `I've reached the step limit. Here's what I found: ${doneSteps.map((s) => s.resultSummary).join('; ')}`
      : "I've reached the step limit without finding an answer."
    emit({ type: 'done', answer: finalAnswer })
  }

  // Memory write-back (fire-and-forget — never blocks the return)
  const toolsUsed = (steps.filter((s) => s.type === 'step_done') as Array<{ toolName: string }>)
    .map((s) => s.toolName)
  try {
    writeAgentResult({ userMessage: text, toolsUsed, outcome: finalAnswer, source: 'agent_run' })
  } catch { /* memory write failure must never surface to the user */ }

  return { steps, finalAnswer }
}
