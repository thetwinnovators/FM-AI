# Opportunity Radar Wider-Net Spec

## Objective

Upgrade Opportunity Radar from a narrow pain-point detector into a broader opportunity discovery engine that finds more **buildable ideas**. The new system should detect not only complaints, but also validated demand, successful products, repeated feature gaps, switching behavior, workarounds, and pattern-transfer opportunities across niches.[cite:1209][cite:642][cite:1502][cite:1507][cite:1510]

The goal is to help FlowMap surface ideas that are not just painful, but promising. Some strong opportunities begin as explicit complaints, but many begin as users loving a category while still wanting better features, cheaper alternatives, narrower focus, easier workflows, or more niche-specific versions.[cite:1503][cite:1508][cite:1509]

## Product shift

Opportunity Radar currently centers on pain signals and ranks app ideas from repeated pain-point evidence.[cite:1209] The new version should instead operate as a **multi-signal opportunity scanner** that looks for tension in a market from several angles at once: dissatisfaction, demand, momentum, switching, workaround behavior, and incumbent gaps.[cite:1502][cite:1504][cite:1512]

This means Opportunity Radar should stop asking only, “What are users complaining about?” and start asking:

- What jobs are users trying to get done?[cite:1507][cite:1510]
- Which tools are succeeding in that job space?[cite:1509]
- What do users still wish those tools did better?[cite:1508]
- Where are users hacking together manual workarounds?[cite:1508][cite:1512]
- Where are users switching tools because one specific need is not being met?[cite:1510]
- Which successful product patterns could transfer into another niche?[cite:1516]

## Core opportunity model

The new Opportunity Radar should classify findings into seven signal classes.

| Signal class | What it means | Why it matters |
|---|---|---|
| Pain | Users are frustrated, blocked, or annoyed. | Reveals active dissatisfaction.[cite:1209] |
| Pull | Users are actively asking for a solution. | Shows explicit demand intent.[cite:1508] |
| Success | A product/category is winning or highly rated. | Validates market demand and user willingness to adopt.[cite:1509][cite:1511] |
| Gap | Existing products are loved but incomplete. | Reveals wedge opportunities against incumbents.[cite:1508] |
| Switching | Users are moving from one product to another. | Shows why users defect and what matters enough to switch.[cite:1510] |
| Workaround | Users solve the problem manually or with duct-tape tools. | Suggests productizable friction.[cite:1508][cite:1512] |
| Adjacency | A product pattern succeeds in one niche but is missing in another. | Reveals pattern-transfer opportunities.[cite:1516] |

Each signal on its own can be weak. The system should become more confident when multiple signal types cluster around the same job, niche, or unmet need.[cite:1504][cite:1509]

## Primary design principle

Opportunity Radar should detect **opportunity conditions**, not just complaints.[cite:1502][cite:1503] The highest-value opportunities usually appear where several of the following overlap:

- users care about the job
- the category already has traction
- incumbents are flawed or broad
- people use ugly workarounds
- users say they want better options
- there is a clear wedge that is realistic to build

That combination is a much better predictor of a buildable idea than raw complaint volume alone.[cite:1503][cite:1508][cite:1512]

## User jobs first

The scanning model should organize discovery around **jobs to be done**, not around product categories alone. Jobs-to-be-done frameworks explicitly broaden the lens from direct competitors to all substitutes and workarounds users consider when trying to accomplish the same outcome.[cite:1507][cite:1510][cite:1516]

Example:

- narrow category framing: “social media scheduling app”
- job framing: “plan, draft, approve, and publish multi-channel content with low effort”

The second framing opens the radar to spreadsheets, Notion workflows, Google Docs, agency processes, comment-reply tools, and adjacent planning systems, not just obvious scheduling tools.[cite:1510][cite:1516]

## System inputs

The radar should scan from multiple source groups rather than a single complaint-oriented source mix.

### Demand sources

These sources are best for explicit demand, complaints, and pull signals:

- Reddit
- X/Twitter
- LinkedIn
- Indie Hackers
- Stack Overflow
- Product Hunt comment threads[cite:1508][cite:1511]

### Validation sources

These sources are best for identifying where categories and products are clearly succeeding:

- Product Hunt leaderboards and launches[cite:1511]
- G2 category leaders[cite:1511]
- Capterra category leaders[cite:1511]
- app store top-rated lists[cite:1514]
- curated “best tools” lists[cite:1511][cite:1514]

### Gap sources

These sources are best for feature requests, dissatisfaction, and missed expectations:

- G2 negative reviews[cite:1511]
- Capterra negative reviews[cite:1511]
- GitHub issues
- feature request boards
- product changelog discussions[cite:1508]

### Behavioral sources

These sources are best for seeing real workaround and switching behavior:

- “alternative to” searches[cite:1510]
- “switched from X to Y” posts[cite:1510]
- YouTube workflow videos
- “using spreadsheet for…” posts[cite:1508]
- “Zapier workaround for…” posts[cite:1508]

## Search modes

Opportunity Radar should support multiple query modes for every job seed.

### 1. Pain queries

Purpose: detect dissatisfaction.

Examples:

- `hate using [tool]`
- `frustrating [workflow]`
- `[tool] annoying`
- `why is [task] so hard`

### 2. Pull queries

Purpose: detect active search for solutions.

Examples:

- `looking for a tool to [job]`
- `need an app for [job]`
- `best way to [job]`
- `is there a tool that [outcome]`

### 3. Success queries

Purpose: identify validated demand and leading incumbents.

Examples:

- `best [category] app`
- `top rated [category] software`
- `best tools for [job]`
- `favorite [category] tools`

### 4. Gap queries

Purpose: identify missing-feature wedges.

Examples:

- `[app] missing feature`
- `[app] wish it had`
- `[app] needs`
- `feature request [app]`

### 5. Switching queries

Purpose: identify why users leave one tool for another.

Examples:

- `switched from [x] to [y]`
- `alternative to [x]`
- `moved away from [x]`
- `better than [x] for [job]`

### 6. Workaround queries

Purpose: identify productizable manual behavior.

Examples:

- `spreadsheet for [job]`
- `notion for [job]`
- `zapier workaround [job]`
- `manual way to [job]`

### 7. Adjacency queries

Purpose: identify category-transfer opportunities.

Examples:

- `AI copilot for [niche]`
- `[consumer workflow] for teams`
- `[successful pattern] for [industry]`
- `like [app], but for [niche]`

## Flow of the new radar

The system should follow this pipeline:

1. **Seed a job**
   - Example: save research, manage leads, draft social responses, run a solo service business.

2. **Expand adjacent jobs**
   - Infer before, during, and after jobs for the same workflow.[cite:1502][cite:1510]

3. **Run multi-mode discovery**
   - Search all seven signal classes across supported source groups.[cite:1503][cite:1508]

4. **Normalize findings**
   - Convert raw findings into a common signal schema.

5. **Cluster by job and unmet outcome**
   - Group semantically similar findings, not just string matches.[cite:1502][cite:1507]

6. **Score opportunity strength**
   - Use a weighted model based on evidence, momentum, wedge clarity, and buildability.[cite:1509][cite:1512]

7. **Generate opportunity theses**
   - Output buildable idea cards, not just signal lists.[cite:1209]

## Signal schema

Each discovered signal should conform to a richer schema than the current pain-centric model.

```ts
export type SignalType =
  | 'pain'
  | 'pull'
  | 'success'
  | 'gap'
  | 'switching'
  | 'workaround'
  | 'adjacency'

export interface OpportunitySignal {
  id: string
  signalType: SignalType
  source: string
  sourceUrl?: string
  sourceEntity?: string
  title: string
  excerpt: string
  jobToBeDone: string
  targetUser?: string
  currentSolution?: string
  currentWorkaround?: string
  incumbent?: string
  incumbentStrength?: string
  incumbentGap?: string
  switchingTrigger?: string
  niche?: string
  tags: string[]
  evidenceStrength: number
  createdAt: string
}
```

## Opportunity thesis schema

After clustering, Opportunity Radar should produce an opportunity thesis object that is much closer to a build decision.

```ts
export interface OpportunityThesis {
  id: string
  title: string
  jobToBeDone: string
  targetUser: string
  niche: string
  wedgeType:
    | 'underserved-winner'
    | 'workaround-to-product'
    | 'pattern-transfer'
    | 'switching-wedge'
    | 'emerging-pull'
  summary: string
  whyNow: string
  currentAlternatives: string[]
  incumbentWeaknesses: string[]
  proofSignals: string[]
  evidenceCount: number
  buildabilityScore: number
  demandScore: number
  competitionPressure: number
  wedgeClarityScore: number
  recommendedMvp: string[]
}
```

## Scoring model

Opportunity Radar should no longer rank ideas only by signal frequency. It should score ideas across multiple dimensions.

Suggested scoring inputs:

- **Demand score** — how often users express the job or need
- **Pain score** — how intense dissatisfaction appears
- **Validation score** — whether the category already has winning products
- **Gap score** — how often users request something incumbents do not do well
- **Switching score** — how clearly users change tools for one reason
- **Workaround score** — how much manual friction users tolerate today
- **Wedge clarity score** — how easy it is to define a sharp first product
- **Buildability score** — how realistic it is to build a meaningful first version

Illustrative weighted formula:

```ts
opportunityScore =
  demand * 0.20 +
  pain * 0.15 +
  validation * 0.15 +
  gap * 0.15 +
  switching * 0.10 +
  workaround * 0.10 +
  wedgeClarity * 0.10 +
  buildability * 0.05
```

