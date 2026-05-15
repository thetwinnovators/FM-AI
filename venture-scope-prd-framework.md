# Venture Scope PRD + Flow.AI Framework

## Overview

Venture Scope is a new product concept inside FlowMap that replaces the old Opportunity Radar framing with a more intentional, structured, and intelligence-first experience.[cite:153][cite:155]

It should not look, behave, or be positioned like the previous Opportunity Radar. Opportunity Radar implied a generic signal feed or pain-point scanner. Venture Scope should instead function as a venture intelligence workspace that transforms FlowMap’s internal research corpus into a durable knowledge graph, then uses Flow.AI to identify, score, compare, and explain promising product opportunities.[cite:153][cite:160][cite:164]

The product should feel like a high-clarity strategy environment for opportunity discovery, not a noisy feed of loosely ranked signals. Its core value is not “finding random opportunities” but converting curated research into structured venture intelligence with evidence, scoring, ROI framing, and implementation-ready concept briefs.[cite:158][cite:160]

## Product Vision

Venture Scope should help a founder, builder, strategist, or operator turn collected research into actionable venture opportunities by extracting structured signals from FlowMap’s own knowledge corpus and organizing them into a reasoning-ready intelligence layer.[cite:156][cite:158]

The product vision is:

> Venture Scope transforms the research stored in FlowMap’s My Topics and My Documents into a durable venture knowledge graph of problems, workflows, personas, technologies, use cases, and market patterns. Flow.AI then analyzes this graph to surface, rank, and explain high-potential product opportunities with detailed briefs, ROI rationale, and execution guidance.

## Core Product Thesis

FlowMap’s **My Topics** and **My Documents** are the primary source of venture signals. Venture Scope should extract structured entities, patterns, evidence, and relationships from topic summaries, videos, articles, PDFs, posts, briefs, saved items, notes, and other internal content rather than relying primarily on external web scraping.[cite:158][cite:160]

These extracted signals should be stored in a durable Flow Maps knowledge graph that compounds over time. Flow.AI should reason across the graph to identify underserved workflows, repeated pain, changing technology conditions, weak incumbent solutions, and promising white-space opportunities.[cite:89][cite:164]

## Problem Statement

The current Opportunity Radar concept is too narrow and too generic for the product direction FlowMap is moving toward. It emphasizes vague signal discovery and pain-point mining rather than durable knowledge creation, traceable reasoning, and strategic opportunity evaluation.[cite:153][cite:159]

This creates several problems:

- The experience feels closer to a feed than a strategic workspace.
- The extraction model is too shallow to support high-quality opportunity reasoning.
- The interface risks becoming busy and confusing if too many weak signals are shown without structure.[cite:160]
- The resulting concepts are less trustworthy when source lineage, scoring logic, and ROI explanation are weak or missing.[cite:153][cite:160]

Venture Scope is meant to solve those issues by replacing the old mental model completely.

## Product Goals

### Primary Goals

- Build a venture intelligence layer on top of FlowMap’s internal corpus.[cite:158][cite:160]
- Convert unstructured research into structured entities, relationships, and opportunity signals.[cite:89][cite:164]
- Generate evidence-backed venture concepts instead of one-off idea suggestions.[cite:153]
- Present opportunities in a calm, structured, decision-ready interface with ranked scoring and clear rationale.[cite:160]
- Preserve extracted knowledge over time so the system compounds rather than resets.[cite:164]

### Secondary Goals

- Enable comparison between multiple opportunities.
- Surface ROI assumptions and scenario thinking more clearly.
- Make Flow.AI outputs easier to audit, refine, and trust.
- Create a foundation for later external enrichment without depending on it.

### Non-Goals

- Do not build another generic trend feed.
- Do not prioritize broad web scraping as the primary source of truth.
- Do not overload the UI with raw signals and weakly explained metrics.
- Do not position the feature as “AI startup idea generation.”

## Target Users

| User Type | Primary Need | How Venture Scope Helps |
|---|---|---|
| Independent founder | Identify serious opportunities worth building | Converts existing research into ranked, explainable opportunity briefs |
| Product builder | Move from research to clear product concept | Connects evidence, scoring, and implementation planning |
| Strategist / operator | Compare problem spaces and solution gaps | Surfaces relationships across workflows, pain points, and technologies |
| Research-heavy creator | Turn saved materials into reusable intelligence | Preserves extracted knowledge and graph structure over time |

