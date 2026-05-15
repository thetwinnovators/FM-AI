# Venture Scope — Structured LLM Generation Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the markdown-parsing LLM generation contract with a strict JSON contract: deterministic context in, validated narrative JSON out, with guardrails against hallucination and a deterministic fallback on parse/validation failure.

**Architecture:** A new `VentureScopeLLMInput` packet is built deterministically from the entity graph, dimension scores, and selected evidence snippets — no raw IDs or internal references reach the model. Ollama's `chatJson` (JSON-mode) replaces `generateResponse` + `parseSections`. A parser rejects structurally invalid output; a validator flags filler phrases and ID leakage. The three candidate builders are updated to map `VentureScopeLLMOutput` fields to `VentureConceptCandidate`, with complete deterministic fallbacks for every field. Only the rank-1 (persona_first) candidate calls Ollama; ranks 2–3 remain fully deterministic. BriefTab gains a generatedBy badge and per-concept regenerate button.

**Tech Stack:** TypeScript 5, React 18, Vite, Ollama `chatJson` (JSON-mode via `/api/chat?format=json`), localStorage

---

## File Structure

**Create:**
- `src/venture-scope/services/llmInputBuilder.ts` — pure function: cluster + frame + scores → `VentureScopeLLMInput` packet
- `src/venture-scope/services/llmOutputParser.ts` — `parseVentureScopeLLMOutput` + `validateLLMOutput`

**Modify:**
- `src/venture-scope/types.ts` — add `VentureScopeLLMInput` and `VentureScopeLLMOutput` interfaces
- `src/opportunity-radar/services/conceptGenerator.ts` — rewrite `generateWithOllamaFrame`; update `buildPersonaFirstCandidate` param type and field map; add new fields to `buildWorkflowFirstCandidate` and `buildTechEnablementCandidate`
- `src/components/venture-scope/tabs/BriefTab.jsx` — add generatedBy badge, `onRegenerateConcept` prop, regenerate button
- `src/views/VentureScope.jsx` — add `handleRegenerateConcept` handler, `regenerating` state, pass props to BriefTab

**Untouched (leave exactly as-is):**
- `src/opportunity-radar/services/conceptGenerator.ts` — legacy `SECTION_KEYS`, `parseSections`, `generateWithOllama`, `generateConcept` (AppConcept path). These serve the old Opportunity Radar tab and must not change.

---

## Task 1: Define LLM contract types

**Files:**
- Modify: `src/venture-scope/types.ts`

- [ ] **Step 1: Add `VentureScopeLLMInput` and `VentureScopeLLMOutput` to types.ts**

Insert the following block immediately before the `// ─── Multi-candidate concept ──` comment (line 94 area), after the `EvidenceTraceEntry` interface:

```typescript
// ─── LLM contract types ───────────────────────────────────────────────────────
// VentureScopeLLMInput is the ONLY packet the LLM receives — every value is
// derived deterministically from the entity graph and dimension scores.
// No corpusSourceIds, no cluster IDs, no internal references are exposed.

export interface VentureScopeLLMInput {
  clusterName:      string
  angleType:        'persona_first' | 'workflow_first' | 'technology_enablement'
  angleDescription: string   // human-readable description of the strategic angle
  coreWedge:        string   // deterministic wedge statement built before the LLM call

  opportunityScore: number   // 0–100
  isBuildable:      boolean

  // Human-readable scoring summary — one entry per notable dimension
  // Example: "High willingness-to-pay (72/100)"
  scoreSummary: string[]

  // Entity values only — no IDs, no metadata
  graphContext: {
    personas:          string[]
    workflows:         string[]
    workarounds:       string[]
    bottlenecks:       string[]
    existingSolutions: string[]
    emergingTech:      string[]   // merged from frame.emergingTech + frame.platformShifts
    industries:        string[]
    technologies:      string[]
  }

  // Plaintext evidence excerpts — no corpusSourceIds exposed to the model
  evidenceSnippets: Array<{
    text:       string   // up to 200 chars of painText
    sourceType: string   // e.g. 'save', 'document'
  }>
}

// The LLM writes ONLY these narrative synthesis fields.
// Scoring, IDs, evidence trace, rank, and structural metadata stay deterministic.
// All fields required and non-empty — parseVentureScopeLLMOutput enforces this.
export interface VentureScopeLLMOutput {
  title:               string
  tagline:             string
  opportunitySummary:  string
  problemStatement:    string
  targetUser:          string
  proposedSolution:    string
  valueProp:           string
  whyNow:              string
  buyerVsUser:         string
  currentAlternatives: string
  existingWorkarounds: string
  keyAssumptions:      string
  successMetrics:      string
  pricingHypothesis:   string
  defensibility:       string
  goToMarketAngle:     string
  mvpScope:            string
  risks:               string
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```

