import { useNavigate } from 'react-router-dom'
import ScoreBar from '../ScoreBar.jsx'
import { resolveSourceLink, SOURCE_TYPE_LABELS } from '../../../venture-scope/utils/sourceResolver.js'

function Section({ title, children }) {
  if (!children) return null
  return (
    <div className="glass-panel p-5">
      <h3 className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-3">
        {title}
      </h3>
      <div className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
        {children}
      </div>
    </div>
  )
}


function EvidenceTraceSection({ entries, storeSlice }) {
  const navigate = useNavigate()
  if (!entries?.length) return null
  return (
    <div className="glass-panel p-5">
      <h3 className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-3">
        Source Evidence
      </h3>
      <div className="space-y-3">
        {entries.map((e, i) => {
          const resolved = storeSlice
            ? resolveSourceLink(e.sourceId, e.sourceType, storeSlice)
            : null

          const rowContent = (
            <>
              <p className="text-[12px] text-[color:var(--color-text-primary)] leading-relaxed">
                "{e.evidenceSnippet}"
              </p>
              {resolved?.title && resolved.title !== e.evidenceSnippet && (
                <p className="text-[11px] text-[color:var(--color-text-secondary)] mt-1 truncate">
                  {resolved.title}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[color:var(--color-text-tertiary)]">
                <span className="px-1.5 py-0.5 rounded bg-white/5">
                  {SOURCE_TYPE_LABELS[e.sourceType] ?? e.sourceType}
                </span>
                {e.topicId && (
                  <span>topic: {e.topicId.slice(0, 16)}{e.topicId.length > 16 ? '…' : ''}</span>
                )}
                {e.documentId && (
                  <span>doc: {e.documentId.slice(0, 16)}{e.documentId.length > 16 ? '…' : ''}</span>
                )}
                <span className="opacity-60">
                  {new Date(e.extractedAt).toLocaleDateString()}
                </span>
                {resolved?.notFound && (
                  <span className="text-[10px] text-red-400/60 italic ml-1">source deleted</span>
                )}
              </div>
            </>
          )

          const borderDiv = (inner) => (
            <div key={e.signalId ?? i} className="border-l-2 pl-3" style={{ borderColor: 'rgba(20,184,166,0.35)' }}>
              {inner}
            </div>
          )

          if (resolved?.externalUrl) {
            return borderDiv(
              <a
                href={resolved.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block hover:bg-white/4 rounded"
              >
                {rowContent}
              </a>
            )
          }

          if (resolved?.internalPath) {
            return borderDiv(
              <button
                type="button"
                onClick={() => navigate(resolved.internalPath)}
                className="w-full text-left hover:bg-white/4 rounded"
              >
                {rowContent}
              </button>
            )
          }

          return borderDiv(rowContent)
        })}
      </div>
    </div>
  )
}

export default function BriefTab({ concept, candidates, onSelectCandidate, storeSlice }) {
  if (!concept) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-[color:var(--color-text-secondary)]">No brief generated yet.</p>
        <p className="text-xs text-[color:var(--color-text-tertiary)] mt-1">
          Select an opportunity from Scores or run a scan to generate briefs.
        </p>
      </div>
    )
  }

  const altCandidates = (candidates ?? []).filter((c) => (c.rank ?? 99) > 1)

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Title block */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] uppercase tracking-widest" style={{ color: 'rgba(217,70,239,0.6)' }}>
            Venture Brief
          </span>
          {concept.angleType && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[color:var(--color-text-tertiary)] capitalize">
              {concept.angleType.replace('_', '-')}
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold leading-snug mb-1">{concept.title}</h2>
        <p className="text-sm text-[color:var(--color-text-secondary)]">{concept.tagline}</p>
        {concept.coreWedge && (
          <p className="mt-2 text-[12px] text-[color:var(--color-text-secondary)] italic leading-relaxed border-l-2 pl-3" style={{ borderColor: 'rgba(217,70,239,0.4)' }}>
            {concept.coreWedge}
          </p>
        )}
        {concept.opportunityScore != null && (
          <div className="mt-3">
            <ScoreBar label="Opportunity score" score={concept.opportunityScore} color="topic" />
          </div>
        )}
      </div>

      <Section title="Opportunity Summary">{concept.opportunitySummary}</Section>
      <Section title="Problem Statement">{concept.problemStatement}</Section>
      <Section title="Target User">{concept.targetUser ?? concept.primaryUser}</Section>
      <Section title="Proposed Solution">{concept.proposedSolution ?? concept.workflowImprovement}</Section>
      <Section title="Value Proposition">{concept.valueProp}</Section>
      <Section title="Why Now">{concept.whyNow}</Section>
      <Section title="Buyer vs User">{concept.buyerVsUser}</Section>
      <Section title="Current Alternatives">{concept.currentAlternatives}</Section>
      <Section title="Existing Workarounds">{concept.existingWorkarounds}</Section>
      <Section title="Key Assumptions">{concept.keyAssumptions}</Section>
      <Section title="Success Metrics">{concept.successMetrics}</Section>
      <Section title="Pricing Hypothesis">{concept.pricingHypothesis ?? concept.revenueModelHypothesis}</Section>
      <Section title="Defensibility">{concept.defensibility}</Section>
      <Section title="Go-to-Market Angle">{concept.goToMarketAngle}</Section>
      <Section title="MVP Scope">{concept.mvpScope}</Section>
      <Section title="Risks">{concept.risks}</Section>
      <Section title="Implementation Plan">{concept.implementationPlan}</Section>

      {/* ROI Model */}
      {concept.roiModel && (
        <div className="glass-panel p-5">
          <h3 className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-3">
            ROI Model
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['Value creation',    concept.roiModel.estimatedValueCreation],
              ['Cost to build',     concept.roiModel.estimatedCostToBuild],
              ['Time to MVP',       concept.roiModel.estimatedTimeToMvp],
              ['Cost of problem',   concept.roiModel.estimatedCostOfProblem],
              ['Efficiency gain',   concept.roiModel.efficiencyGainPotential],
              ['Revenue scenarios', concept.roiModel.revenuePotentialScenarios],
              ['Payback period',    concept.roiModel.paybackPeriod],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="bg-white/3 rounded-lg p-3">
                <div className="text-[10px] text-[color:var(--color-text-tertiary)] mb-0.5">{label}</div>
                <div className="text-[12px] text-[color:var(--color-text-primary)] leading-snug">{value}</div>
              </div>
            ))}
          </div>
          {concept.roiModel.confidenceBand && (
            <p className="text-[10px] text-[color:var(--color-text-tertiary)] mt-3">
              Confidence band: {concept.roiModel.confidenceBand}
            </p>
          )}
        </div>
      )}

      {/* Evidence trace — source lineage for this concept's claims */}
      <EvidenceTraceSection entries={concept.evidenceTrace} storeSlice={storeSlice} />

      {/* Alternate concepts */}
      {altCandidates.length > 0 && (
        <div className="glass-panel p-5">
          <h3 className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-3">
            Alternate Concepts ({altCandidates.length})
          </h3>
          <div className="space-y-2">
            {altCandidates.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectCandidate?.(c)}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-white/3 hover:bg-white/6 border border-white/6 transition-colors"
              >
                <div className="text-[12px] font-medium">{c.title}</div>
                <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">{c.coreWedge}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
