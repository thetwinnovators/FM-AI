import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import ScoreBar from '../ScoreBar.jsx'
import { resolveSourceLink, SOURCE_TYPE_LABELS } from '../../../venture-scope/utils/sourceResolver.js'
import { buildOpportunityFrame } from '../../../venture-scope/services/opportunityFrameBuilder.js'
import OpportunityFramePanel from '../OpportunityFramePanel.jsx'

// ── Angle config ──────────────────────────────────────────────────────────────
const ANGLE_CONFIG = {
  persona_first: {
    label:       'Persona-First',
    description: 'Anchored on primary user pain',
    color:       'rgba(217,70,239,0.75)',
    borderColor: 'rgba(217,70,239,0.3)',
    bgColor:     'rgba(217,70,239,0.07)',
  },
  workflow_first: {
    label:       'Workflow-First',
    description: 'Anchored on the broken workflow step',
    color:       'rgba(59,130,246,0.8)',
    borderColor: 'rgba(59,130,246,0.3)',
    bgColor:     'rgba(59,130,246,0.07)',
  },
  technology_enablement: {
    label:       'Tech Enablement',
    description: 'Anchored on the enabling technology shift',
    color:       'rgba(16,185,129,0.8)',
    borderColor: 'rgba(16,185,129,0.3)',
    bgColor:     'rgba(16,185,129,0.07)',
  },
}

// ── Generated-by badge ────────────────────────────────────────────────────────
const GENERATED_BY_LABELS = {
  ollama:   { text: 'LLM synthesised', color: 'rgba(20,184,166,0.75)' },
  graph:    { text: 'Graph derived',   color: 'rgba(148,163,184,0.65)' },
  template: { text: 'Template',        color: 'rgba(148,163,184,0.45)' },
}

function GeneratedByBadge({ generatedBy }) {
  const cfg = GENERATED_BY_LABELS[generatedBy] ?? GENERATED_BY_LABELS.template
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded"
      style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: cfg.color, border: `1px solid ${cfg.color}` }}
    >
      {cfg.text}
    </span>
  )
}

// ── Section row ───────────────────────────────────────────────────────────────
function Section({ title, children }) {
  if (!children) return null
  if (typeof children === 'string' && (children.trim() === '—' || children.trim() === '')) return null
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-1.5">
        {title}
      </h4>
      <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
        {children}
      </p>
    </div>
  )
}

// ── Evidence trace ────────────────────────────────────────────────────────────
function EvidenceTraceSection({ entries, storeSlice }) {
  const navigate = useNavigate()
  if (!entries?.length) return null
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-2">
        Source Evidence
      </h4>
      <div className="space-y-2.5">
        {entries.map((e, i) => {
          const resolved = storeSlice ? resolveSourceLink(e.sourceId, e.sourceType, storeSlice) : null
          const inner = (
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
                <span className="opacity-60">{new Date(e.extractedAt).toLocaleDateString()}</span>
                {resolved?.notFound && (
                  <span className="text-red-400/60 italic">source deleted</span>
                )}
              </div>
            </>
          )
          const wrap = (child) => (
            <div key={e.signalId ?? i} className="border-l-2 pl-3" style={{ borderColor: 'rgba(20,184,166,0.35)' }}>
              {child}
            </div>
          )
          if (resolved?.externalUrl) return wrap(
            <a href={resolved.externalUrl} target="_blank" rel="noopener noreferrer" className="block hover:bg-white/4 rounded">
              {inner}
            </a>
          )
          if (resolved?.internalPath) return wrap(
            <button type="button" onClick={() => navigate(resolved.internalPath)} className="w-full text-left hover:bg-white/4 rounded">
              {inner}
            </button>
          )
          return wrap(inner)
        })}
      </div>
    </div>
  )
}

