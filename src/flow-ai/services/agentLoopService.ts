import { chatJson } from '../../lib/llm/ollama.js'
import { localMCPStorage } from '../../mcp/storage/localMCPStorage.js'
import { runTool } from '../../mcp/services/mcpExecutionService.js'
import { discoverTools } from '../../mcp/services/mcpToolRegistry.js'
import { writeAgentResult } from '../../mcp/services/mcpMemoryService.js'
import { buildAgentSystemPrompt } from './agentSystemPrompt.js'

// ─── Docker MCP auto-refresh ──────────────────────────────────────────────────
// Docker MCP tools are only cached when the user visits Connections → Docker MCP.
// Refresh them silently before every agent run so InVideo and other Docker tools
// are always in the catalog without requiring a manual reconnect.
async function refreshDockerMCPTools(): Promise<void> {
  const integ = localMCPStorage.listIntegrations().find((i) => i.type === 'docker-mcp')
  if (!integ) return
  try {
    await Promise.race([
      discoverTools({ ...integ, status: 'connected' }).then(() => {
        // If discover succeeded, mark integration as connected so tools pass the
        // connectedIds filter inside buildAgentSystemPrompt.
        localMCPStorage.updateIntegration(integ.id, { status: 'connected' })
      }),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ])
  } catch { /* daemon not running or timed out — fall back to cached tools */ }
}

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
  | { type: 'file_read'; path: string; content: string; step: number }
  | { type: 'shell_exec'; command: string; stdout: string; stderr: string; step: number }

export interface MemoryContextEntry {
  category: string
  content: string
}

