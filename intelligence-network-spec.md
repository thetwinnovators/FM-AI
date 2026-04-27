# Intelligence Page & Network Visualisation — Recreation Spec

This document contains everything needed to rebuild `src/app/(app)/intelligence/page.tsx` and
`src/components/ui/NeuralNetViz.tsx` from scratch — layout, data model, canvas renderer, and
interaction behaviours.

---

## 1. Page overview

The **Flow Map / Intelligence** page is an admin-only, read-only view that explains how
Flowerk's backend pipeline works. It has five vertical sections:

1. Page header + live/demo badge
2. 4-stage agent pipeline banner
3. Dark canvas network (with floating glass sidebar + fullscreen toggle)
4. 7 stat cards in a row
5. Connected integrations card + Derived signals card (2 columns)
6. Seed Memory section (cards grid + inline add form)

Route: `/intelligence`  
File: `src/app/(app)/intelligence/page.tsx`  
Access guard: redirect `role === 'staff'` → `/dashboard`

---

## 2. Stack requirements

| Dependency | Version |
|---|---|
| Next.js App Router | 15 |
| React | 18+ |
| Tailwind CSS | v4 |
| `@remixicon/react` | latest |
| Supabase auth | via `useAuth()` hook |
| Intelligence data hook | `useIntelligenceData()` (see §11) |

---

## 3. Page header

```tsx
<div className="flex items-start justify-between mb-6">
  <div>
    <h1 className="text-[28px] font-bold text-text-primary" style={{ letterSpacing: '-0.03em' }}>
      Flow Map
    </h1>
    <p className="text-sm text-text-secondary mt-1 max-w-2xl">
      How Flowerk.io combines neural classification, deterministic rule gates, and persistent
      tenant memory to automate your back office — accurately and auditably.
    </p>
  </div>

  {/* Live badge */}
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[12px] font-medium flex-shrink-0 ${
    isLive
      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : 'bg-surface border-border-default text-text-tertiary'
  }`}>
    <RiRadioButtonLine size={12} className={isLive ? 'text-emerald-500 animate-pulse' : ''} />
    {isLive ? `Live · ${metrics.activeJobs} active` : 'Demo data'}
  </div>
</div>
```

---

## 4. 4-stage agent pipeline banner

A card with a `bg-surface-sunken` header bar and a 4-column divided grid.

```tsx
<div className="mb-6 rounded-2xl border border-border-default bg-surface overflow-hidden">
  {/* Header bar */}
  <div className="px-5 py-2.5 border-b border-border-subtle bg-surface-sunken flex items-center justify-between">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
      Agent Intelligence Pipeline
    </p>
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-[10px] text-text-tertiary">4-stage loop · always running</span>
    </div>
  </div>

  <div className="grid grid-cols-4 divide-x divide-border-subtle">
    {/* Repeat for each stage */}
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <RiRobot2Line size={14} className="text-teal-500" />
        <p className="text-[13px] font-semibold text-text-primary">Understand Intent</p>
      </div>
      <p className="text-[11px] text-text-secondary leading-relaxed mb-2">…</p>
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"
          style={{ boxShadow: '0 0 4px rgba(16,185,129,0.7)' }} />
        <span className="text-[11px] text-emerald-600 font-medium">{N} signals active</span>
      </div>
      <p className="text-[10px] text-text-tertiary mt-1">Classification · Extraction · Intent</p>
    </div>
    {/* Stage 2: RiGitBranchLine amber-500  — Coordinate Action  */}
    {/* Stage 3: RiDatabase2Line text-accent — Retain Context    */}
    {/* Stage 4: RiShieldCheckLine emerald   — Reliable Outcomes */}
  </div>
