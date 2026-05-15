# Venture Scope — Logical Next Steps

## Overview

Venture Scope has now completed the inspectability layer across three shipped phases: source linkage, score-driver visibility, and OpportunityFrame inspectability.[cite:72]

That means the product now has a trustworthy internal structure for opportunity analysis:

- evidence can be traced back to source items,
- score dimensions can be explained,
- and the graph context behind a concept can be inspected directly.[cite:72]

The logical next step is to update **Flow.AI concept generation** so it consumes this new structured venture context rather than the older pain-signal-centric pipeline.[cite:72]

This is the highest-leverage next move because the underlying intelligence, evidence, and graph context are now stronger than the synthesis layer currently using them. If concept generation is not updated, Venture Scope will still partially behave like a renamed Opportunity Radar instead of a true venture intelligence workspace.[cite:72]

## Role

Flow.AI should act as a constrained synthesis layer on top of deterministic venture analysis, not as the primary source of scoring, ranking, or evidence interpretation.[cite:167]

## Goal

Replace the old “pain signals in, startup brief out” concept generation pattern with a new **venture synthesis contract** driven by OpportunityFrame, score drivers, evidence traces, and deterministic ranking inputs.[cite:72]

## Desired Outcome

After this next step, every generated venture brief should clearly reflect:

- the exact opportunity frame behind the concept,
- the strongest score drivers behind the opportunity,
- the highest-confidence evidence snippets and source types,
- and the deterministic structure already computed by Venture Scope.[cite:72]

The generated brief should feel more like evidence-backed venture analysis and less like generic AI idea generation.[cite:72][cite:78]

## Why this is the next step

The current Venture Scope architecture is now strong enough that Flow.AI should no longer be reasoning from raw or loosely grouped pain signals. The product already computes richer context than that.[cite:72]

The inspectability work created the necessary foundation:

- corpus-aware extraction,
- entity-semantic clustering,
- graph-aware scoring inputs,
- visible score drivers,
- source-linked evidence,
- and inspectable OpportunityFrame rendering.[cite:72]

Because these layers now exist, the synthesis layer should be upgraded next so the generated concept is based on the same structured context the UI exposes to the user.[cite:72]

## Product principle for the next phase

Venture Scope should remain **deterministic at the analysis layer** and use Flow.AI only for constrained synthesis, explanation quality, and venture-brief articulation.[cite:167]

That means:

- scoring stays deterministic,
- ranking stays deterministic,
- graph construction stays deterministic,
- evidence selection stays deterministic,
- Flow.AI writes on top of those facts rather than inventing them.[cite:72]

This keeps the product aligned with a trustworthy, premium, inspectable experience rather than drifting into opaque “AI startup generator” behavior.[cite:78]

## Core next-step deliverable

The next build should introduce a new **Venture Scope Flow.AI generation contract** composed of four parts:

1. A structured LLM input packet.
2. A new Flow.AI prompt framed around venture intelligence rather than pain mining.
3. A strict response schema for venture briefs.
4. Deterministic guardrails so generated prose cannot overwrite or contradict computed analysis.

## Phase 4 — Flow.AI input contract

### Objective

Create a new typed payload that becomes the only input Flow.AI receives during Venture Scope concept generation.

### New type

Recommended new type:

```ts
interface VentureScopeLLMInput {
  clusterId: string;
  clusterName: string;
  angleType: string;
  rank: number;
  confidenceScore: number;
  opportunityFrame: OpportunityFrame;
  dimensionScores: {
    painSeverity: number;
    frequency: number;
    urgency: number;
    willingnessToPay: number;
    marketBreadth: number;
    poorSolutionFit: number;
    feasibility: number;
    whyNow: number;
    defensibility: number;
    gtmClarity: number;
  };
  dimensionDrivers?: DimensionDriverMap;
  evidenceTrace?: EvidenceTraceEntry[];
  scoringSummary: {
    topStrengths: string[];
    topRisks: string[];
    whyNowSignals: string[];
  };
  sourceBreakdown: {
    sourceType: string;
    count: number;
  }[];
}
```

