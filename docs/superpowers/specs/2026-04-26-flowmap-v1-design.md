# FlowMap v1 — Design Spec

**Date:** 2026-04-26
**Status:** Proposed
**Author:** Brainstorm with Claude
**Target user:** Single operator (personal tool)

---

## 1. Overview

FlowMap is a personal research workspace for AI/tech topic intelligence. It helps the operator quickly find, read, watch, and organize content about Claude, MCP, Codex, agents, vibecoding, RAG, and adjacent emerging concepts.

The signature surface is a **3D node graph** ("Flow Map") that renders topics, tools, concepts, creators, and content as connected nodes. Other surfaces (Home, Discover, Topic, Education, Memory) deliver the daily-use content-consumption loop: search → discover → read/watch → save.

The entire app uses a **dark mode + glassmorphic** visual system. The Flowerk intelligence page (see `intelligence-network-spec.md`) is the layout reference for the Flow Map page; the rest of the app inherits the same dark/glass language.

---

## 2. Goals & non-goals

### Goals (v1)

- Operator can search, browse, read, and watch curated AI/tech content **inside the app**.
- 6 navigable sections, all visually polished.
- Cinematic Flow Map page with an interactive 3D canvas graph.
- Save / follow / dismiss state persists across sessions (localStorage).
- All content is real (real YouTube IDs, real article URLs, real summaries) — not Lorem ipsum.

### Non-goals (v1)

- Multi-user / auth / multi-tenant / sharing.
- Backend, database, or any server beyond the Vite dev server.
- Live ingestion (RSS, YouTube Data API, Reddit, HN) — **planned for v1.1**.
- AI-generated summaries — v1 uses pre-written summaries embedded in the seed.
- Exports, integrations, notifications, mobile apps.
- Education path generation from observed behavior — Education in v1 is a hand-curated set of concept cards.

---

## 3. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Build tool | **Vite** (already installed) | Fast HMR, simple config |
| UI framework | **React 19** + **JSX** (already installed) | Familiar, no TS overhead for personal tool |
| Routing | **react-router-dom 7** (already installed) | Multi-page navigation |
| Styling | **Tailwind v4** *(to add)* | Class-heavy spec; near-zero config in Vite v8 |
| Icons | **lucide-react** (already installed) | Comprehensive, MIT, tree-shakable |
| Graph viz | **Custom HTML5 Canvas + plain math** | Per `intelligence-network-spec.md` §8; no library dependency |
| Persistence | **localStorage** wrapped in a small `useStore` hook | Personal tool; no backend |
| Content | **JSON seed files** in `src/data/` | Curated, version-controlled, swappable for live APIs later |

**Removed:** `reactflow` (unused after this design — Flow Map is canvas-based).

---

## 4. Visual system

### 4.1 Design tokens (Tailwind v4 `@theme` block)

```css
@theme {
  /* Backgrounds */
  --color-bg-canvas: #05070f;          /* page bg, network canvas */
  --color-bg-deep:   #0b0d18;          /* gradient stop */
  --color-bg-glass:  rgba(255,255,255,0.04);
  --color-bg-glass-strong: rgba(255,255,255,0.06);

  /* Text */
  --color-text-primary:   rgba(255,255,255,0.92);
  --color-text-secondary: rgba(255,255,255,0.62);
  --color-text-tertiary:  rgba(255,255,255,0.38);

  /* Borders */
  --color-border-subtle:  rgba(255,255,255,0.08);
  --color-border-default: rgba(255,255,255,0.11);
  --color-border-strong:  rgba(255,255,255,0.16);

  /* Node-type accents (single source of truth, used by canvas + chips) */
  --color-topic:        #f97316;  /* orange   */
  --color-concept:      #94a3b8;  /* slate    */
  --color-tool:         #06b6d4;  /* cyan     */
  --color-company:      #3b82f6;  /* blue     */
  --color-creator:      #14b8a6;  /* teal     */
  --color-video:        #ec4899;  /* pink     */
  --color-article:      #f59e0b;  /* amber    */
  --color-social-post:  #8b5cf6;  /* violet   */
  --color-tag:          #64748b;  /* slate-500*/
  --color-learning:     #10b981;  /* emerald  */
  --color-memory:       #a855f7;  /* purple   */
  --color-signal:       #f43f5e;  /* rose     */
}
```

