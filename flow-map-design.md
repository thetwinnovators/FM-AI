# Flow Map — Design Description

The Flow Map lives at [`/intelligence`](../src/app/(app)/intelligence/page.tsx) (sidebar label "Flow Map", admin-only — staff are redirected back to the dashboard). It is Flowerk's intelligence console: a single page that visualizes how raw inputs, integrations, AI, rules, memory, and outputs connect, plus the seed-memory store that primes the knowledge graph.

---

## 1. Page Layout (top → bottom)

Source: [src/app/(app)/intelligence/page.tsx](../src/app/(app)/intelligence/page.tsx)

1. **Header** — `Flow Map` title + sub-copy, with a right-aligned `Live · N active` pill (emerald, pulsing) when real Supabase data is flowing, else a neutral `Demo data` badge. Live state is driven by [useIntelligenceData](../src/lib/intelligence/useIntelligenceData.ts).
2. **Agent Intelligence Pipeline strip** — four equal columns describing the loop *Understand Intent → Coordinate Action → Retain Context → Reliable Outcomes*. Each card pulls live counts from `metrics` and `activeNodeIds`.
3. **Network console** — a dark `#05070f` panel, `height: 640`, that hosts:
   - **Glass sidebar** (250 px) absolutely positioned over the canvas top-left, with backdrop-blur + saturate, custom dark-mode token overrides.
   - **Canvas** (`<NeuralNetViz>`) filling the rest, with a topbar (`Drag to rotate · Shift+drag to pan · Click a node to inspect`) and a fullscreen toggle.
   - **Legend strip** at the bottom with nine type swatches.
4. **Stat-card row** — 7 KPIs (active jobs, completed today, success rate, active flows, contacts, doc requests, team members). The latter three are clickable and select the corresponding node (`in4`, `in3`, `in5`).
5. **Two side-by-side cards** — *Connected integrations* (Gmail / Slack / Accounting, each a button that selects its node `ig0`/`ig1`/`ig2`) and *Derived signals* (`sg0` payment reliability, `sg1` complexity, `sg2` trust score) tinted by tone.
6. **Seed Memory panel** — full-width, with header CTA, category filter strip, inline add form, and a 3-column entry grid.

---

## 2. The Network — Nodes & Connectors

### 2.1 Node taxonomy