Expected: 0 TypeScript errors.

- [ ] **Step 3: Commit**

```
git add src/venture-scope/types.ts
git commit -m "feat(vs): define VentureScopeLLMInput and VentureScopeLLMOutput contract types"
```

---

## Task 2: Build `llmInputBuilder.ts`

**Files:**
- Create: `src/venture-scope/services/llmInputBuilder.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { OpportunityCluster, DimensionScores } from '../../opportunity-radar/types.js'
import type { OpportunityFrame, VentureScopeLLMInput } from '../types.js'

// ── Angle descriptions ────────────────────────────────────────────────────────

const ANGLE_DESCRIPTIONS: Record<
  'persona_first' | 'workflow_first' | 'technology_enablement',
  string
> = {
  persona_first:
    'Persona-First — who has this problem, what breaks in their workflow, and what workaround they use instead of a real tool',
  workflow_first:
    'Workflow-First — what process is broken, where it specifically fails, and why existing tools miss this exact step',
  technology_enablement:
    'Technology-Enablement — what new capability makes this tractable now and why tools built before it cannot catch up',
}

// ── Score summary builder ─────────────────────────────────────────────────────

function scoreLine(label: string, score: number, threshold = 55): string | null {
  if (score < threshold) return null
  const tier = score >= 80 ? 'Very high' : score >= 65 ? 'High' : 'Moderate'
  return `${tier} ${label} (${score}/100)`
}

function buildScoreSummary(cluster: OpportunityCluster): string[] {
  const dim: DimensionScores | undefined = cluster.dimensionScores
  if (!dim) return []

  const candidates: Array<string | null> = [
    scoreLine('pain severity',           dim.painSeverity,     55),
    scoreLine('frequency',               dim.frequency,        55),
    scoreLine('urgency',                 dim.urgency,          55),
    scoreLine('willingness-to-pay',      dim.willingnessToPay, 55),
    scoreLine('market breadth',          dim.marketBreadth,    55),
    scoreLine('poor solution fit / gap', dim.poorSolutionFit,  55),
    scoreLine('feasibility',             dim.feasibility,      55),
    scoreLine('why-now timing',          dim.whyNow,           55),
    scoreLine('defensibility potential', dim.defensibility,    55),
    scoreLine('go-to-market clarity',    dim.gtmClarity,       55),
  ]

  const lines = candidates.filter((l): l is string => l !== null)
  if (cluster.isBuildable) lines.push('Buildability gate: PASSED')
  return lines
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Safe top-N entity value extractor. Returns empty array on undefined/empty input. */
function topN(entities: Array<{ value: string }> | undefined, n: number): string[] {
  return (entities ?? []).slice(0, n).map((e) => e.value)
}

export function buildVentureScopeLLMInput(
  cluster: OpportunityCluster,
  frame: OpportunityFrame,
  coreWedge: string,
  angleType: 'persona_first' | 'workflow_first' | 'technology_enablement',
): VentureScopeLLMInput {
  const evidenceSnippets = frame.signals
    .filter((s) => s.corpusSourceId && s.painText.length > 30)
    .sort((a, b) => b.intensityScore - a.intensityScore)
    .slice(0, 5)
    .map((s) => ({
      text:       s.painText.slice(0, 200),
      sourceType: s.corpusSourceType ?? 'corpus',
    }))

  return {
    clusterName:      cluster.clusterName,
    angleType,
    angleDescription: ANGLE_DESCRIPTIONS[angleType],
    coreWedge,
    opportunityScore: cluster.opportunityScore ?? 0,
    isBuildable:      cluster.isBuildable,
    scoreSummary:     buildScoreSummary(cluster),
    graphContext: {
      personas:          topN(frame.personas,                                   3),
      workflows:         topN(frame.workflows,                                  3),
      workarounds:       topN(frame.workarounds,                                3),
      bottlenecks:       topN(frame.bottlenecks,                                2),
      existingSolutions: topN(frame.existingSolutions,                          2),
      emergingTech:      topN([...frame.emergingTech, ...frame.platformShifts], 3),
      industries:        topN(frame.industries,                                 2),
      technologies:      topN(frame.technologies,                               3),
    },
    evidenceSnippets,
  }
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```

