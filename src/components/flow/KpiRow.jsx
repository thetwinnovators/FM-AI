function SparkArc({ pct, color = '#d946ef' }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75
  const filled = arc * Math.min(1, Math.max(0, pct))
  const gid = `sa-${color.replace('#', '')}`
  return (
    <svg width="44" height="44" viewBox="0 0 44 44"
      className="absolute -bottom-2 -right-2 pointer-events-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
      </defs>
      <circle cx="22" cy="22" r={r} fill="none"
        stroke={color} strokeOpacity="0.12"
        strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${arc} ${circ}`}
        transform="rotate(135 22 22)"
      />
      <circle cx="22" cy="22" r={r} fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform="rotate(135 22 22)"
      />
    </svg>
  )
}

export default function KpiRow({ items }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => it.onClick?.()}
          disabled={!it.onClick}
          className={`glass-panel px-4 py-3.5 text-left relative overflow-hidden ${it.onClick ? 'hover:brightness-125 transition-all' : ''}`}
        >
          {it.spark != null ? <SparkArc pct={it.spark} color={it.color} /> : null}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-[color:var(--color-text-tertiary)]">{it.label}</span>
            {it.live ? <span className="text-[9px] uppercase tracking-wide text-emerald-400 font-medium">live</span> : null}
          </div>
          <div className="text-[22px] font-bold tracking-tight">{it.value}</div>
          {it.sub ? <p className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">{it.sub}</p> : null}
        </button>
      ))}
    </div>
  )
}
