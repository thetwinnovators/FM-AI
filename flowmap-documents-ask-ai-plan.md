# FlowMap "Documents" and "Ask FlowMap AI" Implementation Plan

## 1. High-level goals

- Turn FlowMap from "search + save" into a **personal research brain** that can ingest long-form material and answer questions over that material.
- Introduce two new first-class areas in the app:
  - **Documents** – where you upload, paste, and manage long-form content (docs, chat dumps, long notes) and attach it to topics.
  - **Ask FlowMap AI** – a Claude-style chat UI that answers questions using FlowMap's memory (Documents + saved items + topics), with conversations saved and organized.
- Keep everything local / free: no new paid APIs; reuse existing LLM and search infrastructure where possible.

---

## 2. IA and navigation changes

### 2.1 Top-level navigation

Replace existing nav entries:

- **Discover** → **Documents**
- **Education** → **Ask FlowMap AI**

Resulting primary nav (example):

- `Search` – multi-source web search (HN, Reddit, YouTube, web, etc.)
- `Topics` (or `Flow Map`) – graph of topics and saved items
- `Documents` – document & note library
- `Ask FlowMap AI` – chat over FlowMap's memory

### 2.2 Routing

Add routes (React / Vite example):

- `/documents`
- `/documents/:id`
- `/chat` (or `/ask`)
- `/chat/:conversationId`

Ensure deep links to specific documents and conversations are supported.

---

## 3. Data model

### 3.1 Core entities

Extend FlowMap's existing models with:

#### Document

Represents any long-form content you want FlowMap to remember.

```ts
type DocumentId = string

type DocumentSourceType =
  | 'upload'    // user-uploaded file (pdf, md, txt, docx)
  | 'pasted'    // pasted text / chat dump
  | 'saved-url' // full-page capture from a URL (optional future)

interface DocumentMeta {
  id: DocumentId
  title: string
  sourceType: DocumentSourceType
  fileName?: string        // for uploads
  mimeType?: string        // for uploads
  url?: string             // for saved-url type
  createdAt: string
  updatedAt: string
  topics: string[]         // topic IDs
  tags: string[]           // free-form labels
  summary?: string         // AI-generated summary
  excerpt?: string         // first paragraph or key snippet
  wordCount?: number
}

interface DocumentContent {
  id: DocumentId
  plainText: string        // normalized text used for search/LLM
  raw?: string             // optional original markdown/HTML
}
```

Storage strategy:

- `DocumentMeta` in your main SQL/JSON store.
- `DocumentContent` either in the same DB (TEXT column) or in a separate content table keyed by `documentId`.

#### Conversation

```ts
type ConversationId = string

interface Conversation {
  id: ConversationId
  title: string
  createdAt: string
  updatedAt: string
  pinned: boolean
  archived: boolean
  topics: string[]      // topic IDs inferred + editable
}

interface ChatMessage {
  id: string
  conversationId: ConversationId
  role: 'user' | 'assistant' | 'system'
  content: string         // markdown text
  createdAt: string
  // Optional: references to docs/items used in this message
  citedDocumentIds?: string[]
  citedItemIds?: string[] // saved web items / cards
}
```

Messages should be stored append-only and ordered by `createdAt`.

### 3.2 Links between entities

- Topic ↔ Document (many-to-many)
- Topic ↔ Conversation (many-to-many)
- Conversation ↔ Document / SavedItem via `citedDocumentIds` and `citedItemIds` on assistant messages.

Keep linking logic simple initially:

- When a chat answer cites docs/items, update the message's `citedDocumentIds`/`citedItemIds`.
- After each assistant message, update the conversation's `topics` set to include the topics of cited docs/items.

---

## 4. Documents section

### 4.1 Documents list page (`/documents`)

**Layout**

- Left: filters & search
- Right: document list/grid

**Filters**

- Search box (title / summary / tags)
- Topic multi-select
- Tag chips
- SourceType (Upload / Pasted / Saved URL)
- Date range

**List item fields**

Each document row shows:

- title
- source type icon (file, chat bubble, link)
- linked topic chips
- short summary or first 1–2 lines of excerpt
- createdAt / updatedAt
- quick actions: open, edit topics/tags, delete

### 4.2 Document detail page (`/documents/:id`)

**Sections**

1. Header
   - Title (editable)
   - source type badge
   - topics (chips, editable)
   - tags (editable)
   - created/updated timestamps

