import type { PainSignal, PainType } from '../types.js'
import { normalizeText, extractKeyTerms } from './normalizationService.js'
import { extractEntities } from './entityExtractor.js'

// ── Intensity scoring keyword lists ──────────────────────────────────────────

const EMOTIONAL  = /nightmare|gave up|terrible|hate|broken|awful|frustrated|annoying/i
const URGENCY    = /every day|constantly|always|waste hours|every time|all the time/i
const WORKAROUND = /i built|three tools|manual process|script|workaround|built a/i
const FINANCIAL  = /too expensive|can't afford|wasted hours|lost money|overpriced/i

function scoreIntensity(text: string): number {
  let score = 0
  
  // Count emotional markers
  let emotionalMatches = 0
  let emotionalRegex = /nightmare|gave up|terrible|hate|broken|awful|frustrated|annoying/gi
  const emotionalResults = text.match(emotionalRegex)
  emotionalMatches = emotionalResults ? emotionalResults.length : 0
  score += Math.min(3, emotionalMatches)
  
  // Count urgency markers
  let urgencyMatches = 0
  let urgencyRegex = /every day|constantly|always|waste hours|every time|all the time/gi
  const urgencyResults = text.match(urgencyRegex)
  urgencyMatches = urgencyResults ? urgencyResults.length : 0
  score += Math.min(3, urgencyMatches)
  
  // Check workaround (recreate regex without g flag for test)
  if (/i built|three tools|manual process|script|workaround|built a/i.test(text)) score += 2
  
  // Check financial (recreate regex without g flag for test)
  if (/too expensive|can't afford|wasted hours|lost money|overpriced/i.test(text)) score += 2
  
  return Math.min(10, score)
}

// ── Pain type classification ──────────────────────────────────────────────────

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
  title:       string
  body:        string
  url:         string
  source:      string
  author?:     string
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
  const combined  = `${result.title} ${result.body}`.trim()
  const intensity = scoreIntensity(combined)
  if (intensity < 3) return null

  const normalizedText = normalizeText(combined)
  const keyTerms       = extractKeyTerms(normalizedText)
  const painType       = classifyPainType(combined)

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
    // Schema v1: entity extraction — runs deterministically, never throws
    entities:       extractEntities(combined),
    // Schema v2: corpus lineage — pass through when present
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
