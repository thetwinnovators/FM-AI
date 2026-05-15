// A single labelled horizontal score bar. score = 0–100.
export default function ScoreBar({ label, score, color = 'fuchsia', showValue = true }) {
  const pct = Math.max(0, Math.min(100, score ?? 0))
  const colorMap = {
    fuchsia: 'bg-fuchsia-500/70',
    emerald: 'bg-emerald-500/70',
    amber:   'bg-amber-500/70',
    sky:     'bg-sky-500/70',
    rose:    'bg-rose-500/70',
  }
  const barColor = colorMap[color] ?? colorMap.fuchsia
  return (
    <div className="flex items-center gap-3 w-full">
      {label && (
        <span className="text-[11px] text-[color:var(--color-text-secondary)] w-28 shrink-0 truncate">
          {label}
        </span>
      )}
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
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
