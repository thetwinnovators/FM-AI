# Opportunity Radar Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Opportunity Radar from a pain-only scanner into a 7-signal opportunity discovery engine with wedge classification, thesis generation, and block/filter UI.

**Architecture:** In-place schema upgrade — replace `PainSignal`/`AppConcept` with `OpportunitySignal`/`OpportunityThesis`; refactor all pipeline services; update views and components. New localStorage v2 keys replace old ones (no migration — old data is low quality).

**Tech Stack:** TypeScript, React, Vitest, Ollama (`chatJson` for thesis generation), Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-05-05-opportunity-radar-upgrade-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/opportunity-radar/types.ts` | Rewrite | All shared types: SignalType, OpportunitySignal, TaggedResult, OpportunityCluster (upgraded), WedgeType, OpportunityThesis, ScanSource, RawSearchResult |
| `src/opportunity-radar/constants/signalQueries.ts` | Create | 7-class SIGNAL_QUERIES map + SOURCE_AFFINITY |
| `src/opportunity-radar/constants/painQueries.ts` | Delete | Superseded |
| `src/opportunity-radar/services/signalExtractor.ts` | Update | Accept TaggedResult, emit OpportunitySignal |
| `src/opportunity-radar/services/clusterService.ts` | Update | Track signalTypeBreakdown, drop painTheme |
| `src/opportunity-radar/services/opportunityScorer.ts` | Rewrite | 8-component scorer, relaxed qualifies(), getTopN() |
| `src/opportunity-radar/services/wedgeClassifier.ts` | Create | Deterministic classifyWedge() |
| `src/opportunity-radar/services/multiSignalSearchService.ts` | Create | 7-mode search with source affinity, tagged results |
| `src/opportunity-radar/services/painSearchService.ts` | Delete | Superseded |
| `src/opportunity-radar/services/thesisGenerator.ts` | Create | Ollama thesis generation + template fallback |
| `src/opportunity-radar/services/conceptGenerator.ts` | Delete | Superseded |
| `src/opportunity-radar/services/aiOpportunityFilter.ts` | Update | Field rename: painText → rawText |
| `src/opportunity-radar/storage/radarStorage.ts` | Update | v2 keys, loadTheses/saveThesis, blockCluster/unblockCluster |
| `src/opportunity-radar/services/__tests__/signalExtractor.test.ts` | Update | OpportunitySignal factories |
| `src/opportunity-radar/services/__tests__/clusterService.test.ts` | Update | OpportunitySignal factories |
| `src/opportunity-radar/services/__tests__/opportunityScorer.test.ts` | Rewrite | 8-component formula tests |
| `src/opportunity-radar/services/__tests__/wedgeClassifier.test.ts` | Create | classifyWedge tests |
| `src/opportunity-radar/services/__tests__/thesisGenerator.test.ts` | Create | Template fallback test |
| `src/opportunity-radar/services/__tests__/multiSignalSearchService.test.ts` | Create | Source affinity tests |
| `src/components/opportunity/ThesisCard.tsx` | Create | Thesis card UI component |
| `src/components/opportunity/ConceptView.jsx` | Rewrite | Show OpportunityThesis fields |
| `src/components/opportunity/PatternTable.jsx` | Update | Type pill, wedge column, block button, blocked chip |
| `src/components/opportunity/RadarTopCard.jsx` | Update | evidenceStrength/rawText field renames |
| `src/components/opportunity/EvidencePanel.jsx` | Update | evidenceStrength/rawText field renames |
| `src/views/OpportunityRadar.jsx` | Rewrite | Tab bar, new pipeline, auto-thesis gen, block handler |

---

## Task 1: Rewrite types.ts

**Files:**
- Modify: `src/opportunity-radar/types.ts`

- [ ] **Step 1: Write the complete replacement**

```typescript
// src/opportunity-radar/types.ts

export type SignalType =
  | 'pain'
  | 'pull'
  | 'success'
  | 'gap'
  | 'switching'
  | 'workaround'
  | 'adjacency'

export type ScanSource =
  | 'reddit'
  | 'hackernews'
  | 'stackoverflow'
  | 'twitter'
  | 'linkedin'
  | 'indiehackers'
  | 'producthunt'
  | 'g2'
  | 'capterra'
  | 'github'
  | 'youtube'

export interface RawSearchResult {
  source:      ScanSource
  url:         string
  title:       string
  snippet:     string
  author?:     string
  publishedAt?: string
}

// TaggedResult — output of multiSignalSearchService: carries signalType set
// deterministically from the query mode that produced this result.
export interface TaggedResult extends RawSearchResult {
  signalType: SignalType
  queryUsed:  string
}

export interface OpportunitySignal {
  id:                string
  detectedAt:        string          // ISO
  source:            ScanSource
  sourceUrl:         string
  sourceEntity?:     string
  author?:           string
  signalType:        SignalType
  rawText:           string
  normalizedText:    string
  keyTerms:          string[]
  jobToBeDone:       string          // '' at extraction; filled at thesis build
  targetUser?:       string
  currentSolution?:  string
  incumbent?:        string
  incumbentGap?:     string
  switchingTrigger?: string
  niche?:            string
  tags:              string[]
  evidenceStrength:  number          // 0–10
  queryUsed:         string
}

export interface OpportunityCluster {
  id:                  string
  createdAt:           string
  updatedAt:           string
  keyTerms:            string[]
  signalIds:           string[]
  signalCount:         number
  sources:             ScanSource[]
  sourceCount:         number
  opportunityScore:    number        // 0–100
  isBuildable:         boolean
  signalTypeBreakdown: Partial<Record<SignalType, number>>
  status:              'emerging' | 'validated' | 'concept_generated' | 'archived' | 'blocked'
  blockedAt?:          string        // ISO; present = blocked
  aiValidated?:        boolean
  aiRejectionReason?:  string
}

export type WedgeType =
  | 'underserved-winner'
  | 'workaround-to-product'
  | 'pattern-transfer'
  | 'switching-wedge'
  | 'emerging-pull'

export interface OpportunityThesis {
  id:                   string
  clusterId:            string
  title:                string
  jobToBeDone:          string
  targetUser:           string
  niche:                string
  wedgeType:            WedgeType
  summary:              string
  whyNow:               string
  currentAlternatives:  string[]
  incumbentWeaknesses:  string[]
  proofSignals:         string[]
  evidenceCount:        number
  buildabilityScore:    number     // 0–100
  demandScore:          number     // 0–100
  competitionPressure:  number     // 0–100
  wedgeClarityScore:    number     // 0–100
  recommendedMvp:       string[]
  generatedBy:          'ollama' | 'template'
  status:               'new' | 'reviewing' | 'saved' | 'building' | 'archived'
  createdAt:            string
  updatedAt:            string
}

export interface RadarScanMeta {
  lastScanAt:     string
  totalSignals:   number
  totalClusters:  number
  scanDurationMs: number
}
```

- [ ] **Step 2: Verify no TypeScript errors on types file alone**

```bash
cd C:\Users\JenoU\Desktop\FlowMap
npx tsc --noEmit --strict src/opportunity-radar/types.ts 2>&1 | head -20
```

Expected: no errors (or only "Cannot find module" — those resolve once callers are updated).

- [ ] **Step 3: Commit**

```bash
git add src/opportunity-radar/types.ts
git commit -m "feat(radar): rewrite types.ts — OpportunitySignal/Thesis replace PainSignal/AppConcept"
```

---

## Task 2: Create signalQueries.ts and delete painQueries.ts

**Files:**
- Create: `src/opportunity-radar/constants/signalQueries.ts`
- Delete: `src/opportunity-radar/constants/painQueries.ts`

- [ ] **Step 1: Create signalQueries.ts**

```typescript
// src/opportunity-radar/constants/signalQueries.ts
import type { SignalType, ScanSource } from '../types.js'

export const SIGNAL_QUERIES: Record<SignalType, string[]> = {
  pain: [
    '"I hate how"',
    '"why isn\'t there an app that"',
    '"frustrated with"',
    '"takes too long every time"',
    '"I keep doing this manually"',
    '"no good solution for"',
    '"still doing this in spreadsheets"',
    '"current tools are too expensive" OR "too complex"',
    '"I built a workaround for"',
    '"doesn\'t support"',
  ],
  pull: [
    '"looking for a tool to"',
    '"need an app for"',
    '"best way to"',
    '"is there a tool that"',
    '"recommend a tool for"',
    '"any good software for"',
    '"what do you use for"',
    '"help me find"',
  ],
  success: [
    '"best" AND ("app" OR "tool" OR "software")',
    '"top rated" AND "software"',
    '"favorite" AND ("tool" OR "app")',
    '"highly recommend" AND "app"',
    '"worth the money" AND "app"',
    '"switched to" AND "never looked back"',
    '"game changer" AND ("tool" OR "software")',
  ],
  gap: [
    '"wish it had"',
    '"missing feature"',
    '"feature request"',
    '"should have" AND ("app" OR "tool")',
    '"doesn\'t support" AND "wish"',
    '"would be great if"',
    '"one thing I hate about"',
    '"biggest complaint" AND "app"',
  ],
  switching: [
    '"switched from" AND "to"',
    '"alternative to"',
    '"moved away from"',
    '"better than" AND "for"',
    '"left" AND "because"',
    '"migrated from"',
    '"replaced" AND "with"',
  ],
  workaround: [
    '"spreadsheet for"',
    '"using notion for"',
    '"zapier workaround"',
    '"manual way to"',
    '"copy paste" AND "every time"',
    '"built a script for"',
    '"three tools" AND "workflow"',
    '"manual process" AND "annoying"',
  ],
  adjacency: [
    '"like" AND "but for"',
    '"AI copilot for"',
    '"for teams" AND "like"',
    '"version of" AND "for"',
    '"for" AND "industry" AND "tool"',
    '"nobody has built" AND "for"',
  ],
}

export const ALL_SIGNAL_TYPES = Object.keys(SIGNAL_QUERIES) as SignalType[]

