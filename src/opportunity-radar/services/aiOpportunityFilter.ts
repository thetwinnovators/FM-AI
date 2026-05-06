import { generateResponse } from '../../lib/llm/ollama.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import type { OpportunityCluster, PainSignal } from '../types.js'

export interface AIValidationResult {
  clusterId: string
  keep: boolean
  reason?: string
}

// Validate a batch of clusters via the local LLM.
// Returns one decision per cluster. Defaults to KEEP on any failure so we
// never silently discard data when the model is unavailable.
export async function aiValidateClusters(
  clusters: OpportunityCluster[],
  signals: PainSignal[],
): Promise<AIValidationResult[]> {
  if (!OLLAMA_CONFIG.enabled || clusters.length === 0) {
    return clusters.map((c) => ({ clusterId: c.id, keep: true }))
  }

  // Build a compact one-liner per cluster: ID, name, and up to 2 raw signal quotes
  const lines = clusters.map((c) => {
    const samples = signals
      .filter((s) => c.signalIds.includes(s.id))
      .slice(0, 2)
      .map((s) => `"${s.painText.slice(0, 100)}"`)
      .join(' | ')
    return `${c.id}: "${c.clusterName}"${samples ? ` — ${samples}` : ''}`
  })

  const prompt =
    `You are validating pain signal clusters for a solo developer opportunity tool.\n\n` +
    `For each cluster decide: can a SOFTWARE PRODUCT (app, web tool, browser extension, SaaS) ` +
    `built by a solo developer or small team MEANINGFULLY solve this problem?\n\n` +
    `KEEP — software can genuinely help:\n` +
    `  • Workflow friction, productivity, task/project management\n` +
    `  • Information overload, discovery, search, knowledge management\n` +
    `  • Cost tracking, pricing transparency, financial tools for individuals or small biz\n` +
    `  • Scheduling, communication overhead, async collaboration\n` +
    `  • Learning, skill-building, habit tracking\n` +
    `  • Developer tooling, automation, API integration\n\n` +
    `SKIP — software CANNOT solve this:\n` +
    `  • Physical illness, chronic pain, medical conditions or treatments\n` +
    `  • Grief, bereavement, heartbreak, emotional trauma from loss\n` +
    `  • Problems requiring government action, legal reform, or regulation\n` +
    `  • Problems requiring physical products, doctors, lawyers, or licensed therapists\n` +
    `  • Pure social isolation, loneliness from life circumstances\n` +
    `  • Addiction recovery, mental health crises\n\n` +
    `Reply with EXACTLY one line per cluster in this format — nothing else:\n` +
    `  cluster_id: KEEP\n` +
    `  cluster_id: SKIP brief reason\n\n` +
    `CLUSTERS:\n${lines.join('\n')}\n\n` +
    `DECISIONS:\n`

  const response = await generateResponse(prompt, { temperature: 0.05 })

  if (!response) {
    // Ollama unavailable — pass everything through
    return clusters.map((c) => ({ clusterId: c.id, keep: true }))
  }

  // Parse lines: "cluster_xyz: KEEP" or "cluster_xyz: SKIP reason text"
  const resultMap = new Map<string, AIValidationResult>()
  for (const line of response.split('\n')) {
    const m = line.trim().match(/^(cluster_[a-z0-9_]+)\s*:\s*(KEEP|SKIP)(.*)?$/i)
    if (!m) continue
    const [, id, verdict, rest] = m
    resultMap.set(id, {
      clusterId: id,
      keep:      verdict.toUpperCase() === 'KEEP',
      reason:    rest?.trim() || undefined,
    })
  }

  // Default any unmentioned cluster to KEEP (model may have truncated output)
  return clusters.map((c) => resultMap.get(c.id) ?? { clusterId: c.id, keep: true })
}