This formula should remain configurable, since different discovery modes may need different weights.[cite:1503][cite:1512]

## Wedge taxonomy

The system should explicitly classify the kind of opportunity it has found.

| Wedge type | Meaning | Example |
|---|---|---|
| Underserved winner | Proven category, but incumbents are broad or weak in a niche | “best project tool, but bad for service soloists” |
| Workaround-to-product | Users already solve the job manually | spreadsheet or Notion replacement |
| Pattern-transfer | Successful product shape copied into a new niche | “Canva for legal templates” |
| Switching wedge | Users leave incumbents for one recurring reason | “faster than X”, “simpler than Y” |
| Emerging pull | Users ask for a thing before a category fully forms | “is there an AI tool for…” |

## New UI requirements

Opportunity Radar should expose more than a ranked list of pain-point cards. It should become a discovery workspace for opportunity patterns.

### New top-level tabs or filters

- All signals
- Pain
- Pull
- Winners
- Gaps
- Switching
- Workarounds
- Adjacency
- Opportunity theses

### New card fields

Each signal card or thesis card should show:

- signal type
- job to be done
- target user
- current solution
- current workaround
- incumbent gap
- proof count
- wedge type
- buildability score

### New actions

Add these actions to the existing signal action system where appropriate.[cite:1501]

- Save as opportunity thesis
- Compare incumbents
- Generate wedge angle
- Expand adjacent markets
- Generate MVP scope
- Find similar workarounds
- Track this category
- Watch this incumbent

## Search orchestration logic

For each job seed, the system should generate a search plan that spans signal classes rather than one narrow query cluster.

Pseudo flow:

```ts
async function runOpportunityRadar(jobSeed: string) {
  const expandedJobs = expandAdjacentJobs(jobSeed)
  const queries = buildQueries(expandedJobs, [
    'pain',
    'pull',
    'success',
    'gap',
    'switching',
    'workaround',
    'adjacency'
  ])

  const rawFindings = await runSearches(queries)
  const normalized = normalizeSignals(rawFindings)
  const clustered = clusterByJobAndOutcome(normalized)
  const theses = clustered.map(buildOpportunityThesis)
  return rankByOpportunityScore(theses)
}
```

## Implementation modules

Suggested implementation structure:

```txt
src/opportunity-radar/
  signalTypes.ts
  sourceRegistry.ts
  queryBuilder.ts
  jobExpander.ts
  normalizer.ts
  clusterer.ts
  scorer.ts
  wedgeClassifier.ts
  thesisGenerator.ts
  useOpportunityRadar.ts
  components/
    OpportunityTabs.tsx
    SignalCard.tsx
    ThesisCard.tsx
    OpportunityFilters.tsx
```

## Ranking outputs

The final system should no longer output only “top pain points.” It should output multiple opportunity views:

- Top overall buildable opportunities
- Best underserved winner opportunities
- Best workaround-to-product opportunities
- Best switching wedges
- Best pattern-transfer ideas
- Emerging pull signals to watch

This output structure will produce more balanced idea generation and reduce the chance that FlowMap only recommends reactive complaint-driven apps.[cite:1209][cite:1503][cite:1508]

## Example output format

An opportunity thesis card should contain:

- Title
- Job to be done
- Target user
- Wedge type
- Why this is promising now
- Incumbents and why they fall short
- Current workaround
- Proof signals
- Suggested MVP
- Buildability score

Example concept:

- **Title:** Lightweight social reply copilot for solo service brands
- **Job:** read comments, draft on-brand replies, queue approvals
- **Wedge type:** switching wedge
- **Why now:** users want engagement help, incumbents are broad social suites
- **Current workaround:** native platform comments + manual drafting in notes/docs
- **MVP:** ingest comments, draft reply options, approval queue, send after review

## Integration with existing FlowMap features

This wider-net system should plug into FlowMap’s current app-concept generation behavior rather than replace it.[cite:1209] It should feed better upstream evidence into downstream flows such as:

- Generate app ideas
- Generate content ideas
- Save to Topic
- Create watch rule
- Start workflow[cite:1501]

The key change is that the evidence layer becomes broader and more strategically useful.

## Success criteria

The upgrade is successful when Opportunity Radar can:

- detect opportunities from success and gap signals, not only complaints
- produce idea cards that identify a specific buildable wedge
- show the difference between validated demand and unmet need
- surface more niche-specific, realistic MVP concepts
- help FlowMap generate higher-quality app ideas from broader market evidence

## Build recommendation

The first version should not attempt to cover every source perfectly. The right first version is:

1. add new signal classes
2. add jobs-to-be-done clustering
3. add gap and success searches
4. add opportunity thesis scoring
5. add thesis cards and wedge classification

That will produce a major improvement in idea quality without overcomplicating the first implementation.[cite:1502][cite:1507][cite:1509]