// Source affinity — which signal modes to run per source.
// Sources with a narrower content profile get a targeted subset.
export const SOURCE_AFFINITY: Record<ScanSource, SignalType[]> = {
  reddit:       ALL_SIGNAL_TYPES,
  hackernews:   ALL_SIGNAL_TYPES,
  stackoverflow: ALL_SIGNAL_TYPES,
  twitter:      ALL_SIGNAL_TYPES,
  linkedin:     ALL_SIGNAL_TYPES,
  indiehackers: ALL_SIGNAL_TYPES,
  producthunt:  ['success', 'pull', 'gap'],
  g2:           ['gap', 'success', 'switching'],
  capterra:     ['gap', 'success', 'switching'],
  github:       ['gap', 'workaround'],
  youtube:      ['pain', 'workaround', 'success'],
}
```

- [ ] **Step 2: Delete painQueries.ts**

```bash
rm src/opportunity-radar/constants/painQueries.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/opportunity-radar/constants/signalQueries.ts
git add -u src/opportunity-radar/constants/painQueries.ts
git commit -m "feat(radar): add 7-class signalQueries.ts with source affinity; delete painQueries.ts"
```

---

## Task 3: Update signalExtractor.ts and its test

**Files:**
- Modify: `src/opportunity-radar/services/signalExtractor.ts`
- Modify: `src/opportunity-radar/services/__tests__/signalExtractor.test.ts`

- [ ] **Step 1: Write the updated extractor test first**

Replace the entire test file:

```typescript
// src/opportunity-radar/services/__tests__/signalExtractor.test.ts
import { describe, it, expect } from 'vitest'
import { extractSignal, extractSignals } from '../signalExtractor.js'
import type { TaggedResult } from '../../types.js'

function makeTagged(overrides: Partial<TaggedResult> = {}): TaggedResult {
  return {
    source:     'reddit',
    url:        'https://reddit.com/r/test/1',
    title:      'Why is there no tool that automates expense tracking?',
    snippet:    'I hate how I have to manually enter every receipt into a spreadsheet every month',
    signalType: 'pain',
    queryUsed:  '"I hate how"',
    ...overrides,
  }
}

describe('extractSignal', () => {
  it('returns OpportunitySignal with signalType from tagged result', () => {
    const result = extractSignal(makeTagged({ signalType: 'gap' }))
    expect(result).not.toBeNull()
    expect(result!.signalType).toBe('gap')
  })

  it('sets rawText from snippet', () => {
    const result = extractSignal(makeTagged({ snippet: 'I hate manually entering data' }))
    expect(result!.rawText).toContain('entering data')
  })

  it('copies queryUsed from tagged result', () => {
    const result = extractSignal(makeTagged({ queryUsed: '"missing feature"' }))
    expect(result!.queryUsed).toBe('"missing feature"')
  })

  it('initialises jobToBeDone as empty string', () => {
    const result = extractSignal(makeTagged())
    expect(result!.jobToBeDone).toBe('')
  })

  it('returns null for very short snippets', () => {
    const result = extractSignal(makeTagged({ snippet: 'short' }))
    expect(result).toBeNull()
  })

  it('evidenceStrength is 0–10', () => {
    const result = extractSignal(makeTagged())
    expect(result!.evidenceStrength).toBeGreaterThanOrEqual(0)
    expect(result!.evidenceStrength).toBeLessThanOrEqual(10)
  })
})

