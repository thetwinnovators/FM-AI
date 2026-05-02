# Chat Markdown Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw-text AI message rendering in FlowMap's chat with proper markdown output — structured headings, lists, bold/italic, and code blocks with Copy + Preview toolbar buttons.

**Architecture:** A new `ChatMessage.jsx` component handles all markdown-to-JSX conversion for assistant messages. It contains a pure `parseBlocks()` function (block-level parser), a `renderInlineText()` function (inline formatting + link detection), and a `CodeBlock` sub-component with copy/preview actions. `Chat.jsx` imports `ChatMessage` and swaps it in for assistant messages only; user messages keep the existing `renderContent()` path.

**Tech Stack:** React 19, lucide-react (already installed), no new dependencies.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/components/chat/ChatMessage.jsx` | Full markdown renderer + CodeBlock sub-component |
| Create | `src/components/chat/__tests__/chatMessage.test.js` | Unit tests for `parseBlocks()` |
| Modify | `src/views/Chat.jsx` | Import ChatMessage; swap in for assistant messages |

---

## Task 1: ChatMessage component (TDD for block parser)

**Files:**
- Create: `src/components/chat/__tests__/chatMessage.test.js`
- Create: `src/components/chat/ChatMessage.jsx`

### Step 1: Create the test file

Create `src/components/chat/__tests__/chatMessage.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { parseBlocks } from '../ChatMessage.jsx'

