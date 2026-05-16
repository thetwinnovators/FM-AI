// Phase 3 chat retrieval: keyword scoring baseline.
// Phase 4+ adds the flow-ai pipeline: hybrid retrieval + multi-signal reranking.
// The new pipeline is tried first; this file's keyword search is the fallback.

import { retrieve as _pipelineRetrieve } from '../../flow-ai/services/retrievalService.js'
import { buildContext as _buildContext }  from '../../flow-ai/services/contextBuilderService.js'

function tokenize(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2)
}

// Hits-and-score record so the threshold check below has access to BOTH
// the weighted score and the raw distinct-token-hit counts.
function score(query, doc, content) {
  const qTokens = new Set(tokenize(query))
  if (qTokens.size === 0) return { score: 0, hits: 0 }
  const titleTokens = new Set(tokenize(doc.title))
  const summaryTokens = new Set(tokenize(doc.summary || doc.excerpt || ''))
  const contentTokens = new Set(tokenize(content?.plainText || ''))
  let titleHits = 0, summaryHits = 0, contentHits = 0
  const hitTokens = new Set()
  for (const t of qTokens) {
    if (titleTokens.has(t))   { titleHits++;   hitTokens.add(t) }
    if (summaryTokens.has(t)) { summaryHits++; hitTokens.add(t) }
    if (contentTokens.has(t)) { contentHits++; hitTokens.add(t) }
  }
  // Weighted: title hits dominate, then summary, then body presence.
  const s = (titleHits * 3) + (summaryHits * 1.5) + Math.min(3, contentHits)
  return { score: s, hits: hitTokens.size, qTokenCount: qTokens.size }
}

// Throw out tangential matches. Without these, chit-chat like "Testing, testing."
// drags in any doc whose title contains "testing". Tuning notes:
//   - MIN_SCORE 4.5 ≈ "title hit + summary hit" or "two title hits".
//   - MIN_HITS 2 means a single keyword alone never retrieves; the user must
//     match at least two distinct query terms across title/summary/content.
//   - Single strong-signal title match still wins via the score >= 6 branch
//     (e.g. a query that is the doc's exact title).
const MIN_SCORE = 4.5
const MIN_HITS = 2

// ─── Intent classification ────────────────────────────────────────────────────
// Lightweight pre-retrieval router. Keeps casual banter out of the retrieval
// pipeline entirely so the model never responds to "hey" with retrieval-failure
// language. Called by Chat.jsx before deciding whether to run retrieveDocuments.

