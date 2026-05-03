/**
 * Query analysis — classifies a user query before retrieval so the pipeline
 * can adjust which memory types to prioritise and what output schema to target.
 *
 * This is a pure client-side heuristic (no LLM call) so it adds zero latency.
 * The result informs the retrieval service and the context builder.
 */

// ─── types ────────────────────────────────────────────────────────────────────

export type QueryIntent =
  | 'casual_chat'       // greetings, small-talk, meta questions
  | 'retrieval'         // "what do I know about X" / "find me..."
  | 'summarisation'     // "summarise / recap / overview of X"
  | 'comparison'        // "compare X vs Y" / "difference between..."
  | 'note_generation'   // "write a note about / draft / outline..."
  | 'signal_analysis'   // "what signals / trends / patterns..."
  | 'action_suggestion' // "what should I do / what's next..."
  | 'content_ideation'  // "ideas for / suggest topics / generate..."
  | 'unclear'

export interface QueryAnalysis {
  intent:         QueryIntent
  /** Memory types to prioritise in retrieval order. */
  priorityTypes:  Array<'document' | 'signal' | 'memory' | 'topic' | 'save'>
  /** How many top results the retrieval service should keep. */
  maxResults:     number
  /** Whether an in-app action should be offered alongside the answer. */
  suggestAction:  boolean
  /** Stripped, normalised query tokens for keyword search. */
  tokens:         string[]
}

// ─── patterns ─────────────────────────────────────────────────────────────────

const CASUAL_PATTERNS = [
  /^(hey|hi|hello|howdy|sup|yo)\b/i,
  /^(how are you|what's up|how's it going|good (morning|afternoon|evening))/i,
  /^(thanks?|thank you|thx|cheers|cool|ok|okay|sure|great|nice)\b/i,
  /^(lol|lmao|haha|hehe|omg|wow)\b/i,
  /^(bye|goodbye|see ya|later|cya)\b/i,
  /\bwho (are|is) you\b/i,
  /\bwhat (are|is) you\b/i,
  /\bare you (an ai|a bot|real|human)\b/i,
  /\bcan you (help|assist)\b.{0,20}$/i,
  /^(yes|no|nope|yep|yeah|nah)\b/i,
  /^test(ing)?\b/i,
]

const SUMMARISE_PATTERNS = [
  /\b(summaris|summar[iy]|recap|overview|tl;?dr|tldr|brief|highlights?)\b/i,
  /\bgive me.*(summary|overview|recap)\b/i,
  /\bwhat (is|are|was|were) .*(about|covering)\b/i,
]

const COMPARISON_PATTERNS = [
  /\bvs\.?\b|\bversus\b|\bcompare\b|\bcomparison\b|\bdifference.*(between|from)\b/i,
  /\b(better|worse|pros.+cons|advantages?.+disadvantages?)\b/i,
]

const NOTE_PATTERNS = [
  /\b(write|draft|create|make|generate|produce).*(note|notes|outline|summary|brief|doc)\b/i,
  /\b(note.*(about|on|for)|outline|structure|organis[e]?)\b/i,
]

const SIGNAL_PATTERNS = [
  /\b(signal|signals|trend|trends|pattern|patterns|spike|rising|emerging|detect|detected)\b/i,
  /\bwhat.*(trending|growing|spiking|rising)\b/i,
  /\b(latest|recent|new).*(signals?|trends?|activity)\b/i,
]

const ACTION_PATTERNS = [
  /\b(what should|recommend|suggest|advice|action|next step|to-?do)\b/i,
  /\b(should i|could i|what do i do|what (can|shall) i)\b/i,
]

const CONTENT_IDEA_PATTERNS = [
  /\b(ideas?|content ideas?|topics? ideas?|video ideas?|suggest|brainstorm|generate ideas?)\b/i,
  /\bgive me.*(idea|topic|angle|hook|title)\b/i,
]

// ─── analyser ─────────────────────────────────────────────────────────────────

export function analyseQuery(query: string): QueryAnalysis {
  const q = query.trim()
  const tokens = tokenise(q)

  // Very short or empty → casual
  if (tokens.length === 0) {
    return casual(tokens)
  }

  // Pattern matching in priority order
  if (isCasual(q, tokens)) return casual(tokens)
  if (matches(q, SUMMARISE_PATTERNS))    return build('summarisation',    ['document','save','signal','memory','topic'], 5, false, tokens)
  if (matches(q, COMPARISON_PATTERNS))   return build('comparison',        ['document','topic','save','signal','memory'], 6, false, tokens)
  if (matches(q, NOTE_PATTERNS))         return build('note_generation',   ['document','memory','topic','save','signal'], 4, true,  tokens)
  if (matches(q, SIGNAL_PATTERNS))       return build('signal_analysis',   ['signal','topic','memory','document','save'], 6, false, tokens)
  if (matches(q, ACTION_PATTERNS))       return build('action_suggestion', ['memory','signal','topic','document','save'], 4, true,  tokens)
  if (matches(q, CONTENT_IDEA_PATTERNS)) return build('content_ideation',  ['topic','signal','save','memory','document'], 5, true,  tokens)

  // Default — retrieval with documents first
  return build('retrieval', ['document', 'save', 'memory', 'signal', 'topic'], 7, false, tokens)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function isCasual(q: string, tokens: string[]): boolean {
  if (CASUAL_PATTERNS.some((p) => p.test(q))) return true
  // Heuristic: ≤3 tokens with no substantive retrieval signal
  if (tokens.length <= 3 && !SUMMARISE_PATTERNS.some((p) => p.test(q))) {
    const hasRetrievalSignal = /\b(what|how|why|when|where|who|which|find|show|list|tell)\b/i.test(q)
    if (!hasRetrievalSignal) return true
  }
  return false
}

function matches(q: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(q))
}

function casual(tokens: string[]): QueryAnalysis {
  return {
    intent:        'casual_chat',
    priorityTypes: ['memory', 'topic', 'document', 'signal', 'save'],
    maxResults:    0,
    suggestAction: false,
    tokens,
  }
}

function build(
  intent: QueryIntent,
  priorityTypes: QueryAnalysis['priorityTypes'],
  maxResults: number,
  suggestAction: boolean,
  tokens: string[],
): QueryAnalysis {
  return { intent, priorityTypes, maxResults, suggestAction, tokens }
}

function tokenise(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}
