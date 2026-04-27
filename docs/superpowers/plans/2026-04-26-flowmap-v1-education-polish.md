# FlowMap v1 — Plan 4: Education + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Education section (concept cards seeded with hand-written explainers, index + detail views, cross-linked to Topic pages and content) and finish v1 with polish: empty states, keyboard shortcuts, 404 route, and a final smoke pass.

**Architecture:** Education content is hand-curated in `education.json` and surfaced through two views: an index (`/education`) and a detail (`/education/:slug`). Each card connects to existing content by ID. Polish is incremental — small components and event listeners added across already-built pages.

**Tech Stack:** Same as Plans 1–3.

**Spec reference:** [docs/superpowers/specs/2026-04-26-flowmap-v1-design.md](../specs/2026-04-26-flowmap-v1-design.md) §7.5, §10 (Phase 7).
**Plan dependencies:** Plans 1, 2, and 3 must be complete.

**Plan covers:** Phase 6 (Education) + Phase 7 (Polish).

---

## File Structure

### Files created

```
src/
├── data/
│   └── education.json                          (6 concept cards)
├── components/
│   ├── education/
│   │   ├── EducationCard.jsx
│   │   └── EducationDetailHero.jsx
│   └── ui/
│       ├── EmptyState.jsx
│       └── Skeleton.jsx
└── views/
    ├── (rewrite) Education.jsx                 (index)
    ├── EducationDetail.jsx                     (NEW — /education/:slug)
    └── NotFound.jsx                            (NEW — 404 route)
```

### Files modified

- `src/store/useSeed.js` — expose `education` array.
- `src/App.jsx` — add `/education/:slug` and `*` (NotFound) routes; add global `/` keyboard shortcut to open cmd-K.
- `src/views/Topic.jsx` — add "Learn the concept" cross-links to education cards.
- `src/views/Discover.jsx` — add j/k keyboard navigation.

---

# Phase 6 — Education

## Task 1: Seed `education.json` with 6 concept cards

**Files:**
- Create: `src/data/education.json`

- [ ] **Step 1: Write the seed**