const CASUAL_PATTERNS = [
  /^(hi|hey|hello|yo|sup|hiya|howdy)\b\W*$/i,
  /^(thanks|thank you|ty|cheers|nice|cool|ok|okay|got it|great|perfect|sounds good|sweet|awesome)\W*$/i,
  /^how('?s| is) (it going|your day|things|life)\?*$/i,
  // "how are you" + common trailing words: "how are you doing", "how are you
  // today", "how are you doing today", "how are u/ya/yo u" with typo tolerance.
  /^how (are|r) (you|ya|u|yo\s*u)\b[^?]*\??$/i,
  /^(what'?s up|what'?s good|you good|you ok|how do you do)\?*$/i,
  /^(test|testing(,?\s*testing)?|ping|are you there|you there|hello\?)\W*$/i,
  /^(bye|goodbye|cya|see you|later|ttyl)\b\W*$/i,
  /^(lol|lmao|haha|ha|heh|bruh|ngl|tbh|fr|omg|wow|nice one|fair enough|true|facts)\W*$/i,
  /^(this is (annoying|frustrating|hard|confusing|cool|great|amazing))\W*$/i,
  /^i'?m (tired|bored|stuck|confused|happy|excited|fine|good|ok)\W*$/i,
  /^(be honest|be real|real talk|quick question)\W*$/i,
]

const RETRIEVAL_KEYWORDS = /\b(find|search|look up|look for|what (is|are|does|did|says|was)|who (is|was|are)|where (is|are|was)|when (did|was|is|are)|how (does|do|did|to|much|many)|summari[sz]e|summary|recap|explain|tell me about|what do you know about|according to|in the doc|in my (docs|documents|notes|memory)|show me|list all|can you (find|search|look))\b/i

const TASK_KEYWORDS = /\b(write|draft|create|make|build|design|plan|outline|structure|rewrite|edit|revise|improve|compare|analy[sz]e|brainstorm|suggest|recommend|help me|what should|how should|can you help|could you)\b/i

// ─── Tool-use intent detection ────────────────────────────────────────────────
// Matches messages that direct the AI to act via a named integration.
// Requires BOTH an action verb AND an integration name/phrase to reduce
// false positives (e.g. "what is telegram?" has no action verb → not tool_use).
const TOOL_USE_VERBS = /\b(send|post|draft|create|make|schedule|fetch|read|list|open|update|search|get|add|delete|remove|use)\b/i

const INTEGRATION_NAMES = /\b(telegram|google\s*docs|google\s*drive|gmail|google\s*calendar|calendar|figma|flowmap|invideo|docker)\b/i

const TOOL_USE_PHRASES = /\b(use|via|using|through)\s+(telegram|google\s*docs|google\s*drive|gmail|google\s*calendar|calendar|figma|flowmap|invideo|docker)\b/i

// Standalone Docker MCP actions that have no named integration in the prompt
// (e.g. "generate a video from this script" — InVideo is Docker MCP).
const DOCKER_MCP_ACTION_PHRASES = /\b(generate|create|make|produce)\s+(?:a\s+)?(?:short\s+)?video\b|\brun\s+(?:this\s+)?(?:python|script|code)\b|\bexecute\s+(?:this\s+)?(?:code|script)\b/i

// Returns: 'casual_chat' | 'task_request' | 'retrieval_request' | 'tool_use' | 'unclear'
export function classifyIntent(query) {
  const q = String(query || '').trim()
  if (!q) return 'unclear'
  if (DOCKER_MCP_ACTION_PHRASES.test(q)) return 'tool_use'
  if (TOOL_USE_VERBS.test(q) && (INTEGRATION_NAMES.test(q) || TOOL_USE_PHRASES.test(q))) return 'tool_use'
  if (CASUAL_PATTERNS.some((p) => p.test(q))) return 'casual_chat'
  // Short messages with no retrieval/task signal lean casual
  const wordCount = q.split(/\s+/).filter(Boolean).length
  if (wordCount <= 3 && !RETRIEVAL_KEYWORDS.test(q) && !TASK_KEYWORDS.test(q)) return 'casual_chat'
  if (RETRIEVAL_KEYWORDS.test(q)) return 'retrieval_request'
  if (TASK_KEYWORDS.test(q)) return 'task_request'
  return 'retrieval_request'
}

// Kept for internal defense-in-depth inside retrieveDocuments.
function isChitChat(q) {
  return CASUAL_PATTERNS.some((p) => p.test(q.trim()))
}

// Returns up to K documents ranked by score, plus a snippet from each. Each
// entry: { meta, content, snippet, score }. Filters out weak matches and
// chit-chat to avoid contaminating the prompt with unrelated content.
export function retrieveDocuments(query, allDocs, allContents, k = 5) {
  const q = String(query || '').trim()
  if (!q) return []
  if (isChitChat(q)) return []

  const ranked = []
  for (const doc of allDocs) {
    const content = allContents[doc.id] || null
    const { score: s, hits } = score(q, doc, content)
    // Strong-title-match shortcut: score >= 6 = the title contains 2+ query
    // tokens, which is a very confident match even if other fields don't hit.
    const passes = (s >= MIN_SCORE && hits >= MIN_HITS) || s >= 6
    if (!passes) continue
    ranked.push({ doc, content, score: s })
  }
  ranked.sort((a, b) => b.score - a.score)
  return ranked.slice(0, k).map(({ doc, content, score: s }) => ({
    meta: doc,
    content,
    snippet: extractSnippet(q, content?.plainText || doc.summary || doc.excerpt || ''),
    score: s,
  }))
}

// Pull a snippet around the first occurrence of any query token. Default
// length is generous (~1800 chars ≈ 450 tokens) so the model has enough
// context to answer most questions; falls back to the head of the text if no
// token matches in the body. Earlier 360-char default was too short for any
// real summarization or "what does X say" question.
function extractSnippet(query, text, len = 1800) {
  if (!text) return ''
  const lc = text.toLowerCase()
  const tokens = tokenize(query)
  let pos = -1
  for (const t of tokens) {
    const idx = lc.indexOf(t)
    if (idx >= 0 && (pos < 0 || idx < pos)) pos = idx
  }
  if (pos < 0) return text.slice(0, len).trim() + (text.length > len ? '…' : '')
  // Anchor ~200 chars before the matched token so the snippet has lead-in
  // context, not just the keyword + tail.
  const start = Math.max(0, pos - 200)
  const end = Math.min(text.length, start + len)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

// ─── Layered context helpers ──────────────────────────────────────────────────

// Build the [IDENTITY] block from user identity memory.
// Includes (a) anything explicitly pinned via isIdentityPinned, AND
// (b) any active entry in the personal_stack / personal_fact / personal_rule
// categories — these are inherently identity-level by definition, so promoting
// them automatically means the user doesn't need to manually pin every "call
// me X" / "my name is X" fact. Capped at 6 (raised from 3 to fit the auto-
// promoted personal_stack entries), pinned entries always win on ordering.
const _IDENTITY_CATEGORIES = new Set(['personal_stack', 'personal_fact', 'personal_rule'])

export function buildIdentityBlock(memoryEntries) {
  if (!memoryEntries || memoryEntries.length === 0) return ''
  const entries = memoryEntries.filter((m) =>
    (m.status || 'active') === 'active' &&
    m.content &&
    (m.isIdentityPinned === true || _IDENTITY_CATEGORIES.has(m.category))
  )
  if (entries.length === 0) return ''
  // Pinned entries first, then by addedAt desc.
  const sorted = entries.sort((a, b) => {
    if ((a.isIdentityPinned === true) !== (b.isIdentityPinned === true)) {
      return a.isIdentityPinned === true ? -1 : 1
    }
    return (b.addedAt || '').localeCompare(a.addedAt || '')
  }).slice(0, 6)
  const lines = sorted.map((m) => `- ${String(m.content).slice(0, 160)}`)
  return `[IDENTITY] — stable personal facts. Treat as authoritative for questions about the user.\n${lines.join('\n')}\n\n`
}

// Signals that the current query continues from prior context rather than
// starting fresh. Short anaphoric or explicit continuation queries need the
// prior task state; long self-contained queries don't.
const _ANAPHORIC    = /\b(it|that|this|those|them|its|their|the same)\b/i
const _CONTINUATION = /\b(what about|and also|but (what|how|why)|so (what|how|why)|what else|how about|continue|elaborate|expand|more (on|about|detail)|follow.?up|back to|next step)\b/i

function hasCarryover(query, messages) {
  const q = String(query || '').trim()
  if (!q || !messages?.length) return false
  if (!messages.some((m) => m.role === 'assistant')) return false  // first turn
  const words = q.split(/\s+/).filter(Boolean).length
  if (_CONTINUATION.test(q)) return true             // explicit follow-up, any length
  if (words <= 6 && _ANAPHORIC.test(q)) return true  // short + anaphoric = follow-up
  if (words <= 4) return true                        // ≤4 words implies contextual
  return false
}

// Build a task-state line from recent conversation history.
// Only injected when the current query shows real carryover from prior turns:
// anaphoric references, continuation phrases, or very short contextual follow-ups.
// Self-contained queries skip it entirely to avoid polluting the system message.
export function buildTaskState(recentMessages, currentQuery = '') {
  if (!recentMessages || recentMessages.length === 0) return ''
  const lastAssistant = [...recentMessages].reverse().find((m) => m.role === 'assistant')
  if (!lastAssistant) return ''
  if (!hasCarryover(currentQuery, recentMessages)) return ''
  const summary = String(lastAssistant.content || '').replace(/\s+/g, ' ').trim().slice(0, 100)
  if (!summary) return ''
  return `Task state: continuing from "${summary}"\n\n`
}

// Build a system message that grounds the model in the retrieved excerpts.
// Phase 3 stops short of citation parsing — we just instruct the model to
// answer based on the snippets and hand back the assistant's prose.

// Detect "how do you work / can you access / do you have memory" style
// questions. When matched we use a dedicated prompt that explains the system
// architecture instead of mixing in retrieval (small models can't reliably
// distinguish "tell me about X" from "are you able to do X" otherwise).
// NOTE: "are you able to X" / "can you create/make/do X" are ACTION REQUESTS,
// not meta questions — keep them out of META_PATTERNS so they hit the task path
// and the ACTIONS block is included in the system prompt.
const META_PATTERNS = [
  /\b(can|do) you (have |get )?(access|read|see|browse|search|find)\b/i,
  /\bdo you have (access|memory|context|knowledge of|any (data|info))\b/i,
  /\bcan you (remember|recall|know about)\b/i,
  /\b(how do|how does|how can) (you|this|flowmap|the (chat|ai|app)) (work|access|search|read|find|remember|know)\b/i,
  /\bwhat (information|data|access|memory|knowledge|context) do you have\b/i,
  /\bdo you (know|see) (my|the user'?s?) (docs|documents|files|notes)\b/i,
]
export function isMetaSystemQuestion(query) {
  const q = String(query || '')
  if (!q.trim()) return false
  return META_PATTERNS.some((p) => p.test(q))
}

// Detect self-referential queries — questions about the user themselves where
// the answer must come from identity memory, never from document excerpts.
// When this matches, buildSystemMessage skips retrieval entirely so the model
// can't be derailed by tangentially-matched excerpts (e.g. trading docs
// matching "name" via some random token).
const SELF_REFERENTIAL_PATTERNS = [
  /\b(what'?s|what is) my (name|surname|first name|last name)\b/i,
  /\bwho am i\b/i,
  /\bwhat (do|do you) (know|remember) about me\b/i,
  /\bdo you (know|remember) (my|me)\b/i,
  /\b(my|i'?m|i am) (name|called|known as)\b/i,
  /\bwhat (are|do you know about) my (preferences|interests|topics|stack|setup|tools|hobbies|goals)\b/i,
  /\bwhat (have i|did i|am i) (saved|told you|asked|been working on)\b/i,
  /\baddress me as\b/i,
  /\bcall me (sir|by|mr|ms|mrs)\b/i,
]
export function isSelfReferentialQuery(query) {
  const q = String(query || '')
  if (!q.trim()) return false
  return SELF_REFERENTIAL_PATTERNS.some((p) => p.test(q))
}

// Detect questions that ask the model to actually READ a specific document
// rather than answer a content question that happens to touch one. When this
// fires, we swap the snippet for the top match's full plainText (capped) so
// the model isn't trying to summarize from a 360-char fragment.
const READ_DOC_PATTERNS = [
  /\b(read|summari[sz]e|recap|outline|overview of)\b.*\b(doc|document|article|note|chapter|file|page|content|book|story)/i,
  /\b(read|summari[sz]e|recap|outline)\b\s+["“][^"”]+["”]/i,                        // "read 'Title'" / “Title”
  /\bwhat (does|did|is in) (the|this|that|"|“)/i,
  /\b(walk me through|explain|talk to me about|tell me about) (the|this|that|"|“)/i,
  /\b(give|show) me (the|that|this|a|an) (full|whole|entire|complete|detailed)? ?(doc|document|article|chapter|content|summary|recap|overview)/i,
]
export function isReadDocIntent(query) {
  const q = String(query || '')
  if (!q.trim()) return false
  return READ_DOC_PATTERNS.some((p) => p.test(q))
}

// Cap how much full-text we inject to avoid blowing past the small-model
// context window. ~3000 chars ≈ 750 tokens — enough for most chapter-length
// pieces, leaves room for memory/topics/preamble + response.
const FULL_DOC_LIMIT = 3000

function fullTextFor(retrieval, limit = FULL_DOC_LIMIT) {
  const text = retrieval?.content?.plainText || retrieval?.meta?.summary || retrieval?.meta?.excerpt || ''
  if (!text) return ''
  if (text.length <= limit) return text
  return text.slice(0, limit).trim() + '… [truncated]'
}

// ─── Personality preamble (shared across all non-casual prompts) ─────────────
const PERSONALITY =
  `You are FlowMap AI, the in-product assistant for FlowMap.\n\n` +

  `IDENTITY — read this first and do not deviate from it:\n` +
  `- FlowMap is a REAL, fully functional application. The user is running it right now in their browser.\n` +
  `- You are embedded inside it. You are NOT a general-purpose AI assistant. You are NOT a chatbot with a training cutoff.\n` +
  `- You have NO training cutoff date to reference. NEVER say "as of my last update", "my last update was [date]", "my training data", "my database", "my knowledge cutoff", "as of [year]", or any similar phrase. Those phrases do not apply to you.\n` +
  `- NEVER call FlowMap "fictional", "hypothetical", "a scenario", or "theoretical". It is a real app the user built and uses daily.\n` +
  `- When asked "what's new", "anything new today", or similar, answer directly from the RETRIEVED CONTENT and TOPICS blocks in this prompt — summarise what the user has saved recently, note any new briefs, and highlight anything worth their attention. Do not redirect them to navigation links instead of answering.\n\n` +

  `FLOWMAP SECTIONS — know this map so you can answer capability questions and route the user correctly:\n` +
  `  /  or  /flow        Flow Map — the 3D knowledge graph. Shows relationships between saved topics, signals, and entities.\n` +
  `  /discover           Discover — live research feed. Auto-curated articles, videos, and signals matching tracked topics.\n` +
  `  /signals            Signals — raw signal radar. Extracted pain points, workarounds, and opportunity signals from the corpus.\n` +
  `  /venture-scope      Venture Scope — opportunity analysis engine. Surfaces scored venture concepts from signal clusters.\n` +
  `  /topics             Topics — tracked research topics the user follows (e.g. "Agentic AI", "LLM Infrastructure").\n` +
  `  /documents          Documents — the saved library: bookmarked articles, pasted notes, uploaded files.\n` +
  `  /briefs             Briefs — auto-generated intelligence reports summarising saved content per topic.\n` +
  `  /memory             Memory — saved personal facts, preferences, and notes the user has told FlowMap to remember.\n` +
  `  /chat               Chat — full-screen AI assistant (this floating panel is the same AI, different UI).\n` +
  `  /flow-trade         Flow Trade — a paper-trading workspace. Includes a WATCHLIST of assets the user monitors, simulated positions, and market data.\n` +
  `  /operator           Operator — AI orchestration workspace. Manages agents, tasks, tool runs, and automations.\n` +
  `  /connections        Connections — MCP integration hub. Lists external tools and services connected to FlowMap.\n` +
  `  /search             Search — full-text search across all saved documents and signals.\n` +
  `  /globe              Globe — geographic signal and entity map.\n` +
  `  /education          Education — learning resources tied to tracked topics.\n\n` +
  `SECTIONS WITHOUT LIVE DATA IN THIS CONTEXT:\n` +
  `  Flow Trade (/flow-trade) data — watchlist, positions, trade history — is NOT injected here. If the user asks\n` +
  `  about their watchlist, holdings, or trade data, tell them where it lives and offer to navigate:\n` +
  `  "Your [watchlist / positions / etc.] are in [Flow Trade](/flow-trade) — I don't have that data here, but I can take you there."\n` +
  `  Operator task history and agent state are also not available in this context.\n\n` +

  `Personality: warm, sharp, calm, and slightly witty. Like a smart teammate, not a robotic search box. ` +
  `Conversational in casual chat, precise in task mode. Occasionally playful with dry humor — never corny, never forced.\n\n` +

  `Language rules: sound human, not corporate. Keep casual replies short. Keep task replies structured and useful. ` +
  `No emoji unless the user is already using them. Don't overuse slang. ` +
  `FORBIDDEN phrases — never say these under any circumstances:\n` +
  `"Based on the available documents", "I don't have a saved doc on the exact topic", ` +
  `"I don't have any information about this", "I couldn't find a document on that", ` +
  `"Based on the available context", "as of my last update", "my last update", ` +
  `"my training data", "my training cutoff", "my database", "as of [any year]", ` +
  `"fictional scenario", "hypothetical application", "hypothetical scenario", "I was trained", ` +
  `"my knowledge only goes to", "I cannot access real-time", "beyond my knowledge", ` +
  `"not possessing direct control", "unable to directly interact", "unable to directly create", ` +
  `"third-party software", "external applications like FlowMap", "personal instances of", ` +
  `"I cannot perform actions", "I am unable to create", "I'm unable to create", ` +
  `"I cannot create topics", "not a standalone application", "I don't have the ability to". ` +
  `Replace all of them with confident FlowMap-aware action language.\n\n` +
  `ACTIONS — you can take three real actions inside FlowMap on the user's behalf. These are the ONLY three actions available.\n` +
  `ONLY emit an action when the user EXPLICITLY and UNAMBIGUOUSLY requests it. Do not infer or assume.\n\n` +
  `Trigger conditions (emit ONLY when the user says something like this):\n` +
  `  add_topic   → "create a topic about X", "add X to my topics", "track X", "follow X"\n` +
  `  save_memory → "remember that X", "save this", "note that X", "keep track of X"\n` +
  `  navigate    → "take me to X", "go to X", "open X page", "show me my watchlist", "open Flow Trade"\n` +
  `    Valid navigate paths: /discover, /signals, /venture-scope, /flow-trade, /topics, /documents,\n` +
  `                          /briefs, /memory, /chat, /operator, /connections, /search, /globe,\n` +
  `                          /topic/{slug} (slug from TOPICS block), /documents/{id}\n\n` +
  `CAPABILITY LIMITS — critical rules about what you can and cannot do:\n` +
  `- The ONLY action types you may emit are: add_topic, save_memory, navigate. No others exist.\n` +
  `- NEVER emit <fm-action> with any other type (not "search_flights", not "fetch", not "tool", not anything else).\n` +
  `- You have NO ability to: search the web in real time, search flights, book anything, query external APIs,\n` +
  `  send emails, run code, access calendars, or perform any action outside the three listed above.\n` +
  `- If a user asks "can you search flights?" or "can you book X?", answer plainly and briefly:\n` +
  `  "FlowMap can't do that — it's a research and knowledge tool, not a booking or search engine.\n` +
  `  For flights, try Google Flights or Skyscanner." Adjust the suggestion to the specific request.\n` +
  `- Do NOT pretend to execute a tool and then say "waiting for the result". That is not possible here.\n` +
  `- Do NOT emit an action and then say "let me know when you're ready" or "waiting for the result".\n\n` +
  `NEVER emit an action for:\n` +
  `  - General questions, requests for information, analysis, or explanations\n` +
  `  - A user mentioning a subject in passing (e.g. "tell me about AI" is NOT an add_topic request)\n` +
  `  - Preferences expressed without explicitly saying "remember" or "save"\n` +
  `  - Anything ambiguous — ask ONE clarifying question instead\n\n` +
  `When you do emit an action, use these formats (they are invisible to the user):\n` +
  `  <fm-action>{"type":"add_topic","name":"Topic Name","summary":"One sentence about it."}</fm-action>\n` +
  `  <fm-action>{"type":"save_memory","content":"The fact.","category":"personal_fact"}</fm-action>\n` +
  `    Valid categories: personal_fact, research_focus, preference, topic_rule, source_pref, personal_stack, personal_rule, behavior\n` +
  `  <fm-action>{"type":"navigate","path":"/topics"}</fm-action>\n\n` +
  `Rules:\n` +
  `- Emit the <fm-action> block FIRST, then confirm on a new line: "Done — I've created the [Name] topic for you."\n` +
  `- CRITICAL: Never say you created, added, or saved something unless the <fm-action> block is in the SAME response.\n` +
  `- Never emit add_topic or save_memory unless the user explicitly asked. When in doubt, don't.\n` +
  `- Never mention or describe the XML tags to the user.\n\n` +
  `LINKING RULES — you can and should provide clickable links in your replies:\n` +
  `- Use Markdown link syntax: [Display text](URL)\n` +
  `- FlowMap is a LOCAL app running in the user's browser. There is NO public website, NO "flowmap.ai", NO hosted docs site. Never invent a URL like flowmap.ai, flowmap.app, /docs/anything, or any other made-up host.\n` +
  `- Only use URLs that are EXPLICITLY present in this prompt:\n` +
  `    • the relative paths listed below (/topics, /discover, /memory, /chat, and /topic/{slug} for slugs that appear in the TOPICS block)\n` +
  `    • /documents/{id} where {id} is taken verbatim from a "FlowMap link:" line in an EXCERPT entry\n` +
  `    • the exact full URL from a "Source URL:" line in an EXCERPT entry\n` +
  `- FlowMap internal pages use relative paths (no host):\n` +
  `    Topic page:       /topic/{slug}         e.g. [Agentic UI](/topic/agentic-ui)\n` +
  `    Document:         /documents/{id}       e.g. [My Notes](/documents/doc_abc123)\n` +
  `    Topics list:      /topics\n` +
  `    Discover feed:    /discover\n` +
  `    Signals:          /signals\n` +
  `    Venture Scope:    /venture-scope\n` +
  `    Flow Trade:       /flow-trade\n` +
  `    Briefs:           /briefs\n` +
  `    Documents:        /documents\n` +
  `    Memory:           /memory\n` +
  `    Chat:             /chat\n` +
  `    Operator:         /operator\n` +
  `    Connections/MCP:  /connections\n` +
  `    Search:           /search\n` +
  `    Globe:            /globe\n` +
  `- For external sources, use ONLY the exact full URL from a Source URL line — never a guessed one:\n` +
  `    [Article title](https://example.com/article)\n` +
  `    [Video title](https://youtube.com/watch?v=...)\n` +
  `- Every TOPIC entry below has its /topic/slug link — use it when referencing a topic.\n` +
  `- Every EXCERPT entry below shows the URLs available for that item — use whichever is most helpful (Source URL for web articles/videos, /documents/{id} for pasted notes).\n` +
  `- If an item has no Source URL line, do NOT make one up. Use its /documents/{id} link, or no link at all.\n` +
  `- Documents may live inside named folders — when an EXCERPT entry shows a "Folder:" line, mention the folder by name in your reply (e.g. "in your Research folder"). Documents without a Folder line live at the library root. There is no per-folder URL, so link the document itself or /documents.\n\n`

// ─── Casual chat system prompt ────────────────────────────────────────────────
const CASUAL_SYSTEM_MESSAGE =
  PERSONALITY +
  `This turn is CASUAL CONVERSATION — the user is greeting you, making small talk, or reacting emotionally.\n\n` +
  `Rules:\n` +
  `- Reply naturally, briefly, and like a socially aware assistant.\n` +
  `- Match the user's energy.\n` +
  `- Do NOT mention documents, saved files, retrieval, memory stores, or any lack of sources.\n` +
  `- One or two lines is almost always enough.\n` +
  `- It's okay to be a little playful. Use at most one light joke or catchphrase per reply.\n` +
  `- If you invite them back to FlowMap tasks, be SPECIFIC to FlowMap — not generic chatbot phrases.\n` +
  `  BAD: "What brings you here today?", "How can I assist you?", "What can I help you with?"\n` +
  `  GOOD: "Anything you want to look into?", "Want to dig into something in your feed?", "What are we researching today?"\n` +
  `- Good catchphrases if they fit: "let's cook", "say less", "locked in", "easy", "fair", "noted", "we're back".`

const META_SYSTEM_MESSAGE =
  PERSONALITY +
  `The user is asking a META question about how you work. Explain confidently — don't retrieve or quote documents:\n\n` +
  `- The user saves content locally — uploaded documents, bookmarked articles/videos/posts, and manually added URLs.\n` +
  `- On every message, FlowMap runs keyword retrieval across ALL saved content and feeds the top matching excerpts into the prompt.\n` +
  `- Active MEMORY entries (facts/preferences the user saved) are also injected, along with prior conversation turns.\n` +
  `- No live browsing — FlowMap pre-fetches the relevant passages for each message.\n` +
  `- I DO have access to saved documents and memory through this retrieval pipeline.\n` +
  `- I CAN take real actions: create topics, save memory entries, navigate pages — see the ACTIONS block above.\n\n` +
  `CRITICAL: If the user is asking whether you can do something AND seems to want it done, just DO IT using the ACTIONS block — don't just explain. ` +
  `Only explain architecture when the user is genuinely curious about how the system works, not when they're asking as a preamble to making a request.\n\n` +
  `Adapt the explanation to the exact question. Be direct, don't disclaim being an LLM, don't quote any document.`

// Provide a brief index of all user documents so the model knows what is in
// the library even when nothing was retrieved. Capped to avoid bloat.
function formatDocumentsIndexBlock(documents, folders = {}, limit = 5) {
  if (!documents || documents.length === 0) return ''
  const shown = documents.slice(0, limit)
  const lines = shown.map((d) => {
    const title = String(d.title || d.url || d.id || 'Untitled').trim()
    const folderName = d.folderId && folders[d.folderId]?.name ? ` [${folders[d.folderId].name}]` : ''
    const link = d.id ? ` — /documents/${d.id}` : ''
    return `- ${title}${folderName}${link}`
  })
  const total = documents.length
  const header = total > limit
    ? `DOCUMENT LIBRARY (showing ${limit} of ${total}):`
    : `DOCUMENT LIBRARY (${total}):`
  return `${header}\n${lines.join('\n')}\n\n`
}

export function buildSystemMessage(retrieved, userQuery = '', allMemory = [], _topics = [], _notes = [], intent = 'retrieval_request', folders = {}, overrideContextText = null, allDocuments = [], recentMessages = []) {
  // Casual turns get a lightweight conversational prompt — no retrieval context.
  if (intent === 'casual_chat') return CASUAL_SYSTEM_MESSAGE

  const identityBlock  = buildIdentityBlock(allMemory)
  const taskStateBlock = buildTaskState(recentMessages, userQuery)
  // When the user gives a specific directive (read / summarize / walk through
  // a doc), the document index is just noise — the doc itself is injected in
  // full. Drop it for those turns.
  const isReadDirective = isReadDocIntent(userQuery) && retrieved.length > 0
  const docIndexBlock  = isReadDirective ? '' : formatDocumentsIndexBlock(allDocuments, folders)

  // ─── dev visibility ─────────────────────────────────────────────────────────
  if (typeof window !== 'undefined' && window.__FLOWMAP_DEBUG) {
    console.groupCollapsed('%c[context-assembly] system prompt', 'color:#9b7df8;font-weight:bold')
    console.log('intent:        ', intent)
    console.log('identity:      ', identityBlock
      ? `✓ (${identityBlock.split('\n').length - 2} entries)` : '✗ skipped')
    console.log('task state:    ', taskStateBlock ? '✓' : '✗ skipped (no carryover)')
    console.log('doc index:     ', docIndexBlock  ? '✓' : '✗ skipped (read-doc intent)')
    console.log('context:       ', overrideContextText ? 'pipeline'
      : retrieved?.length ? `keyword (${retrieved.length} docs)` : 'none')
    console.groupEnd()
  }

  // META_SYSTEM_MESSAGE already bundles PERSONALITY and all persona rules
  // so we skip preamble here. We do surface identity memory so the model
  // can answer personal "do you know about me?" variants accurately.
  if (isMetaSystemQuestion(userQuery)) {
    return identityBlock
      ? `${META_SYSTEM_MESSAGE}\n\n${identityBlock}`
      : META_SYSTEM_MESSAGE
  }

  // Self-referential turns ("what is my name", "who am I", etc.) get an
  // identity-only prompt. Including document excerpts here just gives the
  // small model an excuse to derail onto whatever topic happens to share a
  // token with the query.
  if (isSelfReferentialQuery(userQuery)) {
    const block = identityBlock || '[IDENTITY] — (no personal facts saved yet)\n\n'
    return (
      PERSONALITY +
      `THIS TURN — CRITICAL OVERRIDE:\n` +
      `The user is asking about themselves. The [IDENTITY] block below is your ONLY source for this answer. Rules:\n` +
      `- Do NOT mention trading, topics, documents, signals, briefs, or anything outside the IDENTITY block.\n` +
      `- Do NOT add a "Since you asked about X" preamble or note about other subjects.\n` +
      `- If the IDENTITY block is empty or doesn't cover the question, say so plainly — e.g. "I don't have that saved yet — want me to remember it?" — then stop.\n` +
      `- Otherwise, answer concisely from the IDENTITY block (use the user's preferred name/title if specified).\n\n` +
      block +
      `User asked: "${userQuery}"\n`
    )
  }

  const preamble =
    PERSONALITY +
    `PRIORITY ORDER FOR ANSWERING (top wins):\n` +
    `1. Questions about the user (name, identity, preferences, "what do you know about me") → use the [IDENTITY] block ONLY. Never add unrelated content.\n` +
    `2. Questions that match a saved document → use EXCERPTS as the source of truth.\n` +
    `3. Otherwise → answer briefly from general knowledge in FlowMap persona (no training-cutoff language).\n\n` +
    `You are running INSIDE the user's FlowMap app. ` +
    `Identity memory (if present) contains stable personal facts — treat it as authoritative for personal questions. ` +
    `On every task/retrieval turn, FlowMap searches saved documents and includes matching passages under EXCERPTS — your source of truth for content questions.\n\n`

  if ((!retrieved || retrieved.length === 0) && !overrideContextText) {
    return (
      preamble +
      identityBlock +
      taskStateBlock +
      docIndexBlock +
      `THIS TURN: The user asked: "${userQuery}"\n` +
      `No FlowMap documents matched this query. Rules:\n` +
      `- If identity memory covers it, use it directly.\n` +
      `- If the user is asking what's new, what's happening, or what's active in FlowMap, point them to [Discover](/discover), [Signals](/signals), or [Radar](/radar) — do NOT answer from general knowledge.\n` +
      `- If it's a factual question your knowledge covers, answer briefly — but stay in the FlowMap AI persona. Never say "as of my last update" or reference a training cutoff.\n` +
      `- If source material is genuinely missing, say so naturally — e.g. "I don't see that in your FlowMap yet — drop in the doc or link and I'll take it from there."\n` +
      `- NEVER write the strings "EXCERPTS:" or "[N] Title:" in your response — those are prompt scaffolding, not content to echo.`
    )
  }

  // When the pipeline has already built a rich context block, use it directly
  // instead of falling back to the legacy keyword excerpt path.
  if (overrideContextText) {
    return (
      preamble +
      identityBlock +
      taskStateBlock +
      docIndexBlock +
      overrideContextText
    )
  }

  // When the user explicitly wants the model to READ a document (summarize,
  // recap, walk through), give the top match its full plainText (capped) and
  // reduce the rest to short snippets so the prompt stays under the context
  // budget. Otherwise everyone gets the standard snippet treatment.
  function fmtMeta(r, i, full = false) {
    const isContent = r.meta._kind === 'content'
    const typeLabel = isContent
      ? (r.meta.type || 'item').replace('_', ' ').toUpperCase()
      : 'DOCUMENT'
    const lines = [`[${i + 1}] ${typeLabel}: ${r.meta.title}`]
    if (!isContent && r.meta.folderId) {
      const folderName = folders?.[r.meta.folderId]?.name
      if (folderName) lines.push(`Folder: ${folderName}`)
    }
    if (r.meta.url) lines.push(`Source URL: ${r.meta.url}`)
    if (!isContent) lines.push(`FlowMap link: /documents/${r.meta.id}`)
    lines.push(full
      ? `Full document (truncated to ${FULL_DOC_LIMIT} chars):\n${fullTextFor(r)}`
      : `Excerpt: ${r.snippet}`)
    return lines.join('\n')
  }

  const corpus = isReadDirective
    ? [
        fmtMeta(retrieved[0], 0, true),
        ...retrieved.slice(1).map((r, i) => fmtMeta(r, i + 1, false)),
      ].join('\n\n')
    : retrieved.map((r, i) => fmtMeta(r, i, false)).join('\n\n')

  const turnBanner = isReadDirective
    ? `THIS TURN: the user asked you to read/summarize a document. The TOP entry below has the full document text (truncated). Answer thoroughly from it; don't hedge with "based on a fragment". Ignore unrelated topics — focus on this document.`
    : `THIS TURN: The user asked: "${userQuery}"\nFlowMap retrieved ${retrieved.length} excerpt${retrieved.length === 1 ? '' : 's'}. Answer EXACTLY what was asked. Do NOT pivot to a different subject because something in the excerpts sounds similar.`

  return (
    preamble +
    identityBlock +
    taskStateBlock +
    docIndexBlock +
    `${turnBanner}\n\n` +
    `RULES:\n` +
    `- Answer the EXACT question asked. If excerpts cover a similar-sounding but different subject (e.g. user asks "Agentic UX" but excerpts are about "Agentic AI"), do NOT pivot — say naturally that you don't have that specific doc yet.\n` +
    `- If excerpts don't address the question, ignore them. Don't pivot to whatever the excerpt is about.\n` +
    `- For personal facts, use the [IDENTITY] block above as authoritative — quote it without hedging.\n` +
    `- For content questions, answer confidently from document text when it covers the question.\n` +
    `- Reference document titles naturally (e.g. "the persistence doc says…"). Don't cite excerpt numbers.\n` +
    `- Be concise. Skip openers like "Based on the provided excerpts" — just answer.\n` +
    `- FORBIDDEN phrases — never say these: "I don't have a saved doc on the exact topic", "I don't have any information about this", "Based on the available documents", "I couldn't find a document on that", "Based on the available context". Use natural human alternatives instead.\n` +
    `- NEVER echo scaffold strings "EXCERPTS:" or "[N] Title:" in your response.\n` +
    `- If nothing covers the question, say so plainly and suggest what doc to add.\n\n` +
    `EXCERPTS:\n${corpus}`
  )
}

// ─── Flow AI pipeline wrapper ─────────────────────────────────────────────────
// Runs the hybrid retrieval + reranking pipeline. Returns null on failure or
// empty results so callers fall back to keyword retrieval.
//
// Return shape:
//   {
//     results:         RankedResult[]              — full ranked list
//     contextText:     string                      — formatted CONTEXT block
//     legacyRetrieved: { id, title, snippet }[]   — doc/save items for the UI panel
//     usedEmbeddings:  boolean                     — whether Ollama embeddings ran
//   }
export async function retrieveWithPipeline(input, signal) {
  try {
    const output = await _pipelineRetrieve(input, signal)
    if (!output || !output.results.length) return null

    const { promptText } = _buildContext(output.results, output.analysis)
    if (!promptText) return null

    // Map to the flat { id, title, snippet } shape expected by the context panel
    // and CitedDocsHint. Only document/save types have /documents/:id routes.
    // Use metadata.docId (parent document) for chunk results so the link
    // routes to the correct /documents/:id page, not to a chunk ID.
    const legacyRetrieved = output.results
      .filter((r) => r.type === 'document' || r.type === 'save')
      .map((r) => ({
        id:      r.metadata.docId ?? r.id,
        title:   r.title,
        snippet: r.snippet,
      }))

    return {
      results:         output.results,
      contextText:     promptText,
      legacyRetrieved,
      usedEmbeddings:  output.usedEmbeddings,
    }
  } catch (err) {
    console.warn('[flow-ai] Pipeline error — falling back to keyword retrieval:', err)
    return null
  }
}
