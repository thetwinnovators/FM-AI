import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { Highlight, themes } from 'prism-react-renderer'

// ─── Block parser ────────────────────────────────────────────────────────────

/**
 * Split markdown content into a flat list of block objects.
 * Exported so it can be unit-tested independently.
 *
 * Block shapes:
 *   { type: 'heading',   level: 1|2|3…, text: string }
 *   { type: 'list',      ordered: boolean, items: string[] }
 *   { type: 'code',      lang: string, code: string }
 *   { type: 'paragraph', text: string }
 */
export function parseBlocks(content) {
  if (!content) return []
  const blocks = []
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code fence — read until closing ``` or end of content
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim().toLowerCase()
      const buf = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // skip closing fence if present
      blocks.push({ type: 'code', lang, code: buf.join('\n') })
      continue
    }

    // ATX heading  #  ##  ###  …
    const h = line.match(/^(#{1,6})\s+(.+)$/)
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() })
      i++
      continue
    }

    // List — consecutive lines starting with -  *  +  or  N.
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const itemText = line.replace(/^\s*([-*+]|\d+\.)\s+/, '')

      // Numbered item whose entire content is **Bold text** or **Bold text:**
      // → treat as a section heading rather than a list item
      if (ordered && /^\*\*[^*]+\*\*:?\s*$/.test(itemText)) {
        const headingText = itemText.replace(/^\*\*/, '').replace(/\*\*:?\s*$/, '')
        blocks.push({ type: 'heading', level: 3, text: headingText })
        i++
        continue
      }

      const items = []
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        // Stop if list marker type switches (ordered ↔ unordered)
        const lineOrdered = /^\s*\d+\./.test(lines[i])
        if (lineOrdered !== ordered) break
        items.push(lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, ''))
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }

    // Blank line — ignored
    if (!line.trim()) {
      i++
      continue
    }

    // Paragraph — gather consecutive non-blank, non-block-start lines
    const buf = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|```|\s*([-*]|\d+\.)\s)/.test(lines[i])
    ) {
      buf.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', text: buf.join(' ') })
  }

  return blocks
}

// ─── Inline renderer ─────────────────────────────────────────────────────────

// Matches (in order): markdown link, bare external URL, bare internal FlowMap
// path, inline code, bold (**), italic (* or _).
const INLINE_RE = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>"')\]]+)|(\/(?:topics|documents|discover|memory|chat|education|search)(?:\/[A-Za-z0-9_-]+)?|\/topic\/[A-Za-z0-9_-]+)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/g

export function renderInlineText(text) {
  if (!text) return null
  const parts = []
  let last = 0
  let key = 0
  // Reset lastIndex each call — the regex is module-level so we clone flags
  const re = new RegExp(INLINE_RE.source, 'g')

  for (const m of String(text).matchAll(re)) {
    if (m.index > last) parts.push(text.slice(last, m.index))

    if (m[1] != null) {
      // [label](href)
      const label = m[1], href = m[2]
      if (href.startsWith('/')) {
        parts.push(
          <Link key={key++} to={href} onClick={(e) => e.stopPropagation()}
            className="underline text-teal-300 hover:text-teal-100 transition-colors">
            {label}
          </Link>
        )
      } else {
        parts.push(
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer"
            className="underline text-teal-300 hover:text-teal-100 transition-colors">
            {label}
          </a>
        )
      }
    } else if (m[3] != null) {
      // Bare external URL
      parts.push(
        <a key={key++} href={m[3]} target="_blank" rel="noopener noreferrer"
          className="underline text-teal-300/70 hover:text-teal-300 transition-colors break-all">
          {m[3]}
        </a>
      )
    } else if (m[4] != null) {
      // Bare internal FlowMap path
      parts.push(
        <Link key={key++} to={m[4]} onClick={(e) => e.stopPropagation()}
          className="underline text-teal-300/70 hover:text-teal-300 transition-colors break-all">
          {m[4]}
        </Link>
      )
    } else if (m[5] != null) {
      parts.push(
        <code key={key++} className="bg-white/10 px-1 rounded font-mono text-sm">{m[5]}</code>
      )
    } else if (m[6] != null) {
      parts.push(<strong key={key++} className="font-semibold">{m[6]}</strong>)
    } else if (m[7] != null || m[8] != null) {
      parts.push(<em key={key++}>{m[7] ?? m[8]}</em>)
    }

    last = m.index + m[0].length
  }

  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : text
}

// ─── CodeBlock sub-component ─────────────────────────────────────────────────

// Languages where the Preview button is shown (browser can execute these).
const PREVIEW_LANGS = new Set(['html', ''])

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef(null)
  const showPreview = PREVIEW_LANGS.has(lang)

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = code
        el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      } catch { /* truly blocked — feedback still shows */ }
    }
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    setCopied(true)
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  function handlePreview() {
    const html = [
      '<!DOCTYPE html><html><head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<style>body{margin:0;font-family:system-ui,sans-serif}</style>',
      `</head><body>${code}</body></html>`,
    ].join('')
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="rounded-xl bg-white/[0.05] border border-white/[0.08] overflow-hidden mb-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-white/[0.06]">
        <span className="text-[11px] text-white/40 font-mono">{lang || 'code'}</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="text-[11px] flex items-center gap-1 text-white/40 hover:text-white/80 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {showPreview && (
            <button
              type="button"
              onClick={handlePreview}
              className="text-[11px] flex items-center gap-1 text-white/40 hover:text-white/80 transition-colors"
            >
              <ExternalLink size={12} />
              Preview
            </button>
          )}
        </div>
      </div>
      {/* Code body — syntax highlighted */}
      <Highlight
        theme={themes.oneDark}
        code={code}
        language={lang || 'text'}
      >
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre
            className="px-4 py-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words m-0 max-h-[640px] overflow-y-auto"
            style={{ background: 'transparent' }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  )
}

// ─── ChatMessage (default export) ────────────────────────────────────────────

export default function ChatMessage({ content }) {
  const blocks = parseBlocks(content)

  return (
    <div className="text-sm font-light font-chat">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'code':
            return <CodeBlock key={idx} lang={block.lang} code={block.code} />

          case 'heading':
            return block.level === 1
              ? <h2 key={idx} className="text-2xl font-bold text-white mt-5 mb-2 first:mt-0">{renderInlineText(block.text)}</h2>
              : <h3 key={idx} className="text-xl font-bold text-white mt-5 mb-2 first:mt-0">{renderInlineText(block.text)}</h3>

          case 'list':
            return block.ordered
              ? (
                <ol key={idx} className="list-decimal pl-5 space-y-1 mb-3 text-stone-300">
                  {block.items.map((item, i) => <li key={i}>{renderInlineText(item)}</li>)}
                </ol>
              )
              : (
                <ul key={idx} className="list-disc pl-5 space-y-1 mb-3 text-stone-300">
                  {block.items.map((item, i) => <li key={i}>{renderInlineText(item)}</li>)}
                </ul>
              )

          default: // paragraph
            return <p key={idx} className="text-stone-300 mb-3 last:mb-0">{renderInlineText(block.text)}</p>
        }
      })}
    </div>
  )
}
