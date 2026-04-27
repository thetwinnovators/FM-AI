const SOURCES = [
  { id: 'youtube', label: 'YouTube',         status: 'connected',  desc: 'Curated seed feed' },
  { id: 'rss',     label: 'RSS readers',     status: 'planned',    desc: 'Anthropic, OpenAI, Simon Willison' },
  { id: 'hn',      label: 'Hacker News',     status: 'planned',    desc: 'AI/agent topical filter' },
]

export default function ConnectedSources() {
  return (
    <div className="glass-panel p-5">
      <h2 className="text-[13px] font-semibold mb-3">Connected sources</h2>
      <ul className="space-y-2">
        {SOURCES.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2 border-t border-[color:var(--color-border-subtle)] first:border-t-0">
            <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
            <span className="chip">SOURCE</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{s.label}</div>
              <div className="text-[11px] text-[color:var(--color-text-tertiary)] truncate">{s.desc}</div>
            </div>
            <span className={`text-[11px] ${s.status === 'connected' ? 'text-emerald-400' : 'text-[color:var(--color-text-tertiary)]'}`}>
              {s.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
