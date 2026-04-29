// Phase 3 chat retrieval: pick the top K documents most relevant to the user
// query using simple keyword scoring (no vectors). Phases 4+ extend this to
// cover saved items and conversation context. Stays heuristic and fast —
// every score component is transparent.

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
  /^(what'?s up|what'?s good|you good|you ok|how are you|how do you do)\?*$/i,
  /^(test|testing(,?\s*testing)?|ping|are you there|you there|hello\?)\W*$/i,
  /^(bye|goodbye|cya|see you|later|ttyl)\b\W*$/i,
  /^(lol|lmao|haha|ha|heh|bruh|ngl|tbh|fr|omg|wow|nice one|fair enough|true|facts)\W*$/i,
  /^(this is (annoying|frustrating|hard|confusing|cool|great|amazing))\W*$/i,
  /^i'?m (tired|bored|stuck|confused|happy|excited|fine|good|ok)\W*$/i,
  /^(be honest|be real|real talk|quick question)\W*$/i,
]

const RETRIEVAL_KEYWORDS = /\b(find|search|look up|look for|what (is|are|does|did|says|was)|who (is|was|are)|where (is|are|was)|when (did|was|is|are)|how (does|do|did|to|much|many)|summari[sz]e|summary|recap|explain|tell me about|what do you know about|according to|in the doc|in my (docs|documents|notes|memory)|show me|list all|can you (find|search|look))\b/i

const TASK_KEYWORDS = /\b(write|draft|create|make|build|design|plan|outline|structure|rewrite|edit|revise|improve|compare|analy[sz]e|brainstorm|suggest|recommend|help me|what should|how should|can you help|could you)\b/i

