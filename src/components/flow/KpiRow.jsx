export default function KpiRow({ items }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {items.map((it) => (
        <button
          key={it.label}
          onClick={() => it.onClick?.()}
          disabled={!it.onClick}
          className={`glass-panel px-4 py-3.5 text-left ${it.onClick ? 'hover:brightness-125 transition-all' : ''}`}
        >
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
