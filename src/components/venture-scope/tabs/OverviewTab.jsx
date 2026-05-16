import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Sparkles, ArrowRight } from 'lucide-react'
import { openChatWithMessage } from '../../../lib/chatPanelState.js'
import ConfidenceBadge from '../ConfidenceBadge.jsx'
import DimensionScoreGrid from '../DimensionScoreGrid.jsx'
import { buildScoreExplanations } from '../../../opportunity-radar/services/opportunityScorer.js'
import { formatClusterName } from '../../../venture-scope/utils/formatClusterName.js'

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

// ── Title derivation — builds a descriptive, human-readable title ─────────────

const ACRONYM_SET = new Set(['ai', 'ml', 'api', 'saas', 'b2b', 'b2c', 'crm', 'erp', 'llm', 'ui', 'ux'])

function fmtWord(w) {
  const lower = w.toLowerCase()
  return ACRONYM_SET.has(lower) ? lower.toUpperCase() : lower.charAt(0).toUpperCase() + lower.slice(1)
}

function fmtPhrase(s) {
  return s ? s.split(/\s+/).map(fmtWord).join(' ') : ''
}

function deriveOpportunityTitle(cluster, concept) {
  if (concept?.title) return concept.title

  const es = cluster.entitySummary
  if (es) {
    const p  = es.personas?.[0]
    const w  = es.workflows?.[0]
    const wr = es.workarounds?.[0]
    const em = es.emergingTech?.[0]
    const bn = es.bottlenecks?.[0]
    const ind = es.industries?.[0]

    if (w && em)  return `${fmtPhrase(em)}-Powered ${fmtPhrase(w)}`
    if (w && bn)  return `${fmtPhrase(w)}: Eliminating ${fmtPhrase(bn)}`
    if (w && wr)  return `${fmtPhrase(w)} Without ${fmtPhrase(wr)}`
    if (w && p)   return `${fmtPhrase(w)} for ${fmtPhrase(p)}s`
    if (w && ind) return `${fmtPhrase(w)} in ${fmtPhrase(ind)}`
    if (p && wr)  return `${fmtPhrase(p)} — Replace ${fmtPhrase(wr)}`
    if (p && em)  return `${fmtPhrase(em)} for ${fmtPhrase(p)}s`
    if (w)        return fmtPhrase(w)
    if (p)        return fmtPhrase(p)
  }

  return formatClusterName(cluster.clusterName)
}

// ── Prompt builder for FLOW.AI chat enhancement ───────────────────────────────

