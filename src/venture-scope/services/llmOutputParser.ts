import type { VentureScopeLLMInput, VentureScopeLLMOutput } from '../types.js'

// ── Required output fields ────────────────────────────────────────────────────

// Exhaustiveness guard: TypeScript will error if any field is added to
// VentureScopeLLMOutput but not listed here — keeps parser in sync with the type.
const _FIELDS_EXHAUSTIVE: { [K in keyof VentureScopeLLMOutput]: true } = {
  title: true, tagline: true, opportunitySummary: true, problemStatement: true,
  targetUser: true, proposedSolution: true, valueProp: true, whyNow: true,
  buyerVsUser: true, currentAlternatives: true, existingWorkarounds: true,
  keyAssumptions: true, successMetrics: true, pricingHypothesis: true,
  defensibility: true, goToMarketAngle: true, mvpScope: true, risks: true,
}
const REQUIRED_FIELDS = Object.keys(_FIELDS_EXHAUSTIVE) as Array<keyof VentureScopeLLMOutput>

// Core fields — any missing field triggers immediate rejection.
// These form the identity of the brief and cannot be synthesised deterministically.
const CORE_FIELDS: ReadonlyArray<keyof VentureScopeLLMOutput> = [
  'title', 'tagline', 'opportunitySummary', 'problemStatement',
  'targetUser', 'proposedSolution', 'valueProp', 'whyNow',
]

// Supplementary fields — small local models (llama3.2:3b) sometimes truncate
// JSON output before reaching these tail fields. If ≤ 3 are missing they get
// a placeholder rather than rejecting the whole output. If > 3 are missing the
// model didn't follow the schema at all and the output is discarded.
const SUPPLEMENTARY_FIELDS: ReadonlyArray<keyof VentureScopeLLMOutput> = [
  'buyerVsUser', 'currentAlternatives', 'existingWorkarounds',
  'keyAssumptions', 'successMetrics', 'pricingHypothesis',
  'defensibility', 'goToMarketAngle', 'mvpScope', 'risks',
]
const SUPPLEMENTARY_FALLBACK = '—'

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Structural validation of a raw chatJson() response.
 *
 * Core fields (title, tagline, opportunitySummary, problemStatement, targetUser,
 * proposedSolution, valueProp, whyNow) must all be present and non-empty — any
 * missing core field returns null immediately.
 *
 * Supplementary fields (buyerVsUser, currentAlternatives, existingWorkarounds,
 * keyAssumptions, successMetrics, pricingHypothesis, defensibility,
 * goToMarketAngle, mvpScope, risks) tolerate up to 3 missing values: missing
 * ones are filled with a "—" placeholder and a warning is logged. More than 3
 * missing supplementary fields indicates the model ignored the schema — returns null.
 *
 * Content-level validation is handled separately by validateLLMOutput().
 */
export function parseVentureScopeLLMOutput(
  raw: unknown,
): VentureScopeLLMOutput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const obj = raw as Record<string, unknown>

  // Core fields — hard reject if any are missing
  for (const field of CORE_FIELDS) {
    const val = obj[field]
    if (typeof val !== 'string' || val.trim().length === 0) {
      console.warn('[VS-LLM] parseVentureScopeLLMOutput: missing core field:', field)
      return null
    }
  }

  // Supplementary fields — fill with placeholder if missing (tolerate up to 3)
  let supplementaryMissing = 0
  for (const field of SUPPLEMENTARY_FIELDS) {
    const val = obj[field]
    if (typeof val !== 'string' || val.trim().length === 0) {
      console.warn('[VS-LLM] parseVentureScopeLLMOutput: missing supplementary field (using fallback):', field)
      obj[field] = SUPPLEMENTARY_FALLBACK
      supplementaryMissing++
    }
  }
  if (supplementaryMissing > 3) {
    console.warn('[VS-LLM] parseVentureScopeLLMOutput: too many missing supplementary fields:', supplementaryMissing, '— model likely ignored schema')
    return null
  }

  // All required fields present (or patched) — cast is safe
  return obj as unknown as VentureScopeLLMOutput
}

/** Prefix used by generateWithOllamaFrame to detect ID-leak warnings without string coupling. */
export const ID_LEAK_WARNING_PREFIX = 'Internal cluster ID'

// ── Validator ─────────────────────────────────────────────────────────────────

// Phrases that indicate the model drifted into generic AI-hype territory
const FILLER_PATTERNS: RegExp[] = [
  /\bAI (can|will|could) solve\b/i,
  /\bleverage (cutting[- ]edge|advanced AI|machine learning|AI)\b/i,
  /\bcutting[- ]edge (AI|technology|ML)\b/i,
  /\binnovative (AI|solution|technology)\b/i,
  /\bstate[- ]of[- ]the[- ]art\b/i,
  /\bseamlessly integrat/i,
  /\brobust (solution|platform|system)\b/i,
]

// Internal cluster ID patterns should never appear in narrative output.
// Note: can false-positive on legitimate phrases like "cluster_based_approach" —
// acceptable trade-off given the pattern requires "cluster_" + 6+ alphanumeric chars.
const ID_PATTERN = /cluster_[a-z0-9_]{6,}/i

// Narrative fields long enough to be meaningful checks
const NARRATIVE_FIELDS: ReadonlyArray<keyof VentureScopeLLMOutput> = [
  'opportunitySummary', 'problemStatement', 'proposedSolution',
  'valueProp', 'whyNow', 'defensibility', 'goToMarketAngle',
  'risks', 'mvpScope', 'keyAssumptions',
]

/**
 * Content-level validation of a parsed LLM output against its input context.
 * Returns a list of warning strings (empty array = clean).
 * Callers log warnings. ID-leak warnings are unconditional hard rejects.
 * If total count >= 4 the output is discarded and the deterministic fallback
 * is used instead.
 */
export function validateLLMOutput(
  output: VentureScopeLLMOutput,
  _input: VentureScopeLLMInput,
): string[] {
  const warnings: string[] = []

  // Filler phrase detection — scan all narrative fields
  for (const field of NARRATIVE_FIELDS) {
    const text = output[field]
    for (const pattern of FILLER_PATTERNS) {
      if (pattern.test(text)) {
        warnings.push(`Filler phrase in "${field}" — matched: ${pattern.source}`)
        break  // one warning per field, avoid duplicate entries
      }
    }
  }

  // Internal ID leak check — cluster IDs must never appear in narrative text
  const allText = REQUIRED_FIELDS.map((f) => output[f]).join('\n')
  if (ID_PATTERN.test(allText)) {
    warnings.push(`${ID_LEAK_WARNING_PREFIX} pattern detected in output — possible prompt injection`)
  }

  // Minimum length sanity — suspiciously short narrative = likely truncated output
  for (const field of NARRATIVE_FIELDS) {
    const trimmed = output[field].trim()
    if (trimmed.length < 30) {
      warnings.push(
        `Field "${field}" is suspiciously short (${trimmed.length} chars) — likely truncated`,
      )
    }
  }

  return warnings
}