### Required inputs

The payload should include:

- `OpportunityFrame` from the exact same builder used by Venture Scope during generation and UI rendering.[cite:72]
- top dimension scores already computed deterministically.[cite:72]
- driver summaries for the highest-impact dimensions.[cite:72]
- top evidence trace entries with source type and snippet.[cite:72]
- a compact scoring summary derived from deterministic logic, not LLM inference.

### Important rule

Flow.AI should never infer or recompute scores. It should receive them as established inputs and use them only for interpretation and structured synthesis.[cite:167]

## Phase 5 — Prompt redesign

### Objective

Rewrite the Venture Scope generation prompt so it reflects the new product model.

### Old framing to remove

The old framing is roughly:

- Here are pain signals.
- Generate a startup brief.

That framing keeps Venture Scope tied to the old Opportunity Radar mental model.[cite:72]

### New framing

The new prompt should effectively say:

> You are analyzing a structured venture opportunity packet produced by Venture Scope. The packet contains a graph of personas, workflows, bottlenecks, workarounds, technologies, platform shifts, score drivers, and source-backed evidence. Do not recompute or change the scores. Do not invent users, workflows, or evidence not supported by the packet. Use the packet to synthesize a high-quality venture brief in the exact required schema.

### Prompt constraints

The prompt should explicitly instruct Flow.AI to:

- treat the scores as fixed,
- treat the evidence trace as authoritative,
- avoid adding unsupported claims,
- avoid generic startup language,
- avoid broad “AI can solve this” filler,
- generate concise but high-quality brief sections,
- and preserve the tone of a serious product strategy artifact rather than a hype document.[cite:78]

### Prompt anti-patterns to forbid

- “This massive market is ripe for disruption.”
- “AI-powered all-in-one platform” without evidence.
- invented buyer roles or revenue assumptions.
- suggesting features not supported by the workflow and problem frame.
- generic why-now language disconnected from actual platform shifts or emerging technology signals.

## Phase 6 — Response schema

### Objective

Make Flow.AI return a strict, parseable venture brief structure.

### Recommended schema

The output should map directly into the Venture Scope concept model.

```ts
interface VentureScopeLLMOutput {
  opportunitySummary: string;
  problemStatement: string;
  targetUsers: string[];
  buyerVsUser?: string;
  proposedSolution: string;
  valueProposition: string;
  keyUseCases?: string[];
  mvpScope: string[];
  risks: string[];
  implementationPlan: string[];
  whyNow?: string;
  currentAlternatives?: string[];
  defensibility?: string;
  goToMarketAngle?: string;
  pricingHypothesis?: string;
  keyAssumptions?: string[];
}
```

### Response rules

- The output must preserve field order.
- Every required field must always be present.
- Optional fields should still return empty arrays or empty strings rather than disappearing.
- The parser should not depend on prose formatting drift.
- If Ollama is unavailable, deterministic fallback logic can still populate the same structure using existing structured values.[cite:72]

## Phase 7 — Guardrails and fallback behavior

### Objective

Prevent Flow.AI from weakening Venture Scope’s deterministic foundation.

### Guardrails

- Deterministic fields remain source-of-truth: scores, rank, confidence, drivers, evidence trace, source breakdown.[cite:72]
- Flow.AI can write narrative sections, but it should not override deterministic values.
- Generated fields should be validated against the input packet before save.
- If the output is malformed, empty, or contradictory, the system should fall back to deterministic brief assembly instead of storing low-quality text.

### Validation checks

Before saving the result:

- ensure required sections exist,
- ensure no section is blank unless explicitly allowed,
- ensure unsupported technologies or personas were not hallucinated,
- ensure the generated solution still maps to the input opportunity frame,
- ensure the why-now section references actual shifts or enabling signals when present.

## Phase 8 — UI and UX alignment

### Objective

Make the generated brief feel visibly tied to the underlying venture evidence.

### UI updates

The brief experience should visually reinforce that the generated concept came from Venture Scope’s structured reasoning.

Recommended updates:

- show the selected angle type near the concept title,
- show top score strengths above or beside the generated summary,
- show a compact “Generated from graph context + score drivers + evidence trace” badge or helper line,
- add a “regenerate brief” action that keeps the same packet but refreshes only the prose,
- keep evidence trace and Graph Context visible in the same tab flow so users can validate the synthesis quickly.[cite:72][cite:78]

### UX principle

The brief should feel like the final layer of a reasoning stack, not a detached AI answer.[cite:78]

## Suggested implementation order

| Order | Workstream | Purpose |
|---|---|---|
| 1 | Define `VentureScopeLLMInput` | Lock the new generation contract |
| 2 | Build packet assembly helper | Convert cluster + frame + scores + drivers + trace into one object |
| 3 | Rewrite Flow.AI prompt | Shift from pain framing to venture framing |
| 4 | Define `VentureScopeLLMOutput` parser | Make generated briefs reliable |
| 5 | Add validation + fallback | Prevent malformed or weak outputs |
| 6 | Wire into `conceptGenerator.ts` | Replace old generation path |
| 7 | Update Brief UI cues | Show the synthesis is grounded in structured context |

## Implementation plan

### Step 1 — Define the packet builder

Create a dedicated function such as:

```ts
buildVentureScopeLLMInput({
  cluster,
  opportunityFrame,
  dimensionScores,
  dimensionDrivers,
  evidenceTrace,
}): VentureScopeLLMInput
```

This function should:

- normalize all inputs into a stable structure,
- trim overly long snippets,
- select the most important drivers,
- preserve deterministic ranking metadata,
- and guarantee a predictable payload for Flow.AI.

### Step 2 — Replace old prompt framing

Refactor the generation prompt in `conceptGenerator.ts` or the Ollama service layer so it explicitly references:

- venture graph,
- score dimensions,
- score drivers,
- evidence trace,
- and exact output schema.

### Step 3 — Add parser and validator

The output parser should:

- parse structured JSON when possible,
- validate required fields,
- reject malformed outputs,
- and fall back safely.

### Step 4 — Preserve deterministic concept metadata

The LLM-generated prose should fill only narrative fields. The concept’s ID, rank, confidence, dimension scores, evidence trace, and linkage metadata should remain deterministic and stored separately from generated prose.[cite:72]

### Step 5 — UI grounding improvements

Add small but meaningful UI cues so the user knows the concept was produced from Venture Scope reasoning rather than freeform generation.[cite:78]

## Acceptance criteria

- Flow.AI no longer receives raw pain-signal lists as its primary input.
- Every concept brief is generated from a structured `VentureScopeLLMInput` packet.
- The prompt treats scores and evidence as authoritative inputs, not suggestions.
- The output maps cleanly into the Venture Scope concept schema.
- Malformed or contradictory outputs are rejected or replaced by deterministic fallback assembly.
- The generated brief clearly aligns with the visible OpportunityFrame, dimension drivers, and evidence trace already shown in the UI.[cite:72]
- The new experience feels more like structured venture analysis than generic AI concept generation.[cite:78]

## Out of scope

These are important but should not be bundled into the immediate next step:

- score-driver click-through to sources,
- historical comparison of multiple generated brief revisions,
- persistent storage of OpportunityFrame snapshots across scans,
- multi-brief A/B generation for the same packet,
- external enrichment from outside the FlowMap corpus,
- new clustering or scoring model redesign.

## Recommended instruction to Claude Code

Use this as the implementation boundary:

> Implement the next Venture Scope phase by replacing the old Flow.AI concept-generation contract with a new structured generation contract driven by OpportunityFrame, dimension scores, dimension drivers, and evidence trace. Keep scoring, ranking, evidence, and linkage deterministic. Use Flow.AI only for constrained synthesis into a strict venture-brief schema. Stop after the implementation plan unless explicitly approved to code.

## Final recommendation

The inspectability foundation is now in place. The logical next step is not more UI inspection or more scoring work. It is updating the synthesis layer so Venture Scope’s generated concepts finally reflect the quality of the venture analysis now happening underneath them.[cite:72]
