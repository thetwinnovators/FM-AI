# Opportunity Radar + FLOW.AI Framework v3

## Purpose

This framework redefines Opportunity Radar as an internal opportunity intelligence system built on top of FlowMap’s own research corpus rather than relying primarily on external web signal scraping.[cite:55][cite:60]

The core idea is that FlowMap already contains a growing body of user-curated knowledge through **My Topics** and **My Documents**. That content should serve as the primary source for signal extraction, structured knowledge creation, and opportunity synthesis.[cite:55]

## Core Product Thesis

FlowMap’s **My Topics** and **My Documents** are the primary source of market and opportunity signals. From topic summaries, videos, articles, PDFs, posts, saved items, and other research content inside FlowMap, Opportunity Radar and FLOW.AI should extract structured entities, themes, evidence, and relationships across people, businesses, industries, workflows, use cases, challenges, workarounds, and emerging technologies.[cite:60][cite:68]

Those extracted data points should be organized into the Flow Maps knowledge base as a durable, connected knowledge graph. FLOW.AI should then reason over that graph to identify promising opportunities for new products and generate detailed, evidence-backed opportunity briefs.[cite:60][cite:68]

## Revised Product Model

The product should be understood as a five-layer system:

| Layer | Function | Output |
|---|---|---|
| Source Layer | My Topics and My Documents provide the research corpus | Topic and document content |
| Content Layer | Summaries, videos, articles, PDFs, posts, saved items, metadata, and notes | Parsed source artifacts |
| Extraction Layer | Identify entities, themes, attributes, evidence spans, and relationships | Structured records |
| Flow Maps Knowledge Base | Save extracted records into a connected knowledge graph | Durable opportunity graph |
| FLOW.AI Synthesis | Analyze graph patterns and generate product opportunities | Opportunity briefs |

This model is stronger than a pure external-signal scanner because the intelligence is grounded in content the user has deliberately gathered, refined, and organized inside FlowMap.[cite:60]

## Primary Data Sources

Opportunity Radar should treat the following as first-class input sources:

- My Topics
- My Documents
- Topic summaries
- Videos
- Articles
- PDFs
- Posts
- Saved links and research items
- User notes and metadata attached to topic or document records

External web discovery may still be useful, but it should be treated as optional enrichment rather than the main foundation of the opportunity engine.

## Extraction Objective

The extraction system should convert unstructured content from topics and documents into reusable opportunity intelligence.

Instead of extracting only pain points, it should identify and classify a wide set of opportunity-relevant data points across both individual and business contexts.

## Extraction Schema

### Problem and Need Signals

- Pain points
- Challenges
- Constraints
- Frictions
- Unmet needs
- Desired outcomes
- Jobs to be done
- Bottlenecks
- Operational inefficiencies
- Repeated complaints
- Failure points
- Workarounds

### User and Organization Signals

- Personas
- User roles
- Buyer roles
- Team functions
- Company types
- Organization size
- Industry
- Niche segment
- Stakeholders
- Decision-makers

### Workflow and Context Signals

- Workflows
- Processes
- Process steps
- Inputs and outputs
- Trigger events
- Handoffs
- Dependencies
- Compliance requirements
- Time-sensitive tasks
- Collaboration patterns

### Solution and Market Signals

- Existing products
- Existing tools
- Manual alternatives
- Competitive approaches
- Features being used
- Problems already being solved
- Use cases currently being solved
- Value propositions in market
- Delivery models
- Pricing patterns

### Change and Innovation Signals

- Emerging technologies
- New capabilities
- Platform shifts
- Regulatory changes
- Behavioral changes
- New concepts
- New methods
- New operational approaches
- New business models
- Industries adopting new technologies

## Relationship Model

The Flow Maps knowledge graph should preserve relationships between extracted entities so the system can reason across context rather than storing disconnected labels.[cite:60][cite:62]

Recommended relationship types include:

- Persona -> experiences -> pain point
- Persona -> performs -> workflow
- Team -> owns -> process
- Workflow -> contains -> process step
- Process step -> creates -> friction
- Organization -> uses -> tool
- Tool -> supports -> use case
- Tool -> fails on -> use case
- Problem -> solved today by -> workaround
- Workaround -> signals -> unmet opportunity
- Industry -> adopts -> technology
- Technology -> enables -> approach
- Approach -> improves -> workflow
- Value proposition -> targets -> persona
- Source item -> provides evidence for -> node or edge

## Knowledge Retention and Persistence Principle

FlowMap must treat extracted knowledge as durable user-owned intelligence.

### Core Rule

All structured data extracted by Opportunity Radar and FLOW.AI from My Topics and My Documents must be automatically saved into the Flow Maps knowledge graph and retained as part of the user’s long-term knowledge base. Extracted nodes, relationships, classifications, summaries, evidence links, opportunity signals, and revisions must never be automatically removed or permanently deleted by the system.[cite:97][cite:101]