### 4.2 Glass panel utility

```css
.glass-panel {
  background: var(--color-bg-glass);
  backdrop-filter: blur(22px) saturate(1.6);
  -webkit-backdrop-filter: blur(22px) saturate(1.6);
  border: 1px solid var(--color-border-default);
  box-shadow: 0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06);
  border-radius: 1rem;
}
```

### 4.3 Typography

- **Inter** (already loaded), weights 400/500/600/700.
- Headings: `font-weight: 600`, `letter-spacing: -0.02em` to `-0.03em`.
- Body: `font-weight: 400`, `line-height: 1.55`.

### 4.4 Radius scale

- `4px` chips/pills · `8px` buttons · `12px` inputs · `16px` cards · `24px` modals.

### 4.5 Motion

- Hover transitions: `120ms ease-out`.
- Section enter: `400ms cubic-bezier(0.16, 1, 0.3, 1)` opacity + 8px translate-y fade-in.
- Canvas: see §7.

---

## 5. Information architecture

### 5.1 Persistent left rail

Width 240px, glass panel, full height, 6 nav items + user pill at bottom.

| Order | Label | Route | Icon |
|---|---|---|---|
| 1 | Home | `/` | `Home` |
| 2 | Discover | `/discover` | `Compass` |
| 3 | Topics | `/topics` (grid index) / `/topic/:slug` (detail) | `BookOpen` |
| 4 | Flow Map | `/flow` | `Network` |
| 5 | Education | `/education` | `GraduationCap` |
| 6 | Memory | `/memory` | `Brain` |

Active state: `bg-glass-strong` + `border-l-2 border-color-topic` accent + white text.

### 5.2 Top bar (persistent across content area)

- Global search input (cmd-K opens modal).
- Right side: "Live · seed" pill (since v1 uses curated seed) and a settings cog (placeholder).

---

## 6. Data model

### 6.1 Seed file structure

```
src/data/
├── topics.json          // Topic definitions
├── content.json         // Videos, articles, social posts (unified schema)
├── creators.json        // YouTube channels, blogs, authors
├── tools.json           // Products and frameworks
├── companies.json       // Anthropic, OpenAI, Vercel, etc.
├── concepts.json        // RAG, tool use, prompt chaining, etc.
├── tags.json            // Free-floating classification labels
├── education.json       // Concept cards / explainers
├── relations.json       // Edges between any two entity IDs
└── seed-memory.json     // Pre-populated Interest Memory entries
```

### 6.2 Schemas

**Topic**
```ts
{
  id: 'topic_claude',
  slug: 'claude',
  name: 'Claude',
  summary: 'Anthropic\'s AI assistant family — Sonnet, Opus, Haiku.',
  whyItMatters: 'Frontier model with strong reasoning, tool use, and a developer-first SDK.',
  relatedTopicIds: ['topic_anthropic', 'topic_mcp', 'topic_agents'],
  toolIds: ['tool_claude_code', 'tool_claude_api'],
  companyIds: ['company_anthropic'],
  followed: true
}
```