describe('extractSignals', () => {
  it('processes an array and returns non-null signals', () => {
    const tagged = [makeTagged(), makeTagged({ snippet: 'x' })]
    const results = extractSignals(tagged)
    expect(results.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run src/opportunity-radar/services/__tests__/signalExtractor.test.ts 2>&1 | tail -20
```

Expected: FAIL — `extractSignal` has wrong signature.

- [ ] **Step 3: Rewrite signalExtractor.ts**

```typescript
// src/opportunity-radar/services/signalExtractor.ts
import type { TaggedResult, OpportunitySignal, SignalType } from '../types.js'

// Minimum snippet length to be worth extracting (avoids noise from stubs).
const MIN_TEXT_LEN = 30

// High-signal phrases that lift evidenceStrength.
const INTENSITY_BOOSTS: string[] = [
  'i hate', 'frustrated', 'annoying', 'terrible', 'broken', 'waste',
  'every time', 'manually', 'spreadsheet', 'no solution', 'wish',
  'missing feature', 'feature request', 'workaround', 'switched from',
  'nobody has built', 'looking for',
]

function computeEvidenceStrength(text: string): number {
  const lower = text.toLowerCase()
  let score = 4 // baseline
  for (const phrase of INTENSITY_BOOSTS) {
    if (lower.includes(phrase)) score = Math.min(10, score + 1)
  }
  return score
}

function extractKeyTerms(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
  const stopwords = new Set([
    'that', 'this', 'with', 'have', 'from', 'they', 'been', 'were',
    'into', 'just', 'like', 'more', 'some', 'when', 'will', 'also',
  ])
  const unique = [...new Set(words.filter((w) => !stopwords.has(w)))]
  return unique.slice(0, 12)
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

export function extractSignal(result: TaggedResult): OpportunitySignal | null {
  const rawText = `${result.title} ${result.snippet}`.trim()
  if (rawText.length < MIN_TEXT_LEN) return null

  return {
    id:               `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    detectedAt:       new Date().toISOString(),
    source:           result.source,
    sourceUrl:        result.url,
    author:           result.author,
    signalType:       result.signalType,
    rawText,
    normalizedText:   normalise(rawText),
    keyTerms:         extractKeyTerms(rawText),
    jobToBeDone:      '',
    tags:             [],
    evidenceStrength: computeEvidenceStrength(rawText),
    queryUsed:        result.queryUsed,
  }
}

export function extractSignals(results: TaggedResult[]): OpportunitySignal[] {
  return results.flatMap((r) => {
    const s = extractSignal(r)
    return s ? [s] : []
  })
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/opportunity-radar/services/__tests__/signalExtractor.test.ts 2>&1 | tail -10
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/opportunity-radar/services/signalExtractor.ts \
        src/opportunity-radar/services/__tests__/signalExtractor.test.ts
git commit -m "feat(radar): signalExtractor accepts TaggedResult, emits OpportunitySignal"
```

---

## Task 4: Update clusterService.ts and its test

**Files:**
- Modify: `src/opportunity-radar/services/clusterService.ts`
- Modify: `src/opportunity-radar/services/__tests__/clusterService.test.ts`

- [ ] **Step 1: Update the cluster test factories**

Open `src/opportunity-radar/services/__tests__/clusterService.test.ts` and replace every occurrence of the old `makeSignal` factory with:

```typescript
import type { OpportunitySignal, OpportunityCluster } from '../../types.js'

function makeSignal(overrides: Partial<OpportunitySignal> = {}): OpportunitySignal {
  return {
    id:               `sig_${Math.random().toString(36).slice(2)}`,
    detectedAt:       new Date().toISOString(),
    source:           'reddit',
    sourceUrl:        'https://reddit.com/r/test/1',
    signalType:       'pain',
    rawText:          'I hate how I have to manually enter data',
    normalizedText:   'i hate how i have to manually enter data',
    keyTerms:         ['hate', 'manually', 'enter', 'data'],
    jobToBeDone:      '',
    tags:             [],
    evidenceStrength: 5,
    queryUsed:        '"I hate how"',
    ...overrides,
  }
}
```

Remove any reference to `painType`, `intensityScore`, or `painText` in the test file. Replace with `signalType`, `evidenceStrength`, and `rawText` respectively.

- [ ] **Step 2: Run existing cluster tests to see what fails**

```bash
npx vitest run src/opportunity-radar/services/__tests__/clusterService.test.ts 2>&1 | tail -20
```

- [ ] **Step 3: Update clusterService.ts**

In `src/opportunity-radar/services/clusterService.ts`:

a) Change all `PainSignal` imports to `OpportunitySignal` from `../types.js`
b) Remove all references to `signal.painType` and `cluster.painTheme`
c) Add `signalTypeBreakdown` tracking in the cluster build/update logic:

```typescript
// After building or updating a cluster's signalIds list, recompute breakdown:
function computeSignalTypeBreakdown(
  signalIds: string[],
  allSignals: OpportunitySignal[],
): Partial<Record<import('../types.js').SignalType, number>> {
  const breakdown: Partial<Record<import('../types.js').SignalType, number>> = {}
  for (const id of signalIds) {
    const s = allSignals.find((x) => x.id === id)
    if (!s) continue
    breakdown[s.signalType] = (breakdown[s.signalType] ?? 0) + 1
  }
  return breakdown
}
```

d) In the cluster object construction, add:
```typescript
signalTypeBreakdown: computeSignalTypeBreakdown(cluster.signalIds, allSignals),
status: cluster.status ?? 'emerging',
```

e) Remove any `painTheme` field from cluster objects — that field no longer exists.

- [ ] **Step 4: Run cluster tests — expect pass**

```bash
npx vitest run src/opportunity-radar/services/__tests__/clusterService.test.ts 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/opportunity-radar/services/clusterService.ts \
        src/opportunity-radar/services/__tests__/clusterService.test.ts
git commit -m "feat(radar): clusterService tracks signalTypeBreakdown, drops painTheme"
```

---

## Task 5: Rewrite opportunityScorer.ts and its test

**Files:**
- Modify: `src/opportunity-radar/services/opportunityScorer.ts`
- Modify: `src/opportunity-radar/services/__tests__/opportunityScorer.test.ts`

- [ ] **Step 1: Write the rewritten test**

Replace the entire test file:

```typescript
// src/opportunity-radar/services/__tests__/opportunityScorer.test.ts
import { describe, it, expect } from 'vitest'
import { scoreCluster, qualifies, getTopN } from '../opportunityScorer.js'
import type { OpportunitySignal, OpportunityCluster } from '../../types.js'

function makeSignal(overrides: Partial<OpportunitySignal> = {}): OpportunitySignal {
  return {
    id:               `s_${Math.random().toString(36).slice(2)}`,
    detectedAt:       new Date().toISOString(),
    source:           'reddit',
    sourceUrl:        'https://reddit.com/1',
    signalType:       'pain',
    rawText:          'I hate this manual process every time',
    normalizedText:   'i hate this manual process every time',
    keyTerms:         ['hate', 'manual', 'process'],
    jobToBeDone:      '',
    tags:             [],
    evidenceStrength: 6,
    queryUsed:        '"I hate"',
    ...overrides,
  }
}

function makeCluster(
  signalIds: string[],
  overrides: Partial<OpportunityCluster> = {},
): OpportunityCluster {
  return {
    id:                  'c1',
    createdAt:           new Date().toISOString(),
    updatedAt:           new Date().toISOString(),
    keyTerms:            ['manual', 'process'],
    signalIds,
    signalCount:         signalIds.length,
    sources:             ['reddit'],
    sourceCount:         1,
    opportunityScore:    0,
    isBuildable:         true,
    signalTypeBreakdown: { pain: signalIds.length },
    status:              'emerging',
    ...overrides,
  }
}

describe('qualifies', () => {
  it('passes with ≥3 signals, ≥1 source, not blocked', () => {
    const sigs = [makeSignal(), makeSignal(), makeSignal()]
    const c = makeCluster(sigs.map((s) => s.id))
    expect(qualifies(c, sigs)).toBe(true)
  })

  it('fails with <3 signals', () => {
    const sigs = [makeSignal(), makeSignal()]
    const c = makeCluster(sigs.map((s) => s.id))
    expect(qualifies(c, sigs)).toBe(false)
  })

  it('fails when status is blocked', () => {
    const sigs = [makeSignal(), makeSignal(), makeSignal(), makeSignal()]
    const c = makeCluster(sigs.map((s) => s.id), { status: 'blocked' })
    expect(qualifies(c, sigs)).toBe(false)
  })

  it('fails signals older than 90 days', () => {
    const old = new Date(Date.now() - 91 * 86_400_000).toISOString()
    const sigs = [makeSignal({ detectedAt: old }), makeSignal({ detectedAt: old }), makeSignal({ detectedAt: old })]
    const c = makeCluster(sigs.map((s) => s.id))
    expect(qualifies(c, sigs)).toBe(false)
  })
})

describe('scoreCluster', () => {
  it('returns a number 0–100', () => {
    const sigs = [makeSignal(), makeSignal(), makeSignal()]
    const c = makeCluster(sigs.map((s) => s.id))
    const score = scoreCluster(c, sigs)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('scores higher with pull + success signals than pain only', () => {
    const painSigs = Array.from({ length: 5 }, () => makeSignal({ signalType: 'pain', evidenceStrength: 5 }))
    const mixedSigs = [
      makeSignal({ signalType: 'pull', evidenceStrength: 5 }),
      makeSignal({ signalType: 'pull', evidenceStrength: 5 }),
      makeSignal({ signalType: 'success', evidenceStrength: 5 }),
      makeSignal({ signalType: 'pain', evidenceStrength: 5 }),
      makeSignal({ signalType: 'gap', evidenceStrength: 5 }),
    ]
    const cPain = makeCluster(painSigs.map((s) => s.id), { signalTypeBreakdown: { pain: 5 } })
    const cMixed = makeCluster(mixedSigs.map((s) => s.id), {
      signalTypeBreakdown: { pull: 2, success: 1, pain: 1, gap: 1 },
    })
    expect(scoreCluster(cMixed, mixedSigs)).toBeGreaterThan(scoreCluster(cPain, painSigs))
  })
})

describe('getTopN', () => {
  it('returns top N by opportunityScore', () => {
    const sigs = [makeSignal(), makeSignal(), makeSignal()]
    const ids = sigs.map((s) => s.id)
    const clusters: OpportunityCluster[] = [
      makeCluster(ids, { id: 'a', opportunityScore: 80, signalCount: 3 }),
      makeCluster(ids, { id: 'b', opportunityScore: 60, signalCount: 3 }),
      makeCluster(ids, { id: 'c', opportunityScore: 40, signalCount: 3 }),
    ]
    const top2 = getTopN(2, clusters, sigs)
    expect(top2).toHaveLength(2)
    expect(top2[0].id).toBe('a')
    expect(top2[1].id).toBe('b')
  })

  it('excludes blocked clusters', () => {
    const sigs = [makeSignal(), makeSignal(), makeSignal()]
    const ids = sigs.map((s) => s.id)
    const clusters: OpportunityCluster[] = [
      makeCluster(ids, { id: 'a', opportunityScore: 90, signalCount: 3 }),
      makeCluster(ids, { id: 'b', opportunityScore: 70, status: 'blocked', signalCount: 3 }),
    ]
    const top = getTopN(3, clusters, sigs)
    expect(top.map((c) => c.id)).not.toContain('b')
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run src/opportunity-radar/services/__tests__/opportunityScorer.test.ts 2>&1 | tail -20
```

- [ ] **Step 3: Rewrite opportunityScorer.ts**

```typescript
// src/opportunity-radar/services/opportunityScorer.ts
import type { OpportunityCluster, OpportunitySignal, SignalType } from '../types.js'

const RECENCY_MS = 90 * 86_400_000

// BUILDABILITY_REGEX — topics that can't be built as software.
const BUILDABILITY_REGEX =
  /\b(physical product|hardware|manufacture|factory|warehouse|logistics|delivery driver|restaurant|medical device|medication|prescription)\b/i

// ── qualifies() ───────────────────────────────────────────────────────────────
// Gate: cluster must pass this before showing in UI or thesis generation.
export function qualifies(cluster: OpportunityCluster, signals: OpportunitySignal[]): boolean {
  if (cluster.status === 'blocked') return false
  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))
  if (clusterSignals.length < 3) return false
  const cutoff = Date.now() - RECENCY_MS
  const recent = clusterSignals.filter((s) => new Date(s.detectedAt).getTime() > cutoff)
  if (recent.length < 3) return false
  return true
}

// ── applyBuildabilityFilter() ─────────────────────────────────────────────────
export function applyBuildabilityFilter(
  cluster: OpportunityCluster,
  signals: OpportunitySignal[],
): boolean {
  const text = signals
    .filter((s) => cluster.signalIds.includes(s.id))
    .map((s) => s.rawText)
    .join(' ')
  return !BUILDABILITY_REGEX.test(text)
}

// ── scoreCluster() ────────────────────────────────────────────────────────────
// 8-component weighted formula. All components normalised to 0–10 first.
// Final score: 0–100.
export function scoreCluster(
  cluster: OpportunityCluster,
  signals: OpportunitySignal[],
): number {
  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))
  if (clusterSignals.length === 0) return 0

  const breakdown = cluster.signalTypeBreakdown ?? {}

  function countOf(type: SignalType): number {
    return breakdown[type] ?? 0
  }

  function norm(value: number, max: number): number {
    return Math.min(10, (value / max) * 10)
  }

  const pullCount    = countOf('pull') + countOf('success')
  const painAvg      = clusterSignals
    .filter((s) => s.signalType === 'pain')
    .reduce((sum, s, _, a) => sum + s.evidenceStrength / a.length, 0) || 0
  const successCount = countOf('success')
  const gapCount     = countOf('gap')
  const switchCount  = countOf('switching')
  const workaroundCount = countOf('workaround')
  const distinctTypes = Object.keys(breakdown).length

  const demand       = norm(pullCount, 10)
  const pain         = norm(painAvg, 10)
  const validation   = norm(successCount, 5)
  const gap          = norm(gapCount, 5)
  const switching    = norm(switchCount, 5)
  const workaround   = norm(workaroundCount, 5)
  const wedgeClarity = norm(distinctTypes, 7)
  const buildability = cluster.isBuildable ? 10 : 0

  const score =
    demand       * 0.20 +
    pain         * 0.15 +
    validation   * 0.15 +
    gap          * 0.15 +
    switching    * 0.10 +
    workaround   * 0.10 +
    wedgeClarity * 0.10 +
    buildability * 0.05

  return Math.round(Math.min(100, score * 10))
}

// ── getTopN() ─────────────────────────────────────────────────────────────────
export function getTopN(
  n: number,
  clusters: OpportunityCluster[],
  signals: OpportunitySignal[],
): OpportunityCluster[] {
  return clusters
    .filter((c) => qualifies(c, signals))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, n)
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/opportunity-radar/services/__tests__/opportunityScorer.test.ts 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/opportunity-radar/services/opportunityScorer.ts \
        src/opportunity-radar/services/__tests__/opportunityScorer.test.ts
git commit -m "feat(radar): 8-component opportunityScorer; qualifies() relaxed; getTopN()"
```

---

## Task 6: Create wedgeClassifier.ts and its test

**Files:**
- Create: `src/opportunity-radar/services/wedgeClassifier.ts`
- Create: `src/opportunity-radar/services/__tests__/wedgeClassifier.test.ts`

- [ ] **Step 1: Write the test first**

```typescript
// src/opportunity-radar/services/__tests__/wedgeClassifier.test.ts
import { describe, it, expect } from 'vitest'
import { classifyWedge } from '../wedgeClassifier.js'
import type { OpportunityCluster } from '../../types.js'

function makeCluster(breakdown: Record<string, number>): OpportunityCluster {
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0)
  return {
    id: 'c1', createdAt: '', updatedAt: '', keyTerms: [], signalIds: [],
    signalCount: total, sources: ['reddit'], sourceCount: 1,
    opportunityScore: 0, isBuildable: true,
    signalTypeBreakdown: breakdown as any,
    status: 'emerging',
  }
}

describe('classifyWedge', () => {
  it('returns switching-wedge when switching > 30%', () => {
    expect(classifyWedge(makeCluster({ switching: 4, pain: 6 }))).toBe('switching-wedge')
  })

  it('returns workaround-to-product when workaround > 30%', () => {
    expect(classifyWedge(makeCluster({ workaround: 4, pain: 6 }))).toBe('workaround-to-product')
  })

  it('returns pattern-transfer when adjacency > 30%', () => {
    expect(classifyWedge(makeCluster({ adjacency: 4, pain: 6 }))).toBe('pattern-transfer')
  })

  it('returns underserved-winner when success > 25% and gap > 15%', () => {
    expect(classifyWedge(makeCluster({ success: 3, gap: 2, pain: 5 }))).toBe('underserved-winner')
  })

  it('defaults to emerging-pull', () => {
    expect(classifyWedge(makeCluster({ pain: 5, pull: 5 }))).toBe('emerging-pull')
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run src/opportunity-radar/services/__tests__/wedgeClassifier.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Implement wedgeClassifier.ts**

```typescript
// src/opportunity-radar/services/wedgeClassifier.ts
import type { OpportunityCluster, WedgeType, SignalType } from '../types.js'

export function classifyWedge(cluster: OpportunityCluster): WedgeType {
  const total = cluster.signalCount || 1
  const breakdown = cluster.signalTypeBreakdown ?? {}

  function ratio(type: SignalType): number {
    return (breakdown[type] ?? 0) / total
  }

  if (ratio('switching')  > 0.30) return 'switching-wedge'
  if (ratio('workaround') > 0.30) return 'workaround-to-product'
  if (ratio('adjacency')  > 0.30) return 'pattern-transfer'
  if (ratio('success')    > 0.25 && ratio('gap') > 0.15) return 'underserved-winner'
  return 'emerging-pull'
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run src/opportunity-radar/services/__tests__/wedgeClassifier.test.ts 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/opportunity-radar/services/wedgeClassifier.ts \
        src/opportunity-radar/services/__tests__/wedgeClassifier.test.ts
git commit -m "feat(radar): add deterministic wedgeClassifier"
```

---

## Task 7: Create multiSignalSearchService.ts and delete painSearchService.ts

**Files:**
- Create: `src/opportunity-radar/services/multiSignalSearchService.ts`
- Create: `src/opportunity-radar/services/__tests__/multiSignalSearchService.test.ts`
- Delete: `src/opportunity-radar/services/painSearchService.ts`

- [ ] **Step 1: Write the service test**

```typescript
// src/opportunity-radar/services/__tests__/multiSignalSearchService.test.ts
import { describe, it, expect } from 'vitest'
import { getModesForSource } from '../multiSignalSearchService.js'

describe('getModesForSource', () => {
  it('returns all 7 modes for reddit', () => {
    expect(getModesForSource('reddit')).toHaveLength(7)
  })

  it('returns only gap and workaround for github', () => {
    const modes = getModesForSource('github')
    expect(modes).toContain('gap')
    expect(modes).toContain('workaround')
    expect(modes).not.toContain('pain')
    expect(modes).not.toContain('pull')
  })

  it('returns success, pull, gap for producthunt', () => {
    const modes = getModesForSource('producthunt')
    expect(modes).toEqual(expect.arrayContaining(['success', 'pull', 'gap']))
    expect(modes).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run src/opportunity-radar/services/__tests__/multiSignalSearchService.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Create multiSignalSearchService.ts**

The service reuses the same per-source fetch logic from the old `painSearchService.ts` — copy the source-specific mappers and the `pLimit` concurrency helper, then add the mode loop and tag each result.

```typescript
// src/opportunity-radar/services/multiSignalSearchService.ts
import type { ScanSource, SignalType, RawSearchResult, TaggedResult } from '../types.js'
import { SIGNAL_QUERIES, SOURCE_AFFINITY } from '../constants/signalQueries.js'

// ─── re-export constants so OpportunityRadar.jsx can use them ─────────────────
export const ALL_SOURCES: ScanSource[] = [
  'reddit', 'hackernews', 'stackoverflow', 'twitter', 'linkedin',
  'indiehackers', 'producthunt', 'g2', 'capterra', 'github', 'youtube',
]

export const SOURCE_LABELS: Record<ScanSource, string> = {
  reddit:       'Reddit',
  hackernews:   'Hacker News',
  stackoverflow: 'Stack Overflow',
  twitter:      'Twitter/X',
  linkedin:     'LinkedIn',
  indiehackers: 'Indie Hackers',
  producthunt:  'Product Hunt',
  g2:           'G2',
  capterra:     'Capterra',
  github:       'GitHub',
  youtube:      'YouTube',
}

export type ScanProgress = {
  source:      ScanSource
  status:      'pending' | 'running' | 'done' | 'error'
  resultCount?: number
  signalType?: SignalType
}

export type ProgressCallback = (p: ScanProgress) => void

// Exported for unit tests.
export function getModesForSource(source: ScanSource): SignalType[] {
  return SOURCE_AFFINITY[source]
}

// ─── pLimit — simple concurrency limiter ──────────────────────────────────────
function pLimit(concurrency: number) {
  let active = 0
  const queue: (() => void)[] = []
  function next() {
    if (active >= concurrency || queue.length === 0) return
    active++
    queue.shift()!()
  }
  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      queue.push(() =>
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => { active--; next() }),
      )
      next()
    })
  }
}

// ─── SearXNG search helper ────────────────────────────────────────────────────
// Mirrors the logic from the old painSearchService — calls the /api/searxng proxy.
async function searxngSearch(query: string, source: ScanSource): Promise<RawSearchResult[]> {
  const siteMap: Partial<Record<ScanSource, string>> = {
    reddit:       'site:reddit.com',
    hackernews:   'site:news.ycombinator.com',
    stackoverflow: 'site:stackoverflow.com',
    twitter:      'site:twitter.com OR site:x.com',
    linkedin:     'site:linkedin.com',
    indiehackers: 'site:indiehackers.com',
    producthunt:  'site:producthunt.com',
    g2:           'site:g2.com',
    capterra:     'site:capterra.com',
    github:       'site:github.com',
    youtube:      'site:youtube.com',
  }
  const site = siteMap[source] ?? ''
  const fullQuery = site ? `${query} ${site}` : query

  try {
    const params = new URLSearchParams({
      q: fullQuery,
      format: 'json',
      language: 'en',
      time_range: '3m',
      categories: 'general',
    })
    const res = await fetch(`/api/searxng/search?${params}`, { method: 'GET' })
    if (!res.ok) return []
    const json = await res.json()
    return (json.results ?? []).slice(0, 5).map((r: any) => ({
      source,
      url:         r.url ?? '',
      title:       r.title ?? '',
      snippet:     r.content ?? '',
      publishedAt: r.publishedDate,
    }))
  } catch {
    return []
  }
}

// ─── runMultiSignalSearch ─────────────────────────────────────────────────────
export async function runMultiSignalSearch(
  sources: ScanSource[] = ALL_SOURCES,
  onProgress: ProgressCallback = () => {},
): Promise<TaggedResult[]> {
  const limit = pLimit(5)
  const allResults: TaggedResult[] = []

  const tasks = sources.map((source) =>
    limit(async () => {
      onProgress({ source, status: 'running' })
      const modes = getModesForSource(source)
      const seenUrls = new Set<string>()
      const sourceResults: TaggedResult[] = []

      for (const mode of modes) {
        const queries = SIGNAL_QUERIES[mode]
        for (const q of queries) {
          const raw = await searxngSearch(q, source)
          for (const r of raw) {
            if (seenUrls.has(r.url)) continue
            seenUrls.add(r.url)
            sourceResults.push({ ...r, signalType: mode, queryUsed: q })
          }
        }
      }

      allResults.push(...sourceResults)
      onProgress({ source, status: 'done', resultCount: sourceResults.length })
    }).catch(() => {
      onProgress({ source, status: 'error' })
    }),
  )

  await Promise.all(tasks)
  return allResults
}
```

- [ ] **Step 4: Delete painSearchService.ts**

```bash
rm src/opportunity-radar/services/painSearchService.ts
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npx vitest run src/opportunity-radar/services/__tests__/multiSignalSearchService.test.ts 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/opportunity-radar/services/multiSignalSearchService.ts \
        src/opportunity-radar/services/__tests__/multiSignalSearchService.test.ts
git add -u src/opportunity-radar/services/painSearchService.ts
git commit -m "feat(radar): multiSignalSearchService with 7-mode source affinity; delete painSearchService"
```

---

## Task 8: Update radarStorage.ts

**Files:**
- Modify: `src/opportunity-radar/storage/radarStorage.ts`

- [ ] **Step 1: Rewrite radarStorage.ts**

Replace the entire file:

```typescript
// src/opportunity-radar/storage/radarStorage.ts
import type {
  OpportunitySignal, OpportunityCluster, OpportunityThesis, RadarScanMeta,
} from '../types.js'

// ── Storage keys (v2 — old keys abandoned) ────────────────────────────────────
const KEYS = {
  signals:  'fm_radar_signals_v2',
  clusters: 'fm_radar_clusters_v2',
  theses:   'fm_radar_theses',
  meta:     'fm_radar_meta',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch { return fallback }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// ── Signals ───────────────────────────────────────────────────────────────────
export function loadSignals(): OpportunitySignal[] {
  return read(KEYS.signals, [])
}

export function appendSignals(newSignals: OpportunitySignal[]): void {
  const existing = loadSignals()
  const seenIds = new Set(existing.map((s) => s.id))
  const deduped = newSignals.filter((s) => !seenIds.has(s.id))
  write(KEYS.signals, [...existing, ...deduped])
}

// ── Clusters ──────────────────────────────────────────────────────────────────
export function loadClusters(): OpportunityCluster[] {
  return read(KEYS.clusters, [])
}

export function saveClusters(clusters: OpportunityCluster[]): void {
  write(KEYS.clusters, clusters)
}

export function blockCluster(id: string): void {
  const clusters = loadClusters()
  saveClusters(clusters.map((c) =>
    c.id === id ? { ...c, status: 'blocked', blockedAt: new Date().toISOString() } : c,
  ))
}

export function unblockCluster(id: string): void {
  const clusters = loadClusters()
  saveClusters(clusters.map((c) =>
    c.id === id ? { ...c, status: 'emerging', blockedAt: undefined } : c,
  ))
}

// ── Theses ────────────────────────────────────────────────────────────────────
export function loadTheses(): OpportunityThesis[] {
  return read(KEYS.theses, [])
}

export function saveThesis(thesis: OpportunityThesis): void {
  const existing = loadTheses().filter((t) => t.clusterId !== thesis.clusterId)
  write(KEYS.theses, [...existing, thesis])
}

// ── Meta ──────────────────────────────────────────────────────────────────────
export function loadMeta(): RadarScanMeta | null {
  return read(KEYS.meta, null)
}

export function saveMeta(meta: RadarScanMeta): void {
  write(KEYS.meta, meta)
}

// ── Reset ─────────────────────────────────────────────────────────────────────
export function clearAll(): void {
  Object.values(KEYS).forEach((k) => {
    try { localStorage.removeItem(k) } catch {}
  })
}

const radarStorage = {
  loadSignals, appendSignals,
  loadClusters, saveClusters, blockCluster, unblockCluster,
  loadTheses, saveThesis,
  loadMeta, saveMeta,
  clearAll,
}
export default radarStorage
```

- [ ] **Step 2: Commit**

```bash
git add src/opportunity-radar/storage/radarStorage.ts
git commit -m "feat(radar): radarStorage v2 keys, theses support, blockCluster/unblockCluster"
```

---

## Task 9: Create thesisGenerator.ts and its test

**Files:**
- Create: `src/opportunity-radar/services/thesisGenerator.ts`
- Create: `src/opportunity-radar/services/__tests__/thesisGenerator.test.ts`
- Delete: `src/opportunity-radar/services/conceptGenerator.ts`

- [ ] **Step 1: Write the test first**

```typescript
// src/opportunity-radar/services/__tests__/thesisGenerator.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OpportunitySignal, OpportunityCluster } from '../../types.js'

// Mock chatJson to return null — tests template fallback path.
vi.mock('../../../lib/llm/ollama.js', () => ({
  chatJson: vi.fn().mockResolvedValue(null),
}))

// Import AFTER mocking.
const { generateThesis } = await import('../thesisGenerator.js')

function makeSignal(overrides: Partial<OpportunitySignal> = {}): OpportunitySignal {
  return {
    id: `s_${Math.random().toString(36).slice(2)}`,
    detectedAt: new Date().toISOString(),
    source: 'reddit',
    sourceUrl: 'https://reddit.com/1',
    signalType: 'pain',
    rawText: 'I hate manually tracking expenses in spreadsheets every month',
    normalizedText: 'i hate manually tracking expenses in spreadsheets every month',
    keyTerms: ['hate', 'manually', 'tracking', 'expenses', 'spreadsheets'],
    jobToBeDone: '',
    tags: [],
    evidenceStrength: 6,
    queryUsed: '"I hate how"',
    ...overrides,
  }
}

function makeCluster(signals: OpportunitySignal[]): OpportunityCluster {
  return {
    id: 'c1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    keyTerms: ['expense', 'tracking', 'spreadsheet'],
    signalIds: signals.map((s) => s.id),
    signalCount: signals.length,
    sources: ['reddit'],
    sourceCount: 1,
    opportunityScore: 65,
    isBuildable: true,
    signalTypeBreakdown: { pain: signals.length },
    status: 'emerging',
  }
}

describe('generateThesis (template fallback)', () => {
  it('returns an OpportunityThesis when chatJson returns null', async () => {
    const signals = Array.from({ length: 5 }, () => makeSignal())
    const cluster = makeCluster(signals)
    const thesis = await generateThesis(cluster, signals)
    expect(thesis).not.toBeNull()
    expect(thesis.clusterId).toBe('c1')
    expect(thesis.generatedBy).toBe('template')
  })

  it('thesis has required fields', async () => {
    const signals = Array.from({ length: 4 }, () => makeSignal())
    const cluster = makeCluster(signals)
    const thesis = await generateThesis(cluster, signals)
    expect(thesis.title).toBeTruthy()
    expect(thesis.wedgeType).toBeTruthy()
    expect(Array.isArray(thesis.recommendedMvp)).toBe(true)
    expect(Array.isArray(thesis.incumbentWeaknesses)).toBe(true)
  })

  it('backfills jobToBeDone on signals when thesis is built', async () => {
    const signals = Array.from({ length: 4 }, () => makeSignal())
    const cluster = makeCluster(signals)
    const thesis = await generateThesis(cluster, signals)
    // After generation, all signals in the cluster have jobToBeDone filled
    for (const s of signals) {
      expect(s.jobToBeDone).toBe(thesis.jobToBeDone)
    }
  })
})
```

- [ ] **Step 2: Run test — expect fail**

```bash
npx vitest run src/opportunity-radar/services/__tests__/thesisGenerator.test.ts 2>&1 | tail -20
```

- [ ] **Step 3: Create thesisGenerator.ts**

```typescript
// src/opportunity-radar/services/thesisGenerator.ts
import type { OpportunityCluster, OpportunitySignal, OpportunityThesis, WedgeType } from '../types.js'
import { classifyWedge } from './wedgeClassifier.js'
import { chatJson } from '../../lib/llm/ollama.js'

// ─── template fallback ────────────────────────────────────────────────────────
function buildTemplateThesis(
  cluster: OpportunityCluster,
  signals: OpportunitySignal[],
  wedgeType: WedgeType,
): OpportunityThesis {
  const topTerms = cluster.keyTerms.slice(0, 3).join(', ')
  const now = new Date().toISOString()
  return {
    id:                  `thesis_${cluster.id}_${Date.now()}`,
    clusterId:           cluster.id,
    title:               `Opportunity: ${topTerms}`,
    jobToBeDone:         `Help users with ${topTerms}`,
    targetUser:          'Knowledge workers and indie developers',
    niche:               topTerms,
    wedgeType,
    summary:             `${signals.length} signals indicate unmet demand around ${topTerms}.`,
    whyNow:              'Growing community frustration with current manual approaches.',
    currentAlternatives: ['Spreadsheets', 'Manual processes', 'Cobbled-together tools'],
    incumbentWeaknesses: ['Poor automation', 'No integrations', 'Too complex for solo users'],
    proofSignals:        signals.slice(0, 3).map((s) => s.rawText.slice(0, 80)),
    evidenceCount:       signals.length,
    buildabilityScore:   cluster.isBuildable ? 70 : 30,
    demandScore:         Math.min(100, signals.length * 10),
    competitionPressure: 40,
    wedgeClarityScore:   60,
    recommendedMvp:      [
      `Build a simple ${topTerms} tracker`,
      'Add one-click automation for the most painful step',
      'Integrate with tools users already use',
    ],
    generatedBy: 'template',
    status:      'new',
    createdAt:   now,
    updatedAt:   now,
  }
}

// ─── Ollama prompt ────────────────────────────────────────────────────────────
function buildPrompt(cluster: OpportunityCluster, signals: OpportunitySignal[]): string {
  const sampleTexts = signals
    .slice(0, 10)
    .map((s, i) => `${i + 1}. [${s.signalType}] ${s.rawText.slice(0, 150)}`)
    .join('\n')
  return [
    'You are an opportunity analyst. Given these market signals, generate a JSON thesis.',
    '',
    `Key terms: ${cluster.keyTerms.join(', ')}`,
    `Signal count: ${signals.length}`,
    `Signals:`,
    sampleTexts,
    '',
    'Return JSON with these exact keys:',
    '{ "jobToBeDone": string, "targetUser": string, "niche": string, "summary": string,',
    '  "whyNow": string, "currentAlternatives": string[], "incumbentWeaknesses": string[],',
    '  "proofSignals": string[], "recommendedMvp": string[] }',
    '',
    'Keep each string under 120 characters. Arrays: 2-4 items. No markdown.',
  ].join('\n')
}

// ─── generateThesis() ─────────────────────────────────────────────────────────
export async function generateThesis(
  cluster: OpportunityCluster,
  allSignals: OpportunitySignal[],
  opts: { signal?: AbortSignal } = {},
): Promise<OpportunityThesis> {
  const clusterSignals = allSignals.filter((s) => cluster.signalIds.includes(s.id))
  const wedgeType = classifyWedge(cluster)
  const now = new Date().toISOString()

  // Numeric scores come from the scorer, not Ollama.
  const buildabilityScore = cluster.isBuildable ? 70 : 20
  const demandScore       = Math.min(100, clusterSignals.length * 8)
  const competitionPressure = 40
  const wedgeClarityScore   = Math.min(100, Object.keys(cluster.signalTypeBreakdown ?? {}).length * 14)

  // Attempt Ollama — falls back gracefully to template.
  const messages = [{ role: 'user' as const, content: buildPrompt(cluster, clusterSignals) }]
  const parsed = await chatJson(messages, { signal: opts.signal, temperature: 0.2 }).catch(() => null)

  let thesis: OpportunityThesis

  if (
    parsed &&
    typeof parsed.jobToBeDone === 'string' &&
    typeof parsed.summary === 'string' &&
    Array.isArray(parsed.recommendedMvp)
  ) {
    thesis = {
      id:                  `thesis_${cluster.id}_${Date.now()}`,
      clusterId:           cluster.id,
      title:               parsed.niche ? `Opportunity: ${parsed.niche}` : `Opportunity: ${cluster.keyTerms[0]}`,
      jobToBeDone:         String(parsed.jobToBeDone).slice(0, 200),
      targetUser:          String(parsed.targetUser ?? 'Knowledge workers').slice(0, 150),
      niche:               String(parsed.niche ?? cluster.keyTerms[0]).slice(0, 100),
      wedgeType,
      summary:             String(parsed.summary).slice(0, 300),
      whyNow:              String(parsed.whyNow ?? '').slice(0, 200),
      currentAlternatives: (parsed.currentAlternatives as string[]).slice(0, 4).map((s) => String(s).slice(0, 100)),
      incumbentWeaknesses: (parsed.incumbentWeaknesses as string[]).slice(0, 4).map((s) => String(s).slice(0, 100)),
      proofSignals:        (parsed.proofSignals as string[]).slice(0, 4).map((s) => String(s).slice(0, 120)),
      evidenceCount:       clusterSignals.length,
      buildabilityScore,
      demandScore,
      competitionPressure,
      wedgeClarityScore,
      recommendedMvp:      (parsed.recommendedMvp as string[]).slice(0, 4).map((s) => String(s).slice(0, 150)),
      generatedBy:         'ollama',
      status:              'new',
      createdAt:           now,
      updatedAt:           now,
    }
  } else {
    thesis = buildTemplateThesis(cluster, clusterSignals, wedgeType)
  }

  // Backfill jobToBeDone on all signals in cluster.
  for (const s of clusterSignals) {
    s.jobToBeDone = thesis.jobToBeDone
  }

  return thesis
}
```

- [ ] **Step 4: Delete conceptGenerator.ts**

```bash
rm src/opportunity-radar/services/conceptGenerator.ts
```

- [ ] **Step 5: Run tests — expect pass**

```bash
npx vitest run src/opportunity-radar/services/__tests__/thesisGenerator.test.ts 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add src/opportunity-radar/services/thesisGenerator.ts \
        src/opportunity-radar/services/__tests__/thesisGenerator.test.ts
git add -u src/opportunity-radar/services/conceptGenerator.ts
git commit -m "feat(radar): thesisGenerator with Ollama + template fallback; delete conceptGenerator"
```

---

## Task 10: Update aiOpportunityFilter.ts

**Files:**
- Modify: `src/opportunity-radar/services/aiOpportunityFilter.ts`

- [ ] **Step 1: Update field references**

Open `src/opportunity-radar/services/aiOpportunityFilter.ts` and apply these changes:

a) Replace the import: `PainSignal` → `OpportunitySignal` (from `../types.js`)
b) Find every `s.painText` and replace with `s.rawText`
c) Find every `PainSignal` type annotation and replace with `OpportunitySignal`

The logic otherwise stays the same — no behavioural changes.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit src/opportunity-radar/services/aiOpportunityFilter.ts 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/opportunity-radar/services/aiOpportunityFilter.ts
git commit -m "fix(radar): aiOpportunityFilter — painText→rawText, PainSignal→OpportunitySignal"
```

---

## Task 11: Update PatternTable.jsx

**Files:**
- Modify: `src/components/opportunity/PatternTable.jsx`

- [ ] **Step 1: Add signal-type colour map and wedge label map near top of file**

```jsx
// Signal type → colour pill classes
const SIGNAL_COLORS = {
  pain:       'bg-teal-400/10 text-teal-300',
  pull:       'bg-violet-400/10 text-violet-300',
  success:    'bg-amber-400/10 text-amber-300',
  gap:        'bg-orange-400/10 text-orange-300',
  switching:  'bg-red-400/10 text-red-300',
  workaround: 'bg-yellow-400/10 text-yellow-300',
  adjacency:  'bg-indigo-400/10 text-indigo-300',
}

const WEDGE_LABELS = {
  'underserved-winner':   'Underserved',
  'workaround-to-product': 'Workaround',
  'pattern-transfer':     'Pattern',
  'switching-wedge':      'Switching',
  'emerging-pull':        'Emerging',
}
```

- [ ] **Step 2: Add `showBlocked` state and "Blocked (N)" chip above table**

At the top of the `PatternTable` component (after the existing state declarations), add:

```jsx
const [showBlocked, setShowBlocked] = useState(false)

const blockedCount = clusters.filter((c) => c.status === 'blocked').length
const visibleClusters = showBlocked
  ? clusters
  : clusters.filter((c) => c.status !== 'blocked')
```

Above the `<table>` element, add the chip:

```jsx
{blockedCount > 0 && (
  <button
    onClick={() => setShowBlocked((v) => !v)}
    className={`text-xs px-2 py-0.5 rounded-full border mb-3 transition-colors ${
      showBlocked
        ? 'bg-white/10 text-white/60 border-white/20'
        : 'bg-white/[0.03] text-white/30 border-white/10 hover:text-white/50'
    }`}
  >
    Blocked ({blockedCount})
  </button>
)}
```

- [ ] **Step 3: Add Type and Wedge columns to the table header**

Find the `<thead>` row and add two columns after the existing "Score" column header and before the "Actions" column header:

```jsx
<th className="px-3 py-2 text-left text-[11px] font-medium text-white/30 uppercase tracking-wide">Type</th>
<th className="px-3 py-2 text-left text-[11px] font-medium text-white/30 uppercase tracking-wide">Wedge</th>
```

- [ ] **Step 4: Add Type pill, Wedge label, and Block button in each row**

In the row-rendering section, find where `concepts` / `Actions` column cells are rendered and:

a) Add the Type column cell (uses plurality type from `signalTypeBreakdown`):

```jsx
<td className="px-3 py-2">
  {(() => {
    const breakdown = cluster.signalTypeBreakdown ?? {}
    const pluralType = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0]?.[0]
    return pluralType ? (
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${SIGNAL_COLORS[pluralType] ?? 'bg-white/5 text-white/30'}`}>
        {pluralType}
      </span>
    ) : null
  })()}
</td>
```

b) Add the Wedge column cell:

```jsx
<td className="px-3 py-2 text-[11px] text-white/40">
  {cluster.wedgeType ? (WEDGE_LABELS[cluster.wedgeType] ?? cluster.wedgeType) : '—'}
</td>
```

c) In the Actions cell, add a Block button before the existing Generate/View buttons:

```jsx
<button
  onClick={() => onBlockCluster?.(cluster.id)}
  title="Block this pattern"
  className="p-1 rounded text-white/20 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
>
  ×
</button>
```

- [ ] **Step 5: Update the PatternTable props to accept `onBlockCluster`**

Add `onBlockCluster` to the props destructuring:

```jsx
export default function PatternTable({
  clusters, signals, concepts, theses,
  onGenerateConcept, onViewConcept, onViewEvidence,
  onBlockCluster,
  generatingFor,
}) {
```

Also change the cluster loop from `clusters` to `visibleClusters`:
```jsx
{visibleClusters.map((cluster) => (
```

- [ ] **Step 6: Commit**

```bash
git add src/components/opportunity/PatternTable.jsx
git commit -m "feat(radar): PatternTable — Type pill, Wedge column, Block button, Blocked chip"
```

---

## Task 12: Update RadarTopCard.jsx and EvidencePanel.jsx (field renames)

**Files:**
- Modify: `src/components/opportunity/RadarTopCard.jsx`
- Modify: `src/components/opportunity/EvidencePanel.jsx`

- [ ] **Step 1: Update RadarTopCard.jsx**

In `src/components/opportunity/RadarTopCard.jsx`:

a) Replace `cluster.avgIntensity` → `cluster.opportunityScore` (it already existed — verify no `avgIntensity` references remain)
b) Replace every `signal.painText` → `signal.rawText`
c) Replace every `signal.intensityScore` → `signal.evidenceStrength`
d) Any reference to `topSignal.painText` → `topSignal.rawText`

Run:
```bash
grep -n "painText\|intensityScore\|avgIntensity\|painType" src/components/opportunity/RadarTopCard.jsx
```
Every line found must be updated.

- [ ] **Step 2: Update EvidencePanel.jsx**

In `src/components/opportunity/EvidencePanel.jsx`:

a) Replace `s.intensityScore` → `s.evidenceStrength` (used in filter/sort logic, ~line 46-47)
b) Replace `signal.painText` → `signal.rawText` (used in display, ~line 120)
c) Replace `signal.intensityScore` → `signal.evidenceStrength` (used in display, ~line 121)