// ── Single concept card ───────────────────────────────────────────────────────
function ConceptCard({ concept, storeSlice, onRegenerate, isRegenerating }) {
  const [expanded, setExpanded] = useState(false)
  const angle = ANGLE_CONFIG[concept.angleType] ?? ANGLE_CONFIG.persona_first
  const canRegenerate = concept.rank === 1 && !!onRegenerate

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${angle.borderColor}`, backgroundColor: 'rgba(255,255,255,0.02)' }}
    >
      {/* Angle accent stripe */}
      <div className="h-0.5" style={{ backgroundColor: angle.color }} />

      <div className="p-5 space-y-4">

        {/* Header: angle pill + generated-by + regenerate */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
              style={{ color: angle.color, backgroundColor: angle.bgColor, border: `1px solid ${angle.borderColor}` }}
            >
              {angle.label}
            </span>
            {concept.generatedBy && <GeneratedByBadge generatedBy={concept.generatedBy} />}
          </div>
          {canRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerate(concept.clusterId)}
              disabled={isRegenerating}
              title="Regenerate this concept from graph"
              aria-label="Regenerate brief from graph"
              className="p-1.5 rounded text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Title, tagline, core wedge, score */}
        <div>
          <h2 className="text-lg font-semibold leading-snug">{concept.title}</h2>
          {concept.tagline && (
            <p className="text-sm text-[color:var(--color-text-secondary)] mt-0.5">{concept.tagline}</p>
          )}
          {concept.coreWedge && (
            <p
              className="mt-2.5 text-[12px] text-[color:var(--color-text-secondary)] italic leading-relaxed border-l-2 pl-3"
              style={{ borderColor: angle.borderColor }}
            >
              {concept.coreWedge}
            </p>
          )}
          {concept.opportunityScore != null && (
            <div className="mt-3">
              <ScoreBar label="Opportunity score" score={concept.opportunityScore} color="topic" />
            </div>
          )}
        </div>

        {/* Core sections — always visible */}
        <div className="space-y-4">
          <Section title="Opportunity Summary">{concept.opportunitySummary}</Section>
          <Section title="Problem Statement">{concept.problemStatement}</Section>
          <Section title="Target User">{concept.targetUser ?? concept.primaryUser}</Section>
          <Section title="Proposed Solution">{concept.proposedSolution ?? concept.workflowImprovement}</Section>
          <Section title="Value Proposition">{concept.valueProp}</Section>
          <Section title="Why Now">{concept.whyNow}</Section>
        </div>

        {/* Evidence trace — always shown for LLM concepts */}
        {!expanded && concept.rank === 1 && concept.evidenceTrace?.length > 0 && (
          <EvidenceTraceSection entries={concept.evidenceTrace} storeSlice={storeSlice} />
        )}

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-secondary)] transition-colors pt-1"
        >
          {expanded
            ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
            : <><ChevronDown className="w-3.5 h-3.5" /> Full brief — pricing, GTM, MVP, risks &amp; more</>
          }
        </button>

        {/* Extended sections — shown when expanded */}
        {expanded && (
          <div className="space-y-4 pt-2 border-t border-white/6">
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
            {concept.implementationPlan && (
              <Section title="Implementation Plan">{concept.implementationPlan}</Section>
            )}
            {concept.roiModel && (
              <div>
                <h4 className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-2">
                  ROI Model
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    ['Value creation',    concept.roiModel.estimatedValueCreation],
                    ['Cost to build',     concept.roiModel.estimatedCostToBuild],
                    ['Time to MVP',       concept.roiModel.estimatedTimeToMvp],
                    ['Revenue scenarios', concept.roiModel.revenuePotentialScenarios],
                    ['Payback period',    concept.roiModel.paybackPeriod],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label} className="rounded-lg p-2.5 bg-white/3">
                      <div className="text-[10px] text-[color:var(--color-text-tertiary)] mb-0.5">{label}</div>
                      <div className="text-[12px] text-[color:var(--color-text-primary)] leading-snug">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <EvidenceTraceSection entries={concept.evidenceTrace} storeSlice={storeSlice} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── BriefTab ──────────────────────────────────────────────────────────────────
export default function BriefTab({
  // `concept` and `onSelectCandidate` retained for API compat but no longer drive rendering
  concept,
  candidates,
  onSelectCandidate,     // eslint-disable-line no-unused-vars
  storeSlice,
  selectedCluster,
  entityGraph,
  allSignals,
  onRegenerateConcept,
  isRegenerating,
}) {
  const frame = (selectedCluster && entityGraph && allSignals)
    ? buildOpportunityFrame(selectedCluster, allSignals, entityGraph)
    : null

  // Use candidates array; fall back to lone concept prop for backwards compat
  const allCandidates = (candidates ?? []).length > 0
    ? candidates
    : (concept ? [concept] : [])

  const sortedCandidates = [...allCandidates].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))

  if (!sortedCandidates.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-[color:var(--color-text-secondary)]">No briefs generated yet.</p>
        <p className="text-xs text-[color:var(--color-text-tertiary)] mt-1">
          Select an opportunity from Scores or run a scan to generate briefs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Tab header */}
      <div>
        <p className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)]">
          {sortedCandidates.length} Venture {sortedCandidates.length === 1 ? 'Concept' : 'Concepts'}
        </p>
        {selectedCluster && (
          <p className="text-xs text-[color:var(--color-text-secondary)] mt-0.5 truncate">
            for &ldquo;{selectedCluster.name}&rdquo;
          </p>
        )}
      </div>

      {/* Concept cards */}
      {sortedCandidates.map((c) => (
        <ConceptCard
          key={c.id}
          concept={c}
          storeSlice={storeSlice}
          onRegenerate={onRegenerateConcept}
          isRegenerating={isRegenerating}
        />
      ))}

      {/* Opportunity frame — shared context for all concepts above */}
      <OpportunityFramePanel frame={frame} />
    </div>
  )
}
