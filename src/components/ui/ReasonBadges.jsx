import { deriveReasons } from '../../lib/search/reasons.js'

const TONES = {
  topic:      { text: 'text-fuchsia-300', bg: 'bg-fuchsia-500/15' },
  tutorial:   { text: 'text-violet-300',  bg: 'bg-violet-500/15' },
  reference:  { text: 'text-slate-300',   bg: 'bg-slate-500/15' },
  fresh:      { text: 'text-cyan-300',    bg: 'bg-cyan-500/15' },
  discussion: { text: 'text-blue-300',    bg: 'bg-blue-500/15' },
}

export default function ReasonBadges({ item, className = '' }) {
  const reasons = deriveReasons(item)
  if (!reasons.length) return null
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {reasons.map((r) => {
        const tone = TONES[r.tone] || TONES.reference
        return (
          <span
            key={r.id}
            className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${tone.text} ${tone.bg}`}
          >
            {r.label}
          </span>
        )
      })}
    </div>
  )
}
