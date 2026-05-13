/**
 * Convert raw extracted document text into normalized Markdown.
 *
 * Strategy: line-by-line state machine that detects structural elements
 * (headings, code blocks, lists, paragraphs) and emits clean Markdown.
 * Runs entirely client-side — no network, no new dependencies.
 *
 * Intentionally conservative: prefer readable prose over aggressive guessing.
 * When ambiguous, join lines into a paragraph rather than mis-classifying.
 */

export const PROCESSING_VERSION = '2'

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param {string} rawText   Extracted text from the document parser
 * @param {string} mimeType  Original MIME type (used to detect already-Markdown files)
 * @returns {string}         Normalized Markdown
 */
export function normalizeMarkdown(rawText, mimeType = '') {
  const text = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()

  if (!text) return ''

  // .md / text/markdown files are already structured — light cleanup only
  if (/markdown|text\/x-md/i.test(mimeType)) {
    return text.replace(/\n{4,}/g, '\n\n\n').trim()
  }

  return convertToMarkdown(text)
}

// ── Heading detection ─────────────────────────────────────────────────────────

// "Chapter 1", "Section 2", "Appendix A", etc.
const CHAPTER_WORD_RE = /^(chapter|section|part|unit|module|lesson|topic|appendix|introduction|conclusion|summary|overview|background|references?|bibliography)\b/i

// Numbered section: "1.2 Title", "1.2.3 Title" — requires at least N.M format.
// Plain "1. Item" is a list item (caught by NUMBERED_ITEM_RE), not a heading.
const NUMBERED_SECTION_RE = /^\d+\.\d[\d.]*\s+\S/

function isHeadingCandidate(line) {
  const t = line.trim()
  if (!t || t.length > 100) return false
  if (/^#{1,6}\s/.test(t)) return true
  if (CHAPTER_WORD_RE.test(t)) return true
  if (NUMBERED_SECTION_RE.test(t) && !/[.!?]$/.test(t)) return true
  if (isAllCaps(t) && t.length >= 3 && t.length <= 80 && !/^\d/.test(t)) return true
  return false
}

function isAllCaps(str) {
  const letters = str.replace(/[^a-zA-Z]/g, '')
  if (letters.length < 2) return false
  return (letters.match(/[A-Z]/g) || []).length / letters.length > 0.82
}

function buildHeading(line) {
  const t = line.trim()
  if (/^#{1,6}\s/.test(t)) return t  // already markdown

  const level = calcHeadingLevel(t)
  const cleaned = isAllCaps(t) ? toTitleCase(t) : t
  return '#'.repeat(level) + ' ' + cleaned
}

function calcHeadingLevel(t) {
  if (CHAPTER_WORD_RE.test(t)) return 2
  // Count dot segments: "1. " → level 2, "1.2 " → level 3, "1.2.3 " → level 4
  const m = t.match(/^(\d+\.)+/)
  if (m) return Math.min(4, m[0].split('.').filter(Boolean).length + 1)
  return 2 // ALL CAPS default
}

function toTitleCase(str) {
  const MINOR = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on',
    'at', 'to', 'by', 'in', 'of', 'up', 'as', 'is', 'it'])
  return str.toLowerCase().split(/\s+/).map((word, i) => {
    const w = word.replace(/[^a-z0-9]/gi, '')
    if (!w) return word
    // Capitalize first *letter* in word, skipping leading punctuation like '['
    return (i === 0 || !MINOR.has(w)) ? word.replace(/[a-zA-Z]/, (c) => c.toUpperCase()) : word
  }).join(' ')
}

// ── Code block detection ──────────────────────────────────────────────────────

const CODE_START_RE = /^(import |from |def |class |function |const |let |var |if |else\b|elif|for |while |return |print\(|console\.|#include|public |private |void |int |float |double |>>> |> \w|% |\$ )/
const INDENT_RE = /^( {4}|\t)\S/

function looksLikeCode(line) {
  const t = line.trim()
  if (!t) return false
  if (CODE_START_RE.test(t)) return true
  if (INDENT_RE.test(line)) return true
  // Has assignment-like structure: word = something, no spaces around content
  if (/^\w+\s*=\s*\S/.test(t) && t.length < 120) return true
  // Multiple code-like symbols — threshold 5 to avoid false-positives in prose with (parens) and [brackets]
  const symbols = (t.match(/[=;{}[\]()]/g) || []).length
  if (symbols >= 5) return true
  return false
}

// ── List detection ────────────────────────────────────────────────────────────

const UNICODE_BULLET_RE = /^[•·◦‣▸▹●○◆◇▪▫]\s+/
const MD_BULLET_RE = /^[-*+]\s+\S/
const NUMBERED_ITEM_RE = /^\d+[.)]\s+\S/

function isListItem(line) {
  const t = line.trim()
  return UNICODE_BULLET_RE.test(t) || MD_BULLET_RE.test(t) || NUMBERED_ITEM_RE.test(t)
}

function normalizeListItem(line) {
  const t = line.trim()
  if (UNICODE_BULLET_RE.test(t)) return '- ' + t.replace(UNICODE_BULLET_RE, '')
  if (MD_BULLET_RE.test(t)) return '- ' + t.replace(/^[-*+]\s+/, '')
  if (NUMBERED_ITEM_RE.test(t)) return t.replace(/^(\d+)[.)]\s+/, '$1. ')
  return '- ' + t
}