// Returns: 'casual_chat' | 'task_request' | 'retrieval_request' | 'unclear'
export function classifyIntent(query) {
  const q = String(query || '').trim()
  if (!q) return 'unclear'
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

// Build a system message that grounds the model in the retrieved excerpts.
// Phase 3 stops short of citation parsing — we just instruct the model to
// answer based on the snippets and hand back the assistant's prose.

// Detect "how do you work / can you access / do you have memory" style
// questions. When matched we use a dedicated prompt that explains the system
// architecture instead of mixing in retrieval (small models can't reliably
// distinguish "tell me about X" from "are you able to do X" otherwise).
const META_PATTERNS = [
  /\b(can|do) you (have |get )?(access|read|see|browse|search|find)\b/i,
  /\bdo you have (access|memory|context|knowledge of|any (data|info))\b/i,
  /\bare you (able|capable|allowed) to\b/i,
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
  `Personality: warm, sharp, calm, and slightly witty. Like a smart teammate, not a robotic search box. ` +
  `Conversational in casual chat, precise in task mode. Occasionally playful with dry humor — never corny, never forced.\n\n` +
  `Language rules: sound human, not corporate. Keep casual replies short. Keep task replies structured and useful. ` +
  `No emoji unless the user is already using them. Don't overuse slang. ` +
  `Avoid: "Based on the available documents", "I don't have a saved doc on the exact topic", ` +
  `"I don't have any information about this", "I couldn't find a document on that", ` +
  `"Based on the available context". Replace those with natural human language.\n\n`

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
  `- After responding socially, you can optionally invite them back to the task.\n` +
  `- Good catchphrases if they fit: "let's cook", "say less", "locked in", "easy", "fair", "noted", "we're back".`

const META_SYSTEM_MESSAGE =
  PERSONALITY +
  `The user is asking a META question about how you work. Explain the architecture honestly and confidently — don't retrieve or quote documents:\n\n` +
  `- The user uploads documents (notes, articles, chat dumps) and FlowMap stores them locally.\n` +
  `- On every message, FlowMap runs keyword retrieval and feeds the top matching excerpts into the prompt.\n` +
  `- Active MEMORY entries (facts/preferences the user saved) are also injected, along with prior conversation turns.\n` +
  `- No live browsing — FlowMap pre-fetches the relevant passages for each message.\n` +
  `- So yes: I do have access to saved documents and memory through this retrieval pipeline.\n\n` +
  `Adapt the explanation to the exact question. Be direct, don't disclaim being an LLM, don't quote any document.`

// Format the user's topic library for prompt injection. Lists each topic by
// name + short description so the model can map references like "the Claude
// topic" or "what topics am I following?" to actual content. Marks user-saved
// topics with · saved so the model can distinguish them from seed topics.
function formatTopicsBlock(topics) {
  if (!topics || topics.length === 0) return ''
  const lines = topics.map((t) => {
    const desc = String(t.summary || t.description || '').trim().replace(/\s+/g, ' ').slice(0, 160)
    const tag = t.isUser ? ' · saved' : (t.followed ? ' · followed' : '')
    return desc ? `- ${t.name}${tag}: ${desc}` : `- ${t.name}${tag}`
  })
  return `TOPICS (the user's research areas — saved or followed; reference by name when relevant):\n${lines.join('\n')}\n\n`
}

// Format the user's per-item notes for prompt injection. Each entry pairs
// the parent item's title (so the model knows what the note is *about*) with
// the note text. Notes are the user's own commentary, not source material —
// label them clearly so the model treats them as opinion / context rather
// than as authoritative facts.
function formatNotesBlock(notes) {
  if (!notes || notes.length === 0) return ''
  const lines = notes
    .filter((n) => n && n.content && String(n.content).trim())
    .map((n) => {
      const title = String(n.title || 'item').trim()
      const type = n.type ? `${n.type}: ` : ''
      // Cap each note at ~280 chars so a single ranty note can't dominate
      // the prompt. Truncation is rare in practice.
      const text = String(n.content).trim().slice(0, 280)
      return `- on [${type}${title}]: ${text}`
    })
  if (lines.length === 0) return ''
  return `USER NOTES (the user's own commentary attached to specific videos / articles / posts — their opinions, takeaways, follow-ups; NOT source-of-truth facts):\n${lines.join('\n')}\n\n`
}

// Format active memory entries for prompt injection. Filters out archived /
// dismissed entries and groups by category so the model can scan quickly.
function formatMemoryBlock(memoryEntries) {
  if (!memoryEntries || memoryEntries.length === 0) return ''
  const active = memoryEntries.filter((m) => (m.status || 'active') === 'active' && m.content)
  if (active.length === 0) return ''
  const lines = active.map((m) => {
    const cat = String(m.category || 'note').replace(/_/g, ' ')
    return `- [${cat}] ${m.content}`
  })
  return `USER MEMORY (facts and preferences the user has saved about themselves — treat as authoritative for personal questions):\n${lines.join('\n')}\n\n`
}

export function buildSystemMessage(retrieved, userQuery = '', memoryEntries = [], topics = [], notes = [], intent = 'retrieval_request') {
  // Casual turns get a lightweight conversational prompt — no retrieval context.
  if (intent === 'casual_chat') return CASUAL_SYSTEM_MESSAGE

  const memoryBlock = formatMemoryBlock(memoryEntries)
  const notesBlock = formatNotesBlock(notes)
  // When the user gives a specific directive (read / summarize / walk through
  // a doc), the topics list is just noise — it can pull a small model toward
  // unrelated subjects. Drop it for those turns; memory, notes, and the doc
  // itself are enough.
  const isReadDirective = isReadDocIntent(userQuery) && retrieved.length > 0
  const topicsBlock = isReadDirective ? '' : formatTopicsBlock(topics)

  if (isMetaSystemQuestion(userQuery)) {
    const tail = [memoryBlock, topicsBlock, notesBlock].filter(Boolean).join('')
    return tail ? `${META_SYSTEM_MESSAGE}\n\n${tail}` : META_SYSTEM_MESSAGE
  }

  const preamble =
    PERSONALITY +
    `You are running INSIDE the user's FlowMap app. ` +
    `Treat USER MEMORY as authoritative facts about the user. TOPICS are their declared research areas. ` +
    `On every task/retrieval turn, FlowMap searches saved documents and includes matching passages under EXCERPTS — your source of truth for content questions.\n\n`

  if (!retrieved || retrieved.length === 0) {
    return (
      preamble +
      memoryBlock +
      topicsBlock +
      notesBlock +
      `THIS TURN: The user asked: "${userQuery}"\n` +
      `No documents matched. Answer EXACTLY what was asked.\n` +
      `- If USER MEMORY or TOPICS cover it, use them directly.\n` +
      `- If it's a general-knowledge question, answer briefly.\n` +
      `- If source material is missing, say so naturally — e.g. "I don't see that in FlowMap yet — drop in the doc or link and I'll take it from there." Never say "I don't have a saved doc on the exact topic" or "Based on the available documents".\n` +
      `- NEVER write the strings "USER MEMORY:", "TOPICS:", "EXCERPTS:", or "[N] Title:" in your response — those are prompt scaffolding, not content to echo.`
    )
  }
  // When the user explicitly wants the model to READ a document (summarize,
  // recap, walk through), give the top match its full plainText (capped) and
  // reduce the rest to short snippets so the prompt stays under the context
  // budget. Otherwise everyone gets the standard snippet treatment.
  const corpus = isReadDirective
    ? [
        `[1] Title: ${retrieved[0].meta.title}\nFull document (truncated to ${FULL_DOC_LIMIT} chars):\n${fullTextFor(retrieved[0])}`,
        ...retrieved.slice(1).map((r, i) => `[${i + 2}] Title: ${r.meta.title}\nExcerpt: ${r.snippet}`),
      ].join('\n\n')
    : retrieved
        .map((r, i) => `[${i + 1}] Title: ${r.meta.title}\nExcerpt: ${r.snippet}`)
        .join('\n\n')

  const turnBanner = isReadDirective
    ? `THIS TURN: the user asked you to read/summarize a document. The TOP entry below has the full document text (truncated). Answer thoroughly from it; don't hedge with "based on a fragment". Ignore unrelated topics — focus on this document.`
    : `THIS TURN: The user asked: "${userQuery}"\nFlowMap retrieved ${retrieved.length} excerpt${retrieved.length === 1 ? '' : 's'}. Answer EXACTLY what was asked. Do NOT pivot to a different subject because something in TOPICS or the excerpts sounds similar.`

  return (
    preamble +
    memoryBlock +
    topicsBlock +
    notesBlock +
    `${turnBanner}\n\n` +
    `RULES:\n` +
    `- Answer the EXACT question asked. If excerpts cover a similar-sounding but different subject (e.g. user asks "Agentic UX" but excerpts are about "Agentic AI"), do NOT pivot — say naturally that you don't have that specific doc yet.\n` +
    `- If excerpts don't address the question, ignore them. Don't pivot to whatever the excerpt is about.\n` +
    `- For personal facts (name, preferences, focus areas), USER MEMORY is authoritative — quote it without hedging.\n` +
    `- For questions about what the user is researching, use TOPICS.\n` +
    `- For content questions, answer confidently from document text when it covers the question.\n` +
    `- Reference document titles naturally (e.g. "the persistence doc says…"). Don't cite excerpt numbers.\n` +
    `- Be concise. Skip openers like "Based on the provided excerpts" — just answer.\n` +
    `- FORBIDDEN phrases — never say these: "I don't have a saved doc on the exact topic", "I don't have any information about this", "Based on the available documents", "I couldn't find a document on that", "Based on the available context". Use natural human alternatives instead.\n` +
    `- NEVER echo scaffold strings "USER MEMORY:", "TOPICS:", "EXCERPTS:", or "[N] Title:" in your response.\n` +
    `- If nothing covers the question, say so plainly and suggest what doc to add.\n\n` +
    `EXCERPTS:\n${corpus}`
  )
}
