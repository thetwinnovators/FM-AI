// Stage 1 + 2 of the FlowMap search algorithm: deterministic query interpretation
// and search plan generation. Pure rules, no AI. Hand-curated alias groups expand
// well-known terms; topic-aware expansion uses the seed's relatedTopicIds + toolIds.
// Phase 2 added queryIntents + freshSensitive, both heuristic.

import { classifyQueryIntent, isFreshnessSensitiveQuery } from './queryIntent.js'

// Bidirectional alias groups — typing any term expands to the others.
const ALIAS_GROUPS = [
  ['claude', 'Claude Code', 'Claude API', 'Anthropic', 'Claude Sonnet', 'Claude Opus'],
  ['anthropic', 'Claude', 'Claude Code'],
  ['mcp', 'Model Context Protocol', 'MCP server', 'MCP client'],
  ['agents', 'AI agents', 'agentic AI', 'autonomous agents', 'agent loop', 'multi-agent', 'agent framework'],
  ['agent', 'AI agent', 'autonomous agent', 'agent loop'],
  ['vibecoding', 'vibe coding', 'AI-assisted coding', 'agentic coding', 'AI pair programming'],
  ['rag', 'retrieval augmented generation', 'retrieval-augmented generation', 'vector search'],
  ['llm', 'large language model', 'foundation model'],
  ['gpt', 'ChatGPT', 'GPT-4', 'GPT-5', 'OpenAI'],
  ['ide', 'VS Code', 'Cursor', 'code editor'],
  ['cursor', 'Cursor IDE', 'AI code editor'],
  ['design', 'UI design', 'visual design', 'product design'],
  ['ux', 'user experience', 'usability', 'interaction design'],
  ['automation', 'workflow automation', 'CI/CD', 'pipeline'],
  ['codex', 'OpenAI Codex', 'GitHub Copilot'],
  ['evals', 'LLM evaluation', 'model evals', 'benchmarks'],
  ['tool use', 'function calling', 'tool calling'],
  ['prompt engineering', 'prompting', 'prompt design'],
]

const VIDEO_HINTS = ['watch', 'video', 'demo', 'walkthrough', 'tutorial', 'youtube', 'reel']
const ARTICLE_HINTS = ['article', 'post', 'blog', 'news', 'docs', 'essay', 'paper']
const TIME_HINTS = {
  day:   ['today', 'this day'],
  week:  ['this week', 'past week', 'recent', 'latest'],
  month: ['this month', 'past month'],
  year:  ['this year', 'past year'],
}

function lowercaseGroup(group) {
  return group.map((g) => g.toLowerCase())
}

function findGroupsForTerm(term) {
  const lc = term.toLowerCase()
  return ALIAS_GROUPS.filter((group) =>
    lowercaseGroup(group).some((alias) => alias === lc || alias.split(' ').includes(lc))
  )
}

function detectSourceTypes(lowerQuery) {
  const wantsVideo = VIDEO_HINTS.some((h) => lowerQuery.includes(h))
  const wantsArticle = ARTICLE_HINTS.some((h) => lowerQuery.includes(h))
  if (wantsVideo && !wantsArticle) return ['video']
  if (wantsArticle && !wantsVideo) return ['article']
  return ['article', 'video']
}

function detectTimeScope(lowerQuery) {
  for (const [scope, hints] of Object.entries(TIME_HINTS)) {
    if (hints.some((h) => lowerQuery.includes(h))) return scope
  }
  return 'any'
}

export function interpretQuery(rawQuery) {
  const normalized = String(rawQuery || '').trim()
  if (!normalized) {
    return {
      rawQuery, normalizedQuery: '', sourceTypes: ['article', 'video'],
      timeScope: 'any', expandedTerms: [],
      queryIntents: [], freshSensitive: false, confidence: 0,
    }
  }
  const lower = normalized.toLowerCase()
  const tokens = normalized.split(/\s+/).filter(Boolean)

  const expandedSet = new Set()
  // Match the WHOLE query first
  const wholeMatchGroups = findGroupsForTerm(normalized)
  for (const group of wholeMatchGroups) for (const alias of group) expandedSet.add(alias)
  // Then match each token
  for (const token of tokens) {
    const groups = findGroupsForTerm(token)
    for (const group of groups) for (const alias of group) expandedSet.add(alias)
  }
  expandedSet.delete(normalized) // don't re-include the original

  return {
    rawQuery,
    normalizedQuery: normalized,
    sourceTypes: detectSourceTypes(lower),
    timeScope: detectTimeScope(lower),
    expandedTerms: [...expandedSet].slice(0, 6),
    queryIntents: classifyQueryIntent(normalized),
    freshSensitive: isFreshnessSensitiveQuery(normalized),
    confidence: 1.0,
  }
}

// Topic-aware expansion: if the query matches a seed topic by name/slug, also include
// its relatedTopicIds and toolIds as expansion candidates.
export function expandWithTopics(intent, seed) {
  if (!seed?.topics) return intent.expandedTerms
  const lower = intent.normalizedQuery.toLowerCase()
  const matched = seed.topics.find((t) =>
    t.name.toLowerCase() === lower || t.slug === lower || t.id === lower
  )
  if (!matched) return intent.expandedTerms
  const related = []
  for (const id of matched.relatedTopicIds || []) {
    const t = seed.topicById?.(id)
    if (t?.name) related.push(t.name)
  }
  for (const id of matched.toolIds || []) {
    const tool = seed.toolById?.(id)
    if (tool?.name) related.push(tool.name)
  }
  return [...new Set([...intent.expandedTerms, ...related])].slice(0, 8)
}

// Build the final list of queries to fan out across sources. Always includes the
// original query first (priority 1.0), then up to (maxFanOut - 1) expansions.
export function buildQueries(intent, seed, maxFanOut = 3) {
  const expanded = expandWithTopics(intent, seed)
  const queries = [intent.normalizedQuery]
  for (const term of expanded) {
    if (queries.length >= maxFanOut) break
    if (!queries.find((q) => q.toLowerCase() === term.toLowerCase())) {
      queries.push(term)
    }
  }
  return queries
}
