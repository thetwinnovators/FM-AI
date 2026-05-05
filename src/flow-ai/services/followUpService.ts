/**
 * Follow-up suggestion engine.
 *
 * Strategy: try Ollama first for contextual JSON output (fast non-streaming
 * call); fall back to heuristic tables keyed by QueryIntent when Ollama is
 * off or the parse fails. Heuristic path adds zero latency.
 */

import { generateResponse } from '../../lib/llm/ollama.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import type { QueryIntent } from './queryAnalysisService.js'

// ─── public types ─────────────────────────────────────────────────────────────

export type FlowAIAction =
  | 'save-as-note'
  | 'generate-summary'
  | 'generate-content-ideas'

export interface FollowUpSuggestions {
  questions:    string[]         // 2–3 tap-to-send follow-up questions
  actions:      FlowAIAction[]   // 0–2 in-app actions
  followUpMode: 'normal' | 'clarify'
  confidence:   number           // 0–1; < 0.6 → clarify mode
  fromLLM:      boolean          // true when Ollama produced the suggestions
}

// ─── topic extraction ─────────────────────────────────────────────────────────

/**
 * Extract a short topic label from the exchange so heuristic questions can
 * reference the actual subject rather than saying "this" or "it".
 *
 * Priority order:
 *   1. Bolded term from the response (**X**)
 *   2. Quoted term from the response ("X" or 'X')
 *   3. Stripped user query (removes question words, keeps the noun phrase)
 *   4. First noun-phrase-ish segment of the response's opening line
 */
