import { localMCPStorage } from '../../mcp/storage/localMCPStorage.js'

export interface MemoryContextEntry {
  category: string
  content: string
}

const JSON_SCHEMA = `{
  "thought": "string — your internal reasoning step",
  "action": "tool | answer",
  "toolId": "string (required when action=tool)",
  "toolInput": { "key": "value" },
  "answer": "string (required when action=answer)"
}`

/**
 * Builds the system message for tool-use mode.
 * Only includes tools whose parent integration has status === 'connected'.
 * Completely separate from buildSystemMessage in retrieve.js — never mixed.
 */
export function buildAgentSystemPrompt(memoryContext: MemoryContextEntry[] = []): string {
  const integrations = localMCPStorage.listIntegrations()
  const connectedIds = new Set(
    integrations.filter((i) => i.status === 'connected').map((i) => i.id),
  )
  const tools = localMCPStorage.listTools().filter((t) => connectedIds.has(t.integrationId))

  const toolCatalog = tools.length
    ? tools
        .map(
          (t) =>
            `- id: "${t.id}" | name: "${t.displayName}" | ` +
            `description: "${t.description ?? ''}" | risk: "${t.riskLevel ?? 'read'}"`,
        )
        .join('\n')
    : '(no tools connected)'

  const memoryBlock =
    memoryContext.length > 0
      ? `\nMEMORY CONTEXT:\n${memoryContext
          .map((m) => `- [${m.category}] ${m.content}`)
          .join('\n')}\n`
      : ''

  return [
    'You are a tool-using assistant. Always respond with valid JSON only.',
    'No preamble, no markdown, no explanation — output the JSON object and nothing else.',
    '',
    'RESPONSE SCHEMA:',
    JSON_SCHEMA,
    '',
    'TOOLS AVAILABLE:',
    toolCatalog,
    memoryBlock,
    'CONSTRAINTS:',
    '- Maximum 5 reasoning steps.',
    '- Prefer action=answer when you already have enough information.',
    '- When uncertain which tool to use, choose action=answer and explain naturally.',
    '- toolInput must only use parameter names described in the tool description.',
    '- Never fabricate tool output. Only report what tools actually return.',
  ].join('\n')
}
