# Flow AI Assistance Roadmap for FlowMap

## Objective

Expand Flow AI from a search-and-chat helper into a broader assistant that helps with research, learning, idea generation, decisions, and approved actions inside FlowMap. FlowMap already has multi-source search, saved knowledge, signal actions, app-concept automation, opportunity radar, persistent memory work, and a phased path toward retrieval-aware tooling and MCP-style agent workflows, so the next step is to unify those pieces into a more capable assistance system.[cite:642][cite:1209][cite:1482][cite:1501][cite:1518][cite:1093]

The goal is to make Flow AI useful across the full workflow:

- find useful information
- organize and connect it
- synthesize it into insight
- recommend what to do next
- execute approved actions

This aligns with knowledge-management guidance that emphasizes retrieval, synthesis, relevance, and operational assistance rather than just storage or one-off answers.[web:1594][web:1598][web:1603]

## Product vision

Flow AI should become a **personal research, learning, decision, and execution assistant** inside FlowMap. It should not behave like a generic chatbot. It should behave like a context-aware system that understands the user’s saved knowledge, current interests, signals, and ongoing projects, then helps move work forward with appropriate human approval.[cite:642][cite:855][cite:1592][web:1599][web:1608]

## Core assistance model

Flow AI should support five primary assistance jobs.

| Assistance job | What Flow AI should do |
|---|---|
| Find | Search, retrieve, filter, cluster, and resurface relevant information from sources and memory.[cite:642][cite:1390][web:1594] |
| Think | Summarize, compare, challenge, connect, and synthesize saved knowledge into insight.[web:1594][web:1603] |
| Learn | Teach topics step by step, generate learning paths, and quiz understanding through Flow Academy.[web:1595] |
| Decide | Recommend next actions, priorities, and trade-offs using human-in-the-loop approval patterns.[cite:1592][web:1599][web:1608] |
| Do | Trigger approved actions, content drafts, and workflow steps through integrations and MCP-style execution.[cite:1482][cite:1484][cite:1501] |

This model makes Flow AI more understandable than treating every task as a generic chat exchange.

## Recommended product modules

The cleanest way to express Flow AI’s capabilities is through dedicated assist modes rather than one endless conversation surface.

### 1. Ask

Purpose: query saved knowledge, notes, conversations, and sources.

Example uses:

- “What have I saved about local-first AI apps?”
- “Summarize what I learned about RAG latency optimization.”
- “What did I previously say about building Opportunity Radar?”

This builds on FlowMap’s current saved-memory and ask-anything behavior.[cite:642][cite:855][cite:1390]

### 2. Discover

Purpose: surface trends, signals, patterns, opportunities, and changes.

Example uses:

- “What is changing in AI note-taking tools?”
- “Show rising complaints and positive demand signals in creator tools.”
- “What new wedges are emerging in service-business software?”

This extends app-concept automation and the newer wider-net opportunity radar direction.[cite:1209][cite:1518]

### 3. Synthesize

Purpose: turn many items into one useful brief.

Example uses:

- compare multiple saved items
- generate topic briefs
- create a “what matters / what changed / what to do next” summary
- identify contradictions or missing evidence

AI research assistant patterns consistently emphasize cross-source synthesis as a major source of value.[web:1594][web:1603]

### 4. Learn

Purpose: teach, explain, and reinforce understanding.

Example uses:

- generate learning paths
- explain difficult topics simply
- create recap quizzes
- transform saved research into a course or study guide

This builds directly on the Flow Academy direction.[web:1595]

### 5. Act

Purpose: take approved steps on the user’s behalf.

Example uses:

- draft social replies
- draft content ideas from signals
- create watch rules
- trigger workflow actions
- route chores through MCPs and external tools

This fits the user’s stated direction for signal actions, social integrations, and MCP-enabled computer or internet chores.[cite:1482][cite:1484][cite:1501]

## High-value feature opportunities

### Daily briefings

Flow AI should generate a daily or weekly digest of:

- what changed across saved topics
- new notable signals
- relevant saved items resurfaced from memory
- recommended follow-up actions

This would turn FlowMap into an active intelligence workspace instead of a passive archive.[cite:1501][web:1597][web:1603]

### Topic briefs

Flow AI should create living briefs that update over time.

Suggested brief sections:

- overview
- key changes
- strongest signals
- open questions
- risks and counterpoints
- suggested next actions

This is one of the most practical applications of AI-powered knowledge management systems.[web:1594][web:1598][web:1603]

### Cross-source comparison

Flow AI should compare what different communities or channels are saying about the same topic.

Examples:

- Reddit vs YouTube on a product idea
- Hacker News vs Product Hunt on a trend
- user praise vs user complaints in the same category

This uses FlowMap’s multi-source research strengths more effectively than isolated search cards.[cite:642][web:1603]

### Contrarian or gap analysis

Flow AI should help answer:

- What am I missing?
- Where is the evidence weak?
- What are the counterarguments?
- What would need to be true for this idea to work?

This would improve decision quality and reduce overconfidence during product exploration.[web:1603][cite:1592]

### Opportunity-to-build pipeline

Flow AI should turn discovered signals into buildable outputs such as:

- opportunity thesis
- target user
- wedge strategy
- MVP scope
- launch angle
- Claude Code build prompt

This extends the current app-concept automation into a more complete idea pipeline.[cite:1209][cite:1518]

### Knowledge gap detection

Flow AI should flag when:

- a topic lacks enough evidence
- sources disagree
- a summary is too shallow
- there are no saved examples or no supporting proof

That makes FlowMap more useful as a thinking system, not just a collecting system.[web:1594][web:1598]

### Personal learning coach

Flow AI should recommend what to learn next based on:

- current projects
- saved searches
- repeated topics
- unresolved concepts
- recently asked questions

Because FlowMap already stores memory and context, it can become a personalized learning assistant rather than a generic topic generator.[cite:855][web:1595]

### Suggested actions layer

Every important Flow AI output should recommend a next step.

Examples:

- Save to Topic
- Create watch rule
- Generate content ideas
- Build opportunity brief
- Start workflow
- Draft social response
- Turn this into a learning path

This aligns with the user’s preferred human-in-the-loop operating style and existing action system.[cite:1501][cite:1592][web:1599]

## Recommended prioritized roadmap

### Phase 1: Smarter synthesis

Goal: make Flow AI more useful with current data before adding more automation.

Build:

- topic brief generator
- cross-source compare view
- contradiction and research-gap detector
- better retrieval-aware summaries
- “what matters / what changed / what to do next” output format

Why first: synthesis creates immediate value and depends mostly on capabilities FlowMap already has or is already building.[cite:642][cite:1093][web:1594][web:1603]

### Phase 2: Proactive intelligence

Goal: make Flow AI proactively useful.

Build:

- daily digest
- weekly watch report
- resurfaces from memory based on current topic
- saved topic monitoring
- “you may want to revisit this” suggestions

Why second: once synthesis works, proactive delivery multiplies usefulness without requiring full agent execution.[cite:855][cite:1501][web:1597]

### Phase 3: Decision support

Goal: help the user make better calls.

Build:

- contrarian analysis
- strength-of-evidence scoring
- confidence levels
- next-action recommendations
- trade-off cards for app ideas or strategies

Why third: this improves the value of research and opportunity discovery without taking risky actions automatically.[cite:1592][web:1599][web:1608]

### Phase 4: Assisted execution

Goal: connect insight to action.

Build:

- content drafting actions
- social reply drafting
- export-to-workflow hooks
- MCP-triggered chores with approval
- task handoff to connected tools

Why fourth: this is where Flow AI starts behaving like an agent, so it should come after strong context, trust, and recommendation layers are in place.[cite:1482][cite:1484][cite:1501][cite:1093]

### Phase 5: Personalized orchestration

Goal: make Flow AI context-aware and adaptive.

Build:

- stronger typed memory use
- behavior-based recommendations
- project-aware prioritization
- personalized learning suggestions
- multi-step plans across research, learning, and action

Why fifth: this depends on memory quality, evaluation, and trust controls maturing over time.[cite:855][cite:1093][cite:1592]

## UX principles

### 1. Clear role framing

Flow AI should make it obvious what mode it is in.

Examples:

- Ask mode
- Discover mode
- Brief mode
- Learn mode
- Act mode

This reduces ambiguity and makes the product feel more intentional.

### 2. Helpful next actions

Every major output should end with 2 to 4 recommended actions instead of a blank stop.

### 3. Human approval before execution

Any step that changes data, sends content, triggers workflows, or touches external systems should be explicit and reversible where possible.[cite:1592][web:1599]

### 4. Use memory without feeling creepy

Flow AI should explain why it surfaced something from memory.

Example:

> Related to your earlier research on Flow Academy sharing.

That makes personalization feel useful and transparent rather than magical.[cite:855]

### 5. Keep outputs operational

Summaries should not stop at explanation. They should also support action.

Recommended output sections:

- what this is
- why it matters
- what changed
- what to do next

## Suggested UI surfaces

Recommended product surfaces:

- **Flow AI command bar** for quick intent selection
- **Brief cards** inside topics and canvases
- **Digest panel** for proactive updates
- **Action rail** on signals, summaries, and briefs
- **Learn in Flow Academy** button from saved research
- **Start workflow** action when execution is possible [cite:1501][cite:1520]

## Data and architecture implications

To support the roadmap, Flow AI should continue evolving along the planned retrieval and memory path.

Needed capabilities:

- typed memory retrieval
- better query rewriting
- metadata filtering
- reranking
- source attribution
- action recommendation layer
- workflow or MCP routing for approved tasks

These align with the existing phased RAG and agent roadmap already planned for Flow AI.[cite:1093]

## Example user stories

- As a researcher, the user wants Flow AI to compare multiple sources on one topic so they can understand what matters without reading everything manually.[web:1603]
- As a builder, the user wants Flow AI to turn weak market signals into a structured opportunity brief with a recommended MVP.[cite:1209][cite:1518]
- As a learner, the user wants Flow AI to teach a topic step by step and quiz understanding so knowledge becomes usable, not just searchable.[web:1595]
- As an operator, the user wants Flow AI to draft responses, content, or next steps and then ask for approval before acting.[cite:1482][cite:1484][cite:1592]

## Success criteria

The roadmap is successful when Flow AI:

- saves time finding and understanding information
- generates useful synthesis rather than just summaries
- recommends next actions that feel relevant
- helps the user learn what matters
- can trigger approved work without losing trust
- feels like a coherent assistant across research, learning, and action [web:1594][web:1598][web:1599][web:1603]

## Product statement

Flow AI should turn FlowMap into a personal workspace for finding signals, making sense of them, learning what matters, deciding what to do next, and taking approved action through workflows and MCP-connected tools.[cite:642][cite:1093][cite:1482][cite:1592]