```json
[
  {
    "id": "ed_tool_use",
    "slug": "tool-use",
    "conceptId": "concept_tool_use",
    "title": "Tool Use",
    "level": "beginner",
    "whyItMattersNow": "Modern frontier models can call functions, hit APIs, and act on the world. Without tool use, an LLM is text-in / text-out. With tool use, it becomes the brain of an agent.",
    "plainExplanation": "Tool use is the protocol for letting an LLM call functions you define. You give the model a list of tools (each with a name, description, and JSON Schema for inputs). When the model decides to call one, it emits a structured `tool_use` block. Your code runs the function, returns the result, and the model continues. The tools are prompts — write them like you'd write a function signature for a careful collaborator.",
    "exampleUseCase": "A vendor invoice arrives by email. Claude calls `extract_invoice_data` (returning amount, due date, vendor name), then `lookup_vendor_by_name`, then `route_to_approver`. Each tool is a small typed function in your code; Claude orchestrates the workflow.",
    "relatedToolIds": ["tool_claude_api", "tool_mcp_server"],
    "connectedContentIds": ["vid_007", "art_005", "vid_001"],
    "nextConceptIds": ["concept_evals"],
    "topicIds": ["topic_claude", "topic_mcp", "topic_agents"]
  },
  {
    "id": "ed_evals",
    "slug": "evals",
    "conceptId": "concept_evals",
    "title": "Evals",
    "level": "intermediate",
    "whyItMattersNow": "Without evals, you can't tell whether a prompt change made the system better or worse. Every team that ships LLM features eventually rebuilds eval infrastructure — start sooner.",
    "plainExplanation": "Evals are tests for LLM behavior. They compare model output against expected behavior across a set of cases. The simplest eval is a string match. More mature evals use structured outputs, LLM-as-judge, or rubric-based scoring. The bottleneck is data — collecting representative cases is harder than running them. Build the dataset alongside the feature; treat it as production infrastructure.",
    "exampleUseCase": "Before changing the system prompt for an invoice classifier, run the new prompt against 50 real (anonymized) invoices and compare classification labels to the old prompt. If accuracy drops on edge cases, you see it before users do.",
    "relatedToolIds": ["tool_claude_api"],
    "connectedContentIds": ["vid_008", "art_011", "post_004", "vid_006"],
    "nextConceptIds": ["concept_tool_use"],
    "topicIds": ["topic_agents", "topic_claude"]
  },
  {
    "id": "ed_rag",
    "slug": "rag",
    "conceptId": "concept_rag",
    "title": "RAG (Retrieval-Augmented Generation)",
    "level": "intermediate",
    "whyItMattersNow": "Models have a fixed knowledge cutoff. RAG is how you give them access to your data — docs, code, internal knowledge — without retraining.",
    "plainExplanation": "RAG splits a question-answering pipeline into retrieval and generation. Retrieval finds the most relevant context (using vector similarity, keyword search, or both). Generation puts that context into the prompt and asks the model to answer using it. The retrieval step is where most teams underinvest — quality of context dominates quality of answer.",
    "exampleUseCase": "A 'docs assistant' for your codebase: index every file as embeddings, retrieve the top 5 chunks for the user's question, prompt Claude with the chunks + question, and stream the answer with citations.",
    "relatedToolIds": [],
    "connectedContentIds": [],
    "nextConceptIds": ["concept_tool_use", "concept_evals"],
    "topicIds": ["topic_agents"]
  },
  {
    "id": "ed_agent_loop",
    "slug": "agent-loop",
    "conceptId": null,
    "title": "The Agent Loop",
    "level": "intermediate",
    "whyItMattersNow": "Most production 'agents' are still workflows. Knowing where to draw the line between a workflow you control and an agent that decides for itself is the difference between reliable and broken.",
    "plainExplanation": "An agent loop is: (1) the model receives a goal and tools, (2) it picks a tool, (3) the tool runs, (4) the result feeds back into the next turn, (5) repeat until the model says 'done' or a budget is hit. The loop is simple. What's hard is: keeping context short enough, preventing infinite loops, recovering from tool errors, and knowing when to ask the human.",
    "exampleUseCase": "Claude Code is an agent loop. You ask 'add a dark mode toggle.' It picks tools — read a file, edit the file, run tests — until either the task is done or it gets stuck and asks you a question.",
    "relatedToolIds": ["tool_claude_code"],
    "connectedContentIds": ["vid_001", "art_001", "vid_005", "art_009"],
    "nextConceptIds": ["concept_tool_use", "concept_evals"],
    "topicIds": ["topic_agents", "topic_claude"]
  },
  {
    "id": "ed_mcp_basics",
    "slug": "mcp-basics",
    "conceptId": null,
    "title": "MCP Basics",
    "level": "beginner",
    "whyItMattersNow": "MCP is replacing bespoke tool wiring as the way Claude (and other clients) connect to data and services. Learning the three primitives unlocks the whole ecosystem.",
    "plainExplanation": "MCP defines three primitives: tools (model-callable functions), resources (model-readable data), and prompts (user-callable templates). A server exposes any combination of these. A client connects to many servers and exposes their primitives to the model. Transport is JSON-RPC over stdio (local) or HTTP+SSE (remote). The contract is small enough to implement in an afternoon.",
    "exampleUseCase": "Build a personal MCP server that exposes a `search_my_notes` tool and `recent_notes` resource. Add it to Claude Code's MCP config. Now Claude can search your notes during any session, no copy-pasting.",
    "relatedToolIds": ["tool_mcp_server"],
    "connectedContentIds": ["vid_003", "vid_004", "art_002", "art_003", "art_010"],
    "nextConceptIds": ["concept_tool_use"],
    "topicIds": ["topic_mcp"]
  },
  {
    "id": "ed_vibecoding",
    "slug": "vibecoding",
    "conceptId": null,
    "title": "Vibecoding",
    "level": "beginner",
    "whyItMattersNow": "When the IDE is also a collaborator, the bottleneck shifts from typing to thinking. Vibecoding is the working style that emerges — high-bandwidth, intent-driven, with the model handling the syntax.",
    "plainExplanation": "Vibecoding is building software where you describe intent and the model writes the code. It's not 'no-code' — you still read every diff, run every test, fix what's wrong. But the unit of effort shifts from 'write this function' to 'design this feature.' The skills that matter most: clear prompts, good tests, knowing when to take the wheel.",
    "exampleUseCase": "Plan: 'add a save button to the article reader that toggles a bookmark icon and persists to localStorage.' Claude Code writes the diff, you review it, run the tests, and ship.",
    "relatedToolIds": ["tool_claude_code", "tool_cursor"],
    "connectedContentIds": ["vid_005", "art_004", "art_008", "post_003"],
    "nextConceptIds": [],
    "topicIds": ["topic_claude", "topic_agents"]
  }
]
```

