import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Download, Sparkles, X, RefreshCw, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { resolveSourceLink, SOURCE_TYPE_LABELS } from '../../../venture-scope/utils/sourceResolver.js'

// ── Liquid Glass — matches Flow Trade's SignalDetailModal exactly ─────────────

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

// ── Dark data strip — matches Flow Trade's price-level strip ─────────────────

const DATA_STRIP = {
  background: 'linear-gradient(160deg, #0d0f1c 0%, #07090f 100%)',
  boxShadow: 'rgba(0,0,0,0.50) 0px 8px 24px, rgba(255,255,255,0.07) 0px 1px 0px inset',
}

// ── Paper card — matches Flow Trade's "Next Steps" paper card ─────────────────

const PAPER_CARD = {
  borderRadius: 14,
  background: 'linear-gradient(160deg, #fdf9f3 0%, #f7f0e6 100%)',
  border: '1px solid rgba(190,155,100,0.22)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.18), 0 1px 3px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.90)',
  overflow: 'clip',
}

// ── Angle config ──────────────────────────────────────────────────────────────

const ANGLE_CONFIG = {
  persona_first:         { label: 'Persona-First'  },
  workflow_first:        { label: 'Workflow-First'  },
  technology_enablement: { label: 'Tech Enablement' },
}

