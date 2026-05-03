/**
 * Multi-signal scoring for the reranking layer.
 *
 * Each candidate gets scored on six independent dimensions; the final score
 * is a weighted sum.  Weights are tuned for a personal research tool where
 * semantic relevance and document quality matter most.
 */

// ─── types ────────────────────────────────────────────────────────────────────

export interface ScoringFactors {
  semanticSimilarity: number  // 0–1  cosine sim to query
  keywordScore:       number  // 0–1  normalised keyword hit density
  typeWeight:         number  // 0–1  importance of this source type
  recencyScore:       number  // 0–1  exponential decay over calendar days
  userActivityScore:  number  // 0–1  boost from pins / saves / views
  qualityScore:       number  // 0–1  content completeness
}

// ─── per-type importance ──────────────────────────────────────────────────────

const TYPE_WEIGHTS: Record<string, number> = {
  document: 0.90,  // user-uploaded or pasted content
  signal:   0.80,  // detected trend / signal
  save:     0.75,  // bookmarked web content
  memory:   0.70,  // user facts / preferences
  topic:    0.60,  // broad research area
}

export function typeWeight(type: string): number {
  return TYPE_WEIGHTS[type] ?? 0.65
}

// ─── recency ─────────────────────────────────────────────────────────────────

/**
 * Exponential decay with a ~30-day half-life.
 * Very recent items score close to 1.0; items older than 90 days score ~0.05.
 */
export function recencyScore(dateStr: string | null | undefined): number {
  if (!dateStr) return 0.30
  const days = (Date.now() - new Date(dateStr).getTime()) / 86_400_000
  if (isNaN(days) || days < 0) return 1.0
  return Math.exp(-days / 30)
}

// ─── user activity ────────────────────────────────────────────────────────────

/** Boost an item that the user has explicitly engaged with. */
export function userActivityScore(opts: {
  pinned?:    boolean
  saved?:     boolean
  viewCount?: number
}): number {
  let s = 0
  if (opts.pinned)                      s += 0.40
  else if (opts.saved)                  s += 0.25
  if ((opts.viewCount ?? 0) >= 5)       s += 0.15
  else if ((opts.viewCount ?? 0) >= 2)  s += 0.08
  else if ((opts.viewCount ?? 0) >= 1)  s += 0.03
  return Math.min(s, 1.0)
}

// ─── content quality ─────────────────────────────────────────────────────────

/** Reward completeness: summary, key points, word count, URL. */
export function qualityScore(opts: {
  hasSummary?:   boolean
  hasKeyPoints?: boolean
  wordCount?:    number
  hasUrl?:       boolean
  confidence?:   number  // signal confidence 0–100
}): number {
  let s = 0.35  // baseline — everything gets at least this
  if (opts.hasSummary)                        s += 0.25
  if (opts.hasKeyPoints)                      s += 0.15
  if ((opts.wordCount ?? 0) > 200)            s += 0.15
  else if ((opts.wordCount ?? 0) > 50)        s += 0.07
  if (opts.hasUrl)                            s += 0.05
  if (opts.confidence !== undefined)          s += (opts.confidence / 100) * 0.05
  return Math.min(s, 1.0)
}

// ─── final weighted combination ───────────────────────────────────────────────

/**
 * Blend all six factors into a single relevance score in [0, 1].
 *
 * Weight distribution:
 *   semantic    40%  — most important; measures true relevance
 *   keyword     20%  — exact-match boost for precision
 *   type        15%  — prefer higher-fidelity sources
 *   recency     12%  — fresher signals win ties
 *   user        08%  — personalisation from past behaviour
 *   quality     05%  — completeness tie-breaker
 */
export function finalScore(factors: ScoringFactors): number {
  return (
    factors.semanticSimilarity * 0.40 +
    factors.keywordScore       * 0.20 +
    factors.typeWeight         * 0.15 +
    factors.recencyScore       * 0.12 +
    factors.userActivityScore  * 0.08 +
    factors.qualityScore       * 0.05
  )
}