**Content item** (video / article / social post — unified)
```ts
{
  id: 'vid_001',
  type: 'video' | 'article' | 'social_post',
  title: '...',
  url: 'https://youtube.com/watch?v=...' | 'https://blog.example.com/...',
  source: 'YouTube' | 'Anthropic Blog' | 'X' | ...,
  sourceLogo?: '/logos/youtube.svg',
  publishedAt: '2026-04-20',
  durationSec?: 612,                 // videos only
  youtubeId?: 'dQw4w9WgXcQ',         // videos only
  summary: 'Hand-written 2-3 sentence summary.',
  keyPoints: ['...', '...', '...'],  // article reader bullets
  topicIds: ['topic_claude', 'topic_mcp'],
  creatorId: 'creator_anthropic',
  toolIds: ['tool_mcp_server'],
  conceptIds: ['concept_tool_use'],
  tagIds: ['tag_walkthrough', 'tag_implementation'],
  thumbnail?: 'https://i.ytimg.com/vi/.../maxresdefault.jpg'
}
```

**Creator / Tool / Company / Concept** — all share a base shape:
```ts
{ id, slug, name, summary, url?, logo?, topicIds[], relatedIds[] }
```

**Education card**
```ts
{
  id: 'ed_rag_basics',
  conceptId: 'concept_rag',
  title: 'RAG — Retrieval-Augmented Generation',
  whyItMattersNow: '...',
  plainExplanation: 'Markdown-ish text body.',
  exampleUseCase: '...',
  relatedToolIds: [...],
  connectedContentIds: [...],
  nextConceptIds: [...]
}
```

**Memory entry** (Interest Memory)
```ts
{
  id: 'mem_001',
  category: 'topic_rule' | 'source_pref' | 'research_focus' | 'personal_stack',
  content: 'Always include MCP-related videos when surfacing Claude content.',
  confidence: 1.0,         // 0–1
  status: 'validated' | 'active' | 'learning',
  addedAt: '2026-04-26',
  source: 'manual' | 'derived'
}
```

**Saved item / follow state** (localStorage only)
```ts
{
  saves: { [contentId]: { savedAt, collectionId? } },
  follows: { [topicId]: { followedAt } },
  dismisses: { [contentId]: true },
  collections: { [collId]: { name, contentIds: [] } }
}
```

### 6.3 Persistence

A single `useStore` hook wraps localStorage with key `flowmap.v1`. Reads on mount, writes on every mutation. JSON-serializable. Never blocks render.

---

## 7. Section designs

### 7.1 Topics index (`/topics`) and Topic Page (`/topic/:slug`)

**`/topics`** — grid index. Shows all topics from the seed as glass cards (name, summary, follow toggle, content count, type-color dot). Followed topics appear first. Click → navigates to `/topic/:slug`.

#### 7.1.1 Topic Page (`/topic/:slug`) — *the core consume loop*

**Layout** (top to bottom):

1. **Hero** — glass card, full width.
   - Topic name (28pt) + slug + colored type-dot.
   - Summary paragraph (max 3 sentences).
   - "Why it matters" (italic, secondary text).
   - Right side: Follow button (toggles bookmark filled/outline), saved count chip, "Open in Flow Map" link.
2. **Tab strip** (sticky): All / Videos / Articles / Posts / Tools / Concepts.
3. **Content grid**:
   - Default 3 columns, responsive.
   - **Video cards**: thumbnail (16:9), play overlay, duration chip, title (2 lines max), creator + source row, save icon. Click → opens **VideoPlayerModal** with embedded YouTube iframe.
   - **Article cards**: source logo + name, title (3 lines max), 1-line summary, published date. Click → opens **ArticleReader** drawer (right-side glass panel, 640px wide) with title, source link-out, summary, key points, "Open original ↗" button.
   - **Social post cards**: post text (truncated to 240 chars), author + handle, platform chip. Click → expands inline.
4. **Side rail** (right, collapsible on smaller widths):
   - Related topics (chips).
   - Connected tools (rows with logo + name).
   - Top creators for this topic.
   - Mini graph snippet — small canvas showing this topic's neighborhood (uses the same renderer as the Flow Map, sized 320×240).

