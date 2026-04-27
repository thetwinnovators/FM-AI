import { Compass, Filter, Tags, Brain } from 'lucide-react'

const STAGES = [
  { icon: Compass, color: '#14b8a6', title: 'Discover',  sub: 'Sources · Searches · Triggers' },
  { icon: Filter,  color: '#6366f1', title: 'Parse',     sub: 'Metadata · Transcripts · Entities' },
  { icon: Tags,    color: '#8b5cf6', title: 'Classify',  sub: 'Topics · Concepts · Relations' },
  { icon: Brain,   color: '#10b981', title: 'Retain',    sub: 'Memory · Patterns · Suggestions' },
]

export default function PipelineStrip({ counts = {} }) {
  return (
    <div className="glass-panel overflow-hidden">
      <div className="px-5 py-2.5 border-b border-[color:var(--color-border-subtle)] flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-text-tertiary)]">
          Topic Intelligence Pipeline
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-[color:var(--color-text-tertiary)]">4-stage loop · always running</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[color:var(--color-border-subtle)]">
        {STAGES.map((s, i) => {
          const Icon = s.icon
          const count = counts[s.title.toLowerCase()] ?? 0
          return (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color: s.color }} />
                <p className="text-[13px] font-semibold">{s.title}</p>
              </div>
              <p className="text-[11px] text-[color:var(--color-text-secondary)] leading-relaxed mb-2">
                {s.sub}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" style={{ boxShadow: '0 0 4px rgba(16,185,129,0.7)' }} />
                <span className="text-[11px] text-emerald-400 font-medium">{count} signals active</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
