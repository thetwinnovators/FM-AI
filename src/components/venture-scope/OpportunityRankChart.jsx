// Horizontal bar chart ranking multiple opportunities by composite score.
export default function OpportunityRankChart({ opportunities, onSelect, selectedId }) {
  if (!opportunities?.length) return null
  const max = Math.max(...opportunities.map((o) => o.opportunityScore ?? 0), 1)
  return (
    <div className="space-y-2">
      {opportunities.map((opp) => {
        const pct = Math.round(((opp.opportunityScore ?? 0) / max) * 100)
        const isSelected = opp.id === selectedId
        return (
          <button
            key={opp.id}
            onClick={() => onSelect?.(opp)}
            className={`w-full text-left group transition-colors rounded-lg px-3 py-2 ${
              isSelected
                ? 'bg-fuchsia-500/10 border border-fuchsia-500/30'
                : 'hover:bg-white/4 border border-transparent'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium truncate pr-4">{opp.clusterName ?? opp.title}</span>
              <span className="text-[11px] font-mono text-[color:var(--color-text-tertiary)] shrink-0">
                {opp.opportunityScore ?? 0}
              </span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-fuchsia-500/60 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}