// ── Persistent synthesis contract — read by FLOW.AI before every enhancement ──
// This contract enforces modality-first classification, evidence grounding,
// score protection, and anti-generic-AI bias across all chat interactions.
const FLOW_AI_SYSTEM = `You are FLOW.AI, an opportunity synthesis engine built into FlowMap.

GUARDRAILS — apply before generating anything:

1. GROUND EVERY CLAIM. Every statement in your output must be traceable to the provided evidence snippets and entity context. If the evidence does not directly support a claim, prefix it with "Assumption:". Do not invent personas, workflows, or technologies absent from the input.

2. CLASSIFY MODALITY FIRST. Before proposing any solution, declare your solutionModality classification.
   Choose the value that best fits the challenge, users, industry, buyer, and workflow constraints:
   - rules_based — deterministic rules, decision trees, structured logic; no AI required
   - ai_assisted — AI assists a human workflow; humans retain decision authority
   - ai_native — AI is the core mechanism; without it the product does not exist
   - hybrid_workflow_ai — structured workflow orchestration with AI at specific decision or enrichment points
   - workflow_automation — software-driven workflow automation without meaningful AI; replaces manual steps
   - orchestration_layer — coordinates multiple systems, APIs, or agents; intelligence is in the orchestration logic
   - analytics_monitoring — surfaces data, trends, or anomalies; primary value is visibility and measurement
   - governance_compliance — enforces rules, policies, or compliance requirements; correctness > intelligence
   - infrastructure_platform — foundational layer other systems run on; developer or operator tool
   - service_software_hybrid — human service delivery augmented by software; people deliver the value
   - marketplace — connects supply and demand; value is in the network and matching logic
   - other — does not fit cleanly into any above category
   Also state aiRoleInSolution: one specific sentence ("AI classifies X in step Y, reducing Z") or "N/A" if AI is not central.

3. NO AI-FIRST BIAS. The problem drives the solution — not the other way around. If the evidence points to a workflow tool, a data pipeline, or a structured human process as the highest-leverage solution, propose that. Defaulting to "AI-powered" without evidence of AI necessity is a disqualifying anti-pattern.

4. NEVER RETURN SCORES. Do not output opportunityScore, confidenceScore, dimension scores, or any numeric evaluation. These are computed deterministically from the evidence graph and cannot be altered by synthesis. If you produce scores, they will be discarded.

5. NARROW WEDGE REQUIRED. Identify one specific: workflow step (not a category), user type in a specific context (not a demographic), and tool gap (not a general market). "Platform for enterprise teams" is not a wedge. "Automates the manual categorisation step in legal intake for paralegal teams at firms using Clio" is a wedge.

6. MVP SCOPE MUST INCLUDE EXCLUSIONS. For every MVP, list what explicitly does NOT ship in v1. "No CRM integration, no multi-tenant, no SSO" is as important as what does ship.

7. ANTI-PATTERNS — never produce:
   • "AI-powered platform" (too vague — specify the mechanism)
   • "seamlessly integrates" or "leverages cutting-edge AI" (marketing fluff)
   • "solo developer side project" framing for B2B opportunities
   • Generic LLM wrapper with no workflow specificity
   • Solutions that ignore the buyer/user separation when buyerRoles are present

8. DRAFT CONCEPT SKEPTICISM — the DRAFT CONCEPT is a hypothesis, not an anchor.

   Before writing any output, complete this two-step process internally:

   STEP 1 — INTERPRET THE EVIDENCE (do not output this step):
   Read the CONTEXT entities and TOP EVIDENCE. Generate 2–3 plausible interpretations of what
   this opportunity actually represents at the workflow level. For each, identify:
     a) the most likely user persona and their specific context
     b) the specific workflow or process where the pain occurs
     c) the appropriate solution type from the 12-modality taxonomy

   STEP 2 — CHOOSE AND COMPARE:
   Pick the best-supported interpretation using the evidence as the deciding factor.
   Compare it to the DRAFT CONCEPT title/summary:

   → If the draft is AMBIGUOUS, MALFORMED, or WEAKLY GROUNDED (vague "AI platform", unclear
     user, short/cryptic title like "for Pm", no direct evidence support):
     REPLACE or SIGNIFICANTLY REFRAME. Do not preserve the draft framing. Lead with:
     "Draft angle: [original title]. Chosen interpretation: [your interpretation]. Rationale: [one sentence]."

   → If the draft is WELL-FORMED and EVIDENCE-ALIGNED:
     REFINE it. Lead with: "Chosen interpretation aligns with draft: [one sentence confirming]."

   The venture brief must be built from your CHOSEN INTERPRETATION — not the draft title.

   Always output:
   • chosenInterpretation: one sentence — the specific workflow-level opportunity you are addressing
   • alternateInterpretations: brief notes on the 1–2 alternatives you considered
     (format for each: "user type | workflow context | solution modality")`

