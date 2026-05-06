const SO_BASE = '/api/stackexchange'

export async function searchStackOverflow(query, limit = 10, signal) {
  if (!query?.trim()) return []
  const params = new URLSearchParams({
    q:        query.trim(),
    site:     'stackoverflow',
    sort:     'relevance',
    order:    'desc',
    pagesize: String(Math.min(limit, 100)),
    filter:   'withbody',
  })
  const res = await fetch(`${SO_BASE}/2.3/search/advanced?${params}`, { signal })
  if (!res.ok) throw new Error(`Stack Overflow search failed: ${res.status}`)
  const json = await res.json()
  return (json.items || []).map((item) => ({
    id:          `so_${item.question_id}`,
    type:        'social_post',
    title:       item.title || '(untitled)',
    url:         item.link || `https://stackoverflow.com/q/${item.question_id}`,
    source:      'stackoverflow',
    publishedAt: item.creation_date ? new Date(item.creation_date * 1000).toISOString().slice(0, 10) : null,
    summary:     item.body
      ? item.body.replace(/<[^>]+>/g, '').slice(0, 240)
      : `${item.score ?? 0} votes · ${item.answer_count ?? 0} answers`,
    author:      item.owner?.display_name ?? null,
    raw:         { score: item.score, answers: item.answer_count, tags: item.tags },
  }))
}