Expected: 0 TypeScript errors.

- [ ] **Step 3: Commit**

```
git add src/venture-scope/services/llmInputBuilder.ts
git commit -m "feat(vs): add llmInputBuilder — deterministic VentureScopeLLMInput packet builder"
```

---

## Task 3: Build `llmOutputParser.ts`

**Files:**
- Create: `src/venture-scope/services/llmOutputParser.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { VentureScopeLLMInput, VentureScopeLLMOutput } from '../types.js'

// ── Required output fields ────────────────────────────────────────────────────

const REQUIRED_FIELDS: ReadonlyArray<keyof VentureScopeLLMOutput> = [
  'title', 'tagline', 'opportunitySummary', 'problemStatement',
  'targetUser', 'proposedSolution', 'valueProp', 'whyNow',
  'buyerVsUser', 'currentAlternatives', 'existingWorkarounds',
  'keyAssumptions', 'successMetrics', 'pricingHypothesis',
  'defensibility', 'goToMarketAngle', 'mvpScope', 'risks',
]

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Structural validation of a raw chatJson() response.
 * Returns null if any required field is missing or is not a non-empty string.
 * Content-level validation is handled separately by validateLLMOutput().
 */
export function parseVentureScopeLLMOutput(
  raw: unknown,
): VentureScopeLLMOutput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const obj = raw as Record<string, unknown>

  for (const field of REQUIRED_FIELDS) {
    const val = obj[field]
    if (typeof val !== 'string' || val.trim().length === 0) {
      console.warn('[VS-LLM] parseVentureScopeLLMOutput: missing or empty field:', field)
      return null
    }
  }

  // All fields present and non-empty — cast is safe
  return obj as unknown as VentureScopeLLMOutput
}

// ── Validator ─────────────────────────────────────────────────────────────────

// Phrases that indicate the model drifted into generic AI-hype territory
const FILLER_PATTERNS: RegExp[] = [
  /\bAI (can|will|could) solve\b/i,
  /\bleverage (cutting[- ]edge|advanced AI|machine learning|AI)\b/i,
  /\bcutting[- ]edge (AI|technology|ML)\b/i,
  /\binnovative (AI|solution|technology)\b/i,
  /\bstate[- ]of[- ]the[- ]art\b/i,
  /\bseamlessly integrat/i,
  /\brobust (solution|platform|system)\b/i,
]

// Internal cluster ID patterns should never appear in narrative output
const ID_PATTERN = /cluster_[a-z0-9_]{6,}/i

// Narrative fields long enough to be meaningful checks
const NARRATIVE_FIELDS: ReadonlyArray<keyof VentureScopeLLMOutput> = [
  'opportunitySummary', 'problemStatement', 'proposedSolution',
  'valueProp', 'whyNow', 'defensibility', 'goToMarketAngle',
]

/**
 * Content-level validation of a parsed LLM output against its input context.
 * Returns a list of warning strings (empty array = clean).
 * Callers log warnings; if count ≥ 3 the output is discarded and the
 * deterministic fallback is used instead.
 */
export function validateLLMOutput(
  output: VentureScopeLLMOutput,
  _input: VentureScopeLLMInput,
): string[] {
  const warnings: string[] = []

  // Filler phrase detection — scan all narrative fields
  for (const field of NARRATIVE_FIELDS) {
    const text = output[field]
    for (const pattern of FILLER_PATTERNS) {
      if (pattern.test(text)) {
        warnings.push(`Filler phrase in "${field}" — matched: ${pattern.source}`)
        break  // one warning per field, avoid duplicate entries
      }
    }
  }

  // Internal ID leak check — cluster IDs must never appear in narrative text
  const allText = REQUIRED_FIELDS.map((f) => output[f]).join('\n')
  if (ID_PATTERN.test(allText)) {
    warnings.push('Internal cluster ID pattern detected in output — possible prompt injection')
  }

  // Minimum length sanity — suspiciously short narrative = likely truncated output
  for (const field of NARRATIVE_FIELDS) {
    if (output[field].trim().length < 30) {
      warnings.push(
        `Field "${field}" is suspiciously short (${output[field].length} chars) — likely truncated`,
      )
    }
  }

  return warnings
}
```

- [ ] **Step 2: Verify build**

```
npm run build
```

Expected: 0 TypeScript errors.

- [ ] **Step 3: Commit**

```
git add src/venture-scope/services/llmOutputParser.ts
git commit -m "feat(vs): add llmOutputParser — parse and validate VentureScopeLLMOutput"
```