function buildEnhancePrompt(cluster, concept, signals) {
  const es  = cluster.entitySummary
  const dim = cluster.dimensionScores
  // FLOW_AI_SYSTEM is passed separately via openChatWithMessage systemOverride —
  // NOT embedded here. Embedding it causes QuickChatLauncher to build a competing
  // FlowMap system prompt, giving the model two conflicting instruction sets.
  const lines = [
    `OPPORTUNITY: ${deriveOpportunityTitle(cluster, concept)}`,
    `Score: ${cluster.opportunityScore ?? '—'}/100  ·  ${cluster.signalCount ?? 0} signals  ·  ${cluster.sourceDiversity ?? 0} source types`,
    '',
  ]

  if (es) {
    const addList = (label, items) => {
      if (items?.length) lines.push(`${label}: ${items.slice(0, 6).join(', ')}`)
    }
    lines.push('CONTEXT:')
    addList('Personas',           es.personas)
    addList('Workflows',          es.workflows)
    addList('Bottlenecks',        es.bottlenecks)
    addList('Workarounds',        es.workarounds)
    addList('Existing Solutions', es.existingSolutions)
    addList('Technologies',       es.technologies)
    addList('Emerging Tech',      es.emergingTech)
    addList('Platform Shifts',    es.platformShifts)
    addList('Buyer Roles',        es.buyerRoles)
    addList('Industries',         es.industries)
    lines.push('')
  }

  if (dim) {
    lines.push('DIMENSION SCORES (out of 10):')
    const entries = [
      ['Pain Severity',      dim.painSeverity],
      ['Frequency',          dim.frequency],
      ['Urgency',            dim.urgency],
      ['Willingness to Pay', dim.willingnessToPay],
      ['Market Breadth',     dim.marketBreadth],
      ['Weak Solution Fit',  dim.poorSolutionFit],
      ['Feasibility',        dim.feasibility],
      ['Why Now',            dim.whyNow],
      ['Defensibility',      dim.defensibility],
      ['GTM Clarity',        dim.gtmClarity],
    ]
    for (const [label, val] of entries) {
      if (val != null) lines.push(`  ${label}: ${val}/10`)
    }
    lines.push('')
  }

  const clusterSignals = (signals ?? [])
    .filter((s) => cluster.signalIds?.includes(s.id))
    .sort((a, b) => (b.intensityScore ?? 0) - (a.intensityScore ?? 0))
    .slice(0, 5)

  if (clusterSignals.length) {
    lines.push('TOP EVIDENCE:')
    for (const s of clusterSignals) {
      const text = (s.painPoint ?? s.rawText ?? s.content ?? '').slice(0, 140)
      if (text) lines.push(`  • "${text}"`)
    }
    lines.push('')
  }

  if (concept) {
    // Label the draft with a quality signal so FLOW.AI knows whether to preserve,
    // refine, or replace it. Concept's ambiguityLevel is set by assessConceptAmbiguity()
    // in llmInputBuilder; for older concepts without it, fall back to a title heuristic.
    const draftQualityLabel = (() => {
      const al = concept.ambiguityLevel
      if (al === 'high') {
        return 'DRAFT CONCEPT [HIGH AMBIGUITY — treat as tentative hypothesis; replace or reframe if evidence supports a stronger interpretation]'
      }
      if (al === 'medium') {
        return 'DRAFT CONCEPT [MODERATE AMBIGUITY — may reframe if evidence suggests a clearer interpretation]'
      }
      if (al === 'low') {
        return 'DRAFT CONCEPT [WELL-FORMED — refine only; do not replace unless evidence clearly contradicts]'
      }
      // No prior ambiguity assessment — apply quick title heuristic
      const title = (concept.title ?? '').toLowerCase()
      const isLikelyVague = /\bfor pm\b|\bpm'?s?\b|\bai platform\b|\bai tool\b|\bai app\b|\bai solution\b/.test(title)
        || title.split(' ').length <= 2
      return isLikelyVague
        ? 'DRAFT CONCEPT [VAGUE FRAMING DETECTED — treat as tentative; replace or reframe if evidence supports a better interpretation]'
        : 'DRAFT CONCEPT [no ambiguity assessment — treat as tentative hypothesis]'
    })()

    lines.push(draftQualityLabel + ':')
    if (concept.title)              lines.push(`  Title: ${concept.title}`)
    if (concept.tagline)            lines.push(`  Tagline: ${concept.tagline}`)
    if (concept.opportunitySummary) lines.push(`  Summary: ${concept.opportunitySummary}`)
    lines.push('')
  }

  return lines.join('\n')
}

// ── EntityRow — compact chips for persona / workflow evidence ─────────────────