## Venture Scope vs Opportunity Radar

| Dimension | Old Opportunity Radar | Venture Scope |
|---|---|---|
| Core metaphor | Signal feed / pain-point scanner | Venture intelligence workspace |
| Primary source | External signals and loose discovery | Internal FlowMap corpus first |
| Main unit of value | Signals | Structured venture opportunities |
| Knowledge model | Temporary or shallow extraction | Durable knowledge graph |
| Concept output | Single loosely framed ideas | Ranked, explainable, evidence-backed concepts |
| UX style | Potentially busy and feed-like | Structured, calm, decision-oriented |
| Reasoning | Limited | Multi-step Flow.AI synthesis and stress testing |

## Product Architecture

Venture Scope should be built as a five-layer system.[cite:89][cite:164]

| Layer | Role | Output |
|---|---|---|
| Source Layer | My Topics and My Documents provide research corpus | Source items |
| Content Layer | Summaries, PDFs, videos, articles, posts, briefs, notes, saved items | Parsed content objects |
| Extraction Layer | Entity and relationship extraction with evidence spans | Structured venture signals |
| Knowledge Graph Layer | Durable graph with lineage, versioning, and states | Venture intelligence graph |
| Flow.AI Synthesis Layer | Opportunity analysis, scoring, comparisons, concept generation, reports | Ranked venture briefs |

## Data Sources

Venture Scope should treat these as first-class source inputs:

- My Topics
- My Documents
- Topic summaries
- Saved articles
- Saved videos
- PDFs
- Posts
- Generated briefs
- Manual content
- Notes and metadata attached to source items

External research can later enrich the system, but it should remain secondary to the internal FlowMap corpus.

## Extraction Schema

The extraction engine should classify a much broader set of venture-relevant signals than the current build.

### Problem and Need Signals

- Pain points
- Challenges
- Bottlenecks
- Constraints
- Frictions
- Unmet needs
- Jobs-to-be-done
- Desired outcomes
- Repeated complaints
- Failure points
- Workarounds
- Operational inefficiencies

### User and Organization Signals

- Personas
- Buyer roles
- User roles
- Team functions
- Company types
- Company size
- Industry
- Niche segments
- Decision-makers
- Stakeholders

### Workflow and Context Signals

- Workflows
- Processes
- Process steps
- Trigger events
- Inputs and outputs
- Handoffs
- Dependencies
- Compliance constraints
- Collaboration patterns
- Time-sensitive tasks

### Solution and Market Signals

- Existing products
- Existing features
- Manual substitutes
- Current approaches
- Competitive alternatives
- Problems being solved
- Use cases being solved
- Value propositions
- Delivery models
- Pricing patterns

### Change and Innovation Signals

- Emerging technologies
- Platform shifts
- New methods
- New concepts
- New approaches
- Regulatory changes
- Behavioral changes
- Industries adopting new technologies
- New business models
- Newly enabled capabilities

## Relationship Model

The knowledge graph should preserve relationships between entities so Flow.AI can reason over context rather than isolated tags.[cite:89][cite:164]

Recommended relationship types:

- Persona -> experiences -> pain point
- Persona -> performs -> workflow
- Buyer role -> evaluates -> solution
- Workflow -> contains -> process step
- Process step -> creates -> bottleneck
- Company type -> operates in -> industry
- Organization -> uses -> tool
- Tool -> solves -> use case
- Tool -> fails on -> use case
- Problem -> solved today by -> workaround
- Workaround -> signals -> unmet opportunity
- Industry -> adopts -> technology
- Technology -> enables -> approach
- Value proposition -> targets -> persona
- Source item -> supports -> entity or relationship

## Source Lineage Requirements

Every extracted entity, relationship, score input, and generated opportunity must carry source lineage back to the FlowMap record that produced it. Anonymous graph data should not exist in Venture Scope because trust depends on traceability.[cite:153][cite:160]

Each extracted object should include:

- `sourceId`
- `sourceType`
- `topicId` when applicable
- `documentId` when applicable
- `evidenceSnippet`
- `extractedAt`
- `extractorVersion`

## Persistence, Retention, and Versioning

Venture Scope should treat extracted intelligence as durable user-owned knowledge. Data should never disappear automatically. The graph should compound over time unless the user explicitly chooses deletion.[cite:164]

