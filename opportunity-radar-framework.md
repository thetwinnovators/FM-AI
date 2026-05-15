# Opportunity Radar + FLOW.AI Framework

## Purpose

This framework repositions Opportunity Radar from a narrow signal-hunting tool into a structured opportunity intelligence system that continuously maps problem spaces, workflow frictions, technologies, and market shifts into a knowledge base that FLOW.AI can reason over. 55] 60]

The goal is not to jump from scraped pain points to startup ideas. The goal is to build a durable discovery system that separates the **opportunity space** from the **solution space**, then uses evidence-backed reasoning to generate and prioritize new product concepts. 55] 56]

## Core Product Thesis

Opportunity Radar should ingest broad market signals, identify structured data points across people, businesses, industries, workflows, and emerging technologies, and organize them into a Flow Maps knowledge base. 55] 60]

FLOW.AI should then analyze the Flow Maps knowledge base to identify unmet needs, fragmented workflows, emerging patterns, and newly enabled solution spaces, and convert those into detailed opportunity briefs. 56] 68]

## System Model

The system should operate in four layers:

| Layer | Function | Primary Output |
|---|---|---|
| Signal Ingestion | Collect source material from topics, conversations, products, markets, and tech shifts | Raw observations |
| Structured Extraction | Identify entities, attributes, and relationships from source material | Normalized records |
| Flow Maps Knowledge Base | Organize extracted records into connected maps and graphs | Opportunity graph |
| FLOW.AI Synthesis | Analyze patterns, white space, and feasibility to propose products | Ranked opportunity briefs |

This layered model aligns with modern discovery thinking: teams first map opportunities and context, then explore and evaluate solutions rather than anchoring too early on one idea. 55] 56]

## Source Inputs

Opportunity Radar should pull from a wide set of signal types so that opportunity generation is not biased toward complaint scraping alone.

Recommended input categories:

- Community discourse: forums, Reddit threads, niche communities, product review discussions, comment sections.
- Business discourse: founder posts, operator interviews, hiring pages, investor commentary, earnings commentary, public roadmaps.
- Product evidence: changelogs, launch notes, pricing pages, feature comparisons, integration marketplaces.
- Technology signals: research announcements, API releases, open-source launches, platform changes, infrastructure shifts. 68]
- Workflow evidence: templates, job descriptions, process documentation, playbooks, compliance requirements.
- Demand evidence: search trends, repeated question patterns, repeated workaround behavior.

## Extraction Schema

Instead of extracting only pain points, the system should classify many opportunity-relevant signals.

### Problem Space Entities

- Challenges
- Pain points
- Frictions
- Unmet needs
- Constraints
- Failure points
- Workarounds
- Jobs to be done
- Desired outcomes

### User and Market Entities

- Personas
- User segments
- Buyer roles
- Company types
- Team functions
- Industries
- Market maturity
- Adoption stage

### Solution Space Entities

- Existing products
- Existing features
- Manual processes
- Service substitutes
- Current approaches
- Competitive alternatives
- Value propositions in market

### Innovation and Change Entities

- Emerging technologies
- Newly enabled capabilities
- Platform shifts
- Regulatory shifts
- New workflows
- New concepts
- New business models
- New operational approaches

### Operational Context Entities

- Workflows
- Processes
- Trigger events
- Inputs and outputs
- Dependencies
- Handoffs
- Bottlenecks
- Metrics of success

## Relationship Model

The Flow Maps knowledge base should store relationships, not just labels, because product opportunity discovery depends on seeing how entities connect. 60] 62]

Recommended relationship patterns:

- Persona -> experiences -> pain point
- Persona -> performs -> workflow
- Workflow -> contains -> process step
- Process step -> creates -> friction
- Industry -> adopts -> technology
- Technology -> enables -> new approach
- Company type -> uses -> current tool
- Current tool -> fails on -> use case
- Problem -> solved today by -> workaround
- Workaround -> signals -> unmet opportunity
- Value proposition -> targets -> persona
- Trigger event -> increases -> urgency
- Emerging technology -> lowers cost of -> solution type

