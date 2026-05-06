// ─── Memory Index — Markdown Renderer ────────────────────────────────────────
//
// Pure function: MemoryIndex → string (GitHub-flavoured markdown).
// Runs in the browser, output is posted to the Vite endpoint for disk write.

import type { MemoryIndex, MemoryNode } from './types.js'
import { MEMORY_NODE_TYPES, NODE_TYPE_META } from './types.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      year:  'numeric',
      month: 'short',
      day:   'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

function escape(s: string): string {
  // Escape pipe characters inside table cells
  return s.replace(/\|/g, '\\|')
}

function nodeTable(nodes: MemoryNode[]): string {
  if (nodes.length === 0) return '_none_\n'

  const header = '| ID | Label | Tags | Updated |'
  const sep    = '|---|---|---|---|'
  const rows   = nodes.map((n) => {
    const tags = (n.tags ?? []).filter(Boolean).join(', ') || '—'
    const date = formatDate(n.updatedAt ?? n.createdAt)
    return `| \`${escape(n.id)}\` | ${escape(n.label)} | ${escape(tags)} | ${date} |`
  })
  return [header, sep, ...rows].join('\n') + '\n'
}

// ─── Render ──────────────────────────────────────────────────────────────────

export function renderMarkdown(index: MemoryIndex): string {
  const { stats, nodes, generatedAt, appName, appVersion } = index

  const lines: string[] = []

  // ── Header ──────────────────────────────────────────────────────────────────
  lines.push(`# ${appName} Memory Index`)
  lines.push('')
  lines.push(`> **Auto-generated — do not edit by hand.**  `)
  lines.push(`> Generated: ${new Date(generatedAt).toLocaleString('en-GB')}  `)
  lines.push(`> App version: \`${appVersion}\` · Schema: \`${index.schemaVersion}\` · Total nodes: **${stats.total}**`)
  lines.push('')

  // ── Stats summary ────────────────────────────────────────────────────────────
  lines.push('## Summary')
  lines.push('')
  lines.push('| Type | Icon | Count |')
  lines.push('|---|---|---|')
  for (const t of MEMORY_NODE_TYPES) {
    const meta = NODE_TYPE_META[t]
    lines.push(`| ${meta.label} | ${meta.icon} | ${stats.byType[t] ?? 0} |`)
  }
  lines.push('')

  // ── Per-type sections ────────────────────────────────────────────────────────
  for (const t of MEMORY_NODE_TYPES) {
    const meta      = NODE_TYPE_META[t]
    const typeNodes = nodes.filter((n) => n.type === t)

    lines.push(`## ${meta.icon} ${meta.label}`)
    lines.push('')
    lines.push(`_Storage keys: \`${meta.storageKeys.join('`, `')}\`_`)
    lines.push('')
    lines.push(nodeTable(typeNodes))
  }

  // ── Storage key registry ─────────────────────────────────────────────────────
  lines.push('## Storage Key Registry')
  lines.push('')
  lines.push('All localStorage keys the app reads or writes:')
  lines.push('')
  for (const key of index.stats.storageKeys) {
    lines.push(`- \`${key}\``)
  }
  lines.push('')

  return lines.join('\n')
}
