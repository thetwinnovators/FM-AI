import { Trash2, Pin, PinOff } from 'lucide-react'
import Pill from '../ui/Pill.jsx'

const CATEGORY = {
  topic_rule:     { label: 'Topic Rule',     color: '#6366f1' },
  source_pref:    { label: 'Source Pref',    color: '#14b8a6' },
  research_focus: { label: 'Research Focus', color: '#3b82f6' },
  personal_stack: { label: 'Personal Stack', color: '#d946ef' },
  personal_rule:  { label: 'Personal Rule',  color: '#f59e0b' },
  preference:     { label: 'Preference',     color: '#10b981' },
  behavior:       { label: 'Behavior',       color: '#8b5cf6' },
  personal_fact:  { label: 'Personal Fact',  color: '#ec4899' },
}

const STATUS_TONE = {
  validated: 'positive',
  active:    'accent',
  learning:  'warning',
}

export default function MemoryEntryCard({ entry, onDelete, onPin }) {
  const cat = CATEGORY[entry.category] || { label: entry.category, color: '#94a3b8' }
  const isSeed   = String(entry.id || '').startsWith('mem_seed_')
  const isPinned = entry.isIdentityPinned === true

  return (
    <article
      className={`glass-panel p-4 group flex flex-col gap-3 relative rounded-b-none ${
        isPinned ? 'border-l-2 border-[color:var(--color-topic)]/40' : ''
      }`}
    >
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
        <div className="flex items-center gap-1">
          {onPin && !isSeed ? (
            <button
              onClick={() => onPin(entry.id, !isPinned)}
              title={isPinned ? 'Unpin from identity memory' : 'Pin to identity memory'}
              className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${
                isPinned
                  ? 'text-[color:var(--color-topic)] hover:bg-[color:var(--color-topic)]/10'
                  : 'text-white/40 hover:bg-white/10 hover:text-white/70'
              }`}
            >
              {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          ) : null}
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
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5 overflow-hidden">
        <div
          className="h-full"
          style={{ width: `${Math.round((entry.confidence ?? 1) * 100)}%`, background: cat.color }}
        />
      </div>
    </article>
  )
}
