// A single labelled horizontal score bar. score = 0–100.
// color: 'creator' (teal) | 'topic' (magenta) | 'emerald' | 'amber' | 'sky' | 'rose'
export default function ScoreBar({ label, score, color = 'creator', showValue = true }) {
  const pct = Math.max(0, Math.min(100, score ?? 0))
  const barColor = {
    creator: 'rgba(20,184,166,0.7)',
    topic:   'rgba(217,70,239,0.7)',
    emerald: 'rgba(16,185,129,0.7)',
    amber:   'rgba(245,158,11,0.7)',
    sky:     'rgba(14,165,233,0.7)',
    rose:    'rgba(244,63,94,0.7)',
  }[color] ?? 'rgba(20,184,166,0.7)'

  return (
    <div className="flex items-center gap-3 w-full">
      {label && (
        <span className="text-[11px] text-[color:var(--color-text-secondary)] w-28 shrink-0 truncate">
          {label}
        </span>
      )}
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      {showValue && (
        <span className="text-[11px] font-mono text-[color:var(--color-text-tertiary)] w-7 text-right shrink-0">
          {pct}
        </span>
      )}
    </div>
  )
}
