import type { TaskTranscriptEntry } from '../types.js'

// ---------------------------------------------------------------------------
// Prompt section types
// ---------------------------------------------------------------------------

export interface PromptSection {
  tag: string   // e.g. '[SYSTEM]', '[TOOLS]', '[RULES]'
  body: string
}

// ---------------------------------------------------------------------------
// Canonical section ordering
// Fixed order: SYSTEM → TOOLS → RULES → any unknowns alphabetically
// ---------------------------------------------------------------------------

const CANONICAL_ORDER: Record<string, number> = {
  '[SYSTEM]': 0,
  '[TOOLS]':  1,
  '[RULES]':  2,
}

function sectionSortKey(tag: string): string {
  // Known tags get a numeric prefix so they sort before unknowns
  const knownRank = CANONICAL_ORDER[tag]
  if (knownRank !== undefined) {
    return `0_${String(knownRank).padStart(3, '0')}_${tag}`
  }
  // Unknown tags sort alphabetically after the known three
  return `1_${tag}`
}

/**
 * Builds a stable, cache-friendly system prompt.
 * Sections are emitted in canonical order: SYSTEM → TOOLS → RULES → others alphabetically.
 * Joined with '\n\n' between sections, each formatted as:
 *   <tag>\n<body>
 */
export function buildStablePrompt(sections: PromptSection[]): string {
  const sorted = [...sections].sort((a, b) =>
    sectionSortKey(a.tag).localeCompare(sectionSortKey(b.tag))
  )
  return sorted.map((s) => `${s.tag}\n${s.body}`).join('\n\n')
}

/**
 * Returns a [TOOLS] section whose body is sorted tool names, one per line,
 * each prefixed with '- '.
 */
export function buildToolSection(toolNames: string[]): PromptSection {
  const sorted = [...toolNames].sort((a, b) => a.localeCompare(b))
  return {
    tag: '[TOOLS]',
    body: sorted.map((n) => `- ${n}`).join('\n'),
  }
}

// ---------------------------------------------------------------------------
// Transcript serialisation
// ---------------------------------------------------------------------------

/**
 * Serialises transcript entries to a string block for prompt injection.
 *
 * Format per entry:
 *   [<TYPE> #<seq>] <toolName or ''>  (<timestamp ISO, date only>)
 *   <content>
 *   [status: <status>]       ← only if entry has a status field
 *   [error: <errorReason>]   ← only if status === 'failed'
 *   [retry of #<retryOf>]    ← only if retryOf is set
 *
 * Entries separated by a blank line.
 */
export function serializeTranscript(entries: TaskTranscriptEntry[]): string {
  if (entries.length === 0) return ''

  return entries.map((entry) => {
    const toolPart = entry.toolName ? ` ${entry.toolName} ` : ' '
    const datePart = entry.timestamp.slice(0, 10) // ISO date only: YYYY-MM-DD
    const header = `[${entry.type.toUpperCase()} #${entry.seq}]${toolPart}(${datePart})`

    const lines: string[] = [header, entry.content]

    if (entry.status !== undefined) {
      lines.push(`[status: ${entry.status}]`)
    }
    if (entry.status === 'failed' && entry.errorReason !== undefined) {
      lines.push(`[error: ${entry.errorReason}]`)
    }
    if (entry.retryOf !== undefined) {
      lines.push(`[retry of #${entry.retryOf}]`)
    }

    return lines.join('\n')
  }).join('\n\n')
}

/**
 * Appends a new entry to a transcript array.
 * Never mutates — returns a new array.
 * Automatically assigns seq = last entry's seq + 1 (or 0 if empty).
 */
export function appendTranscriptEntry(
  transcript: TaskTranscriptEntry[],
  entry: Omit<TaskTranscriptEntry, 'seq' | 'timestamp'>
): TaskTranscriptEntry[] {
  const seq = transcript.length === 0
    ? 0
    : transcript[transcript.length - 1].seq + 1

  const newEntry: TaskTranscriptEntry = {
    ...entry,
    seq,
    timestamp: new Date().toISOString(),
  }

  return [...transcript, newEntry]
}
