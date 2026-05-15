import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Download, Sparkles, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import ScoreBar from '../ScoreBar.jsx'
import { resolveSourceLink, SOURCE_TYPE_LABELS } from '../../../venture-scope/utils/sourceResolver.js'
import OpportunityFramePanel from '../OpportunityFramePanel.jsx'

// ── Modal glass style (matches app-wide Liquid Glass treatment) ───────────────

const LIQUID_GLASS = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.07) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.15)',
  boxShadow:
    '0 30px 80px rgba(0,0,0,0.65),' +
    '0 8px 24px rgba(0,0,0,0.35),' +
    'inset 0 1px 0 rgba(255,255,255,0.12)',
}

// ── Angle config ──────────────────────────────────────────────────────────────

const ANGLE_CONFIG = {
  persona_first: {
    label:       'Persona-First',
    color:       'rgba(217,70,239,0.8)',
    borderColor: 'rgba(217,70,239,0.3)',
    bgColor:     'rgba(217,70,239,0.08)',
  },
  workflow_first: {
    label:       'Workflow-First',
    color:       'rgba(59,130,246,0.85)',
    borderColor: 'rgba(59,130,246,0.3)',
    bgColor:     'rgba(59,130,246,0.08)',
  },
  technology_enablement: {
    label:       'Tech Enablement',
    color:       'rgba(16,185,129,0.85)',
    borderColor: 'rgba(16,185,129,0.3)',
    bgColor:     'rgba(16,185,129,0.08)',
  },
}

