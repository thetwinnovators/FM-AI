import { useState, useRef } from 'react'
import { Send, AlertCircle, Square } from 'lucide-react'
import { runAgentLoop } from '../../flow-ai/services/agentLoopService.js'
import AgentEventList from './AgentEventList.jsx'

export default function AgentChatPanel({ placeholder, onFileRead }) {
  const [input, setInput] = useState('')
  const [steps, setSteps] = useState([])
  const [finalAnswer, setFinalAnswer] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const ctrlRef = useRef(null)

  async function handleSend() {
    if (!input.trim() || running) return
    const text = input.trim()
    setInput('')
    setSteps([])
    setFinalAnswer('')
    setError(null)
    setRunning(true)
    ctrlRef.current = new AbortController()

    try {
      const { finalAnswer: answer } = await runAgentLoop(text, {
        ctrl: ctrlRef.current,
        onEvent: (event) => {
          // file.read full-content event is emitted in Task 9 — pipe to viewer.
          if (event.type === 'file_read' && onFileRead) {
            onFileRead(event.path, event.content)
            return
          }
          // Ignore awaiting_approval — the global ApprovalDialog handles it.
          if (event.type === 'awaiting_approval') return
          // Don't append the terminal 'done' event to the timeline (finalAnswer
          // gets its own emerald panel).
          if (event.type === 'done') return
          setSteps((prev) => [...prev, event])
        },
      })
      setFinalAnswer(answer)
    } catch (err) {
      setError(err?.message ?? String(err))
    } finally {
      setRunning(false)
      ctrlRef.current = null
    }
  }

  function handleCancel() {
    if (ctrlRef.current) {
      ctrlRef.current.abort()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <AgentEventList steps={steps} />

      {finalAnswer && (
        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-[13px] text-white/85 whitespace-pre-wrap">
          {finalAnswer}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-[12px]">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
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
