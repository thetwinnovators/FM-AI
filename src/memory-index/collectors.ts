// ─── Memory Index — Collectors ───────────────────────────────────────────────
//
// One collector function per storage domain. Each is pure (no side-effects),
// reads only from localStorage (or static config), and returns MemoryNode[].
// All collectors are safe to call when the key is absent; they return [].

import type { MemoryNode } from './types.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function readMainStore(): Record<string, unknown> {
  return readLS<Record<string, unknown>>('flowmap.v1', {})
}

function isoNow(): string {
  return new Date().toISOString()
}

function truncate(s: string | undefined, max = 80): string {
  if (!s) return ''
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

// ─── 1. Project node (static — from known app config) ────────────────────────

export function collectProject(): MemoryNode[] {
  return [
    {
      id:       'project:flowmap',
      type:     'project',
      label:    'FlowMap — topic intelligence platform',
      summary:  'Local-first React/Vite research tool. Single-user. Stores all data in ' +
                'localStorage (flowmap.v1 envelope) plus optional ~/.flowmap/state.json sync. ' +
                'Ollama integration for LLM summaries and RAG chat. Opportunity Radar for pain-signal discovery.',
      tags:     ['react', 'vite', 'typescript', 'tailwindcss', 'ollama', 'local-first'],
      createdAt: isoNow(),
      source:   'package.json (static)',
      metadata: {
        version:    '0.0.0',
        type:       'module',
        framework:  'React 19 + Vite 8',
        llm:        'Ollama (local)',
        sync:       '~/.flowmap/state.json via Vite dev-server plugin',
        embeddings: 'IndexedDB:flowmap-embeddings',
        storageModel: 'localStorage envelope (flowmap.v1) + domain namespaces (fm_radar_*, fm_signals_*, fm_mcp_*)',
      },
    },
  ]
}

// ─── 2. Preferences (config overrides stored in localStorage) ────────────────

export function collectPreferences(): MemoryNode[] {
  const nodes: MemoryNode[] = []

  const theme       = localStorage.getItem('flowmap.theme') ?? 'dark'
  const ollamaOn    = localStorage.getItem('flowmap.ollama.enabled')
  const ollamaModel = localStorage.getItem('flowmap.ollama.model') ?? 'phi4-mini'
  const voiceOn     = localStorage.getItem('flowmap.voice.enabled')
  const voiceId     = localStorage.getItem('flowmap.voice.voiceId')
  const searxngOn   = localStorage.getItem('flowmap.searxng.enabled')

  nodes.push({
    id:      'pref:theme',
    type:    'preference',
    label:   `UI theme: ${theme}`,
    source:  'flowmap.theme',
    metadata: { theme },
  })

  nodes.push({
    id:      'pref:ollama',
    type:    'preference',
    label:   `Ollama: ${ollamaOn === 'false' ? 'disabled' : 'enabled'} — model: ${ollamaModel}`,
    source:  'flowmap.ollama.*',
    metadata: {
      enabled: ollamaOn !== 'false',
      model:   ollamaModel,
      baseUrl: '/api/ollama',
    },
  })

  if (voiceOn !== null || voiceId) {
    nodes.push({
      id:     'pref:voice',
      type:   'preference',
      label:  `Voice: ${voiceOn === 'true' ? 'enabled' : 'disabled'}${voiceId ? ` — ${voiceId}` : ''}`,
      source: 'flowmap.voice.*',
      metadata: {
        enabled: voiceOn === 'true',
        voiceId: voiceId ?? null,
        modelId: localStorage.getItem('flowmap.voice.modelId') ?? null,
      },
    })
  }

  if (searxngOn !== null) {
    nodes.push({
      id:     'pref:searxng',
      type:   'preference',
      label:  `SearXNG: ${searxngOn === 'false' ? 'disabled' : 'enabled'}`,
      source: 'flowmap.searxng.enabled',
      metadata: { enabled: searxngOn !== 'false' },
    })
  }

  const topicsView  = localStorage.getItem('flowmap.topics.viewMode')
  const topicView   = localStorage.getItem('flowmap.topic.viewMode')
  const signalsView = localStorage.getItem('flowmap.signals.viewMode')
  if (topicsView || topicView || signalsView) {
    nodes.push({
      id:     'pref:viewModes',
      type:   'preference',
      label:  `View modes — topics:${topicsView ?? 'grid'} topic:${topicView ?? 'grid'} signals:${signalsView ?? 'grid'}`,
      source: 'flowmap.*.viewMode',
      metadata: { topicsView, topicView, signalsView },
    })
  }

  return nodes
}

// ─── 3. Conversations ────────────────────────────────────────────────────────

export function collectConversations(): MemoryNode[] {
  const store = readMainStore()
  const convs  = store.conversations as Record<string, Record<string, unknown>> | undefined
  const msgs   = store.chatMessages  as Record<string, unknown[]> | undefined
  if (!convs) return []

  return Object.values(convs).map((c) => ({
    id:        `conv:${c.id as string}`,
    type:      'conversation' as const,
    label:     truncate((c.title as string) || 'Untitled conversation'),
    summary:   c.title as string | undefined,
    createdAt: c.createdAt as string | undefined,
    updatedAt: c.updatedAt as string | undefined,
    source:    'flowmap.v1/conversations',
    metadata:  {
      messageCount: (msgs?.[c.id as string] ?? []).length,
      pinned:       Boolean(c.pinned),
    },
  }))
}

// ─── 4. Decisions (active memoryEntries) ─────────────────────────────────────

export function collectDecisions(): MemoryNode[] {
  const store   = readMainStore()
  const entries = store.memoryEntries as Record<string, Record<string, unknown>> | undefined
  if (!entries) return []

  return Object.values(entries)
    .filter((e) => (e.status as string | undefined) !== 'dismissed')
    .map((e) => ({
      id:        `decision:${e.id as string}`,
      type:      'decision' as const,
      label:     truncate(e.content as string),
      summary:   e.content as string | undefined,
      tags:      [e.category as string].filter(Boolean),
      createdAt: e.addedAt as string | undefined,
      source:    'flowmap.v1/memoryEntries',
      metadata:  {
        category:        e.category,
        status:          e.status ?? 'active',
        confidence:      e.confidence,
        isIdentityPinned: Boolean(e.isIdentityPinned),
        memorySource:    e.source,
      },
    }))
}

// ─── 5. Source items (documents, manual content, saves) ──────────────────────

export function collectSourceItems(): MemoryNode[] {
  const store  = readMainStore()
  const nodes: MemoryNode[] = []

  // Documents
  const docs = store.documents as Record<string, Record<string, unknown>> | undefined
  if (docs) {
    for (const d of Object.values(docs)) {
      nodes.push({
        id:        `doc:${d.id as string}`,
        type:      'source_item',
        label:     truncate((d.title as string) || (d.url as string) || d.id as string),
        summary:   (d.summary as string | undefined) || (d.excerpt as string | undefined),
        tags:      (d.tags as string[] | undefined) ?? [],
        createdAt: d.createdAt as string | undefined,
        updatedAt: d.updatedAt as string | undefined,
        source:    'flowmap.v1/documents',
        metadata:  {
          wordCount:  d.wordCount,
          sourceType: d.sourceType,
          folderId:   d.folderId,
          topicIds:   d.topics,
        },
      })
    }
  }

  // Manual content (user-added URLs)
  const manual = store.manualContent as Record<string, Record<string, unknown>> | undefined
  if (manual) {
    for (const entry of Object.values(manual)) {
      const it = entry.item as Record<string, unknown> | undefined
      if (!it) continue
      nodes.push({
        id:        `manual:${it.id as string}`,
        type:      'source_item',
        label:     truncate((it.title as string) || (it.url as string) || it.id as string),
        summary:   (it.summary as string | undefined) || (it.excerpt as string | undefined),
        createdAt: (entry.addedAt as string | undefined) || (it.publishedAt as string | undefined),
        source:    'flowmap.v1/manualContent',
        metadata:  {
          url:   it.url,
          type:  it.type,
        },
      })
    }
  }

  // Saves (bookmarked items)
  const saves = store.saves as Record<string, Record<string, unknown>> | undefined
  if (saves) {
    for (const [sid, entry] of Object.entries(saves)) {
      const it = entry.item as Record<string, unknown> | undefined
      if (!it?.title && !it?.url) continue
      // deduplicate with manual content
      if (nodes.find((n) => n.id === `manual:${sid}`)) continue
      nodes.push({
        id:        `save:${sid}`,
        type:      'source_item',
        label:     truncate((it.title as string) || (it.url as string) || sid),
        createdAt: entry.savedAt as string | undefined,
        source:    'flowmap.v1/saves',
        metadata:  {
          url:       it.url,
          type:      it.type,
          savedAt:   entry.savedAt,
        },
      })
    }
  }

  return nodes
}

// ─── 6. Workflows (MCP integrations + task plans) ────────────────────────────

export function collectWorkflows(): MemoryNode[] {
  const nodes: MemoryNode[] = []

  // MCP integrations
  const integrations = readLS<Record<string, unknown>[]>('fm_mcp_integrations', [])
  for (const i of integrations) {
    nodes.push({
      id:        `mcp:integration:${i.id as string}`,
      type:      'workflow',
      label:     truncate(`MCP: ${i.name as string} (${i.type as string})`),
      tags:      [i.type as string, i.status as string].filter(Boolean),
      createdAt: i.createdAt as string | undefined,
      updatedAt: i.updatedAt as string | undefined,
      source:    'fm_mcp_integrations',
      metadata:  {
        type:   i.type,
        status: i.status,
      },
    })
  }

  // Agent task plans
  const taskPlans = readLS<Record<string, unknown>>('flowmap.mcp.taskPlans', {})
  for (const plan of Object.values(taskPlans)) {
    const p = plan as Record<string, unknown>
    nodes.push({
      id:        `mcp:taskplan:${p.id as string}`,
      type:      'workflow',
      label:     truncate(`Task plan: ${p.title as string || p.id as string}`),
      summary:   p.description as string | undefined,
      tags:      ['task-plan', p.status as string].filter(Boolean),
      createdAt: p.createdAt as string | undefined,
      updatedAt: p.updatedAt as string | undefined,
      source:    'flowmap.mcp.taskPlans',
      metadata:  {
        status:    p.status,
        stepCount: Array.isArray(p.steps) ? p.steps.length : undefined,
      },
    })
  }

  return nodes
}

// ─── 7. Insights (opportunity clusters, concepts, signals) ───────────────────

export function collectInsights(): MemoryNode[] {
  const nodes: MemoryNode[] = []

  // Opportunity clusters
  const clusters = readLS<Record<string, unknown>[]>('fm_radar_clusters', [])
  for (const c of clusters) {
    // Skip AI-rejected clusters
    if ((c.aiValidated as boolean | undefined) === false) continue
    nodes.push({
      id:        `radar:cluster:${c.id as string}`,
      type:      'insight',
      label:     truncate(`Pattern: ${c.clusterName as string}`),
      tags:      [c.painTheme as string, c.status as string].filter(Boolean),
      createdAt: c.createdAt as string | undefined,
      updatedAt: c.updatedAt as string | undefined,
      source:    'fm_radar_clusters',
      metadata:  {
        status:           c.status,
        opportunityScore: c.opportunityScore,
        signalCount:      c.signalCount,
        sourceDiversity:  c.sourceDiversity,
        isBuildable:      c.isBuildable,
        aiValidated:      c.aiValidated,
      },
    })
  }

  // App concepts
  const concepts = readLS<Record<string, unknown>[]>('fm_radar_concepts', [])
  for (const c of concepts) {
    nodes.push({
      id:        `radar:concept:${c.id as string}`,
      type:      'insight',
      label:     truncate(`Concept: ${c.title as string}`),
      summary:   c.tagline as string | undefined,
      tags:      ['concept', c.status as string].filter(Boolean),
      createdAt: c.createdAt as string | undefined,
      updatedAt: c.updatedAt as string | undefined,
      source:    'fm_radar_concepts',
      metadata:  {
        status:          c.status,
        confidenceScore: c.confidenceScore,
        clusterId:       c.clusterId,
        generatedBy:     c.generatedBy,
      },
    })
  }

  // Active signal items
  const signalItems = readLS<Record<string, unknown>[]>('fm_signals_items', [])
  for (const s of signalItems) {
    nodes.push({
      id:        `signal:${s.id as string}`,
      type:      'insight',
      label:     truncate(`Signal: ${s.keyword as string} (${s.sourceType as string})`),
      tags:      [s.category as string, s.direction as string].filter(Boolean),
      createdAt: s.detectedAt as string | undefined,
      source:    'fm_signals_items',
      metadata:  {
        keyword:    s.keyword,
        sourceType: s.sourceType,
        direction:  s.direction,
        category:   s.category,
      },
    })
  }

  return nodes
}

// ─── Aggregate collector ──────────────────────────────────────────────────────

export function collectAll(): MemoryNode[] {
  return [
    ...collectProject(),
    ...collectPreferences(),
    ...collectConversations(),
    ...collectDecisions(),
    ...collectSourceItems(),
    ...collectWorkflows(),
    ...collectInsights(),
  ]
}
