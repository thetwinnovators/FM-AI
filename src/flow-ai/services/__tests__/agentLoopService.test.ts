import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAgentLoop } from '../agentLoopService.js'
import type { AgentEvent } from '../agentLoopService.js'

// Mock all external dependencies
vi.mock('../../../lib/llm/ollama.js', () => ({
  chatJson: vi.fn(),
}))
vi.mock('../../../mcp/storage/localMCPStorage.js', () => ({
  localMCPStorage: {
    listTools: vi.fn(() => [
      {
        id: 'flowmap_get_topics',
        integrationId: 'integ_flowmap',
        toolName: 'get_topics',
        displayName: 'Get Followed Topics',
        description: 'List all topics.',
        riskLevel: 'read',
        permissionMode: 'read_only',
      },
      {
        id: 'telegram_send_message',
        integrationId: 'integ_telegram',
        toolName: 'send_message',
        displayName: 'Send Telegram Message',
        description: 'Send a message.',
        riskLevel: 'write',
        permissionMode: 'auto',
      },
    ]),
    listIntegrations: vi.fn(() => [
      { id: 'integ_flowmap', type: 'flowmap', name: 'FlowMap', status: 'connected', updatedAt: '' },
      { id: 'integ_telegram', type: 'telegram', name: 'Telegram', status: 'connected', updatedAt: '' },
    ]),
  },
}))
vi.mock('../../../mcp/services/mcpExecutionService.js', () => ({
  runTool: vi.fn(),
}))
vi.mock('../../../mcp/services/mcpMemoryService.js', () => ({
  writeAgentResult: vi.fn(),
}))
vi.mock('../agentSystemPrompt.js', () => ({
  buildAgentSystemPrompt: vi.fn(() => 'system-prompt-stub'),
}))

import { chatJson } from '../../../lib/llm/ollama.js'
import { runTool } from '../../../mcp/services/mcpExecutionService.js'
import { writeAgentResult } from '../../../mcp/services/mcpMemoryService.js'

const mockChatJson = vi.mocked(chatJson)
const mockRunTool = vi.mocked(runTool)
const mockWriteAgentResult = vi.mocked(writeAgentResult)

function makeCtrl() {
  return new AbortController()
}

function collectEvents(events: AgentEvent[]) {
  return (event: AgentEvent) => events.push(event)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runAgentLoop — answer path', () => {
  it('emits thought then done when model returns action=answer immediately', async () => {
    mockChatJson.mockResolvedValue({
      thought: 'I know this without tools.',
      action: 'answer',
      answer: 'The answer is 42.',
    })

    const events: AgentEvent[] = []
    const result = await runAgentLoop('what is the answer?', {
      ctrl: makeCtrl(),
      onEvent: collectEvents(events),
    })

    expect(events[0]).toMatchObject({ type: 'thought', text: 'I know this without tools.' })
    expect(events[events.length - 1]).toMatchObject({ type: 'done', answer: 'The answer is 42.' })
    expect(result.finalAnswer).toBe('The answer is 42.')
  })

  it('calls writeAgentResult after completion', async () => {
    mockChatJson.mockResolvedValue({ thought: 'ok', action: 'answer', answer: 'done' })
    await runAgentLoop('test', { ctrl: makeCtrl(), onEvent: () => {} })
    expect(mockWriteAgentResult).toHaveBeenCalledOnce()
  })
})

describe('runAgentLoop — read tool path', () => {
  it('auto-executes a read tool without emitting awaiting_approval', async () => {
    mockChatJson
      .mockResolvedValueOnce({
        thought: 'I will list topics.',
        action: 'tool',
        toolId: 'flowmap_get_topics',
        toolInput: { limit: 5 },
      })
      .mockResolvedValueOnce({
        thought: 'Got the topics.',
        action: 'answer',
        answer: 'You follow 3 topics.',
      })

    mockRunTool.mockResolvedValue({
      success: true,
      executionId: 'exec_1',
      output: ['AI', 'Crypto', 'Design'],
    })

    const events: AgentEvent[] = []
    const result = await runAgentLoop('list my topics', {
      ctrl: makeCtrl(),
      onEvent: collectEvents(events),
    })

    const awaitingEvent = events.find((e) => e.type === 'awaiting_approval')
    expect(awaitingEvent).toBeUndefined()
    expect(mockRunTool).toHaveBeenCalledOnce()
    expect(result.finalAnswer).toBe('You follow 3 topics.')
  })

  it('emits tool_selected and step_done for each tool call', async () => {
    mockChatJson
      .mockResolvedValueOnce({
        thought: 'Listing.',
        action: 'tool',
        toolId: 'flowmap_get_topics',
        toolInput: {},
      })
      .mockResolvedValueOnce({ thought: 'Done.', action: 'answer', answer: 'Topics: AI.' })

    mockRunTool.mockResolvedValue({ success: true, executionId: 'exec_1', output: ['AI'] })

    const events: AgentEvent[] = []
    await runAgentLoop('list topics', { ctrl: makeCtrl(), onEvent: collectEvents(events) })

    expect(events.some((e) => e.type === 'tool_selected')).toBe(true)
    expect(events.some((e) => e.type === 'step_done')).toBe(true)
  })
})