Run:
```bash
grep -n "painText\|intensityScore" src/components/opportunity/EvidencePanel.jsx
```
Verify zero results after updating.

- [ ] **Step 3: Commit**

```bash
git add src/components/opportunity/RadarTopCard.jsx \
        src/components/opportunity/EvidencePanel.jsx
git commit -m "fix(radar): RadarTopCard+EvidencePanel field renames — evidenceStrength/rawText"
```

---

## Task 13: Create ThesisCard.tsx and rewrite ConceptView.jsx

**Files:**
- Create: `src/components/opportunity/ThesisCard.tsx`
- Modify: `src/components/opportunity/ConceptView.jsx`

- [ ] **Step 1: Create ThesisCard.tsx**

```tsx
// src/components/opportunity/ThesisCard.tsx
import type { OpportunityThesis, OpportunityCluster, SignalType } from '../../opportunity-radar/types.js'

const WEDGE_COLORS: Record<string, string> = {
  'underserved-winner':   'bg-amber-400/10 text-amber-300 border-amber-400/20',
  'workaround-to-product': 'bg-yellow-400/10 text-yellow-300 border-yellow-400/20',
  'pattern-transfer':     'bg-indigo-400/10 text-indigo-300 border-indigo-400/20',
  'switching-wedge':      'bg-red-400/10 text-red-300 border-red-400/20',
  'emerging-pull':        'bg-teal-400/10 text-teal-300 border-teal-400/20',
}

const SIGNAL_COLORS: Record<string, string> = {
  pain:       'bg-teal-400/10 text-teal-300',
  pull:       'bg-violet-400/10 text-violet-300',
  success:    'bg-amber-400/10 text-amber-300',
  gap:        'bg-orange-400/10 text-orange-300',
  switching:  'bg-red-400/10 text-red-300',
  workaround: 'bg-yellow-400/10 text-yellow-300',
  adjacency:  'bg-indigo-400/10 text-indigo-300',
}

interface Props {
  thesis:           OpportunityThesis
  cluster:          OpportunityCluster
  onGenerateFull?:  () => void
  onBlock?:         () => void
  onViewEvidence?:  () => void
  generating?:      boolean
}

export default function ThesisCard({
  thesis, cluster, onGenerateFull, onBlock, onViewEvidence, generating = false,
}: Props) {
  const wedgeColor = WEDGE_COLORS[thesis.wedgeType] ?? 'bg-white/5 text-white/40 border-white/10'
  const breakdown  = cluster.signalTypeBreakdown ?? {}

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded border ${wedgeColor} font-medium`}>
              {thesis.wedgeType}
            </span>
            <span className="text-[10px] text-white/30">{thesis.generatedBy}</span>
          </div>
          <h3 className="text-sm font-semibold text-white/90 truncate">{thesis.title}</h3>
        </div>
        {/* Score bar */}
        <div className="flex-shrink-0 text-right">
          <div className="text-lg font-bold text-teal-400">{thesis.buildabilityScore}</div>
          <div className="text-[9px] text-white/30 uppercase tracking-wide">score</div>
          <div className="w-16 h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
            <div
              className="h-full rounded-full bg-teal-400/60"
              style={{ width: `${thesis.buildabilityScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* JTBD / Target / Why Now */}
      <div className="space-y-1.5">
        <p className="text-[11px] text-white/70"><span className="text-white/30">Job: </span>{thesis.jobToBeDone}</p>
        <p className="text-[11px] text-white/70"><span className="text-white/30">For: </span>{thesis.targetUser}</p>
        {thesis.whyNow && (
          <p className="text-[11px] text-white/60 italic">{thesis.whyNow}</p>
        )}
      </div>

      {/* Signal type breakdown pills */}
      {Object.keys(breakdown).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(Object.entries(breakdown) as [SignalType, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <span key={type} className={`text-[9px] px-1.5 py-0.5 rounded ${SIGNAL_COLORS[type] ?? 'bg-white/5 text-white/30'}`}>
                {type} ×{count}
              </span>
            ))}
        </div>
      )}

      {/* Incumbent weaknesses */}
      {thesis.incumbentWeaknesses.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-white/40 uppercase tracking-wide mb-1">
            Incumbent weaknesses
          </p>
          <ul className="space-y-0.5">
            {thesis.incumbentWeaknesses.slice(0, 3).map((w, i) => (
              <li key={i} className="text-[11px] text-white/60 flex gap-1.5">
                <span className="text-white/20 flex-shrink-0">·</span>{w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended MVP */}
      {thesis.recommendedMvp.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-white/40 uppercase tracking-wide mb-1">
            Recommended MVP
          </p>
          <ul className="space-y-0.5">
            {thesis.recommendedMvp.map((step, i) => (
              <li key={i} className="text-[11px] text-white/60 flex gap-1.5">
                <span className="text-white/30 flex-shrink-0 font-mono">{i + 1}.</span>{step}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-white/5">
        <button
          onClick={onGenerateFull}
          disabled={generating}
          className="flex-1 text-[11px] py-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-400/20
            hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {generating ? 'Generating…' : 'Full concept'}
        </button>
        <button
          onClick={onViewEvidence}
          className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.03] text-white/40 border border-white/10
            hover:bg-white/[0.06] hover:text-white/60 transition-colors"
        >
          Evidence
        </button>
        <button
          onClick={onBlock}
          title="Block this opportunity"
          className="text-[11px] px-3 py-1.5 rounded-lg bg-white/[0.03] text-white/20 border border-white/10
            hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-400/20 transition-colors"
        >
          ×
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite ConceptView.jsx to show OpportunityThesis fields**

The modal chrome (overlay, close button, scroll container) stays the same. Replace only the field rendering:

```jsx
// src/components/opportunity/ConceptView.jsx
import { X, Lightbulb, Cpu } from 'lucide-react'

const WEDGE_LABELS = {
  'underserved-winner':   'Underserved Winner',
  'workaround-to-product': 'Workaround → Product',
  'pattern-transfer':     'Pattern Transfer',
  'switching-wedge':      'Switching Wedge',
  'emerging-pull':        'Emerging Pull',
}

export default function ConceptView({ concept: thesis, onClose }) {
  if (!thesis) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 pb-8 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[var(--color-surface)] shadow-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="p-2 rounded-lg bg-teal-400/10">
            <Lightbulb className="w-5 h-5 text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white/90">{thesis.title}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-400/10 text-teal-300 border border-teal-400/20">
                {WEDGE_LABELS[thesis.wedgeType] ?? thesis.wedgeType}
              </span>
              <span className="text-xs text-white/30">
                Score: {thesis.buildabilityScore}/100
              </span>
              {thesis.generatedBy === 'ollama' && (
                <span className="flex items-center gap-1 text-xs text-purple-300/70">
                  <Cpu className="w-3 h-3" /> AI-generated
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Core thesis */}
        <div className="space-y-4 mb-6">
          <section>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-1">Job to be done</h3>
            <p className="text-sm text-white/80">{thesis.jobToBeDone}</p>
          </section>
          <section>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-1">Target user</h3>
            <p className="text-sm text-white/80">{thesis.targetUser}</p>
          </section>
          <section>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-1">Summary</h3>
            <p className="text-sm text-white/70">{thesis.summary}</p>
          </section>
          {thesis.whyNow && (
            <section>
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-1">Why now</h3>
              <p className="text-sm text-white/70 italic">{thesis.whyNow}</p>
            </section>
          )}
        </div>

        {/* Analysis columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <section>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2">Incumbent weaknesses</h3>
            <ul className="space-y-1">
              {thesis.incumbentWeaknesses.map((w, i) => (
                <li key={i} className="text-[12px] text-white/60 flex gap-1.5">
                  <span className="text-white/20">·</span>{w}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2">Current alternatives</h3>
            <ul className="space-y-1">
              {thesis.currentAlternatives.map((a, i) => (
                <li key={i} className="text-[12px] text-white/60 flex gap-1.5">
                  <span className="text-white/20">·</span>{a}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* MVP steps */}
        <section className="mb-6">
          <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2">Recommended MVP</h3>
          <ol className="space-y-1.5">
            {thesis.recommendedMvp.map((step, i) => (
              <li key={i} className="text-[12px] text-white/70 flex gap-2">
                <span className="font-mono text-white/30 flex-shrink-0">{i + 1}.</span>{step}
              </li>
            ))}
          </ol>
        </section>

        {/* Proof signals */}
        {thesis.proofSignals?.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wide mb-2">Proof signals</h3>
            <ul className="space-y-1">
              {thesis.proofSignals.map((s, i) => (
                <li key={i} className="text-[11px] text-white/40 italic truncate">"{s}"</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/opportunity/ThesisCard.tsx \
        src/components/opportunity/ConceptView.jsx
git commit -m "feat(radar): ThesisCard component + ConceptView rewritten for OpportunityThesis"
```

---

## Task 14: Rewrite OpportunityRadar.jsx (orchestration)

**Files:**
- Modify: `src/views/OpportunityRadar.jsx`

- [ ] **Step 1: Replace the entire file**

```jsx
// src/views/OpportunityRadar.jsx
import { useState, useEffect, useCallback } from 'react'
import { Radar, Trash2, Play, Loader2 } from 'lucide-react'
import RadarTopCard  from '../components/opportunity/RadarTopCard.jsx'
import PatternTable  from '../components/opportunity/PatternTable.jsx'
import ThesisCard    from '../components/opportunity/ThesisCard.tsx'
import ConceptView   from '../components/opportunity/ConceptView.jsx'
import EvidencePanel from '../components/opportunity/EvidencePanel.jsx'
import radarStorage  from '../opportunity-radar/storage/radarStorage.js'
import { runMultiSignalSearch, ALL_SOURCES, SOURCE_LABELS } from '../opportunity-radar/services/multiSignalSearchService.js'
import { extractSignals } from '../opportunity-radar/services/signalExtractor.js'
import { KeywordClusterer } from '../opportunity-radar/services/clusterService.js'
import { getTopN, scoreCluster, applyBuildabilityFilter, qualifies } from '../opportunity-radar/services/opportunityScorer.js'
import { classifyWedge } from '../opportunity-radar/services/wedgeClassifier.js'
import { aiValidateClusters } from '../opportunity-radar/services/aiOpportunityFilter.js'
import { generateThesis } from '../opportunity-radar/services/thesisGenerator.js'

const SCAN_STALE_MS = 6 * 60 * 60 * 1000

const SIGNAL_TABS = ['all', 'pain', 'pull', 'success', 'gap', 'switching', 'workaround', 'adjacency', 'theses']
const TAB_LABELS  = { all: 'All', pain: 'Pain', pull: 'Pull', success: 'Winners', gap: 'Gaps',
  switching: 'Switching', workaround: 'Workarounds', adjacency: 'Adjacency', theses: 'Theses' }

function formatAge(isoDate) {
  if (!isoDate) return 'Never scanned'
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  const hours  = Math.floor(diffMs / 3_600_000)
  const days   = Math.floor(diffMs / 86_400_000)
  if (mins < 2)   return 'Just now'
  if (mins < 60)  return `${mins} minutes ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}

export default function OpportunityRadar() {
  const [signals,          setSignals]          = useState(() => radarStorage.loadSignals())
  const [clusters,         setClusters]         = useState(() => radarStorage.loadClusters())
  const [theses,           setTheses]           = useState(() => radarStorage.loadTheses())
  const [meta,             setMeta]             = useState(() => radarStorage.loadMeta())
  const [scanning,         setScanning]         = useState(false)
  const [aiValidating,     setAiValidating]     = useState(false)
  const [generatingTheses, setGeneratingTheses] = useState(false)
  const [progress,         setProgress]         = useState([])
  const [activeThesisId,   setActiveThesisId]   = useState(null)
  const [evidenceClusterId, setEvidenceClusterId] = useState(null)
  const [generatingFor,    setGeneratingFor]    = useState(null)
  const [activeTab,        setActiveTab]        = useState('all')

  const topN = getTopN(3, clusters, signals)

  // ── Tab filtering ───────────────────────────────────────────────────────────

  function filteredClusters() {
    if (activeTab === 'all' || activeTab === 'theses') return clusters
    return clusters.filter((c) => {
      const breakdown = c.signalTypeBreakdown ?? {}
      const plurality = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0]?.[0]
      return plurality === activeTab
    })
  }

  // ── Scan pipeline ───────────────────────────────────────────────────────────

  const triggerScan = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setProgress([])
    const start = Date.now()

    try {
      const taggedResults = await runMultiSignalSearch(
        ALL_SOURCES,
        (p) => setProgress((prev) => {
          const idx = prev.findIndex((x) => x.source === p.source)
          if (idx >= 0) { const next = [...prev]; next[idx] = p; return next }
          return [...prev, p]
        }),
      )

      const newSignals = extractSignals(taggedResults)
      radarStorage.appendSignals(newSignals)
      const allSignals = radarStorage.loadSignals()

      const clusterer       = new KeywordClusterer()
      const existingClusters = radarStorage.loadClusters()
      const rawClusters     = clusterer.cluster(allSignals, existingClusters)

      const scored = rawClusters.map((c) => {
        const isBuildable = applyBuildabilityFilter(c, allSignals)
        const withB = { ...c, isBuildable, wedgeType: classifyWedge(c) }
        return { ...withB, opportunityScore: scoreCluster(withB, allSignals) }
      })

      // AI validation
      setAiValidating(true)
      let validated = scored
      try {
        const validations  = await aiValidateClusters(scored, allSignals)
        const valMap       = new Map(validations.map((v) => [v.clusterId, v]))
        validated = scored.map((c) => ({
          ...c,
          aiValidated:       valMap.get(c.id)?.keep,
          aiRejectionReason: valMap.get(c.id)?.keep === false ? valMap.get(c.id)?.reason : undefined,
        }))
      } catch (err) {
        console.warn('[OpportunityRadar] AI validation failed', err)
      } finally {
        setAiValidating(false)
      }

      radarStorage.saveClusters(validated)

      // Auto-generate theses for newly qualifying clusters
      setGeneratingTheses(true)
      const existingThesisClusterIds = new Set(radarStorage.loadTheses().map((t) => t.clusterId))
      const needsThesis = validated.filter(
        (c) => qualifies(c, allSignals) && !existingThesisClusterIds.has(c.id) && c.status !== 'blocked',
      )
      for (const cluster of needsThesis.slice(0, 10)) {
        try {
          const thesis = await generateThesis(cluster, allSignals)
          radarStorage.saveThesis(thesis)
        } catch (err) {
          console.warn('[OpportunityRadar] thesis gen failed for', cluster.id, err)
        }
      }
      setGeneratingTheses(false)

      const newMeta = {
        lastScanAt:     new Date().toISOString(),
        totalSignals:   allSignals.length,
        totalClusters:  scored.length,
        scanDurationMs: Date.now() - start,
      }
      radarStorage.saveMeta(newMeta)

      setSignals(allSignals)
      setClusters(validated)
      setTheses(radarStorage.loadTheses())
      setMeta(newMeta)
    } catch (err) {
      console.error('[OpportunityRadar] scan failed', err)
    } finally {
      setScanning(false)
    }
  }, [scanning])

  // ── On-load freshness check ─────────────────────────────────────────────────
  useEffect(() => {
    const lastScan = meta?.lastScanAt ? new Date(meta.lastScanAt).getTime() : 0
    const isStale  = !meta?.lastScanAt || (Date.now() - lastScan > SCAN_STALE_MS)
    if (isStale) triggerScan()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reset ───────────────────────────────────────────────────────────────────
  function handleReset() {
    if (!window.confirm('Clear all signals, patterns, and theses? This cannot be undone.')) return
    radarStorage.clearAll()
    setSignals([]); setClusters([]); setTheses([]); setMeta(null); setProgress([])
  }

  // ── Block / Unblock ─────────────────────────────────────────────────────────
  const handleBlockCluster = useCallback((clusterId) => {
    radarStorage.blockCluster(clusterId)
    setClusters(radarStorage.loadClusters())
  }, [])

  // ── Generate full concept (opens ConceptView from thesis) ───────────────────
  const handleGenerateFull = useCallback(async (clusterId) => {
    // The "full concept" modal is just the thesis viewer — thesis already exists.
    const thesis = theses.find((t) => t.clusterId === clusterId)
    if (thesis) { setActiveThesisId(thesis.id); return }
    // If not yet generated, generate now
    const cluster = clusters.find((c) => c.id === clusterId)
    if (!cluster) return
    setGeneratingFor(clusterId)
    try {
      const thesis = await generateThesis(cluster, signals)
      radarStorage.saveThesis(thesis)
      setTheses(radarStorage.loadTheses())
      setActiveThesisId(thesis.id)
    } finally {
      setGeneratingFor(null)
    }
  }, [clusters, signals, theses])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-4 md:p-6 max-w-7xl mx-auto">

      {/* Zone 1: Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Radar className="w-6 h-6 text-teal-400" />
          <h1 className="text-xl font-semibold">Opportunity Radar</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">
            Last scan: {formatAge(meta?.lastScanAt)}
          </span>
          {meta?.totalSignals > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-400/10 text-teal-400">
              {meta.totalSignals} signals · {meta.totalClusters} patterns
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleReset} disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] text-white/40 border border-white/10
              hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
            <Trash2 className="w-3.5 h-3.5" /> Reset
          </button>
          <button onClick={triggerScan} disabled={scanning}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-400/20
              hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">
            {scanning ? 'Scanning…' : <><Play className="w-3.5 h-3.5" fill="currentColor" />Run Scan Now</>}
          </button>
        </div>
      </div>

      {/* Scan progress */}
      {scanning && (
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-teal-400/70 transition-all duration-500"
                style={{ width: `${Math.round((progress.filter(p => p.status === 'done' || p.status === 'error').length / ALL_SOURCES.length) * 100)}%` }} />
            </div>
            <span className="text-xs text-white/40 flex-shrink-0">
              {progress.filter(p => p.status === 'done' || p.status === 'error').length} / {ALL_SOURCES.length} sources
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {ALL_SOURCES.map((src) => {
              const p = progress.find(x => x.source === src)
              const status = p?.status ?? 'pending'
              return (
                <span key={src} className={`text-xs px-2 py-1 rounded-full ${
                  status === 'done'    ? 'bg-green-400/10 text-green-400' :
                  status === 'error'  ? 'bg-red-400/10 text-red-400' :
                  status === 'running' ? 'bg-teal-400/10 text-teal-300 animate-pulse' :
                  'bg-white/5 text-white/20'
                }`}>
                  {SOURCE_LABELS[src] ?? src}
                  {status === 'done' ? ` ✓${p?.resultCount ? ` ${p.resultCount}` : ''}` :
                   status === 'error' ? ' ✗' : status === 'running' ? ' …' : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {aiValidating && (
        <div className="mb-4 flex items-center gap-2 text-xs text-purple-300/80">
          <Loader2 className="w-3 h-3 animate-spin" />
          AI reviewing patterns for software buildability…
        </div>
      )}
      {generatingTheses && (
        <div className="mb-4 flex items-center gap-2 text-xs text-teal-300/80">
          <Loader2 className="w-3 h-3 animate-spin" />
          Generating opportunity theses…
        </div>
      )}

      {/* Zone 2: Top Opportunities */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wide mb-3">Top Opportunities</h2>
        {topN.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-white/30 text-sm">
            {scanning ? 'Scanning for opportunity patterns…'
              : `Not enough validated patterns yet. Need ≥ 3 signals per cluster. ${meta?.totalSignals ?? 0} signals collected so far.`}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topN.map((cluster, i) => {
              const thesis = theses.find((t) => t.clusterId === cluster.id)
              return thesis ? (
                <ThesisCard
                  key={cluster.id}
                  thesis={thesis}
                  cluster={cluster}
                  generating={generatingFor === cluster.id}
                  onGenerateFull={() => setActiveThesisId(thesis.id)}
                  onBlock={() => handleBlockCluster(cluster.id)}
                  onViewEvidence={() => setEvidenceClusterId(
                    evidenceClusterId === cluster.id ? null : cluster.id,
                  )}
                />
              ) : (
                <RadarTopCard
                  key={cluster.id}
                  cluster={cluster}
                  signals={signals.filter((s) => cluster.signalIds.includes(s.id))}
                  rank={i + 1}
                  generating={generatingFor === cluster.id}
                  onGenerateConcept={() => handleGenerateFull(cluster.id)}
                  onViewEvidence={() => setEvidenceClusterId(
                    evidenceClusterId === cluster.id ? null : cluster.id,
                  )}
                  evidenceOpen={evidenceClusterId === cluster.id}
                />
              )
            })}
          </div>
        )}
      </section>

      {/* Evidence modal */}
      {evidenceClusterId && (
        <EvidencePanel
          cluster={clusters.find((c) => c.id === evidenceClusterId)}
          signals={signals.filter((s) =>
            clusters.find((c) => c.id === evidenceClusterId)?.signalIds.includes(s.id),
          )}
          onClose={() => setEvidenceClusterId(null)}
        />
      )}

      {/* Thesis / concept modal */}
      {activeThesisId && (
        <ConceptView
          concept={theses.find((t) => t.id === activeThesisId)}
          onClose={() => setActiveThesisId(null)}
        />
      )}

      {/* Zone 3: Signal-type tab bar + patterns */}
      <section>
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {SIGNAL_TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeTab === tab
                  ? 'bg-teal-400/10 text-teal-300 border-teal-400/20'
                  : 'bg-white/[0.02] text-white/40 border-white/10 hover:text-white/60'
              }`}>
              {TAB_LABELS[tab]}
              {tab === 'theses' && theses.length > 0 && (
                <span className="ml-1 text-[10px] text-teal-400">{theses.length}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'theses' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {theses.length === 0 ? (
              <div className="col-span-2 rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-white/30 text-sm">
                No theses yet. Run a scan to generate them.
              </div>
            ) : (
              theses.map((thesis) => {
                const cluster = clusters.find((c) => c.id === thesis.clusterId)
                return cluster ? (
                  <ThesisCard
                    key={thesis.id}
                    thesis={thesis}
                    cluster={cluster}
                    generating={generatingFor === cluster.id}
                    onGenerateFull={() => setActiveThesisId(thesis.id)}
                    onBlock={() => handleBlockCluster(cluster.id)}
                    onViewEvidence={() => setEvidenceClusterId(
                      evidenceClusterId === cluster.id ? null : cluster.id,
                    )}
                  />
                ) : null
              })
            )}
          </div>
        ) : (
          <>
            <h2 className="text-sm font-medium text-white/40 uppercase tracking-wide mb-3">
              {activeTab === 'all' ? 'All Patterns' : `${TAB_LABELS[activeTab]} Patterns`}
            </h2>
            <PatternTable
              clusters={filteredClusters()}
              signals={signals}
              theses={theses}
              onGenerateConcept={handleGenerateFull}
              onViewConcept={(thesisId) => setActiveThesisId(thesisId)}
              onViewEvidence={(clusterId) => setEvidenceClusterId(clusterId)}
              onBlockCluster={handleBlockCluster}
              generatingFor={generatingFor}
            />
          </>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Run all radar tests**

```bash
npx vitest run src/opportunity-radar/ 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 3: Start dev server and smoke-test**

```bash
npm run dev
```

Navigate to Opportunity Radar. Verify:
- Tab bar renders (All · Pain · Pull · Winners · Gaps · Switching · Workarounds · Adjacency · Theses)
- Reset button works
- Run Scan button triggers scan (progress badges appear)
- Console shows no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/views/OpportunityRadar.jsx
git commit -m "feat(radar): full orchestration — tab bar, auto-thesis gen, ThesisCard, block action"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npx vitest run 2>&1 | tail -30
```

Expected: all tests pass, 0 failures.

- [ ] **Confirm deleted files are gone**

```bash
ls src/opportunity-radar/constants/painQueries.ts 2>&1
ls src/opportunity-radar/services/painSearchService.ts 2>&1
ls src/opportunity-radar/services/conceptGenerator.ts 2>&1
```

Expected: "No such file" for all three.

- [ ] **TypeScript check on changed files**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: 0 errors or only pre-existing non-radar errors.

---

## Success Criteria (from spec)

- Scan produces signals tagged with 7 distinct `signalType` values
- Pattern table shows signal type and wedge type columns
- Block button dismisses a pattern immediately and persistently
- Thesis cards show job, wedge type, incumbent weaknesses, and MVP bullets
- Opportunity score uses 8 components; `qualifies()` accepts clusters with 3+ signals
- Ollama thesis generation falls back to template without crashing
- All existing tests updated; `wedgeClassifier` and `thesisGenerator` have test coverage