### Core Persistence Rule

All extracted entities, relationships, signals, evidence links, graph revisions, opportunity scores, and generated briefs must be saved in the knowledge graph and retained over time. The system should never auto-delete or destructively overwrite these records.

### Required Record States

| State | Meaning |
|---|---|
| Active | Current live record |
| Superseded | Older version retained after refinement |
| Archived | Hidden from default views but preserved |
| Deleted | User-requested deletion, reversible within a recovery window |
| Hard Deleted | Permanently removed only after explicit confirmation |

### Persistence Behaviors

- Rescans must not wipe previous knowledge.
- New extractions may refine prior records but should preserve history.
- Deleted source items should trigger clear deletion options, not silent graph removal.
- All mutation events should be auditable.

## Flow.AI Framework

Flow.AI is the reasoning and synthesis engine behind Venture Scope. Its job is not to generate random startup ideas. Its job is to analyze the venture graph, identify meaningful white space, compare candidate concepts, and produce decision-ready opportunity outputs.[cite:153][cite:159]

### Flow.AI Operating Principles

- Map before ideate.
- Structure before summarize.
- Evidence before recommendation.
- Multiple candidate concepts before final selection.
- Preserve history instead of overwriting previous interpretations.
- Explain ranking, not just outcomes.

### Flow.AI Reasoning Loop

#### Phase 1: Opportunity Mapping

- Cluster recurring patterns.
- Group signals by persona, workflow, industry, and use case.
- Separate root problems from symptoms.
- Identify where current solutions are expensive, fragmented, or weak.

#### Phase 2: White-Space Analysis

- Find intersections of repeated pain + weak incumbents + enabling technology.
- Detect underserved personas or segments.
- Detect workflow gaps across teams, tools, or handoffs.
- Detect “why now” conditions created by platform or technology changes.

#### Phase 3: Candidate Concept Generation

For each strong cluster, generate multiple candidate product concepts instead of only one.

Each candidate should define:

- Product concept
- Primary user
- Buyer
- Workflow improvement
- Core wedge
- Why-now rationale
- Complexity estimate
- Revenue model hypothesis

#### Phase 4: Stress Testing and Selection

- Score each candidate against the opportunity model.
- Test whether it solves a root problem.
- Test whether the MVP is narrow and buildable.
- Test whether the distribution path is believable.
- Test defensibility.
- Preserve alternates even after selecting a leading concept.

## Opportunity Scoring Model

Venture Scope should replace the current shallow scoring system with a richer multi-factor venture evaluation model.

| Dimension | What It Measures |
|---|---|
| Pain Severity | How painful and persistent the problem is |
| Frequency | How often the issue appears across sources |
| Urgency | How quickly relief is needed |
| Willingness to Pay | Evidence of budget or economic pressure |
| Market Breadth | Number of relevant users, firms, or segments |
| Weak Solution Fit | How poor current alternatives are |
| Feasibility | Whether an MVP is realistically buildable now |
| Why Now | Whether market or technology changes create timing advantage |
| Defensibility | Potential for sustained advantage |
| GTM Clarity | How clearly the first users can be reached |

### Scoring Principles

- Every score must be explainable in plain language.
- Every score must be source-backed.
- Users should see both the composite rank and the dimension-level breakdown.
- Confidence should be separated from score so uncertainty is visible.
- Ranking should compare opportunities against one another, not show isolated numbers only.

## ROI Model

Venture Scope should frame ROI as an explicit reasoning layer, not a vague promise. ROI visuals and assumptions should help the user understand why a concept may be worth pursuing.[cite:153][cite:155]

The ROI model should support:

- Estimated value creation
- Estimated cost to build
- Estimated time to MVP
- Estimated cost of current problem
- Efficiency gain potential
- Revenue potential scenarios
- Payback period framing
- Confidence bands for assumptions

The goal is not financial precision at early stage but structured venture reasoning.

## Standard Venture Brief Output

When Flow.AI selects a leading concept, Venture Scope should generate a detailed brief with this required structure:

- Opportunity Summary
- Problem Statement
- Target User(s)
- Proposed Solution
- Value Proposition
- MVP Scope
- Risks
- Implementation Plan

## Expanded Venture Brief Fields

