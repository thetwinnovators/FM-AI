import { Trash2 } from 'lucide-react'
import Pill from '../ui/Pill.jsx'

const CATEGORY = {
  topic_rule:     { label: 'Topic Rule',     color: '#f59e0b' },
  source_pref:    { label: 'Source Pref',    color: '#14b8a6' },
  research_focus: { label: 'Research Focus', color: '#3b82f6' },
  personal_stack: { label: 'Personal Stack', color: '#f97316' },
}

const STATUS_TONE = {
  validated: 'positive',
  active:    'accent',
  learning:  'warning',
}

export default function MemoryEntryCard({ entry, onDelete }) {
  const cat = CATEGORY[entry.category] || { label: entry.category, color: '#94a3b8' }
  return (
    <article className="glass-panel p-4 group flex flex-col gap-3 relative">
      <div className="flex items-center justify-between">
        <span
          className="px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wide font-medium border"
          style={{ borderColor: `${cat.color}66`, background: `${cat.color}1a`, color: cat.color }}
        >
          {cat.label}
        </span>
        <Pill tone={STATUS_TONE[entry.status] || 'neutral'}>{entry.status}</Pill>
      </div>

      <p className="text-sm leading-relaxed">{entry.content}</p>

      <div className="mt-auto pt-2 border-t border-[color:var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
        <span>Confidence: {Math.round((entry.confidence ?? 1) * 100)}% · Added {entry.addedAt}</span>
        {onDelete ? (
          <button
            onClick={() => onDelete(entry.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-300"
            aria-label="Delete"
          >
            <Trash2 size={13} />
          </button>
        ) : null}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5 rounded-b-2xl overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${Math.round((entry.confidence ?? 1) * 100)}%`, background: cat.color }}
        />
      </div>
    </article>
  )
}