// ── Inline code hints ─────────────────────────────────────────────────────────
// Wraps obvious function calls and module.attribute references in prose.
// Only applied to paragraph text, not headings or list items.

function wrapInlineCode(text) {
  // Skip if the text looks like it's already inside a code block
  if (text.startsWith('    ') || text.startsWith('\t')) return text

  return text
    // Already-backtick content — preserve
    .replace(/`[^`]+`/g, (m) => m)
    // function calls: word() or word.word()
    .replace(/(?<!`)\b([\w_]+(?:\.[\w_]+)*)\(\)/g, (m, fn) => {
      // Don't wrap common English words ending in ()
      const lower = fn.toLowerCase()
      if (['etc', 'e.g', 'i.e'].includes(lower)) return m
      return '`' + m + '`'
    })
    // module.attribute: response.status_code, data["key"]
    .replace(/(?<!`)\b(response|request|req|res|data|result|error|output|config|settings|options)\.([\w_]+)\b(?![(`])/g,
      (_, obj, attr) => '`' + obj + '.' + attr + '`')
}

// ── Main conversion engine ────────────────────────────────────────────────────

function convertToMarkdown(text) {
  const lines = text.split('\n')
  const out = []   // output lines
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()

    // ── Blank line ──
    if (!t) {
      if (out.length && out[out.length - 1] !== '') out.push('')
      i++
      continue
    }

    // ── Already-markdown code fence ──
    if (t.startsWith('```')) {
      const fence = [t]
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        fence.push(lines[i])
        i++
      }
      if (i < lines.length) { fence.push('```'); i++ }
      out.push(fence.join('\n'))
      out.push('')
      continue
    }

    // ── Horizontal rule ──
    if (/^[-*_]{3,}$/.test(t)) {
      out.push('---')
      out.push('')
      i++
      continue
    }

    // ── Underline-style heading (setext) ──
    //   "Title\n=====" or "Title\n-----"
    if (i + 1 < lines.length) {
      const under = lines[i + 1].trim()
      if (/^={3,}$/.test(under)) {
        out.push('# ' + t)
        out.push('')
        i += 2
        continue
      }
      if (/^-{3,}$/.test(under) && t.length <= 80 && !t.includes('.')) {
        out.push('## ' + t)
        out.push('')
        i += 2
        continue
      }
    }

    // ── Heading ──
    if (isHeadingCandidate(t)) {
      out.push(buildHeading(t))
      out.push('')
      i++
      continue
    }

    // ── Code block ──
    // Collect a run of code-like lines
    if (looksLikeCode(line)) {
      const codeLines = [line.trimEnd()]
      i++
      while (i < lines.length) {
        const next = lines[i]
        const nt = next.trim()
        if (!nt) {
          // A blank line inside a code run: include it only if the next non-blank line is also code
          const after = lines.slice(i + 1).find((l) => l.trim())
          if (after && looksLikeCode(after)) {
            codeLines.push('')
            i++
          } else {
            break
          }
        } else if (looksLikeCode(next) || INDENT_RE.test(next)) {
          codeLines.push(next.trimEnd())
          i++
        } else {
          break
        }
      }
      // Only promote to a code fence if 2+ lines — avoids false positives
      if (codeLines.length >= 2) {
        const body = codeLines.map((l) => l.replace(/^    /, '')).join('\n')
        out.push('```')
        out.push(body)
        out.push('```')
      } else {
        // Single ambiguous line — treat as paragraph
        out.push(wrapInlineCode(codeLines[0].trim()))
      }
      out.push('')
      continue
    }

    // ── List items ──
    if (isListItem(t)) {
      const items = [normalizeListItem(t)]
      i++
      while (i < lines.length) {
        const nt = lines[i].trim()
        if (!nt) break
        if (isListItem(nt)) {
          items.push(normalizeListItem(nt))
          i++
        } else if (/^[ \t]{2,}/.test(lines[i]) && items.length) {
          // Continuation of last item (indented continuation line)
          items[items.length - 1] += ' ' + nt
          i++
        } else {
          break
        }
      }
      out.push(items.join('\n'))
      out.push('')
      continue
    }

    // ── Paragraph ──
    // Collect soft-wrapped lines into a single flowing paragraph.
    // Stop when we hit a blank line, a heading, a list item, or a code line.
    const paraLines = [t]
    i++
    while (i < lines.length) {
      const nt = lines[i].trim()
      if (!nt) break
      if (isHeadingCandidate(nt)) break
      if (isListItem(nt)) break
      if (looksLikeCode(lines[i])) break
      if (/^[-*_]{3,}$/.test(nt)) break
      if (nt.startsWith('```')) break
      paraLines.push(nt)
      i++
    }

    // Apply inline code hints to the joined paragraph
    out.push(wrapInlineCode(paraLines.join(' ')))
    out.push('')
  }

  // Clean up: collapse excessive blank lines, trim
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
