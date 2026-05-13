import { useState, useRef, useEffect } from 'react'
import { Send, AlertCircle, Square, Terminal } from 'lucide-react'
import { runAgentLoop } from '../../flow-ai/services/agentLoopService.js'
import AgentEventList from './AgentEventList.jsx'
import { localMCPStorage } from '../../mcp/storage/localMCPStorage.js'
import { getProvider } from '../../mcp/services/mcpToolRegistry.js'

// ── Shell passthrough ────────────────────────────────────────────────────────
// Commands typed directly (or prefixed with "run ") bypass the LLM entirely.
const SHELL_BINS = new Set([
  'npm', 'npx', 'node', 'ts-node', 'tsx',
  'python', 'python3', 'pip', 'pip3',
  'git', 'curl', 'wget', 'ls', 'pwd', 'echo', 'cat',
  'tsc', 'yarn', 'pnpm', 'bun',
])

function parseDirectCommand(text) {
  const trimmed = text.trim()
  // "run npm test" → "npm test"
  const runMatch = trimmed.match(/^run\s+(.+)$/i)
  const cmd = runMatch ? runMatch[1].trim() : trimmed
  const [bin, ...args] = cmd.split(/\s+/)
  return SHELL_BINS.has(bin.toLowerCase()) ? { command: bin, args } : null
}

async function execDirect(command, args) {
  const execTool = localMCPStorage.listTools().find((t) => t.toolName === 'system.exec')
  if (!execTool) throw new Error('system.exec tool not found — is the daemon running?')
  const integration = localMCPStorage.getIntegration(execTool.integrationId)
  if (!integration) throw new Error('Local operator integration not found.')
  const provider = getProvider(integration.type)
  if (!provider) throw new Error(`No provider for integration type: ${integration.type}`)
  const result = await provider.executeTool({ integration, tool: execTool, input: { command, args } })
  if (!result.success) throw new Error(result.error ?? 'Command failed')
  return result.output ?? {}
}

export default function AgentChatPanel({ placeholder, onFileRead, onShellExec, fullHeight }) {
  const [input, setInput] = useState('')
  const [turns, setTurns] = useState([])
  const [running, setRunning] = useState(false)
  const ctrlRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  async function handleSend() {
    if (!input.trim() || running) return
    const text = input.trim()
    setInput('')
    setRunning(true)

    const turnId = Date.now()

    // ── Direct shell passthrough — no LLM involved ──────────────────────────
    const directCmd = parseDirectCommand(text)
    if (directCmd) {
      const { command, args } = directCmd
      const cmdStr = [command, ...args].join(' ')
      setTurns((prev) => [...prev, { id: turnId, userMessage: text, steps: [], finalAnswer: null, error: null, shellResult: null }])
      try {
        const out = await execDirect(command, args)
        const stdout = typeof out.stdout === 'string' ? out.stdout : ''
        const stderr = typeof out.stderr === 'string' ? out.stderr : ''
        setTurns((prev) =>
          prev.map((t) => t.id === turnId ? { ...t, shellResult: { command: cmdStr, stdout, stderr } } : t)
        )
        if (onShellExec) onShellExec({ command: cmdStr, stdout, stderr })
      } catch (err) {
        setTurns((prev) =>
          prev.map((t) => t.id === turnId ? { ...t, error: err?.message ?? String(err) } : t)
        )
      } finally {
        setRunning(false)
      }
      return
    }

    // ── Normal AI agent loop ─────────────────────────────────────────────────
    setTurns((prev) => [...prev, { id: turnId, userMessage: text, steps: [], finalAnswer: null, error: null, shellResult: null }])

    ctrlRef.current = new AbortController()

    try {
      const { finalAnswer } = await runAgentLoop(text, {
        ctrl: ctrlRef.current,
        onEvent: (event) => {
          if (event.type === 'file_read' && onFileRead) {
            onFileRead(event.path, event.content)
            return
          }
          if (event.type === 'shell_exec' && onShellExec) {
            onShellExec(event)
            return
          }
          if (event.type === 'awaiting_approval') return
          if (event.type === 'done') return
          setTurns((prev) =>
            prev.map((t) => (t.id === turnId ? { ...t, steps: [...t.steps, event] } : t))
          )
        },
      })
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, finalAnswer } : t))
      )
    } catch (err) {
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, error: err?.message ?? String(err) } : t))
      )
    } finally {
      setRunning(false)
      ctrlRef.current = null
    }
  }

  function handleCancel() {
    ctrlRef.current?.abort()
  }

  const rootClass = fullHeight
    ? 'flex flex-col h-full min-h-0'
    : 'flex flex-col gap-3'

  return (
    <div className={rootClass}>
      {/* Conversation history */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5 min-h-0">
        {turns.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[12px] text-white/20 text-center">{placeholder ?? 'Ask the agent…'}</p>
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-3">
            {/* User message */}
            <div className="self-end max-w-[80%] px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-[13px] text-white/85">
              {turn.userMessage}
            </div>

            {/* Direct shell result */}
            {turn.shellResult && (
              <div className="rounded-xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(0,0,0,0.28)' }}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/[0.06]" style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <Terminal size={10} className="text-emerald-400" />
                  <span className="font-mono text-[11px] text-emerald-400/70">{turn.shellResult.command}</span>
                </div>
                <div className="px-3 py-2 flex flex-col gap-0.5">
                  {turn.shellResult.stdout && (
                    <pre className="font-mono text-[12px] text-white/75 whitespace-pre-wrap">{turn.shellResult.stdout}</pre>
                  )}
                  {turn.shellResult.stderr && (
                    <pre className="font-mono text-[12px] text-amber-300/70 whitespace-pre-wrap">{turn.shellResult.stderr}</pre>
                  )}
                  {!turn.shellResult.stdout && !turn.shellResult.stderr && (
                    <span className="font-mono text-[12px] text-white/30">(no output)</span>
                  )}
                </div>
              </div>
            )}

            {/* Agent events */}
            {turn.steps.length > 0 && <AgentEventList steps={turn.steps} />}

            {/* Final answer */}
            {turn.finalAnswer && (
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-[13px] text-white/85 whitespace-pre-wrap">
                {turn.finalAnswer}
              </div>
            )}

            {/* Error */}
            {turn.error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-[12px]">
                <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                <span>{turn.error}</span>
              </div>
            )}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex gap-2 px-4 py-3 border-t border-white/[0.07] flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={placeholder ?? 'Ask the agent…'}
          className="glass-input flex-1 text-[13px]"
          disabled={running}
        />
        {running ? (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white/70 text-[12px] hover:bg-white/10 transition-colors"
          >
            <Square size={12} /> Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-[13px] hover:bg-indigo-500/30 disabled:opacity-40 transition-colors"
          >
            <Send size={14} />
            Send
          </button>
        )}
      </div>
    </div>
  )
}
