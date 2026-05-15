import type { VentureScopeLLMInput } from '../types.js'

// ─── Ambiguity assessment result ──────────────────────────────────────────────

export interface ConceptAmbiguityResult {
  /** Composite ambiguity level — injected into LLM prompt when medium or high */
  ambiguityLevel:           'low' | 'medium' | 'high'
  /** Human-readable flags explaining the ambiguity */
  ambiguityFlags:           string[]
  /** Terms in the cluster name that are vague or overloaded */
  ambiguousTerms:           string[]
  /**
   * Recommended interpretations to offer the LLM.
   * Populated when needsDisambiguation is true.
   */
  recommendedInterpretations: string[]
  /** True when the LLM prompt should explicitly ask it to pick one interpretation */
  needsDisambiguation:       boolean
}

// ─── Vague term dictionary ────────────────────────────────────────────────────

// Terms that are too broad to drive a specific product direction without
// additional context. When these appear in a cluster name alone, the LLM
// is likely to hallucinate a generic direction.
const VAGUE_TERMS = new Set([
  'workflow', 'process', 'automation', 'tool', 'platform', 'system',
  'solution', 'service', 'management', 'optimization', 'efficiency',
  'productivity', 'intelligence', 'insight', 'data', 'analytics',
  'integration', 'operations', 'infrastructure', 'experience',
  'challenge', 'problem', 'issue', 'gap', 'need', 'friction',
  'improvement', 'enhancement', 'transformation', 'digital',
])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractWords(s: string): string[] {
  return s.toLowerCase().split(/[\s|·\-_,]+/).filter((w) => w.length > 2)
}

function countNonEmpty(arr: string[] | undefined): number {
  return (arr ?? []).filter((s) => s.trim().length > 0).length
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Analyses a VentureScopeLLMInput packet for signals of ambiguity.
 *
 * Returns a ConceptAmbiguityResult that callers inject into the LLM prompt
 * when `ambiguityLevel` is 'medium' or 'high'. The result also populates
 * `ambiguityFlags`, `ambiguousTerms`, and `recommendedInterpretations` so
 * the LLM can be told to explicitly choose an interpretation rather than
 * inventing one.
 *
 * Scoring:
 *   Each flag contributes 1 point to the ambiguity score.
 *   0–1 → low  |  2–3 → medium  |  4+ → high
 */
export function assessConceptAmbiguity(
  input: VentureScopeLLMInput,
): ConceptAmbiguityResult {
  const flags: string[]  = []
  const vague: string[]  = []
  const interps: string[] = []
  let score = 0

  const gc = input.graphContext

  // ── Cluster name quality ───────────────────────────────────────────────────
  const clusterWords = extractWords(input.clusterName)
  const vagueMatches = clusterWords.filter((w) => VAGUE_TERMS.has(w))
  if (vagueMatches.length > 0) {
    vague.push(...vagueMatches)
    flags.push(`Cluster name contains vague terms: ${vagueMatches.join(', ')}`)
    score += vagueMatches.length >= 2 ? 2 : 1
  }
  if (clusterWords.length < 3) {
    flags.push('Cluster name is very short — likely under-specified')
    score++
  }

  // ── Entity sparsity ────────────────────────────────────────────────────────
  const personaCount  = countNonEmpty(gc.personas)
  const workflowCount = countNonEmpty(gc.workflows)

  if (personaCount === 0) {
    flags.push('No personas extracted — target user is unknown')
    score++
    interps.push('Identify the primary role (individual contributor, team lead, or buyer) this cluster most likely serves')
  }
  if (workflowCount === 0) {
    flags.push('No workflows extracted — the broken process is unclear')
    score++
    interps.push('Determine whether this is a discovery workflow, execution workflow, or review/approval workflow')
  }
  if (personaCount === 0 && workflowCount === 0) {
    // Double-flag: missing both core inputs pushes score higher
    flags.push('Both personas and workflows are absent — concept direction is unconstrained')
    score++
    interps.push('Choose the narrowest plausible interpretation: a specific role in a specific process context')
  }

  // ── Evidence thinness ──────────────────────────────────────────────────────
  if (input.evidenceSnippets.length < 2) {
    flags.push('Fewer than 2 evidence snippets — claims will be lightly grounded')
    score++
    interps.push('Constrain solution scope to what can be directly inferred from available evidence; flag assumptions explicitly')
  }

  // ── Workaround absence (no incumbent = harder to define gap) ──────────────
  if (countNonEmpty(gc.workarounds) === 0 && countNonEmpty(gc.existingSolutions) === 0) {
    flags.push('No workarounds or existing solutions identified — competitive landscape unknown')
    score++
    interps.push('Default to a "greenfield" framing: describe what first-principles problem this solves rather than what it replaces')
  }

  // ── Ambiguity level ────────────────────────────────────────────────────────
  const ambiguityLevel: 'low' | 'medium' | 'high' =
    score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low'

  return {
    ambiguityLevel,
    ambiguityFlags: flags,
    ambiguousTerms: vague,
    recommendedInterpretations: interps,
    needsDisambiguation: ambiguityLevel !== 'low',
  }
}