const GENERATED_BY_LABELS = {
  ollama:   'LLM synthesised',
  graph:    'Graph derived',
  template: 'Template',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Composite rank: opportunity score + evidence weight + LLM-generation boost
function rankScore(c) {
  return (c.opportunityScore ?? 0) + (c.evidenceTrace?.length ?? 0) * 2 + (c.generatedBy === 'ollama' ? 5 : 0)
}

// ── Concept deduplication ─────────────────────────────────────────────────────

function deduplicateConcepts(concepts) {
  const titleWords = (title) =>
    new Set((title ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2))

  const jaccard = (setA, setB) => {
    if (!setA.size && !setB.size) return 1
    let intersection = 0
    setA.forEach((w) => { if (setB.has(w)) intersection++ })
    const union = setA.size + setB.size - intersection
    return union === 0 ? 0 : intersection / union
  }

  const sorted = [...concepts].sort((a, b) => rankScore(b) - rankScore(a))
  const absorbed = new Set()
  const kept = []

  for (let i = 0; i < sorted.length; i++) {
    if (absorbed.has(sorted[i].id)) continue
    kept.push(sorted[i])
    const wordsI = titleWords(sorted[i].title)
    for (let j = i + 1; j < sorted.length; j++) {
      if (absorbed.has(sorted[j].id)) continue
      if (jaccard(wordsI, titleWords(sorted[j].title)) >= 0.5) absorbed.add(sorted[j].id)
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
  a.href = url; a.download = `${slug}.md`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ── Small shared components ───────────────────────────────────────────────────

function AnglePill({ angleType }) {
  const cfg = ANGLE_CONFIG[angleType] ?? ANGLE_CONFIG.persona_first
  return (
    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 bg-white/[0.06] border border-white/[0.12] text-[color:var(--color-text-secondary)]">
      {cfg.label}
    </span>
  )
}

function GeneratedByBadge({ generatedBy }) {
  const label = GENERATED_BY_LABELS[generatedBy] ?? GENERATED_BY_LABELS.template
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded shrink-0 bg-white/[0.04] border border-white/[0.08] text-[color:var(--color-text-tertiary)]">
      {label}
    </span>
  )
}

// ── Paper section — warm serif text, used inside paper cards ─────────────────

function PaperSection({ title, children }) {
  if (!children) return null
  const text = typeof children === 'string' ? children.trim() : null
  if (text !== null && (text === '—' || text === '')) return null
  return (
    <div style={{ borderBottom: '1px solid rgba(160,130,90,0.13)', paddingBottom: 14 }}>
      <div style={{
        fontFamily: 'var(--font-lesson, "Georgia", serif)',
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: '#a07840',
        marginBottom: 6,
      }}>
        {title}
      </div>
      <p style={{
        fontFamily: 'var(--font-lesson, "Georgia", serif)',
        fontSize: 13.5,
        fontWeight: 400,
        lineHeight: 1.72,
        color: '#2c1f0e',
        margin: 0,
        whiteSpace: 'pre-wrap',
      }}>
        {children}
      </p>
    </div>
  )
}

// ── Paper card shell — header + body ─────────────────────────────────────────

function PaperCard({ label, children }) {
  return (
    <div style={PAPER_CARD}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '11px 18px 10px',
        borderBottom: '1px solid rgba(190,155,100,0.14)',
        background: 'rgba(255,255,255,0.40)',
      }}>
        <ArrowRight size={11} style={{ color: '#c4a060', flexShrink: 0 }} />
        <span style={{
          fontFamily: 'var(--font-lesson, "Georgia", serif)',
          fontSize: 10, fontWeight: 600,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: '#a07840',
        }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(190,155,100,0.18)', marginLeft: 4 }} />
      </div>
      {/* Body */}
      <div style={{ padding: '14px 18px 4px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {children}
      </div>
    </div>
  )
}

// ── Evidence block ────────────────────────────────────────────────────────────

function EvidenceBlock({ entries, storeSlice }) {
  const navigate = useNavigate()
  if (!entries?.length) return null
  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-widest text-white/30 mb-2">
        Source Evidence
      </h4>
      <div className="space-y-2.5">
        {entries.map((e, i) => {
          const resolved = storeSlice ? resolveSourceLink(e.sourceId, e.sourceType, storeSlice) : null
          const inner = (
            <>
              <p className="text-[12px] text-white/70 leading-relaxed">
                "{e.evidenceSnippet}"
              </p>
              {resolved?.title && resolved.title !== e.evidenceSnippet && (
                <p className="text-[11px] text-white/40 mt-1 truncate">{resolved.title}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-white/25">
                <span className="px-1.5 py-0.5 rounded bg-white/5">
                  {SOURCE_TYPE_LABELS[e.sourceType] ?? e.sourceType}
                </span>
                <span>{new Date(e.extractedAt).toLocaleDateString()}</span>
              </div>
            </>
          )
          const wrap = (child) => (
            <div key={e.signalId ?? i} className="border-l-2 pl-3" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
              {child}
            </div>
          )
          if (resolved?.externalUrl) return wrap(
            <a href={resolved.externalUrl} target="_blank" rel="noopener noreferrer" className="block hover:bg-white/4 rounded transition-colors">{inner}</a>
          )
          if (resolved?.internalPath) return wrap(
            <button type="button" onClick={() => navigate(resolved.internalPath)} className="w-full text-left hover:bg-white/4 rounded transition-colors">{inner}</button>
          )
          return wrap(inner)
        })}
      </div>
    </div>
  )
}

// ── keep angle reference available in modal (label only) ─────────────────────
function getAngleLabel(angleType) {
  return ANGLE_CONFIG[angleType]?.label ?? angleType ?? ''
}

// ── Concept card (grid item) ──────────────────────────────────────────────────

function ConceptCard({ concept, clusterName, onClick }) {
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
      <div className="p-4">
        {/* Badges + score */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <AnglePill angleType={concept.angleType} />
            {concept.generatedBy && <GeneratedByBadge generatedBy={concept.generatedBy} />}
          </div>
          {concept.opportunityScore != null && (
            <div className="flex items-baseline gap-1 shrink-0">
              <span className="text-[16px] font-bold font-mono leading-none text-[color:var(--color-text-secondary)]">
                {concept.opportunityScore}
              </span>
              <span className="text-[9px] text-[color:var(--color-text-tertiary)]">/100</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[14px] font-semibold leading-snug mb-1 group-hover:text-white transition-colors">
          {concept.title}
        </h3>

        {/* Cluster name */}
        {clusterName && (
          <p className="text-[10px] text-[color:var(--color-text-tertiary)] mb-2 truncate">{clusterName}</p>
        )}

        {/* Summary */}
        <p className="text-[12px] text-[color:var(--color-text-secondary)] leading-relaxed">{summary}</p>

        {/* Footer */}
        {signals > 0 && (
          <div className="mt-3 pt-3 border-t border-white/6 flex items-center gap-1.5 text-[10px] text-[color:var(--color-text-tertiary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20 shrink-0" />
            {signals} signal{signals !== 1 ? 's' : ''} of evidence
          </div>
        )}
      </div>
    </button>
  )
}

// ── Concept modal — Flow Trade treatment ──────────────────────────────────────

function ConceptModal({ concept, clusterName, storeSlice, onClose, onRegenerate, isRegenerating }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)

  // Escape to close
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const handleEnhance = useCallback(() => {
    navigate('/chat', {
      state: {
        prefilledPrompt: [
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
        ].join('\n'),
      },
    })
    onClose()
  }, [concept, navigate, onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[720px] rounded-2xl overflow-hidden flex flex-col"
        style={{ ...LIQUID_GLASS, height: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4 border-b border-white/[0.07]">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <AnglePill angleType={concept.angleType} />
            {concept.generatedBy && <GeneratedByBadge generatedBy={concept.generatedBy} />}
            {clusterName && (
              <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                {clusterName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {concept.rank === 1 && onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(concept.clusterId)}
                disabled={isRegenerating}
                title="Regenerate from graph"
                className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] disabled:opacity-40 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
              </button>
            )}
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

          {/* Title block */}
          <div>
            <h2 className="text-[19px] font-bold text-white/90 leading-snug">{concept.title}</h2>
            {concept.tagline && (
              <p className="text-[13px] text-white/45 mt-1 leading-relaxed">{concept.tagline}</p>
            )}
          </div>

          {/* ── Dark data strip (mirrors Flow Trade price-level strip) ── */}
          <div
            className="overflow-hidden rounded-xl border border-white/[0.09]"
            style={DATA_STRIP}
          >
            <div className="grid grid-cols-4 divide-x divide-white/[0.06]">
              {/* Opportunity Score */}
              <div className="px-4 pt-3.5 pb-3">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                    Opp. Score
                  </span>
                </div>
                <div className="text-[22px] font-bold font-mono leading-none" style={{ color: 'var(--color-topic)' }}>
                  {concept.opportunityScore ?? '—'}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">/ 100</div>
              </div>

              {/* Evidence signals */}
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">
                  Evidence
                </div>
                <div className="text-[22px] font-bold font-mono leading-none text-white/80">
                  {concept.evidenceTrace?.length ?? 0}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">signals</div>
              </div>

              {/* Rank */}
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">
                  Rank
                </div>
                <div className="text-[22px] font-bold font-mono leading-none text-white/80">
                  #{concept.rank ?? '—'}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">by score</div>
              </div>

              {/* Buildable */}
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">
                  Buildable
                </div>
                <div
                  className="text-[16px] font-bold font-mono leading-none mt-1"
                  style={{ color: concept.isBuildable !== false ? 'rgba(52,211,153,0.9)' : 'rgba(255,255,255,0.3)' }}
                >
                  {concept.isBuildable !== false ? 'Yes' : 'No'}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">
                  {concept.generatedBy === 'ollama' ? 'LLM-driven' : 'graph-derived'}
                </div>
              </div>
            </div>
          </div>

          {/* Core wedge quote */}
          {concept.coreWedge && (
            <p
              className="text-[13px] text-white/45 italic leading-relaxed pl-4 border-l-2"
              style={{ borderColor: 'rgba(255,255,255,0.14)' }}
            >
              {concept.coreWedge}
            </p>
          )}

          {/* ── Paper card — Venture Brief ── */}
          <PaperCard label="Venture Brief">
            <PaperSection title="Opportunity Summary">{concept.opportunitySummary}</PaperSection>
            <PaperSection title="Problem Statement">{concept.problemStatement}</PaperSection>
            <PaperSection title="Target User">{concept.targetUser ?? concept.primaryUser}</PaperSection>
            <PaperSection title="Proposed Solution">{concept.proposedSolution ?? concept.workflowImprovement}</PaperSection>
            <PaperSection title="Value Proposition">{concept.valueProp}</PaperSection>
            <PaperSection title="Why Now">{concept.whyNow}</PaperSection>
          </PaperCard>

          {/* Evidence */}
          {concept.evidenceTrace?.length > 0 && (
            <EvidenceBlock entries={concept.evidenceTrace} storeSlice={storeSlice} />
          )}

          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/55 transition-colors"
          >
            {expanded
              ? <><ChevronUp className="w-3.5 h-3.5" />Show less</>
              : <><ChevronDown className="w-3.5 h-3.5" />Full brief — pricing, GTM, MVP, risks &amp; more</>
            }
          </button>

          {/* ── Extended paper card ── */}
          {expanded && (
            <PaperCard label="Extended Analysis">
              <PaperSection title="Buyer vs User">{concept.buyerVsUser}</PaperSection>
              <PaperSection title="Current Alternatives">{concept.currentAlternatives}</PaperSection>
              <PaperSection title="Existing Workarounds">{concept.existingWorkarounds}</PaperSection>
              <PaperSection title="Key Assumptions">{concept.keyAssumptions}</PaperSection>
              <PaperSection title="Success Metrics">{concept.successMetrics}</PaperSection>
              <PaperSection title="Pricing Hypothesis">{concept.pricingHypothesis ?? concept.revenueModelHypothesis}</PaperSection>
              <PaperSection title="Defensibility">{concept.defensibility}</PaperSection>
              <PaperSection title="Go-to-Market Angle">{concept.goToMarketAngle}</PaperSection>
              <PaperSection title="MVP Scope">{concept.mvpScope}</PaperSection>
              <PaperSection title="Risks">{concept.risks}</PaperSection>
              {concept.implementationPlan && (
                <PaperSection title="Implementation Plan">{concept.implementationPlan}</PaperSection>
              )}
              {concept.roiModel && (
                <>
                  {concept.roiModel.estimatedValueCreation  && <PaperSection title="Value Creation">{concept.roiModel.estimatedValueCreation}</PaperSection>}
                  {concept.roiModel.estimatedCostToBuild     && <PaperSection title="Cost to Build">{concept.roiModel.estimatedCostToBuild}</PaperSection>}
                  {concept.roiModel.estimatedTimeToMvp       && <PaperSection title="Time to MVP">{concept.roiModel.estimatedTimeToMvp}</PaperSection>}
                  {concept.roiModel.revenuePotentialScenarios && <PaperSection title="Revenue Scenarios">{concept.roiModel.revenuePotentialScenarios}</PaperSection>}
                  {concept.roiModel.paybackPeriod             && <PaperSection title="Payback Period">{concept.roiModel.paybackPeriod}</PaperSection>}
                </>
              )}
            </PaperCard>
          )}

        </div>

        {/* ── Footer — pinned, frosted glass ── */}
        <div
          className="flex-shrink-0 px-5 py-4 border-t border-white/[0.07] flex items-center gap-3"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}
        >
          <button
            type="button"
            onClick={() => downloadConceptMd(concept, clusterName)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.10] text-white/55 hover:text-white/80 transition-colors"
          >
            <Download size={13} />
            Download .md
          </button>
          <button
            type="button"
            onClick={handleEnhance}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.75) 0%, rgba(59,130,246,0.75) 100%)' }}
          >
            <Sparkles size={13} />
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

  const allConcepts = (concepts?.length ?? 0) > 0
    ? concepts
    : ((candidates?.length ?? 0) > 0 ? candidates : (concept ? [concept] : []))

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
        <p className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-4">
          {ranked.length} Venture {ranked.length === 1 ? 'Concept' : 'Concepts'} · Ranked by score · Duplicates merged
        </p>

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
