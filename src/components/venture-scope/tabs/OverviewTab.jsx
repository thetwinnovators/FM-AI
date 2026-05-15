import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles } from 'lucide-react'
import ConfidenceBadge from '../ConfidenceBadge.jsx'
import DimensionScoreGrid from '../DimensionScoreGrid.jsx'
import { buildScoreExplanations } from '../../../opportunity-radar/services/opportunityScorer.js'

// ── Shared modal styles — matches Flow Trade / BriefTab treatment ─────────────

const LIQUID_GLASS = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.07) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.13)',
  boxShadow:
    '0 30px 80px rgba(0,0,0,0.65),' +
    '0 8px 24px rgba(0,0,0,0.35),' +
    'inset 0 1px 0 rgba(255,255,255,0.18),' +
    'inset 0 -1px 0 rgba(255,255,255,0.05)',
}

// ── EntityRow — compact chips for persona / workflow evidence ─────────────────

function EntityRow({ label, items, accent }) {
  if (!items?.length) return null
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="text-[10px] text-white/30 shrink-0 pt-0.5 w-20">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 6).map((item) => (
          <span
            key={item}
            className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/8 capitalize"
            style={accent ? { borderColor: accent } : undefined}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Cluster detail modal ──────────────────────────────────────────────────────

function ClusterDetailModal({
  cluster,
  concept,
  isGenerating,
  canGenerate,
  onClose,
  onGenerate,
  onViewBrief,
}) {
  const dim          = cluster.dimensionScores
  const explanations = dim ? buildScoreExplanations(dim, cluster.signalCount) : []

  const es = cluster.entitySummary
  const hasEntities = es && (
    es.personas?.length       ||
    es.workflows?.length      ||
    es.workarounds?.length    ||
    es.technologies?.length   ||
    es.emergingTech?.length   ||
    es.platformShifts?.length
  )

  // Escape to close
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[680px] rounded-2xl overflow-hidden flex flex-col"
        style={{ ...LIQUID_GLASS, height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="flex-shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.07]">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Opportunity</p>
            <h2 className="text-[17px] font-bold text-white/90 leading-snug">
              {cluster.clusterName}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            {dim?.confidence != null && <ConfidenceBadge confidence={dim.confidence} />}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">

          {/* Dark data strip */}
          <div
            className="overflow-hidden rounded-xl border border-white/[0.09]"
            style={{
              background: 'linear-gradient(160deg, #0d0f1c 0%, #07090f 100%)',
              boxShadow: 'rgba(0,0,0,0.50) 0px 8px 24px, rgba(255,255,255,0.07) 0px 1px 0px inset',
            }}
          >
            <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">Score</div>
                <div className="text-[22px] font-bold font-mono leading-none" style={{ color: 'var(--color-topic)' }}>
                  {cluster.opportunityScore ?? '—'}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">/ 100</div>
              </div>
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">Signals</div>
                <div className="text-[22px] font-bold font-mono leading-none text-white/80">
                  {cluster.signalCount ?? 0}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">data points</div>
              </div>
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">Sources</div>
                <div className="text-[22px] font-bold font-mono leading-none text-white/80">
                  {cluster.sourceDiversity ?? 0}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">types</div>
              </div>
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">Buildable</div>
                <div
                  className="text-[16px] font-bold font-mono leading-none mt-1"
                  style={{ color: cluster.isBuildable !== false ? 'rgba(52,211,153,0.9)' : 'rgba(255,255,255,0.3)' }}
                >
                  {cluster.isBuildable !== false ? 'Yes' : 'No'}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">
                  {cluster.inferredCategory ?? 'opportunity'}
                </div>
              </div>
            </div>
          </div>

          {/* Entity evidence chips */}
          {hasEntities && (
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
              <p className="text-[10px] uppercase tracking-widest text-white/25 mb-1">
                Evidence context
              </p>
              <EntityRow label="Personas"     items={es.personas} />
              <EntityRow label="Workflows"    items={es.workflows} />
              <EntityRow label="Workarounds"  items={es.workarounds} />
              <EntityRow label="Technologies" items={es.technologies} />
              <EntityRow label="Emerging"     items={es.emergingTech} />
              <EntityRow label="Mkt shifts"   items={es.platformShifts} />
            </div>
          )}

          {/* Dimension score breakdown */}
          {dim ? (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 mb-3">
                Dimension breakdown
              </p>
              <DimensionScoreGrid
                dimensionScores={dim}
                explanations={explanations}
                drivers={cluster.dimensionDrivers}
              />
            </div>
          ) : (
            <p className="text-[11px] text-white/30">
              Score dimensions not yet computed — re-run a scan.
            </p>
          )}

          {/* Linked concept preview — if generated */}
          {concept && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
              <p className="text-[10px] uppercase tracking-widest text-white/25 mb-1.5">
                Generated concept
              </p>
              <p className="text-[14px] font-semibold text-white/85">{concept.title}</p>
              {concept.tagline && (
                <p className="text-[12px] text-white/40 mt-0.5 leading-relaxed">{concept.tagline}</p>
              )}
            </div>
          )}

        </div>

        {/* ── Footer — frosted glass, pinned ── */}
        <div
          className="flex-shrink-0 px-5 py-4 border-t border-white/[0.07] flex items-center gap-3"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}
        >
          {concept ? (
            <button
              type="button"
              onClick={onViewBrief}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: 'var(--color-creator)' }}
            >
              View concept brief →
            </button>
          ) : (
            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating || !canGenerate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.10] text-white/55 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles size={13} />
              {isGenerating ? 'Generating…' : 'Generate venture concept'}
            </button>
          )}
        </div>

      </div>
    </div>,
    document.body,
  )
}