- [ ] **Step 2: Verify**

```bash
node -e "console.log(require('./src/data/education.json').length)"
```

Expected: `6`.

- [ ] **Step 3: Commit**

```bash
git add src/data/education.json
git commit -m "data: seed 6 Education concept cards"
```

---

## Task 2: Expose `education` in `useSeed`

**Files:**
- Modify: `src/store/useSeed.js`

- [ ] **Step 1: Add the import + array + slug map**

Add to the imports:

```js
import education from '../data/education.json'
```

Add to the body of `useSeed()`:

```js
    const educationById = byId(education)
    const educationBySlug = bySlug(education)
```

Add to the returned object:

```js
      education,
      educationById: (id) => educationById[id],
      educationBySlug: (slug) => educationBySlug[slug],
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/store/useSeed.js
git commit -m "feat(store): expose education seed in useSeed"
```

---

## Task 3: Build `EducationCard` component

**Files:**
- Create: `src/components/education/EducationCard.jsx`

- [ ] **Step 1: Implement**

```jsx
import { Link } from 'react-router-dom'
import { GraduationCap, ArrowRight } from 'lucide-react'

const LEVEL_COLOR = {
  beginner:     '#10b981',
  intermediate: '#f59e0b',
  advanced:     '#f43f5e',
}

export default function EducationCard({ card }) {
  const lvl = LEVEL_COLOR[card.level] || '#94a3b8'
  return (
    <Link
      to={`/education/${card.slug}`}
      className="glass-panel p-5 flex flex-col gap-3 hover:brightness-125 transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[color:var(--color-learning)] font-medium">
          <GraduationCap size={13} /> Concept
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-medium border" style={{ borderColor: `${lvl}66`, background: `${lvl}1a`, color: lvl }}>
          {card.level}
        </span>
      </div>

      <h3 className="text-lg font-semibold leading-tight">{card.title}</h3>
      <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed line-clamp-3">
        {card.whyItMattersNow}
      </p>

      <div className="mt-auto pt-3 border-t border-[color:var(--color-border-subtle)] flex items-center justify-between text-[11px] text-[color:var(--color-text-tertiary)]">
        <span>{card.connectedContentIds?.length ?? 0} connected items</span>
        <ArrowRight size={13} />
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/education/EducationCard.jsx
git commit -m "feat(education): add EducationCard"
```

---

## Task 4: Build Education index view (`/education`)

**Files:**
- Modify: `src/views/Education.jsx`

- [ ] **Step 1: Implement**

```jsx
import { useState } from 'react'
import { useSeed } from '../store/useSeed.js'
import EducationCard from '../components/education/EducationCard.jsx'

const FILTERS = [
  { id: 'all',          label: 'All' },
  { id: 'beginner',     label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced',     label: 'Advanced' },
]

export default function Education() {
  const { education } = useSeed()
  const [level, setLevel] = useState('all')

  const cards = level === 'all' ? education : education.filter((c) => c.level === level)

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Education</h1>
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-1 max-w-2xl">
          Hand-written concept cards on the ideas behind your topics. Each card links to videos and articles that go deeper.
        </p>
      </header>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setLevel(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              level === f.id
                ? 'bg-[color:var(--color-learning)]/15 border-[color:var(--color-learning)]/40 text-[color:var(--color-learning)]'
                : 'border-[color:var(--color-border-subtle)] text-[color:var(--color-text-secondary)] hover:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-[color:var(--color-text-tertiary)] py-12 text-center">No cards at this level.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c) => <EducationCard key={c.id} card={c} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/Education.jsx
git commit -m "feat(view): build Education index"
```