**Interactions**
- Save: clicking the bookmark icon on any card toggles saved state (localStorage).
- Follow: hero button toggles `follows[topicId]`.
- Tab switching: filters the grid by content type without route change.
- "Open in Flow Map": navigates to `/flow?node=topic_<slug>` and selects the node.

### 7.2 Discover Feed (`/discover`)

**Layout**

1. **Filter bar** (sticky top): Topic chips (multi-select) · Source dropdown · Type toggle (All / Videos / Articles / Posts) · Time dropdown (Today / This week / This month / All) · Sort (Newest / Most relevant).
2. **Card stream** (single column, 720px wide, centered):
   - Same card components as Topic Page, but full-width horizontal layout.
   - Each card shows topic-relevance reason ("Because you follow MCP"), save / dismiss / open actions.
   - Infinite scroll within the seed (paginate 20 at a time client-side).
3. **Empty / end state**: "You're all caught up. Add more topics to see more."

**Interactions**
- Dismiss: removes from feed for the session and writes `dismisses[contentId] = true`.
- Save: as in Topic Page.
- Click card body: opens video modal or article reader.

### 7.3 Home / Search (`/`)

**Layout**

1. **Hero search** (centered, max 720px): Large `<input>` with placeholder "Search topics, tools, creators, content…". Cmd-K opens this modal anywhere in the app.
2. **Watchlist row**: 3-column grid of followed-topic cards with last-update timestamp + "N new this week" chip.
3. **Suggested topics**: 3-column row of topics from the seed not yet followed, with "Follow" button.
4. **Latest highlights**: 6 most-recent items across all topics, mixed grid (videos + articles).
5. **Recent searches** (footer): chips of recent queries (localStorage-backed).

**Search behavior**
- Substring match across topic names, content titles, summaries, tags, creators, tools.
- Results page (`/search?q=...`): grouped by entity type (Topics first, then Tools, Creators, Content).
- Each result navigates to the appropriate destination (Topic Page, Flow Map node, Content modal/reader).

### 7.4 Flow Map (`/flow`) — the cinematic centerpiece

**Layout (top to bottom)** — matches Flowerk reference, but on dark page bg.

1. **Page header** — "Flow Map" + descriptive subtitle ("Topic intelligence map for the AI/tech landscape you follow.") + "Live · seed" pill.
2. **4-stage pipeline strip** — glass card, 4 columns:
   | # | Icon | Color | Title | Subtext |
   |---|---|---|---|---|
   | 1 | Compass | teal | **Discover** | Sources · Searches · Triggers |
   | 2 | Filter | amber | **Parse** | Metadata · Transcripts · Entities |
   | 3 | Tags | violet | **Classify** | Topics · Concepts · Relations |
   | 4 | Brain | emerald | **Retain** | Memory · Patterns · Suggestions |

3. **Network console** (640px tall):
   - Solid `#05070f` canvas with `1px solid rgba(255,255,255,0.07)` border.
   - **Header bar** (48px): "Network" title, hint text ("Drag to rotate · Shift+drag to pan · Click a node to inspect"), fullscreen button.
   - **Glass sidebar** (250px) absolutely positioned at top-left: search input + collapsible groups (one per node type) + footer hint. See §8.
   - **3D canvas**: full remaining width × height. See §8.
   - **Legend strip** (bottom, 36px): 12 type chips (one per node type from §4.1).
4. **KPI row** (7 cards, equal width):
   - Followed topics · Items this week · Saved items · Sources tracked · Videos · Articles · Posts.
5. **Connected sources + Derived signals** (2 columns):
   - **Sources**: YouTube (seed) · RSS (planned v1.1) · Hacker News (planned v1.1). Each with status dot + chip.
   - **Signals**: Trending creators · Rising tools · New concepts. Each with chip + tone badge.
6. **Interest Memory panel** (full width):
   - Header: "Interest Memory" + descriptive text + "+ Add" button.
   - Filter tabs: All · Topic Rules · Source Prefs · Research Focus · Personal Stack.
   - 3-column grid of memory cards (category badge + status pill + content + confidence bar + date).
   - Inline add form behind the "+ Add" button.

