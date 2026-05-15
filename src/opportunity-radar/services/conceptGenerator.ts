import type { OpportunityCluster, PainSignal, AppConcept } from '../types.js'
import type {
  VentureConceptCandidate,
  EvidenceTraceEntry,
  OpportunityFrame,
  VentureScopeLLMOutput,
} from '../../venture-scope/types.js'
import { generateResponse, chatJson } from '../../lib/llm/ollama.js'
import { buildVentureScopeLLMInput } from '../../venture-scope/services/llmInputBuilder.js'
import { parseVentureScopeLLMOutput, validateLLMOutput, ID_LEAK_WARNING_PREFIX } from '../../venture-scope/services/llmOutputParser.js'

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

/** Stable concept ID: deterministic from clusterId + angleType.
 *  Repeated rescans produce the same ID → saveVsConcept() upserts instead of accumulating. */
function makeConceptId(clusterId: string, angleType: string): string {
  const str = `${clusterId}:${angleType}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return `vs_${Math.abs(hash).toString(36)}`
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

// ── Venture Scope: graph-grounded multi-candidate generation ─────────────────
//
// Three genuinely different strategic angles, each grounded in the entity graph:
//
//   Rank 1 — Persona-First:         who has this problem, what workflow breaks for them,
//                                   what workaround they use instead of a real tool.
//   Rank 2 — Workflow-First:        what process is broken, where it fails (bottleneck),
//                                   why existing tools miss this specific step.
//   Rank 3 — Technology-Enablement: what new capability makes this tractable now,
//                                   why tools built before it can't catch up.
//
// Ollama (when available) receives the structured frame — not raw pain snippets.

// ── Shared helpers ────────────────────────────────────────────────────────────

function cap(s: string): string {
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Safe value accessor — returns entity value at index, or empty string. */
function ev(
  entities: import('../../opportunity-radar/types.js').ExtractedEntity[],
  idx = 0,
): string {
  return entities[idx]?.value ?? ''
}

/**
 * Select evidence-trace entries for a candidate, anchored to a specific entity value.
 * Signals that mention the anchor (in entities[] or plain text) rank highest.
 * Falls back to any corpus-sourced signals if no specific matches found.
 */
function buildEvidenceTrace(
  signals: PainSignal[],
  anchorValue: string,
  max = 4,
): EvidenceTraceEntry[] {
  const anchor = anchorValue.toLowerCase()

  const scored = signals
    .filter((s) => s.corpusSourceId) // only signals with corpus lineage
    .map((s) => {
      const inText     = s.painText.toLowerCase().includes(anchor) ? 2 : 0
      const inEntities = (s.entities ?? []).some(
        (e) => e.value.toLowerCase() === anchor,
      )
        ? 3
        : 0
      return { signal: s, relevance: inText + inEntities }
    })
    .sort((a, b) => b.relevance - a.relevance)

  // Use anchor-matched signals if we have at least 2; otherwise fall back to all corpus signals
  const pool =
    scored.filter((x) => x.relevance > 0).length >= 2
      ? scored
      : signals
          .filter((s) => s.corpusSourceId)
          .map((s) => ({ signal: s, relevance: 0 }))

  return pool.slice(0, max).map(({ signal: s }) => ({
    signalId:        s.id,
    sourceId:        s.corpusSourceId!,
    sourceType:      s.corpusSourceType ?? 'corpus',
    topicId:         s.corpusTopicId,
    documentId:
      s.corpusSourceType === 'document' ? s.corpusSourceId : undefined,
    evidenceSnippet: s.painText.slice(0, 280),
    extractedAt:     s.detectedAt,
  }))
}

// ── Graph-structured Ollama prompt (JSON-mode contract) ───────────────────────
//
// Replaces the legacy markdown-section format:
//   OLD: generateResponse() → parseSections() → Partial<Record<SectionKey, string>>
//   NEW: chatJson() → parseVentureScopeLLMOutput() → VentureScopeLLMOutput | null
//
// Input packet is built deterministically — no raw IDs or signal text reach the
// model. Returns null on any failure → callers use deterministic template values.

async function generateWithOllamaFrame(
  frame: OpportunityFrame,
  angleType: 'persona_first' | 'workflow_first' | 'technology_enablement',
  coreWedge: string,
): Promise<VentureScopeLLMOutput | null> {
  const input = buildVentureScopeLLMInput(
    frame.cluster,
    frame,
    coreWedge,
    angleType,
  )

  const systemPrompt =
    `You are a venture intelligence analyst. You receive a structured opportunity frame as JSON ` +
    `and return a venture brief as JSON.\n\n` +
    `STRICT RULES — enforce in every field:\n` +
    `1. Reference ONLY entity values listed in graphContext — do not invent personas, tools, workflows, or companies\n` +
    `2. Ground every claim in the evidenceSnippets provided — do not invent user behaviours or quotes\n` +
    `3. Do not use generic filler: no "AI can solve this", no "cutting-edge technology", no "seamlessly integrate"\n` +
    `4. Every field must be specific to THIS opportunity — not a generic startup template\n` +
    `5. Return ONLY valid JSON — no markdown wrapper, no prose outside the JSON object\n\n` +
    `REQUIRED OUTPUT SCHEMA (all fields required, all strings, none empty):\n` +
    `{\n` +
    `  "title": "3-8 words",\n` +
    `  "tagline": "one sentence — the product's core promise",\n` +
    `  "opportunitySummary": "2-3 sentences — what is the opportunity and why it matters",\n` +
    `  "problemStatement": "2-3 sentences — what is broken, who is affected, and how badly",\n` +
    `  "targetUser": "1-2 sentences — specific persona and context from graphContext",\n` +
    `  "proposedSolution": "2-3 sentences — what to build and what workaround it replaces",\n` +
    `  "valueProp": "1-2 sentences — measurable benefit to the user",\n` +
    `  "whyNow": "1-2 sentences — timing argument grounded in the evidence",\n` +
    `  "buyerVsUser": "1-2 sentences — who pays vs who uses this tool",\n` +
    `  "currentAlternatives": "1-2 sentences — what exists today and where it falls short",\n` +
    `  "existingWorkarounds": "1 sentence — how people cope with the problem right now",\n` +
    `  "keyAssumptions": "2-3 bullet points starting with dashes",\n` +
    `  "successMetrics": "2-3 bullet points starting with dashes",\n` +
    `  "pricingHypothesis": "1-2 sentences — pricing model and rationale",\n` +
    `  "defensibility": "1-2 sentences — why this is hard to copy once traction exists",\n` +
    `  "goToMarketAngle": "1-2 sentences — first customers and acquisition channel",\n` +
    `  "mvpScope": "2-3 sentences — what to build in v1 and what to exclude",\n` +
    `  "risks": "2-3 sentences — the most likely failure modes"\n` +
    `}`

  try {
    const raw = await chatJson(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: JSON.stringify(input, null, 2) },
      ],
      { temperature: 0.6, num_ctx: 16384 },
    )
    if (!raw) return null

    const output = parseVentureScopeLLMOutput(raw)
    if (!output) return null

    const warnings = validateLLMOutput(output, input)
    if (warnings.length > 0) {
      console.warn('[VS-LLM] Output warnings:', warnings)
    }
    // ID-leak is an unconditional hard reject — cluster IDs in narrative output
    // indicate prompt injection or a model that hallucinated internal references.
    if (warnings.some((w) => w.startsWith(ID_LEAK_WARNING_PREFIX))) {
      console.warn('[VS-LLM] ID-leak detected — falling back to deterministic')
      return null
    }
    // Hard reject on >= 4 combined warnings — accommodates small local models that
    // produce brief but correct answers (up to 3 short-field warnings pass).
    // 4+ filler phrases or any filler+short combination triggers rejection.
    if (warnings.length >= 4) {
      console.warn('[VS-LLM] Too many warnings — falling back to deterministic')
      return null
    }

    return output
  } catch {
    return null
  }
}

// ── Candidate builders ────────────────────────────────────────────────────────

function buildPersonaFirstCandidate(
  frame: OpportunityFrame,
  now: string,
  rank: number,
  ollama: VentureScopeLLMOutput | null,
): VentureConceptCandidate {
  const {
    cluster, signals,
    personas, workflows, workarounds, existingSolutions,
    buyerRoles, industries, emergingTech, platformShifts,
  } = frame

  const persona    = ev(personas)   || 'practitioners'
  const workflow   = ev(workflows)  || cluster.clusterName
  const workaround = ev(workarounds)
  const incumbent  = ev(existingSolutions)
  const buyer      = ev(buyerRoles) || ev(personas, 1) || 'team lead or manager'
  const industry   = ev(industries)
  const shift      = ev([...emergingTech, ...platformShifts])

  const coreWedge = workaround
    ? `${cap(persona)} doing ${workflow} still resort to ${workaround} — no focused tool closes this gap`
    : incumbent
      ? `${cap(persona)} can't rely on ${incumbent} for ${workflow} — the gap is real and unaddressed`
      : `${cap(persona)} lacks a purpose-built tool for ${workflow}`

  const titleFallback = `${cap(persona)} ${cap(workflow)} Tool`

  return {
    id:        makeConceptId(cluster.id, 'persona_first'),
    clusterId: cluster.id,
    rank,
    angleType: 'persona_first',

    title:   ollama?.title   ?? titleFallback,
    tagline: ollama?.tagline ?? `The focused tool for ${persona} who still struggle with ${workflow}`,
    coreWedge,

    primaryUser:         persona,
    buyer,
    workflowImprovement: workaround
      ? `Eliminates the ${workaround} workaround from the ${workflow} process`
      : `Streamlines ${workflow} for ${persona} without manual steps`,

    complexityEstimate:     'medium',
    revenueModelHypothesis: 'Monthly SaaS subscription charged to the team that owns the workflow',

    opportunityScore: cluster.opportunityScore ?? 50,
    confidenceScore:  Math.min(0.95, cluster.dimensionScores?.confidence ?? 0.6),
    generatedBy:      ollama ? 'ollama' : 'graph',
    status:           'active',
    createdAt:        now,
    updatedAt:        now,

    evidenceTrace: buildEvidenceTrace(
      signals,
      ev(personas) || ev(workflows) || cluster.clusterName,
    ),

    // ── LLM-synthesised fields (deterministic fallback for each) ─────────────
    opportunitySummary: ollama?.opportunitySummary ?? (
      `${cap(persona)} consistently encounter friction with ${workflow}` +
      (industry ? ` in ${industry}` : '') +
      (workaround ? `. Current workaround: ${workaround}.` : '.') +
      ` ${cluster.signalCount} corpus items confirm this pattern.`
    ),
    problemStatement: ollama?.problemStatement ?? (
      `${cap(persona)} performing ${workflow}` +
      (workaround ? ` must use ${workaround} to compensate for missing tooling.` : ' lack dedicated tooling.') +
      (incumbent ? ` ${cap(incumbent)} doesn't address this specific need.` : '')
    ),
    targetUser: ollama?.targetUser ?? (
      `${cap(persona)}` +
      (industry ? ` in ${industry}` : '') +
      ` who regularly perform ${workflow} and need a better path than current workarounds.`
    ),
    proposedSolution: ollama?.proposedSolution ?? (
      `A focused tool that handles ${workflow} end-to-end for ${persona}.` +
      (workaround ? ` Replaces ${workaround} with a purpose-built workflow.` : '')
    ),
    valueProp: ollama?.valueProp ?? (
      `${cap(persona)} complete ${workflow} faster, with less manual effort` +
      (workaround ? ` and without maintaining ${workaround}` : '') + '.'
    ),
    whyNow: ollama?.whyNow ?? (
      shift
        ? `${cap(shift)} creates a new window for ${workflow} tooling that didn't exist before`
        : workaround
          ? `Active workaround use confirms unmet demand — the workaround is a product waiting to be built`
          : `Signal frequency across the corpus confirms recurring unsolved friction, not a one-off frustration`
    ),
    mvpScope: ollama?.mvpScope ?? (
      `Core: solve the ${workflow} problem for ${persona}. Single flow, no sign-up required.` +
      (workaround ? ` Replaces ${workaround}.` : '')
    ),
    risks: ollama?.risks ?? (
      `Signals may represent a vocal minority — validate with real users before building. ` +
      (incumbent
        ? `Watch for ${incumbent} shipping a focused mode for this use case.`
        : 'Watch for incumbents closing the gap.')
    ),
    buyerVsUser: ollama?.buyerVsUser ?? (
      buyer !== persona
        ? `${cap(buyer)} purchases; ${persona} uses — sell to the buyer, design for the user.`
        : `${cap(persona)} is both buyer and user — optimise for self-serve adoption.`
    ),
    currentAlternatives: ollama?.currentAlternatives ?? (
      incumbent
        ? `${cap(incumbent)} is the closest alternative but misses the ${workflow} use case specifically.`
        : `No dedicated tool exists — users rely on general-purpose tools and manual workarounds.`
    ),
    existingWorkarounds: ollama?.existingWorkarounds ?? (
      workaround
        ? `${cap(persona)} currently use ${workaround} as a manual substitute for a real tool.`
        : `Users rely on manual effort or general tools to fill the gap.`
    ),
    keyAssumptions: ollama?.keyAssumptions ?? (
      `- The problem affects enough ${persona} to sustain a focused product\n` +
      `- ${cap(persona)} will switch from ${workaround || 'their current approach'} given a better alternative\n` +
      (incumbent ? `- ${cap(incumbent)} will not ship a focused fix before we reach initial traction` : '')
    ),
    successMetrics: ollama?.successMetrics ?? (
      `- Users complete the core ${workflow} flow without returning to ${workaround || 'manual steps'}\n` +
      `- Week-2 retention ≥ 40 %\n` +
      `- First paying customer within 90 days of launch`
    ),
    pricingHypothesis: ollama?.pricingHypothesis ?? (
      (cluster.dimensionScores?.willingnessToPay ?? 0) >= 60
        ? `Free tier for solo users; paid plan (~$20/month) for teams who rely on it daily.`
        : `Start free to validate adoption; introduce a paid tier once weekly active users reach 100.`
    ),
    defensibility: ollama?.defensibility ?? (
      `Workflow depth and accumulated user data create switching costs once the tool becomes part of the ${persona} daily routine.`
    ),
    goToMarketAngle: ollama?.goToMarketAngle ?? (
      industry
        ? `Target ${persona} communities in ${industry} first — niche audiences validate faster and generate denser word-of-mouth.`
        : `Target the communities where these corpus signals originated — the research itself maps the distribution channel.`
    ),

    // Implementation plan stays deterministic — not a narrative LLM task
    implementationPlan: buildImplementationPlan(cluster),
  }
}