There are **9 node types** ([page.tsx:39-100](../src/app/(app)/intelligence/page.tsx#L39-L100), [NeuralNetViz.tsx:255-265](../src/components/ui/NeuralNetViz.tsx#L255-L265)):

| Type          | Color (RGB)        | Role                              | Examples                                                                    |
| ------------- | ------------------ | --------------------------------- | --------------------------------------------------------------------------- |
| `entity`      | orange `#f97316`   | Real business objects             | Client, Project, Vendor, Contract, Task, Staff Member                       |
| `attribute`   | slate `#94a3b8`    | Metadata enriching entities       | Location, Timezone, Rate, Status, Due Date, Phone, Email, Pay Terms, Tax ID, License, Trade, Comms |
| `input`       | blue `#3b82f6`     | Raw data entry points             | Invoice, Email, Schedule, Documents, Contacts, Employees                    |
| `integration` | cyan `#06b6d4`     | Live third-party feeds            | Gmail, Slack, Accounting (QB / Stripe)                                      |
| `ai`          | teal `#14b8a6`     | Claude calls (advisory only)      | Classify, Extract, Intent                                                   |
| `rule`        | amber `#f59e0b`    | Deterministic gates               | Approve?, Amount, Route                                                     |
| `memory`      | violet `#8b5cf6`   | Persistent tenant context         | Memory (`mem`)                                                              |
| `signal`      | pink `#ec4899`     | Patterns derived from memory      | Payment reliability, Profile complexity, Trust                              |
| `output`      | emerald `#10b981`  | Terminal actions                  | Execute, Alert                                                              |

Every node carries `{ label, type, dataSource, connects[] }`. `dataSource` documents the underlying table or API (e.g. `mem` → `Supabase · tenant context`; `ig2` → `QuickBooks · Stripe payments`).

### 2.2 Topology

The graph is a layered DAG flowing left-to-right with attribute / entity layers stacked above:

```
attributes (top)
   ↓ enrich
entities  ── feed ──► inputs
                       ↓
integrations ──────►  AI (Claude) ──► rules ──► outputs
                       ▲                ▲
                     memory  ──►  derived signals  ──► rules
```

Edges are declared in two mirrored shapes:
- `EDGES[]` in [NeuralNetViz.tsx:95-172](../src/components/ui/NeuralNetViz.tsx#L95-L172) — used for rendering.
- `NODE_CONNECTS` in [NeuralNetViz.tsx:221-253](../src/components/ui/NeuralNetViz.tsx#L221-L253) — re-exported and used by the page to derive *outbound* connections per node. The page also computes `NODE_INBOUND` by reversing `NODE_CONNECTS` ([page.tsx:130-139](../src/app/(app)/intelligence/page.tsx#L130-L139)).

Memory is a hub: it both feeds the AI / rule layer (`mem → ai0, ai1, ru0`) *and* generates the signal layer (`mem → sg0, sg1, sg2`), which then loops back into rules (`sg0 → ru1`, `sg1 → ru2`, `sg2 → ru0`). That feedback loop is the visual proof of "learn, then influence the next decision."

### 2.3 Visual rendering

[`NeuralNetViz`](../src/components/ui/NeuralNetViz.tsx) is a canvas component, not SVG. Each node has 3-D base coords `(bx, by, bz)` plus a `phase` for idle wobble. Per frame:

- **Projection** — a Y-rotation × X-rotation matrix applied to base coords; perspective divide by `(focalZ - z)` produces `sx/sy` and a `depth`. Bigger depth → larger radius `r` and brighter color (depth-of-field).
- **Edges** — drawn as thin curves between projected positions; opacity scales with the average depth of the two endpoints.
- **Signals** — animated packets traveling along edges at variable speed, colored by source-node RGB. On arrival they trigger a one-shot **bounce** on the destination node (per-node spring `{ amp, vel }`), creating the "rubber-band pulse" you see when activity moves through the graph.
- **Heat & active state** — `nodeHeat[id] ∈ [0,1]` brightens the node halo; `activeNodeIds` adds an emerald pulse and emits signals.
- **Selection focus** — when `selectedNodeId` is set, the visualization dims everything except the selected node and its direct neighbors. `hitTest` restricts clickable nodes to that visible subgraph ([NeuralNetViz.tsx:350-370](../src/components/ui/NeuralNetViz.tsx#L350-L370)).

---

## 3. Interactions

### 3.1 Canvas

- **Plain drag** → rotate around Y / X axes. Releases with **angular momentum** (`rotYVel`, `rotXVel`) so the graph spins down naturally.
- **Shift + drag** → pan in canvas-pixel space (`panXRef`, `panYRef`).
- **Scroll wheel** → zoom toward cursor (`zoomRef`).
- **Hover** → cursor changes (`grab` / `grabbing` / `move`); hover ID flows back via `onNodeHover`.
- **Click** → toggles `selectedNodeId`. A real click is distinguished from drag-end by the `didDragRef` flag (mouse must move < ~2 px).
- **Auto-rotate** — runs by default and resumes after a few seconds of idle (`autoTimerRef`).
- **Fullscreen** — the canvas container has a 4-phase animation (`idle → expanding → full → shrinking`). `enterFullscreen` captures the current `getBoundingClientRect`, switches to `position: fixed` at the captured rect (no visual jump via double-rAF), then animates `top/left/right/bottom/border-radius` to `0` over 420 ms ([page.tsx:269-287, 763-799](../src/app/(app)/intelligence/page.tsx#L269-L799)). `Esc` exits.

### 3.2 Glass sidebar (three modes)

Mode is determined by `searchQuery` and `selectedNodeId`:

- **Mode 1 — Search** ([page.tsx:537-564](../src/app/(app)/intelligence/page.tsx#L537-L564)): typed query filters `ALL_NODES` by label, type, or `NODE_DESC`. Each match shows a 2-letter type chip + label + 2-line description; click selects the node and clears the input.
- **Mode 2 — Node detail** ([page.tsx:567-678](../src/app/(app)/intelligence/page.tsx#L567-L678)): shows the node icon / type badge + ACTIVE pill (if live), description, **data source** (mono), a **plain-English connection sentence** built by `describeConnections()`, then two pill clouds — *Receives from (n)* and *Sends to (n)*. Each pill is itself a button that re-selects the related node.
- **Mode 3 — Directory** ([page.tsx:681-752](../src/app/(app)/intelligence/page.tsx#L681-L752)): collapsible groups (one per type) with a colored dot, group label, "N live" count, total count, and rotating chevron. Inside, each node has a name + emerald glow when active. Default state: all groups collapsed.

### 3.3 Cross-surface deep links

Selection is shared state, so:
- Clicking a stat card (Contacts / Doc requests / Team members) selects its source node.
- Clicking an integration row selects `ig0` / `ig1` / `ig2`.
- Clicking a derived signal row selects `sg0` / `sg1` / `sg2`.

This is how the dashboard panels become explainability surfaces for the graph rather than disconnected widgets.

---

## 4. Memory Storage Logic

Two distinct storage models live on this page.

### 4.1 Live "node heat" derivation — the runtime view

[useIntelligenceData](../src/lib/intelligence/useIntelligenceData.ts) is the hook that turns Supabase state into the *which nodes are lit, and how brightly* signal that the canvas consumes.

- **Source of truth**: `job_runs`, `flows`, `health_alerts`, `doc_collection_requests`, `subcontractors`, `users`, `invoices`, `inbound_emails` — all queried in parallel.
- **Mapping rule**: `JOB_NODE_MAP` (lines 49-53) maps job types (`api_task`, `browser_task`, `preview`) to the node IDs they exercise. Each active job adds `+0.3` heat to its mapped nodes, capped at `1.0`.
- **Static warmth**: even with no active jobs, persistent data lights up source nodes — e.g. any open doc requests → `in3 ≥ 0.2`; any inbound emails today → `ig0 ≥ 0.3`; any invoices → `ig2 ≥ 0.3` and `sg0` (overdue makes it warmer at `0.55`).
- **Memory always participates**: if anything is active, `mem` is forced into `activeSet`.
- **Subscription**: a Supabase Realtime channel on `job_runs` triggers `refresh()` on every change, plus a 30 s polling fallback. In `NODE_ENV=development` the hook short-circuits and keeps the rich `DEMO` constants so the UI stays populated.

This is purely *derived state* — the graph itself isn't stored; it's recomputed from operational tables.

### 4.2 Seed Memory — the priming store

[page.tsx:176-241, 974-1144](../src/app/(app)/intelligence/page.tsx#L974-L1144) implements the **Seed Memory** panel. This is where users *prime the knowledge graph with baseline facts before learning begins*.

**Schema:**
```ts
interface SeedEntry {
  id:         string
  category:   'business_context' | 'client_preference' | 'workflow_rule' | 'team_knowledge'
  content:    string
  confidence: number          // 0 – 1
  status:     'validated' | 'active' | 'learning'
  addedAt:    string          // YYYY-MM-DD
}
```

Each entry maps to the pattern lifecycle defined in `CLAUDE.md` ("Observed → Inferred → Validated → Trusted → Revoked"): user-authored seeds enter at `confidence: 1.0, status: 'active'` and bypass the observe / infer phases.

**Categories** (`SEED_CATEGORY_CONFIG`) each get a colored badge:
- *Workflow Rule* — amber. e.g. *"Invoices over $10,000 always require owner approval before sending."*
- *Client Preference* — teal. e.g. *"Miller & Sons pays within 7 days when reminded by email."*
- *Business Context* — blue. e.g. *"Construction sector clients prefer direct calls."*
- *Team Knowledge* — orange. e.g. *"Sofia handles Operations approvals when Marcus is out."*

**Statuses** — `validated` (emerald), `active` (teal), `learning` (amber).

**UI logic:**
- Filter strip (`SEED_FILTER_TABS`) toggles `seedFilter`; counts per tab are derived live from `seedEntries`.
- Inline add form (`showAddForm`) takes a free-text fact + category dropdown; Save creates a new entry at the top of the list with `confidence: 1.0`, `status: 'active'`, and the current ISO date.
- Each entry card shows category badge, status pill, content, a confidence bar (`width: confidence × 100%`), and a "Added on" timestamp. Hover reveals a delete button.

**Persistence note:** the current implementation holds entries in `useState` seeded from `DEMO_SEED_ENTRIES`; per [`flowerk-trusted-memory-spec.md`](../flowerk-trusted-memory-spec.md), the production path is to back this with the FlowMap knowledge-graph tables (with tenant isolation, RLS, and the pattern lifecycle described in `CLAUDE.md` lines 704-1152). The visual UX is already production-shaped — the swap is from in-memory state to Supabase writes.

---

## 5. How the parts cohere

The page tells one story across three surfaces:

1. **The pipeline strip** says *what* the agent does (Intent → Action → Context → Outcome).
2. **The network** shows *how* those stages are wired — every node click answers "where does this fit, what feeds it, what does it feed?"
3. **The seed memory** lets the operator *prime* that network with facts that immediately become eligible to influence decisions through `mem → ai / rule` edges and the derived `sg0 / sg1 / sg2` loop back into rules.

The selection model is the connective tissue: KPI cards, integration rows, and signal rows all dispatch to the same `setSelectedNodeId`, so the canvas is never a standalone visualization — it's the explanation surface for everything else on the page.