const GENERATED_BY_LABELS = {
  ollama:   { text: 'LLM synthesised', color: 'rgba(20,184,166,0.8)'  },
  graph:    { text: 'Graph derived',   color: 'rgba(148,163,184,0.65)' },
  template: { text: 'Template',        color: 'rgba(148,163,184,0.45)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreLabel(score) {
  if (score >= 70) return { text: 'Strong', color: 'rgba(16,185,129,0.95)' }
  if (score >= 50) return { text: 'Good',   color: 'rgba(245,158,11,0.95)'  }
  return                   { text: 'Fair',  color: 'rgba(148,163,184,0.8)'  }
}

// Composite rank: opportunity score + evidence weight + LLM-generation boost
function rankScore(c) {
  const score    = c.opportunityScore ?? 0
  const evidence = c.evidenceTrace?.length ?? 0
  const llmBoost = c.generatedBy === 'ollama' ? 5 : 0
  return score + evidence * 2 + llmBoost
}

// ── Concept deduplication ─────────────────────────────────────────────────────

/**
 * Remove near-duplicate concepts using Jaccard similarity on title word sets.
 * Words ≤2 chars are ignored (stop words). Two concepts are merged when their
 * title Jaccard similarity ≥ 0.5. The highest-ranked concept in each group is
 * kept; others are discarded.
 */
function deduplicateConcepts(concepts) {
  const titleWords = (title) =>
    new Set(
      (title ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2),
    )

  const jaccard = (setA, setB) => {
    if (!setA.size && !setB.size) return 1
    let intersection = 0
    setA.forEach((w) => { if (setB.has(w)) intersection++ })
    const union = setA.size + setB.size - intersection
    return union === 0 ? 0 : intersection / union
  }

  // Sort highest-ranked first so first occurrence in each cluster is kept
  const sorted = [...concepts].sort((a, b) => rankScore(b) - rankScore(a))
  const absorbed = new Set()
  const kept = []

  for (let i = 0; i < sorted.length; i++) {
    if (absorbed.has(sorted[i].id)) continue
    kept.push(sorted[i])
    const wordsI = titleWords(sorted[i].title)
    for (let j = i + 1; j < sorted.length; j++) {
      if (absorbed.has(sorted[j].id)) continue
      if (jaccard(wordsI, titleWords(sorted[j].title)) >= 0.5) {
        absorbed.add(sorted[j].id)
      }
    }
  }
  return kept
}

// ── Markdown export ───────────────────────────────────────────────────────────

function generateMarkdown(concept, clusterName) {
  const angleLabel = ANGLE_CONFIG[concept.angleType]?.label ?? concept.angleType ?? ''
  const genLabel   = GENERATED_BY_LABELS[concept.generatedBy]?.text ?? concept.generatedBy ?? ''
  const date       = new Date(concept.createdAt ?? Date.now()).toLocaleDateString()

  const sec = (heading, body) => {
    if (!body || body === '—' || body.trim() === '') return ''
    return `## ${heading}\n\n${body.trim()}\n\n`
  }

  return [
    `# ${concept.title}`,
    '',
    `> ${concept.tagline ?? ''}`,
    '',
    `**Angle:** ${angleLabel}  `,
    `**Generation:** ${genLabel}  `,
    `**Opportunity Score:** ${concept.opportunityScore ?? '—'}/100  `,
    clusterName ? `**Opportunity Cluster:** ${clusterName}  ` : '',
    `**Generated:** ${date}  `,
    '',
    '---',
    '',
    concept.coreWedge ? `*${concept.coreWedge}*\n` : '',
    '---',
    '',
    sec('Opportunity Summary',  concept.opportunitySummary),
    sec('Problem Statement',    concept.problemStatement),
    sec('Target User',          concept.targetUser ?? concept.primaryUser),
    sec('Proposed Solution',    concept.proposedSolution ?? concept.workflowImprovement),
    sec('Value Proposition',    concept.valueProp),
    sec('Why Now',              concept.whyNow),
    sec('Buyer vs User',        concept.buyerVsUser),
    sec('Current Alternatives', concept.currentAlternatives),
    sec('Existing Workarounds', concept.existingWorkarounds),
    sec('Key Assumptions',      concept.keyAssumptions),
    sec('Success Metrics',      concept.successMetrics),
    sec('Pricing Hypothesis',   concept.pricingHypothesis ?? concept.revenueModelHypothesis),
    sec('Defensibility',        concept.defensibility),
    sec('Go-to-Market Angle',   concept.goToMarketAngle),
    sec('MVP Scope',            concept.mvpScope),
    sec('Risks',                concept.risks),
    concept.implementationPlan ? sec('Implementation Plan', concept.implementationPlan) : '',
    '---',
    '',
    `*Generated by FlowMap Venture Scope · ${new Date().toLocaleDateString()}*`,
  ].filter(l => l !== undefined).join('\n')
}

function downloadConceptMd(concept, clusterName) {
  const md   = generateMarkdown(concept, clusterName)
  const slug = concept.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/^-|-$/g, '')
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `${slug}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Small shared components ───────────────────────────────────────────────────

function AnglePill({ angleType }) {
  const cfg = ANGLE_CONFIG[angleType] ?? ANGLE_CONFIG.persona_first
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
      style={{ color: cfg.color, backgroundColor: cfg.bgColor, border: `1px solid ${cfg.borderColor}` }}
    >
      {cfg.label}
    </span>
  )
}

function GeneratedByBadge({ generatedBy }) {
  const cfg = GENERATED_BY_LABELS[generatedBy] ?? GENERATED_BY_LABELS.template
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
      style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: cfg.color, border: `1px solid ${cfg.color}` }}
    >
      {cfg.text}
    </span>
  )
}

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

function EvidenceBlock({ entries, storeSlice }) {
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
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[color:var(--color-text-tertiary)]">
                <span className="px-1.5 py-0.5 rounded bg-white/5">
                  {SOURCE_TYPE_LABELS[e.sourceType] ?? e.sourceType}
                </span>
                <span className="opacity-60">{new Date(e.extractedAt).toLocaleDateString()}</span>
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

// ── Concept card (grid item) ──────────────────────────────────────────────────

function ConceptCard({ concept, clusterName, onClick }) {
  const angle   = ANGLE_CONFIG[concept.angleType] ?? ANGLE_CONFIG.persona_first
  const { text: scoreText, color: scoreColor } = scoreLabel(concept.opportunityScore ?? 0)
  const signals = concept.evidenceTrace?.length ?? 0

  const summary = (() => {
    const raw = concept.opportunitySummary ?? concept.coreWedge ?? ''
    return raw.length > 130 ? raw.slice(0, 130).trimEnd() + '…' : raw
  })()

  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-panel w-full text-left overflow-hidden transition-all duration-150 hover:scale-[1.015] active:scale-[0.99] group"
    >
      {/* Angle accent stripe */}
      <div className="h-0.5 transition-opacity group-hover:opacity-80" style={{ backgroundColor: angle.color }} />

      <div className="p-4">
        {/* Top row: badges + score chip */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <AnglePill angleType={concept.angleType} />
            {concept.generatedBy && <GeneratedByBadge generatedBy={concept.generatedBy} />}
          </div>
          {concept.opportunityScore != null && (
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-[10px]" style={{ color: scoreColor }}>{scoreText}</span>
              <span className="text-xl font-bold leading-none" style={{ color: scoreColor }}>
                {concept.opportunityScore}
              </span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[14px] font-semibold leading-snug mb-1 group-hover:text-white transition-colors">
          {concept.title}
        </h3>

        {/* Cluster name */}
        {clusterName && (
          <p className="text-[10px] text-[color:var(--color-text-tertiary)] mb-2 truncate">
            {clusterName}
          </p>
        )}

        {/* Summary */}
        <p className="text-[12px] text-[color:var(--color-text-secondary)] leading-relaxed">
          {summary}
        </p>

        {/* Footer: evidence signals */}
        {signals > 0 && (
          <div className="mt-3 pt-3 border-t border-white/6 flex items-center gap-1.5 text-[10px] text-[color:var(--color-text-tertiary)]">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: 'rgba(20,184,166,0.6)' }}
            />
            {signals} signal{signals !== 1 ? 's' : ''} of evidence
          </div>
        )}
      </div>
    </button>
  )
}

// ── Concept modal ─────────────────────────────────────────────────────────────

function ConceptModal({ concept, clusterName, storeSlice, onClose, onRegenerate, isRegenerating }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const angle = ANGLE_CONFIG[concept.angleType] ?? ANGLE_CONFIG.persona_first

  const handleEnhance = useCallback(() => {
    const prompt = [
      `Enhance and deepen this venture concept:`,
      ``,
      `**${concept.title}**`,
      concept.tagline ?? '',
      ``,
      `Core insight: ${concept.coreWedge ?? ''}`,
      ``,
      `Opportunity: ${concept.opportunitySummary ?? ''}`,
      ``,
      `Problem: ${concept.problemStatement ?? ''}`,
      ``,
      `Proposed solution: ${concept.proposedSolution ?? concept.workflowImprovement ?? ''}`,
    ].join('\n')
    navigate('/chat', { state: { prefilledPrompt: prompt } })
    onClose()
  }, [concept, navigate, onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ ...LIQUID_GLASS, maxHeight: 'calc(100vh - 48px)' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8 shrink-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <AnglePill angleType={concept.angleType} />
            {concept.generatedBy && <GeneratedByBadge generatedBy={concept.generatedBy} />}
            {clusterName && (
              <span className="text-[10px] text-[color:var(--color-text-tertiary)] bg-white/5 px-1.5 py-0.5 rounded truncate max-w-[180px]">
                {clusterName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {concept.rank === 1 && onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(concept.clusterId)}
                disabled={isRegenerating}
                title="Regenerate from graph"
                className="p-1.5 rounded text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)] hover:bg-white/5 disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)] hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="flex-1 px-6 py-5 space-y-5 overflow-y-auto min-h-0">

          {/* Title block */}
          <div>
            <h2 className="text-xl font-semibold leading-snug">{concept.title}</h2>
            {concept.tagline && (
              <p className="text-sm text-[color:var(--color-text-secondary)] mt-1">{concept.tagline}</p>
            )}
            {concept.coreWedge && (
              <p className="mt-3 text-[12px] text-[color:var(--color-text-secondary)] italic leading-relaxed border-l-2 pl-3"
                style={{ borderColor: angle.borderColor }}>
                {concept.coreWedge}
              </p>
            )}
            {concept.opportunityScore != null && (
              <div className="mt-3">
                <ScoreBar label="Opportunity score" score={concept.opportunityScore} color="topic" />
              </div>
            )}
          </div>

          {/* Core sections */}
          <div className="space-y-4">
            <Section title="Opportunity Summary">{concept.opportunitySummary}</Section>
            <Section title="Problem Statement">{concept.problemStatement}</Section>
            <Section title="Target User">{concept.targetUser ?? concept.primaryUser}</Section>
            <Section title="Proposed Solution">{concept.proposedSolution ?? concept.workflowImprovement}</Section>
            <Section title="Value Proposition">{concept.valueProp}</Section>
            <Section title="Why Now">{concept.whyNow}</Section>
          </div>

          {/* Evidence — always shown */}
          {concept.evidenceTrace?.length > 0 && (
            <EvidenceBlock entries={concept.evidenceTrace} storeSlice={storeSlice} />
          )}

          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-[11px] text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-secondary)] transition-colors"
          >
            {expanded
              ? <><ChevronUp className="w-3.5 h-3.5" />Show less</>
              : <><ChevronDown className="w-3.5 h-3.5" />Full brief — pricing, GTM, MVP, risks &amp; more</>
            }
          </button>

          {/* Extended sections */}
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
                  <div className="grid grid-cols-2 gap-2">
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
            </div>
          )}
        </div>

        {/* Modal footer — actions */}
        <div className="px-6 py-4 border-t border-white/8 shrink-0 flex items-center gap-3">
          <button
            type="button"
            onClick={() => downloadConceptMd(concept, clusterName)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium border border-white/12 bg-white/5 hover:bg-white/10 text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download .md
          </button>
          <button
            type="button"
            onClick={handleEnhance}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.75) 0%, rgba(59,130,246,0.75) 100%)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Enhance with Flow.AI
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── BriefTab ──────────────────────────────────────────────────────────────────

export default function BriefTab({
  // new props
  concepts,
  clusters,
  // legacy props — kept for API compat
  concept,
  candidates,
  onSelectCandidate,   // eslint-disable-line no-unused-vars
  selectedCluster,     // eslint-disable-line no-unused-vars
  entityGraph,         // eslint-disable-line no-unused-vars
  allSignals,          // eslint-disable-line no-unused-vars
  // shared
  storeSlice,
  onRegenerateConcept,
  isRegenerating,
}) {
  const [activeConcept, setActiveConcept] = useState(null)

  const lookupCluster = useCallback(
    (clusterId) => clusters?.find(c => c.id === clusterId)?.name ?? '',
    [clusters],
  )

  // Prefer new `concepts` prop; fall back to `candidates` / single `concept`
  const allConcepts = (concepts?.length ?? 0) > 0
    ? concepts
    : ((candidates?.length ?? 0) > 0 ? candidates : (concept ? [concept] : []))

  // Deduplicate near-identical concepts, then sort by composite rank
  const ranked = deduplicateConcepts(allConcepts)

  if (!ranked.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-[color:var(--color-text-secondary)]">No concepts generated yet.</p>
        <p className="text-xs text-[color:var(--color-text-tertiary)] mt-1">
          Run a scan to generate venture concepts from your knowledge base.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-4xl">
        {/* Header */}
        <p className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-4">
          {ranked.length} Venture {ranked.length === 1 ? 'Concept' : 'Concepts'} · Ranked by score · Duplicates merged
        </p>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ranked.map((c) => (
            <ConceptCard
              key={c.id}
              concept={c}
              clusterName={lookupCluster(c.clusterId)}
              onClick={() => setActiveConcept(c)}
            />
          ))}
        </div>
      </div>

      {/* Full-brief modal */}
      {activeConcept && (
        <ConceptModal
          concept={activeConcept}
          clusterName={lookupCluster(activeConcept.clusterId)}
          storeSlice={storeSlice}
          onClose={() => setActiveConcept(null)}
          onRegenerate={onRegenerateConcept}
          isRegenerating={isRegenerating}
        />
      )}
    </>
  )
}