function buildWorkflowFirstCandidate(
  frame: OpportunityFrame,
  now: string,
  rank: number,
): VentureConceptCandidate {
  const {
    cluster, signals,
    workflows, bottlenecks, workarounds, existingSolutions, personas, buyerRoles, industries,
  } = frame

  // Prefer the second workflow to differentiate from persona-first (same data, different angle)
  const workflow   = ev(workflows, 1) || ev(workflows) || cluster.clusterName
  const bottleneck = ev(bottlenecks)
  const incumbent  = ev(existingSolutions)
  const persona    = ev(personas, 1) || ev(personas) || 'practitioners'
  const buyer      = ev(buyerRoles) || 'operations or product lead'
  const industry   = ev(industries)
  const workaround = ev(workarounds)

  const coreWedge =
    bottleneck && incumbent
      ? `${cap(workflow)} stalls at ${bottleneck} — ${cap(incumbent)} doesn't address this breakpoint`
      : bottleneck
        ? `The ${workflow} process breaks at ${bottleneck}, a step every general tool overlooks`
        : incumbent
          ? `${cap(workflow)} needs a dedicated tool — ${cap(incumbent)} is too broad to solve the core step`
          : `${cap(workflow)} lacks purpose-built tooling — general solutions leave the hardest steps to manual effort`

  const whyNow = incumbent
    ? `${cap(incumbent)} owns the category but leaves ${workflow} friction unaddressed — a focused tool can take the specific use case`
    : bottleneck
      ? `No tool has specifically targeted the ${bottleneck} step — a focused entry point exists`
      : `No focused tool exists for this exact workflow — the space is clear`

  return {
    id:                     makeConceptId(cluster.id, 'workflow_first'),
    clusterId:              cluster.id,
    rank,
    angleType:              'workflow_first',
    title:                  bottleneck
      ? `${cap(workflow)} ${cap(bottleneck)} Solver`
      : `${cap(workflow)} Workflow Tool`,
    tagline:                `Fix the ${bottleneck || workflow} step that ${cap(incumbent) || 'every tool'} leaves broken`,
    coreWedge,
    primaryUser:            persona,
    buyer,
    workflowImprovement:    bottleneck
      ? `Automates the ${bottleneck} step, removing the main failure point in ${workflow}`
      : `Provides end-to-end ${workflow} support without the gaps of general-purpose tools`,
    whyNow,
    complexityEstimate:     bottleneck ? 'low' : 'medium',
    revenueModelHypothesis: 'Per-seat team pricing — bought by the team that owns the workflow',
    opportunityScore:       Math.max(10, (cluster.opportunityScore ?? 50) - 5),
    confidenceScore:        Math.min(0.9, (cluster.dimensionScores?.confidence ?? 0.55) - 0.05),
    generatedBy:            'graph',
    status:                 'active',
    createdAt:              now,
    updatedAt:              now,
    evidenceTrace:          buildEvidenceTrace(signals, ev(workflows) || ev(bottlenecks) || cluster.clusterName),
    opportunitySummary:
      `${cap(workflow)} repeatedly breaks at the same point` +
      (bottleneck ? ` — ${bottleneck}` : '') +
      (industry ? ` in ${industry}` : '') + '. ' +
      (incumbent ? `${cap(incumbent)} users consistently report this gap. ` : '') +
      `${cluster.signalCount} corpus items confirm the pattern.`,
    problemStatement:
      `The ${workflow} process has a documented failure point` +
      (bottleneck ? ` at ${bottleneck}` : '') +
      (incumbent ? `. ${cap(incumbent)} doesn't solve it and users compensate manually.` : '. No dedicated solution exists.'),
    targetUser:
      `${cap(persona)} who manage or participate in ${workflow}` +
      (industry ? ` in ${industry}` : '') +
      ' and are frustrated by the lack of purpose-built tooling for the hard steps.',
    proposedSolution:
      `A workflow-specific tool that handles ${workflow}` +
      (bottleneck ? `, with particular focus on ${bottleneck}` : '') + '.' +
      (incumbent ? ` More focused than ${cap(incumbent)} — solves the exact step it misses.` : ''),
    valueProp:
      `${cap(workflow)} completes without the manual intervention currently required` +
      (bottleneck ? ` at ${bottleneck}` : '') + '.',
    mvpScope:
      `Single-workflow tool covering ${workflow}` +
      (bottleneck ? `, prioritising ${bottleneck}` : '') +
      '. No sign-up, local-first, exports on demand.',
    risks:
      `Workflow tooling can suffer from scope creep — keep the MVP narrow. ` +
      (incumbent ? `${cap(incumbent)} could ship a focused mode for this use case.` : ''),

    // ── New narrative fields — deterministic for workflow_first ──────────────
    buyerVsUser:
      buyer !== persona
        ? `${cap(buyer)} purchases; ${cap(persona)} uses — position around workflow ROI for the buyer.`
        : `${cap(persona)} is both buyer and user — keep onboarding self-serve.`,
    currentAlternatives:
      incumbent
        ? `${cap(incumbent)} handles adjacent use cases but skips the ${bottleneck || workflow} step that causes the most friction.`
        : `No dedicated tool targets this exact workflow — users patch it together from general-purpose tools.`,
    existingWorkarounds:
      workaround
        ? `${cap(persona)} currently use ${workaround} to bridge the gap in the ${workflow} process.`
        : `Users manually handle the ${bottleneck || workflow} step, often with spreadsheets or ad-hoc scripts.`,
    keyAssumptions:
      `- The ${bottleneck || workflow} breakpoint is specific enough to support a focused product\n` +
      `- Buyers will fund a point solution once the ROI of removing this step is clear\n` +
      (incumbent ? `- ${cap(incumbent)} won't ship a dedicated fix before we reach initial traction` : ''),
    successMetrics:
      `- Users complete ${workflow} end-to-end without manual intervention at the critical step\n` +
      `- Time-to-complete ${workflow} drops ≥ 30 % vs. current baseline\n` +
      `- Net Promoter Score ≥ 40 after first 30 days`,
    pricingHypothesis:
      `Per-seat team pricing (~$20/seat/month) — sold to the ${buyer} who owns the ${workflow} workflow.`,
    defensibility:
      bottleneck
        ? `Deep specialisation in the ${bottleneck} step creates a moat: incumbents won't rebuild for a sub-task, and users develop muscle memory.`
        : `Workflow specialisation is hard to replicate without deep user research; early users become the product's most credible advocates.`,
    goToMarketAngle:
      industry
        ? `Start with ${persona} in ${industry} where signal volume is highest, then expand to adjacent sectors once the core workflow is proven.`
        : `Direct outreach to the ${persona} communities that generated the corpus signals; offer a free import of their existing ${workaround || 'workflow data'}.`,

    implementationPlan:     buildImplementationPlan(cluster),
  }
}

