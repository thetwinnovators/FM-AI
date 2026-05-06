const GH_BASE = '/api/github'

export async function searchGitHubIssues(query, limit = 10, signal) {
  if (!query?.trim()) return []
  const params = new URLSearchParams({
    q:        `${query.trim()} is:issue is:open`,
    sort:     'reactions',
    order:    'desc',
    per_page: String(Math.min(limit, 100)),
  })
  const res = await fetch(`${GH_BASE}/search/issues?${params}`, {
    signal,
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`GitHub search failed: ${res.status}`)
  const json = await res.json()
  return (json.items || []).map((item) => {
    const repoName = item.repository_url?.replace('https://api.github.com/repos/', '') ?? 'github'
    return {
      id:          `gh_${item.id}`,
      type:        'social_post',
      title:       item.title || '(untitled)',
      url:         item.html_url,
      source:      'github',
      publishedAt: item.created_at?.slice(0, 10) ?? null,
      summary:     item.body
        ? item.body.slice(0, 240)
        : `${item.reactions?.['+1'] ?? 0} 👍 · ${item.comments} comments · ${repoName}`,
      author:      item.user?.login ?? null,
      raw:         { reactions: item.reactions, comments: item.comments, labels: item.labels?.map((l) => l.name), repo: repoName },
    }
  })
}
