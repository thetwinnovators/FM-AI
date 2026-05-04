/**
 * Context builder — the final step before prompt assembly.
 *
 * Takes the reranked results and turns them into compact, labelled context
 * blocks that Ollama can reason over.  Key design choices:
 *
 *   - Typed headers so the model knows what kind of memory it's reading
 *   - Relevance scores shown (the model can weigh evidence quality)
 *   - Hard character budget to keep prompts within the context window
 *   - Short structured blocks rather than dumped raw text
 */

import type { RankedResult } from './rerankingService.js'
import type { QueryAnalysis } from './queryAnalysisService.js'

// ─── types ────────────────────────────────────────────────────────────────────

/** Memory type header labels matching the spec. */
const MEMORY_TYPE_LABEL: Record<string, string> = {
  document: 'document-memory',
  signal:   'signal-memory',
  memory:   'behavior-memory',
  topic:    'topic-memory',
  save:     'document-memory',   // saved web content treated as document memory
  note:     'document-memory',   // user notes treated as document memory
}

export interface ContextBlock {
  memoryType:    string
  id:            string
  /** For chunk candidates this is the parent document ID; same as id otherwise. */
  docId:         string
  title:         string
  relevance:     number    // 0–1
  date?:         string    // ISO date, human-formatted
  sourceLabel?:  string
  topicTags?:    string[]
  confidence?:   number    // 0–100, for signals
  summary:       string    // the actual content shown to the model
  slug?:         string    // topic slug (for /topic/{slug} links)
  url?:          string    // external source URL (articles, videos, ingested web docs)
}

// ─── configuration ────────────────────────────────────────────────────────────

const MAX_BLOCKS         = 8       // hard cap — most models work best with ≤8
const MAX_CHARS_PER_BLOCK= 400     // keeps each block ~100 tokens
const MAX_TOTAL_CHARS    = 3_200   // ~800 tokens total context budget

// ─── main entry point ─────────────────────────────────────────────────────────

/**
 * Build context blocks from reranked results and format them into a prompt
 * string ready to be injected into the system message.
 */
export function buildContext(
  results:  RankedResult[],
  analysis: QueryAnalysis,
): { blocks: ContextBlock[]; promptText: string } {
  const blocks  = toBlocks(results, analysis)
  const trimmed = applyBudget(blocks)
  return { blocks: trimmed, promptText: formatForPrompt(trimmed) }
}

// ─── block construction ───────────────────────────────────────────────────────

function toBlocks(results: RankedResult[], _analysis: QueryAnalysis): ContextBlock[] {
  return results.map((r): ContextBlock => ({
    memoryType:   MEMORY_TYPE_LABEL[r.type] ?? 'document-memory',
    id:           r.id,
    // Chunk candidates carry their parent doc ID so links resolve correctly.
    docId:        r.metadata.docId ?? r.id,
    title:        r.title,
    relevance:    Math.round(r.relevanceScore * 100) / 100,
    date:         r.metadata.date ? humanDate(r.metadata.date) : undefined,
    sourceLabel:  r.metadata.sourceLabel,
    topicTags:    r.metadata.topicTags?.filter(Boolean).slice(0, 3),
    confidence:   r.metadata.confidence,
    summary:      r.snippet.slice(0, MAX_CHARS_PER_BLOCK),
    slug:         r.type === 'topic' ? toSlug(r.title) : undefined,
    url:          r.metadata.url,
  }))
}

// ─── budget management ────────────────────────────────────────────────────────

function applyBudget(blocks: ContextBlock[]): ContextBlock[] {
  const kept: ContextBlock[] = []
  let total = 0

  for (const b of blocks) {
    if (kept.length >= MAX_BLOCKS) break
    const size = blockCharCount(b)
    if (total + size > MAX_TOTAL_CHARS) {
      // Try a shorter version of the summary
      const shortened = { ...b, summary: b.summary.slice(0, 150) + '…' }
      const shortSize = blockCharCount(shortened)
      if (total + shortSize <= MAX_TOTAL_CHARS) {
        kept.push(shortened)
        total += shortSize
      }
      // If even the short version doesn't fit, stop
      break
    }
    kept.push(b)
    total += size
  }
  return kept
}

function blockCharCount(b: ContextBlock): number {
  return (
    b.memoryType.length +
    b.title.length +
    (b.summary?.length ?? 0) +
    (b.date?.length ?? 0) +
    50  // overhead for the template strings
  )
}

// ─── prompt formatting ────────────────────────────────────────────────────────

/**
 * Produces a prompt string like:
 *
 * DOCUMENT: "Telegram AI agents rising"  (/documents/doc_abc123)
 * source: Signal | date: 1 May 2026 | relevance: 0.87
 * Rising signal detected from YouTube titles and saved notes.
 *
 * TOPIC: AI Agents  (/topic/ai-agents)
 * relevance: 0.72
 * Research area covering autonomous AI agents and their applications.
 *
 * Headers are intentionally NOT bracket-notation so the model doesn't echo
 * them verbatim. Links are embedded inline so the model never needs to guess.
 */
export function formatForPrompt(blocks: ContextBlock[]): string {
  if (blocks.length === 0) return ''

  const parts = blocks.map((b) => {
    // Human-readable type label — avoids bracket markers that small models echo
    const typeLabel =
      b.memoryType === 'document-memory' ? 'DOCUMENT' :
      b.memoryType === 'signal-memory'   ? 'SIGNAL'   :
      b.memoryType === 'topic-memory'    ? 'TOPIC'    :
      b.memoryType === 'behavior-memory' ? 'MEMORY'   :
      'ITEM'

    // Primary link in the header — prefer external source URL for web content;
    // fall back to internal SPA path for locally-pasted documents and topics.
    let headerLink = ''
    if (b.url)                                          headerLink = `  (${b.url})`
    else if (b.memoryType === 'document-memory')        headerLink = `  (/documents/${b.docId})`
    else if (b.memoryType === 'topic-memory' && b.slug) headerLink = `  (/topic/${b.slug})`

    const header = `${typeLabel}: "${b.title}"${headerLink}`

    // Compact meta line — only populate fields that have values
    const meta: string[] = [`relevance: ${b.relevance}`]
    if (b.sourceLabel)              meta.push(`source: ${b.sourceLabel}`)
    if (b.date)                     meta.push(`date: ${b.date}`)
    if (b.confidence !== undefined) meta.push(`confidence: ${b.confidence}/100`)
    if (b.topicTags?.length)        meta.push(`tags: ${b.topicTags.join(', ')}`)

    // When both a source URL and an internal doc link exist, expose both so
    // the model can use whichever makes more sense (cite source OR navigate in app).
    const lines: string[] = [header, meta.join(' | ')]
    if (b.url && b.memoryType === 'document-memory') {
      lines.push(`FlowMap link: /documents/${b.docId}`)
    }
    lines.push(b.summary)

    return lines.join('\n')
  })

  return parts.join('\n\n')
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function humanDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return iso
  }
}

/** Derive a URL slug from a topic name the same way the app does.
 *  "AI IDEs" → "ai-ides",  "LLM Agents & Tools" → "llm-agents-tools"
 */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