describe('parseBlocks', () => {
  it('returns empty array for empty input', () => {
    expect(parseBlocks('')).toEqual([])
    expect(parseBlocks(null)).toEqual([])
  })

  it('parses a plain paragraph', () => {
    const blocks = parseBlocks('Hello world')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'paragraph', text: 'Hello world' })
  })

  it('parses a level-1 heading', () => {
    const blocks = parseBlocks('# My Title')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'My Title' })
  })

  it('parses a level-2 heading', () => {
    const blocks = parseBlocks('## Sub Title')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'heading', level: 2, text: 'Sub Title' })
  })

  it('parses an unordered list', () => {
    const blocks = parseBlocks('- Alpha\n- Beta\n- Gamma')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({
      type: 'list',
      ordered: false,
      items: ['Alpha', 'Beta', 'Gamma'],
    })
  })

  it('parses an ordered list', () => {
    const blocks = parseBlocks('1. First\n2. Second\n3. Third')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({
      type: 'list',
      ordered: true,
      items: ['First', 'Second', 'Third'],
    })
  })

  it('parses a code fence with language', () => {
    const blocks = parseBlocks('```html\n<h1>Hi</h1>\n```')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'code', lang: 'html', code: '<h1>Hi</h1>' })
  })

  it('parses a code fence with no language', () => {
    const blocks = parseBlocks('```\nconst x = 1\n```')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'code', lang: '', code: 'const x = 1' })
  })

  it('treats unclosed code fence as a code block to end of content', () => {
    const blocks = parseBlocks('```js\nconst x = 1')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('code')
    expect(blocks[0].code).toBe('const x = 1')
  })

  it('parses multiple blocks separated by blank lines', () => {
    const content = '# Heading\n\nFirst paragraph.\n\n- item one\n- item two'
    const blocks = parseBlocks(content)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].type).toBe('heading')
    expect(blocks[1].type).toBe('paragraph')
    expect(blocks[2].type).toBe('list')
  })

  it('joins consecutive non-blank paragraph lines', () => {
    const blocks = parseBlocks('Line one\nLine two\nLine three')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toBe('Line one Line two Line three')
  })
})
```

### Step 2: Run the test to confirm it fails

```
npx vitest run src/components/chat/__tests__/chatMessage.test.js --reporter verbose 2>&1
```

Expected: FAIL — `parseBlocks` is not exported (file doesn't exist yet).

### Step 3: Create `src/components/chat/ChatMessage.jsx`

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, ExternalLink } from 'lucide-react'

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

    // List — consecutive lines starting with -  *  or  N.
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''))
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

function renderInlineText(text) {
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
            className="underline text-[color:var(--color-article)] hover:text-white transition-colors">
            {label}
          </Link>
        )
      } else {
        parts.push(
          <a key={key++} href={href} target="_blank" rel="noopener noreferrer"
            className="underline text-[color:var(--color-creator)] hover:text-white transition-colors">
            {label}
          </a>
        )
      }
    } else if (m[3] != null) {
      // Bare external URL
      parts.push(
        <a key={key++} href={m[3]} target="_blank" rel="noopener noreferrer"
          className="underline text-[color:var(--color-creator)]/70 hover:text-[color:var(--color-creator)] transition-colors break-all">
          {m[3]}
        </a>
      )
    } else if (m[4] != null) {
      // Bare internal FlowMap path
      parts.push(
        <Link key={key++} to={m[4]} onClick={(e) => e.stopPropagation()}
          className="underline text-[color:var(--color-article)]/80 hover:text-[color:var(--color-article)] transition-colors break-all">
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
const PREVIEW_LANGS = new Set(['html', 'javascript', 'js', ''])

function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false)
  const showPreview = PREVIEW_LANGS.has(lang)

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
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handlePreview() {
    const body = (lang === 'javascript' || lang === 'js')
      ? `<script>${code}<\/script>`
      : code
    const html = [
      '<!DOCTYPE html><html><head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<style>body{margin:0;font-family:system-ui,sans-serif}</style>',
      `</head><body>${body}</body></html>`,
    ].join('')
    const blob = new Blob([html], { type: 'text/html' })
    window.open(URL.createObjectURL(blob), '_blank')
  }

  return (
    <div className="rounded-xl bg-white/[0.05] border border-white/[0.08] overflow-hidden mb-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-white/[0.06]">
        <span className="text-[11px] text-white/40 font-mono">{lang || 'code'}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="text-[11px] flex items-center gap-1 text-white/40 hover:text-white/80 transition-colors"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {showPreview && (
            <button
              onClick={handlePreview}
              className="text-[11px] flex items-center gap-1 text-white/40 hover:text-white/80 transition-colors"
            >
              <ExternalLink size={12} />
              Preview
            </button>
          )}
        </div>
      </div>
      {/* Code body */}
      <pre className="px-4 py-3 overflow-x-auto font-mono text-sm text-white/85 leading-relaxed whitespace-pre m-0">
        <code>{code}</code>
      </pre>
    </div>
  )
}

// ─── ChatMessage (default export) ────────────────────────────────────────────

export default function ChatMessage({ content }) {
  const blocks = parseBlocks(content)

  return (
    <div className="text-base">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'code':
            return <CodeBlock key={idx} lang={block.lang} code={block.code} />

          case 'heading':
            return block.level === 1
              ? <h2 key={idx} className="text-2xl font-semibold text-white/90 mt-4 mb-2 first:mt-0">{renderInlineText(block.text)}</h2>
              : <h3 key={idx} className="text-xl font-semibold text-white/80 mt-3 mb-1.5 first:mt-0">{renderInlineText(block.text)}</h3>

          case 'list':
            return block.ordered
              ? (
                <ol key={idx} className="list-decimal pl-5 space-y-1 mb-3 text-white/85">
                  {block.items.map((item, i) => <li key={i}>{renderInlineText(item)}</li>)}
                </ol>
              )
              : (
                <ul key={idx} className="list-disc pl-5 space-y-1 mb-3 text-white/85">
                  {block.items.map((item, i) => <li key={i}>{renderInlineText(item)}</li>)}
                </ul>
              )

          default: // paragraph
            return <p key={idx} className="text-white/85 mb-3 last:mb-0">{renderInlineText(block.text)}</p>
        }
      })}
    </div>
  )
}
```

### Step 4: Run the test to confirm it passes

```
npx vitest run src/components/chat/__tests__/chatMessage.test.js --reporter verbose 2>&1
```

Expected: 11/11 PASS.

### Step 5: Commit

```bash
git add src/components/chat/ChatMessage.jsx src/components/chat/__tests__/chatMessage.test.js
git commit -m "feat(chat): ChatMessage component — markdown rendering with CodeBlock copy/preview"
```

---

## Task 2: Wire ChatMessage into Chat.jsx

