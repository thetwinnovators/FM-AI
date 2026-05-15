import type { VentureScopeLLMInput, VentureScopeLLMOutput } from '../types.js'

// ── Required output fields ────────────────────────────────────────────────────

const REQUIRED_FIELDS: ReadonlyArray<keyof VentureScopeLLMOutput> = [
  'title', 'tagline', 'opportunitySummary', 'problemStatement',
  'targetUser', 'proposedSolution', 'valueProp', 'whyNow',
  'buyerVsUser', 'currentAlternatives', 'existingWorkarounds',
  'keyAssumptions', 'successMetrics', 'pricingHypothesis',
  'defensibility', 'goToMarketAngle', 'mvpScope', 'risks',
]

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Structural validation of a raw chatJson() response.
 * Returns null if any required field is missing or is not a non-empty string.
 * Content-level validation is handled separately by validateLLMOutput().
 */
export function parseVentureScopeLLMOutput(
  raw: unknown,
): VentureScopeLLMOutput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const obj = raw as Record<string, unknown>

  for (const field of REQUIRED_FIELDS) {
    const val = obj[field]
    if (typeof val !== 'string' || val.trim().length === 0) {
      console.warn('[VS-LLM] parseVentureScopeLLMOutput: missing or empty field:', field)
      return null
    }
  }

  // All fields present and non-empty — cast is safe
  return obj as unknown as VentureScopeLLMOutput
}

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

// Internal cluster ID patterns should never appear in narrative output
const ID_PATTERN = /cluster_[a-z0-9_]{6,}/i

// Narrative fields long enough to be meaningful checks
const NARRATIVE_FIELDS: ReadonlyArray<keyof VentureScopeLLMOutput> = [
  'opportunitySummary', 'problemStatement', 'proposedSolution',
  'valueProp', 'whyNow', 'defensibility', 'goToMarketAngle',
]

/**
 * Content-level validation of a parsed LLM output against its input context.
 * Returns a list of warning strings (empty array = clean).
 * Callers log warnings; if count >= 3 the output is discarded and the
 * deterministic fallback is used instead.
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
    warnings.push('Internal cluster ID pattern detected in output — possible prompt injection')
  }

  // Minimum length sanity — suspiciously short narrative = likely truncated output
  for (const field of NARRATIVE_FIELDS) {
    if (output[field].trim().length < 30) {
      warnings.push(
        `Field "${field}" is suspiciously short (${output[field].length} chars) — likely truncated`,
      )
    }
  }

  return warnings
}
