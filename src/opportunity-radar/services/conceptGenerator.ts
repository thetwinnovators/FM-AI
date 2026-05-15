import type { OpportunityCluster, PainSignal, AppConcept } from '../types.js'
import { generateResponse } from '../../lib/llm/ollama.js'

// ── Section parser ────────────────────────────────────────────────────────────

const SECTION_KEYS = [
  'OPPORTUNITY_SUMMARY',
  'PROBLEM_STATEMENT',
  'TARGET_USER',
  'PROPOSED_SOLUTION',
  'VALUE_PROPOSITION',
  'MVP_SCOPE',
  'RISKS',
  'CLAUDE_CODE_PROMPT',
  'IMPLEMENTATION_PLAN',
] as const

type SectionKey = typeof SECTION_KEYS[number]

function parseSections(raw: string): Partial<Record<SectionKey, string>> {
  const result: Partial<Record<SectionKey, string>> = {}
  const parts = raw.split(/^## /m)
  for (const part of parts) {
    const firstLine = part.split('\n')[0].trim().replace(/\s+/g, '_').toUpperCase()
    const matchedKey = SECTION_KEYS.find((k) => firstLine.startsWith(k))
    if (matchedKey) {
      result[matchedKey] = part.slice(firstLine.length).trim()
    }
  }
  return result
}

// ── Deterministic helpers ─────────────────────────────────────────────────────

function tally<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    const k = key(item)
    counts[k] = (counts[k] ?? 0) + 1
  }
  return counts
}

function top5ByIntensity(signals: PainSignal[]) {
  return [...signals]
    .sort((a, b) => b.intensityScore - a.intensityScore)
    .slice(0, 5)
}

