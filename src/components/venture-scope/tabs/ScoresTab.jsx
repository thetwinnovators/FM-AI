import { useState, useEffect } from 'react'
import DimensionScoreGrid from '../DimensionScoreGrid.jsx'
import ConfidenceBadge from '../ConfidenceBadge.jsx'
import { buildScoreExplanations } from '../../../opportunity-radar/services/opportunityScorer.js'
import { formatClusterName } from '../../../venture-scope/utils/formatClusterName.js'

// ── Entity evidence chips ─────────────────────────────────────────────────────

function EntityRow({ label, items, accentColor }) {
  if (!items?.length) return null
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="text-[10px] text-[color:var(--color-text-tertiary)] shrink-0 pt-0.5 w-20">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 6).map((item) => (
          <span
            key={item}
            className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/8 capitalize"
            style={accentColor ? { borderColor: accentColor } : undefined}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function EntityEvidence({ entitySummary }) {
  if (!entitySummary) return null
  const hasData = (
    entitySummary.personas?.length     ||
    entitySummary.workflows?.length    ||
    entitySummary.workarounds?.length  ||
    entitySummary.technologies?.length ||
    entitySummary.emergingTech?.length ||
    entitySummary.platformShifts?.length
  )
  if (!hasData) return null

  return (
    <div className="mb-4 p-3 rounded-lg bg-white/3 border border-white/6 space-y-2">
      <p className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-2">
        Evidence context
      </p>
      <EntityRow label="Personas"     items={entitySummary.personas}     accentColor="rgba(20,184,166,0.4)" />
      <EntityRow label="Workflows"    items={entitySummary.workflows}    />
      <EntityRow label="Workarounds"  items={entitySummary.workarounds}  accentColor="rgba(217,70,239,0.4)" />
      <EntityRow label="Technologies" items={entitySummary.technologies} />
      {entitySummary.emergingTech?.length    > 0 && (
        <EntityRow label="Emerging tech"  items={entitySummary.emergingTech}   accentColor="rgba(251,191,36,0.4)" />
      )}
      {entitySummary.platformShifts?.length > 0 && (
        <EntityRow label="Mkt shift"   items={entitySummary.platformShifts} accentColor="rgba(251,191,36,0.4)" />
      )}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function ScoresTab({ clusters, onSelectCluster, selectedClusterId }) {
  const sorted = [...(clusters ?? [])].sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))

  // The expanded cluster is the selected one, or the top-ranked cluster by default.
  // This means users immediately see the full dimension breakdown without a click.
  const defaultExpanded = selectedClusterId ?? sorted[0]?.id ?? null
  const [expanded, setExpanded] = useState(defaultExpanded)

  // Keep expanded in sync when selectedClusterId changes from outside (e.g., Overview tab)
  useEffect(() => {
    if (selectedClusterId) setExpanded(selectedClusterId)
  }, [selectedClusterId])

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
            className="glass-panel overflow-hidden transition-all duration-200"
            style={isSelected ? { boxShadow: '0 0 0 1px rgba(217,70,239,0.4)' } : undefined}
          >
            <button
              onClick={() => {
                const next = isExpanded ? null : cluster.id
                setExpanded(next)
                onSelectCluster?.(cluster.id)
              }}
              className="w-full text-left px-5 py-4 flex items-center gap-4"
            >
              <span className="text-[11px] font-mono text-[color:var(--color-text-tertiary)] w-5 shrink-0">
                #{rank + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{formatClusterName(cluster.clusterName)}</div>
                <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">
                  {cluster.signalCount} signals · {cluster.sourceDiversity} source types
                  {cluster.entitySummary?.personas?.length > 0 && (
                    <> · {cluster.entitySummary.personas[0]}</>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {dim?.confidence != null && <ConfidenceBadge confidence={dim.confidence} />}
                <span className="text-lg font-semibold w-10 text-right" style={{ color: 'var(--color-topic)' }}>
                  {cluster.opportunityScore ?? '—'}
                </span>
              </div>
            </button>
            {isExpanded && (
              <div className="px-5 pb-5 border-t border-white/6 pt-4">
                {/* Entity evidence — what this cluster is actually about */}
                <EntityEvidence entitySummary={cluster.entitySummary} />
                {/* Dimension score breakdown with always-visible explanations */}
                {dim && <DimensionScoreGrid dimensionScores={dim} explanations={explanations} drivers={cluster.dimensionDrivers} />}
                {!dim && (
                  <p className="text-xs text-[color:var(--color-text-tertiary)]">
                    Score dimensions not yet computed — re-run a scan.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