// ── Opportunity card (top 3) ──────────────────────────────────────────────────

function OpportunityCard({
  cluster, rank, concept, hasGenerated,
  isSelected, isGenerating, canGenerate,
  onOpenDetail, onGenerate, onViewBrief,
}) {
  return (
    <div
      className={[
        'glass-panel overflow-hidden flex flex-col transition-all duration-200',
        isSelected ? 'ring-1 ring-[color:var(--color-topic)]/40' : '',
      ].join(' ')}
    >
      {/* Card body — click opens detail modal */}
      <button
        type="button"
        onClick={onOpenDetail}
        className="p-4 flex-1 text-left group hover:bg-white/[0.03] transition-colors"
      >
        {/* Rank + score */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-[10px] font-mono text-[color:var(--color-text-tertiary)]">#{rank}</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-[18px] font-bold font-mono leading-none text-[color:var(--color-text-primary)]">
              {cluster.opportunityScore ?? '—'}
            </span>
            <span className="text-[9px] text-[color:var(--color-text-tertiary)]">/100</span>
          </div>
        </div>

        {/* Name */}
        <h3 className="text-[13px] font-semibold leading-snug mb-3 group-hover:text-white transition-colors">
          {cluster.clusterName}
        </h3>

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

        {/* Concept tagline preview */}
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
  cluster, rank, hasGenerated,
  isSelected, isGenerating, canGenerate,
  onOpenDetail, onGenerate, onViewBrief,
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-2.5 transition-colors',
        isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.025]',
      ].join(' ')}
    >
      {/* Rank */}
      <span className="text-[10px] font-mono text-[color:var(--color-text-tertiary)] w-5 shrink-0 text-right">
        {rank}
      </span>

      {/* Name + metadata — click opens detail modal */}
      <button
        type="button"
        onClick={onOpenDetail}
        className="flex-1 min-w-0 text-left group flex items-center gap-3"
      >
        <span className="text-[12px] font-medium truncate group-hover:text-white transition-colors flex-1 min-w-0">
          {cluster.clusterName}
        </span>
        <span className="text-[11px] text-[color:var(--color-text-tertiary)] shrink-0">
          {cluster.signalCount ?? 0} signals
        </span>
        <span className="text-[12px] font-mono font-medium text-[color:var(--color-text-secondary)] shrink-0">
          {cluster.opportunityScore ?? '—'}
        </span>
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
  const [activeClusterId, setActiveClusterId] = useState(null)

  const sorted = [...(clusters ?? [])].sort(
    (a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0),
  )
