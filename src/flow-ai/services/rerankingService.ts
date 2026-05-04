/**
 * Reranking service — second-pass scoring over the candidate pool.
 *
 * After hybrid search produces an initial ranked list this service applies
 * six independent scoring signals, blends them into a single finalScore,
 * and returns the top-K results that exceed the score threshold.
 *
 * The pipeline is:
 *   hybridSearch result → rerankCandidates → RankedResult[]
 */

import type { SearchCandidate } from '../utils/hybridSearch.js'
import {
  typeWeight,
  recencyScore,
  userActivityScore,
  qualityScore,
  finalScore,
  type ScoringFactors,
} from '../utils/scoring.js'
import { dedupeById, dedupeNearDuplicates } from '../utils/dedupe.js'

// ─── types ────────────────────────────────────────────────────────────────────

export interface RankedResult {
  id:             string
  type:           SearchCandidate['type']
  title:          string
  snippet:        string
  relevanceScore: number     // final blended score 0–1
  factors:        ScoringFactors
  metadata: {
    sourceLabel?: string
    date?:        string
    topicTags?:   string[]
    confidence?:  number
    docId?:       string   // parent document ID for chunk results
    url?:         string   // source URL (external articles, ingested web docs)
  }
}

// ─── configuration ────────────────────────────────────────────────────────────

export const RERANKER_DEFAULTS = {
  scoreThreshold: 0.30,   // discard anything below this
  maxResults:     8,      // hard cap on prompt context items
  minKeyword:     0.05,   // pure noise floor — anything scoring below gets a 0
}

// ─── main entry point ─────────────────────────────────────────────────────────

/**
 * Rerank a list of SearchCandidates (already scored for keyword + semantic)
 * and return the best results in relevance order.
 *
 * @param candidates  Output from hybridSearch.reciprocalRankFusion
 * @param saves       useStore.saves — {[id]: {savedAt, item}} — for saved-boost
 * @param views       useStore.views — {[id]: {count, lastAt}} — for view-boost
 * @param maxResults  Override default cap
 * @param threshold   Override default score threshold
 */
export function rerankCandidates(
  candidates: SearchCandidate[],
  saves:      Record<string, unknown>,
  views:      Record<string, { count: number }>,
  maxResults  = RERANKER_DEFAULTS.maxResults,
  threshold   = RERANKER_DEFAULTS.scoreThreshold,
): RankedResult[] {
  // 1. Deduplicate before scoring (saves time + avoids twin context blocks)
  const deduped = dedupeNearDuplicates(dedupeById(candidates))

  // 2. Score each candidate
  const scored = deduped.map((c) => score(c, saves, views))

  // 3. Sort, filter, and cap
  return scored
    .filter((r) => r.relevanceScore >= threshold)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, maxResults)
}

// ─── scoring ─────────────────────────────────────────────────────────────────

function score(
  c:     SearchCandidate,
  saves: Record<string, unknown>,
  views: Record<string, { count: number }>,
): RankedResult {
  const factors: ScoringFactors = {
    // Semantic similarity: use the RRF hybridScore as proxy when available,
    // otherwise fall back to raw semanticScore or 0
    semanticSimilarity: c.semanticScore ?? c.hybridScore ?? 0,

    // Keyword: normalise to 0–1; damp below noise floor
    keywordScore: (c.keywordScore ?? 0) < RERANKER_DEFAULTS.minKeyword
      ? 0
      : c.keywordScore ?? 0,

    // Source type importance
    typeWeight: typeWeight(c.type),

    // Recency — use the most informative date available
    recencyScore: recencyScore(c.date),

    // User engagement signals
    userActivityScore: userActivityScore({
      pinned:    c.pinned    ?? false,
      saved:     c.saved     ?? Boolean(saves[c.id]),
      viewCount: c.viewCount ?? (views[c.id]?.count ?? 0),
    }),

    // Content quality
    qualityScore: qualityScore({
      hasSummary:   c.hasSummary   ?? false,
      hasKeyPoints: c.hasKeyPoints ?? false,
      wordCount:    c.wordCount    ?? 0,
      hasUrl:       c.hasUrl       ?? false,
      confidence:   c.confidence,
    }),
  }

  return {
    id:             c.id,
    type:           c.type,
    title:          c.title,
    snippet:        c.snippet,
    relevanceScore: finalScore(factors),
    factors,
    metadata: {
      sourceLabel: c.sourceLabel,
      date:        c.date,
      topicTags:   c.topicTags,
      confidence:  c.confidence,
      docId:       c.docId,
      url:         c.url,
    },
  }
}