export function extractTopicLabel(
  userMessage: string,
  assistantText: string,
): string | null {
  // 1. Bold term — most explicit signal in a structured response
  const bold = assistantText.match(/\*\*([A-Za-z0-9][A-Za-z0-9 /\-]{2,45})\*\*/)
  if (bold) return bold[1].trim()

  // 2. Quoted term — often the subject being defined/discussed
  const quoted = assistantText.match(/[""]([A-Za-z0-9][A-Za-z0-9 \-/]{2,45})[""]/)
  if (quoted) return quoted[1].trim()

  // 3. Stripped user query — remove leading question words, keep the topic
  const stripped = userMessage
    .replace(/^(what'?s?|how|why|when|where|who|which|can you|could you|tell me|explain|describe|summarize|walk me through|talk about|show me|find|search for|look up)\s+(is|are|was|were|does|do|did|a|an|the|me|about|new|happening|going on|latest)?\s*/i, '')
    .replace(/[?.,!;:]+$/, '')
    .trim()
  // Reject if still looks like a full question (>6 words) — it means the
  // strip didn't find a clean noun phrase and we'd get the whole query as the
  // topic, which produces mechanical "Can you be more specific about X?" chips.
  const wordCount = stripped.split(/\s+/).filter(Boolean).length
  if (stripped.length >= 4 && stripped.length <= 50 && wordCount <= 6) return stripped

  // 4. Opening clause of the response — first 6 words, skipping common openers
  const firstLine = assistantText.replace(/\n[\s\S]*/, '').trim()
  const opener = firstLine
    .replace(/^(sure|great|of course|absolutely|definitely|yes|no|the |this |these |that |it |[a-z]+ is |[a-z]+ are )/i, '')
    .split(/[.,!?;]/, 1)[0]
    .trim()
  if (opener.length >= 4 && opener.length <= 60) return opener

  return null
}

// ─── heuristic question templates ────────────────────────────────────────────

/**
 * Per-intent question templates.  Each template takes an optional `topic`
 * string (extracted from the actual exchange) and returns a specific question.
 * Falls back to a generic form when no topic is available.
 */
const INTENT_TEMPLATES: Record<string, Array<(t: string | null) => string>> = {
  signal_analysis: [
    (t) => t ? `Which topics are most exposed to ${t}?`             : 'Which of my topics does this signal affect most?',
    (t) => t ? `What are the practical implications of ${t}?`       : 'What are the practical implications of this signal?',
    (t) => t ? `What should I research next on ${t}?`               : 'What should I research next based on this?',
  ],
  summarisation: [
    (t) => t ? `What are the key takeaways from ${t}?`              : 'What are the most important takeaways here?',
    (t) => t ? `How does ${t} connect to my other research?`        : 'How does this connect to my current research?',
    (t) => t ? `What's the most actionable insight from ${t}?`      : "What's the most actionable insight from this?",
  ],
  comparison: [
    (t) => t ? `Which option makes more sense given my goals on ${t}?` : 'Which option fits my goals better?',
    (t) => t ? `What are the main tradeoffs between these approaches to ${t}?` : 'What are the main tradeoffs here?',
    (_) => 'Give me a clear recommendation',
  ],
  note_generation: [
    (t) => t ? `Can you expand on the ${t} section?`                : 'Can you expand on the most important section?',
    (t) => t ? `Add a concrete example for ${t}`                    : 'Can you add a concrete real-world example?',
    (t) => t ? `What should I add to these notes about ${t}?`       : 'What else should I add to these notes?',
  ],
  action_suggestion: [
    (t) => t ? `What's the first concrete step I should take on ${t}?` : "What's the first concrete step I should take?",
    (t) => t ? `What resources do I need to get started with ${t}?` : 'What resources or tools do I need for this?',
    (t) => t ? `How do I measure progress on ${t}?`                 : 'How do I measure whether this is working?',
  ],
  content_ideation: [
    (t) => t ? `Give me 3 more content angles on ${t}`              : 'Give me 3 more content ideas like these',
    (t) => t ? `Which ${t} angle has the most potential right now?` : 'Which of these ideas has the most potential?',
    (t) => t ? `How do I validate the ${t} idea before committing?` : 'How do I quickly validate the strongest idea here?',
  ],
  retrieval: [
    (t) => t ? `Tell me more about ${t}`                            : 'Tell me more about this',
    (t) => t ? `How does ${t} fit into my existing research?`       : 'How does this fit into my existing research?',
    (t) => t ? `What are the most important aspects of ${t}?`       : 'What are the most important aspects of this?',
  ],
  unclear: [
    (_) => 'What topics have I been researching lately?',
    (_) => 'What are my latest signals and patterns?',
    (_) => 'What should I focus on next in my research?',
  ],
  casual_chat: [
    (_) => 'What topics am I currently tracking?',
    (_) => 'What are my most recent signals?',
    (_) => 'What should I research next?',
  ],
}

const HEURISTIC_ACTIONS: Record<string, FlowAIAction[]> = {
  signal_analysis:   ['save-as-note'],
  summarisation:     ['save-as-note'],
  comparison:        ['save-as-note'],
  note_generation:   ['save-as-note'],
  action_suggestion: ['save-as-note'],
  content_ideation:  ['generate-content-ideas', 'save-as-note'],
  retrieval:         ['save-as-note', 'generate-summary'],
  unclear:           [],
  casual_chat:       [],
}

// ─── exported heuristic helpers (pure, testable) ──────────────────────────────

export function generateHeuristicFollowUps(
  intent: string,
  assistantText: string,
  userMessage = '',
): string[] {
  const templates = INTENT_TEMPLATES[intent] ?? INTENT_TEMPLATES['unclear']
  const topic     = extractTopicLabel(userMessage, assistantText)
  return templates.slice(0, 3).map((fn) => fn(topic))
}

export function pickActions(intent: string): FlowAIAction[] {
  const list = HEURISTIC_ACTIONS[intent] ?? []
  return list.slice(0, 2)
}

// ─── LLM generation (with heuristic fallback) ────────────────────────────────

const LLM_PROMPT_TEMPLATE = (userMsg: string, answerSnippet: string) =>
  `Generate 3 follow-up questions for a research chat interface. Respond ONLY with valid JSON — no prose, no markdown fences.

User asked: "${userMsg.slice(0, 300)}"
Assistant answered: "${answerSnippet.slice(0, 800)}"

CRITICAL RULES for the questions:
- Reference the EXACT subject matter from the exchange above — name the specific technology, concept, person, or topic
- NEVER use vague phrases like "this", "it", "the topic", "this concept", "what else" — always name the thing
- Each question must be 6–14 words — complete sentence, naturally phrased
- Make each question distinctly useful: one for depth, one for application, one for context/connections
- BAD example: "Can you tell me more about this?" — too vague, doesn't name the subject
- GOOD example: "How does RAG chunking affect retrieval precision for long documents?" — specific, names the concept

0–2 actions from: save-as-note, generate-summary, generate-content-ideas
followUpMode: "clarify" only when the AI answer was uncertain or incomplete
confidence: 0.0–1.0

{"questions":["specific Q1","specific Q2","specific Q3"],"actions":[],"followUpMode":"normal","confidence":0.9}`

function parseLLMResponse(raw: string | null): Partial<FollowUpSuggestions> | null {
  if (!raw) return null
  try {
    const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0]
    if (!jsonStr) return null
    const parsed = JSON.parse(jsonStr)
    const questions: string[] = Array.isArray(parsed.questions)
      ? parsed.questions.filter((q: unknown) => typeof q === 'string' && (q as string).trim()).slice(0, 3)
      : []
    if (questions.length < 2) return null   // too few → use heuristic
    const actions: FlowAIAction[] = Array.isArray(parsed.actions)
      ? parsed.actions.filter((a: unknown): a is FlowAIAction =>
          ['save-as-note', 'generate-summary', 'generate-content-ideas'].includes(a as string)
        ).slice(0, 2)
      : []
    const confidence = typeof parsed.confidence === 'number'
      ? Math.min(1, Math.max(0, parsed.confidence))
      : 0.8
    const followUpMode = confidence < 0.6 ? 'clarify' : 'normal'
    return { questions, actions, followUpMode, confidence }
  } catch {
    return null
  }
}

// ─── main entry point ─────────────────────────────────────────────────────────

export async function generateFollowUps(
  userMessage: string,
  assistantText: string,
  intent: QueryIntent | string,
  signal?: AbortSignal,
): Promise<FollowUpSuggestions> {
  // Try Ollama first when it's enabled
  if (OLLAMA_CONFIG.enabled) {
    try {
      const prompt = LLM_PROMPT_TEMPLATE(userMessage, assistantText)
      const raw = await generateResponse(prompt, { signal, temperature: 0.4 })
      const parsed = parseLLMResponse(raw)
      if (parsed?.questions) {
        return {
          questions:    parsed.questions,
          actions:      parsed.actions    ?? [],
          followUpMode: parsed.followUpMode ?? 'normal',
          confidence:   parsed.confidence  ?? 0.8,
          fromLLM:      true,
        }
      }
    } catch {
      // fall through to heuristic
    }
  }

  // Heuristic fallback — zero latency
  return {
    questions:    generateHeuristicFollowUps(intent, assistantText, userMessage),
    actions:      pickActions(intent),
    followUpMode: 'normal',
    confidence:   0.7,
    fromLLM:      false,
  }
}
