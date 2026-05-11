/**
 * MarkdownViewer — renders the Markdown produced by normalizeMarkdown.js.
 *
 * Handles the specific constructs the normalizer emits:
 *   # headings (h1–h4)
 *   ``` fenced code blocks
 *   - / 1. lists
 *   > blockquotes
 *   --- horizontal rules
 *   **bold**, *italic*, `inline code`, [text](url)  (inline)
 *
 * Styled to feel native inside FlowMap's light document panel.
 */

// ── Inline formatter ──────────────────────────────────────────────────────────

let _inlineKey = 0
function nextKey() { return _inlineKey++ }

function parseInline(text) {
  const parts = []
  let rest = text

  // Patterns in priority order: longer markers first to avoid partial matches
  const PATTERNS = [
    { re: /\*\*(.+?)\*\*/,  render: (m) => <strong key={nextKey()} className="font-semibold text-gray-900">{parseInline(m[1])}</strong> },
    { re: /\*([^*]+)\*/,    render: (m) => <em key={nextKey()} className="italic">{parseInline(m[1])}</em> },
    { re: /`([^`]+)`/,      render: (m) => <code key={nextKey()} className="px-1 py-0.5 rounded text-[12px] font-mono bg-slate-200 text-teal-700">{m[1]}</code> },
    { re: /\[([^\]]+)\]\(([^)]+)\)/, render: (m) => (
      <a key={nextKey()} href={m[2]} target="_blank" rel="noopener noreferrer"
         className="text-teal-700 underline underline-offset-2 hover:text-teal-900">
        {m[1]}
      </a>
    )},
  ]

  while (rest) {
    let earliest = null
    let earliestIdx = Infinity
    let earliestPat = null

    for (const p of PATTERNS) {
      const m = rest.match(p.re)
      if (m && m.index < earliestIdx) {
        earliest = m
        earliestIdx = m.index
        earliestPat = p
      }
    }

    if (!earliest) { parts.push(rest); break }

    if (earliestIdx > 0) parts.push(rest.slice(0, earliestIdx))
    parts.push(earliestPat.render(earliest))
    rest = rest.slice(earliestIdx + earliest[0].length)
  }

  return parts
}

function Inline({ text }) {
  _inlineKey = 0
  return <>{parseInline(text)}</>
}

// ── Block parser ──────────────────────────────────────────────────────────────

function parseBlocks(markdown) {
  const lines = markdown.split('\n')
  const blocks = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const t = line.trim()

    if (!t) { i++; continue }

    // Fenced code block
    if (t.startsWith('```')) {
      const lang = t.slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // consume closing fence
      blocks.push({ type: 'code', lang, content: codeLines.join('\n') })
      continue
    }

    // Heading
    const hm = t.match(/^(#{1,6})\s+(.+)$/)
    if (hm) {
      blocks.push({ type: 'heading', level: hm[1].length, content: hm[2] })
      i++
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(t)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }

    // Blockquote
    if (t.startsWith('> ')) {
      const qLines = []
      while (i < lines.length) {
        const qt = lines[i].trim()
        if (qt.startsWith('> ')) { qLines.push(qt.slice(2)); i++ }
        else break
      }
      blocks.push({ type: 'blockquote', content: qLines.join(' ') })
      continue
    }

    // Unordered list
    if (/^[-*+]\s+/.test(t)) {
      const items = []
      while (i < lines.length) {
        const lt = lines[i].trim()
        if (/^[-*+]\s+/.test(lt)) { items.push(lt.replace(/^[-*+]\s+/, '')); i++ }
        else if (/^\s{2,}/.test(lines[i]) && items.length) {
          // indented continuation
          items[items.length - 1] += ' ' + lt
          i++
        }
        else break
      }
      blocks.push({ type: 'ul', items })
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(t)) {
      const items = []
      while (i < lines.length) {
        const lt = lines[i].trim()
        if (/^\d+\.\s+/.test(lt)) { items.push(lt.replace(/^\d+\.\s+/, '')); i++ }
        else if (/^\s{2,}/.test(lines[i]) && items.length) {
          items[items.length - 1] += ' ' + lt
          i++
        }
        else break
      }
      blocks.push({ type: 'ol', items })
      continue
    }

    // Paragraph: collect consecutive non-special lines
    const pLines = []
    while (i < lines.length) {
      const pt = lines[i].trim()
      if (!pt) { i++; break }
      if (
        pt.startsWith('```') ||
        /^#{1,6}\s/.test(pt) ||
        /^---+$/.test(pt) ||
        /^[-*+]\s+/.test(pt) ||
        /^\d+\.\s+/.test(pt) ||
        pt.startsWith('> ')
      ) break
      pLines.push(pt)
      i++
    }
    if (pLines.length) blocks.push({ type: 'paragraph', content: pLines.join(' ') })
  }

  return blocks
}

// ── Block renderers ───────────────────────────────────────────────────────────

const HEADING_CLASSES = {
  1: 'text-2xl font-bold text-gray-900 mt-8 mb-3 first:mt-0',
  2: 'text-xl font-semibold text-gray-800 mt-6 mb-2 first:mt-0',
  3: 'text-base font-semibold text-gray-800 mt-5 mb-1.5',
  4: 'text-sm font-semibold text-gray-700 uppercase tracking-wide mt-4 mb-1',
}

function RenderBlock({ block, idx }) {
  switch (block.type) {
    case 'heading': {
      const Tag = `h${Math.min(block.level, 4)}`
      return <Tag className={HEADING_CLASSES[Math.min(block.level, 4)] || HEADING_CLASSES[4]}><Inline text={block.content} /></Tag>
    }

    case 'code':
      return (
        <pre className="my-4 rounded-lg overflow-x-auto text-[12.5px] leading-relaxed font-mono"
             style={{ background: '#0d0f18', border: '1px solid rgba(45,212,191,0.18)', padding: '14px 18px', color: '#a5d6ff' }}>
          <code>{block.content}</code>
        </pre>
      )

    case 'hr':
      return <hr key={idx} className="my-6 border-gray-200" />

    case 'blockquote':
      return (
        <blockquote className="pl-4 border-l-2 border-teal-400 italic text-gray-600 text-sm my-3">
          <Inline text={block.content} />
        </blockquote>
      )

    case 'ul':
      return (
        <ul className="my-3 pl-5 space-y-1 list-disc marker:text-teal-500">
          {block.items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed text-gray-700"><Inline text={item} /></li>
          ))}
        </ul>
      )

    case 'ol':
      return (
        <ol className="my-3 pl-5 space-y-1 list-decimal marker:text-gray-400 marker:text-xs">
          {block.items.map((item, j) => (
            <li key={j} className="text-sm leading-relaxed text-gray-700"><Inline text={item} /></li>
          ))}
        </ol>
      )

    case 'paragraph':
      return (
        <p className="text-sm leading-relaxed text-gray-700 my-2">
          <Inline text={block.content} />
        </p>
      )

    default:
      return null
  }
}

// ── Public component ──────────────────────────────────────────────────────────

export default function MarkdownViewer({ markdown }) {
  if (!markdown) return null

  const blocks = parseBlocks(markdown)

  return (
    <div className="prose-doc max-w-none">
      {blocks.map((block, i) => (
        <RenderBlock key={i} block={block} idx={i} />
      ))}
    </div>
  )
}
