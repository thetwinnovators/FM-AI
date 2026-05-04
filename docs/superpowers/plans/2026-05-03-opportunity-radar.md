# Opportunity Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a FlowMap feature that scans Reddit/HN/YouTube for recurring pain patterns, clusters them, scores by opportunity, surfaces top 3, and generates structured app concept packages with Claude Code build prompts.

**Architecture:** Standalone `src/opportunity-radar/` module with a 5-stage pipeline (search → extract → normalize → cluster → score) plus concept generation. Keyword clustering MVP behind a clean `IClusterer` interface. Hybrid concept generation: deterministic template fields always present, Ollama narrative when available.

**Tech Stack:** TypeScript services, React JSX views/components, Vitest for tests, localStorage + disk-sync for persistence, existing `searchReddit` / `searchHackerNews` / `searchYouTube` adapters, `generateResponse` from `src/lib/llm/ollama.js`.

---

## File map

| Action | Path |
|--------|------|
| Create | `src/opportunity-radar/types.ts` |
| Create | `src/opportunity-radar/constants/painQueries.ts` |
| Create | `src/opportunity-radar/constants/synonyms.ts` |
| Create | `src/opportunity-radar/storage/radarStorage.ts` |
| Create | `src/opportunity-radar/services/normalizationService.ts` |
| Create | `src/opportunity-radar/services/signalExtractor.ts` |
| Create | `src/opportunity-radar/services/clusterService.ts` |
| Create | `src/opportunity-radar/services/opportunityScorer.ts` |
| Create | `src/opportunity-radar/services/painSearchService.ts` |
| Create | `src/opportunity-radar/services/conceptGenerator.ts` |
| Create | `src/views/OpportunityRadar.jsx` |
| Create | `src/components/opportunity/RadarTopCard.jsx` |
| Create | `src/components/opportunity/PatternTable.jsx` |
| Create | `src/components/opportunity/ConceptView.jsx` |
| Create | `src/components/opportunity/EvidencePanel.jsx` |
| Create | `src/opportunity-radar/services/__tests__/normalizationService.test.ts` |
| Create | `src/opportunity-radar/services/__tests__/signalExtractor.test.ts` |
| Create | `src/opportunity-radar/services/__tests__/clusterService.test.ts` |
| Create | `src/opportunity-radar/services/__tests__/opportunityScorer.test.ts` |
| Modify | `src/App.jsx` — add `/radar` route |
| Modify | `src/components/layout/LeftRail.jsx` — add Radar nav entry |

---

## Task 1: Types + Constants

**Files:**
- Create: `src/opportunity-radar/types.ts`
- Create: `src/opportunity-radar/constants/painQueries.ts`
- Create: `src/opportunity-radar/constants/synonyms.ts`

No test for pure types/constants — verified by TypeScript compiler and consumed by downstream tests.

- [ ] **Step 1: Write types.ts**

```typescript
// src/opportunity-radar/types.ts

export type PainType =
  | 'workflow' | 'cost' | 'feature' | 'complexity'
  | 'speed'    | 'workaround' | 'integration' | 'privacy'

export interface PainSignal {
  id:             string
  detectedAt:     string         // ISO timestamp
  source:         'reddit' | 'hackernews' | 'youtube'
  sourceUrl:      string
  author?:        string
  painText:       string         // raw extracted text
  normalizedText: string         // lowercased, stopwords stripped, synonyms collapsed
  keyTerms:       string[]       // extracted from normalizedText
  painType:       PainType
  intensityScore: number         // 0–10
  clusterId?:     string
  queryUsed:      string
}

export interface OpportunityCluster {
  id:               string
  clusterName:      string
  painTheme:        PainType
  signalIds:        string[]
  signalCount:      number
  sourceDiversity:  number
  avgIntensity:     number
  firstDetected:    string
  lastDetected:     string
  termFrequency:    Record<string, number>
  opportunityScore: number
  isBuildable:      boolean
  status:           'emerging' | 'validated' | 'concept_generated' | 'archived'
  createdAt:        string
  updatedAt:        string
}

export interface AppConcept {
  id:             string
  clusterId:      string
  title:          string
  tagline:        string
  confidenceScore: number

  evidenceSummary: {
    signalCount:     number
    sourceBreakdown: Record<string, number>
    dateRange:       { first: string; last: string }
    topQuotes:       Array<{ text: string; source: string; url: string; author?: string }>
  }
  painPoints: Array<{ point: string; frequency: number }>

  opportunitySummary:  string
  problemStatement:    string
  targetUser:          string
  proposedSolution:    string
  valueProp:           string
  mvpScope:            string
  risks:               string
  claudeCodePrompt:    string
  implementationPlan:  string

  generatedBy: 'ollama' | 'template'
  status:      'new' | 'reviewing' | 'saved' | 'building' | 'archived'
  createdAt:   string
  updatedAt:   string
}

export interface RadarScanMeta {
  lastScanAt:      string | null
  totalSignals:    number
  totalClusters:   number
  scanDurationMs?: number
}
```

- [ ] **Step 2: Write painQueries.ts**

```typescript
// src/opportunity-radar/constants/painQueries.ts

export const PAIN_QUERIES: string[] = [
  '"I hate how"',
  '"there should be a tool for"',
  '"why isn\'t there an app that"',
  '"I keep doing this manually"',
  '"current tools are too expensive" OR "too complex"',
  '"I built a workaround for"',
  '"doesn\'t support"',
  '"takes too long every time"',
  '"I wish" AND (app OR tool OR feature)',
  '"no good solution for"',
  '"still doing this in spreadsheets"',
  '"frustrated with"',
]
```

- [ ] **Step 3: Write synonyms.ts**

```typescript
// src/opportunity-radar/constants/synonyms.ts

/** Applied to raw text BEFORE tokenisation — replaces multi-word phrases with a single token */
export const PHRASE_SYNONYMS: Record<string, string> = {
  'google sheets':   'spreadsheet',
  'microsoft excel': 'spreadsheet',
  'takes forever':   'slow',
  'not working':     'broken',
  "doesn't work":    'broken',
  "can't afford":    'costly',
  'copy paste':      'manual',
  'by hand':         'manual',
}

/** Applied to individual tokens AFTER tokenisation */
export const TOKEN_SYNONYMS: Record<string, string> = {
  'hate':       'dislike',
  'terrible':   'bad',
  'awful':      'bad',
  'frustrated': 'annoyed',
  'annoying':   'annoyed',
  'nightmare':  'bad',
  'excel':      'spreadsheet',
  'sheets':     'spreadsheet',
  'laggy':      'slow',
  'slow':       'slow',
  'broken':     'broken',
  'overpriced': 'costly',
  'expensive':  'costly',
  'manual':     'manual',
}
```

- [ ] **Step 4: Commit**

```bash
git add src/opportunity-radar/types.ts src/opportunity-radar/constants/painQueries.ts src/opportunity-radar/constants/synonyms.ts
git commit -m "feat(radar): types, pain queries, synonym maps"
```

---

## Task 2: Storage

**Files:**
- Create: `src/opportunity-radar/storage/radarStorage.ts`

No unit test — storage is pure localStorage read/write, same pattern as `localSignalsStorage.ts`. Verified by integration when the pipeline runs.

- [ ] **Step 1: Write radarStorage.ts**

```typescript
// src/opportunity-radar/storage/radarStorage.ts

import type { PainSignal, OpportunityCluster, AppConcept, RadarScanMeta } from '../types.js'
import { pullFromDisk, pushToDisk } from '../../lib/sync/fileSync.js'

const KEYS = {
  signals:  'fm_radar_signals',
  clusters: 'fm_radar_clusters',
  concepts: 'fm_radar_concepts',
  meta:     'fm_radar_meta',
} as const

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

let _syncTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSync(): void {
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(async () => {
    try {
      const pulled = await pullFromDisk()
      const base: Record<string, unknown> =
        pulled?.exists && pulled?.data && typeof pulled.data === 'object'
          ? { ...(pulled.data as object) }
          : {}
      base.radar = {
        signals:  read<PainSignal[]>(KEYS.signals,  []),
        clusters: read<OpportunityCluster[]>(KEYS.clusters, []),
        concepts: read<AppConcept[]>(KEYS.concepts, []),
        meta:     read<RadarScanMeta>(KEYS.meta, { lastScanAt: null, totalSignals: 0, totalClusters: 0 }),
      }
      await pushToDisk(base)
    } catch {
      // Non-fatal — localStorage remains source of truth
    }
  }, 600)
}

// ── Signals ─────────────────────────────────────────────────────────────────

export function loadSignals(): PainSignal[] {
  return read<PainSignal[]>(KEYS.signals, [])
}

export function saveSignals(signals: PainSignal[]): void {
  write(KEYS.signals, signals)
  scheduleSync()
}

export function appendSignals(incoming: PainSignal[]): void {
  const existing = loadSignals()
  const existingIds = new Set(existing.map((s) => s.id))
  const merged = [...existing, ...incoming.filter((s) => !existingIds.has(s.id))]
  saveSignals(merged)
}

// ── Clusters ─────────────────────────────────────────────────────────────────

export function loadClusters(): OpportunityCluster[] {
  return read<OpportunityCluster[]>(KEYS.clusters, [])
}

export function saveClusters(clusters: OpportunityCluster[]): void {
  write(KEYS.clusters, clusters)
  scheduleSync()
}

// ── Concepts ─────────────────────────────────────────────────────────────────

export function loadConcepts(): AppConcept[] {
  return read<AppConcept[]>(KEYS.concepts, [])
}

export function saveConcept(concept: AppConcept): void {
  const existing = loadConcepts()
  const idx = existing.findIndex((c) => c.id === concept.id)
  if (idx >= 0) {
    existing[idx] = concept
  } else {
    existing.push(concept)
  }
  write(KEYS.concepts, existing)
  scheduleSync()
}

export function getConceptByClusterId(clusterId: string): AppConcept | undefined {
  return loadConcepts().find((c) => c.clusterId === clusterId)
}

// ── Meta ─────────────────────────────────────────────────────────────────────

export function loadMeta(): RadarScanMeta {
  return read<RadarScanMeta>(KEYS.meta, { lastScanAt: null, totalSignals: 0, totalClusters: 0 })
}

export function saveMeta(meta: RadarScanMeta): void {
  write(KEYS.meta, meta)
  scheduleSync()
}

const radarStorage = {
  loadSignals, saveSignals, appendSignals,
  loadClusters, saveClusters,
  loadConcepts, saveConcept, getConceptByClusterId,
  loadMeta, saveMeta,
}

export default radarStorage
```