const hasConcept    = (id) => (concepts ?? []).some((c) => c.clusterId === id)
  const getTopConcept = (id) =>
    (concepts ?? [])
      .filter((c) => c.clusterId === id)
      .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))[0] ?? null

  const totalSignals  = meta?.totalSignals ?? (signals ?? []).length
  const totalConcepts = (concepts ?? []).length
  const canGenerate   = Boolean(entityGraph)

  const top3 = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  // Active cluster (for the detail modal)
  const activeCluster = sorted.find((c) => c.id === activeClusterId) ?? null
  const activeConcept = activeCluster ? getTopConcept(activeCluster.id) : null

  const handleViewBrief = (clusterId) => {
    onSelectCluster?.(clusterId)
    onNavigateToTab?.('Brief')
    setActiveClusterId(null)
  }

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

  return (
    <>
      <div className="space-y-6 max-w-4xl">

        {/* Inline stats strip */}
        <div className="flex items-center gap-3 text-[11px] text-[color:var(--color-text-tertiary)] flex-wrap">
          <span>
            <strong className="text-[color:var(--color-text-secondary)] font-semibold">{sorted.length}</strong>{' '}
            opportunit{sorted.length === 1 ? 'y' : 'ies'}
          </span>
          <span className="opacity-30">·</span>
          <span>
            <strong className="text-[color:var(--color-text-secondary)] font-semibold">{totalSignals}</strong>{' '}
            signals analysed
          </span>
          <span className="opacity-30">·</span>
          <span>
            <strong className="text-[color:var(--color-text-secondary)] font-semibold">{totalConcepts}</strong>{' '}
            concept{totalConcepts === 1 ? '' : 's'} generated
          </span>
        </div>

        {/* Top 3 cards */}
        {top3.length > 0 && (
          <div>
            <h3 className="text-[13px] font-semibold text-[color:var(--color-text-primary)] mb-3">
              Top Opportunities
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {top3.map((cluster, i) => (
                  <OpportunityCard
                    key={cluster.id}
                    cluster={cluster}
                    rank={i + 1}
                    concept={getTopConcept(cluster.id)}
                    hasGenerated={hasConcept(cluster.id)}
                    isSelected={selectedClusterId === cluster.id}
                    isGenerating={isGenerating}
                    canGenerate={canGenerate}
                    onOpenDetail={() => { onSelectCluster?.(cluster.id); setActiveClusterId(cluster.id) }}
                    onGenerate={() => onGenerateConcept?.(cluster.id)}
                    onViewBrief={() => handleViewBrief(cluster.id)}
                  />
              ))}
            </div>
          </div>
        )}

        {/* Remaining opportunities — compact rows */}
        {rest.length > 0 && (
          <div>
            <h3 className="text-[13px] font-semibold text-[color:var(--color-text-primary)] mb-3">
              More Opportunities
            </h3>
            <div className="glass-panel overflow-hidden divide-y divide-white/5">
              {rest.map((cluster, i) => (
                <CompactRow
                  key={cluster.id}
                  cluster={cluster}
                  rank={i + 4}
                  hasGenerated={hasConcept(cluster.id)}
                  isSelected={selectedClusterId === cluster.id}
                  isGenerating={isGenerating}
                  canGenerate={canGenerate}
                  onOpenDetail={() => { onSelectCluster?.(cluster.id); setActiveClusterId(cluster.id) }}
                  onGenerate={() => onGenerateConcept?.(cluster.id)}
                  onViewBrief={() => handleViewBrief(cluster.id)}
                />
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Cluster detail modal */}
      {activeCluster && (
        <ClusterDetailModal
          cluster={activeCluster}
          concept={activeConcept}
          isGenerating={isGenerating}
          canGenerate={canGenerate}
          onClose={() => setActiveClusterId(null)}
          onGenerate={() => {
            onGenerateConcept?.(activeCluster.id)
            setActiveClusterId(null)
          }}
          onViewBrief={() => handleViewBrief(activeCluster.id)}
        />
      )}
    </>
  )
}
