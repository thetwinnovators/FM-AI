/**
 * Search entities in the seed database by query string.
 * Returns an object with arrays for each entity type.
 */
export function searchEntities(query, seed) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return { topics: [], tools: [], creators: [], companies: [], concepts: [] }

  const searchArray = (arr, fields = ['name', 'title', 'summary']) =>
    arr.filter((item) =>
      fields.some((field) => (item[field] || '').toLowerCase().includes(q))
    )

  return {
    topics: searchArray(seed.topics, ['name', 'summary']),
    tools: searchArray(seed.tools, ['name', 'summary']),
    creators: searchArray(seed.creators, ['name', 'summary']),
    companies: searchArray(seed.companies, ['name', 'summary']),
    concepts: searchArray(seed.concepts, ['name', 'summary']),
  }
}