Knowledge may only be permanently deleted when the user explicitly chooses to remove it or remove the originating content with confirmed deletion behavior.[cite:98][cite:102][cite:109]

### Retention Requirements

- Extracted knowledge must persist across reprocessing, rescans, model changes, and system upgrades.[cite:97][cite:101]
- Re-extraction may refine or supersede previous interpretations, but it must not silently erase historical records.[cite:97][cite:101]
- Old interpretations should be versioned, archived, or marked superseded rather than destroyed.[cite:102][cite:110]
- Every extracted node and relationship should preserve source lineage back to the originating topic, summary, video, article, PDF, post, or document.[cite:97]
- Every create, update, archive, restore, and delete action should be auditable.[cite:98][cite:101]

### Recommended Record States

To support durability without clutter, each saved knowledge object should support one of the following states:

| State | Meaning |
|---|---|
| Active | Current knowledge visible in normal experiences |
| Superseded | Older extraction retained but replaced by a newer interpretation |
| Archived | Hidden from default views but preserved |
| Deleted | User-requested deletion, recoverable for a defined period |
| Hard Deleted | Permanently removed only after explicit confirmation |

### Product Rule for Deletion

The system should never auto-delete extracted knowledge due to rescanning, summarization updates, classifier changes, or low confidence. Low-confidence knowledge can be flagged, hidden, or deprioritized, but not removed without user direction.[cite:98][cite:102]

If a user deletes a source item, FlowMap should present clear deletion options such as:

- Remove source only
- Remove source and archive derived knowledge
- Remove source and permanently delete derived knowledge

This preserves trust and ensures the graph acts as a real long-term intelligence asset rather than a temporary cache.[cite:97][cite:101]

## Flow Maps Knowledge Base Design

The knowledge base should function as a living opportunity graph that accumulates and compounds value over time.

It should support at least three views of the same underlying data:

1. **Entity view**: personas, industries, technologies, workflows, problems, use cases, and solutions.
2. **Relationship view**: visible connections showing causality, relevance, dependency, and supporting evidence.[cite:60][cite:62]
3. **Opportunity view**: clusters where repeated pain, weak current solutions, strategic workflows, and enabling technologies intersect.[cite:68]

Each node should include:

- Canonical name
- Type
- Description
- Aliases and synonyms
- Evidence snippets
- Confidence score
- Frequency score
- Recency score
- Momentum score
- Source references
- Status state
- Version metadata

Each edge should include:

- Relationship type
- Supporting evidence count
- Strength score
- Source references
- Timestamp history
- Status state

## UI and Experience Principle

The Opportunity Radar and FLOW.AI experience must be clean, structured, and easy to understand. The interface should reduce cognitive overload by presenting the most important insights first and progressively revealing deeper detail only when needed.[cite:114][cite:115]

The interface should avoid busy layouts, visual clutter, and dense walls of competing information. Users should be able to understand what the strongest opportunity is, why it ranks highly, and what evidence supports it within a few seconds of opening a result.[cite:114][cite:119]

### UI Requirements

- Use strong visual hierarchy with an overview-first layout.[cite:114][cite:121]
- Group content into clearly labeled sections such as Overview, Signals, Scores, ROI, Evidence, and Brief.
- Keep summary scorecards at the top and detailed evidence lower in the page.[cite:118][cite:121]
- Use tabs, accordions, drawers, and drill-down patterns instead of rendering everything at once.[cite:117][cite:125]
- Use restrained color, consistent iconography, and minimal decoration so the product feels credible and calm.[cite:115][cite:124]
- Make every status color semantically consistent, such as high confidence, medium confidence, risk, or upside.[cite:124]

## Opportunity Scoring Model

FLOW.AI should score opportunity clusters using a richer framework before generating a final recommendation.

Suggested dimensions:

| Dimension | Core Question |
|---|---|
| Pain Severity | How painful is the problem? |
| Frequency | How often does it appear? |
| Urgency | How quickly does it need resolution? |
| Willingness to Pay | Is there budget or economic motivation? |
| Market Breadth | How broad is the applicable segment? |
| Weak Solution Fit | How poor are current options? |
| Feasibility | Can a strong MVP be built now? |
| Why Now | Is something newly enabling this opportunity? |
| Defensibility | Could the product build durable advantage? |
| GTM Clarity | Is there a clear wedge and route to initial users? |

## Scoring Display Principle

Scores should not be presented as isolated numbers. Every score should be ranked, explained, and supported by clear evidence so users can understand both the result and the reasoning behind it.[cite:114][cite:115]

Each opportunity should include:

- Overall rank, such as `#2 of 14 opportunities`
- Composite score, such as `78/100`
- Weighted dimension breakdown
- Plain-language explanation of why each dimension scored as it did
- Confidence rating for the score itself
- Source-backed evidence summary

This makes the scoring model interpretable rather than opaque and helps users trust the prioritization.[cite:115][cite:121]

## FLOW.AI Reasoning Loop

FLOW.AI should not jump straight from extracted data to a single product idea. It should follow a structured reasoning loop aligned with opportunity-first discovery.[cite:55][cite:56]

### Phase 1: Opportunity Mapping

- Cluster recurring themes.
- Group signals by persona, workflow, industry, and use case.
- Separate root problems from symptoms.
- Identify patterns of weak or fragmented current solutions.

### Phase 2: White-Space Analysis

- Detect where high pain meets poor incumbent fit.
- Detect where workflow gaps create repeated friction.
- Detect where emerging technology changes feasibility or cost structure.[cite:68]
- Detect underserved personas or niches.

### Phase 3: Concept Generation

Generate multiple candidate product concepts for each strong opportunity cluster, not just one.[cite:56]

Each candidate should define:

- Product concept
- User and buyer
- Workflow shift created
- Why-now rationale
- Business model hypothesis
- Complexity level

### Phase 4: Selection and Stress Testing

- Compare concepts against the scoring model.
- Evaluate narrowness of wedge.
- Test feasibility of MVP.
- Check clarity of distribution path.
- Review defensibility and timing.
- Preserve alternate concepts as second-order opportunities.

## Generated Reports Principle

Generated reports should be detailed, structured, and decision-oriented rather than verbose or visually noisy. They should help users quickly understand the opportunity, the score, the expected ROI, and the reasoning behind the recommendation.[cite:115][cite:118]

Reports should follow a clear hierarchy:

1. Opportunity overview
2. Ranked score summary
3. ROI analysis and assumptions
4. Key visuals and comparisons
5. Supporting evidence
6. Full opportunity brief and implementation plan

## Data Visualization Requirements

Data visuals in Opportunity Radar and generated reports should clarify decisions, not decorate them. Each visual should answer one clear question and use the simplest effective format.[cite:113][cite:115]

Recommended visuals include:

- Ranked bar chart for comparing opportunities
- Score breakdown chart for dimension-level scoring
- Trend line for momentum or signal frequency over time
- ROI scenario chart or waterfall view for upside, cost, and payback explanation.[cite:118][cite:125]
- Evidence table showing source coverage, confidence, and lineage.[cite:124]

All visuals should be clearly labeled, easy to scan, and paired with concise interpretation text so users do not need to infer meaning on their own.[cite:113][cite:115]

## Standard Opportunity Brief

Once FLOW.AI selects the strongest concept, it should generate a detailed brief with the following structure:

- Opportunity Summary
- Problem Statement
- Target User(s)
- Proposed Solution
- Value Proposition
- MVP Scope
- Risks
- Implementation Plan

## Expanded Brief Fields

For stronger product quality, the brief should also support:

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

The **Evidence Trace** should show exactly which topics, documents, summaries, or extracted graph patterns led to the opportunity recommendation.[cite:68]

## Product Principles

The revised system should follow these core principles:

- **Internal corpus first**: FlowMap’s own topics and documents are the main source of truth.
- **Extract broadly**: classify more than pain points.
- **Preserve everything**: extracted knowledge compounds and must not disappear automatically.[cite:97][cite:101]
- **Map before ideate**: structure opportunity space before generating solutions.[cite:55][cite:56]
- **Evidence before opinion**: every recommendation should be traceable.[cite:68]
- **Version instead of overwrite**: keep prior knowledge states when interpretation changes.[cite:97][cite:101]
- **User-controlled deletion only**: permanent removal requires explicit user intent.[cite:98][cite:102][cite:109]
- **Clarity over density**: the UI and reports must feel organized and calm.[cite:114][cite:115]
- **Explain the ranking**: scores must show not just what ranked highest, but why.[cite:115][cite:121]

## Recommended Implementation Priority

A practical execution sequence for this new direction:

1. Broaden the extraction schema.
2. Add lineage, versioning, and persistent graph storage.
3. Introduce the expanded scoring model.
4. Redesign the Opportunity Radar UI around the new system model.
5. Add detailed reporting and data visualization.
6. Expand external source enrichment only after the internal corpus pipeline is strong.

## Final Positioning Statement

> FlowMap turns user-curated research from My Topics and My Documents into a durable knowledge graph of problems, workflows, technologies, and market patterns. Opportunity Radar and FLOW.AI extract, preserve, and connect those signals over time, then generate evidence-backed product opportunities with ranked scoring, ROI visuals, detailed briefs, risks, and implementation guidance.
