import { useState, useRef, useEffect } from 'react'
import { Send, AlertCircle, Square, Terminal, Hash, X } from 'lucide-react'
import { runAgentLoop } from '../../flow-ai/services/agentLoopService.js'
import AgentEventList from './AgentEventList.jsx'
import ToolMentionPicker from '../chat/ToolMentionPicker.jsx'
import { localMCPStorage } from '../../mcp/storage/localMCPStorage.js'
import { getProvider } from '../../mcp/services/mcpToolRegistry.js'

// ── Shell passthrough ────────────────────────────────────────────────────────
const SHELL_BINS = new Set([
  'npm', 'npx', 'node', 'ts-node', 'tsx',
  'python', 'python3', 'pip', 'pip3',
  'git', 'curl', 'wget', 'ls', 'pwd', 'echo', 'cat',
  'tsc', 'yarn', 'pnpm', 'bun',
])

function parseDirectCommand(text) {
  const trimmed = text.trim()
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

// ── Main panel ───────────────────────────────────────────────────────────────

export default function AgentChatPanel({ placeholder, onFileRead, onShellExec, fullHeight }) {
  const [input,       setInput]       = useState('')
  const [turns,       setTurns]       = useState([])
  const [running,     setRunning]     = useState(false)
  const [allTools,    setAllTools]    = useState([])
  const [toolQuery,   setToolQuery]   = useState('')
  const [pickerOpen,  setPickerOpen]  = useState(false)
  const [pickerIdx,   setPickerIdx]   = useState(0)
  const [pinnedTools, setPinnedTools] = useState([])

  const ctrlRef   = useRef(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  // Load tool catalog once on mount (and whenever menu re-opens)
  useEffect(() => {
    setAllTools(localMCPStorage.listTools())
  }, [])

  // ── Picker logic ────────────────────────────────────────────────────────────

  function handleInputChange(e) {
    const val = e.target.value
    setInput(val)
    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match  = before.match(/#(\w*)$/)
    if (match) {
      setToolQuery(match[1].toLowerCase())
      setPickerOpen(true)
      setPickerIdx(0)
    } else {
      setPickerOpen(false)
      setToolQuery('')
    }
  }

  function selectTool(tool) {
    const el     = inputRef.current
    const cursor = el?.selectionStart ?? input.length
    const before = input.slice(0, cursor)
    const after  = input.slice(cursor)
    // Remove the #query fragment and replace with nothing (chip replaces it)
    setInput(before.replace(/#\w*$/, '') + after)
    setPinnedTools((prev) => prev.find((t) => t.id === tool.id) ? prev : [...prev, tool])
    setPickerOpen(false)
    setToolQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function removePinnedTool(toolId) {
    setPinnedTools((prev) => prev.filter((t) => t.id !== toolId))
  }

  function handleKeyDown(e) {
    if (pickerOpen) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setPickerIdx((i) => i + 1); return }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setPickerIdx((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter')      {
        // Let the picker component's onSelect fire via the filtered list
        // We need to find the right tool here
        const q = toolQuery.toLowerCase()
        const filtered = allTools
          .filter((t) => !q || t.toolName.toLowerCase().includes(q) || t.displayName.toLowerCase().includes(q))
          .slice(0, 9)
        const tool = filtered[pickerIdx]
        if (tool) { e.preventDefault(); selectTool(tool); return }
      }
      if (e.key === 'Escape')     { e.preventDefault(); setPickerOpen(false); return }
    }
    if (e.key === 'Enter' && !pickerOpen) handleSend()
  }

  // ── Send ─────────────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!input.trim() || running) return
    const text       = input.trim()
    const pinnedIds  = pinnedTools.map((t) => t.id)
    setInput('')
    setPickerOpen(false)
    setRunning(true)

    const turnId = Date.now()

    // ── Direct shell passthrough ───────────────────────────────────────────
    const directCmd = parseDirectCommand(text)
    if (directCmd) {
      const { command, args } = directCmd
      const cmdStr = [command, ...args].join(' ')
      setTurns((prev) => [...prev, { id: turnId, userMessage: text, pinnedTools: [...pinnedTools], steps: [], finalAnswer: null, error: null, shellResult: null }])
      try {
        const out    = await execDirect(command, args)
        const stdout = typeof out.stdout === 'string' ? out.stdout : ''
        const stderr = typeof out.stderr === 'string' ? out.stderr : ''
        setTurns((prev) => prev.map((t) => t.id === turnId ? { ...t, shellResult: { command: cmdStr, stdout, stderr } } : t))
        if (onShellExec) onShellExec({ command: cmdStr, stdout, stderr })
      } catch (err) {
        setTurns((prev) => prev.map((t) => t.id === turnId ? { ...t, error: err?.message ?? String(err) } : t))
      } finally {
        setRunning(false)
      }
      return
    }

    // ── Normal AI agent loop ───────────────────────────────────────────────
    setTurns((prev) => [...prev, { id: turnId, userMessage: text, pinnedTools: [...pinnedTools], steps: [], finalAnswer: null, error: null, shellResult: null }])
    ctrlRef.current = new AbortController()

    try {
      const { finalAnswer } = await runAgentLoop(text, {
        ctrl:         ctrlRef.current,
        pinnedToolIds: pinnedIds,
        onEvent: (event) => {
          if (event.type === 'file_read'   && onFileRead)  { onFileRead(event.path, event.content); return }
          if (event.type === 'shell_exec'  && onShellExec) { onShellExec(event); return }
          if (event.type === 'awaiting_approval') return
          if (event.type === 'done') return
          setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, steps: [...t.steps, event] } : t)))
        },
      })
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, finalAnswer } : t)))
    } catch (err) {
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, error: err?.message ?? String(err) } : t)))
    } finally {
      setRunning(false)
      ctrlRef.current = null
    }
  }

  function handleCancel() { ctrlRef.current?.abort() }

  const rootClass = fullHeight ? 'flex flex-col h-full min-h-0' : 'flex flex-col gap-3'

  return (
    <div className={rootClass}>
      {/* Conversation history */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5 min-h-0">
        {turns.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[12px] text-white/20">{placeholder ?? 'Ask the agent…'}</p>
              <p className="text-[11px] text-white/12 mt-1">
                Type <span className="font-mono text-indigo-400/50">#</span> to pin a specific tool
              </p>
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-3">
            {/* User message + pinned tool chips */}
            <div className="self-end flex flex-col items-end gap-1.5 max-w-[80%]">
              {turn.pinnedTools?.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-end">
                  {turn.pinnedTools.map((t) => (
                    <span
                      key={t.id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-[10px] text-indigo-300/80"
                    >
                      <Hash size={8} />
                      {t.toolName}
                    </span>
                  ))}
                </div>
              )}
              <div className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-[13px] text-white/85">
                {turn.userMessage}
              </div>
            </div>

            {/* Direct shell result */}
            {turn.shellResult && (
              <div className="rounded-xl border border-white/[0.07] overflow-hidden" style={{ background: 'rgba(0,0,0,0.28)' }}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/[0.06]" style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <Terminal size={10} className="text-emerald-400" />
                  <span className="font-mono text-[11px] text-emerald-400/70">{turn.shellResult.command}</span>
                </div>
                <div className="px-3 py-2 flex flex-col gap-0.5">
                  {turn.shellResult.stdout && <pre className="font-mono text-[12px] text-white/75 whitespace-pre-wrap">{turn.shellResult.stdout}</pre>}
                  {turn.shellResult.stderr && <pre className="font-mono text-[12px] text-amber-300/70 whitespace-pre-wrap">{turn.shellResult.stderr}</pre>}
                  {!turn.shellResult.stdout && !turn.shellResult.stderr && <span className="font-mono text-[12px] text-white/30">(no output)</span>}
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
      <div className="border-t border-white/[0.07] flex-shrink-0 relative">

        {/* Picker dropdown — floats above the input bar */}
        {pickerOpen && (
          <ToolMentionPicker
            tools={allTools}
            query={toolQuery}
            activeIdx={pickerIdx}
            onSelect={selectTool}
          />
        )}

        {/* Pinned tool chips */}
        {pinnedTools.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pt-2.5">
            {pinnedTools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-[11px] text-indigo-300"
              >
                <Hash size={9} className="flex-shrink-0" />
                <span className="font-medium">{tool.toolName}</span>
                <button
                  onClick={() => removePinnedTool(tool.id)}
                  className="ml-0.5 text-indigo-300/50 hover:text-indigo-200 transition-colors"
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 px-4 py-3">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              pinnedTools.length
                ? `Message with ${pinnedTools.map((t) => '#' + t.toolName).join(', ')} pinned…`
                : (placeholder ?? 'Ask the agent… type # to pin a tool')
            }
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
    </div>
  )
}