function EntityRow({ label, items, accent }) {
  if (!items?.length) return null
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="text-xs text-white/30 shrink-0 pt-0.5 w-20">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 6).map((item) => (
          <span
            key={item}
            className="px-2 py-0.5 rounded-full text-xs bg-white/5 border border-white/8 capitalize"
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
  onEnhance,
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
            <p className="text-xs font-medium uppercase tracking-wide text-white/30 mb-1">Opportunity</p>
            <h2 className="text-base font-bold text-white/90 leading-snug">
              {formatClusterName(cluster.clusterName)}
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
                <div className="text-xs font-semibold uppercase tracking-wide text-white/30 mb-1">Score</div>
                <div className="text-[22px] font-bold font-mono leading-none" style={{ color: 'var(--color-topic)' }}>
                  {cluster.opportunityScore ?? '—'}
                </div>
                <div className="text-xs text-white/25 mt-0.5">/ 100</div>
              </div>
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/30 mb-1">Signals</div>
                <div className="text-[22px] font-bold font-mono leading-none text-white/80">
                  {cluster.signalCount ?? 0}
                </div>
                <div className="text-xs text-white/25 mt-0.5">data points</div>
              </div>
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/30 mb-1">Sources</div>
                <div className="text-[22px] font-bold font-mono leading-none text-white/80">
                  {cluster.sourceDiversity ?? 0}
                </div>
                <div className="text-xs text-white/25 mt-0.5">types</div>
              </div>
              <div className="px-4 pt-3.5 pb-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-white/30 mb-1">Buildable</div>
                <div
                  className="text-base font-bold font-mono leading-none mt-1"
                  style={{ color: cluster.isBuildable !== false ? 'rgba(52,211,153,0.9)' : 'rgba(255,255,255,0.3)' }}
                >
                  {cluster.isBuildable !== false ? 'Yes' : 'No'}
                </div>
                <div className="text-xs text-white/25 mt-0.5">
                  {cluster.inferredCategory ?? 'opportunity'}
                </div>
              </div>
            </div>
          </div>

          {/* Entity evidence chips */}
          {hasEntities && (
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
              <p className="text-xs font-medium uppercase tracking-wide text-white/25 mb-1">
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
              <p className="text-xs font-medium uppercase tracking-wide text-white/25 mb-3">
                Dimension breakdown
              </p>
              <DimensionScoreGrid
                dimensionScores={dim}
                explanations={explanations}
                drivers={cluster.dimensionDrivers}
              />
            </div>
          ) : (
            <p className="text-xs text-white/30">
              Score dimensions not yet computed — re-run a scan.
            </p>
          )}

          {/* Linked concept preview — if generated */}
          {concept && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
              <p className="text-xs font-medium uppercase tracking-wide text-white/25 mb-1.5">
                Generated concept
              </p>
              <p className="text-sm font-semibold text-white/85">{concept.title}</p>
              {concept.tagline && (
                <p className="text-sm text-white/40 mt-0.5 leading-relaxed">{concept.tagline}</p>
              )}
            </div>
          )}

        </div>

        {/* ── Footer — frosted glass, pinned ── */}
        <div
          className="flex-shrink-0 px-5 py-4 border-t border-white/[0.07] flex items-center justify-between gap-3"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-center gap-3">
            {concept ? (
              <button
                type="button"
                onClick={onViewBrief}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: 'var(--color-creator)' }}
              >
                View concept brief →
              </button>
            ) : (
              <button
                type="button"
                onClick={onGenerate}
                disabled={isGenerating || !canGenerate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-white/[0.12] bg-white/[0.05] hover:bg-white/[0.10] text-white/55 hover:text-white/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles size={13} />
                {isGenerating ? 'Generating…' : 'Generate venture concept'}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onEnhance}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors
              bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/16
              text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          >
            <Sparkles size={11} />
            Enhance with Flow.AI
          </button>
        </div>

      </div>
    </div>,
    document.body,
  )
}

// ── Opportunity card (top 3) ──────────────────────────────────────────────────

