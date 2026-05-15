import { useState } from 'react'
import DimensionScoreGrid from '../DimensionScoreGrid.jsx'
import ConfidenceBadge from '../ConfidenceBadge.jsx'
import { buildScoreExplanations } from '../../../opportunity-radar/services/opportunityScorer.js'

export default function ScoresTab({ clusters, onSelectCluster, selectedClusterId }) {
  const [expanded, setExpanded] = useState(null)

  const sorted = [...(clusters ?? [])].sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-[color:var(--color-text-secondary)]">No scored opportunities.</p>
        <p className="text-xs text-[color:var(--color-text-tertiary)] mt-1">Run a scan first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-4xl">
      {sorted.map((cluster, rank) => {
        const isExpanded = expanded === cluster.id
        const dim = cluster.dimensionScores
        const explanations = dim ? buildScoreExplanations(dim, cluster.signalCount) : []
        const isSelected = selectedClusterId === cluster.id
        return (
          <div
            key={cluster.id}
            className={`glass-panel overflow-hidden transition-all duration-200 ${
              isSelected ? 'ring-1 ring-fuchsia-500/40' : ''
            }`}
          >
            <button
              onClick={() => {
                setExpanded(isExpanded ? null : cluster.id)
                onSelectCluster?.(cluster.id)
              }}
              className="w-full text-left px-5 py-4 flex items-center gap-4"
            >
              <span className="text-[11px] font-mono text-[color:var(--color-text-tertiary)] w-5 shrink-0">
                #{rank + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{cluster.clusterName}</div>
                <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">
                  {cluster.signalCount} signals · {cluster.sourceDiversity} source types
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {dim?.confidence != null && <ConfidenceBadge confidence={dim.confidence} />}
                <span className="text-lg font-semibold text-fuchsia-300/90 w-10 text-right">
                  {cluster.opportunityScore ?? '—'}
                </span>
              </div>
            </button>
            {isExpanded && dim && (
              <div className="px-5 pb-5 border-t border-white/6 pt-4">
                <DimensionScoreGrid dimensionScores={dim} explanations={explanations} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
