// Phase 4 search quality: derive small "why this is here" labels from the
// score sub-fields the ranker already persists on every item. Returns at
// most three labels, ordered by distinctiveness (most informative first).
//
// Labels intentionally don't restate what the card already shows — the source
// (TechCrunch / Hacker News / YouTube) and the content type (article vs video)
// are already visible. These labels surface ranking REASONS: freshness,
// authority, topic-fit, and intent-aligned content.

const FRESH_THRESHOLD = 0.85
const AUTHORITY_THRESHOLD = 0.50
const TOPIC_FIT_THRESHOLD = 0.30

export function deriveReasons(item) {
  if (!item) return []
  const reasons = []
  const intents = item.queryIntent || []

  // Topic match — strongest signal that the user's pattern aligns. Surface first.
  if ((item.scoreTopicFit ?? 0) >= TOPIC_FIT_THRESHOLD) {
    reasons.push({ id: 'topic-fit', label: 'Topic match', tone: 'topic' })
  }

  // Tutorial — only when the query was classified as tutorial AND the item is
  // a video or community walkthrough. Otherwise too noisy.
  if (intents.includes('tutorial') && (item.sourceType === 'video' || item.type === 'video')) {
    reasons.push({ id: 'tutorial', label: 'Tutorial', tone: 'tutorial' })
  }

  // Reference / authoritative source — Wikipedia, docs, arxiv, etc.
  if (item.sourceType === 'reference' || (item.scoreAuthority ?? 0) >= AUTHORITY_THRESHOLD) {
    reasons.push({ id: 'reference', label: 'Reference', tone: 'reference' })
  }

  // Fresh — recently published. Skip if the item has no date so we don't
  // mislabel undated reference pages as fresh.
  if (item.publishedAt && (item.scoreFreshness ?? 0) >= FRESH_THRESHOLD) {
    reasons.push({ id: 'fresh', label: 'Fresh', tone: 'fresh' })
  }

  // Discussion — community item that's relevant to the current query intent.
  if (item.sourceType === 'community' && (item.scoreBase ?? 0) >= 0.5) {
    reasons.push({ id: 'discussion', label: 'Discussion', tone: 'discussion' })
  }

  // Cap at 3 — more than that becomes visual clutter.
  return reasons.slice(0, 3)
}