## Flow Maps Knowledge Base Design

The Flow Maps layer should act like a living opportunity graph.

It should support three views of the same data:

1. **Entity view**: personas, industries, technologies, workflows, problems, and solutions as nodes.
2. **Relationship view**: visible links showing causal, behavioral, or operational relationships between nodes. 60] 62]
3. **Opportunity view**: grouped clusters where recurring pain, poor current solutions, and enabling technology intersect. 68]

Each node should include:

- Canonical name
- Type
- Description
- Aliases / synonyms
- Evidence snippets
- Frequency score
- Momentum score
- Confidence score
- Recency score
- Related nodes
- Source links

Each edge should include:

- Relationship type
- Strength score
- Evidence count
- Last seen timestamp
- Contradictory evidence flag

## Opportunity Scoring Model

FLOW.AI should not generate ideas from any single signal. It should score patterns based on how promising they are.

Suggested scoring dimensions:

| Dimension | Question |
|---|---|
| Pain Severity | How painful and persistent is the problem? |
| Frequency | How often does the problem appear across sources? |
| Urgency | How quickly does the user or business need relief? |
| Willingness to Pay | Is there evidence of budget, cost, or revenue impact? |
| Market Breadth | How many segments or industries face this problem? |
| Poor Solution Fit | How weak, fragmented, or manual are current alternatives? |
| Feasibility | Can a practical MVP be built with current technology? |
| Why Now | Is a new technology or market shift making this newly possible? |
| Defensibility | Could the product build compounding advantage over time? |
| GTM Clarity | Is there a clear route to acquire the first users? |

A weighted score can then rank candidate opportunities before concept generation begins.

## FLOW.AI Reasoning Loop

FLOW.AI should follow an explicit reasoning pipeline so the product ideas are grounded, comparable, and auditable.

### Phase 1: Opportunity Mapping

- Cluster related signals by theme.
- Identify recurring unmet needs by persona, workflow, and context.
- Separate root problems from symptoms.
- Distinguish consumer, SMB, mid-market, and enterprise patterns.
- Detect where existing solutions are expensive, fragmented, slow, manual, or hard to adopt. 55] 56]

### Phase 2: White-Space Analysis

- Look for intersections of high pain + weak incumbents + new enabling technology.
- Look for workflow gaps between systems, teams, or handoffs.
- Look for “important but underserved” personas ignored by current products.
- Look for use cases where services are still dominant and software could replace or augment them.
- Look for changes in behavior, regulation, or tooling that create a new wedge. 68]

### Phase 3: Concept Generation

For each strong opportunity cluster, generate multiple solution concepts rather than a single answer. 56]

For each concept, define:

- Product type
- Delivery model
- Buyer and user
- Core workflow improvement
- Differentiator
- Implementation complexity
- Revenue model hypothesis

### Phase 4: Selection and Stress Test

- Compare concepts against the scoring model.
- Test whether the concept solves a root problem or only a symptom.
- Test whether the MVP is narrow enough.
- Test whether the GTM path is realistic.
- Test whether incumbents can easily copy the idea.
- Select the strongest concept and preserve alternates as secondary bets.

## Standard Opportunity Brief Output

Once FLOW.AI selects a concept, it should generate a structured brief using this format:

### Opportunity Summary

A short description of the opportunity and why it matters now.

### Problem Statement

What problem exists, for whom, in what context, and why current approaches are insufficient.

### Target User(s)

Primary persona, secondary persona, buyer, and any important segmentation details.

### Proposed Solution

A concise but concrete product concept, including the workflow it improves or replaces.

### Value Proposition

The clearest promise of value, stated in terms of outcomes rather than features.

### MVP Scope

