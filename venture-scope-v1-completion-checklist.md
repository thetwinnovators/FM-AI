# Venture Scope v1 Completion Checklist

## Overview

This document defines the practical completion criteria for **Venture Scope v1**.

Venture Scope should be considered complete for v1 when its ingestion, clustering, scoring, inspectability, and concept-generation layers work together as one coherent venture intelligence workflow rather than as a renamed Opportunity Radar flow.[cite:72]

The goal is not to finish every future enhancement. The goal is to reach a stable, credible, inspectable first version that produces grounded venture briefs from real FlowMap corpus data.[cite:72]

## v1 definition

Venture Scope v1 is complete when it can:

- ingest internal FlowMap knowledge sources,
- extract structured venture entities and relationships,
- cluster and score opportunity spaces,
- expose evidence and graph context clearly,
- and generate a grounded venture brief that reflects the same structured context shown in the UI.[cite:72][cite:78]

## 1. Ingestion and extraction

### Required

- Corpus-first ingestion is active for core FlowMap sources such as saves, documents, manual content, topic summaries, and briefs.[cite:72]
- Extraction is corpus-aware and does not rely on simplistic social pain-language heuristics for internal knowledge sources.[cite:72]
- The extraction layer identifies useful venture entities including personas, workflows, workarounds, technologies, bottlenecks, buyer roles, existing solutions, industries, platform shifts, and emerging technologies.[cite:72]
- Entity relationships are built into a graph structure that can be reused by downstream ranking and synthesis.[cite:72]

### Done check

- Running a real scan produces structured entity output, not just topic keywords.
- Extracted entities feel venture-relevant and reusable across scoring and brief generation.

## 2. Clustering and scoring

### Required

- Clustering uses both text and entity/graph context rather than relying only on loose keyword similarity.[cite:72]
- Cluster naming reads like opportunity spaces, not generic term piles.[cite:72]
- Opportunity scoring uses the full dimension model: pain severity, frequency, urgency, willingness to pay, market breadth, poor solution fit, feasibility, why now, defensibility, and GTM clarity.[cite:72]
- Corpus-aware factors such as platform shifts, buyer roles, bottlenecks, existing solutions, and emerging technologies contribute to scoring where appropriate.[cite:72]
- `isBuildable` is derived from the authoritative buildability logic rather than inferred from one dimension score.[file:210]

### Done check

- Top-ranked clusters generally align with qualitative judgment when reviewed manually.
- Scores feel explainable and not arbitrary.

## 3. Inspectability

### Required

- Evidence trace exists for generated concepts and can point back to original FlowMap records where resolution is possible.[file:210]
- Dimension score drivers are visible in the Scores tab and reflect the same logic used by the scorer.[file:210]
- OpportunityFrame graph context is visible in the Brief tab and is built from the same frame-generation logic used during synthesis.[file:210]
- Sparse graph states degrade cleanly using limited-context messaging rather than misleading weak relationship tables.[file:210]
- No raw IDs, raw JSON, or internal implementation fields are exposed in the user-facing interface.[file:210]

### Done check

- A user can inspect a concept and understand why it exists.
- A user can inspect a score and understand what drove it.
- A user can inspect evidence and navigate back to meaningful source material when available.

## 4. Flow.AI synthesis

### Required

- Concept generation no longer depends primarily on raw pain-signal lists.[cite:72]
- Flow.AI receives a structured venture packet built from:
  - selected cluster,
  - OpportunityFrame,
  - dimension scores,
  - dimension drivers,
  - evidence trace,
  - and source breakdown.[cite:72]
- The prompt explicitly treats deterministic scores and evidence as authoritative inputs rather than asking the model to infer them.[cite:72]
- The prompt frames the task as venture synthesis from structured graph context rather than generic startup ideation.[cite:72]
- The model outputs a strict venture brief schema with fixed fields and stable parsing behavior.[cite:72]
- Validation and fallback behavior exist so malformed or contradictory outputs do not become the saved concept by default.[cite:72]

### Done check

- Generated concepts clearly reflect the visible graph context and evidence.
- Regeneration changes phrasing or narrative quality without changing deterministic facts.
- The brief feels grounded, not hallucinated.

## 5. Venture brief quality

### Required

Each generated concept should include a complete brief structure with fields such as:

- Opportunity Summary
- Problem Statement
- Target User(s)
- Proposed Solution
- Value Proposition
- MVP Scope
- Risks
- Implementation Plan
- Why Now
- Current Alternatives
- Defensibility
- Go-to-Market Angle

The exact schema can vary slightly, but the product should present a stable venture-brief artifact rather than freeform AI prose.[cite:72]

### Done check

- Briefs read like product strategy artifacts, not generic AI output.
- Sections are complete, specific, and consistent across runs.

## 6. UI and UX completion

### Required

- The Venture Scope interface feels like a venture intelligence workspace, not a signal feed or radar board.[cite:72]
- The Brief tab clearly connects concept output to graph context, evidence, and score reasoning.[file:210]
- The experience feels trustworthy, premium, and inspectable rather than vibe-coded or overly abstract.[cite:78]
- Empty, sparse, and legacy states degrade safely without confusing or misleading output.[file:210]

### Done check

- The product communicates confidence and clarity.
- The user does not need to guess how a concept was generated.

## 7. Persistence and compatibility

### Required

- Stable concept IDs remain intact across rescans.[cite:72]
- Rescans update clusters and concepts without creating unnecessary duplication where upsert behavior already exists.[cite:72]
- New fields introduced for inspectability or synthesis remain backward-compatible where possible.[file:210]
- Legacy clusters without newly added fields still render safely.[file:210]

### Done check

- Existing stored data does not break the interface.
- New scans enrich the system without requiring fragile migration work for v1.

## 8. v1 acceptance test

Venture Scope v1 should pass this practical test:

1. Run a scan on real FlowMap corpus content.
2. Review the resulting clusters.
3. Confirm the top clusters resemble real opportunity spaces.
4. Open the Scores tab and confirm the dimension drivers are understandable and plausible.
5. Open the Brief tab and confirm the concept brief aligns with the graph context and evidence trace.
6. Regenerate the brief and confirm that the narrative can change without changing deterministic facts.
7. Confirm the user-facing experience contains no broken empty states, unexplained scores, raw IDs, or debug-style artifacts.[file:210][cite:72]

If this test passes consistently, Venture Scope is complete enough to be called **v1 complete**.

## v1 complete means

Venture Scope v1 is complete when it functions as an end-to-end pipeline:

- corpus knowledge in,
- structured venture analysis in the middle,
- inspectable evidence and graph reasoning throughout,
- grounded venture brief out.[cite:72]

That is the correct stopping point for v1.

## Not required for v1

These are useful but should not block v1 completion:

- score-driver click-through from every pill to every source record,[file:210]
- concept revision history and version diffing,[file:210]
- persisted OpportunityFrame snapshots across scan history,[file:210]
- graph compounding across scans beyond current rebuild logic,[file:210]
- multi-brief comparison workflows,
- external enrichment beyond the FlowMap corpus.[cite:72]

These belong in v1.1 or later, not in the v1 completion gate.

## Final completion rule

If Venture Scope can reliably produce a traceable, explainable, graph-backed venture brief from internal FlowMap knowledge without feeling like old Opportunity Radar, it is done for v1.[cite:72][cite:78]
