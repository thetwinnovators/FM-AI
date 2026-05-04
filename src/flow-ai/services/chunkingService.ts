/**
 * Chunking service — splits documents into semantically coherent units for
 * embedding and retrieval.
 *
 * Design choices:
 *   - Paragraph-boundary splitting: respects authorial structure wherever
 *     possible. Adjacent paragraphs are merged to reach the target size.
 *   - Sentence-boundary overflow handling: very long single paragraphs are
 *     split at sentence ends so no chunk exceeds MAX_WORDS.
 *   - Short-document passthrough: texts under CHUNK_THRESHOLD chars are
 *     returned as a single chunk to avoid unnecessary overhead.
 *   - Stable IDs: `${docId}_c${index}` — repeatable across re-indexing runs
 *     so the embedding cache (keyed by ID) survives re-chunking as long as
 *     the document text doesn't change.
 */

// ─── types ────────────────────────────────────────────────────────────────────

export interface Chunk {
  id:         string   // `${docId}_c${chunkIndex}`
  docId:      string
  chunkIndex: number
  text:       string
  wordCount:  number
}

// ─── configuration ────────────────────────────────────────────────────────────

const TARGET_WORDS    = 300   // aim to keep chunks near this size
const MAX_WORDS       = 420   // hard cap before we split a paragraph
const MIN_WORDS       = 50    // merge orphan paragraphs below this
const CHUNK_THRESHOLD = 600   // chars — docs shorter than this skip chunking

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Split a document's plainText into chunks.
 *
 * @param docId    The document's canonical ID (used to build chunk IDs).
 * @param text     The full plainText of the document.
 * @returns        Array of Chunk objects, in reading order.
 *                 Returns a single chunk for short documents.
 */
export function chunkDocument(docId: string, text: string): Chunk[] {
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

  if (!normalised) return []

  // Short documents: one chunk, no splitting overhead
  if (normalised.length < CHUNK_THRESHOLD) {
    return [makeChunk(docId, 0, normalised)]
  }

  const paragraphs = splitParagraphs(normalised)
  const merged     = mergeParagraphs(paragraphs)
  return merged.map((text, i) => makeChunk(docId, i, text))
}

/**
 * Return the character threshold below which a document is treated as a
 * single chunk.  Exposed so callers can decide whether to chunk before calling.
 */
export const CHUNK_THRESHOLD_CHARS = CHUNK_THRESHOLD

// ─── paragraph splitting ──────────────────────────────────────────────────────

/**
 * Split text on blank-line boundaries.
 * Consecutive blank lines collapse to a single split; leading/trailing
 * whitespace is stripped from each paragraph.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

// ─── paragraph merging ────────────────────────────────────────────────────────

/**
 * Merge adjacent paragraphs into chunks of roughly TARGET_WORDS words.
 *
 * Algorithm:
 *   1. Walk paragraphs in order.
 *   2. Accumulate into a running buffer until TARGET_WORDS is reached.
 *   3. If a single paragraph exceeds MAX_WORDS, split it at sentence boundaries.
 *   4. If a paragraph is tiny (< MIN_WORDS) and not the last, roll it into the
 *      next paragraph instead of making a microscopic chunk.
 */
function mergeParagraphs(paragraphs: string[]): string[] {
  const chunks: string[] = []
  let buffer: string[] = []
  let bufferWords = 0

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]
    const wc   = wordCount(para)

    // Oversized single paragraph: split at sentence boundaries first
    if (wc > MAX_WORDS) {
      // Flush current buffer before dealing with the giant paragraph
      if (buffer.length > 0) {
        chunks.push(buffer.join('\n\n'))
        buffer = []
        bufferWords = 0
      }
      const sentences = splitAtSentences(para, MAX_WORDS)
      chunks.push(...sentences)
      continue
    }

    // Tiny orphan: peek forward — if next paragraph exists, skip for now
    // so we can merge them.  On the last paragraph always flush.
    const isLast = i === paragraphs.length - 1
    if (wc < MIN_WORDS && !isLast && bufferWords + wc < TARGET_WORDS) {
      buffer.push(para)
      bufferWords += wc
      continue
    }

    buffer.push(para)
    bufferWords += wc

    // Flush when we've hit or passed the target
    if (bufferWords >= TARGET_WORDS) {
      chunks.push(buffer.join('\n\n'))
      buffer = []
      bufferWords = 0
    }
  }

  // Remaining buffer
  if (buffer.length > 0) {
    const leftover = buffer.join('\n\n')
    // If leftover is tiny and there are existing chunks, append to last
    if (wordCount(leftover) < MIN_WORDS && chunks.length > 0) {
      chunks[chunks.length - 1] += '\n\n' + leftover
    } else {
      chunks.push(leftover)
    }
  }

  return chunks.filter((c) => c.trim().length > 0)
}

// ─── sentence-boundary splitting ─────────────────────────────────────────────

/**
 * Split a single long paragraph at sentence ends.
 * Sentences are detected by `. `, `? `, `! ` (not abbreviations).
 * Falls back to hard word-count splitting if no sentence boundaries are found.
 */
function splitAtSentences(text: string, maxWords: number): string[] {
  // Simple sentence tokeniser — split after punctuation followed by whitespace
  // and an uppercase letter (reduces false-positives on e.g. "Inc. said…").
  const sentenceRe = /(?<=[.?!])\s+(?=[A-Z"'«\[])/g
  const sentences  = text.split(sentenceRe).filter((s) => s.trim())

  if (sentences.length <= 1) {
    // No sentence boundaries — hard-split by word count
    return hardSplitByWords(text, maxWords)
  }

  const chunks: string[] = []
  let buffer: string[] = []
  let bufferWords = 0

  for (const sentence of sentences) {
    const wc = wordCount(sentence)
    buffer.push(sentence)
    bufferWords += wc
    if (bufferWords >= TARGET_WORDS) {
      chunks.push(buffer.join(' '))
      buffer = []
      bufferWords = 0
    }
  }
  if (buffer.length > 0) chunks.push(buffer.join(' '))

  return chunks.filter((c) => c.trim().length > 0)
}

/**
 * Last-resort word-count split when no paragraph or sentence boundaries exist
 * (e.g. code blocks, dense JSON, continuous prose without punctuation).
 */
function hardSplitByWords(text: string, maxWords: number): string[] {
  const words  = text.split(/\s+/)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '))
  }
  return chunks
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

function makeChunk(docId: string, index: number, text: string): Chunk {
  return {
    id:         `${docId}_c${index}`,
    docId,
    chunkIndex: index,
    text:       text.trim(),
    wordCount:  wordCount(text),
  }
}