### 7.5 Education (`/education`)

**Layout**

1. **Header** — "Education" + descriptive subtitle.
2. **Path picker** (chips): Beginner · Intermediate · Advanced · By topic.
3. **Card grid** (3 columns) — Education cards from seed:
   - Concept name + plain explanation snippet.
   - "Why it matters now".
   - Connected videos/articles (mini chips).
   - "Next concepts" (chips, click navigates).
4. **Detail view** (route `/education/:cardId`): full-width article-style reader with hero, plain explanation body, example use case, connected content list, next-concepts row.

### 7.6 Memory (`/memory`)

**Layout**

1. **Tabs**: Saved items · Followed topics · Source preferences · Memory entries.
2. **Saved items**: same card grid as Discover, filtered to `saves` map.
3. **Followed topics**: row list with topic name + last-update + Unfollow.
4. **Source preferences**: per-source toggles (Always show / Sometimes / Never).
5. **Memory entries**: same grid as Flow Map's Interest Memory panel, full screen.

---

## 8. Flow Map graph (3D canvas spec)

Re-implements `intelligence-network-spec.md` §8 with topic-intelligence node taxonomy. **No changes to the rendering math.**

### 8.1 Component

`src/components/FlowGraph.jsx` — sole consumer of HTML5 canvas in v1.

```js
<FlowGraph
  className="w-full h-full"
  nodes={NODES}                 // {id, label, type, bx, by, bz, phase}
  edges={EDGES}                 // {from, to}
  activeNodeIds={[...]}         // emerald pulse + emit signals
  nodeHeat={{...}}              // 0..1, brightens halo
  searchQuery={...}
  selectedNodeId={...}
  onNodeClick={(id) => ...}
  onNodeHover={(id) => ...}
/>
```

### 8.2 Node taxonomy (12 types)

Replaces Flowerk's operations taxonomy. Colors per §4.1.

| Type | Examples (from seed) |
|---|---|
| `topic` | Claude, MCP, Codex, agents, vibecoding, RAG |
| `concept` | tool use, evals, prompt chaining, retrieval |
| `tool` | Claude Code, Cursor, Codex CLI, MCP server |
| `company` | Anthropic, OpenAI, Vercel |
| `creator` | Channels, blogs, authors |
| `video` | YouTube items |
| `article` | Blog posts, docs, essays |
| `social_post` | Public X / Mastodon / etc. |
| `tag` | Free-floating labels |
| `learning_path` | Education unit references |
| `memory` | Interest Memory entries |
| `signal` | Derived trend signals |

### 8.3 Node positions (seed)

Generated procedurally on load — clustered by type along an X axis:

```
companies   topics      tools      content     creators
   ↓           ↓           ↓           ↓           ↓
  bx=-2.5    bx=-1.0    bx=0.2     bx=1.5      bx=2.5
```

`by` randomized per cluster within `[-1.5, 1.5]`, `bz` within `[-0.4, 0.4]`. Each node gets a `phase = random(0, π)` for idle wobble.

### 8.4 Edge generation

Read from `relations.json` (declared explicitly in seed). Plus implicit edges: each Content item connects to its `topicIds`, `creatorId`, `toolIds`, `conceptIds`. Memory entries connect to the topics/concepts they reference.

### 8.5 Renderer behaviors (per spec §8.4–8.11)