---

## Task 4: Rewrite `generateWithOllamaFrame`

**Files:**
- Modify: `src/opportunity-radar/services/conceptGenerator.ts`

The legacy `generateWithOllama`, `parseSections`, `SECTION_KEYS`, and `generateConcept` (AppConcept path) are **not touched**. Only the VS-specific `generateWithOllamaFrame` function changes.

- [ ] **Step 1: Add new imports at the top of conceptGenerator.ts**

Change the current import block (lines 1–7):

```typescript
import type { OpportunityCluster, PainSignal, AppConcept } from '../types.js'
import type {
  VentureConceptCandidate,
  EvidenceTraceEntry,
  OpportunityFrame,
} from '../../venture-scope/types.js'
import { generateResponse } from '../../lib/llm/ollama.js'
```

To:

```typescript
import type { OpportunityCluster, PainSignal, AppConcept } from '../types.js'
import type {
  VentureConceptCandidate,
  EvidenceTraceEntry,
  OpportunityFrame,
  VentureScopeLLMOutput,
} from '../../venture-scope/types.js'
import { generateResponse, chatJson } from '../../lib/llm/ollama.js'
import { buildVentureScopeLLMInput } from '../../venture-scope/services/llmInputBuilder.js'
import { parseVentureScopeLLMOutput, validateLLMOutput } from '../../venture-scope/services/llmOutputParser.js'
```

- [ ] **Step 2: Replace the `generateWithOllamaFrame` function body (lines ~515–585)**

Replace the entire function (from `async function generateWithOllamaFrame(` to its closing `}`) with:

```typescript
// ── Graph-structured Ollama prompt (JSON-mode contract) ───────────────────────
//
// Replaces the legacy markdown-section format:
//   OLD: generateResponse() → parseSections() → Partial<Record<SectionKey, string>>
//   NEW: chatJson() → parseVentureScopeLLMOutput() → VentureScopeLLMOutput | null
//
// Input packet is built deterministically — no raw IDs or signal text
// reach the model. Falls back to null → callers use deterministic templates.

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
    // Hard reject on ≥ 3 warnings — output is likely low-quality or hallucinatory
    if (warnings.length >= 3) {
      console.warn('[VS-LLM] Too many warnings — falling back to deterministic')
      return null
    }

    return output
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Update variable name in `generateConcepts` for clarity**

In `generateConcepts` (around line 885), rename `ollamaSections` to `ollamaOutput`:

Change:
```typescript
  const ollamaSections = await generateWithOllamaFrame(
    frame,
    'persona_first',
    rank1Det.coreWedge,
  )

  const candidates: VentureConceptCandidate[] = [
    buildPersonaFirstCandidate(frame, now, 1, ollamaSections ?? null),
```

To:
```typescript
  const ollamaOutput = await generateWithOllamaFrame(
    frame,
    'persona_first',
    rank1Det.coreWedge,
  )

  const candidates: VentureConceptCandidate[] = [
    buildPersonaFirstCandidate(frame, now, 1, ollamaOutput ?? null),
```

- [ ] **Step 4: Verify build**

```
npm run build
```

Expected: 0 TypeScript errors. If the `.js` imports from TypeScript files trigger errors, check that `tsconfig.json` has `"moduleResolution": "bundler"` or `"node16"` — these imports already work in the rest of the codebase.

- [ ] **Step 5: Commit**

```
git add src/opportunity-radar/services/conceptGenerator.ts
git commit -m "feat(vs): rewrite generateWithOllamaFrame — JSON-mode contract replaces markdown sections"
```

---

## Task 5: Wire LLM output into candidate builders

**Files:**
- Modify: `src/opportunity-radar/services/conceptGenerator.ts`

All three builders get new fields populated. Only `buildPersonaFirstCandidate` takes an `ollama` param. The workflow-first and tech-enablement builders are fully deterministic but must now populate the same new optional fields on `VentureConceptCandidate`.

- [ ] **Step 1: Replace `buildPersonaFirstCandidate`**

Replace the entire function (lines ~589–684) with the following. The `ev` helper already exists above it in the file — do not add a duplicate.

```typescript
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
```

- [ ] **Step 2: Update `buildWorkflowFirstCandidate` — add workaround variable and new fields**

Inside `buildWorkflowFirstCandidate`, change the destructuring line from:
```typescript
  const {
    cluster, signals,
    workflows, bottlenecks, existingSolutions, personas, buyerRoles, industries,
  } = frame
```
To:
```typescript
  const {
    cluster, signals,
    workflows, bottlenecks, workarounds, existingSolutions, personas, buyerRoles, industries,
  } = frame
```

Add directly after the existing `const industry = ev(industries)` line:
```typescript
  const workaround = ev(workarounds)
```

Then add the following new fields to the returned object, immediately before the closing `}` of the return statement:

```typescript
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
```

- [ ] **Step 3: Update `buildTechEnablementCandidate` — add workaround/bottleneck variables and new fields**

Inside `buildTechEnablementCandidate`, change the destructuring line from:
```typescript
  const {
    cluster, signals,
    emergingTech, platformShifts, technologies, workflows,
    existingSolutions, personas, buyerRoles, industries,
  } = frame
```
To:
```typescript
  const {
    cluster, signals,
    emergingTech, platformShifts, technologies, workflows,
    workarounds, bottlenecks, existingSolutions, personas, buyerRoles, industries,
  } = frame
```

Add directly after the existing `const industry = ev(industries)` line:
```typescript
  const workaround = ev(workarounds)
  const bottleneck = ev(bottlenecks)
```

Then add the following new fields to the returned object, immediately before the closing `}` of the return statement:

```typescript
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
```

- [ ] **Step 4: Verify build**

```
npm run build
```

Expected: 0 TypeScript errors. Confirm the build completes cleanly — the new fields are all optional on `VentureConceptCandidate` so no existing consumers break.

- [ ] **Step 5: Commit**

```
git add src/opportunity-radar/services/conceptGenerator.ts
git commit -m "feat(vs): wire VentureScopeLLMOutput into candidate builders; add full new field set"
```

---

## Task 6: UI — generatedBy badge and per-concept regenerate button

**Files:**
- Modify: `src/components/venture-scope/tabs/BriefTab.jsx`
- Modify: `src/views/VentureScope.jsx`

- [ ] **Step 1: Add `GeneratedByBadge` component and regenerate button to BriefTab**

In `BriefTab.jsx`, add the following helper component before the `export default function BriefTab(...)` declaration:

```jsx
const GENERATED_BY_LABELS = {
  ollama:   { text: 'LLM synthesised',  color: 'rgba(20,184,166,0.7)'  },  // teal
  graph:    { text: 'Graph derived',    color: 'rgba(148,163,184,0.6)' },  // slate
  template: { text: 'Template',         color: 'rgba(148,163,184,0.4)' },  // muted
}

