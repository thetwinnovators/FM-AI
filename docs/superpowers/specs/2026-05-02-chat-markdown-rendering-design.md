# Chat Markdown Rendering Design

**Date:** 2026-05-02
**Feature:** Proper markdown rendering in FlowMap AI chat messages, with code block copy + browser preview actions.

---

## Goal

Replace the raw-text display of AI chat messages with structured markdown rendering. Asterisks, hashes, and backtick fences in model output are currently shown as literal characters. After this change they render as formatted headings, bold/italic text, lists, and syntax-highlighted code blocks with actionable toolbars.

---

## Background

`Chat.jsx` renders AI messages via a `MessageBubble` component that calls a `renderContent()` helper. That helper only detects URLs and FlowMap internal links — it does no markdown parsing. As a result, `**bold**` appears with visible asterisks and ` ```code``` ` fences appear as plain text.

A `renderMarkdownLite()` function already exists in `src/lib/search/articleReader.js`. It parses headings, bold/italic, lists, and code fences. The design adapts that logic — it is not copied verbatim, but used as a structural reference — and styles it for the chat context.

---

## Architecture

A single new component, `src/components/chat/ChatMessage.jsx`, handles all markdown-to-JSX rendering for chat messages. It is self-contained: it imports nothing from `articleReader.js` at runtime but mirrors its block-detection approach.

`Chat.jsx` (`MessageBubble`) replaces its `renderContent(message.content)` call with `<ChatMessage content={message.content} />`. The `whitespace-pre-wrap` class is removed from the bubble element so the component's own HTML structure controls spacing.

`QuickChatLauncher.jsx` is unchanged — its compact floating bubble renders plain text, which is appropriate for the ephemeral context.

**Files changed:**

| Action | Path |
|--------|------|
| Create | `src/components/chat/ChatMessage.jsx` |
| Modify | `src/views/Chat.jsx` |

No new npm dependencies.

---

## ChatMessage Component

### Block parsing

The component splits `content` on double newlines into blocks, then classifies each block:

| Block pattern | Classification |
|---|---|
| Starts with ` ``` ` | Code fence (multi-line, read until closing ` ``` `) |
| Starts with `# ` | Heading level 1 |
| Starts with `## ` | Heading level 2 |
| Starts with `- ` or `* ` (every line) | Unordered list |
| Starts with `1. ` (every line) | Ordered list |
| Anything else | Paragraph |

### Inline parsing (within paragraphs and list items)

| Pattern | Output |
|---|---|
| `**text**` | `<strong>text</strong>` |
| `*text*` | `<em>text</em>` |
| `` `text` `` | `<code className="bg-white/10 px-1 rounded font-mono text-sm">text</code>` |
| `[label](url)` | `<a>` or `<Link>` (FlowMap internal path detection retained from current `renderContent()`) |
| Bare `https://` URL | `<a target="_blank">` |

### Element styles

| Element | Tailwind classes | Notes |
|---|---|---|
| `h2` (# heading) | `text-2xl font-semibold text-white/90 mt-4 mb-2` | 24px, semi-bold |
| `h3` (## heading) | `text-xl font-semibold text-white/80 mt-3 mb-1.5` | 20px, semi-bold |
| `p` | `text-base text-white/85 mb-3` | 16px body |
| `ul` | `list-disc pl-5 space-y-1 mb-3 text-base text-white/85` | Disc bullets |
| `ol` | `list-decimal pl-5 space-y-1 mb-3 text-base text-white/85` | Decimal numbers |
| `strong` | `font-semibold` | |
| `em` | `italic` | |
| Inline `code` | `bg-white/10 px-1 rounded font-mono text-sm` | |

---

## CodeBlock Sub-Component

Rendered for every ` ``` ` fence. Defined inside `ChatMessage.jsx` (not a separate file — it is only used here).

### Layout

```
┌─ [lang] ──────────────────────── [Copy] [Preview] ─┐
│                                                      │
│  <code content>                                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- **Container:** `rounded-xl bg-white/[0.05] border border-white/[0.08] overflow-hidden mb-4`
- **Header bar:** `flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-white/[0.06]`
- **Language label:** lowercase, `text-[11px] text-white/40 font-mono`; shows `"code"` when no language is specified
- **Code body:** `px-4 py-3 overflow-x-auto font-mono text-sm text-white/85 leading-relaxed whitespace-pre`

### Copy button

- Icon: `Copy` (lucide-react), label: "Copy"
- On click: `navigator.clipboard.writeText(code)`, fallback `document.execCommand('copy')`
- State: shows `Check` icon + "Copied" for 2 seconds, then reverts
- Styling: `text-[11px] flex items-center gap-1 text-white/40 hover:text-white/80 transition-colors`

### Preview button

- Shown only when language is `html`, `javascript`, `js`, or empty/unspecified
- Hidden for: `python`, `bash`, `sh`, `sql`, `css`, `json`, `typescript`, `ts`, and any other non-executable language
- Icon: `ExternalLink` (lucide-react), label: "Preview"
- Styling: same as Copy button

**Preview behavior:**

1. For `html` or no language: wrap code in a minimal HTML scaffold:
   ```html
   <!DOCTYPE html><html><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <style>body{margin:0;font-family:system-ui,sans-serif}</style>
   </head><body>${code}</body></html>
   ```
2. For `javascript` / `js`: wrap in the same scaffold with code inside `<script>`:
   ```html
   ...same scaffold...<body><script>${code}</script></body></html>
   ```
3. Create a `Blob` with type `text/html`, generate a `URL.createObjectURL(blob)`, open with `window.open(url, '_blank')`.
4. No cleanup needed — the tab controls its own lifecycle.

The preview opens in the browser's normal tab sandbox. It has no access to FlowMap's localStorage, React state, or DOM.

---

## Error Handling

- Malformed fences (unclosed ` ``` `): treat the remainder of the message as a single code block
- `clipboard.writeText` failure: silently fall back to `execCommand`; if both fail, the button shows "Failed" briefly
- `window.open` blocked by browser popup blocker: no special handling — browser native behaviour applies

---

## What Is Not In Scope

- Syntax highlighting (colour-coded tokens) — plain monospace is sufficient for now
- QuickChatLauncher markdown rendering
- Streaming partial-markdown rendering (blocks only render once the fence is closed; mid-stream asterisks are acceptable)
- Table rendering (`| col |` syntax)
- Image rendering (`![alt](url)`)
