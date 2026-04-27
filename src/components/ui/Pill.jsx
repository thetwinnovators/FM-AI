export default function Pill({ tone = 'neutral', children }) {
  const tones = {
    neutral:  'bg-white/5 text-white/70 border-white/10',
    positive: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warning:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
    danger:   'bg-rose-500/15 text-rose-300 border-rose-500/30',
    accent:   'bg-orange-500/15 text-orange-300 border-orange-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${tones[tone]}`}>
      {children}
    </span>
  )
}