function buildTechEnablementCandidate(
  frame: OpportunityFrame,
  now: string,
  rank: number,
): VentureConceptCandidate {
  const {
    cluster, signals,
    emergingTech, platformShifts, technologies, workflows,
    workarounds, bottlenecks, existingSolutions, personas, buyerRoles, industries,
  } = frame

  // Anchor on the most forward-looking technology signal available
  const techAnchorEntity = emergingTech[0] ?? platformShifts[0] ?? technologies[0]
  const techValue        = techAnchorEntity?.value || 'new automation capabilities'
  const isForwardTech    = emergingTech.length > 0 || platformShifts.length > 0

  const workflow  = ev(workflows)  || cluster.clusterName
  const incumbent = ev(existingSolutions)
  const persona   = ev(personas)   || 'early adopters'
  const buyer     = ev(buyerRoles) || 'technical lead or architect'
  const industry  = ev(industries)
  const workaround = ev(workarounds)
  const bottleneck = ev(bottlenecks)

  const coreWedge = isForwardTech
    ? `${cap(techValue)} makes ${workflow} automation tractable — existing tools were built before this capability existed`
    : incumbent
      ? `${cap(techValue)} provides the infrastructure for a new class of ${workflow} tools that ${cap(incumbent)} hasn't adopted`
      : `${cap(techValue)} opens a new approach to ${workflow} that general tools haven't targeted yet`

  const whyNow = isForwardTech
    ? `${cap(techValue)} is production-ready today, but no focused product has applied it to ${workflow} yet`
    : `Technical infrastructure for this solution category now exists at accessible cost and scale`

  return {
    id:                     makeConceptId(cluster.id, 'technology_enablement'),
    clusterId:              cluster.id,
    rank,
    angleType:              'technology_enablement',
    title:                  `${cap(techValue)}-Powered ${cap(workflow)} Tool`,
    tagline:                `What ${techValue} makes possible for ${workflow} that existing tools haven't built`,
    coreWedge,
    primaryUser:            persona,
    buyer,
    workflowImprovement:    `Leverages ${techValue} to automate or dramatically improve ${workflow} in ways that pre-${techValue} tools cannot`,
    whyNow,
    complexityEstimate:     isForwardTech ? 'low' : 'medium',
    revenueModelHypothesis: isForwardTech
      ? 'Usage-based pricing — charge on value delivered via the new capability'
      : 'Monthly SaaS subscription with a generous free tier for technical evaluation',
    opportunityScore:       Math.max(10, (cluster.opportunityScore ?? 50) - 8),
    confidenceScore:        Math.min(0.85, (cluster.dimensionScores?.confidence ?? 0.5) - 0.08),
    generatedBy:            'graph',
    status:                 'active',
    createdAt:              now,
    updatedAt:              now,
    evidenceTrace:          buildEvidenceTrace(signals, techValue),
    opportunitySummary:
      `${cap(techValue)} creates a genuine new window for ${workflow} tooling` +
      (industry ? ` in ${industry}` : '') +
      (incumbent ? ` — ${cap(incumbent)} hasn't adapted, leaving the field open.` : '.'),
    problemStatement:
      `${cap(workflow)} has been addressed by tools built before ${techValue} was viable. ` +
      `Those tools have structural gaps that only a native ${techValue} approach can close.`,
    targetUser:
      `${cap(persona)} who want ${workflow} support built on ${techValue}` +
      (industry ? ` in ${industry}` : '') +
      ' and are willing to adopt early if the tool solves their specific use case.',
    proposedSolution:
      `A ${techValue}-native tool for ${workflow}.` +
      (incumbent ? ` Unlike ${cap(incumbent)}, built from the ground up for the ${techValue} era.` : ''),
    valueProp:
      `Delivers ${workflow} outcomes that aren't achievable with pre-${techValue} tools — ` +
      `faster, more automated, and structurally better matched to how the work is actually done.`,
    mvpScope:
      `One ${techValue}-powered ${workflow} flow, end-to-end. ` +
      `Demonstrate the capability gap between this and ${incumbent ? cap(incumbent) : 'existing tools'} directly.`,
    risks:
      `Early-stage technology carries adoption risk — validate ${techValue} maturity with target users. ` +
      (incumbent ? `${cap(incumbent)} may ship native ${techValue} support.` : ''),

    // ── New narrative fields — deterministic for technology_enablement ────────
    buyerVsUser:
      buyer !== persona
        ? `${cap(buyer)} purchases; ${cap(persona)} evaluates and adopts — lead with capability proof for the buyer.`
        : `${cap(persona)} is both buyer and technical evaluator — design for a fast, self-directed trial.`,
    currentAlternatives:
      incumbent
        ? `${cap(incumbent)} is the category incumbent but predates ${techValue} — it has structural gaps a native approach can close.`
        : `No tool has applied ${techValue} to ${workflow} yet — the field is clear for a native entrant.`,
    existingWorkarounds:
      workaround
        ? `${cap(persona)} use ${workaround} to compensate for the lack of ${techValue}-native tooling.`
        : `Users rely on pre-${techValue} tools and accept the capability ceiling as unavoidable.`,
    keyAssumptions:
      `- ${cap(techValue)} is stable and accessible enough for a production product today\n` +
      `- ${cap(persona)} will adopt early if the tool demonstrates a clear capability improvement\n` +
      (incumbent ? `- ${cap(incumbent)} will not ship native ${techValue} support before we reach traction` : ''),
    successMetrics:
      `- Users complete ${workflow} in ways not possible with pre-${techValue} tools\n` +
      `- Technical evaluation to production adoption within 30 days for early customers\n` +
      `- ${bottleneck ? `The ${bottleneck} step` : 'The hardest step'} is automated end-to-end in the MVP`,
    pricingHypothesis: isForwardTech
      ? `Usage-based pricing — charge on the value delivered via the new capability, not a flat seat fee.`
      : `Monthly SaaS subscription with a generous free tier for technical evaluation; upgrade on demonstrated value.`,
    defensibility: isForwardTech
      ? `First-mover depth in applying ${techValue} to ${workflow} is hard to replicate; the data and model quality accumulated early become the moat.`
      : `${cap(techValue)} infrastructure knowledge compounds — teams that build on it first accumulate irreplaceable implementation depth.`,
    goToMarketAngle:
      industry
        ? `Target ${persona} in ${industry} who are already experimenting with ${techValue} — they understand the capability gap and need the least convincing.`
        : `Developer or technical communities where ${techValue} adoption is earliest; a working demo that shows the capability gap is the most effective first touchpoint.`,

    implementationPlan:     buildImplementationPlan(cluster),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate up to `count` VentureConceptCandidates from a structured
 * OpportunityFrame. Each candidate represents a distinct strategic angle:
 *
 *   Rank 1 (persona_first)          — grounded in who + workflow + workaround
 *   Rank 2 (workflow_first)         — grounded in process breakpoint + solution gap
 *   Rank 3 (technology_enablement)  — grounded in new capability + timing window
 *
 * The rank-1 candidate attempts Ollama synthesis from the structured frame.
 * Ollama receives graph context (not raw pain snippets) so its output stays
 * grounded in corpus evidence rather than inventing from generic cluster labels.
 *
 * @param frame  OpportunityFrame built by opportunityFrameBuilder.buildOpportunityFrame()
 * @param count  Number of candidates to return (default 3, max 3 in current model)
 */
export async function generateConcepts(
  frame: OpportunityFrame,
  count = 3,
): Promise<VentureConceptCandidate[]> {
  const now = new Date().toISOString()

  // Build rank-1 deterministically first so we have its coreWedge for the Ollama prompt
  const rank1Det = buildPersonaFirstCandidate(frame, now, 1, null)

  // Attempt Ollama synthesis for rank-1 with graph-structured prompt
  const ollamaOutput = await generateWithOllamaFrame(
    frame,
    'persona_first',
    rank1Det.coreWedge,
  )

  const candidates: VentureConceptCandidate[] = [
    buildPersonaFirstCandidate(frame, now, 1, ollamaOutput ?? null),
    buildWorkflowFirstCandidate(frame, now, 2),
    buildTechEnablementCandidate(frame, now, 3),
  ]

  return candidates.slice(0, Math.max(1, count))
}
