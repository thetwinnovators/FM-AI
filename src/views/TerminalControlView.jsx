import { useState, useRef, useEffect } from 'react'
import { Terminal, Play, Loader } from 'lucide-react'
import { localMCPStorage } from '../mcp/storage/localMCPStorage.js'
import { getProvider } from '../mcp/services/mcpToolRegistry.js'

function HistoryLine({ entry }) {
  if (entry.type === 'input') {
    return <div className="font-mono text-[12px] text-white/85">{entry.text}</div>
  }
  if (entry.type === 'stderr') {
    return <div className="font-mono text-[12px] text-red-300/85 whitespace-pre-wrap">{entry.text}</div>
  }
  if (entry.type === 'error') {
    return <div className="font-mono text-[12px] text-red-300/85">! {entry.text}</div>
  }
  return <div className="font-mono text-[12px] text-white/70 whitespace-pre-wrap">{entry.text}</div>
}

export default function TerminalControlView() {
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState([])
  const [running, setRunning] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  async function handleRun() {
    if (!command.trim() || running) return
    const cmd = command.trim()
    setCommand('')
    setRunning(true)
    setHistory((h) => [...h, { type: 'input', text: `$ ${cmd}` }])

    try {
      const tools = localMCPStorage.listTools()
      const execTool = tools.find((t) => t.toolName === 'system.exec')
      if (!execTool) {
        setHistory((h) => [...h, { type: 'error', text: 'system.exec tool unavailable. Is the daemon running?' }])
        return
      }

      const integration = localMCPStorage.getIntegration(execTool.integrationId)
      if (!integration) {
        setHistory((h) => [...h, { type: 'error', text: 'Local integration not found.' }])
        return
      }

      const provider = getProvider(integration.type)
      if (!provider) {
        setHistory((h) => [...h, { type: 'error', text: 'No provider for integration type: ' + integration.type }])
        return
      }

      const [bin, ...args] = cmd.split(/\s+/)
      const result = await provider.executeTool({
        integration,
        tool: execTool,
        input: { command: bin, args },
      })

      if (result.success) {
        const out = result.output ?? {}
        if (out.stdout) {
          setHistory((h) => [...h, { type: 'stdout', text: String(out.stdout) }])
        }
        if (out.stderr) {
          setHistory((h) => [...h, { type: 'stderr', text: String(out.stderr) }])
        }
        if (!out.stdout && !out.stderr) {
          setHistory((h) => [...h, { type: 'stdout', text: '(no output)' }])
        }
      } else {
        setHistory((h) => [...h, { type: 'error', text: result.error ?? 'unknown error' }])
      }
    } catch (err) {
      setHistory((h) => [...h, { type: 'error', text: err?.message ?? String(err) }])
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl flex flex-col gap-4">
      <div className="flex items-center gap-3 mb-1">
        <Terminal size={18} className="text-emerald-300" />
        <h1 className="text-xl font-semibold tracking-tight">Terminal Control</h1>
      </div>
      <p className="text-[13px] text-white/45">
        Run allowlisted commands via the operator daemon. Output is captured to the panel below — commands run in the daemon workspace.
      </p>

      <div className="rounded-xl border border-white/8 overflow-hidden flex flex-col min-h-[320px] max-h-[540px]">
        <div className="flex-1 overflow-auto p-4 flex flex-col gap-1 bg-black/30">
          {history.length === 0 && (
            <div className="text-[12px] text-white/25 font-mono">Ready. Allowlist: python, python3, node, npm, git, curl.</div>
          )}
          {history.map((entry, i) => (
            <HistoryLine key={i} entry={entry} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center gap-2 px-3 py-2 border-t border-white/8 bg-white/3">
          <span className="text-emerald-300 font-mono text-[13px]">$</span>
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            placeholder="git status, node --version, npm list…"
            className="flex-1 bg-transparent outline-none text-[13px] font-mono text-white/85 placeholder:text-white/25"
            autoFocus
          />
          <button
            onClick={handleRun}
            disabled={running || !command.trim()}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-200 text-[12px] hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
          >
            {running ? <Loader size={12} className="animate-spin" /> : <Play size={12} />}
            <span>Run</span>
          </button>
        </div>
      </div>
    </div>
  )
}