export interface RunAgentLoopOptions {
  ctrl: AbortController
  memoryContext?: MemoryContextEntry[]
  pinnedToolIds?: string[]
  onEvent: (event: AgentEvent) => void
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const MAX_STEPS = 15

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

// ─── Main loop ────────────────────────────────────────────────────────────────

export async function runAgentLoop(
  text: string,
  options: RunAgentLoopOptions,
): Promise<{ steps: AgentStep[]; finalAnswer: string }> {
  const { ctrl, memoryContext = [], pinnedToolIds = [], onEvent } = options

  // Refresh Docker MCP tools before building the system prompt so InVideo and
  // other Docker tools are always in the catalog without a manual reconnect.
  await refreshDockerMCPTools()

  const systemPrompt = buildAgentSystemPrompt(memoryContext, pinnedToolIds)
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

  // ── Docker MCP pre-flight ──────────────────────────────────────────────────
  // If the user is asking for a Docker MCP action (video generation, code
  // execution) but no Docker MCP tools are cached yet, skip the JSON agent
  // loop entirely and explain how to connect — avoids the cryptic
  // "model returned unexpected output" failure that happens when the system
  // prompt contains "(no tools connected)" and the model can't produce JSON.
  const DOCKER_ACTION_RE = /\b(generate|create|make|produce)\s+(?:a\s+)?(?:short\s+)?video\b|\brun\s+(?:this\s+)?(?:python|script|code)\b|\bexecute\s+(?:this\s+)?(?:code|script)\b/i
  if (DOCKER_ACTION_RE.test(text)) {
    const dockerInteg = localMCPStorage.listIntegrations().find((i) => i.type === 'docker-mcp')
    const dockerToolCount = dockerInteg
      ? localMCPStorage.listTools().filter((t) => t.integrationId === dockerInteg.id).length
      : 0
    if (dockerToolCount === 0) {
      finalAnswer = 'I need Docker MCP connected to do that — InVideo lives inside it.\n\n**To connect:**\n1. Open **Docker Desktop** and make sure it\'s running.\n2. In FlowMap go to **Connections → Docker MCP** and click **Connect**.\n3. Come back here and send the same message — I\'ll discover InVideo automatically.'
      emit({ type: 'done', answer: finalAnswer })
      return { steps, finalAnswer }
    }
  }

  // ── Pinned-tool fast path ──────────────────────────────────────────────────
  // When the user explicitly pinned exactly one tool via #tool-name, skip the
  // LLM JSON loop entirely and call that tool directly with the message content.
  // Small models (llama3.2:3b etc.) reliably fail to produce the structured
  // JSON the agent loop requires; pinned-tool usage must work regardless of
  // model size — the user has already told us which tool to call.
  if (pinnedToolIds.length === 1) {
    const pinnedTool = localMCPStorage.listTools().find((t) => t.id === pinnedToolIds[0]) ?? null
    if (pinnedTool) {
      // Strip common lead-in phrases to isolate the core script/content.
      const coreContent = text
        .replace(/^(?:generate|create|make|produce)\s+(?:a\s+)?(?:short\s+)?video\s+from\s+(?:this\s+)?script\s*:\s*/i, '')
        .replace(/^(?:generate|create|make|produce)\s+(?:a\s+)?(?:short\s+)?video\s*:\s*/i, '')
        .replace(/^(?:run|execute)\s+(?:this\s+)?(?:code|script)\s*:\s*/i, '')
        .trim() || text

      // Pick the primary parameter name from the tool description.
      const descLower = (pinnedTool.description ?? '').toLowerCase()
      const paramName =
        descLower.includes('script')  ? 'script'  :
        descLower.includes('prompt')  ? 'prompt'  :
        descLower.includes('content') ? 'content' :
        descLower.includes('text')    ? 'text'    :
        'script'  // sensible default for InVideo
      const toolInput: Record<string, string> = { [paramName]: coreContent }

      emit({ type: 'tool_selected', toolName: pinnedTool.displayName, step })

      let runResult = await runTool({ toolId: pinnedTool.id, input: toolInput, sourceSurface: 'chat' })

      if (!runResult.success && runResult.error === 'denied by user') {
        emit({ type: 'denied', toolName: pinnedTool.displayName, step })
        finalAnswer = `I would have used ${pinnedTool.displayName} to complete that action. Let me know if you'd like to proceed.`
        emit({ type: 'done', answer: finalAnswer })
        return { steps, finalAnswer }
      }

      if (!runResult.success) {
        // One retry on non-denial failure
        runResult = await runTool({ toolId: pinnedTool.id, input: toolInput, sourceSurface: 'chat' })
      }

      const summary = summariseResult(runResult.output)
      emit({ type: 'step_done', toolName: pinnedTool.displayName, resultSummary: summary, step })

      if (!runResult.success) {
        const rawErr = runResult.error ?? 'Unknown error'
        finalAnswer = (rawErr === 'Failed to fetch' || rawErr.toLowerCase().includes('failed to fetch'))
          ? 'The FlowMap daemon is not reachable. Make sure **Docker Desktop** is running and the FlowMap daemon process is active, then try again.'
          : `The tool returned an error: ${rawErr}`
      } else {
        finalAnswer = summary
      }

      emit({ type: 'done', answer: finalAnswer })
      return { steps, finalAnswer }
    }
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
      const wantedVideo = DOCKER_ACTION_RE.test(text)
      finalAnswer = wantedVideo
        ? 'The model failed to produce valid JSON to call the video tool. Try switching to a 7B+ model in the model picker, or be explicit: "Use generate-video-from-script with script=[your text]".'
        : "I couldn't produce a valid action for that request — the model returned unexpected output. Try rephrasing."
      emit({ type: 'done', answer: finalAnswer })
      break
    }

    emit({ type: 'thought', text: parsed.thought, step })

    // ── Answer action → done ───────────────────────────────────────────────
    if (parsed.action === 'answer') {
      const answerText = (parsed.answer ?? '').trim()
      if (!answerText) {
        // Small models occasionally emit action=answer with an empty string —
        // they "decided" to answer but didn't form one. Re-prompt them once
        // before falling back. Push a tool-role message describing the issue,
        // bump the step, and continue the loop so they get another swing.
        messages.push({
          role: 'tool',
          content: 'You set action=answer with an empty answer string. Re-respond with a non-empty answer field that actually addresses the user\'s question. If you genuinely have nothing to say, set answer="I need more information — could you rephrase or share what you\'d like me to look at?"',
        })
        emit({
          type: 'step_done',
          toolName: '(empty answer)',
          resultSummary: 'Model returned action=answer with empty answer; re-prompting.',
          step,
        })
        step++
        continue
      }
      finalAnswer = answerText
      emit({ type: 'done', answer: finalAnswer })
      break
    }

    // ── Tool action ────────────────────────────────────────────────────────
    const toolId = parsed.toolId ?? ''
    const toolInput = parsed.toolInput ?? {}

    const tool = localMCPStorage.listTools().find((t) => t.id === toolId) ?? null
    if (!tool) {
      // Surface the valid tool IDs back to the model — small models otherwise
      // re-hallucinate the same fake id (or empty id) on every retry. Capped
      // at 30 to keep the feedback message under a sensible size.
      const allIds = localMCPStorage.listTools().map((t) => t.id)
      const validIds = allIds.slice(0, 30)
      const isEmpty = !toolId || !toolId.trim()
      const msg = isEmpty
        ? `toolId is EMPTY. To list available tools, respond with action=answer — the tool catalog is already in your system prompt under "TOOLS AVAILABLE". Do NOT call a tool to enumerate tools. If you want to invoke a tool, set toolId to one of: ${validIds.join(', ')}${allIds.length > 30 ? ', …' : ''}`
        : `Tool "${toolId}" does NOT exist. You cannot create tools. Choose ONE of these valid tool IDs (verbatim) or respond with action=answer: ${validIds.join(', ')}${allIds.length > 30 ? ', …' : ''}`
      messages.push({ role: 'tool', content: msg })
      emit({
        type: 'step_done',
        toolName: isEmpty ? '(no tool id)' : toolId,
        resultSummary: isEmpty
          ? 'Empty toolId. The tool catalog is in the system prompt — answer directly with it.'
          : `Unknown tool "${toolId}" — see system prompt for valid IDs.`,
        step,
      })
      step++
      continue
    }

    emit({ type: 'tool_selected', toolName: tool.displayName, step })

    // Execute. The approval gate now lives inside runTool() — any write/publish
    // tool (or anything else flagged requiresApproval) is gated by the global
    // ApprovalDialog. When the user denies, runTool returns
    // { success: false, error: 'denied by user' } and we surface that as a
    // `denied` event then end the run (we don't keep trying after a refusal).
    let runResult = await runTool({ toolId: tool.id, input: toolInput, sourceSurface: 'chat' })
    if (!runResult.success && runResult.error === 'denied by user') {
      emit({ type: 'denied', toolName: tool.displayName, step })
      finalAnswer = `I would have used ${tool.displayName} to complete that action. Let me know if you'd like to proceed.`
      emit({ type: 'done', answer: finalAnswer })
      break
    }

    // Retry once on non-denial failure
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

    // file.read full-content viewer event. Fires AFTER step_done so the timeline
    // updates first, then the inline viewer opens. Not added to steps[] history
    // because the content can be large and only the latest read matters.
    if (
      tool.toolName === 'file.read' &&
      (runResult.output as any)?.content &&
      typeof (runResult.output as any).content === 'string'
    ) {
      const pathArg = typeof (toolInput as any).path === 'string' ? (toolInput as any).path : ''
      onEvent({
        type: 'file_read',
        path: pathArg,
        content: (runResult.output as any).content,
        step,
      })
    }

    // system.exec terminal-mirror event — sends command + output to the terminal pane.
    if (tool.toolName === 'system.exec') {
      const out = runResult.output as any
      const cmdInput = toolInput as any
      const cmdStr = [cmdInput?.command, ...(cmdInput?.args ?? [])].filter(Boolean).join(' ')
      onEvent({
        type: 'shell_exec',
        command: cmdStr,
        stdout: typeof out?.stdout === 'string' ? out.stdout : '',
        stderr: typeof out?.stderr === 'string' ? out.stderr : '',
        step,
      })
    }

    step++
  }

  // Max-steps fallback. Differentiates between "hit the step ceiling" and
  // "model never produced a substantive step" so the user sees an honest
  // diagnosis instead of a generic "step limit" claim that may be wrong.
  if (!finalAnswer) {
    const doneSteps = steps.filter((s) => s.type === 'step_done') as Array<{
      type: 'step_done'; toolName: string; resultSummary: string; step: number
    }>
    if (step >= MAX_STEPS && doneSteps.length) {
      finalAnswer = `Hit the ${MAX_STEPS}-step limit before reaching a final answer. Steps taken: ${doneSteps.map((s) => s.resultSummary).join('; ')}`
    } else if (step >= MAX_STEPS) {
      finalAnswer = `Hit the ${MAX_STEPS}-step limit without making progress. The local model struggled to produce a usable response — try rephrasing or switch to a larger model in the model picker.`
    } else {
      finalAnswer = "The model returned an empty answer. This usually means the local model is too small to follow the prompt — try rephrasing or switching to a 7B+ model in the chat panel's model picker."
    }
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
