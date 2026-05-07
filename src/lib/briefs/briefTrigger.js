/**
 * Returns the count of items saved to `topicId` after the most recent
 * brief for that topic was generated.  If no prior brief exists, counts
 * all items for the topic.
 *
 * @param {string}   topicId
 * @param {object[]} items    — array of content objects with { topicId, savedAt }
 * @param {object}   briefs   — briefs record object (id → Brief)
 * @returns {number}
 */
export function newItemsSinceLastBrief(topicId, items = [], briefs = {}) {
  const topicBriefs = Object.values(briefs).filter(
    (b) => b.type === 'topic' && b.topicId === topicId,
  )
  const lastGeneratedAt =
    topicBriefs.length > 0
      ? Math.max(...topicBriefs.map((b) => b.generatedAt))
      : 0

  return items.filter(
    (item) =>
      (item.topicId === topicId || (item.topicIds ?? []).includes(topicId)) &&
      (item.savedAt ?? 0) > lastGeneratedAt,
  ).length
}

/**
 * Returns true when there are 3 or more items saved to `topicId` since
 * the last brief was generated for that topic.
 *
 * @param {string}   topicId
 * @param {object[]} items
 * @param {object}   briefs
 * @returns {boolean}
 */
export function shouldGenerateTopicBrief(topicId, items, briefs) {
  return newItemsSinceLastBrief(topicId, items, briefs) >= 3
}