function GeneratedByBadge({ generatedBy }) {
  const config = GENERATED_BY_LABELS[generatedBy] ?? GENERATED_BY_LABELS.template
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded"
      style={{
        backgroundColor: 'rgba(255,255,255,0.05)',
        color: config.color,
        border: `1px solid ${config.color}`,
      }}
    >
      {config.text}
    </span>
  )
}
```

Add `RefreshCw` to the import at the top of the file:
```jsx
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import ScoreBar from '../ScoreBar.jsx'
```

Update the `BriefTab` function signature from:
```jsx
export default function BriefTab({ concept, candidates, onSelectCandidate, storeSlice, selectedCluster, entityGraph, allSignals }) {
```
To:
```jsx
export default function BriefTab({ concept, candidates, onSelectCandidate, storeSlice, selectedCluster, entityGraph, allSignals, onRegenerateConcept, isRegenerating }) {
```

In the title block, inside the `glass-panel`, update the badge row (the `<div className="flex items-center gap-2 mb-1">` section) from:
```jsx
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] uppercase tracking-widest" style={{ color: 'rgba(217,70,239,0.6)' }}>
            Venture Brief
          </span>
          {concept.angleType && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[color:var(--color-text-tertiary)] capitalize">
              {concept.angleType.replace('_', '-')}
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold leading-snug mb-1">{concept.title}</h2>
```
To:
```jsx
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest" style={{ color: 'rgba(217,70,239,0.6)' }}>
              Venture Brief
            </span>
            {concept.angleType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[color:var(--color-text-tertiary)] capitalize">
                {concept.angleType.replace(/_/g, '-')}
              </span>
            )}
            {concept.generatedBy && (
              <GeneratedByBadge generatedBy={concept.generatedBy} />
            )}
          </div>
          {onRegenerateConcept && (
            <button
              type="button"
              onClick={() => onRegenerateConcept(concept.clusterId)}
              disabled={isRegenerating}
              title="Regenerate brief from graph"
              className="p-1 rounded text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)] hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
        <h2 className="text-lg font-semibold leading-snug mb-1">{concept.title}</h2>
```

- [ ] **Step 2: Add `handleRegenerateConcept` to VentureScope.jsx**

Add `regenerating` state alongside the existing state declarations (around line 49):
```jsx
  const [regenerating, setRegenerating] = useState(false)
```

Add the handler function after the `scanRef` declaration and before `runScan`:
```jsx
  const handleRegenerateConcept = useCallback(async (clusterId) => {
    if (regenerating) return
    const cluster = clusters.find((c) => c.id === clusterId)
    if (!cluster) return
    setRegenerating(true)
    try {
      const frame = buildOpportunityFrame(cluster, signals, entityGraph)
      const candidates = await generateConcepts(frame, 3)
      for (const candidate of candidates) {
        saveVsConcept(candidate)
      }
      const allConcepts = loadVsConcepts()
      setVsConcepts(allConcepts)
      setSelectedCandidate(null)  // reset to rank-1 so the regenerated brief shows
    } catch (err) {
      console.error('[VentureScope] regenerate failed', err)
    } finally {
      setRegenerating(false)
    }
  }, [regenerating, clusters, signals, entityGraph])
```

Update the `BriefTab` usage in the JSX (around line 260) to pass the new props:
```jsx
        {activeTab === 'Brief' && (
          <BriefTab
            concept={leadingConcept}
            candidates={clusterCandidates}
            onSelectCandidate={setSelectedCandidate}
            storeSlice={storeSlice}
            selectedCluster={selectedCluster}
            entityGraph={entityGraph}
            allSignals={signals}
            onRegenerateConcept={handleRegenerateConcept}
            isRegenerating={regenerating}
          />
        )}
```

- [ ] **Step 3: Verify build**

```
npm run build
```

Expected: 0 TypeScript/JSX errors.

- [ ] **Step 4: Smoke test in the browser**

1. Open the app and navigate to Venture Scope → Brief tab
2. Confirm the generatedBy badge renders (teal "LLM synthesised" for ollama concepts, slate "Graph derived" for graph/template)
3. Confirm the regenerate button (↺) appears in the title block
4. Click regenerate — confirm the button spins and the brief updates after Ollama responds (or stays the same if Ollama is offline, with no error thrown)
5. Confirm offline / Ollama-unavailable scenario: regeneration completes silently and shows the deterministic concept

- [ ] **Step 5: Commit**

```
git add src/components/venture-scope/tabs/BriefTab.jsx src/views/VentureScope.jsx
git commit -m "feat(vs): add generatedBy badge and per-concept regenerate button to BriefTab"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|---|---|
| `VentureScopeLLMInput` type | Task 1 |
| `VentureScopeLLMOutput` type | Task 1 |
| `buildVentureScopeLLMInput()` pure function | Task 2 |
| `parseVentureScopeLLMOutput()` structural parser | Task 3 |
| `validateLLMOutput()` content guardrails | Task 3 |
| `chatJson` replaces `generateResponse` for VS path | Task 4 |
| Filler phrase detection | Task 3 |
| ID leak detection | Task 3 |
| Hallucination → fall back to deterministic | Task 4 (≥ 3 warnings → null → builders use fallbacks) |
| `VentureScopeLLMOutput` maps to all candidate fields | Task 5 |
| Deterministic fallbacks for every new field | Task 5 (all three builders) |
| Score drivers + evidence trace surface in Brief UI | Already live from Phases 2–3; these tasks don't regress them |
| generatedBy badge | Task 6 |
| Regenerate brief button | Task 6 |
| Legacy AppConcept path (`generateConcept`) untouched | Explicitly excluded from all tasks |

### Placeholder scan

No TBDs or TODOs in any task. All code blocks are complete. All fallback strings are specific, not generic.

### Type consistency

- `VentureScopeLLMOutput` fields match exactly between `types.ts` (Task 1), `REQUIRED_FIELDS` in parser (Task 3), system prompt schema (Task 4), and field access in `buildPersonaFirstCandidate` (Task 5).
- `buildVentureScopeLLMInput` returns `VentureScopeLLMInput`; `generateWithOllamaFrame` passes `frame.cluster` and `frame` to it — both satisfy the declared param types.
- `chatJson` is imported from `'../../lib/llm/ollama.js'` which already exports it (confirmed in codebase).
- `onRegenerateConcept: (clusterId: string) => void` matches the call `onRegenerateConcept(concept.clusterId)` — both strings.
