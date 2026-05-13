// MCP tool access for Flow.AI chat panels.
import { localMCPStorage } from '../../mcp/storage/localMCPStorage.js'
import { getProvider } from '../../mcp/services/mcpToolRegistry.js'

export function getActiveMCPTools() {
  try { return localMCPStorage.listTools() } catch { return [] }
}

export function buildToolSystemBlock(tools) {
  if (!tools || tools.length === 0) return ''
  const list = tools.slice(0, 24)
  return [
    '',
    '## Tools you can use',
    'When you need to fetch data, run a search, or take an action, emit a tool',
    'call using this exact format (one per line):',
    '',
    '  <tool_call>{"name": "tool_name", "args": {"param": "value"}}</tool_call>',
    '',
    'Wait for the result before continuing. Only use names from the list below.',
    '',
    'Available tools:',
    ...list.map((t) => `- **${t.toolName}**: ${t.description ?? 'No description'}`),
  ].join('\n')
}

const TOOL_CALL_RE = /<tool_call>([\s\S]*?)<\/tool_call>/g

export function parseToolCalls(text) {
  const calls = []
  TOOL_CALL_RE.lastIndex = 0
  let m
  while ((m = TOOL_CALL_RE.exec(text)) !== null) {
    try {
      const payload = JSON.parse(m[1].trim())
      if (payload && typeof payload.name === 'string') {
        calls.push({ raw: m[0], name: payload.name, args: payload.args ?? {} })
      }
    } catch {}
  }
  return calls
}

export async function runMCPTool(toolName, args) {
  try {
    const tools = localMCPStorage.listTools()
    const tool = tools.find((t) => t.toolName === toolName)
    if (!tool) return { success: false, error: `Tool "${toolName}" not found` }

    const integration = localMCPStorage.getIntegration(tool.integrationId)
    if (!integration) return { success: false, error: `Integration not found for "${toolName}"` }

    const provider = getProvider(integration.type)
    if (!provider) return { success: false, error: `No provider for type "${integration.type}"` }

    return await provider.executeTool({ integration, tool, input: args })
  } catch (err) {
    return { success: false, error: err?.message ?? String(err) }
  }
}

export async function processToolCalls(responseText) {
  const calls = parseToolCalls(responseText)
  if (calls.length === 0) return { hasToolCalls: false, processedText: responseText, toolResultBlock: '' }

  let processedText = responseText
  const resultLines = ['[Tool results]']

  for (const call of calls) {
    const result = await runMCPTool(call.name, call.args)
    const output = result.success
      ? (typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2))
      : `Error: ${result.error}`

    processedText = processedText.replace(
      call.raw,
      `**[${call.name}]**\n\`\`\`\n${output.slice(0, 4000)}\n\`\`\``,
    )
    resultLines.push(`${call.name}: ${output.slice(0, 2000)}`)
  }

  return { hasToolCalls: true, processedText, toolResultBlock: resultLines.join('\n') }
}