For stronger decision quality, the brief should also include:

- Why Now
- Buyer vs User
- Current Alternatives
- Existing Workarounds
- Key Use Cases
- Key Assumptions
- Success Metrics
- Pricing Hypothesis
- ROI Model
- Defensibility
- Go-to-Market Angle
- Evidence Trace
- Ranked Score Breakdown

## UX Strategy

The Venture Scope experience should be calm, deliberate, and decision-oriented. It should feel more like a strategic analysis workspace than a social feed, trend board, or signal dashboard.[cite:160]

### UX Principles

- Clarity over density
- Structured hierarchy over feed-like browsing
- Evidence-first interaction design
- Progressive disclosure over information dumping
- Calm visual language over noisy intelligence aesthetics
- Explanation over mystery

### UX Goals

- The user should understand the top opportunity within seconds.
- The user should know why it ranked highly.
- The user should be able to inspect evidence without getting lost.
- The user should be able to compare candidate opportunities clearly.
- The user should be able to move from research to action.

## UI Strategy

Venture Scope should not reuse the mental model or visual behavior of Opportunity Radar. It should be designed as a new product surface with a more serious and composed structure.[cite:160]

### Top-Level Navigation Model

The primary Venture Scope surface should be organized into these tabs or sections:

- Overview
- Signals
- Scores
- Evidence
- Brief
- Compare

### Screen Structure

#### Overview

- Top ranked opportunities
- Summary metrics
- Key venture insight
- Confidence snapshot

#### Signals

- Structured entity groups
- Signal clusters by workflow, persona, industry, and technology
- Pattern highlights

#### Scores

- Ranked opportunity list
- Multi-dimension score breakdown
- Dimension explanations in plain language
- Confidence and rationale

#### Evidence

- Source lineage list
- Evidence snippets
- Topic/document back-references
- Cluster provenance

#### Brief

- Full selected venture brief
- Risks, ROI, MVP scope, implementation plan
- Alternate concepts section

#### Compare

- Side-by-side comparison of candidate opportunities
- Ranked deltas by dimension
- Trade-offs across ROI, feasibility, and defensibility

## Data Visualization Strategy

Visuals should be used to clarify reasoning, not decorate the interface.[cite:160]

Recommended visuals:

- Ranked horizontal bar chart for opportunity comparison
- Score breakdown bars by dimension
- Trend line for signal frequency or momentum
- ROI scenario chart or waterfall framing
- Evidence table with source counts, confidence, and lineage
- Cluster map for opportunity themes where useful

### Visualization Rules

- One visual should answer one question.
- Every chart must have clear labels and interpretation text.
- Avoid decorative complexity.
- Use restrained color with consistent semantic meaning.
- Use tables when comparison is more important than visual drama.

## Information Architecture Requirements

To avoid the old busy and confusing feel, Venture Scope should follow these information architecture rules:

- Put summary first and evidence second.
- Limit the number of competing cards shown at once.
- Collapse details by default.
- Keep visual styles consistent across score, evidence, and report modules.
- Use clear empty, loading, and low-confidence states.
- Distinguish clearly between extracted signals, inferred opportunities, and generated concepts.

## Functional Requirements

### Ingestion and Internal Corpus Scan

- Read from `saves`, `documents`, `manualContent`, `topicSummaries`, and `briefs` from the existing store.
- Normalize them into a shared raw record format.
- Feed them into the extraction pipeline as the primary signal source.
- Preserve source lineage.
- Avoid CORS or external dependency issues for core operation.

### Extraction and Graph Build

- Support broader schema categories.
- Save entities and relationships with source references.
- Support idempotent rescans.
- Preserve historical states.
- Track extractor version.

### Scoring and Selection

- Score venture opportunities across all 10 dimensions.
- Compare multiple concepts per cluster.
- Rank opportunities globally and within topic clusters.
- Separate confidence from score.

### Report Generation

- Generate a detailed venture brief.
- Include score rationale.
- Include ROI assumptions.
- Include evidence trace.
- Include charts and structured tables.

## Non-Functional Requirements

- Clean and responsive UI
- Reliable local-first source scanning
- Durable storage and graph persistence
- Auditable lineage and record history
- Explainable outputs
- Low-clutter interaction design
- Fast rescans of existing internal corpus

## Success Metrics