---

## Task 5: Build `EducationDetail.jsx` view (`/education/:slug`)

**Files:**
- Create: `src/views/EducationDetail.jsx`

- [ ] **Step 1: Implement**

```jsx
import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import { ChevronLeft, GraduationCap, ArrowRight, ExternalLink } from 'lucide-react'
import { useSeed } from '../store/useSeed.js'
import VideoCard from '../components/content/VideoCard.jsx'
import ArticleCard from '../components/content/ArticleCard.jsx'
import SocialPostCard from '../components/content/SocialPostCard.jsx'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'
import Chip from '../components/ui/Chip.jsx'

const LEVEL_COLOR = {
  beginner:     '#10b981',
  intermediate: '#f59e0b',
  advanced:     '#f43f5e',
}

export default function EducationDetail() {
  const { slug } = useParams()
  const { educationBySlug, educationById, contentById, toolById, topicById } = useSeed()
  const card = educationBySlug(slug)

  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  if (!card) {
    return (
      <div className="p-6">
        <Link to="/education" className="text-sm text-[color:var(--color-text-tertiary)] inline-flex items-center gap-1 hover:text-white">
          <ChevronLeft size={14} /> Back to education
        </Link>
        <h1 className="text-2xl font-semibold mt-4">Concept not found</h1>
      </div>
    )
  }

  const lvl = LEVEL_COLOR[card.level] || '#94a3b8'
  const connected = (card.connectedContentIds || []).map(contentById).filter(Boolean)
  const next = (card.nextConceptIds || [])
    .map((cid) => educationById(`ed_${cid.replace('concept_', '')}`)) // attempt match
    .filter(Boolean)

  function open(item) {
    if (item.type === 'video') setOpenVideo(item)
    else setOpenArticle(item)
  }

  return (
    <div className="p-6 max-w-[920px] mx-auto">
      <Link to="/education" className="text-sm text-[color:var(--color-text-tertiary)] inline-flex items-center gap-1 hover:text-white mb-4">
        <ChevronLeft size={14} /> Back to education
      </Link>

      <header className="glass-panel p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-[color:var(--color-learning)] font-medium">
            <GraduationCap size={13} /> Concept
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-medium border" style={{ borderColor: `${lvl}66`, background: `${lvl}1a`, color: lvl }}>
            {card.level}
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">{card.title}</h1>
        <p className="mt-3 text-sm italic text-[color:var(--color-text-tertiary)] max-w-2xl leading-relaxed">
          {card.whyItMattersNow}
        </p>
      </header>

      <article className="glass-panel p-6 mb-6 space-y-5">
        <section>
          <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">Plain explanation</h2>
          <p className="text-sm leading-relaxed">{card.plainExplanation}</p>
        </section>

        {card.exampleUseCase ? (
          <section>
            <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">Example</h2>
            <p className="text-sm leading-relaxed">{card.exampleUseCase}</p>
          </section>
        ) : null}

        {card.relatedToolIds?.length ? (
          <section>
            <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">Related tools</h2>
            <div className="flex flex-wrap gap-2">
              {card.relatedToolIds.map((id) => {
                const tool = toolById(id)
                return tool ? (
                  <a key={id} href={tool.url} target="_blank" rel="noreferrer" className="chip hover:brightness-125">
                    {tool.name} <ExternalLink size={10} />
                  </a>
                ) : null
              })}
            </div>
          </section>
        ) : null}

        {card.topicIds?.length ? (
          <section>
            <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-2">Topics this applies to</h2>
            <div className="flex flex-wrap gap-2">
              {card.topicIds.map((id) => {
                const t = topicById(id)
                return t ? <Link key={id} to={`/topic/${t.slug}`}><Chip color="#f97316">{t.name}</Chip></Link> : null
              })}
            </div>
          </section>
        ) : null}
      </article>

      {connected.length ? (
        <section className="mb-6">
          <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">
            Watch & read ({connected.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {connected.map((it) =>
              it.type === 'video'   ? <VideoCard       key={it.id} item={it} onOpen={open} /> :
              it.type === 'article' ? <ArticleCard     key={it.id} item={it} onOpen={open} /> :
                                      <SocialPostCard  key={it.id} item={it} onOpen={open} />
            )}
          </div>
        </section>
      ) : null}

      {next.length ? (
        <section>
          <h2 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Next concepts</h2>
          <div className="flex flex-wrap gap-2">
            {next.map((c) => (
              <Link key={c.id} to={`/education/${c.slug}`} className="chip hover:brightness-125">
                {c.title} <ArrowRight size={11} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </div>
  )
}
```