- Y/X-axis rotation via drag (clamped X to ±0.55 rad).
- Auto-rotate `rotY += dt × 0.07` after 2.5s idle.
- Vertical float `y += sin(t × 0.55 + phase) × 0.055`.
- Perspective: `persp = (camD × unit) / (camD + z)`, `camD = 5`.
- Signal particles spawn every 0.9s when fewer than 18 exist.
- Elastic-wave edge displacement on signal-bearing edges.
- Bounce physics: spring k=80, damping `exp(-7×dt)`. Impact: target `vel += 5.0`, source `vel += 0.4`.
- Depth-of-field: `blurPx = min(4.0, dof × 3.0) × dpr`, focal plane drifts toward hovered node.
- Selection dimming: non-neighbours use `MUTED_RGB = [80,84,96]` at 50%.
- Tooltip on hover: dark `rgba(6,8,18,0.90)`, type-coloured border, label + summary, word-wrapped.
- Fullscreen 4-phase animation: idle → expanding → full → shrinking, 420ms.

### 8.6 Click behaviors (FlowMap-specific)

When `onNodeClick(id)` fires:

| Node type | Action |
|---|---|
| `topic` | Set selection; show in glass sidebar detail mode. Double-click: navigate to `/topic/:slug`. |
| `tool / company / creator / concept` | Set selection; show detail. Double-click: navigate to its page (or scroll to it). |
| `video` | Open `<VideoPlayerModal>` with embedded YouTube iframe. |
| `article` | Open `<ArticleReader>` drawer. |
| `social_post` | Open inline expanded card (modal). |
| `tag` | Filter Discover feed to that tag (navigates to `/discover?tag=...`). |
| `memory` | Show in glass sidebar detail mode; "Edit" button jumps to Memory section. |
| `learning_path` | Navigate to `/education/:cardId`. |
| `signal` | Show in glass sidebar detail; brief explanation of what the signal measures. |

### 8.7 Glass sidebar modes

Same three modes as spec §6:
- **Directory** — collapsible groups by type.
- **Search results** — filtered list when `searchQuery` is set.
- **Node detail** — type badge + label + description + data source + Receives from / Sends to chip clouds.

---

## 9. File structure

```
src/
├── main.jsx                        ← entry (existing)
├── App.jsx                         ← layout shell with left rail (rewritten)
├── index.css                       ← Tailwind directives + design tokens
├── data/                           ← curated seed (NEW)
│   ├── topics.json
│   ├── content.json
│   ├── creators.json
│   ├── tools.json
│   ├── companies.json
│   ├── concepts.json
│   ├── tags.json
│   ├── education.json
│   ├── relations.json
│   └── seed-memory.json
├── store/                          ← state (existing → expanded)
│   ├── useStore.js                 ← localStorage-backed user state
│   └── useSeed.js                  ← loads + indexes seed JSON
├── views/                          ← route-level pages
│   ├── Home.jsx                    ← rewritten
│   ├── Discover.jsx                ← rewritten
│   ├── Topic.jsx                   ← rewritten
│   ├── FlowMap.jsx                 ← was GraphMap.jsx, rewritten
│   ├── Education.jsx               ← rewritten
│   ├── Memory.jsx                  ← rewritten
│   └── Search.jsx                  ← NEW (results page)
├── components/
│   ├── layout/
│   │   ├── LeftRail.jsx
│   │   └── TopBar.jsx
│   ├── content/
│   │   ├── VideoCard.jsx
│   │   ├── ArticleCard.jsx
│   │   ├── SocialPostCard.jsx
│   │   ├── VideoPlayerModal.jsx    ← YouTube iframe player
│   │   └── ArticleReader.jsx       ← right-side drawer
│   ├── flow/
│   │   ├── FlowGraph.jsx           ← canvas renderer (the big one)
│   │   ├── PipelineStrip.jsx
│   │   ├── GlassSidebar.jsx        ← directory / search / detail modes
│   │   ├── KpiRow.jsx
│   │   ├── ConnectedSources.jsx
│   │   ├── DerivedSignals.jsx
│   │   └── InterestMemory.jsx
│   └── ui/                         ← primitives
│       ├── GlassCard.jsx
│       ├── Chip.jsx
│       ├── Pill.jsx
│       ├── SearchInput.jsx
│       └── ConfidenceBar.jsx
└── lib/
    ├── slug.js
    └── ids.js                      ← ID prefix helpers
```