| Metric | Definition |
|---|---|
| Corpus Coverage | Percentage of relevant internal content scanned successfully |
| Extraction Quality | Precision and usefulness of extracted entities and relationships |
| Lineage Coverage | Percentage of extracted objects with valid source references |
| Opportunity Usefulness | User-rated usefulness of surfaced venture briefs |
| Explanation Clarity | User-rated understanding of scores and rationale |
| Time to Insight | Time from source corpus to first usable ranked brief |
| Report Completeness | Percentage of reports including scores, ROI, and evidence trace |

## Complete Implementation Plan

### Phase 1: Rebrand and Reframe

- Rename Opportunity Radar to Venture Scope across product copy, navigation, routes, component labels, and generated artifacts.
- Remove feed-like framing and outdated pain-point language.
- Introduce new positioning language centered on venture intelligence and structured opportunity analysis.

### Phase 2: Internal Corpus Adapter

- Build the internal corpus scan adapter as the new primary signal source.
- Read from existing FlowMap stores and normalize records into a shared raw input shape.
- Replace the old external-first source assumption.
- Preserve source metadata and identifiers.

### Phase 3: Schema Expansion

- Extend extraction from the current limited entities to the broader Venture Scope schema.
- Add jobs-to-be-done, bottlenecks, buyer roles, company types, process steps, trigger events, emerging technologies, platform shifts, and related venture signals.
- Add evidence spans and extraction version metadata.

### Phase 4: Lineage and Persistence Layer

- Add `sourceId`, `sourceType`, `topicId`, `documentId`, and evidence snippet support.
- Add graph states: Active, Superseded, Archived, Deleted, Hard Deleted.
- Ensure rescans preserve graph history instead of overwriting.
- Add audit logging for graph mutations.

### Phase 5: Multi-Candidate Concept Engine

- Update Flow.AI to generate multiple concepts per opportunity cluster.
- Add concept stress-testing against the scoring model.
- Preserve alternate concepts for comparison.

### Phase 6: Scoring Model Upgrade

- Replace the current shallow scoring logic with the 10-dimension venture model.
- Add weighted scoring and confidence values.
- Add plain-language explanations for each dimension.
- Add comparison logic between opportunity candidates.

### Phase 7: Venture Scope UI

- Build a new interface that does not inherit the old Opportunity Radar visual or interaction model.
- Create new tabs for Overview, Signals, Scores, Evidence, Brief, and Compare.
- Add ranked comparison charts and calm scorecards.
- Use progressive disclosure for detail views.

### Phase 8: Reporting and Visuals

- Generate full venture reports with score breakdowns, ROI sections, and evidence trace.
- Add charts and tables that clarify, not clutter.
- Ensure reports are easy to scan and decision-ready.

### Phase 9: Validation and Refinement

- Test extraction quality on real FlowMap topics and documents.
- Review lineage coverage and graph persistence behavior.
- Validate score usefulness and explanation clarity.
- Refine UI based on perceived clarity and trust.

## Suggested Technical Sequencing

| Order | Workstream | Why First |
|---|---|---|
| 1 | Internal corpus adapter | Fixes primary input source immediately |
| 2 | Source lineage | Makes extracted graph trustworthy |
| 3 | Persistence + states | Prevents graph reset and data loss |
| 4 | Schema expansion | Improves extraction quality |
| 5 | Multi-candidate concepts | Improves opportunity quality |
| 6 | Scoring upgrade | Makes ranking more strategic |
| 7 | UI rebuild | Present mature underlying intelligence clearly |
| 8 | Report visuals | Finalize decision-ready output layer |

## UI/UX Acceptance Criteria

- Venture Scope does not resemble the old Opportunity Radar in naming, framing, or interaction model.
- The experience feels calm, structured, and professional.
- Users can understand top-ranked opportunities quickly.
- Scores are ranked and explained clearly.
- Evidence is easy to inspect without creating clutter.
- Reports are detailed, visually clear, and implementation-ready.
- ROI framing is visible and understandable.
- Historical knowledge is retained unless the user deletes it.

## Final Product Positioning

Venture Scope is not a trend scanner, a pain-point feed, or an idea generator. It is a venture intelligence environment inside FlowMap that turns accumulated research into structured strategic insight, then helps Flow.AI produce ranked, explainable, and execution-ready product opportunities.[cite:153][cite:160]
