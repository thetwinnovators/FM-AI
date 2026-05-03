/**
 * Hybrid search: keyword scoring + semantic (vector) scoring merged via
 * Reciprocal Rank Fusion (RRF).
 *
 * Either branch can be absent:
 *   - No query vectors (Ollama off) → keyword-only, RRF over a single list
 *   - No keyword hits          → semantic-only
 *   - Both present              → RRF fusion (k=60, standard default)
 *
 * The output is a list of SearchCandidates sorted by hybridScore DESC.
 */

import { cosineSimilarity } from './embeddings.js'

// ─── candidate type ───────────────────────────────────────────────────────────

export type CandidateType = 'document' | 'signal' | 'memory' | 'topic' | 'save' | 'note'

export interface SearchCandidate {
  // identity
  id:           string
  type:         CandidateType

  // display
  title:        string
  snippet:      string   // ~300-char context snippet for the prompt

  // search text (not sent to the prompt, used only for scoring)
  searchBody:   string   // title + summary + plainText (truncated)

  // metadata for scoring
  date?:        string   // ISO date string (for recency)
  pinned?:      boolean
  saved?:       boolean
  viewCount?:   number
  hasSummary?:  boolean
  hasKeyPoints?:boolean
  wordCount?:   number
  hasUrl?:      boolean
  topicTags?:   string[]
  confidence?:  number   // 0–100, signals only
  sourceLabel?: string   // "YouTube", "Document", "Signal", …

  // scores — set progressively during the pipeline
  vector?:        number[]
  keywordScore?:  number
  semanticScore?: number
  hybridScore?:   number
}

// ─── keyword scoring ─────────────────────────────────────────────────────────

/**
 * BM25-inspired term-frequency score (no IDF — corpus is small).
 * Title matches weight 3×; body matches 1× (capped at 3 per token to avoid
 * very long documents dominating).
 * Returns a value in [0, 1].
 */
export function scoreKeyword(
  queryTokens: string[],
  candidate: SearchCandidate,
): number {
  if (queryTokens.length === 0) return 0
  const titleLow = candidate.title.toLowerCase()
  const bodyLow  = candidate.searchBody.toLowerCase()

  let raw = 0
  let hitCount = 0

  for (const token of queryTokens) {
    if (token.length < 2) continue
    const titleHits = countOccurrences(titleLow, token)
    const bodyHits  = Math.min(3, countOccurrences(bodyLow, token))
    if (titleHits > 0 || bodyHits > 0) hitCount++
    raw += titleHits * 3 + bodyHits
  }

  // Require at least 1 matching token (prevents total mismatches scoring > 0)
  if (hitCount === 0) return 0

  // Normalise: a perfect title match on all tokens ≈ 15; anything beyond → 1
  return Math.min(raw / Math.max(queryTokens.length * 6, 6), 1.0)
}

function countOccurrences(text: string, token: string): number {
  let count = 0, pos = 0
  while ((pos = text.indexOf(token, pos)) !== -1) { count++; pos += token.length }
  return count
}

/** Tokenise a query string for keyword scoring. */
export function tokenise(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}

// ─── semantic scoring ─────────────────────────────────────────────────────────

/**
 * Attach cosine similarity scores to each candidate given a pre-computed
 * query vector.  Candidates without a stored vector get a score of 0.
 */
export function attachSemanticScores(
  candidates: SearchCandidate[],
  queryVector: number[],
): SearchCandidate[] {
  return candidates.map((c) => ({
    ...c,
    semanticScore: c.vector ? cosineSimilarity(queryVector, c.vector) : 0,
  }))
}

// ─── RRF fusion ───────────────────────────────────────────────────────────────

/**
 * Reciprocal Rank Fusion across keyword and semantic rankings.
 *
 * RRF score(d) = Σ_i  1 / (k + rank_i(d))
 *
 * k=60 is the standard constant that smooths the rank distribution and
 * prevents top-1 results from completely dominating.
 *
 * The final `hybridScore` is normalised to [0, 1].
 */
export function reciprocalRankFusion(
  candidates: SearchCandidate[],
  k = 60,
): SearchCandidate[] {
  if (candidates.length === 0) return []

  const rrfMap = new Map<string, number>()

  // ── keyword ranking ───────────────────────────────────────────────────────
  const byKeyword = [...candidates].sort(
    (a, b) => (b.keywordScore ?? 0) - (a.keywordScore ?? 0),
  )
  byKeyword.forEach((c, i) => {
    rrfMap.set(c.id, (rrfMap.get(c.id) ?? 0) + 1 / (k + i + 1))
  })

  // ── semantic ranking (optional) ───────────────────────────────────────────
  const hasSemantic = candidates.some((c) => (c.semanticScore ?? 0) > 0)
  if (hasSemantic) {
    const bySemantic = [...candidates].sort(
      (a, b) => (b.semanticScore ?? 0) - (a.semanticScore ?? 0),
    )
    bySemantic.forEach((c, i) => {
      rrfMap.set(c.id, (rrfMap.get(c.id) ?? 0) + 1 / (k + i + 1))
    })
  }

  // ── normalise ─────────────────────────────────────────────────────────────
  // Maximum possible RRF score when both lists are used
  const maxRRF = hasSemantic ? 2 / (k + 1) : 1 / (k + 1)

  return candidates
    .map((c) => ({ ...c, hybridScore: (rrfMap.get(c.id) ?? 0) / maxRRF }))
    .sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0))
}
