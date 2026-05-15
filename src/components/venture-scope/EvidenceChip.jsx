const SOURCE_COLORS = {
  corpus:   'text-sky-300/80 border-sky-500/30 bg-sky-500/8',
  save:     'text-emerald-300/80 border-emerald-500/30 bg-emerald-500/8',
  document: 'text-violet-300/80 border-violet-500/30 bg-violet-500/8',
  brief:    'text-amber-300/80 border-amber-500/30 bg-amber-500/8',
}

export default function EvidenceChip({ sourceType, label }) {
  const cls = SOURCE_COLORS[sourceType] ?? 'text-white/50 border-white/10 bg-white/5'
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${cls}`}>
      {label ?? sourceType}
    </span>
  )
}
