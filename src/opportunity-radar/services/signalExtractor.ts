import type { PainSignal, PainType, SignalEntity } from '../types.js'
import { normalizeText, extractKeyTerms } from './normalizationService.js'
import { extractEntities } from './entityExtractor.js'

// ── Social-media intensity scoring ───────────────────────────────────────────
// Used for non-corpus signals (Reddit, HN, forums). Measures emotional weight,
// urgency language, explicit workarounds, and financial pain. Score 0–10.

function scoreIntensity(text: string): number {
  let score = 0

  // Emotional markers — complaint language signals high friction
  const emotionalRegex = /nightmare|gave up|terrible|hate|broken|awful|frustrated|annoying/gi
  const emotionalMatches = (text.match(emotionalRegex) ?? []).length
  score += Math.min(3, emotionalMatches)

  // Urgency markers — repeated daily pain signals
  const urgencyRegex = /every day|constantly|always|waste hours|every time|all the time/gi
  const urgencyMatches = (text.match(urgencyRegex) ?? []).length
  score += Math.min(3, urgencyMatches)

  // Workaround language — explicit gap evidence
  if (/i built|three tools|manual process|script|workaround|built a/i.test(text)) score += 2

  // Financial pain — willingness-to-pay signal
  if (/too expensive|can't afford|wasted hours|lost money|overpriced/i.test(text)) score += 2

  return Math.min(10, score)
}

// ── Corpus intensity scoring ─────────────────────────────────────────────────
// Curated research content (saves, documents, topic summaries, briefs) uses
// analytical problem framing — not emotional complaint language. Measuring
// emotional keywords here produces near-zero scores for valuable content.
//
// Instead: VENTURE SIGNAL DENSITY — how richly does this item document the
// problem space? Measured by entity count, problem vocabulary presence, and
// explicit workaround / gap language. Score 0–10.

const CORPUS_PROBLEM_VOCAB_RE = /\b(?:challenge|friction|pain\s+point|inefficien\w+|gap|missing|lack(?:ing|s)?|barrier|obstacle|bottleneck|struggle\w*|difficulty|hard\s+to|unable\s+to)\b/gi
const CORPUS_WORKAROUND_RE    = /\b(?:workaround|manually|spreadsheet|by\s+hand|copy.?paste|cobbled|resort\s+to|end\s+up|have\s+to|had\s+to|script|kludge|duct.?tape)\b/gi
const CORPUS_URGENCY_RE       = /\b(?:critical|urgent|pressing|essential|imperative|required|key\s+challenge|significant\s+gap|growing\s+need|increasingly)\b/i

function scoreIntensityCorpus(text: string, entityCount: number): number {
  let score = 0

  // Entity density — more extracted entities = richer venture-signal document (0–4 pts).
  // entityCount is the length of the deduplicated entity array from extractEntities().
  // 2 entities → 1 pt; 4 entities → 2 pts; 6 → 3 pts; 8+ → 4 pts (cap).
  score += Math.min(4, Math.floor(entityCount / 2))

  // Explicit problem / gap vocabulary (0–3 pts)
  const problemMatches = (text.match(CORPUS_PROBLEM_VOCAB_RE) ?? []).length
  score += Math.min(3, problemMatches)

  // Workaround or gap-bridge language — highest-value venture signal (0–2 pts)
  const workaroundMatches = (text.match(CORPUS_WORKAROUND_RE) ?? []).length
  score += Math.min(2, workaroundMatches)

  // Urgency / importance framing in research context (0–1 pt)
  if (CORPUS_URGENCY_RE.test(text)) score += 1

  return Math.min(10, score)
}

// ── Pain type classification ──────────────────────────────────────────────────
// For non-corpus (social-media) signals: detect complaint type.

const PAIN_TYPE_PATTERNS: Array<[PainType, RegExp]> = [
  ['cost',        /expensive|overpriced|afford|costly|pricing|cheap/i],
  ['workaround',  /workaround|script|built|manual process|three tools|copy paste/i],
  ['speed',       /slow|takes forever|laggy|too long|wait/i],
  ['complexity',  /complex|complicated|confusing|hard to use|too many steps/i],
  ['integration', /integrate|doesn't support|connect|sync|import|export/i],
  ['privacy',     /privacy|data|tracking|gdpr|leak/i],
  ['feature',     /wish|should have|doesn't have|missing|add a feature/i],
  ['workflow',    /workflow|process|every day|manually|routine|tedious/i],
]

function classifyPainType(text: string): PainType {
  for (const [type, pattern] of PAIN_TYPE_PATTERNS) {
    if (pattern.test(text)) return type
  }
  return 'workflow'
}

// For corpus signals: detect the VENTURE ANGLE embedded in structured content.
// Research articles frame problems analytically — these patterns surface that.
const CORPUS_PAIN_PATTERNS: Array<[PainType, RegExp]> = [
  ['workaround',  /workaround|manually|spreadsheet|by\s+hand|copy.?paste|cobbled|duct.?tape|kludge/i],
  ['integration', /integrat|doesn't support|connect|sync|import|export|api\s+gap|incompatib/i],
  ['feature',     /missing|lack(?:s|ing)?|gap|doesn't have|no native|wish|feature request/i],
  ['cost',        /expensive|costly|budget|roi|cost.?benefit|efficiency|wasted|overhead/i],
  ['complexity',  /complex|complicated|confus|hard to use|steep learning|too many steps|cumbersome/i],
  ['speed',       /slow|bottleneck|latency|delay|too long|blocks progress/i],
  ['workflow',    /workflow|process|pipeline|routine|every time|step|procedure/i],
]

function classifyPainTypeCorpus(text: string): PainType {
  for (const [type, pattern] of CORPUS_PAIN_PATTERNS) {
    if (pattern.test(text)) return type
  }
  return 'workflow'
}

// ── ID generation (stable, no crypto dependency) ─────────────────────────────

function makeId(url: string, source: string): string {
  let hash = 0
  const str = `${source}:${url}`
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return `sig_${Math.abs(hash).toString(36)}`
}

// ── Raw result shape coming from search adapters ─────────────────────────────

export interface RawSearchResult {
  title:        string
  body:         string
  url:          string
  source:       string
  author?:      string
  publishedAt?: string
  // Schema v2: corpus lineage — only present when produced by corpusIngestor
  corpusSourceId?:   string
  corpusSourceType?: string
  corpusTopicId?:    string
  corpusTopicName?:  string
}

// ── Public API ────────────────────────────────────────────────────────────────

export function extractSignal(
  result: RawSearchResult,
  queryUsed: string,
): PainSignal | null {
  const combined = `${result.title} ${result.body}`.trim()
  const isCorpus = result.source === 'corpus'

  // Corpus signals:    extract entities first → use entity density for intensity.
  // Non-corpus signals: score emotional intensity first → discard low-signal noise.
  let entities: SignalEntity[]
  let intensity: number

  if (isCorpus) {
    // Extract entities before scoring — entity count drives intensity for corpus.
    entities  = extractEntities(combined)
    intensity = scoreIntensityCorpus(combined, entities.length)
    // Note: corpus signals bypass the intensity < 3 gate regardless of score.
    // The corpusIngestor's MIN_BODY_CHARS check already ensures minimum quality.
  } else {
    intensity = scoreIntensity(combined)
    if (intensity < 3) return null
    entities = extractEntities(combined)
  }

  const normalizedText = normalizeText(combined)
  const keyTerms       = extractKeyTerms(normalizedText)
  const painType       = isCorpus
    ? classifyPainTypeCorpus(combined)
    : classifyPainType(combined)

  return {
    id:             makeId(result.url, result.source),
    detectedAt:     result.publishedAt ?? new Date().toISOString(),
    source:         result.source,
    sourceUrl:      result.url,
    author:         result.author,
    painText:       combined.slice(0, 500),
    normalizedText,
    keyTerms,
    painType,
    intensityScore: intensity,
    queryUsed,
    entities,
    ...(result.corpusSourceId   && { corpusSourceId:   result.corpusSourceId   }),
    ...(result.corpusSourceType && { corpusSourceType: result.corpusSourceType }),
    ...(result.corpusTopicId    && { corpusTopicId:    result.corpusTopicId    }),
    ...(result.corpusTopicName  && { corpusTopicName:  result.corpusTopicName  }),
  }
}

export function extractSignals(
  results: RawSearchResult[],
  queryUsed: string,
): PainSignal[] {
  const seen = new Set<string>()
  const out: PainSignal[] = []
  for (const r of results) {
    const sig = extractSignal(r, queryUsed)
    if (sig && !seen.has(sig.id)) {
      seen.add(sig.id)
      out.push(sig)
    }
  }
  return out
}