</div>
```

Stage metadata:

| # | Icon | Color | Title | Subtext |
|---|---|---|---|---|
| 1 | `RiRobot2Line` | `text-teal-500` | Understand Intent | Classification · Extraction · Intent |
| 2 | `RiGitBranchLine` | `text-amber-500` | Coordinate Action | Routing · Assignment · Execution |
| 3 | `RiDatabase2Line` | `text-accent` | Retain Context | Memory · Patterns · Relationships |
| 4 | `RiShieldCheckLine` | `text-emerald-500` | Reliable Outcomes | Audit · Determinism · Trust |

---

## 5. Network canvas container

### 5.1 Layout wrapper

```tsx
<div className="relative">   {/* positions the glass sidebar over the canvas */}

  {/* Glass sidebar — absolute over canvas (see §6) */}
  <aside ... />

  {/* Full-width canvas */}
  <div
    ref={canvasContainerRef}
    className="flex flex-col overflow-hidden"
    style={{
      background: '#05070f',
      borderRadius: '1rem',
      border: '1px solid rgba(255,255,255,0.07)',
      height: 640,
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
    }}
  >
    {/* Header bar */}
    <div className="px-6 h-12 border-b flex items-center justify-between flex-shrink-0"
      style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
    >
      <h2 className="text-[13px] font-semibold text-white/70 tracking-wide">Network</h2>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-white/30">
          Drag to rotate · Shift+drag to pan · Click a node to inspect
        </span>
        <button onClick={toggleFullscreen} className="text-white/40 hover:text-white/80 transition-colors">
          {isFullscreen ? <RiFullscreenExitLine size={14} /> : <RiFullscreenLine size={14} />}
        </button>
      </div>
    </div>

    {/* Canvas */}
    <div className="flex-1 min-h-0">
      <NeuralNetViz
        className="w-full h-full"
        activeNodeIds={activeNodeIds}
        nodeHeat={nodeHeat}
        searchQuery={searchQuery}
        selectedNodeId={selectedNodeId}
        onNodeClick={handleNodeClick}
      />
    </div>

    {/* Legend bar */}
    <div className="px-5 py-2.5 flex items-center gap-4 flex-wrap border-t flex-shrink-0"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}
    >
      {LEGEND.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color, boxShadow: `0 0 5px ${color}88` }} />
          <span className="text-[10px] text-gray-500">{label}</span>
        </div>
      ))}
    </div>
  </div>
</div>
```

### 5.2 Legend colours

```ts
const LEGEND = [
  { color: '#f97316', label: 'Business Entity' },
  { color: '#94a3b8', label: 'Attribute'        },
  { color: '#3b82f6', label: 'Data Input'       },
  { color: '#06b6d4', label: 'Integration'      },
  { color: '#14b8a6', label: 'Neural (AI)'      },
  { color: '#f59e0b', label: 'Rule Engine'      },
  { color: '#8b5cf6', label: 'Memory'           },
  { color: '#ec4899', label: 'Derived Signal'   },
  { color: '#10b981', label: 'Action Output'    },
]
```

### 5.3 Fullscreen animation state machine

States: `idle → expanding → full → shrinking → idle`

```ts
type FsPhase = 'idle' | 'expanding' | 'full' | 'shrinking'
const [fsPhase, setFsPhase] = useState<FsPhase>('idle')
const [capturedRect, setCapturedRect] = useState<{
  top: number; left: number; right: number; bottom: number
} | null>(null)
const FS_DURATION = 420  // ms
```

On enter: capture `getBoundingClientRect()`, convert to `{top, left, right=(vw-rect.right), bottom=(vh-rect.bottom)}`.
Set phase to `expanding`, then double-`rAF` to `full`.

On exit: set phase to `shrinking`, after `FS_DURATION` ms set back to `idle`.

The canvas container uses `position: fixed` during `expanding/full/shrinking`, with inline
`top/left/right/bottom` transitioning to `0` during `full`, and back to the captured rect
during `shrinking`. `border-radius` transitions from `1rem` → `0` → `1rem`.

ESC key calls `exitFullscreen` when `fsPhase === 'full'`.

---

## 6. Glass sidebar

Floats absolutely over the canvas (`top-[48px] left-3`), width `250px`.

```tsx
<aside
  className="w-[250px] flex flex-col rounded-2xl overflow-hidden absolute top-[48px] left-3 z-20 max-h-[544px]"
  style={{
    background:           'rgba(6,10,22,0.68)',
    backdropFilter:       'blur(22px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.6)',
    border:               '1px solid rgba(255,255,255,0.11)',
    boxShadow:            '0 8px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)',
    // Override design tokens so existing classes render light-on-dark
    '--text-primary':   'rgba(255,255,255,0.90)',
    '--text-secondary': 'rgba(255,255,255,0.62)',
    '--text-tertiary':  'rgba(255,255,255,0.38)',
    '--border-subtle':  'rgba(255,255,255,0.08)',
    '--border-default': 'rgba(255,255,255,0.11)',
    '--surface-sunken': 'rgba(255,255,255,0.06)',
    '--surface':        'rgba(255,255,255,0.03)',
  } as React.CSSProperties}
