import { formatClusterName } from '../../venture-scope/utils/formatClusterName.js'

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
              isSelected ? '' : 'hover:bg-white/4'
            }`}
            style={isSelected
              ? { background: 'rgba(217,70,239,0.08)', border: '1px solid rgba(217,70,239,0.28)' }
              : { border: '1px solid transparent' }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium truncate pr-4">{formatClusterName(opp.clusterName) || opp.title}</span>
              <span className="text-[11px] font-mono text-[color:var(--color-text-tertiary)] shrink-0">
                {opp.opportunityScore ?? 0}
              </span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: 'rgba(20,184,166,0.6)' }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}