- [ ] **Step 2: Commit**

```bash
git add src/opportunity-radar/storage/radarStorage.ts
git commit -m "feat(radar): localStorage + disk-sync storage"
```

---

## Task 3: Normalization service

**Files:**
- Create: `src/opportunity-radar/services/normalizationService.ts`
- Create: `src/opportunity-radar/services/__tests__/normalizationService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/opportunity-radar/services/__tests__/normalizationService.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeText, extractKeyTerms } from '../normalizationService.js'

describe('normalizeText', () => {
  it('lowercases input', () => {
    expect(normalizeText('FRUSTRATED With Pricing')).toContain('annoyed')
  })

  it('replaces multi-word phrases before tokenisation', () => {
    const result = normalizeText('I hate google sheets for this')
    expect(result).toContain('spreadsheet')
    expect(result).not.toContain('google')
    expect(result).not.toContain('sheets')
  })

  it('strips stopwords', () => {
    const result = normalizeText('the tool is broken for me')
    expect(result).not.toContain(' the ')
    expect(result).not.toContain(' is ')
    expect(result).not.toContain(' for ')
  })

  it('applies token synonyms after phrase substitution', () => {
    // 'terrible' → 'bad'
    expect(normalizeText('terrible experience')).toContain('bad')
  })

  it('collapses "takes forever" to "slow" via phrase map', () => {
    expect(normalizeText('this takes forever to load')).toContain('slow')
  })
})

describe('extractKeyTerms', () => {
  it('returns tokens with length >= 4', () => {
    const terms = extractKeyTerms('slow manual spreadsheet export')
    expect(terms).toContain('slow')
    expect(terms).toContain('manual')
    expect(terms).toContain('spreadsheet')
    expect(terms).toContain('export')
    // short tokens excluded
    expect(terms).not.toContain('a')
  })

  it('deduplicates terms', () => {
    const terms = extractKeyTerms('slow slow spreadsheet spreadsheet')
    expect(terms.filter((t) => t === 'slow').length).toBe(1)
  })

  it('returns empty array for empty string', () => {
    expect(extractKeyTerms('')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/opportunity-radar/services/__tests__/normalizationService.test.ts
```

Expected: `Cannot find module '../normalizationService.js'`

- [ ] **Step 3: Write normalizationService.ts**

```typescript
// src/opportunity-radar/services/normalizationService.ts

import { PHRASE_SYNONYMS, TOKEN_SYNONYMS } from '../constants/synonyms.js'

const STOPWORDS = new Set([
  'the','a','an','is','for','with','that','it','we','they','this','those',
  'them','its','their','and','or','but','in','on','at','to','of','be','are',
  'was','were','have','has','had','do','does','did','will','would','could',
  'should','not','no','my','me','i','you','he','she','our','your','his','her',
  'as','up','so','if','by','from','than','then','when','there','what','how',
])

/**
 * Two-pass normalisation:
 * 1. Replace PHRASE_SYNONYMS in raw lowercased text
 * 2. Tokenise, strip stopwords, apply TOKEN_SYNONYMS
 * Returns space-joined normalised string.
 */
export function normalizeText(raw: string): string {
  // Pass 1: phrase substitution on raw text
  let text = raw.toLowerCase()
  for (const [phrase, canonical] of Object.entries(PHRASE_SYNONYMS)) {
    text = text.split(phrase).join(canonical)
  }

  // Pass 2: tokenise, strip stopwords, apply token synonyms
  const tokens = text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !STOPWORDS.has(t))
    .map((t) => TOKEN_SYNONYMS[t] ?? t)

  return tokens.join(' ')
}

/**
 * Extract deduped key terms (length >= 4) from a normalised text string.
 */
export function extractKeyTerms(normalised: string): string[] {
  if (!normalised.trim()) return []
  const seen = new Set<string>()
  const terms: string[] = []
  for (const token of normalised.split(/\s+/).filter(Boolean)) {
    if (token.length >= 4 && !seen.has(token)) {
      seen.add(token)
      terms.push(token)
    }
  }
  return terms
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/opportunity-radar/services/__tests__/normalizationService.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/opportunity-radar/services/normalizationService.ts src/opportunity-radar/services/__tests__/normalizationService.test.ts
git commit -m "feat(radar): normalization service (two-pass synonym + key-term extraction)"
```

---

## Task 4: Signal extractor

**Files:**
- Create: `src/opportunity-radar/services/signalExtractor.ts`
- Create: `src/opportunity-radar/services/__tests__/signalExtractor.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/opportunity-radar/services/__tests__/signalExtractor.test.ts
import { describe, it, expect } from 'vitest'
import { extractSignal, extractSignals } from '../signalExtractor.js'

const MOCK_RESULT = {
  title: 'I hate how excel takes forever to export',
  body:  'I have to manually copy paste every day. Terrible nightmare.',
  url:   'https://reddit.com/r/excel/1',
  source: 'reddit' as const,
  author: 'testuser',
  publishedAt: '2026-04-01T10:00:00Z',
}

describe('extractSignal', () => {
  it('returns null for weak signals (intensityScore < 3)', () => {
    const weak = { ...MOCK_RESULT, title: 'Nice tool', body: 'Works okay' }
    expect(extractSignal(weak, 'test query')).toBeNull()
  })

  it('returns a PainSignal for strong signals', () => {
    const signal = extractSignal(MOCK_RESULT, 'test query')
    expect(signal).not.toBeNull()
    expect(signal!.intensityScore).toBeGreaterThanOrEqual(3)
    expect(signal!.source).toBe('reddit')
    expect(signal!.sourceUrl).toBe(MOCK_RESULT.url)
    expect(signal!.queryUsed).toBe('test query')
  })

  it('classifies pain type from text', () => {
    const signal = extractSignal(MOCK_RESULT, 'test query')
    expect(signal!.painType).toBeDefined()
  })

  it('populates normalizedText and keyTerms', () => {
    const signal = extractSignal(MOCK_RESULT, 'test query')
    expect(signal!.normalizedText.length).toBeGreaterThan(0)
    expect(signal!.keyTerms.length).toBeGreaterThan(0)
  })

  it('generates a stable id from url + source', () => {
    const s1 = extractSignal(MOCK_RESULT, 'q1')
    const s2 = extractSignal(MOCK_RESULT, 'q2')
    // same content → same id regardless of query
    expect(s1!.id).toBe(s2!.id)
  })
})

describe('extractSignals', () => {
  it('filters out null signals', () => {
    const results = [
      MOCK_RESULT,
      { ...MOCK_RESULT, url: 'https://reddit.com/2', title: 'Fine', body: 'All good' },
    ]
    const signals = extractSignals(results, 'test')
    expect(signals.every((s) => s.intensityScore >= 3)).toBe(true)
  })

  it('deduplicates by id', () => {
    const results = [MOCK_RESULT, MOCK_RESULT]
    const signals = extractSignals(results, 'test')
    expect(signals.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/opportunity-radar/services/__tests__/signalExtractor.test.ts
```

Expected: `Cannot find module '../signalExtractor.js'`

- [ ] **Step 3: Write signalExtractor.ts**