**Files:**
- Modify: `src/views/Chat.jsx`

### Step 1: Add the import

At the top of `src/views/Chat.jsx`, after the existing imports, add:

```js
import ChatMessage from '../components/chat/ChatMessage.jsx'
```

### Step 2: Update MessageBubble to use ChatMessage for assistant messages

Current `MessageBubble` render (lines ~251–269):

```jsx
return (
  <div className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
    <div className={`group flex items-end gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isUser ? CopyButton : null}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-[rgba(94,234,212,0.18)] text-white'
            : 'bg-white/[0.05] text-white/90'
        }`}
      >
        {message.content ? renderContent(message.content) : <span className="text-white/40 italic">empty</span>}
      </div>
      {!isUser ? CopyButton : null}
    </div>
    {!isUser && message.context ? <MessageContextPanel context={message.context} /> : null}
  </div>
)
```

Replace with:

```jsx
return (
  <div className={`flex flex-col mb-4 ${isUser ? 'items-end' : 'items-start'}`}>
    <div className={`group flex items-end gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {isUser ? CopyButton : null}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 leading-relaxed ${
          isUser
            ? 'text-sm whitespace-pre-wrap bg-[rgba(94,234,212,0.18)] text-white'
            : 'bg-white/[0.05] text-white/90'
        }`}
      >
        {isUser
          ? (message.content ? renderContent(message.content) : <span className="text-white/40 italic">empty</span>)
          : (message.content ? <ChatMessage content={message.content} /> : <span className="text-white/40 italic">empty</span>)
        }
      </div>
      {!isUser ? CopyButton : null}
    </div>
    {!isUser && message.context ? <MessageContextPanel context={message.context} /> : null}
  </div>
)
```

Key changes:
- `whitespace-pre-wrap` and `text-sm` moved into the `isUser` branch only — assistant messages no longer get `whitespace-pre-wrap` (the ChatMessage component controls spacing via its own elements)
- Assistant messages use `<ChatMessage content={message.content} />` instead of `renderContent()`
- User messages keep `renderContent()` unchanged

### Step 3: Run the full test suite

```
npx vitest run src --reporter verbose 2>&1
```

Expected: All existing tests pass. The new `chatMessage.test.js` (11 tests) pass.

### Step 4: Commit

```bash
git add src/views/Chat.jsx
git commit -m "feat(chat): wire ChatMessage into MessageBubble for assistant messages"
```

---

## Self-review

### Spec coverage

| Spec requirement | Covered by |
|---|---|
| Remove raw asterisks from AI responses | Task 1 — `renderInlineText` handles `**bold**` → `<strong>` |
| Headers 24px semi-bold | Task 1 — `h2` gets `text-2xl font-semibold`, `h3` gets `text-xl font-semibold` |
| Body copy 16px | Task 1 — `text-base` on container (16px), paragraphs `text-white/85` |
| Bullet/number lists | Task 1 — `<ul className="list-disc …">` / `<ol className="list-decimal …">` |
| Code blocks with Copy button | Task 1 — `CodeBlock` component with clipboard copy + Copied confirmation |
| Code blocks with Preview button (html/js) | Task 1 — `PREVIEW_LANGS` set, blob URL preview in new tab |
| Preview hidden for python/bash/sql etc. | Task 1 — only in `PREVIEW_LANGS`; unlisted langs get no Preview button |
| Unclosed fence → code block to end | Task 1 — `parseBlocks` test + implementation |
| `whitespace-pre-wrap` removed from assistant bubble | Task 2 — moved to `isUser` branch only |
| User messages unchanged | Task 2 — `renderContent()` kept for user branch |
| QuickChatLauncher unchanged | Not touched — no file modification |

### Placeholder scan

No TBD, TODO, or incomplete steps. All code blocks are complete.

### Type/name consistency

- `parseBlocks` — exported in Task 1, imported in tests in Task 1. ✓
- `CodeBlock` — defined and used within `ChatMessage.jsx` only. ✓
- `block.code` (not `block.text`) used consistently for code fence content throughout. ✓
- `PREVIEW_LANGS` checked against `lang` (lowercased at parse time) — consistent. ✓
