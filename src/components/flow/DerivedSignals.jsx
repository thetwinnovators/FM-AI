import Pill from '../ui/Pill.jsx'

export default function DerivedSignals({ patterns, recentlyReinforced = '—' }) {
  const top = patterns?.coOccurrence?.[0]
  const topAffinity = Object.entries(patterns?.topicAffinity || {}).sort((a, b) => b[1] - a[1])[0]

  const rows = [
    {
      label: 'Strongest co-occurrence',
      value: top ? `${top.a.replace('topic_', '')} + ${top.b.replace('topic_', '')}` : '—',
      tone: 'positive',
    },
    {
      label: 'Top topic affinity',
      value: topAffinity ? topAffinity[0].replace('topic_', '') : '—',
      tone: 'accent',
    },
    {
      label: 'Recently reinforced',
      value: recentlyReinforced,
      tone: 'warning',
    },
  ]

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold">Derived signals</h2>
        <span className="text-[10px] text-[color:var(--color-text-tertiary)]">computed from your behavior</span>
      </div>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-3 py-2 border-t border-[color:var(--color-border-subtle)] first:border-t-0">
            <span className="chip">SIGNAL</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{r.label}</div>
            </div>
            <Pill tone={r.tone}>{r.value}</Pill>
          </li>
        ))}
      </ul>
    </div>
  )
}