function top8Terms(termFrequency: Record<string, number>) {
  return Object.entries(termFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
}

function topTermsString(termFrequency: Record<string, number>, n = 10): string {
  return Object.entries(termFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([t]) => t)
    .join(', ')
}

// ── Entity + dimension context builders ──────────────────────────────────────

/**
 * Format entity summary into a readable multi-line block for prompts and
 * template text. Returns an empty string when no entity data is available
 * (e.g., clusters scanned before Schema v1).
 */
function buildEntityContext(cluster: OpportunityCluster): string {
  const es = cluster.entitySummary
  if (!es) return ''

  const lines: string[] = []
  if (es.personas?.length)          lines.push(`Personas affected: ${es.personas.join(', ')}`)
  if (es.workflows?.length)         lines.push(`Workflows involved: ${es.workflows.join(', ')}`)
  if (es.workarounds?.length)       lines.push(`Current workarounds: ${es.workarounds.join(', ')}`)
  if (es.technologies?.length)      lines.push(`Technologies in context: ${es.technologies.join(', ')}`)
  if (es.existingSolutions?.length) lines.push(`Existing tools (with gaps): ${es.existingSolutions.join(', ')}`)
  if (es.industries?.length)        lines.push(`Industries / sectors: ${es.industries.join(', ')}`)

  return lines.join('\n')
}

/**
 * Translate high dimension scores into concrete strategic hints for the LLM
 * and template. Returns empty string when no noteworthy dimensions exist.
 */
function buildDimensionHints(cluster: OpportunityCluster): string {
  const dim = cluster.dimensionScores
  if (!dim) return ''

  const hints: string[] = []

  if (dim.willingnessToPay >= 60) hints.push(
    '• High willingness-to-pay signal — consider freemium or subscription pricing',
  )
  if (dim.whyNow >= 60) hints.push(
    '• Strong Why Now — timing is right; the market is actively searching for this',
  )
  if (dim.poorSolutionFit >= 60) hints.push(
    '• Existing tools are inadequate — emphasise simplicity and focus over incumbents',
  )
  if (dim.urgency >= 60) hints.push(
    '• High urgency — minimise onboarding friction; zero-config start is critical',
  )
  if (dim.defensibility >= 60) hints.push(
    '• Defensibility potential — consider data accumulation or habit-forming features',
  )
  if (dim.marketBreadth >= 60) hints.push(
    '• Broad market — multiple personas and industries affected; keep scope general-purpose',
  )

  return hints.length ? `Strategic signals from scoring:\n${hints.join('\n')}` : ''
}

// ── Claude Code prompt ────────────────────────────────────────────────────────

function buildClaudeCodePrompt(cluster: OpportunityCluster, topTerms: string): string {
  const es  = cluster.entitySummary
  const dim = cluster.dimensionScores

  const personasSection = es?.personas?.length
    ? `\n### Target Users\n${es.personas.map((p) => `- ${p}`).join('\n')}\n`
    : ''

  const existingSection = es?.existingSolutions?.length
    ? `\n### Existing Solutions to Differentiate From\n${es.existingSolutions.map((s) => `- ${s} (users are frustrated with it)`).join('\n')}\n`
    : ''

  const workaroundSection = es?.workarounds?.length
    ? `\n### Current Workarounds to Replace\n${es.workarounds.map((w) => `- ${w}`).join('\n')}\n`
    : ''

  const techSection = es?.technologies?.length
    ? `\n### Technologies in the User's Stack\n${es.technologies.map((t) => `- ${t}`).join('\n')}\n`
    : ''

  const whyNowHint   = (dim?.whyNow   ?? 0) >= 60 ? '\n> ⚡ **Timing:** Strong Why Now signal — users are actively looking for this right now.\n' : ''
  const urgencyHint  = (dim?.urgency  ?? 0) >= 60 ? '\n> ⚠️ **UX Priority:** High urgency — zero-config start, minimal onboarding.\n' : ''
  const monetiseHint = (dim?.willingnessToPay ?? 0) >= 60 ? '\n> 💰 **Monetisation:** Users show willingness to pay — consider a free tier + one-time purchase.\n' : ''

  const diffLine = es?.existingSolutions?.length
    ? `- Be simpler and more focused than ${es.existingSolutions[0]}`
    : '- Outperform the status quo workaround in speed and ease of use'

  return `## Claude Code Build Prompt

Build a single-page web app that addresses the "${cluster.clusterName}" pain pattern.
${whyNowHint}${urgencyHint}${monetiseHint}
### Problem
${cluster.signalCount} community posts across ${cluster.sourceDiversity} sources report friction with ${cluster.clusterName}.
Key pain themes: ${topTerms}.
${personasSection}${existingSection}${workaroundSection}${techSection}
### Solution
A focused web app that allows users to:
- Eliminate the identified manual workarounds with a streamlined UI
- ${diffLine}
- Save and export results locally with no sign-up required

### Core Features (MVP)
1. Simple input interface addressing the core use case
2. Local storage persistence (no backend)
3. Export as CSV or copy to clipboard
4. Clean, minimal UI optimised for the primary workflow

### Technical Constraints
- Single HTML file with embedded CSS/JS (or simple multi-file)
- localStorage for all persistence — no backend, no database server
- No paid APIs, no OAuth, no real-time collaboration, no payment processing
- No native mobile or desktop apps
- Completable in one Claude Code session by a solo developer
- If pain requires anything on this list, scope DOWN in RISKS until it fits

### Design Direction
- Clean, minimal, task-focused
- Dark / light mode toggle
- Keyboard shortcuts for power users
- No unnecessary features — solve the exact pain identified above`
}

// ── Implementation plan ───────────────────────────────────────────────────────

function buildImplementationPlan(cluster: OpportunityCluster): string {
  const name = cluster.clusterName.split(' ').slice(0, 2).join(' ')
  return `## Implementation Plan

**Phase 1: Core MVP (Week 1)**
- [ ] Input interface for ${name}
- [ ] Local storage persistence
- [ ] Basic display/management UI

**Phase 2: Enhancement (Week 2)**
- [ ] Export functionality (CSV, clipboard)
- [ ] Search/filter within saved items
- [ ] Keyboard shortcuts

**Phase 3: Polish (Week 3)**
- [ ] Mobile responsive layout
- [ ] Dark mode
- [ ] Onboarding empty state`
}

// ── Template fallback ─────────────────────────────────────────────────────────

function buildTemplateConcept(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): Omit<AppConcept, 'id' | 'clusterId' | 'createdAt' | 'updatedAt' | 'status'> {
  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))
  const topTerms       = topTermsString(cluster.termFrequency)
  const sources        = Object.keys(tally(clusterSignals, (s) => s.source)).join(', ')
  const es             = cluster.entitySummary
  const dim            = cluster.dimensionScores

  const title   = cluster.clusterName
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  // tagline: use first persona and industry if available
  const personaHint  = es?.personas?.[0] ?? 'users'
  const industryHint = es?.industries?.[0] ? ` in ${es.industries[0]}` : ''
  const tagline = `The focused tool for ${personaHint}${industryHint} fighting ${cluster.clusterName}`

  const evidenceSummary = {
    signalCount:     cluster.signalCount,
    sourceBreakdown: tally(clusterSignals, (s) => s.source),
    dateRange:       { first: cluster.firstDetected, last: cluster.lastDetected },
    topQuotes:       top5ByIntensity(clusterSignals).map((s) => ({
      text:   s.painText.slice(0, 200),
      source: s.source,
      url:    s.sourceUrl,
      author: s.author,
    })),
  }

  const painPoints = top8Terms(cluster.termFrequency).map(([point, frequency]) => ({
    point,
    frequency,
  }))

  const confidenceScore = Math.min(100, Math.round(cluster.opportunityScore))

  // ── Grounded template text ─────────────────────────────────────────────────

  // opportunitySummary — lead with entity data if present
  const personaList  = es?.personas?.length ? `${es.personas.slice(0, 2).join(' and ')}` : `individuals`
  const industryList = es?.industries?.length ? ` across ${es.industries.join(' and ')}` : ''
  const opportunitySummary =
    `${cluster.signalCount} signals across ${sources} point to recurring friction with ` +
    `${cluster.clusterName} affecting ${personaList}${industryList}. ` +
    `Top recurring themes: ${topTerms}.`

  // problemStatement — name the technologies and workflows if known
  const techLine = es?.technologies?.length
    ? ` The pain occurs most in ${es.technologies.slice(0, 2).join(' and ')} workflows.`
    : ''
  const wfLine = es?.workflows?.length
    ? ` Affected workflows: ${es.workflows.slice(0, 2).join(', ')}.`
    : ''
  const problemStatement =
    `Users repeatedly report friction with ${cluster.clusterName}. ` +
    `The pain type is primarily "${cluster.painTheme}".` +
    techLine + wfLine +
    ` Top recurring themes: ${topTerms}.`

  // targetUser — use real personas + industries
  const personaFull  = es?.personas?.length ? es.personas.join(', ') : `individuals experiencing ${cluster.painTheme} friction`
  const industryFull = es?.industries?.length ? ` working in ${es.industries.join(' and ')}` : ''
  const targetUser   = `${personaFull}${industryFull}, as evidenced by ${cluster.signalCount} community posts across ${sources}.`

  // proposedSolution — mention workarounds replaced + incumbents beaten
  const workaroundClause = es?.workarounds?.length
    ? ` Replaces current workarounds: ${es.workarounds.slice(0, 2).join(', ')}.`
    : ''
  const incumbentClause = es?.existingSolutions?.length
    ? ` More focused than existing tools: ${es.existingSolutions.slice(0, 2).join(', ')}.`
    : ''
  const proposedSolution =
    `A focused single-page web app that directly addresses the ${cluster.clusterName} pain.` +
    workaroundClause + incumbentClause

  // valueProp — top terms + differentiation + WTP hint
  const top3Terms = top8Terms(cluster.termFrequency).slice(0, 3).map(([t]) => t).join(', ')
  const diffClause = es?.existingSolutions?.length
    ? ` Simpler and more focused than ${es.existingSolutions[0]}.`
    : ''
  const monetiseClause = (dim?.willingnessToPay ?? 0) >= 60
    ? ' Free tier with optional one-time purchase.'
    : ''
  const valueProp =
    `Removes the top pain points: ${top3Terms}.` +
    diffClause +
    ` No sign-up. Works in the browser.` +
    monetiseClause

  // mvpScope — keep concise but name the core action
  const mvpScope = `Core: solve "${cluster.clusterName}". Single HTML file, localStorage, no backend. ` +
    (es?.workarounds?.length ? `Automates: ${es.workarounds[0]}.` : '')

  const risks =
    `Signals may represent a vocal minority — validate with target users before building. ` +
    (es?.existingSolutions?.length
      ? `Watch for improvements in ${es.existingSolutions.slice(0, 2).join(' or ')} that close the gap.`
      : `Watch for existing tools not detected by the saturation filter.`)

  return {
    title,
    tagline,
    confidenceScore,
    evidenceSummary,
    painPoints,
    opportunitySummary,
    problemStatement,
    targetUser,
    proposedSolution,
    valueProp,
    mvpScope,
    risks,
    claudeCodePrompt:   buildClaudeCodePrompt(cluster, topTerms),
    implementationPlan: buildImplementationPlan(cluster),
    generatedBy:        'template' as const,
  }
}