2. Summary panel
   - AI-generated summary + key bullet takeaways
   - "Regenerate" button

3. Content view
   - scrollable text area / viewer of `plainText`
   - optional: basic markdown rendering for pasted content

4. Related
   - list of related topics
   - related saved items (cards)
   - related conversations (from `Conversation.topics` + citations)

**Editing**

- Allow inline title editing.
- Topic picker (multi-select) to attach/detach topics.
- Tag input with typeahead.

### 4.3 Ingestion flows

#### 4.3.1 Upload document

Entry points:

- "New Document" button on `/documents`.
- Drag-and-drop zone.

Flow:

1. User selects file.
2. Frontend sends file to backend (or local Tauri bridge) for:
   - storage,
   - text extraction (pdf → text, docx → text, etc.).
3. Backend returns `DocumentMeta` + `DocumentContent` (with tentative title from filename and first heading).
4. UI opens the new Document detail page with editable metadata.
5. Background worker generates summary + takeaways and updates `summary`/`excerpt` fields.

Minimum viable set of file types:

- `.pdf`
- `.txt`
- `.md`
- `.docx` (optional in v1; can be added later)

Text extraction implementation will depend on your runtime (browser-only vs. Tauri). For initial browser-only, prioritize `.txt` and `.md` and treat others as future work.

#### 4.3.2 Paste AI chat / long text

Entry points:

- "New from text" button in `/documents`.
- Shortcut inside Ask FlowMap AI: "Save this conversation as document" (future).

Flow:

1. User pastes text into a large textarea.
2. Optionally detects chat format (e.g., "User:", "Assistant:") and flattens into readable text.
3. Generate a provisional title from first line or user input.
4. Create `DocumentMeta` + `DocumentContent` with `sourceType: 'pasted'`.
5. Run summary pipeline as with uploads.

### 4.4 Search & indexing

Documents should be searchable from:

- `Documents` page (title, tags, summary, content snippets).
- global search (if you have one).
- Ask FlowMap AI retrieval (see section 5).

Implementation options:

- Simple: SQL `LIKE` queries over `plainText`, with pre-computed `summary` and `excerpt` for display.
- Medium: Local full-text index (SQLite FTS, MiniSearch/Lunr in browser) keyed by `documentId`.

For now, a pragmatic approach is to:

- index `title`, `summary`, `tags`, and top N characters of `plainText` for quick search,
- fetch full content only when needed for LLM answers.

---

## 5. Ask FlowMap AI section

### 5.1 IA and layout (`/chat`)

**Layout**

- Left sidebar:
  - New conversation button
  - Pinned conversations
  - Recent conversations
  - Toggle to show archived

- Main panel:
  - Header with conversation title, topic chips, pin/archive controls
  - Message list (chat-style)
  - Input box at bottom (multi-line, markdown, send on Ctrl+Enter)

### 5.2 Conversation lifecycle

- New conversation is created on first user message.
- Every conversation is **auto-saved**.
- Title auto-generated from first user message (first ~80 chars), editable.
- `updatedAt` updated on each message.
- Users can:
  - **Pin** conversation (kept at top of sidebar)
  - **Archive** conversation (hidden from default view but searchable)
  - **Rename** conversation
  - **Retag** topics

Conversation object is persisted as described in section 3.1.

### 5.3 Retrieval and answering pipeline

Goal: answer using FlowMap's memory first (Documents + saved items + topics), with optional web fallback.

#### 5.3.1 Input

Per message, the backend receives:

- `conversationId`
- current message text
- optional scope settings:
  - topic IDs
  - time range

#### 5.3.2 Retrieval candidates

Build a pool of candidate contexts by:

1. **Documents**
   - Search `title`, `summary`, `tags`, and content for query terms.
   - Optionally factor in conversation topics.

2. **Saved items (cards)**
   - Existing FlowMap search index (query over titles/descriptions).
   - Limit to items that belong to topics in scope.

3. **Prior conversation messages**
   - Include last N user/assistant messages for continuity.

Combine candidates into a ranked list (e.g., using simple scoring: keyword overlap + recency + matching topics).

#### 5.3.3 Context assembly

From the ranked candidates:

- select top K documents/items (e.g., 5–10),
- for each, include:
  - title,
  - short summary or key snippet,
  - a link/id.

Construct a prompt for the LLM along the lines of:

> You are FlowMap, answering based only on the user's own documents and saved items. Use the provided context excerpts and clearly cite which document or item each part of your answer came from.

Include:

