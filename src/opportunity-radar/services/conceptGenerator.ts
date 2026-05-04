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

// ── Template fallbacks ────────────────────────────────────────────────────────

function buildTemplateConcept(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): Omit<AppConcept, 'id' | 'clusterId' | 'createdAt' | 'updatedAt' | 'status'> {
  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))
  const topTerms       = topTermsString(cluster.termFrequency)
  const sources        = Object.keys(tally(clusterSignals, (s) => s.source)).join(', ')

  const title    = cluster.clusterName
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const tagline  = `A simple tool to address ${cluster.clusterName} for everyday users`

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

  return {
    title,
    tagline,
    confidenceScore,
    evidenceSummary,
    painPoints,

    opportunitySummary:  `${cluster.signalCount} signals across ${sources} point to a recurring pain around ${topTerms}.`,
    problemStatement:    `Users repeatedly report friction with ${cluster.clusterName}. The pain type is primarily "${cluster.painTheme}". Top recurring themes: ${topTerms}.`,
    targetUser:          `Individuals experiencing ${cluster.painTheme} friction, as evidenced by ${cluster.signalCount} community posts across ${sources}.`,
    proposedSolution:    `A focused single-page web app that directly addresses the ${cluster.clusterName} pain by eliminating the most common friction points identified in signals.`,
    valueProp:           `Removes the top pain points: ${top8Terms(cluster.termFrequency).slice(0,3).map(([t]) => t).join(', ')}. No sign-up. Works in the browser.`,
    mvpScope:            `Core features to address "${cluster.clusterName}". Single HTML file, localStorage, no backend required.`,
    risks:               `Signals may represent vocal minority. Validate with target users before building. Watch for existing tools not detected by saturation filter.`,
    claudeCodePrompt:    buildClaudeCodePrompt(cluster, topTerms),
    implementationPlan:  buildImplementationPlan(cluster),
    generatedBy:         'template' as const,
  }
}

function buildClaudeCodePrompt(cluster: OpportunityCluster, topTerms: string): string {
  return `## Claude Code Build Prompt

Build a single-page web app that addresses the "${cluster.clusterName}" pain pattern.

### Problem
Users repeatedly encounter friction with ${cluster.clusterName}. Key pain themes: ${topTerms}.

### Solution
A single-page web app that allows users to:
- Manage and track ${cluster.clusterName.split(' ').slice(0, 2).join(' ')} tasks efficiently
- Eliminate manual workarounds currently used
- Export/save results locally

### Core Features (MVP)
1. Simple input interface for the core use case
2. Local storage of data (no sign-up, no backend)
3. Export as CSV or copy to clipboard
4. Clean, minimal UI optimized for the workflow

### Technical Constraints
- Single HTML file with embedded CSS/JS (or simple multi-file)
- localStorage for all persistence
- No backend, no database server
- No paid APIs, no OAuth, no real-time collaboration, no payment processing
- No native mobile or desktop apps
- Completable in one Claude Code session by a solo developer
- If pain requires anything on this list, scope the solution DOWN in RISKS until it fits within constraints

### Design Direction
- Clean, minimal, focused on the core task
- Dark or light mode toggle
- No unnecessary features — solve the exact pain`
}

function buildImplementationPlan(cluster: OpportunityCluster): string {
  const name = cluster.clusterName.split(' ').slice(0,2).join(' ')
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

// ── Ollama generation ─────────────────────────────────────────────────────────

async function generateWithOllama(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): Promise<Partial<Record<SectionKey, string>> | null> {
  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))
  const topQuotes = top5ByIntensity(clusterSignals)
    .map((s) => `- "${s.painText.slice(0, 150)}" (${s.source})`)
    .join('\n')
  const sources    = Object.keys(tally(clusterSignals, (s) => s.source)).join(', ')
  const top10Terms = topTermsString(cluster.termFrequency, 10)

  const prompt = `You are an app opportunity analyst. Return EXACTLY these sections with EXACTLY these headers in this order. No extra sections. No skipped sections. Vary prose quality freely — never vary the schema.

## OPPORTUNITY_SUMMARY
## PROBLEM_STATEMENT
## TARGET_USER
## PROPOSED_SOLUTION
## VALUE_PROPOSITION
## MVP_SCOPE
## RISKS
## CLAUDE_CODE_PROMPT
## IMPLEMENTATION_PLAN

Pain pattern: "${cluster.clusterName}"
Pain type: ${cluster.painTheme}
Signal count: ${cluster.signalCount} across ${sources}
Top pain quotes:
${topQuotes}
Recurring terms: ${top10Terms}

HARD CONSTRAINTS — enforce in every section, especially CLAUDE_CODE_PROMPT:
- Single-page web app (one HTML file or simple multi-file)
- localStorage or IndexedDB only — no backend, no database server
- No paid APIs, no OAuth, no real-time collaboration, no payment processing
- No native mobile or desktop apps
- Completable in one Claude Code session by a solo developer
- If pain requires anything on this list, scope the solution DOWN in RISKS until it fits within constraints`

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
