import OpportunityRankChart from '../OpportunityRankChart.jsx'
import ConfidenceBadge from '../ConfidenceBadge.jsx'

export default function OverviewTab({ clusters, signals, concepts, meta, onSelectCluster, selectedClusterId }) {
  const sorted = [...(clusters ?? [])].sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
  const top3   = sorted.slice(0, 3)

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-[color:var(--color-text-secondary)]">No opportunities scanned yet.</p>
        <p className="text-xs text-[color:var(--color-text-tertiary)] mt-1">
          Run a scan to extract venture intelligence from your research.
        </p>
      </div>
    )
  }

  const top = sorted[0]
  const topConcept = (concepts ?? []).find((c) => c.clusterId === top?.id)
  const totalSignals = meta?.totalSignals ?? (signals ?? []).length ?? 0

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Opportunities', value: sorted.length },
          { label: 'Signals analysed', value: totalSignals },
          { label: 'Top score', value: top?.opportunityScore ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="glass-panel p-4">
            <div className="text-2xl font-semibold">{value}</div>
            <div className="text-[11px] text-[color:var(--color-text-secondary)] mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Leading opportunity */}
      {top && (
        <div className="glass-panel p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-[11px] text-[color:var(--color-text-tertiary)] uppercase tracking-widest mb-1">
                Top opportunity
              </div>
              <h2 className="text-base font-semibold leading-snug">{top.clusterName}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {top.dimensionScores?.confidence != null && (
                <ConfidenceBadge confidence={top.dimensionScores.confidence} />
              )}
              <span className="text-2xl font-semibold text-fuchsia-300/90">
                {top.opportunityScore ?? '—'}
              </span>
            </div>
          </div>
          {topConcept && (
            <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
              {topConcept.opportunitySummary ?? topConcept.tagline}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[color:var(--color-text-tertiary)]">
            <span>{top.signalCount} signals</span>
            <span>·</span>
            <span>{top.sourceDiversity} source types</span>
            {top.entitySummary?.personas?.length ? (
              <>
                <span>·</span>
                <span>{top.entitySummary.personas.slice(0, 2).join(', ')}</span>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Rank chart */}
      <div className="glass-panel p-5">
        <h3 className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-4">
          All opportunities ranked
        </h3>
        <OpportunityRankChart
          opportunities={sorted}
          onSelect={(opp) => onSelectCluster?.(opp.id)}
          selectedId={selectedClusterId}
        />
      </div>
    </div>
  )
}