function OpportunityCard({
  cluster, rank, concept, hasGenerated,
  isSelected,
  onOpenDetail, onEnhance, onViewBrief,
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
          <span className="text-xs font-mono text-[color:var(--color-text-tertiary)]">#{rank}</span>
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-bold font-mono leading-none text-[color:var(--color-text-primary)]">
              {cluster.opportunityScore ?? '—'}
            </span>
            <span className="text-xs text-[color:var(--color-text-tertiary)]">/100</span>
          </div>
        </div>

        {/* Name */}
        <h3 className="text-sm font-semibold leading-snug mb-3 group-hover:text-white transition-colors">
          {deriveOpportunityTitle(cluster, concept)}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[color:var(--color-text-tertiary)]">
            {cluster.signalCount ?? 0} signals
          </span>
          {cluster.sourceDiversity > 0 && (
            <>
              <span className="text-[color:var(--color-border-subtle)]">·</span>
              <span className="text-xs text-[color:var(--color-text-tertiary)]">
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
          <p className="mt-3 text-xs text-[color:var(--color-text-secondary)] leading-relaxed line-clamp-2">
            {concept.tagline ?? (concept.opportunitySummary ?? '').slice(0, 90) + '…'}
          </p>
        )}
      </button>

      {/* Action footer */}
      <div className="px-4 py-3 border-t border-white/6 shrink-0 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onEnhance}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors
            bg-white/5 border-white/10
            hover:bg-white/10 hover:border-white/16
            text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
        >
          <Sparkles size={11} />
          Enhance with Flow.AI
        </button>
        {hasGenerated && (
          <button
            type="button"
            onClick={onViewBrief}
            className="text-xs font-medium flex items-center gap-1 transition-opacity hover:opacity-80 shrink-0"
            style={{ color: 'var(--color-creator)' }}
          >
            Brief <ArrowRight size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Compact row (rank 4+) ─────────────────────────────────────────────────────

function CompactRow({
  cluster, rank, hasGenerated,
  isSelected,
  onOpenDetail, onEnhance, onViewBrief,
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-2.5 transition-colors',
        isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.025]',
      ].join(' ')}
    >
      {/* Rank */}
      <span className="text-xs font-mono text-[color:var(--color-text-tertiary)] w-5 shrink-0 text-right">
        {rank}
      </span>

      {/* Name + metadata — click opens detail modal */}
      <button
        type="button"
        onClick={onOpenDetail}
        className="flex-1 min-w-0 text-left group flex items-center gap-3"
      >
        <span className="text-sm font-medium truncate group-hover:text-white transition-colors flex-1 min-w-0">
          {deriveOpportunityTitle(cluster, null)}
        </span>
        <span className="text-xs text-[color:var(--color-text-tertiary)] shrink-0">
          {cluster.signalCount ?? 0} signals
        </span>
        <span className="text-sm font-mono font-medium text-[color:var(--color-text-secondary)] shrink-0">
          {cluster.opportunityScore ?? '—'}
        </span>
      </button>

      {/* CTA */}
      <div className="shrink-0 flex items-center gap-2">
        {hasGenerated && (
          <button
            type="button"
            onClick={onViewBrief}
            className="text-xs font-medium transition-opacity hover:opacity-75"
            style={{ color: 'var(--color-creator)' }}
          >
            Brief →
          </button>
        )}
        <button
          type="button"
          onClick={onEnhance}
          className="text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 transition-colors
            bg-white/5 border-white/8
            hover:bg-white/10 hover:border-white/14
            text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)]"
          title="Enhance with Flow.AI"
        >
          <Sparkles size={10} />
          Enhance
        </button>
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

  const handleEnhanceWithAI = (clusterId) => {
    const cluster = sorted.find((c) => c.id === clusterId)
    if (!cluster) return
    const concept = getTopConcept(clusterId)
    const prompt = buildEnhancePrompt(cluster, concept, signals)
    openChatWithMessage(prompt, concept ? {
      conceptId: concept.id,
      clusterId: cluster.id,
      displayName: deriveOpportunityTitle(cluster, concept),
    } : null, FLOW_AI_SYSTEM)
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
        <div className="flex items-center gap-3 text-xs text-[color:var(--color-text-tertiary)] flex-wrap">
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
            <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)] mb-3">
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
                    onOpenDetail={() => { onSelectCluster?.(cluster.id); setActiveClusterId(cluster.id) }}
                    onEnhance={() => handleEnhanceWithAI(cluster.id)}
                    onViewBrief={() => handleViewBrief(cluster.id)}
                  />
              ))}
            </div>
          </div>
        )}

        {/* Remaining opportunities — compact rows */}
        {rest.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)] mb-3">
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
                  onOpenDetail={() => { onSelectCluster?.(cluster.id); setActiveClusterId(cluster.id) }}
                  onEnhance={() => handleEnhanceWithAI(cluster.id)}
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
          onEnhance={() => {
            const prompt = buildEnhancePrompt(activeCluster, activeConcept, signals)
            openChatWithMessage(prompt, activeConcept ? {
              conceptId: activeConcept.id,
              clusterId: activeCluster.id,
              displayName: deriveOpportunityTitle(activeCluster, activeConcept),
            } : null, FLOW_AI_SYSTEM)
            setActiveClusterId(null)
          }}
        />
      )}
    </>
  )
}
