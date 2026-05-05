import { useState } from 'react'
import { ChevronDown, ChevronRight, Zap, Loader2, Check, X } from 'lucide-react'
import type { AgentStep, PendingApprovalState } from '../../flow-ai/services/agentLoopService.js'

interface AgentRunTimelineProps {
  steps: AgentStep[]
  pendingApproval: PendingApprovalState | null
  onApprove: () => void
  onDeny: () => void
  isRunning?: boolean
}

export default function AgentRunTimeline({
  steps,
  pendingApproval,
  onApprove,
  onDeny,
  isRunning = false,
}: AgentRunTimelineProps) {
  const [expanded, setExpanded] = useState(false)

  const doneSteps = steps.filter(
    (s): s is Extract<AgentStep, { type: 'step_done' }> => s.type === 'step_done',
  )
  const toolNames = [...new Set(doneSteps.map((s) => s.toolName))]
  const isDone = steps.some((s) => s.type === 'done')
  const pillLabel = toolNames.length ? toolNames.join(' · ') : isRunning ? 'Thinking…' : 'Agent run'
  const trailSteps = steps.filter((s) => s.type !== 'done')

  return (
    <div className="mb-4">
      {/* ── Collapsed pill ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-xs text-white/60 hover:text-white/80 hover:bg-white/[0.07] transition-colors"
        aria-expanded={expanded}
      >
        {isRunning && !isDone ? (
          <Loader2 className="w-3 h-3 text-teal-400 animate-spin flex-shrink-0" />
        ) : (
          <Check className="w-3 h-3 text-teal-400 flex-shrink-0" />
        )}
        <span>{pillLabel}</span>
        {expanded ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0" />
        )}
      </button>

      {/* ── Expanded step trail ─────────────────────────────────────────────── */}
      {expanded && trailSteps.length > 0 ? (
        <div className="mt-2 ml-1 border-l border-white/10 pl-3 space-y-1.5">
          {trailSteps.map((s, i) => (
            <TrailRow key={i} step={s} />
          ))}
        </div>
      ) : null}

      {/* ── Approval card ───────────────────────────────────────────────────── */}
      {pendingApproval ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 max-w-sm">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-xs font-medium text-white/80">Approval needed</span>
          </div>
          <p className="text-sm text-white/70 mb-1">{pendingApproval.toolName}</p>
          <p className="text-xs text-white/40 font-mono break-all mb-3">
            {pendingApproval.inputSummary}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={onDeny}
              className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-white/50 hover:text-white/70 hover:border-white/20 transition-colors"
            >
              Deny
            </button>
            <button
              onClick={onApprove}
              className="px-3 py-1.5 text-xs rounded-lg bg-teal-500/20 border border-teal-500/30 text-teal-300 hover:bg-teal-500/30 transition-colors"
            >
              Allow this once
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TrailRow({ step }: { step: Exclude<AgentStep, { type: 'done' }> }) {
  if (step.type === 'thought') {
    return (
      <p className="text-xs text-white/40 italic leading-relaxed">
        {step.text}
      </p>
    )
  }
  if (step.type === 'tool_selected') {
    return (
      <p className="text-xs text-white/50">
        <span className="text-teal-400/80 mr-1">→</span>
        {step.toolName}
      </p>
    )
  }
  if (step.type === 'step_done') {
    return (
      <p className="text-xs text-white/60">
        <span className="text-teal-400 mr-1">✓</span>
        <span className="font-medium">{step.toolName}:</span>{' '}
        <span className="text-white/40">{step.resultSummary}</span>
      </p>
    )
  }
  if (step.type === 'denied') {
    return (
      <p className="text-xs text-red-400/70 flex items-center gap-1">
        <X className="w-3 h-3 inline flex-shrink-0" />
        {step.toolName} — denied
      </p>
    )
  }
  return null
}
