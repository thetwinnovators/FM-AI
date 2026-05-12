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
    '- toolId MUST be one of the exact ids in TOOLS AVAILABLE above (verbatim, case-sensitive). NEVER invent a new tool id — there is no way to create tools at runtime. If no listed tool fits, use action=answer to explain what you would need.',
    '- If you get a "Tool ... does NOT exist" error, do NOT retry the same fake id. Either pick a real id from the list or switch to action=answer.',
    '- If the user asks what you can do, what tools you have, what capabilities exist, or to list/enumerate tools, ALWAYS use action=answer and summarise the TOOLS AVAILABLE list yourself. There is NO separate "list tools" tool — the catalog is already in this prompt.',
    '- NEVER emit action=tool with an empty toolId. If you don\'t have a specific tool to invoke, use action=answer instead.',
    '- Prefer action=answer when you already have enough information, or when the user is asking a general/conceptual question that no listed tool can answer.',
    '- toolInput must only use parameter names described in the tool description.',
    '- Never fabricate tool output. Only report what tools actually return.',
  ].join('\n')
}
