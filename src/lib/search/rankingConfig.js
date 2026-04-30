// Single source of truth for search ranking weights, source priors, and
// diversity guardrails. Tune behavior here, not inside scoring functions.
//
// Conceptual final score for an item is:
//   scoreFinal = (
//     weights.base       * scoreBase
//     + weights.freshness  * scoreFreshness
//     + weights.intent     * scoreIntent
//     + weights.authority  * scoreAuthority
//     + weights.feedback   * scoreFeedback
//   ) * sourceWeight[source] - scoreDiversityPenalty

export const RANKING_CONFIG = {
  // How much each component contributes to the pre-penalty score (sum to ~1).
  weights: {
    base:      0.30, // exact phrase + token overlap + metadata completeness
    freshness: 0.10,
    intent:    0.15,
    authority: 0.10,
    feedback:  0.15,
    topicFit:  0.20, // Phase 3 — only contributes when a topic context is supplied
  },
  // Internal split inside `scoreBase`.
  baseSplit: {
    exact:  0.55, // strong title/summary match
    tokens: 0.30, // token overlap with query
    meta:   0.15, // metadata completeness (image, summary, date)
  },
  // Per-source priors — multiplied into pre-penalty score. Tuned for the
  // SearXNG era: `Web` is now first-class (broad-web backbone), specialty
  // sources are dialed back so they enrich rather than dominate generic
  // queries. Phase 2's intent matrix restores Reddit/HN/Wikipedia for the
  // queries where they genuinely belong (community/explainer/reference).
  sourceWeight: {
    'Tech News':   1.10,
    'Web':         1.10, // covers both SearXNG and Jina (both emit `Web · <host>`)
    'Hacker News': 1.00,
    'YouTube':     1.00,
    'Reddit':      0.85,
    'Wikipedia':   0.85,
    default:       1.00,
  },
  // Trusted-domain authority bonus — added into scoreAuthority (0..1 range).
  authorityBonus: {
    'wikipedia.org':     0.80,
    'docs.anthropic.com': 0.80,
    'anthropic.com':      0.65,
    'github.com':         0.50,
    'stackoverflow.com':  0.50,
    'arxiv.org':          0.65,
  },
  authorityBonusSuffix: {
    '.wikipedia.org':     0.80,
  },
  // Per-source intent matrix — used by Phase 2 once query intent is detected.
  // Keys are query intents, values map sourceType → weight bump (multiplicative).
  // Phase 1 leaves this idle; included so Phase 2 can plug in without churn.
  intentSourceBoost: {
    explainer:   { reference: 1.30, article: 1.10, video: 0.95, community: 0.80, news: 0.85 },
    tutorial:    { video: 1.30, article: 1.10, community: 0.95, reference: 0.80, news: 0.85 },
    news:        { news: 1.40, community: 1.10, article: 1.00, video: 0.90, reference: 0.70 },
    trend:       { community: 1.20, news: 1.20, video: 1.05, article: 1.00, reference: 0.75 },
    tool:        { article: 1.10, video: 1.10, community: 1.00, news: 0.95, reference: 0.85 },
    reference:   { reference: 1.40, article: 1.05, video: 0.90, news: 0.80, community: 0.75 },
    comparison:  { article: 1.15, video: 1.15, community: 1.00, news: 0.95, reference: 0.85 },
    person:      { article: 1.10, news: 1.10, reference: 1.00, video: 0.95, community: 0.85 },
    company:     { news: 1.15, article: 1.10, reference: 1.00, video: 0.90, community: 0.85 },
    concept:     { reference: 1.30, article: 1.10, video: 1.00, community: 0.85, news: 0.80 },
  },
  // Domain diversity: graduated penalty after the soft cap (no hard ceiling).
  diversity: {
    softCap: 2,
    penaltyPerExtra: 0.20,
    rankWindow: 30,
  },
  // Near-duplicate handling.
  dedupe: {
    sameDomainThresh:  0.85,
    crossDomainThresh: 0.95,
  },
  // Freshness curve thresholds (days). Newer items score 1.0; older drop off
  // through the bands. Used by `scoreFreshness`.
  freshness: {
    bands: [
      { days: 7,   score: 1.00 },
      { days: 30,  score: 0.85 },
      { days: 90,  score: 0.70 },
      { days: 365, score: 0.55 },
    ],
    older: 0.30,
    unknown: 0.40,
  },
}
