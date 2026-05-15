import ConfidenceBadge from '../ConfidenceBadge.jsx'

// ── Opportunity card (top 3) ──────────────────────────────────────────────────

function OpportunityCard({
  cluster, rank, pct, concept, hasGenerated,
  isSelected, isGenerating, canGenerate,
  onSelect, onGenerate, onViewBrief,
}) {
  return (
    <div
      className={[
        'glass-panel overflow-hidden flex flex-col transition-all duration-200',
        isSelected ? 'ring-1 ring-[color:var(--color-topic)]/40' : '',
      ].join(' ')}
    >
      {/* Card body — click to open Scores detail */}
      <button
        type="button"
        onClick={onSelect}
        className="p-4 flex-1 text-left group hover:bg-white/[0.03] transition-colors"
      >
        {/* Rank + score */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-[10px] font-mono text-[color:var(--color-text-tertiary)]">
            #{rank}
          </span>
          <span className="text-2xl font-bold leading-none" style={{ color: 'var(--color-topic)' }}>
            {cluster.opportunityScore ?? '—'}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-[13px] font-semibold leading-snug mb-3 group-hover:text-white transition-colors">
          {cluster.clusterName}
        </h3>

        {/* Score bar (relative to max) */}
        <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: 'rgba(20,184,166,0.55)' }}
          />
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
            {cluster.signalCount ?? 0} signals
          </span>
          {cluster.sourceDiversity > 0 && (
            <>
              <span className="text-[color:var(--color-border-subtle)]">·</span>
              <span className="text-[11px] text-[color:var(--color-text-tertiary)]">
                {cluster.sourceDiversity} source{cluster.sourceDiversity !== 1 ? 's' : ''}
              </span>
            </>
          )}
          {cluster.dimensionScores?.confidence != null && (
            <ConfidenceBadge confidence={cluster.dimensionScores.confidence} />
          )}
        </div>

        {/* Concept preview — only when generated */}
        {concept && (concept.tagline || concept.opportunitySummary) && (
          <p className="mt-3 text-[11px] text-[color:var(--color-text-secondary)] leading-relaxed line-clamp-2">
            {concept.tagline ?? (concept.opportunitySummary ?? '').slice(0, 90) + '…'}
          </p>
        )}
      </button>

      {/* Action footer */}
      <div className="px-4 py-3 border-t border-white/6 shrink-0">
        {hasGenerated ? (
          <button
            type="button"
            onClick={onViewBrief}
            className="text-[11px] font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
            style={{ color: 'var(--color-creator)' }}
          >
            View concept brief →
          </button>
        ) : (
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating || !canGenerate}
            className="text-[11px] font-medium px-3 py-1.5 rounded-md border transition-colors
              bg-white/5 border-white/10
              hover:bg-white/10 hover:border-white/16
              text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating…' : 'Generate venture concept'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Compact row (rank 4+) ─────────────────────────────────────────────────────

function CompactRow({
  cluster, rank, pct, hasGenerated,
  isSelected, isGenerating, canGenerate,
  onSelect, onGenerate, onViewBrief,
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-3 transition-colors',
        isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.025]',
      ].join(' ')}
    >
      {/* Rank */}
      <span className="text-[10px] font-mono text-[color:var(--color-text-tertiary)] w-6 shrink-0 text-right">
        #{rank}
      </span>

      {/* Name + bar */}
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left group"
      >
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-[12px] font-medium truncate group-hover:text-white transition-colors">
            {cluster.clusterName}
          </span>
          <span className="text-[11px] font-mono text-[color:var(--color-text-tertiary)] shrink-0">
            {cluster.opportunityScore ?? '—'}
          </span>
        </div>
        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, backgroundColor: 'rgba(20,184,166,0.4)' }}
          />
        </div>
      </button>

      {/* CTA */}
      <div className="shrink-0">
        {hasGenerated ? (
          <button
            type="button"
            onClick={onViewBrief}
            className="text-[11px] font-medium transition-opacity hover:opacity-75"
            style={{ color: 'var(--color-creator)' }}
          >
            Brief →
          </button>
        ) : (
          <button
            type="button"
            onClick={onGenerate}
            disabled={isGenerating || !canGenerate}
            className="text-[11px] px-2.5 py-1 rounded-md border transition-colors
              bg-white/5 border-white/8
              hover:bg-white/10 hover:border-white/14
              text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)]
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGenerating ? '…' : 'Generate'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function OverviewTab({
  clusters,
  signals,
  concepts,
  meta,
  entityGraph,
  onSelectCluster,
  onNavigateToTab,
  onGenerateConcept,
  isGenerating,
  selectedClusterId,
}) {
  const sorted = [...(clusters ?? [])].sort(
    (a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0),
  )
  const maxScore = Math.max(...sorted.map((c) => c.opportunityScore ?? 0), 1)

  // Concept lookup helpers
  const hasConcept = (clusterId) =>
    (concepts ?? []).some((c) => c.clusterId === clusterId)

  const getTopConcept = (clusterId) =>
    (concepts ?? [])
      .filter((c) => c.clusterId === clusterId)
      .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))[0] ?? null

  const totalSignals = meta?.totalSignals ?? (signals ?? []).length
  const totalConcepts = (concepts ?? []).length
  // Generation is only possible once we have an entity graph from a scan
  const canGenerate = Boolean(entityGraph)

  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  if (!sorted.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          No opportunities scanned yet.
        </p>
        <p className="text-xs text-[color:var(--color-text-tertiary)] mt-1">
          Run a scan to extract venture intelligence from your research.
        </p>
      </div>
    )
  }

  // Shared card action handlers
  const handleSelect = (clusterId) => {
    onSelectCluster?.(clusterId)
    onNavigateToTab?.('Scores')
  }
  const handleViewBrief = (clusterId) => {
    onSelectCluster?.(clusterId)
    onNavigateToTab?.('Brief')
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Inline stats strip ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 text-[11px] text-[color:var(--color-text-tertiary)] flex-wrap">
        <span>
          <strong className="text-[color:var(--color-text-secondary)] font-semibold">
            {sorted.length}
          </strong>{' '}
          opportunit{sorted.length === 1 ? 'y' : 'ies'}
        </span>
        <span className="opacity-30">·</span>
        <span>
          <strong className="text-[color:var(--color-text-secondary)] font-semibold">
            {totalSignals}
          </strong>{' '}
          signals analysed
        </span>
        <span className="opacity-30">·</span>
        <span>
          <strong className="text-[color:var(--color-text-secondary)] font-semibold">
            {totalConcepts}
          </strong>{' '}
          concept{totalConcepts === 1 ? '' : 's'} generated
        </span>
      </div>

      {/* ── Top 3 opportunities ────────────────────────────────────────────── */}
      {top3.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-3">
            Top Opportunities
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {top3.map((cluster, i) => {
              const pct = Math.round(((cluster.opportunityScore ?? 0) / maxScore) * 100)
              return (
                <OpportunityCard
                  key={cluster.id}
                  cluster={cluster}
                  rank={i + 1}
                  pct={pct}
                  concept={getTopConcept(cluster.id)}
                  hasGenerated={hasConcept(cluster.id)}
                  isSelected={selectedClusterId === cluster.id}
                  isGenerating={isGenerating}
                  canGenerate={canGenerate}
                  onSelect={() => handleSelect(cluster.id)}
                  onGenerate={() => onGenerateConcept?.(cluster.id)}
                  onViewBrief={() => handleViewBrief(cluster.id)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Remaining opportunities ────────────────────────────────────────── */}
      {rest.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-3">
            More Opportunities
          </p>
          <div className="glass-panel overflow-hidden divide-y divide-white/5">
            {rest.map((cluster, i) => {
              const pct = Math.round(((cluster.opportunityScore ?? 0) / maxScore) * 100)
              return (
                <CompactRow
                  key={cluster.id}
                  cluster={cluster}
                  rank={i + 4}
                  pct={pct}
                  hasGenerated={hasConcept(cluster.id)}
                  isSelected={selectedClusterId === cluster.id}
                  isGenerating={isGenerating}
                  canGenerate={canGenerate}
                  onSelect={() => handleSelect(cluster.id)}
                  onGenerate={() => onGenerateConcept?.(cluster.id)}
                  onViewBrief={() => handleViewBrief(cluster.id)}
                />
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
