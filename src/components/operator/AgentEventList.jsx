import { Brain, Wrench, Check, X } from 'lucide-react'

function StepLine({ icon: Icon, label, text, tone = 'default' }) {
  const colorMap = {
    default: 'text-white/70',
    thought: 'text-white/60',
    tool: 'text-indigo-200',
    done: 'text-emerald-200',
    denied: 'text-red-200',
  }
  const color = colorMap[tone] ?? colorMap.default
  return (
    <div className="flex items-start gap-2.5 text-[12px] leading-relaxed">
      <Icon size={12} className={`mt-0.5 flex-shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] uppercase tracking-widest text-white/35 mr-2">{label}</span>
        <span className={`${color} whitespace-pre-wrap break-words`}>{text}</span>
      </div>
    </div>
  )
}

export default function AgentEventList({ steps }) {
  if (!steps?.length) return null
  return (
    <div className="flex flex-col gap-2 py-3 px-4 rounded-xl border border-white/8 bg-white/2">
      {steps.map((s, i) => {
        if (s.type === 'thought')
          return <StepLine key={i} icon={Brain} label="Thinking" text={s.text} tone="thought" />
        if (s.type === 'tool_selected')
          return <StepLine key={i} icon={Wrench} label="Using" text={s.toolName} tone="tool" />
        if (s.type === 'step_done')
          return <StepLine key={i} icon={Check} label={s.toolName} text={s.resultSummary} tone="done" />
        if (s.type === 'denied')
          return <StepLine key={i} icon={X} label="Denied" text={s.toolName} tone="denied" />
        return null
      })}
    </div>
  )
}