---

## 10. Build order (phased)

**Phase 0 — Foundation** *(blocks everything)*
- Add Tailwind v4. Configure `@theme` tokens.
- Replace `index.css` with token + glass utilities.
- Build `LeftRail` + `TopBar` shell. Wire routes (existing routes are mostly correct; rename `/graph` → `/flow`).
- Add `useStore` + `useSeed` hooks.

**Phase 1 — Topic Page** *(first usable surface)*
- Seed at least 3 topics fully (Claude, MCP, agents) with ~8 content items each.
- Build `VideoCard`, `ArticleCard`, `SocialPostCard`, `VideoPlayerModal`, `ArticleReader`.
- Build `Topic.jsx` view with tabs and side rail.

**Phase 2 — Discover feed**
- Build `Discover.jsx` with filters and infinite scroll over the seed.
- Card components reused from Phase 1.

**Phase 3 — Home / Search**
- Build `Home.jsx` (search hero, watchlist, suggestions, highlights).
- Build `Search.jsx` results page + cmd-K modal.

**Phase 4 — Memory**
- Build `Memory.jsx` (tabs: Saved / Followed / Sources / Memory entries).

**Phase 5 — Flow Map page** *(the cinematic centerpiece)*
- Build `FlowGraph.jsx` (canvas renderer — biggest single component).
- Build `PipelineStrip`, `GlassSidebar`, `KpiRow`, `ConnectedSources`, `DerivedSignals`, `InterestMemory`.
- Wire fullscreen animation.
- Generate node positions from seed; wire click behaviors per §8.6.

**Phase 6 — Education**
- Build `Education.jsx` index + detail view with the existing concept-card structure.

**Phase 7 — Polish**
- Empty states across all pages.
- Loading shimmers on first paint.
- Keyboard shortcuts: `/` to focus search, `Esc` to close modals/drawers/fullscreen, `j/k` to move through Discover feed.
- 404 route.

---

## 11. Out of scope (deferred to v1.1+)

- Live ingestion connectors (RSS, YouTube Data API, HN, Reddit).
- Auto-classification / auto-tagging via AI.
- Auto-generated Education cards from observed patterns.
- Real-time updates / push notifications.
- Sync across devices (would require backend or cloud storage).
- Export / share collections.
- Browser extension to save from any page.

---

## 12. Open questions (to resolve during implementation)

- **YouTube iframe player vs. lite-youtube-embed**: lite-youtube reduces initial JS by ~600KB but loses some controls. Default to iframe for v1; revisit on perf.
- **Article inline reader feasibility**: most blogs block iframe embedding via X-Frame-Options. Plan: try iframe; on fail, fall back to "Open in new tab". The reader card always shows the hand-written summary + key points regardless.
- **Seed scale**: target 60–80 items for v1. If browsing the seed feels thin, expand to 120 before Phase 5.
- **Tailwind v4 + Vite v8 compatibility**: confirmed in docs; if config friction emerges, fall back to v3.4.

---

## 13. Acceptance criteria

v1 is "done" when:

- [ ] All 6 sections are reachable, render without errors, and look visually consistent (dark glassmorphic).
- [ ] Operator can search, filter, save, and follow without errors.
- [ ] At least 60 real content items are accessible across topics.
- [ ] Every video plays in-app via YouTube embed.
- [ ] Every article opens a reader drawer with summary + key points + external link.
- [ ] Saves, follows, and dismisses persist across page reloads.
- [ ] Flow Map page renders the 3D graph with all interactions from §8.5 working: drag, rotate, pan, zoom, hover tooltip, click-select, fullscreen.
- [ ] Clicking a `video` node opens the player; clicking an `article` node opens the reader; clicking a `topic` node navigates to its page.
- [ ] No console errors on any route.
- [ ] Tested at 1280×800 minimum; responsive down to 1024px width.