>
```

The sidebar has three display modes driven by `searchQuery` and `selectedNodeId`:

| Mode | Trigger | Content |
|---|---|---|
| **Directory** | no query, no selection | Collapsible group list (§6.1) |
| **Search results** | `searchQuery` set | Filtered node list |
| **Node detail** | `selectedNodeId` set | Full detail panel (§6.2) |

### 6.1 Directory mode

Groups (collapsed by default, toggle via `openGroups: Set<string>`):

| Group label | Type | Node IDs |
|---|---|---|
| Business Entities | `entity` | ent_client, ent_project, ent_vendor, ent_contract, ent_task, ent_staff |
| Attributes | `attribute` | attr_loc, attr_tz, attr_phone, attr_email, attr_rate, attr_terms, attr_status, attr_due, attr_priority, attr_start, attr_end, attr_tax_id, attr_license, attr_trade, attr_comms |
| Triggers & Inputs | `input` | in0–in5 |
| Integrations | `integration` | ig0–ig2 |
| Neural (AI) | `ai` | ai0–ai2 |
| Memory | `memory` | mem |
| Derived Signals | `signal` | sg0–sg2 |
| Rule Engine | `rule` | ru0–ru2 |
| Outputs | `output` | ou0–ou1 |

Each group header button shows the type's dot colour, group label, a count, an optional
"N live" badge when `activeNodeIds` overlap, and a `RiArrowRightSLine` that rotates 90°
when open.

### 6.2 Node detail mode

Shows: type badge, label, `ACTIVE` pill (if node is currently active), description text,
data source (monospaced), "How it connects" prose, "Receives from" chip list, "Sends to"
chip list. Each chip is clickable to navigate to that node's detail.

---

## 7. Node colour system

```ts
const TYPE_COLOR: Record<NodeType, { text: string; bg: string; border: string }> = {
  input:       { text: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
  ai:          { text: 'text-teal-400',    bg: 'bg-teal-500/10',    border: 'border-teal-500/20'    },
  rule:        { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
  memory:      { text: 'text-accent',      bg: 'bg-accent/10',      border: 'border-accent/20'      },
  output:      { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  integration: { text: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20'    },
  signal:      { text: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/20'    },
  entity:      { text: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20'  },
  attribute:   { text: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20'   },
}

// Canvas RGB palette (matches Tailwind colours above)
const RGB: Record<NodeType, [number,number,number]> = {
  input:       [ 59, 130, 246],
  ai:          [ 20, 184, 166],
  rule:        [245, 158,  11],
  memory:      [139,  92, 246],
  output:      [ 16, 185, 129],
  integration: [  6, 182, 212],
  signal:      [236,  72, 153],
  entity:      [249, 115,  22],
  attribute:   [148, 163, 184],
}
```

---

## 8. NeuralNetViz — Canvas renderer

File: `src/components/ui/NeuralNetViz.tsx`

### 8.1 Component props

```ts
interface Props {
  className?:      string
  activeNodeIds?:  string[]
  nodeHeat?:       Record<string, number>
  searchQuery?:    string
  selectedNodeId?: string | null
  onNodeClick?:    (id: string | null) => void
  onNodeHover?:    (id: string | null) => void
}
```

All props are consumed via refs inside a single `useEffect([])` — the effect never
re-runs, state flows in via refs updated on every render.

### 8.2 Node topology (3D positions)

Each node has a base 3D position `(bx, by, bz)` in a normalised coordinate space
(unit ≈ `min(W,H) * 0.195`). Positions are **not** pixel values — they are multiplied
by `unit` after perspective projection.

```ts
interface NetNode {
  id: string; label: string; type: NodeType
  bx: number; by: number; bz: number; phase: number
}
```

Full node list (44 nodes):

```ts
const NODES: NetNode[] = [
  // Primary pipeline
  { id: 'in0', label: 'Invoice',   type: 'input',  bx: -1.80, by: -0.65, bz:  0.20, phase: 0.0 },
  { id: 'in1', label: 'Email',     type: 'input',  bx: -1.80, by:  0.00, bz: -0.10, phase: 1.0 },
  { id: 'in2', label: 'Schedule',  type: 'input',  bx: -1.80, by:  0.65, bz:  0.30, phase: 2.0 },
  { id: 'ai0', label: 'Classify',  type: 'ai',     bx: -0.60, by: -0.75, bz:  0.40, phase: 0.5 },
  { id: 'ai1', label: 'Extract',   type: 'ai',     bx: -0.60, by:  0.05, bz: -0.30, phase: 1.5 },
  { id: 'ai2', label: 'Intent',    type: 'ai',     bx: -0.60, by:  0.80, bz:  0.20, phase: 2.5 },
  { id: 'ru0', label: 'Approve?',  type: 'rule',   bx:  0.55, by: -0.45, bz: -0.20, phase: 1.0 },
  { id: 'ru1', label: 'Amount',    type: 'rule',   bx:  0.55, by:  0.30, bz:  0.45, phase: 2.0 },
  { id: 'ru2', label: 'Route',     type: 'rule',   bx:  0.55, by:  0.95, bz: -0.10, phase: 0.0 },
  { id: 'mem', label: 'Memory',    type: 'memory', bx: -0.10, by: -1.30, bz:  0.60, phase: 3.0 },
  { id: 'ou0', label: 'Execute',   type: 'output', bx:  1.70, by: -0.25, bz:  0.10, phase: 0.3 },
  { id: 'ou1', label: 'Alert',     type: 'output', bx:  1.70, by:  0.55, bz: -0.10, phase: 1.3 },
  // Extended inputs
  { id: 'in3', label: 'Documents', type: 'input',  bx: -2.10, by: -0.65, bz: -0.30, phase: 3.0 },
  { id: 'in4', label: 'Contacts',  type: 'input',  bx: -2.10, by:  0.20, bz:  0.30, phase: 1.8 },
  { id: 'in5', label: 'Employees', type: 'input',  bx: -2.10, by:  0.90, bz: -0.15, phase: 0.8 },
  // Integrations
  { id: 'ig0', label: 'Gmail',      type: 'integration', bx: -2.75, by: -0.85, bz:  0.40, phase: 2.2 },
  { id: 'ig1', label: 'Slack',      type: 'integration', bx: -2.75, by:  0.00, bz: -0.45, phase: 0.9 },
  { id: 'ig2', label: 'Accounting', type: 'integration', bx: -2.75, by:  0.85, bz:  0.30, phase: 3.1 },
  // Derived signals
  { id: 'sg0', label: 'Payment',    type: 'signal', bx: -0.15, by:  1.65, bz:  0.30, phase: 0.6 },
  { id: 'sg1', label: 'Profile',    type: 'signal', bx:  0.45, by:  1.85, bz: -0.20, phase: 1.8 },
  { id: 'sg2', label: 'Trust',      type: 'signal', bx:  1.05, by:  1.55, bz:  0.15, phase: 2.6 },
  // Business entities
  { id: 'ent_client',   label: 'Client',    type: 'entity', bx:  0.30, by: -1.80, bz: -0.15, phase: 1.2 },
  { id: 'ent_project',  label: 'Project',   type: 'entity', bx:  1.40, by: -1.65, bz:  0.30, phase: 2.4 },
  { id: 'ent_vendor',   label: 'Vendor',    type: 'entity', bx: -0.80, by: -1.90, bz:  0.45, phase: 0.7 },
  { id: 'ent_contract', label: 'Contract',  type: 'entity', bx: -1.65, by: -1.70, bz: -0.20, phase: 3.1 },
  { id: 'ent_task',     label: 'Task',      type: 'entity', bx:  2.10, by: -1.65, bz: -0.10, phase: 1.8 },
  { id: 'ent_staff',    label: 'Staff Mbr', type: 'entity', bx:  0.85, by: -2.10, bz:  0.35, phase: 2.9 },
  // Attributes (15 nodes)
  { id: 'attr_loc',      label: 'Location',   type: 'attribute', bx: -0.50, by: -2.40, bz:  0.20, phase: 0.4 },
  { id: 'attr_tz',       label: 'Timezone',   type: 'attribute', bx:  0.65, by: -2.50, bz: -0.10, phase: 1.6 },
  { id: 'attr_rate',     label: 'Rate',       type: 'attribute', bx: -1.35, by: -2.30, bz:  0.50, phase: 2.8 },
  { id: 'attr_status',   label: 'Status',     type: 'attribute', bx:  1.55, by: -2.20, bz:  0.15, phase: 0.3 },
  { id: 'attr_due',      label: 'Due Date',   type: 'attribute', bx:  0.25, by: -2.70, bz: -0.30, phase: 3.5 },
  { id: 'attr_phone',    label: 'Phone',      type: 'attribute', bx: -2.20, by: -2.40, bz:  0.15, phase: 1.1 },
  { id: 'attr_email',    label: 'Email',      type: 'attribute', bx:  2.30, by: -2.30, bz: -0.20, phase: 2.3 },
  { id: 'attr_priority', label: 'Priority',   type: 'attribute', bx:  1.00, by: -2.60, bz:  0.40, phase: 0.9 },
  { id: 'attr_start',    label: 'Start Date', type: 'attribute', bx: -0.80, by: -2.80, bz:  0.25, phase: 3.2 },
  { id: 'attr_end',      label: 'End Date',   type: 'attribute', bx:  1.80, by: -2.60, bz:  0.10, phase: 1.7 },
  { id: 'attr_terms',    label: 'Pay Terms',  type: 'attribute', bx: -1.80, by: -2.50, bz: -0.30, phase: 0.5 },
  { id: 'attr_tax_id',   label: 'Tax ID',     type: 'attribute', bx:  2.50, by: -2.10, bz:  0.30, phase: 2.7 },
  { id: 'attr_license',  label: 'License',    type: 'attribute', bx: -2.60, by: -2.20, bz:  0.40, phase: 1.4 },
  { id: 'attr_trade',    label: 'Trade',      type: 'attribute', bx: -0.10, by: -3.10, bz: -0.20, phase: 3.0 },
  { id: 'attr_comms',    label: 'Comms',      type: 'attribute', bx:  1.30, by: -3.00, bz:  0.35, phase: 0.2 },
]
```

### 8.3 Edge list (directed)

```ts
const EDGES: NetEdge[] = [
  // Primary pipeline
  { from:'in0', to:'ai0' }, { from:'in0', to:'ai1' },
  { from:'in1', to:'ai1' }, { from:'in1', to:'ai2' },
  { from:'in2', to:'ai0' }, { from:'in2', to:'ai2' },
  { from:'ai0', to:'ru0' }, { from:'ai0', to:'ru1' },
  { from:'ai1', to:'ru0' }, { from:'ai1', to:'ru2' },
  { from:'ai2', to:'ru1' }, { from:'ai2', to:'ru2' },
  { from:'mem', to:'ai0' }, { from:'mem', to:'ai1' }, { from:'mem', to:'ru0' },
  { from:'ru0', to:'ou0' }, { from:'ru1', to:'ou0' },
  { from:'ru2', to:'ou1' }, { from:'ru1', to:'ou1' },
  // Extended inputs
  { from:'in3', to:'ai1' }, { from:'in3', to:'ai2' },
  { from:'in4', to:'ai0' }, { from:'in4', to:'ai2' },
  { from:'in5', to:'ru0' }, { from:'in5', to:'ru2' },
  // Integrations → AI
  { from:'ig0', to:'ai1' }, { from:'ig0', to:'ai2' },
  { from:'ig1', to:'ai0' }, { from:'ig1', to:'ai2' },
  { from:'ig2', to:'ai1' }, { from:'ig2', to:'mem' },
  // Memory → derived signals
  { from:'mem', to:'sg0' }, { from:'mem', to:'sg1' }, { from:'mem', to:'sg2' },
  // Signals → rules
  { from:'sg0', to:'ru1' }, { from:'sg1', to:'ru2' }, { from:'sg2', to:'ru0' },
  // Entity → pipeline
  { from:'ent_client',   to:'in0' }, { from:'ent_client',   to:'in4' }, { from:'ent_client',   to:'mem'          },
  { from:'ent_vendor',   to:'in0' }, { from:'ent_vendor',   to:'in3' },
  { from:'ent_contract', to:'in3' }, { from:'ent_contract', to:'ru2' },
  { from:'ent_project',  to:'in2' },
  { from:'ent_task',     to:'ru0' },
  { from:'ent_staff',    to:'in5' },
  // Entity → entity
  { from:'ent_client',  to:'ent_project'  }, { from:'ent_client',  to:'ent_contract' },
  { from:'ent_vendor',  to:'ent_contract' },
  { from:'ent_project', to:'ent_task'     },
  { from:'ent_staff',   to:'ent_project'  }, { from:'ent_staff',   to:'ent_task'     },
  // Attribute → entity
  { from:'attr_loc',      to:'ent_client' }, { from:'attr_loc',      to:'ent_vendor'   },
  { from:'attr_tz',       to:'ent_client' }, { from:'attr_tz',       to:'ent_vendor'   }, { from:'attr_tz',      to:'ent_staff'    },
  { from:'attr_rate',     to:'ent_vendor' }, { from:'attr_rate',     to:'ent_staff'    },
  { from:'attr_status',   to:'ent_project'}, { from:'attr_status',   to:'ent_task'     },
  { from:'attr_due',      to:'ent_project'}, { from:'attr_due',      to:'ent_task'     },
  { from:'attr_phone',    to:'ent_client' }, { from:'attr_phone',    to:'ent_vendor'   }, { from:'attr_phone',   to:'ent_staff'    },
  { from:'attr_email',    to:'ent_client' }, { from:'attr_email',    to:'ent_vendor'   }, { from:'attr_email',   to:'ent_staff'    },
  { from:'attr_priority', to:'ent_task'   }, { from:'attr_priority', to:'ent_project'  },
  { from:'attr_start',    to:'ent_project'}, { from:'attr_start',    to:'ent_contract' }, { from:'attr_start',   to:'ent_task'     },
  { from:'attr_end',      to:'ent_project'}, { from:'attr_end',      to:'ent_contract' },
  { from:'attr_terms',    to:'ent_client' }, { from:'attr_terms',    to:'ent_contract' },
  { from:'attr_tax_id',   to:'ent_client' }, { from:'attr_tax_id',   to:'ent_vendor'   },
  { from:'attr_license',  to:'ent_vendor' },
  { from:'attr_trade',    to:'ent_vendor' }, { from:'attr_trade',    to:'ent_staff'    },
  { from:'attr_comms',    to:'ent_client' }, { from:'attr_comms',    to:'ent_vendor'   },
]
```

### 8.4 3D projection

```
// Camera at depth camD=5 along Z axis
persp  = (camD × unit) / (camD + z)
sx     = cx + x × persp + panX
sy     = cy + y × persp + panY
r      = 7.5 × dpr × depthFactor   // depthFactor = max(0.65, 1 + z × 0.13)
```

Rotation is Y-axis (horizontal drag) + X-axis (vertical drag), clamped to ±0.55 radians on X.

Auto-rotate: `rotY += dt × 0.07` when idle for 2.5s after last drag release.

Vertical node float: `y += sin(t × 0.55 + phase) × 0.055`

### 8.5 Signals (travelling particles)

```ts
interface Signal {
  id: number; fromId: string; toId: string
  progress: number   // 0→1
  speed: number      // 2.5–3.5 (units/sec)
  rgb: [number,number,number]
  bounced?: boolean
}
```

Spawned periodically (every 0.9s when fewer than 18 signals exist) from a random edge.
Also spawned on `activeNodeIds` change.

**Elastic wave rendering**: edges carrying active signals are drawn as a 32-sample polyline
displaced perpendicularly. Displacement formula:

```
amp(u, sigs) = Σ exp(-(u-p)²/0.045) × (sin(u×18 + t×9) + sin(u×7.5+t×4.5)×0.55) × 24dpr
```

The signal particle rides this wave at its current `progress` position.

### 8.6 Rubber-band bounce physics

Each node stores `{ amp, vel }`. On impact (`progress >= 0.92`):
- target node: `vel += 5.0`
- source node: `vel += 0.4` (recoil)

On selection change:
- selected node: `vel += 2.8`
- neighbors: `vel += 0.9`

Per-frame integration (spring k=80, damping exp(-7×dt)):

```
vel += -k × amp × dt
vel *= exp(-7 × dt)
amp += vel × dt
```

Bounce affects node radius (`r *= 1 + amp×0.45`) and displaces position outward from
screen center (`sx += (sx-cx) × amp × 0.12`).

### 8.7 Depth-of-field

Focal plane drifts toward hovered node's depth, else slow sine:
`focalZ += (target - focalZ) × 0.055`

`dof = |depth - focalZ|`
`blurPx = min(4.0, dof × 3.0) × dpr`  → applied as `ctx.filter = blur(Xpx)`
`bokeh = 1 + dof × 0.75`               → enlarges halo glow
`dofAlpha = max(0.28, 1 - dof × 0.38)`

### 8.8 Selection dimming

When a node is selected, non-neighbour nodes/edges use `MUTED_RGB = [80,84,96]` at
50% opacity instead of their type colour. Neighbours retain full colour.

### 8.9 Node draw order

1. Sort all projected nodes by depth (back→front, painter's algorithm)
2. For each node draw:
   - **Outer glow halo** — radial gradient, radius `r × (3+bokeh)`, blurred
   - **Core sphere** — radial gradient with specular highlight at `(-0.3r, -0.35r)`
   - **Selection ring** — solid + pulsing outer ring at `r + 5dpr` / `r + 8dpr`
   - **Hover ring** — white/45% at `r + 3.5dpr`
   - **Label** — Inter 500, `9 × depthFactor` pt, below node at `r + fs×1.35`

### 8.10 Tooltip (hover, no selection)

Rendered directly on the canvas. Box: `230dpr` wide, dark `rgba(6,8,18,0.90)` fill,
type-coloured border. Contains: type chip, node label, description text (word-wrapped to
`210dpr`). Positioned to the right of the node, flipped left if it would overflow.

### 8.11 Interaction summary

| Interaction | Behaviour |
|---|---|
| Click on node | `onNodeClick(id)` → sets `selectedNodeId` |
| Click on canvas (miss) | `onNodeClick(null)` → deselects |
| Drag | Rotate Y + X |
| Shift+drag | Pan viewport |
| Scroll wheel | Zoom toward cursor (0.35× – 3.0×) |
| Release | Rotation momentum decays with `exp(-3.5 × dt)` |
| 2.5s idle | Auto-rotate resumes |
| Hover | Tooltip appears; sidebar cursor changes to pointer |

---

## 9. Stat cards row

```tsx
<div className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
  {/* Job metrics — 4 cards */}
  { label: 'Active jobs',     value: metrics.activeJobs }
  { label: 'Completed today', value: metrics.completedToday }
  { label: 'Success rate',    value: `${metrics.successRate}%` }
  { label: 'Active flows',    value: `${active}/${total}` }
  {/* Data source metrics — 3 clickable cards that highlight a node */}
  { label: 'Contacts',     value: metrics.totalContacts,      node: 'in4' }
  { label: 'Doc requests', value: metrics.pendingDocRequests, node: 'in3' }
  { label: 'Team members', value: metrics.totalTeamMembers,   node: 'in5' }
</div>
```

Card style: `bg-surface rounded-xl border border-border-default px-4 py-3.5`
Value style: `text-[22px] font-bold text-text-primary` with `letterSpacing: '-0.03em'`
Clickable data-source cards show a `LIVE` badge when the node is in `activeNodeIds`.

---

## 10. Connected integrations & Derived signals

Two equal-width cards in `lg:grid-cols-2`.

**Connected integrations** — three rows:
- Gmail (`ig0`) · Slack (`ig1`) · Accounting (`ig2`)
- Each shows a status dot (green pulse = connected), `INTEGRATION` chip, name, sub-text, connected/not text
- Clicking a row sets `selectedNodeId` to the integration's node ID

**Derived signals** — three rows:
- sg0: Payment reliability · sg1: Client complexity · sg2: Trust score
- Each shows a `SIGNAL` chip, metric name, and a tone badge (`bg-emerald-50`/`bg-amber-50`/`bg-red-50`)
- Clicking sets `selectedNodeId` to the signal node

---

## 11. Seed Memory section

Inline card at the bottom. Header with `RiDatabase2Line` + `Add to memory` button (`btn-primary`).

**Filter tabs**: All · Workflow Rules · Client Prefs · Business Context · Team Knowledge

**Entry card** (`bg-white border border-border-subtle rounded-xl p-4`):
- Category badge (coloured per `SEED_CATEGORY_CONFIG`)
- Status badge (`validated` / `active` / `learning`) — rounded-full
- Content paragraph
- Confidence bar (teal `bg-accent`) + percentage + `Added YYYY-MM-DD`
- Delete button (red on hover, visible only on card hover via `group-hover:opacity-100`)

**Inline add form** (shown when `showAddForm`):
- `bg-teal-50/50` banner below filter tabs
- `<textarea>` 3 rows + category `<select>` + Save/Cancel buttons

---

## 12. `useIntelligenceData` hook

Returns:

```ts
interface IntelligenceData {
  metrics: {
    activeJobs:          number
    completedToday:      number
    successRate:         number
    failedToday:         number
    activeFlows:         number
    totalFlows:          number
    totalContacts:       number
    pendingDocRequests:  number
    totalTeamMembers:    number
    emailsToday:         number
    totalInvoices:       number
    overdueInvoices:     number
    onTimeRate:          number
  }
  activeNodeIds: string[]    // node IDs currently "firing"
  nodeHeat:      Record<string, number>  // 0–1 heat per node (for glow boost)
  isLive:        boolean     // true = real DB data; false = demo
}
```

In demo mode, `activeNodeIds` is a short rotating list updated every few seconds to
animate the canvas; `metrics` uses hardcoded demo values.

---

## 13. Scrollbar style (custom)

Applied to `.intel-sidebar-scroll`:

```css
.intel-sidebar-scroll::-webkit-scrollbar { width: 4px; }
.intel-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
.intel-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(20,184,166,0.45); border-radius: 9999px; }
.intel-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(20,184,166,0.75); }
```

Inject via `<style>` tag at the top of the canvas section.

---

## 14. File structure

```
src/
├── app/(app)/intelligence/
│   ├── page.tsx           ← this page
│   └── loading.tsx
├── components/ui/
│   └── NeuralNetViz.tsx   ← canvas renderer
└── lib/intelligence/
    ├── useIntelligenceData.ts
    └── suggestions.ts     ← used by IntelligenceChatWidget, not this page
```
