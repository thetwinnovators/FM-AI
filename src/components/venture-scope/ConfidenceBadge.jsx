export default function ConfidenceBadge({ confidence }) {
  const pct = Math.round((confidence ?? 0) * 100)
  const cls = pct >= 80
    ? 'text-emerald-300/90 border-emerald-500/30 bg-emerald-500/10'
    : pct >= 55
      ? 'text-amber-300/90 border-amber-500/30 bg-amber-500/10'
      : 'text-rose-300/90 border-rose-500/30 bg-rose-500/10'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cls}`}>
      {pct}% conf
    </span>
  )
}