describe('runAgentLoop — write tool approval path', () => {
  it('emits awaiting_approval for write-risk tools', async () => {
    mockChatJson.mockResolvedValueOnce({
      thought: 'Will send a message.',
      action: 'tool',
      toolId: 'telegram_send_message',
      toolInput: { message: 'hi', chatId: '@dev' },
    })

    const events: AgentEvent[] = []
    const loopPromise = runAgentLoop('send hi to telegram', {
      ctrl: makeCtrl(),
      onEvent: (event) => {
        events.push(event)
        // Auto-deny to unblock the loop
        if (event.type === 'awaiting_approval') {
          event.deny()
        }
      },
    })

    const result = await loopPromise
    expect(events.some((e) => e.type === 'awaiting_approval')).toBe(true)
    expect(result.finalAnswer).toContain('Send Telegram Message')
  })

  it('executes tool and continues loop when approved', async () => {
    mockChatJson
      .mockResolvedValueOnce({
        thought: 'Sending.',
        action: 'tool',
        toolId: 'telegram_send_message',
        toolInput: { message: 'hi' },
      })
      .mockResolvedValueOnce({ thought: 'Done.', action: 'answer', answer: 'Message sent.' })

    mockRunTool.mockResolvedValue({ success: true, executionId: 'exec_1', output: { ok: true } })

    const events: AgentEvent[] = []
    const result = await runAgentLoop('send hi via telegram', {
      ctrl: makeCtrl(),
      onEvent: (event) => {
        events.push(event)
        if (event.type === 'awaiting_approval') {
          event.approve()
        }
      },
    })

    expect(mockRunTool).toHaveBeenCalledOnce()
    expect(result.finalAnswer).toBe('Message sent.')
  })
})

describe('runAgentLoop — error handling', () => {
  it('returns graceful answer when chatJson returns null twice', async () => {
    mockChatJson.mockResolvedValue(null)
    const result = await runAgentLoop('do something', { ctrl: makeCtrl(), onEvent: () => {} })
    expect(result.finalAnswer).toBeTruthy()
    expect(typeof result.finalAnswer).toBe('string')
  })

  it('retries tool once on failure then continues', async () => {
    mockChatJson
      .mockResolvedValueOnce({
        thought: 'Will use topics tool.',
        action: 'tool',
        toolId: 'flowmap_get_topics',
        toolInput: {},
      })
      .mockResolvedValueOnce({ thought: 'Got it.', action: 'answer', answer: 'Done.' })

    mockRunTool
      .mockResolvedValueOnce({ success: false, executionId: 'e1', error: 'timeout' })
      .mockResolvedValueOnce({ success: true, executionId: 'e2', output: [] })

    const result = await runAgentLoop('list topics', { ctrl: makeCtrl(), onEvent: () => {} })
    expect(mockRunTool).toHaveBeenCalledTimes(2)
    expect(result.finalAnswer).toBe('Done.')
  })

  it('stops gracefully when AbortController is aborted before loop iteration', async () => {
    const ctrl = makeCtrl()
    ctrl.abort() // abort before the loop even starts
    const result = await runAgentLoop('test', { ctrl, onEvent: () => {} })
    // Loop exits immediately — chatJson is never called
    expect(mockChatJson).not.toHaveBeenCalled()
    expect(result.finalAnswer).toBeTruthy() // max-steps fallback fires
  })

  it('emits done with step-limit message when loop exhausts MAX_STEPS', async () => {
    // Always return a tool action — loop should stop at step 5
    mockChatJson.mockResolvedValue({
      thought: 'Using the tool.',
      action: 'tool',
      toolId: 'flowmap_get_topics',
      toolInput: {},
    })
    mockRunTool.mockResolvedValue({ success: true, executionId: 'e1', output: [] })

    const events: AgentEvent[] = []
    const result = await runAgentLoop('keep going', {
      ctrl: makeCtrl(),
      onEvent: collectEvents(events),
    })

    // Loop ran 5 steps then hit the limit
    const stepDoneEvents = events.filter((e) => e.type === 'step_done')
    expect(stepDoneEvents).toHaveLength(5)
    const doneEvent = events.find((e) => e.type === 'done')
    expect(doneEvent).toBeDefined()
    expect(result.finalAnswer).toContain("step limit")
  })
})