// ── Ollama generation ─────────────────────────────────────────────────────────

async function generateWithOllama(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): Promise<Partial<Record<SectionKey, string>> | null> {
  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))
  const topQuotes      = top5ByIntensity(clusterSignals)
    .map((s) => `- "${s.painText.slice(0, 150)}" (${s.source})`)
    .join('\n')
  const sources        = Object.keys(tally(clusterSignals, (s) => s.source)).join(', ')
  const top10Terms     = topTermsString(cluster.termFrequency, 10)

  // Schema v1: inject entity intelligence and dimension hints when available
  const entityContext   = buildEntityContext(cluster)
  const dimensionHints  = buildDimensionHints(cluster)

  const prompt =
    `You are an app opportunity analyst. Return EXACTLY these sections with EXACTLY these headers in this order. ` +
    `No extra sections. No skipped sections. Vary prose quality freely — never vary the schema.\n\n` +
    `## OPPORTUNITY_SUMMARY\n## PROBLEM_STATEMENT\n## TARGET_USER\n## PROPOSED_SOLUTION\n` +
    `## VALUE_PROPOSITION\n## MVP_SCOPE\n## RISKS\n## CLAUDE_CODE_PROMPT\n## IMPLEMENTATION_PLAN\n\n` +
    `Pain pattern: "${cluster.clusterName}"\n` +
    `Pain type: ${cluster.painTheme}\n` +
    `Opportunity score: ${cluster.opportunityScore ?? '—'} / 100\n` +
    `Signal count: ${cluster.signalCount} across ${sources}\n` +
    (entityContext
      ? `\nEntity intelligence (extracted from ${cluster.signalCount} signals):\n${entityContext}\n`
      : '') +
    (dimensionHints
      ? `\n${dimensionHints}\n`
      : '') +
    `\nTop pain quotes:\n${topQuotes}\n` +
    `Recurring terms: ${top10Terms}\n\n` +
    `HARD CONSTRAINTS — enforce in every section, especially CLAUDE_CODE_PROMPT:\n` +
    `- Single-page web app (one HTML file or simple multi-file)\n` +
    `- localStorage or IndexedDB only — no backend, no database server\n` +
    `- No paid APIs, no OAuth, no real-time collaboration, no payment processing\n` +
    `- No native mobile or desktop apps\n` +
    `- Completable in one Claude Code session by a solo developer\n` +
    `- If pain requires anything on this list, scope the solution DOWN in RISKS until it fits\n\n` +
    `Use the entity intelligence above to write SPECIFIC, GROUNDED sections:\n` +
    `- TARGET_USER must name the actual persona(s) and industry if available\n` +
    `- PROPOSED_SOLUTION must reference which workarounds it replaces\n` +
    `- VALUE_PROPOSITION must compare to existing solutions if listed\n` +
    `- CLAUDE_CODE_PROMPT must include the target users and existing-tool context`

  try {
    const response = await generateResponse(prompt, { temperature: 0.7 })
    if (!response || typeof response !== 'string') return null
    return parseSections(response)
  } catch {
    return null
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function makeId(): string {
  return `concept_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export async function generateConcept(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): Promise<AppConcept> {
  const now      = new Date().toISOString()
  const template = buildTemplateConcept(cluster, signals)

  const ollamaSections = await generateWithOllama(cluster, signals)

  const generatedBy: 'ollama' | 'template' = ollamaSections ? 'ollama' : 'template'

  const merged = {
    opportunitySummary: ollamaSections?.OPPORTUNITY_SUMMARY  ?? template.opportunitySummary,
    problemStatement:   ollamaSections?.PROBLEM_STATEMENT    ?? template.problemStatement,
    targetUser:         ollamaSections?.TARGET_USER          ?? template.targetUser,
    proposedSolution:   ollamaSections?.PROPOSED_SOLUTION    ?? template.proposedSolution,
    valueProp:          ollamaSections?.VALUE_PROPOSITION    ?? template.valueProp,
    mvpScope:           ollamaSections?.MVP_SCOPE            ?? template.mvpScope,
    risks:              ollamaSections?.RISKS                ?? template.risks,
    claudeCodePrompt:   ollamaSections?.CLAUDE_CODE_PROMPT   ?? template.claudeCodePrompt,
    implementationPlan: ollamaSections?.IMPLEMENTATION_PLAN  ?? template.implementationPlan,
  }

  return {
    id:         makeId(),
    clusterId:  cluster.id,
    createdAt:  now,
    updatedAt:  now,
    status:     'new',
    generatedBy,
    ...template,
    ...merged,
  }
}
