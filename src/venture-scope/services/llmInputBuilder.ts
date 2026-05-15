import type { OpportunityCluster, DimensionScores, CorpusSourceType } from '../../opportunity-radar/types.js'
import type { OpportunityFrame, VentureScopeLLMInput } from '../types.js'

// ── Corpus source type validation ─────────────────────────────────────────────

const CORPUS_SOURCE_TYPES = new Set<string>(['save', 'document', 'manual_content', 'topic_summary', 'brief'])

// ── Angle descriptions ────────────────────────────────────────────────────────

const ANGLE_DESCRIPTIONS: Record<
  'persona_first' | 'workflow_first' | 'technology_enablement',
  string
> = {
  persona_first:
    'Persona-First — who has this problem, what breaks in their workflow, and what workaround they use instead of a real tool',
  workflow_first:
    'Workflow-First — what process is broken, where it specifically fails, and why existing tools miss this exact step',
  technology_enablement:
    'Technology-Enablement — what new capability makes this tractable now and why tools built before it cannot catch up',
}

// ── Score summary builder ─────────────────────────────────────────────────────

function scoreLine(label: string, score: number, threshold = 55): string | null {
  if (!Number.isFinite(score) || score < threshold) return null
  const tier = score >= 80 ? 'Very high' : score >= 65 ? 'High' : 'Moderate'
  return `${tier} ${label} (${score}/100)`
}

function buildScoreSummary(cluster: OpportunityCluster): string[] {
  const dim: DimensionScores | undefined = cluster.dimensionScores
  if (!dim) return []

  const candidates: Array<string | null> = [
    scoreLine('pain severity', dim.painSeverity, 55),
    scoreLine('frequency', dim.frequency, 55),
    scoreLine('urgency', dim.urgency, 55),
    scoreLine('willingness-to-pay', dim.willingnessToPay, 55),
    scoreLine('market breadth', dim.marketBreadth, 55),
    scoreLine('poor solution fit / gap', dim.poorSolutionFit, 55),
    scoreLine('feasibility', dim.feasibility, 55),
    scoreLine('why-now timing', dim.whyNow, 55),
    scoreLine('defensibility potential', dim.defensibility, 55),
    scoreLine('go-to-market clarity', dim.gtmClarity, 55),
  ]

  const lines = candidates.filter((l): l is string => l !== null)
  if (cluster.isBuildable) lines.push('Buildability gate: PASSED')
  return lines
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Safe top-N entity value extractor. Returns empty array on undefined/empty input. */
function topN(entities: Array<{ value: string }> | undefined, n: number): string[] {
  return (entities ?? []).slice(0, n).map((e) => e.value)
}

export function buildVentureScopeLLMInput(
  cluster: OpportunityCluster,
  frame: OpportunityFrame,
  coreWedge: string,
  angleType: 'persona_first' | 'workflow_first' | 'technology_enablement',
): VentureScopeLLMInput {
  const evidenceSnippets = frame.signals
    .filter((s): s is typeof s & { corpusSourceId: string; corpusSourceType: CorpusSourceType } =>
      Boolean(s.corpusSourceId) &&
      s.corpusSourceType != null &&
      CORPUS_SOURCE_TYPES.has(s.corpusSourceType) &&
      s.painText.length > 30
    )
    .sort((a, b) => b.intensityScore - a.intensityScore)
    .slice(0, 5)
    .map((s) => ({
      text:       s.painText.slice(0, 200),
      sourceType: s.corpusSourceType,
    }))

  return {
    clusterName:      cluster.clusterName,
    angleType,
    angleDescription: ANGLE_DESCRIPTIONS[angleType],
    coreWedge,
    opportunityScore: cluster.opportunityScore ?? 0,
    isBuildable:      cluster.isBuildable,
    scoreSummary:     buildScoreSummary(cluster),
    graphContext: {
      personas:          topN(frame.personas, 3),
      workflows:         topN(frame.workflows, 3),
      workarounds:       topN(frame.workarounds, 3),
      bottlenecks:       topN(frame.bottlenecks, 2),
      existingSolutions: topN(frame.existingSolutions, 2),
      emergingTech:      topN([...frame.emergingTech, ...frame.platformShifts], 3),
      industries:        topN(frame.industries, 2),
      technologies:      topN(frame.technologies, 3),
    },
    evidenceSnippets,
  }
}