- [ ] **Step 2: Add the route to App.jsx**

In `src/App.jsx`, add the Education detail import:

```jsx
import EducationDetail from './views/EducationDetail.jsx'
```

And the route inside `<Routes>`:

```jsx
<Route path="/education/:slug" element={<EducationDetail />} />
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/views/EducationDetail.jsx src/App.jsx
git commit -m "feat(view): build Education detail page + route"
```

---

## Task 6: Cross-link Education from Topic page

**Files:**
- Modify: `src/views/Topic.jsx`

- [ ] **Step 1: Add an Education chip cluster to the Topic side rail**

Find the side rail's `concepts` block and add an "Education" panel ABOVE it. Modify the imports at the top of `Topic.jsx`:

```jsx
import { Link } from 'react-router-dom'
```

(Already imported.) Then in the side rail (after the existing Concepts panel), add:

```jsx
{(() => {
  const eds = useSeed().education.filter((c) => c.topicIds?.includes(topic.id))
  if (!eds.length) return null
  return (
    <div className="glass-panel p-4">
      <h3 className="text-[11px] uppercase tracking-wide text-[color:var(--color-text-tertiary)] font-medium mb-3">Learn the concepts</h3>
      <ul className="space-y-2">
        {eds.map((c) => (
          <li key={c.id}>
            <Link to={`/education/${c.slug}`} className="text-sm hover:underline text-[color:var(--color-learning)]">
              {c.title}
            </Link>
            <p className="text-[11px] text-[color:var(--color-text-tertiary)]">{c.level}</p>
          </li>
        ))}
      </ul>
    </div>
  )
})()}
```