- previous chat turns (for continuity),
- the selected excerpts (with IDs),
- the new user question.

#### 5.3.4 LLM answer

- Call your existing LLM bridge (e.g., Claude/OpenAI local wrapper).
- Parse response as markdown.
- Extract cited document/item IDs if you adopt a simple citation syntax in the prompt (e.g., `[doc:ID]`).

#### 5.3.5 Persisting the message

- Create `ChatMessage` for user question.
- Create `ChatMessage` for assistant answer, including `citedDocumentIds` and `citedItemIds` if available.
- Update `Conversation.updatedAt` and `Conversation.topics`.

### 5.4 Scope and controls

In the Ask FlowMap AI UI, add scope controls such as:

- **Scope selector** (per conversation):
  - All memory (default)
  - Selected topics (multi-select)
  - Specific tags

- **Web fallback toggle** (future):
  - Off by default to keep answers grounded in FlowMap.
  - When enabled, allow the backend to augment context with current web search results (using your existing search stack) when memory is insufficient.

### 5.5 Sidebar and conversation management

**Sidebar item fields**

- title
- last updated timestamp
- topic chips
- pinned badge

**Interactions**

- click → open conversation
- right-click / kebab menu:
  - Pin / Unpin
  - Archive / Restore
  - Rename
  - Delete (optional; consider a soft delete or trash)

---

## 6. Cross-cutting: Topics integration

Topics should be the common language across Search, Documents, and Ask FlowMap AI.

### 6.1 Topic view updates

On each Topic detail page, add two new sections:

- **Documents** – list documents linked to this topic.
- **Conversations** – list conversations whose `topics` include this topic.

Each entry should be clickable to open the document/conversation.

### 6.2 Auto-tagging

Implement simple auto-tagging heuristics:

- When a document is created from a Topic context (e.g., "Add document" button on Topic page), auto-attach that topic.
- When Ask FlowMap AI cites documents/items under specific topics, add those topics to the conversation.

---

## 7. Implementation phases

Break the work into pragmatic phases.

### Phase 1 – Documents skeleton

- Add `Document` and `DocumentContent` models.
- Implement `/documents` list page with:
  - basic listing,
  - search by title,
  - filters for topic and source type.
- Implement `/documents/:id` detail page showing:
  - title,
  - content (for pasted text),
  - topics/tags editable.
- Implement "New from text" flow.
- Integrate with Topics (link/unlink docs).

### Phase 2 – Document uploads + summaries

- Add file upload support for `.txt` and `.md` (and `.pdf` if feasible):
  - store file,
  - extract plain text.
- Implement summary generation job for documents:
  - call LLM with raw text,
  - store `summary` and `excerpt`.
- Show summaries on Documents list and detail pages.

### Phase 3 – Ask FlowMap AI basic chat

- Add Conversation and ChatMessage models.
- Build `/chat` UI with:
  - sidebar list,
  - main chat pane,
  - auto-save of conversations.
- Implement simple answer pipeline:
  - retrieve top documents by keyword search,
  - pass excerpts + question to LLM,
  - return answer (no citations yet).

### Phase 4 – Memory-grounded answers + citations

- Improve retrieval to include:
  - Documents,
  - saved items/cards,
  - recent conversation context.
- Adjust prompt for grounding + citation.
- Parse citations from LLM output and map to `citedDocumentIds`/`citedItemIds`.
- Display "Used in this answer" section under each assistant message.

### Phase 5 – Conversation management & topic integration

- Implement pin/archive/rename for conversations.
- Update Topic pages to show related Documents and Conversations.
- Add scope controls to Ask FlowMap AI (topic filters, etc.).

---

## 8. Non-goals (for now)

To keep scope controlled, explicitly out of v1:

- Realtime collaborative editing of documents.
- Complex vector/RAG infrastructure beyond simple retrieval + LLM.
- Public user accounts or sharing; FlowMap remains personal.
- Heavy PDF/Docx parsing for all edge cases.

---

## 9. Success criteria

FlowMap's new value should be clear if:

- You can quickly **dump documents and chat logs** into Documents and see concise summaries.
- In Ask FlowMap AI, you can ask questions like "Remind me how I wanted to design trust-persisted memory" and get answers clearly grounded in your own docs and saved items.
- Topic pages feel like hubs that tie together:
  - saved web items,
  - your own documents,
  - your best conversations.
- You feel less need to re-read old threads or re-Google the same concepts when working on Flowerk or other projects.