The smallest viable product that proves the opportunity. This should include the initial wedge, key workflows, must-have features, and clear exclusions.

### Risks

Product risk, market risk, adoption risk, technical risk, legal or operational risk, and timing risk.

### Implementation Plan

A phased execution plan covering discovery, prototype, MVP, pilot, measurement, and iteration.

## Expanded Opportunity Brief Template

For higher-quality output, the system should also generate the following optional sections:

- Why Now
- Buyer vs User
- Current Alternatives
- Existing Workarounds
- Key Use Cases
- Key Assumptions
- Success Metrics
- Pricing Hypothesis
- Defensibility
- Go-to-Market Angle
- Evidence Trace

The **Evidence Trace** is especially important. It should show the specific patterns, source signals, and entity relationships that led FLOW.AI to the concept, which improves explainability and trust in the recommendation. 68]

## Example Internal Prompt Logic for FLOW.AI

```text
You are FLOW.AI, an opportunity synthesis engine.

Your job is not to jump to product ideas immediately.
First, map the opportunity space using the provided entities, relationships, and evidence.
Identify recurring unmet needs, workflow bottlenecks, weak incumbent solutions, and enabling technology shifts.
Generate multiple candidate concepts.
Score them using desirability, viability, feasibility, defensibility, and go-to-market clarity.
Select the strongest concept.
Then produce a detailed opportunity brief with explicit reasoning and an evidence trace.
Do not produce vague ideas, broad categories, or generic AI wrappers.
Prefer specific, winnable concepts with a narrow wedge and strong why-now logic.
```

## Product Principles

To keep the system useful and differentiated, Opportunity Radar and FLOW.AI should follow these principles:

- **Map before ideate**: discovery before concept generation. 55] 56]
- **Structure before summarize**: normalize entities and relationships before insight generation. 60] 62]
- **Evidence before opinion**: every opportunity should trace back to real signals. 68]
- **Multiple concepts before selection**: compare alternatives before choosing one. 56]
- **Root problem before feature**: focus on underlying job-to-be-done, not superficial symptoms. 55]
- **Why now before build**: favor opportunities unlocked by meaningful change. 68]

## Recommended Feature Modules

A practical product roadmap could be organized into these modules:

1. **Radar Sources**: source onboarding, scraping, ingestion, tagging.
2. **Entity Extractor**: classification, deduplication, synonym resolution, confidence scoring.
3. **Flow Maps**: graph view, cluster view, opportunity lenses, filtering.
4. **Opportunity Scorer**: severity, urgency, fit-gap, feasibility, and trend weighting.
5. **FLOW.AI Studio**: synthesis, concept generation, stress testing, brief generation.
6. **Evidence Inspector**: source traceability, signal lineage, confidence review.
7. **Concept Workspace**: save, compare, evolve, and hand off ideas into product planning.

## Suggested MVP for This New Direction

A focused MVP should avoid trying to analyze the entire internet.

Recommended MVP:

- Ingest a limited number of high-value topic domains.
- Extract a fixed schema of entities and relationships.
- Store them in a graph-oriented knowledge base.
- Surface top recurring opportunity clusters.
- Let FLOW.AI generate three candidate concepts per cluster.
- Produce one structured opportunity brief per selected concept.

This MVP would validate whether the system can consistently generate higher-quality product opportunities than a basic pain-point scraper. 55] 56] 68]

## Positioning Statement

A refined positioning statement for the product:

> Opportunity Radar continuously maps problem spaces, workflows, technologies, and market shifts into a living opportunity graph. FLOW.AI then reasons across that graph to generate evidence-backed product concepts, complete with MVP scope, risks, and implementation plans.

## Final Design Recommendation

The strongest version of this concept is not “an AI that finds startup ideas.” It is a discovery operating system that transforms messy market signals into structured opportunity intelligence, then converts that intelligence into actionable, evidence-backed product concepts. 55] 60] 68]
