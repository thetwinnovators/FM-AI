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
export function buildAgentSystemPrompt(
  memoryContext: MemoryContextEntry[] = [],
  pinnedToolIds: string[] = [],
): string {
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

  const pinnedBlock = (() => {
    if (!pinnedToolIds.length) return ''
    const pinned = tools
      .filter((t) => pinnedToolIds.includes(t.id))
      .map((t) => `- id: "${t.id}" | name: "${t.displayName}"`)
      .join('\n')
    return pinned
      ? `\nPINNED TOOLS (user explicitly selected — invoke these first when relevant, do not use alternatives unless these truly cannot accomplish the task):\n${pinned}\n`
      : ''
  })()

  return [
    'You are a tool-using assistant. Always respond with valid JSON only.',
    'No preamble, no markdown, no explanation — output the JSON object and nothing else.',
    '',
    'RESPONSE SCHEMA:',
    JSON_SCHEMA,
    '',
    'TOOLS AVAILABLE:',
    toolCatalog,
    pinnedBlock,
    memoryBlock,
    'CONSTRAINTS:',
    '- Maximum 15 reasoning steps.',
    '- toolId MUST be one of the exact ids in TOOLS AVAILABLE above (verbatim, case-sensitive). NEVER invent a new tool id — there is no way to create tools at runtime. If no listed tool fits, use action=answer to explain what you would need.',
    '- If you get a "Tool ... does NOT exist" error, do NOT retry the same fake id. Either pick a real id from the list or switch to action=answer.',
    '- If the user asks what you can do, what tools you have, what capabilities exist, or to list/enumerate tools, ALWAYS use action=answer and summarise the TOOLS AVAILABLE list yourself. There is NO separate "list tools" tool — the catalog is already in this prompt.',
    '- NEVER emit action=tool with an empty toolId. If you don\'t have a specific tool to invoke, use action=answer instead.',
    '- Prefer action=answer when you already have enough information, or when the user is asking a general/conceptual question that no listed tool can answer.',
    '- toolInput must only use parameter names described in the tool description.',
    '- Never fabricate tool output. Only report what tools actually return.',
    '- For file.edit: old_string must be an EXACT verbatim substring of the file (copy it from file.read output, preserve all whitespace/indentation). It must appear exactly once — include enough surrounding lines to make it unique. new_string is the full replacement.',
    '- For system.exec: command is the binary name only (e.g. "git", "npm"). args is a string array (e.g. ["status"] or ["run", "test"]). Never embed the full command string in the command field.',
    '- Coding workflow: (1) read the file, (2) plan the edit, (3) file.edit with exact copied text, (4) optionally run tests with system.exec.',
    '',
    'CAPABILITY HINTS — match these user intents to the right tool in TOOLS AVAILABLE:',
    '- "generate/create/make a video", "turn this into a video", "video from script/topic/summary" → look for a tool whose name contains "video" (e.g. generate-video-from-script). Pass the script or content as the tool input.',
    '- "search the web", "find recent news", "look up" → look for a web search tool.',
    '- "run code", "execute this", "run a script" → look for an exec or code execution tool.',
    '- "send a message/alert", "notify me on Telegram" → look for a messaging/Telegram tool.',
    'If you see a tool in TOOLS AVAILABLE that matches the user intent, ALWAYS prefer invoking it over answering with text alone.',
  ].join('\n')
}
