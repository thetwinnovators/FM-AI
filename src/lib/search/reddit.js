const REDDIT_BASE = '/api/reddit'

const DEFAULT_SUBS = [
  'MachineLearning',
  'LocalLLaMA',
  'ClaudeAI',
  'ChatGPTPro',
  'singularity',
  'programming',
  'webdev',
  'UI_Design',
  'UXDesign',
]

export async function searchReddit(query, opts = {}, signal) {
  if (!query || !query.trim()) return []
  const subs = opts.subs || DEFAULT_SUBS
  const limit = opts.limit || 15
  const subPath = subs.join('+')
  const url = `${REDDIT_BASE}/r/${subPath}/search.json?q=${encodeURIComponent(query.trim())}&restrict_sr=on&sort=relevance&limit=${limit}`
  const res = await fetch(url, { signal, headers: { 'Accept': 'application/json' } })
  if (!res.ok) throw new Error(`Reddit search failed: ${res.status}`)
  const json = await res.json()
  const children = json?.data?.children || []
  return children.map(({ data: d }) => toItem(d))
}

function toItem(d) {
  const isVideo = d.is_video || d.post_hint === 'hosted:video' || d.post_hint === 'rich:video'
  const isSelf = d.is_self
  const externalUrl = !isSelf && d.url ? d.url : `https://www.reddit.com${d.permalink}`
  const summary = d.selftext
    ? d.selftext.slice(0, 240) + (d.selftext.length > 240 ? '…' : '')
    : `r/${d.subreddit} · ${d.score} pts · ${d.num_comments} comments`

  return {
    id: `reddit_${d.id}`,
    type: isSelf ? 'social_post' : 'article',
    title: d.title || '(untitled)',
    url: externalUrl,
    source: `Reddit · r/${d.subreddit}`,
    creatorId: null,
    publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString().slice(0, 10) : null,
    summary,
    keyPoints: [],
    topicIds: [],
    toolIds: [],
    conceptIds: [],
    tagIds: [],
    thumbnail: d.thumbnail && d.thumbnail.startsWith('http') ? d.thumbnail : null,
    raw: { score: d.score, comments: d.num_comments, isVideo, subreddit: d.subreddit, permalink: `https://www.reddit.com${d.permalink}` },
  }
}

export { DEFAULT_SUBS }