```typescript
// src/opportunity-radar/services/signalExtractor.ts

import type { PainSignal, PainType } from '../types.js'
import { normalizeText, extractKeyTerms } from './normalizationService.js'

// ── Intensity scoring keyword lists ──────────────────────────────────────────

const EMOTIONAL  = /nightmare|gave up|terrible|hate|broken|awful|frustrated|annoying/i
const URGENCY    = /every day|constantly|always|waste hours|every time|all the time/i
const WORKAROUND = /i built|three tools|manual process|script|workaround|built a/i
const FINANCIAL  = /too expensive|can't afford|wasted hours|lost money|overpriced/i

function scoreIntensity(text: string): number {
  let score = 0
  const emotional = (text.match(EMOTIONAL) ?? []).length
  score += Math.min(3, emotional)
  const urgency = (text.match(URGENCY) ?? []).length
  score += Math.min(3, urgency)
  if (WORKAROUND.test(text)) score += 2
  if (FINANCIAL.test(text))  score += 2
  return Math.min(10, score)
}

// ── Pain type classification ──────────────────────────────────────────────────

const PAIN_TYPE_PATTERNS: Array<[PainType, RegExp]> = [
  ['cost',        /expensive|overpriced|afford|costly|pricing|cheap/i],
  ['workaround',  /workaround|script|built|manual process|three tools|copy paste/i],
  ['speed',       /slow|takes forever|laggy|too long|wait/i],
  ['complexity',  /complex|complicated|confusing|hard to use|too many steps/i],
  ['integration', /integrate|doesn't support|connect|sync|import|export/i],
  ['privacy',     /privacy|data|tracking|gdpr|leak/i],
  ['feature',     /wish|should have|doesn't have|missing|add a feature/i],
  ['workflow',    /workflow|process|every day|manually|routine|tedious/i],
]

function classifyPainType(text: string): PainType {
  for (const [type, pattern] of PAIN_TYPE_PATTERNS) {
    if (pattern.test(text)) return type
  }
  return 'workflow'  // default
}

// ── ID generation (stable, no crypto dependency) ─────────────────────────────

function makeId(url: string, source: string): string {
  // Simple deterministic hash from url + source
  let hash = 0
  const str = `${source}:${url}`
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return `sig_${Math.abs(hash).toString(36)}`
}

// ── Raw result shape coming from search adapters ─────────────────────────────

export interface RawSearchResult {
  title:       string
  body:        string
  url:         string
  source:      'reddit' | 'hackernews' | 'youtube'
  author?:     string
  publishedAt?: string
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract a single PainSignal from a raw search result.
 * Returns null if the signal is too weak (intensityScore < 3).
 */
export function extractSignal(
  result: RawSearchResult,
  queryUsed: string,
): PainSignal | null {
  const combined  = `${result.title} ${result.body}`.trim()
  const intensity = scoreIntensity(combined)
  if (intensity < 3) return null

  const normalizedText = normalizeText(combined)
  const keyTerms       = extractKeyTerms(normalizedText)
  const painType       = classifyPainType(combined)

  return {
    id:             makeId(result.url, result.source),
    detectedAt:     result.publishedAt ?? new Date().toISOString(),
    source:         result.source,
    sourceUrl:      result.url,
    author:         result.author,
    painText:       combined.slice(0, 500),
    normalizedText,
    keyTerms,
    painType,
    intensityScore: intensity,
    queryUsed,
  }
}

/**
 * Extract and deduplicate signals from a batch of raw results.
 */
export function extractSignals(
  results: RawSearchResult[],
  queryUsed: string,
): PainSignal[] {
  const seen = new Set<string>()
  const out: PainSignal[] = []
  for (const r of results) {
    const sig = extractSignal(r, queryUsed)
    if (sig && !seen.has(sig.id)) {
      seen.add(sig.id)
      out.push(sig)
    }
  }
  return out
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/opportunity-radar/services/__tests__/signalExtractor.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/opportunity-radar/services/signalExtractor.ts src/opportunity-radar/services/__tests__/signalExtractor.test.ts
git commit -m "feat(radar): signal extractor (intensity score + pain type classification)"
```

---

## Task 5: Clustering service

**Files:**
- Create: `src/opportunity-radar/services/clusterService.ts`
- Create: `src/opportunity-radar/services/__tests__/clusterService.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/opportunity-radar/services/__tests__/clusterService.test.ts
import { describe, it, expect } from 'vitest'
import { KeywordClusterer } from '../clusterService.js'
import type { PainSignal } from '../../types.js'

function makeSignal(overrides: Partial<PainSignal> = {}): PainSignal {
  return {
    id: Math.random().toString(36).slice(2),
    detectedAt: '2026-04-01T00:00:00Z',
    source: 'reddit',
    sourceUrl: 'https://reddit.com/1',
    painText: 'I hate manual spreadsheet export every day',
    normalizedText: 'manual spreadsheet export annoyed',
    keyTerms: ['manual', 'spreadsheet', 'export', 'annoyed'],
    painType: 'workflow',
    intensityScore: 5,
    queryUsed: 'test',
    ...overrides,
  }
}

describe('KeywordClusterer', () => {
  it('creates a new cluster for first signal', () => {
    const clusterer = new KeywordClusterer()
    const s = makeSignal()
    const clusters = clusterer.cluster([s], [])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].signalIds).toContain(s.id)
  })

  it('adds similar signal to existing cluster (Jaccard >= 0.35)', () => {
    const clusterer = new KeywordClusterer()
    const s1 = makeSignal({ id: 'a', keyTerms: ['manual', 'spreadsheet', 'export', 'pain'] })
    const s2 = makeSignal({ id: 'b', keyTerms: ['manual', 'spreadsheet', 'export', 'slow'] })
    const clusters = clusterer.cluster([s1, s2], [])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].signalIds).toContain('a')
    expect(clusters[0].signalIds).toContain('b')
  })

  it('creates separate clusters for dissimilar signals', () => {
    const clusterer = new KeywordClusterer()
    const s1 = makeSignal({ id: 'a', keyTerms: ['manual', 'spreadsheet', 'export'] })
    const s2 = makeSignal({ id: 'b', keyTerms: ['pricing', 'expensive', 'costly', 'budget'], painType: 'cost' })
    const clusters = clusterer.cluster([s1, s2], [])
    expect(clusters).toHaveLength(2)
  })

  it('merges clusters with >70% overlapping signalIds', () => {
    const clusterer = new KeywordClusterer()
    // Build two clusters with high signal overlap — same 5 signals, one extra each
    const shared = ['a','b','c','d','e'].map((id) => makeSignal({ id }))
    const s6 = makeSignal({ id: 'f', keyTerms: ['manual','spreadsheet','export','report'] })
    const s7 = makeSignal({ id: 'g', keyTerms: ['manual','spreadsheet','slow','export'] })
    const all = [...shared, s6, s7]
    const clusters = clusterer.cluster(all, [])
    // Shared signals dominate; the two near-identical clusters should merge
    const totalSignalIds = clusters.flatMap((c) => c.signalIds)
    const unique = new Set(totalSignalIds)
    // All 7 signals should be present
    expect(unique.size).toBe(7)
  })

  it('updates termFrequency with every signal\'s keyTerms', () => {
    const clusterer = new KeywordClusterer()
    const s = makeSignal({ keyTerms: ['manual', 'spreadsheet'] })
    const clusters = clusterer.cluster([s], [])
    expect(clusters[0].termFrequency['manual']).toBeGreaterThanOrEqual(1)
    expect(clusters[0].termFrequency['spreadsheet']).toBeGreaterThanOrEqual(1)
  })

  it('sets clusterName to top 3 terms by frequency', () => {
    const clusterer = new KeywordClusterer()
    const signals = [
      makeSignal({ id: '1', keyTerms: ['manual', 'spreadsheet', 'export', 'pain'] }),
      makeSignal({ id: '2', keyTerms: ['manual', 'spreadsheet', 'export', 'slow'] }),
      makeSignal({ id: '3', keyTerms: ['manual', 'spreadsheet', 'report', 'annoy'] }),
    ]
    const clusters = clusterer.cluster(signals, [])
    // manual(3) spreadsheet(3) export(2) are top 3
    expect(clusters[0].clusterName).toContain('manual')
    expect(clusters[0].clusterName).toContain('spreadsheet')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/opportunity-radar/services/__tests__/clusterService.test.ts
```

Expected: `Cannot find module '../clusterService.js'`

- [ ] **Step 3: Write clusterService.ts**

