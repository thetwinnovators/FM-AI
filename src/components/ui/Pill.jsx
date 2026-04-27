export default function Pill({ tone = 'neutral', children }) {
  const tones = {
    neutral:  'bg-white/5 text-white/70 border-white/10',
    positive: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warning:  'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    danger:   'bg-pink-500/15 text-pink-300 border-pink-500/30',
    accent:   'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${tones[tone]}`}>
      {children}
    </span>
  )
}