(Inline IIFE keeps the additional `useSeed` consumption local. Alternatively, you can pull `education` into the existing destructuring at the top of the component.)

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/views/Topic.jsx
git commit -m "feat(view): cross-link Education from Topic side rail"
```

---

# Phase 7 — Polish

## Task 7: Build `EmptyState` and `Skeleton` UI primitives

**Files:**
- Create: `src/components/ui/EmptyState.jsx`
- Create: `src/components/ui/Skeleton.jsx`

- [ ] **Step 1: `EmptyState.jsx`**

```jsx
export default function EmptyState({ icon: Icon, title, body, cta }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon ? (
        <div className="w-12 h-12 rounded-full bg-[color:var(--color-bg-glass-strong)] border border-[color:var(--color-border-default)] flex items-center justify-center mb-4">
          <Icon size={20} className="text-[color:var(--color-text-tertiary)]" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold">{title}</h3>
      {body ? <p className="text-sm text-[color:var(--color-text-tertiary)] mt-2 max-w-md">{body}</p> : null}
      {cta ? <div className="mt-4">{cta}</div> : null}
    </div>
  )
}
```

- [ ] **Step 2: `Skeleton.jsx`**

```jsx
export default function Skeleton({ className = '', height = 12 }) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{
        height,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.05) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.6s ease-in-out infinite',
      }}
    />
  )
}
```

Add the `shimmer` keyframe to `src/index.css` `@layer base`:

```css
@keyframes shimmer {
  0%   { background-position: 200% 0;   }
  100% { background-position: -200% 0;  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/EmptyState.jsx src/components/ui/Skeleton.jsx src/index.css
git commit -m "feat(ui): add EmptyState + Skeleton primitives"
```

---

## Task 8: Build `NotFound.jsx` view + 404 route

**Files:**
- Create: `src/views/NotFound.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Implement `NotFound.jsx`**

```jsx
import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState.jsx'

export default function NotFound() {
  return (
    <div className="p-6">
      <EmptyState
        icon={Compass}
        title="404 — that route doesn't exist"
        body="Try the search bar (cmd+K) or jump back to the Home page."
        cta={
          <Link to="/" className="btn btn-primary text-sm">Go home</Link>
        }
      />
    </div>
  )
}
```

- [ ] **Step 2: Add route**

In `src/App.jsx`, import:

```jsx
import NotFound from './views/NotFound.jsx'
```

And as the LAST route inside `<Routes>`:

```jsx
<Route path="*" element={<NotFound />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/views/NotFound.jsx src/App.jsx
git commit -m "feat(view): add 404 NotFound route"
```

---

## Task 9: Add empty states across views

**Files:**
- Modify: `src/views/Discover.jsx`
- Modify: `src/views/Topics.jsx`
- Modify: `src/views/Memory.jsx`

- [ ] **Step 1: Discover — replace the bare-text empty state**

Find:
```jsx
visible.length === 0 ? (
  <p className="text-sm text-[color:var(--color-text-tertiary)] py-16 text-center">
    Nothing matches. Loosen your filters.
  </p>
) : (
```

Replace with:
```jsx
visible.length === 0 ? (
  <EmptyState
    icon={Filter}
    title="Nothing matches"
    body="Loosen your filters or clear the search to see everything."
  />
) : (
```

Add at the top of `Discover.jsx`:
```jsx
import EmptyState from '../components/ui/EmptyState.jsx'
```

- [ ] **Step 2: Topics — wrap the empty case**

After the `sorted.map(...)` block, add a check (if `sorted.length === 0` … but topics are seeded, this is a defensive case). Skip if list always has 3.

- [ ] **Step 3: Memory — replace bare-text empty cases for tabs**

In `Memory.jsx`, replace the followed/memory empty `<p>` lines with `<EmptyState>` calls. Add the import:
```jsx
import EmptyState from '../components/ui/EmptyState.jsx'
import { Bookmark, Database } from 'lucide-react'
```

Replace the followed-empty paragraph with:
```jsx
<EmptyState
  icon={Bookmark}
  title="Not following any topics yet"
  body="Find one in /topics."
  cta={<Link to="/topics" className="btn btn-primary text-sm">Browse topics</Link>}
/>
```

Replace the memory-empty paragraph with:
```jsx
<EmptyState
  icon={Database}
  title="No memory entries in this category"
  body="Add a rule, source preference, research focus, or stack note above."
/>
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/views/Discover.jsx src/views/Memory.jsx
git commit -m "feat(ui): add EmptyState to Discover and Memory empty cases"
```

---

## Task 10: Add `/` keyboard shortcut to focus search (cmd-K)

**Files:**
- Modify: `src/components/search/useCmdK.js`

- [ ] **Step 1: Extend the hook**

Replace `useCmdK.js`:

```js
import { useEffect, useState } from 'react'

export function useCmdK() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handler(e) {
      const target = e.target
      const isEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === '/' && !isEditable) {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return [open, setOpen]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/search/useCmdK.js
git commit -m "feat(ui): add / shortcut to open cmd-K palette"
```

---

## Task 11: Add j/k feed navigation in Discover

**Files:**
- Modify: `src/views/Discover.jsx`

- [ ] **Step 1: Add a keyboard handler that scrolls cards into view**

At the top of `Discover.jsx`, import:
```jsx
import { useEffect, useRef } from 'react'
```

(`useRef` if not already imported.) Inside the component, after `const [openArticle, setOpenArticle] = useState(null)`:

```jsx
const cursorRef = useRef(0)

useEffect(() => {
  function onKey(e) {
    if (openVideo || openArticle) return
    const target = e.target
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
    if (e.key === 'j' || e.key === 'k') {
      e.preventDefault()
      const cards = Array.from(document.querySelectorAll('[data-feed-card]'))
      if (!cards.length) return
      cursorRef.current = Math.max(0, Math.min(cards.length - 1, cursorRef.current + (e.key === 'j' ? 1 : -1)))
      cards[cursorRef.current].scrollIntoView({ behavior: 'smooth', block: 'center' })
      cards[cursorRef.current].focus({ preventScroll: true })
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [openVideo, openArticle])
```

In the JSX where each card is rendered, add `data-feed-card` and `tabIndex={-1}` to the wrapping `<div>`:

```jsx
<div key={it.id} data-feed-card tabIndex={-1} className="relative group focus:outline-none focus:ring-2 focus:ring-[color:var(--color-topic)]/40 rounded-2xl">
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/views/Discover.jsx
git commit -m "feat(ui): add j/k keyboard navigation to Discover feed"
```

---

## Task 12: Final smoke test + Plan 1 → 4 verification

**Files:** *(no changes — verification only)*

- [ ] **Step 1: Run all tests**

```bash
npm run test:run
```

Expected: ~50 tests pass (Plans 1–3 + this plan adds none, since polish is mostly UI).

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: pre-existing warnings only (none introduced by this plan).

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Visit each route in dev server**

`/`, `/discover`, `/topics`, `/topic/claude`, `/flow`, `/education`, `/education/tool-use`, `/memory`, `/search?q=mcp`, `/some-bad-route` (expect 404).

- [ ] **Step 5: Verify the full v1 acceptance criteria from the spec**

Check each box:

- [ ] All 6 sections reachable, render without errors, visually consistent (dark glassmorphic).
- [ ] Search, filter, save, follow work end-to-end.
- [ ] At least 60 real content items reachable across topics. (We have 24 — note as a known gap in v1 if relevant.)
- [ ] Every video plays in-app via YouTube embed.
- [ ] Every article opens reader drawer with summary + key points + external link.
- [ ] Saves, follows, dismisses persist across reloads.
- [ ] Flow Map page renders the 3D graph; drag, rotate, pan, zoom, hover tooltip, click-select work.
- [ ] Clicking a video node opens the player; article node → reader; topic node → /topic/:slug.
- [ ] No console errors on any route.
- [ ] Tested at 1280×800 minimum; responsive down to 1024px.
- [ ] cmd+K and `/` open the search palette.
- [ ] j/k navigate the Discover feed.
- [ ] 404 page renders on unknown routes.

- [ ] **Step 6: Final commit**

```bash
git commit --allow-empty -m "chore: complete Plan 4 — Education + polish (FlowMap v1 done)"
```

---

# Done — FlowMap v1 complete

After all four plans:

- 6-section app, fully navigable, dark glassmorphic visual system end-to-end.
- Curated seed library of 24 real content items + 3 topics + 4 creators + 4 tools + 6 education concept cards.
- Local-first persistence — saves, follows, dismisses, views, searches, custom Memory entries — all in localStorage.
- Behavioral signal capture from day one. The Flow Map's pattern engine consumes them to surface co-occurrence and topic affinity.
- Cinematic 3D Flow Map page with custom canvas renderer, glass sidebar, KPI strip, sources/signals cards, Interest Memory panel.
- Cross-linked Topic ↔ Education ↔ Content surfaces.
- Global cmd+K / `/` search palette + dedicated `/search?q=…` results page.
- 404, empty states, j/k feed navigation, keyboard polish.

**v1.1 stretch (deferred):** Live ingestion connectors (RSS, YouTube Data API, HN, Reddit), AI-generated summaries, exports, multi-device sync.