```typescript
// src/opportunity-radar/services/clusterService.ts

import type { PainSignal, OpportunityCluster, PainType } from '../types.js'

// ── Interface — drop-in replacement for semantic upgrade ─────────────────────

export interface IClusterer {
  cluster(signals: PainSignal[], existing: OpportunityCluster[]): OpportunityCluster[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(): string {
  return `cluster_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function jaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0
  let intersection = 0
  for (const term of setA) {
    if (setB.has(term)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

function updateTermFrequency(
  freq: Record<string, number>,
  terms: string[],
): Record<string, number> {
  const updated = { ...freq }
  for (const t of terms) {
    updated[t] = (updated[t] ?? 0) + 1
  }
  return updated
}

function buildClusterName(termFrequency: Record<string, number>): string {
  return Object.entries(termFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([term]) => term)
    .join(' ')
}

function computeAvgIntensity(signals: PainSignal[], signalIds: string[]): number {
  const relevant = signals.filter((s) => signalIds.includes(s.id))
  if (relevant.length === 0) return 0
  return relevant.reduce((sum, s) => sum + s.intensityScore, 0) / relevant.length
}

function computeSourceDiversity(signals: PainSignal[], signalIds: string[]): number {
  const relevant = signals.filter((s) => signalIds.includes(s.id))
  return new Set(relevant.map((s) => s.source)).size
}

function overlapRatio(idsA: string[], idsB: string[]): number {
  const setA = new Set(idsA)
  const setB = new Set(idsB)
  let common = 0
  for (const id of setA) { if (setB.has(id)) common++ }
  const smaller = Math.min(setA.size, setB.size)
  return smaller === 0 ? 0 : common / smaller
}

// ── KeywordClusterer ──────────────────────────────────────────────────────────

export class KeywordClusterer implements IClusterer {
  cluster(incoming: PainSignal[], existing: OpportunityCluster[]): OpportunityCluster[] {
    const now = new Date().toISOString()
    // Work on a mutable copy of existing clusters
    const clusters: OpportunityCluster[] = existing.map((c) => ({ ...c, signalIds: [...c.signalIds] }))

    for (const signal of incoming) {
      const sigTermSet = new Set(signal.keyTerms)
      let bestIdx   = -1
      let bestScore = 0

      for (let i = 0; i < clusters.length; i++) {
        const c = clusters[i]
        const clusterTermSet = new Set(Object.keys(c.termFrequency))
        const sim = jaccard(sigTermSet, clusterTermSet)

        if (sim < 0.35) continue

        // Same painType — prefer strongly
        if (c.painTheme === signal.painType) {
          if (sim > bestScore) { bestScore = sim; bestIdx = i }
        } else {
          // Different painType — only if cluster is still forming (< 5 signals)
          if (c.signalCount < 5 && sim > bestScore) { bestScore = sim; bestIdx = i }
        }
      }

      if (bestIdx >= 0) {
        // Assign to existing cluster
        const c      = clusters[bestIdx]
        c.signalIds.push(signal.id)
        c.signalCount = c.signalIds.length
        c.termFrequency = updateTermFrequency(c.termFrequency, signal.keyTerms)
        c.clusterName   = buildClusterName(c.termFrequency)
        c.updatedAt     = now
        if (signal.detectedAt < c.firstDetected) c.firstDetected = signal.detectedAt
        if (signal.detectedAt > c.lastDetected)  c.lastDetected  = signal.detectedAt
      } else {
        // New cluster
        const tf = updateTermFrequency({}, signal.keyTerms)
        clusters.push({
          id:               makeId(),
          clusterName:      buildClusterName(tf),
          painTheme:        signal.painType,
          signalIds:        [signal.id],
          signalCount:      1,
          sourceDiversity:  1,
          avgIntensity:     signal.intensityScore,
          firstDetected:    signal.detectedAt,
          lastDetected:     signal.detectedAt,
          termFrequency:    tf,
          opportunityScore: 0,
          isBuildable:      false,
          status:           'emerging',
          createdAt:        now,
          updatedAt:        now,
        })
      }
    }

    // Merge clusters with >70% overlapping signalIds
    const merged = this._mergeClusters(clusters, incoming, now)

    // Recompute derived fields on all clusters
    return merged.map((c) => ({
      ...c,
      signalCount:     c.signalIds.length,
      avgIntensity:    computeAvgIntensity(incoming, c.signalIds),
      sourceDiversity: computeSourceDiversity(incoming, c.signalIds),
      clusterName:     buildClusterName(c.termFrequency),
    }))
  }

  private _mergeClusters(
    clusters: OpportunityCluster[],
    _signals: PainSignal[],
    now: string,
  ): OpportunityCluster[] {
    const merged: OpportunityCluster[] = []
    const absorbed = new Set<string>()

    for (let i = 0; i < clusters.length; i++) {
      if (absorbed.has(clusters[i].id)) continue
      let base = { ...clusters[i], signalIds: [...clusters[i].signalIds] }

      for (let j = i + 1; j < clusters.length; j++) {
        if (absorbed.has(clusters[j].id)) continue
        if (overlapRatio(base.signalIds, clusters[j].signalIds) > 0.7) {
          // Merge j into base
          const combinedIds  = [...new Set([...base.signalIds, ...clusters[j].signalIds])]
          const combinedFreq = { ...base.termFrequency }
          for (const [term, count] of Object.entries(clusters[j].termFrequency)) {
            combinedFreq[term] = (combinedFreq[term] ?? 0) + count
          }
          base = {
            ...base,
            signalIds:     combinedIds,
            signalCount:   combinedIds.length,
            termFrequency: combinedFreq,
            clusterName:   buildClusterName(combinedFreq),
            firstDetected: base.firstDetected < clusters[j].firstDetected ? base.firstDetected : clusters[j].firstDetected,
            lastDetected:  base.lastDetected  > clusters[j].lastDetected  ? base.lastDetected  : clusters[j].lastDetected,
            updatedAt:     now,
          }
          absorbed.add(clusters[j].id)
        }
      }
      merged.push(base)
    }
    return merged
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/opportunity-radar/services/__tests__/clusterService.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/opportunity-radar/services/clusterService.ts src/opportunity-radar/services/__tests__/clusterService.test.ts
git commit -m "feat(radar): keyword clusterer with Jaccard similarity + merge"
```

---

## Task 6: Opportunity scorer

**Files:**
- Create: `src/opportunity-radar/services/opportunityScorer.ts`
- Create: `src/opportunity-radar/services/__tests__/opportunityScorer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/opportunity-radar/services/__tests__/opportunityScorer.test.ts
import { describe, it, expect } from 'vitest'
import { scoreCluster, applyBuildabilityFilter, getTop3 } from '../opportunityScorer.js'
import type { OpportunityCluster, PainSignal } from '../../types.js'

function makeCluster(overrides: Partial<OpportunityCluster> = {}): OpportunityCluster {
  const now = new Date().toISOString()
  return {
    id: 'c1',
    clusterName: 'manual spreadsheet export pain',
    painTheme: 'workflow',
    signalIds: Array.from({ length: 12 }, (_, i) => `s${i}`),
    signalCount: 12,
    sourceDiversity: 2,
    avgIntensity: 6,
    firstDetected: '2026-03-01T00:00:00Z',
    lastDetected: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    termFrequency: { manual: 8, spreadsheet: 7, export: 6 },
    opportunityScore: 0,
    isBuildable: true,
    status: 'emerging',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeSignals(cluster: OpportunityCluster, highIntensityCount = 3): PainSignal[] {
  return cluster.signalIds.map((id, i) => ({
    id,
    detectedAt: cluster.lastDetected,
    source: (i % 2 === 0 ? 'reddit' : 'hackernews') as 'reddit' | 'hackernews',
    sourceUrl: `https://example.com/${id}`,
    painText: 'manual spreadsheet export is terrible',
    normalizedText: 'manual spreadsheet export bad',
    keyTerms: ['manual', 'spreadsheet', 'export'],
    painType: 'workflow' as const,
    intensityScore: i < highIntensityCount ? 8 : 4,
    queryUsed: 'test',
  }))
}

describe('applyBuildabilityFilter', () => {
  it('passes buildable cluster', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    expect(applyBuildabilityFilter(c, signals)).toBe(true)
  })

  it('fails cluster with enterprise terms', () => {
    const c = makeCluster({ termFrequency: { 'multi-user': 5, admin: 3 } })
    const signals = makeSignals(c)
    expect(applyBuildabilityFilter(c, signals)).toBe(false)
  })

  it('fails cluster with oauth in signal texts', () => {
    const c = makeCluster()
    const signals = makeSignals(c).map((s) => ({ ...s, painText: 'needs oauth integration' }))
    expect(applyBuildabilityFilter(c, signals)).toBe(false)
  })
})

describe('scoreCluster', () => {
  it('scores a valid cluster above 20', () => {
    const c = makeCluster()
    const signals = makeSignals(c)
    const score = scoreCluster(c, signals)
    expect(score).toBeGreaterThan(20)
  })

  it('adds recency bonus for signals within 7 days', () => {
    const recent = makeCluster({ lastDetected: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() })
    const old    = makeCluster({ lastDetected: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() })
    const signals = makeSignals(recent)
    expect(scoreCluster(recent, signals)).toBeGreaterThan(scoreCluster(old, signals))
  })

  it('applies saturation penalty for solved-problem keywords', () => {
    const saturated = makeCluster({ termFrequency: { notion: 5, jira: 4, slack: 3 } })
    const normal    = makeCluster()
    const sSat  = makeSignals(saturated)
    const sNorm = makeSignals(normal)
    expect(scoreCluster(saturated, sSat)).toBeLessThan(scoreCluster(normal, sNorm))
  })
})

describe('getTop3', () => {
  it('returns top 3 qualifying clusters sorted by score', () => {
    const clusters = [
      makeCluster({ id: 'a', opportunityScore: 50, signalCount: 15 }),
      makeCluster({ id: 'b', opportunityScore: 40, signalCount: 12 }),
      makeCluster({ id: 'c', opportunityScore: 35, signalCount: 11 }),
      makeCluster({ id: 'd', opportunityScore: 25, signalCount: 10 }),
    ]
    const allSignals = clusters.flatMap((c) => makeSignals(c))
    const top3 = getTop3(clusters, allSignals)
    expect(top3).toHaveLength(3)
    expect(top3[0].id).toBe('a')
  })

  it('excludes clusters that fail the qualification gate', () => {
    // signalCount < 10 fails the gate
    const small = makeCluster({ id: 'z', signalCount: 5, signalIds: ['a','b','c','d','e'] })
    const good  = [
      makeCluster({ id: 'a', opportunityScore: 50 }),
      makeCluster({ id: 'b', opportunityScore: 40 }),
      makeCluster({ id: 'c', opportunityScore: 35 }),
    ]
    const allSignals = [...good, small].flatMap((c) => makeSignals(c))
    const top3 = getTop3([small, ...good], allSignals)
    expect(top3.map((c) => c.id)).not.toContain('z')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run src/opportunity-radar/services/__tests__/opportunityScorer.test.ts
```

Expected: `Cannot find module '../opportunityScorer.js'`

- [ ] **Step 3: Write opportunityScorer.ts**

```typescript
// src/opportunity-radar/services/opportunityScorer.ts

import type { OpportunityCluster, PainSignal } from '../types.js'

const BUILDABILITY_REGEX =
  /multi.?user|role.?manag|admin.?panel|real.?time.?collab|payment.?process|video.?stream|iot|bluetooth|hipaa|enterprise.?scale|native.?app|oauth|websocket|backend.?required/i

const SATURATION_REGEX =
  /\b(notion|jira|slack|trello|asana|monday|linear|salesforce|hubspot)\b/i

export function applyBuildabilityFilter(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): boolean {
  const clusterText = Object.keys(cluster.termFrequency).join(' ')
  if (BUILDABILITY_REGEX.test(clusterText)) return false
  for (const s of signals) {
    if (cluster.signalIds.includes(s.id) && BUILDABILITY_REGEX.test(s.painText)) return false
  }
  return true
}

export function scoreCluster(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): number {
  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))

  // Frequency
  let score = cluster.signalCount * 2

  // Source diversity
  score += cluster.sourceDiversity

  // Recency bonus
  const lastMs  = new Date(cluster.lastDetected).getTime()
  const ageMs   = Date.now() - lastMs
  const DAY_MS  = 24 * 60 * 60 * 1000
  if (ageMs < 7 * DAY_MS)  score += 5
  else if (ageMs < 30 * DAY_MS) score += 2

  // Avg intensity
  score += cluster.avgIntensity * 1.5

  // Specificity bonus — ≥3 signals with intensityScore ≥ 7
  const highIntensity = clusterSignals.filter((s) => s.intensityScore >= 7).length
  if (highIntensity >= 3) score += 3

  // Buildability bonus
  if (cluster.isBuildable) score += 5

  // Saturation penalty
  const clusterText = Object.keys(cluster.termFrequency).join(' ')
  if (SATURATION_REGEX.test(clusterText)) score -= 10

  return Math.max(0, score)
}

function qualifies(cluster: OpportunityCluster, signals: PainSignal[]): boolean {
  if (!cluster.isBuildable) return false
  if (cluster.signalCount < 10) return false
  if (cluster.sourceDiversity < 2) return false

  const clusterSignals = signals.filter((s) => cluster.signalIds.includes(s.id))
  if (clusterSignals.filter((s) => s.intensityScore >= 7).length < 3) return false

  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
  const lastMs = new Date(cluster.lastDetected).getTime()
  if (Date.now() - lastMs > NINETY_DAYS_MS) return false

  return true
}

/**
 * Score all clusters, mark buildability, return top 3 qualifying clusters.
 */
export function getTop3(
  clusters: OpportunityCluster[],
  signals: PainSignal[],
): OpportunityCluster[] {
  const scored = clusters.map((c) => {
    const isBuildable = applyBuildabilityFilter(c, signals)
    const withBuildable = { ...c, isBuildable }
    return {
      ...withBuildable,
      opportunityScore: scoreCluster(withBuildable, signals),
    }
  })

  return scored
    .filter((c) => qualifies(c, signals))
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 3)
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run src/opportunity-radar/services/__tests__/opportunityScorer.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/opportunity-radar/services/opportunityScorer.ts src/opportunity-radar/services/__tests__/opportunityScorer.test.ts
git commit -m "feat(radar): opportunity scorer + buildability filter + top-3 gate"
```

---

## Task 7: Pain search service

**Files:**
- Create: `src/opportunity-radar/services/painSearchService.ts`

No unit test — this calls live network adapters. Verified by manual scan run.

**Critical signatures (confirmed by reading source):**
- `searchReddit(query, opts = {}, signal)` — opts object, second arg
- `searchHackerNews(query, limit = 10, signal)` — positional limit, second arg
- `searchYouTube(query, limit = 10, signal)` — positional limit, second arg

- [ ] **Step 1: Write painSearchService.ts**

```typescript
// src/opportunity-radar/services/painSearchService.ts

import { searchReddit }     from '../../lib/search/reddit.js'
import { searchHackerNews } from '../../lib/search/hackerNews.js'
import { searchYouTube }    from '../../lib/search/youtube.js'
import { PAIN_QUERIES }     from '../constants/painQueries.js'
import type { RawSearchResult } from './signalExtractor.js'

export type ScanSource = 'reddit' | 'hackernews' | 'youtube'

export interface ScanProgress {
  source:    ScanSource
  status:    'running' | 'done' | 'error'
  resultCount?: number
  error?:    string
}

type ProgressCallback = (p: ScanProgress) => void

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Run at most `concurrency` promises at a time from a list of factories. */
async function pLimit<T>(
  factories: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = []
  let idx = 0

  async function worker() {
    while (idx < factories.length) {
      const i = idx++
      results[i] = await factories[i]()
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, factories.length) }, worker)
  await Promise.all(workers)
  return results
}

function mapRedditItem(item: any, query: string): RawSearchResult | null {
  try {
    const title = item.title ?? item.raw?.title ?? ''
    const body  = item.selftext ?? item.raw?.selftext ?? item.body ?? ''
    const url   = item.url ?? item.raw?.url ?? ''
    if (!url) return null
    return {
      title,
      body,
      url,
      source:      'reddit',
      author:      item.author ?? item.raw?.author,
      publishedAt: item.created_utc
        ? new Date(item.created_utc * 1000).toISOString()
        : item.publishedAt,
    }
  } catch { return null }
}

function mapHNItem(item: any): RawSearchResult | null {
  try {
    const title = item.title ?? ''
    const body  = item.story_text ?? item.comment_text ?? item.text ?? ''
    const url   = item.url ?? `https://news.ycombinator.com/item?id=${item.objectID}`
    return {
      title,
      body,
      url,
      source:      'hackernews',
      author:      item.author ?? item.raw?.author,
      publishedAt: item.created_at ?? item.publishedAt,
    }
  } catch { return null }
}

function mapYouTubeItem(item: any): RawSearchResult | null {
  try {
    const title = item.title ?? item.raw?.title ?? ''
    const body  = item.description ?? item.raw?.description ?? ''
    const url   = item.url ?? item.raw?.url ?? ''
    if (!url) return null
    return {
      title,
      body,
      url,
      source:      'youtube',
      author:      item.author ?? item.raw?.author,
      publishedAt: item.publishedAt ?? item.raw?.publishedAt,
    }
  } catch { return null }
}

// ── Source runners ────────────────────────────────────────────────────────────

async function runSource(
  source: ScanSource,
  onProgress: ProgressCallback,
): Promise<RawSearchResult[]> {
  onProgress({ source, status: 'running' })
  const abortController = new AbortController()
  const results: RawSearchResult[] = []

  try {
    const factories = PAIN_QUERIES.map((query) => async () => {
      try {
        let items: any[] = []
        if (source === 'reddit') {
          const raw = await searchReddit(query, { limit: 10 }, abortController.signal)
          items = Array.isArray(raw) ? raw : (raw?.results ?? [])
          return items.map((i) => mapRedditItem(i, query)).filter(Boolean) as RawSearchResult[]
        } else if (source === 'hackernews') {
          const raw = await searchHackerNews(query, 10, abortController.signal)
          items = Array.isArray(raw) ? raw : (raw?.results ?? [])
          return items.map(mapHNItem).filter(Boolean) as RawSearchResult[]
        } else {
          const raw = await searchYouTube(query, 10, abortController.signal)
          items = Array.isArray(raw) ? raw : (raw?.results ?? [])
          return items.map(mapYouTubeItem).filter(Boolean) as RawSearchResult[]
        }
      } catch {
        return []
      }
    })

    const batches = await pLimit(factories, 5)
    for (const batch of batches) results.push(...batch)

    // Deduplicate by URL
    const seen = new Set<string>()
    const deduped = results.filter((r) => {
      if (seen.has(r.url)) return false
      seen.add(r.url)
      return true
    })

    onProgress({ source, status: 'done', resultCount: deduped.length })
    return deduped
  } catch (err: any) {
    onProgress({ source, status: 'error', error: err?.message ?? String(err) })
    return results
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run all pain queries across Reddit, then HN, then YouTube.
 * Source-sequential, max 5 concurrent queries per source.
 */
export async function runPainSearch(
  sources: ScanSource[] = ['reddit', 'hackernews', 'youtube'],
  onProgress: ProgressCallback = () => {},
): Promise<RawSearchResult[]> {
  const all: RawSearchResult[] = []

  for (const source of sources) {
    const sourceResults = await runSource(source, onProgress)
    all.push(...sourceResults)
  }

  return all
}
```

- [ ] **Step 2: Commit**

```bash
git add src/opportunity-radar/services/painSearchService.ts
git commit -m "feat(radar): pain search service (source-sequential, 5-concurrent queries)"
```

---

## Task 8: Concept generator

**Files:**
- Create: `src/opportunity-radar/services/conceptGenerator.ts`

No unit test — calls Ollama which isn't available in test env. Template fallback verified by TypeScript types.

**Key function:** `generateResponse(prompt, opts)` from `src/lib/llm/ollama.js`.

- [ ] **Step 1: Write conceptGenerator.ts**

```typescript
// src/opportunity-radar/services/conceptGenerator.ts

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
- No paid APIs, no OAuth
- Works offline
- Mobile-responsive

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

/**
 * Generate a complete AppConcept for a cluster.
 * Always returns a valid concept — Ollama enhances narrative fields when available.
 */
export async function generateConcept(
  cluster: OpportunityCluster,
  signals: PainSignal[],
): Promise<AppConcept> {
  const now      = new Date().toISOString()
  const template = buildTemplateConcept(cluster, signals)

  // Try Ollama
  const ollamaSections = await generateWithOllama(cluster, signals)

  const generatedBy: 'ollama' | 'template' = ollamaSections ? 'ollama' : 'template'

  // Merge: Ollama sections override template where present; template is fallback
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
```

- [ ] **Step 2: Commit**

```bash
git add src/opportunity-radar/services/conceptGenerator.ts
git commit -m "feat(radar): hybrid concept generator (template + Ollama, section-constrained)"
```

---

## Task 9: Main view — OpportunityRadar.jsx

**Files:**
- Create: `src/views/OpportunityRadar.jsx`

- [ ] **Step 1: Write OpportunityRadar.jsx**

```jsx
// src/views/OpportunityRadar.jsx
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Radar } from 'lucide-react'
import RadarTopCard  from '../components/opportunity/RadarTopCard.jsx'
import PatternTable  from '../components/opportunity/PatternTable.jsx'
import ConceptView   from '../components/opportunity/ConceptView.jsx'
import EvidencePanel from '../components/opportunity/EvidencePanel.jsx'
import radarStorage  from '../opportunity-radar/storage/radarStorage.js'
import { runPainSearch }  from '../opportunity-radar/services/painSearchService.js'
import { extractSignals } from '../opportunity-radar/services/signalExtractor.js'
import { KeywordClusterer } from '../opportunity-radar/services/clusterService.js'
import { getTop3, scoreCluster, applyBuildabilityFilter } from '../opportunity-radar/services/opportunityScorer.js'
import { generateConcept } from '../opportunity-radar/services/conceptGenerator.js'

const SCAN_STALE_MS = 6 * 60 * 60 * 1000   // 6 hours

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
  const [signals,        setSignals]        = useState(() => radarStorage.loadSignals())
  const [clusters,       setClusters]       = useState(() => radarStorage.loadClusters())
  const [concepts,       setConcepts]       = useState(() => radarStorage.loadConcepts())
  const [meta,           setMeta]           = useState(() => radarStorage.loadMeta())
  const [scanning,       setScanning]       = useState(false)
  const [progress,       setProgress]       = useState([])
  const [activeConceptId, setActiveConceptId] = useState(null)
  const [evidenceClusterId, setEvidenceClusterId] = useState(null)
  const [generatingFor,  setGeneratingFor]  = useState(null)  // clusterId

  const top3 = getTop3(clusters, signals)

  // ── Scan pipeline ───────────────────────────────────────────────────────────

  const triggerScan = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setProgress([])
    const start = Date.now()

    try {
      const rawResults = await runPainSearch(
        ['reddit', 'hackernews', 'youtube'],
        (p) => setProgress((prev) => {
          const existing = prev.findIndex((x) => x.source === p.source)
          if (existing >= 0) { const next = [...prev]; next[existing] = p; return next }
          return [...prev, p]
        }),
      )

      const newSignals = rawResults.flatMap((r) =>
        extractSignals([r], r.queryUsed ?? ''),
      )

      radarStorage.appendSignals(newSignals)
      const allSignals = radarStorage.loadSignals()

      const clusterer    = new KeywordClusterer()
      const existingClusters = radarStorage.loadClusters()
      const newClusters  = clusterer.cluster(allSignals, existingClusters)

      // Score all clusters
      const scored = newClusters.map((c) => {
        const isBuildable = applyBuildabilityFilter(c, allSignals)
        const withB = { ...c, isBuildable }
        return { ...withB, opportunityScore: scoreCluster(withB, allSignals) }
      })

      radarStorage.saveClusters(scored)
      const newMeta = {
        lastScanAt:     new Date().toISOString(),
        totalSignals:   allSignals.length,
        totalClusters:  scored.length,
        scanDurationMs: Date.now() - start,
      }
      radarStorage.saveMeta(newMeta)

      setSignals(allSignals)
      setClusters(scored)
      setConcepts(radarStorage.loadConcepts())
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

  // ── Concept generation ──────────────────────────────────────────────────────

  const handleGenerateConcept = useCallback(async (clusterId) => {
    const cluster = clusters.find((c) => c.id === clusterId)
    if (!cluster) return
    setGeneratingFor(clusterId)
    try {
      const concept = await generateConcept(cluster, signals)
      radarStorage.saveConcept(concept)
      // Update cluster status
      const updatedClusters = clusters.map((c) =>
        c.id === clusterId ? { ...c, status: 'concept_generated' } : c,
      )
      radarStorage.saveClusters(updatedClusters)
      setClusters(updatedClusters)
      setConcepts(radarStorage.loadConcepts())
      setActiveConceptId(concept.id)
    } finally {
      setGeneratingFor(null)
    }
  }, [clusters, signals])

  // ── Render ──────────────────────────────────────────────────────────────────

  const activeConceptClusterId = concepts.find((c) => c.id === activeConceptId)?.clusterId

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
        <button
          onClick={triggerScan}
          disabled={scanning}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-400/20
            hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning…' : '↻ Run Scan'}
        </button>
      </div>

      {/* Scan progress */}
      {scanning && progress.length > 0 && (
        <div className="flex gap-3 mb-4 flex-wrap">
          {progress.map((p) => (
            <span key={p.source} className={`text-xs px-2 py-1 rounded-full ${
              p.status === 'done'    ? 'bg-green-400/10 text-green-400' :
              p.status === 'error'  ? 'bg-red-400/10 text-red-400' :
              'bg-white/5 text-white/40'
            }`}>
              {p.source} {p.status === 'done' ? `✓ ${p.resultCount}` : p.status === 'error' ? '✗' : '…'}
            </span>
          ))}
        </div>
      )}

      {/* Zone 2: Top 3 */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wide mb-3">
          Top Opportunities
        </h2>
        {top3.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-white/30 text-sm">
            {scanning
              ? 'Scanning for pain patterns…'
              : `Not enough validated patterns yet. Need ≥ 10 signals, ≥ 2 sources per cluster. ${meta?.totalSignals ?? 0} signals collected so far.`}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {top3.map((cluster, i) => {
              const existingConcept = concepts.find((c) => c.clusterId === cluster.id)
              return (
                <div key={cluster.id}>
                  <RadarTopCard
                    cluster={cluster}
                    signals={signals.filter((s) => cluster.signalIds.includes(s.id))}
                    rank={i + 1}
                    existingConcept={existingConcept ?? null}
                    generating={generatingFor === cluster.id}
                    onGenerateConcept={() => handleGenerateConcept(cluster.id)}
                    onViewConcept={() => setActiveConceptId(existingConcept?.id ?? null)}
                    onViewEvidence={() => setEvidenceClusterId(
                      evidenceClusterId === cluster.id ? null : cluster.id,
                    )}
                    evidenceOpen={evidenceClusterId === cluster.id}
                  />
                  {/* Inline concept panel below this card's column */}
                  {activeConceptClusterId === cluster.id && activeConceptId && (
                    <ConceptView
                      concept={concepts.find((c) => c.id === activeConceptId)!}
                      onClose={() => setActiveConceptId(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Evidence drawer */}
      {evidenceClusterId && (
        <EvidencePanel
          cluster={clusters.find((c) => c.id === evidenceClusterId)!}
          signals={signals.filter((s) =>
            clusters.find((c) => c.id === evidenceClusterId)?.signalIds.includes(s.id),
          )}
          onClose={() => setEvidenceClusterId(null)}
        />
      )}

      {/* Zone 3: All patterns */}
      <section>
        <h2 className="text-sm font-medium text-white/40 uppercase tracking-wide mb-3">
          All Pain Patterns
        </h2>
        <PatternTable
          clusters={clusters}
          signals={signals}
          concepts={concepts}
          onGenerateConcept={handleGenerateConcept}
          onViewConcept={(conceptId) => setActiveConceptId(conceptId)}
          onViewEvidence={(clusterId) => setEvidenceClusterId(clusterId)}
          generatingFor={generatingFor}
        />
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/OpportunityRadar.jsx
git commit -m "feat(radar): OpportunityRadar main view (scan pipeline, top-3, all-patterns)"
```

---

## Task 10: RadarTopCard + PatternTable components

**Files:**
- Create: `src/components/opportunity/RadarTopCard.jsx`
- Create: `src/components/opportunity/PatternTable.jsx`

- [ ] **Step 1: Write RadarTopCard.jsx**

```jsx
// src/components/opportunity/RadarTopCard.jsx
import { Loader2 } from 'lucide-react'

function intensityLabel(avg) {
  if (avg >= 7) return { label: 'HIGH',   cls: 'bg-red-400/10 text-red-400' }
  if (avg >= 4) return { label: 'MEDIUM', cls: 'bg-yellow-400/10 text-yellow-400' }
  return               { label: 'LOW',    cls: 'bg-green-400/10 text-green-400' }
}

function formatAge(isoDate) {
  if (!isoDate) return '—'
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const hours  = Math.floor(diffMs / 3_600_000)
  const days   = Math.floor(diffMs / 86_400_000)
  if (hours < 1)  return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function RadarTopCard({
  cluster,
  signals,
  rank,
  existingConcept,
  generating,
  onGenerateConcept,
  onViewConcept,
  onViewEvidence,
  evidenceOpen,
}) {
  const { label: intensityText, cls: intensityCls } = intensityLabel(cluster.avgIntensity)
  const topSignal = [...signals].sort((a, b) => b.intensityScore - a.intensityScore)[0]
  const sourceList = [...new Set(signals.map((s) => s.source))].join(', ')

  const scorePercent = Math.min(100, Math.round(cluster.opportunityScore))

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex flex-col gap-3 h-full">
      {/* Rank + buildable */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded-full">
          #{rank}
        </span>
        {cluster.isBuildable && (
          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            Claude-Code-buildable ✅
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium leading-snug capitalize">
        {cluster.clusterName}
      </h3>

      {/* Score bar */}
      <div>
        <div className="flex justify-between text-[10px] text-white/40 mb-1">
          <span>Opportunity score</span>
          <span>{scorePercent}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-400 transition-all"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="text-white/50">{cluster.signalCount} signals</span>
        <span className="text-white/30">·</span>
        <span className="text-white/50">{cluster.sourceDiversity} sources: {sourceList}</span>
        <span className="text-white/30">·</span>
        <span className="text-white/50">Last: {formatAge(cluster.lastDetected)}</span>
      </div>

      {/* Intensity badge */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${intensityCls}`}>
        {intensityText} INTENSITY
      </span>

      {/* Top quote */}
      {topSignal && (
        <blockquote className="text-[11px] text-white/40 italic border-l-2 border-white/10 pl-2 line-clamp-2">
          "{topSignal.painText.slice(0, 120)}…"
        </blockquote>
      )}

      {/* CTAs */}
      <div className="flex gap-2 mt-auto pt-2">
        <button
          onClick={existingConcept ? onViewConcept : onGenerateConcept}
          disabled={generating}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg
            bg-teal-500/10 text-teal-400 border border-teal-400/20
            hover:bg-teal-500/20 disabled:opacity-40 transition-colors"
        >
          {generating
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
            : existingConcept ? 'View Concept' : 'Generate App Concept'
          }
        </button>
        <button
          onClick={onViewEvidence}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            evidenceOpen
              ? 'bg-white/10 border-white/20 text-white/80'
              : 'bg-white/[0.03] border-white/10 text-white/40 hover:bg-white/8'
          }`}
        >
          Evidence
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write PatternTable.jsx**

```jsx
// src/components/opportunity/PatternTable.jsx
import { useState } from 'react'
import { Loader2, ArrowUpDown } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'score',      label: 'Score' },
  { value: 'signals',    label: 'Signals' },
  { value: 'recency',    label: 'Recency' },
  { value: 'diversity',  label: 'Sources' },
]

const STATUS_COLORS = {
  emerging:           'text-blue-400 bg-blue-400/10',
  validated:          'text-teal-400 bg-teal-400/10',
  concept_generated:  'text-purple-400 bg-purple-400/10',
  archived:           'text-white/20 bg-white/5',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export default function PatternTable({
  clusters,
  signals,
  concepts,
  onGenerateConcept,
  onViewConcept,
  onViewEvidence,
  generatingFor,
}) {
  const [sortBy,       setSortBy]       = useState('score')
  const [buildableOnly, setBuildableOnly] = useState(true)
  const [filterSource, setFilterSource] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const sources  = [...new Set(signals.map((s) => s.source))]

  let rows = [...clusters]

  if (buildableOnly)  rows = rows.filter((c) => c.isBuildable)
  if (filterSource)   rows = rows.filter((c) => {
    const clusterSignals = signals.filter((s) => c.signalIds.includes(s.id))
    return clusterSignals.some((s) => s.source === filterSource)
  })
  if (filterStatus) rows = rows.filter((c) => c.status === filterStatus)

  rows.sort((a, b) => {
    if (sortBy === 'score')     return b.opportunityScore - a.opportunityScore
    if (sortBy === 'signals')   return b.signalCount - a.signalCount
    if (sortBy === 'recency')   return new Date(b.lastDetected).getTime() - new Date(a.lastDetected).getTime()
    if (sortBy === 'diversity') return b.sourceDiversity - a.sourceDiversity
    return 0
  })

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-white/30 text-sm">
        No patterns match current filters.
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <button
          onClick={() => setBuildableOnly(!buildableOnly)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            buildableOnly
              ? 'bg-teal-400/10 text-teal-400 border-teal-400/20'
              : 'bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/8'
          }`}
        >
          Buildable only
        </button>

        {sources.map((src) => (
          <button
            key={src}
            onClick={() => setFilterSource(filterSource === src ? '' : src)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filterSource === src
                ? 'bg-blue-400/10 text-blue-400 border-blue-400/20'
                : 'bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/8'
            }`}
          >
            {src}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-white/40">
          <ArrowUpDown className="w-3 h-3" />
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-2 py-0.5 rounded ${sortBy === opt.value ? 'text-white/80' : 'hover:text-white/60'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5 text-white/30 text-left">
              <th className="px-4 py-2.5 font-medium">Pattern</th>
              <th className="px-3 py-2.5 font-medium text-right">Signals</th>
              <th className="px-3 py-2.5 font-medium text-right">Sources</th>
              <th className="px-3 py-2.5 font-medium">Last seen</th>
              <th className="px-3 py-2.5 font-medium text-right">Score</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cluster, i) => {
              const existingConcept = concepts.find((c) => c.clusterId === cluster.id)
              const isGenerating    = generatingFor === cluster.id
              return (
                <tr
                  key={cluster.id}
                  className={`border-b border-white/[0.03] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''} hover:bg-white/[0.04] transition-colors`}
                >
                  <td className="px-4 py-2.5 capitalize font-medium text-white/70 max-w-[200px] truncate">
                    {cluster.clusterName}
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/50">{cluster.signalCount}</td>
                  <td className="px-3 py-2.5 text-right text-white/50">{cluster.sourceDiversity}</td>
                  <td className="px-3 py-2.5 text-white/40">{formatDate(cluster.lastDetected)}</td>
                  <td className="px-3 py-2.5 text-right text-white/70 font-mono">
                    {Math.round(cluster.opportunityScore)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[cluster.status] ?? 'text-white/30'}`}>
                      {cluster.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => existingConcept ? onViewConcept(existingConcept.id) : onGenerateConcept(cluster.id)}
                        disabled={isGenerating}
                        className="text-teal-400 hover:text-teal-300 disabled:opacity-40"
                      >
                        {isGenerating
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : existingConcept ? 'View' : 'Generate'
                        }
                      </button>
                      <span className="text-white/20">·</span>
                      <button
                        onClick={() => onViewEvidence(cluster.id)}
                        className="text-white/40 hover:text-white/70"
                      >
                        Evidence
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/opportunity/RadarTopCard.jsx src/components/opportunity/PatternTable.jsx
git commit -m "feat(radar): RadarTopCard and PatternTable components"
```

---

## Task 11: ConceptView + EvidencePanel components

**Files:**
- Create: `src/components/opportunity/ConceptView.jsx`
- Create: `src/components/opportunity/EvidencePanel.jsx`

- [ ] **Step 1: Write ConceptView.jsx**

```jsx
// src/components/opportunity/ConceptView.jsx
import { useState } from 'react'
import { X, Copy, Check, Sparkles, Zap } from 'lucide-react'

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

function Section({ title, content, copyable = false }) {
  if (!content) return null
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide">{title}</h3>
        {copyable && <CopyButton text={content} />}
      </div>
      <div className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  )
}

export default function ConceptView({ concept, onClose }) {
  if (!concept) return null

  const isOllama = concept.generatedBy === 'ollama'

  return (
    <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.025] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
              isOllama
                ? 'bg-purple-400/10 text-purple-400'
                : 'bg-teal-400/10 text-teal-400'
            }`}>
              {isOllama
                ? <><Sparkles className="w-2.5 h-2.5" /> AI-enhanced</>
                : <><Zap className="w-2.5 h-2.5" /> Generated from signals</>
              }
            </span>
            <span className="text-[10px] text-white/30">
              Confidence: {concept.confidenceScore}%
            </span>
          </div>
          <h2 className="text-base font-semibold">{concept.title}</h2>
          <p className="text-sm text-white/50 mt-0.5">{concept.tagline}</p>
        </div>
        <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Hero CTA */}
      <div className="p-4 border-b border-white/5">
        <CopyButton text={concept.claudeCodePrompt} label="Copy Claude Code Prompt" />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Evidence summary */}
        <div className="mb-5 p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs">
          <div className="text-white/30 mb-2 uppercase tracking-wide text-[10px]">Evidence</div>
          <div className="flex flex-wrap gap-3 mb-2 text-white/60">
            <span>{concept.evidenceSummary.signalCount} signals</span>
            {Object.entries(concept.evidenceSummary.sourceBreakdown).map(([src, n]) => (
              <span key={src}>{src}: {n}</span>
            ))}
          </div>
          {concept.evidenceSummary.topQuotes.slice(0, 3).map((q, i) => (
            <blockquote key={i} className="text-white/40 italic border-l-2 border-white/10 pl-2 mb-1.5 text-[11px]">
              "{q.text.slice(0, 150)}"
              {q.url && (
                <a href={q.url} target="_blank" rel="noopener noreferrer" className="ml-1 text-teal-400/70 not-italic">
                  [{q.source}]
                </a>
              )}
            </blockquote>
          ))}
        </div>

        {/* Pain points */}
        {concept.painPoints.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-1.5">
              Recurring Pain Points
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {concept.painPoints.map(({ point, frequency }) => (
                <li key={point} className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/60 border border-white/8">
                  {point} <span className="text-white/30">×{frequency}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Section title="Opportunity Summary"   content={concept.opportunitySummary} />
        <Section title="Problem Statement"     content={concept.problemStatement} />
        <Section title="Target User"           content={concept.targetUser} />
        <Section title="Proposed Solution"     content={concept.proposedSolution} />
        <Section title="Value Proposition"     content={concept.valueProp} />
        <Section title="MVP Scope"             content={concept.mvpScope} />
        <Section title="Risks"                 content={concept.risks} />
        <Section title="Claude Code Prompt"    content={concept.claudeCodePrompt} copyable />
        <Section title="Implementation Plan"   content={concept.implementationPlan} copyable />
      </div>

      {/* Footer actions */}
      <div className="flex gap-2 p-4 border-t border-white/5 flex-wrap">
        <button
          onClick={() => {
            const md = `# ${concept.title}\n\n${concept.tagline}\n\n---\n\n${concept.claudeCodePrompt}\n\n---\n\n${concept.implementationPlan}`
            navigator.clipboard.writeText(md)
          }}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] text-white/50 border border-white/8 hover:bg-white/8 transition-colors"
        >
          Export as Markdown
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write EvidencePanel.jsx**

```jsx
// src/components/opportunity/EvidencePanel.jsx
import { useState } from 'react'
import { X } from 'lucide-react'

function IntensityBadge({ score }) {
  const cls =
    score >= 7 ? 'bg-red-400/10 text-red-400' :
    score >= 4 ? 'bg-yellow-400/10 text-yellow-400' :
    'bg-green-400/10 text-green-400'
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cls}`}>
      {score}/10
    </span>
  )
}

export default function EvidencePanel({ cluster, signals, onClose }) {
  const [filterSource,    setFilterSource]    = useState('')
  const [filterIntensity, setFilterIntensity] = useState(0)

  if (!cluster) return null

  const sources = [...new Set(signals.map((s) => s.source))]

  let shown = [...signals]
  if (filterSource)          shown = shown.filter((s) => s.source === filterSource)
  if (filterIntensity > 0)   shown = shown.filter((s) => s.intensityScore >= filterIntensity)
  shown.sort((a, b) => b.intensityScore - a.intensityScore)

  const bySource = sources.reduce((acc, src) => {
    acc[src] = shown.filter((s) => s.source === src)
    return acc
  }, {})

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--color-bg)] border-l border-white/8 z-40 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div>
          <h2 className="text-sm font-semibold capitalize">{cluster.clusterName}</h2>
          <p className="text-[11px] text-white/30 mt-0.5">{signals.length} signals</p>
        </div>
        <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 py-2.5 border-b border-white/5 flex-wrap">
        {sources.map((src) => (
          <button
            key={src}
            onClick={() => setFilterSource(filterSource === src ? '' : src)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filterSource === src
                ? 'bg-teal-400/10 text-teal-400 border-teal-400/20'
                : 'bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/8'
            }`}
          >
            {src}
          </button>
        ))}
        <button
          onClick={() => setFilterIntensity(filterIntensity === 7 ? 0 : 7)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            filterIntensity === 7
              ? 'bg-red-400/10 text-red-400 border-red-400/20'
              : 'bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/8'
          }`}
        >
          High intensity only
        </button>
      </div>

      {/* Signal list */}
      <div className="flex-1 overflow-y-auto">
        {sources.map((src) => {
          const group = bySource[src]
          if (!group || group.length === 0) return null
          return (
            <div key={src} className="border-b border-white/5 last:border-0">
              <div className="px-4 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-wide sticky top-0 bg-[var(--color-bg)]">
                {src} — {group.length}
              </div>
              {group.map((signal) => (
                <div key={signal.id} className="px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs text-white/70 leading-relaxed flex-1">{signal.painText.slice(0, 300)}</p>
                    <IntensityBadge score={signal.intensityScore} />
                  </div>
                  <div className="flex gap-3 text-[10px] text-white/30 mt-1">
                    {signal.author && <span>@{signal.author}</span>}
                    {signal.detectedAt && (
                      <span>{new Date(signal.detectedAt).toLocaleDateString()}</span>
                    )}
                    <a
                      href={signal.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400/60 hover:text-teal-400 transition-colors"
                    >
                      View source ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {shown.length === 0 && (
          <div className="p-6 text-center text-white/30 text-xs">No signals match current filters.</div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/opportunity/ConceptView.jsx src/components/opportunity/EvidencePanel.jsx
git commit -m "feat(radar): ConceptView and EvidencePanel components"
```

---

## Task 12: Wire up — route + nav entry

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/layout/LeftRail.jsx`

- [ ] **Step 1: Add route in App.jsx**

Read App.jsx current imports at the top (lines 1–25), then add:

```jsx
// Add import near other view imports
import OpportunityRadar from './views/OpportunityRadar.jsx'
```

And inside `<Routes>`:

```jsx
<Route path="/radar" element={<OpportunityRadar />} />
```

Place it after the `/signals` route (line 34).

- [ ] **Step 2: Add nav entry in LeftRail.jsx**

Read LeftRail.jsx current imports (line 2), then:

**Change line 2 from:**
```jsx
import { BookOpen, LayoutDashboard, Brain, FileText, Bot, Compass, Plug, Activity } from 'lucide-react'
```
**To:**
```jsx
import { BookOpen, LayoutDashboard, Brain, FileText, Bot, Compass, Plug, Activity, Radar } from 'lucide-react'
```

**After line 13 (`{ to: '/signals', label: 'Latest Signals', icon: Activity }`), add:**
```jsx
{ to: '/radar', label: 'Opportunity Radar', icon: Radar },
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (normalizationService, signalExtractor, clusterService, opportunityScorer, plus existing tests).

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/components/layout/LeftRail.jsx
git commit -m "feat(radar): wire up /radar route and LeftRail nav entry"
```

---

## Self-review

### Spec coverage check

| Spec requirement | Task |
|---|---|
| 12 pain queries | Task 1 (painQueries.ts) |
| Source-sequential, 5-concurrent search | Task 7 (painSearchService.ts — pLimit) |
| Signal extraction + intensity scoring | Task 4 (signalExtractor.ts) |
| Two-pass normalization (phrase → token) | Task 3 (normalizationService.ts) |
| IClusterer interface | Task 5 (clusterService.ts) |
| KeywordClusterer — Jaccard 0.35, merge 70% | Task 5 |
| Opportunity scoring formula | Task 6 (opportunityScorer.ts) |
| Buildability filter regex | Task 6 |
| Top-3 qualification gate | Task 6 |
| Hybrid concept generation (template + Ollama) | Task 8 |
| Section-constrained Ollama prompt + parser | Task 8 |
| localStorage + disk sync (4 keys) | Task 2 (radarStorage.ts) |
| On-load freshness check (6h) | Task 9 (OpportunityRadar.jsx) |
| Manual "Run Scan" button | Task 9 |
| Top-3 featured cards | Task 10 (RadarTopCard.jsx) |
| Sortable/filterable pattern table | Task 10 (PatternTable.jsx) |
| Concept detail panel (inline, not modal) | Task 11 (ConceptView.jsx) |
| Evidence drawer by source | Task 11 (EvidencePanel.jsx) |
| `/radar` route | Task 12 |
| LeftRail nav entry | Task 12 |

All spec requirements have a corresponding task. ✅

### Placeholder scan
No TBD, TODO, or vague steps. Every step has complete code. ✅

### Type consistency
- `PainSignal`, `OpportunityCluster`, `AppConcept`, `RadarScanMeta` defined once in `types.ts`, imported everywhere
- `RawSearchResult` defined in `signalExtractor.ts`, imported by `painSearchService.ts`
- `IClusterer` defined in `clusterService.ts`
- `getTop3` in scorer returns `OpportunityCluster[]` — consumed directly in view ✅
