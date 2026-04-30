// Phase 2 search quality: heuristic, keyword-based query classification.
// No model required — just transparent rules. Returns one or more labels
// from the taxonomy in flowmap-search-quality-improvements.md:
//   explainer, tutorial, tool, news, trend, person, company, concept,
//   comparison, reference.
//
// Plus a freshness-sensitivity boolean used by the ranker to upweight recency
// for "latest"/"new"/year-named queries and to ignore it for evergreen ones.

const TUTORIAL_PHRASES = [
  'how to', 'how do i', 'how can i', 'tutorial', 'guide', 'walkthrough',
  'step by step', 'step-by-step', 'build a', 'build an', 'build my',
  'set up', 'setup', 'install', 'configure', 'getting started',
]
const TUTORIAL_TERMS = new Set(['workflow', 'recipe', 'pattern', 'cookbook'])

const EXPLAINER_PHRASES = [
  'what is', 'what are', 'what does', 'what do', 'explain', 'meaning of',
  'definition of', 'how does', 'how do', 'why does', 'why do', 'why is',
]

const REFERENCE_TERMS = new Set([
  'docs', 'documentation', 'reference', 'spec', 'specification',
  'rfc', 'wiki', 'manual', 'changelog',
])

const TOOL_PHRASES = ['best ', 'top ', 'recommend', 'review', 'should i use']
const TOOL_TERMS = new Set([
  'tool', 'tools', 'app', 'apps', 'cli', 'sdk', 'library',
  'framework', 'plugin', 'extension', 'editor', 'ide',
])

const COMPARISON_PHRASES = [
  ' vs ', ' v. ', ' versus ', 'compare ', 'compared to',
  'difference between', 'differences between', 'better than',
  ' vs.', 'or ', // 'X or Y' — risky, but caught alongside "compare" filter below
]
// 'or ' is too noisy alone; only flag comparison if another comparison signal also fires.
const COMPARISON_STRONG = COMPARISON_PHRASES.filter((p) => p !== 'or ')

const NEWS_PHRASES = ['just released', 'just launched', 'just announced', 'announced today']
const NEWS_TERMS = new Set([
  'news', 'release', 'released', 'launch', 'launched', 'launches',
  'announcement', 'announced', 'unveiled', 'rollout', 'shipped',
])

const TREND_TERMS = new Set([
  'trend', 'trends', 'trending', 'rise', 'future', 'state',
])
const TREND_PHRASES = ['state of', 'rise of', 'fall of', 'future of', 'impact of']

const FRESHNESS_PHRASES = [
  'this week', 'this month', 'last week', 'last month',
  'right now', 'as of', 'currently',
]
const FRESHNESS_TERMS = new Set([
  'latest', 'newest', 'new', 'fresh', 'recent', 'today',
  'yesterday', 'current', 'now', 'ongoing', 'update', 'updated',
])
const FRESHNESS_YEARS = new Set(['2024', '2025', '2026', '2027'])

// Known company / org names — used to bias toward `company`. Single-word
// occurrences in queries are strong company signals.
const COMPANIES = new Set([
  'anthropic', 'openai', 'google', 'deepmind', 'meta', 'microsoft', 'apple',
  'tesla', 'amazon', 'nvidia', 'mistral', 'cohere', 'huggingface',
  'stability', 'perplexity', 'replicate', 'github', 'vercel',
])

function tokenize(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function containsAny(haystack, phrases) {
  for (const p of phrases) if (haystack.includes(p)) return true
  return false
}

function tokensIntersect(tokens, set) {
  for (const t of tokens) if (set.has(t)) return true
  return false
}

export function isFreshnessSensitiveQuery(query) {
  const q = String(query || '').toLowerCase()
  if (!q) return false
  if (containsAny(q, FRESHNESS_PHRASES)) return true
  const tokens = tokenize(q)
  if (tokensIntersect(tokens, FRESHNESS_TERMS)) return true
  for (const tok of tokens) if (FRESHNESS_YEARS.has(tok)) return true
  return false
}

export function classifyQueryIntent(query) {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return []
  const tokens = tokenize(q)
  const tokenSet = new Set(tokens)
  const labels = new Set()

  // Tutorial
  if (containsAny(q, TUTORIAL_PHRASES) || tokensIntersect(tokens, TUTORIAL_TERMS)) {
    labels.add('tutorial')
  }

  // Explainer + concept
  if (containsAny(q, EXPLAINER_PHRASES)) {
    labels.add('explainer')
    labels.add('concept')
  }

  // Reference
  if (tokensIntersect(tokens, REFERENCE_TERMS)) {
    labels.add('reference')
  }

  // Tool
  if (containsAny(q, TOOL_PHRASES) || tokensIntersect(tokens, TOOL_TERMS)) {
    labels.add('tool')
  }

  // Comparison — require a strong signal
  if (containsAny(q, COMPARISON_STRONG)) {
    labels.add('comparison')
  }

  // News + trend + freshness
  const fresh = isFreshnessSensitiveQuery(q)
  if (containsAny(q, NEWS_PHRASES) || tokensIntersect(tokens, NEWS_TERMS) || fresh) {
    labels.add('news')
  }
  if (tokensIntersect(tokens, TREND_TERMS) || containsAny(q, TREND_PHRASES)) {
    labels.add('trend')
  }

  // Company / org
  for (const t of tokens) {
    if (COMPANIES.has(t)) {
      labels.add('company')
      break
    }
  }
  // A single-token query that doesn't match anything else but exists in COMPANIES
  // also implies reference (user wants to learn about the org).
  if (tokens.length === 1 && COMPANIES.has(tokens[0])) {
    labels.add('reference')
  }

  // Default: short ambiguous queries are most likely concept lookups.
  if (labels.size === 0) labels.add('concept')

  return [...labels]
}
