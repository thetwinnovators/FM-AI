/**
 * corpusIngestor — reads FlowMap's own research corpus and produces
 * RawSearchResult records for the existing extraction pipeline.
 *
 * Five source adapters, each with its own text-extraction strategy:
 *   saves          → title + summary + keyPoints from bookmarked items
 *   documents      → document summary + first 2 000 chars of plainText
 *   manualContent  → same as saves (same ContentItem shape)
 *   topicSummaries → AI-generated overview + optional report text
 *   briefs         → strongest_signals, what_changed, open_questions, risks
 *
 * Design principles (from framework v3):
 *   1. Stable IDs  — same item always maps to the same signal ID (idempotent rescans)
 *   2. Source lineage — every record carries sourceId / sourceType / topicId
 *   3. Min-text gate — items with < 30 chars of body are silently skipped
 *   4. No side-effects — pure function, readable without touching localStorage
 *      when storeSlice is passed (production calls with no arg; tests inject slice)
 */

import type { RawSearchResult } from './signalExtractor.js'
import type { CorpusSourceType } from '../types.js'
import { SEED_CORPUS_ITEMS } from '../../venture-scope/seed/corpusSeedData.js'

// ─── Minimal store-slice types ────────────────────────────────────────────────
// We only type the fields we actually read; keeps the dependency surface small.

interface ContentItem {
  id:          string
  type?:       string
  title?:      string
  summary?:    string | null
  keyPoints?:  string[]
  url?:        string | null
  source?:     string
  topicIds?:   string[]
  publishedAt?: string | null
}

interface DocumentMeta {
  id:        string
  title?:    string
  summary?:  string | null
  topics?:   string[]        // topic IDs
  createdAt: string
}

interface DocumentContent {
  id:        string
  plainText: string
}

interface ManualContentEntry {
  id:       string
  item:     ContentItem
  topicId:  string | null
  topicIds: string[]
  savedAt:  string
}

interface TopicSummaryEntry {
  overview:     string
  report?:      string | null
  generatedAt?: number
}

interface BriefSection {
  type:   string
  content?: string
  items?: Array<{ text?: string; dot?: string } | string>
}

interface BriefEntry {
  id:          string
  topicId?:    string
  title?:      string
  sections:    BriefSection[]
  generatedAt?: number
}

export interface CorpusStoreSlice {
  saves?:           Record<string, { savedAt: string; item: ContentItem | null }>
  documents?:       Record<string, DocumentMeta>
  documentContents?: Record<string, DocumentContent>
  manualContent?:   Record<string, ManualContentEntry>
  topicSummaries?:  Record<string, TopicSummaryEntry>
  briefs?:          Record<string, BriefEntry>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FLOWMAP_STORE_KEY = 'flowmap.v1'
const MIN_BODY_CHARS    = 30

/** Stable hash → same sourceType + sourceId always yields the same signal ID. */
function corpusId(sourceType: CorpusSourceType, sourceId: string): string {
  const str = `corpus::${sourceType}::${sourceId}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return `sig_corpus_${Math.abs(hash).toString(36)}`
}

function makeRecord(
  sourceType: CorpusSourceType,
  sourceId:   string,
  title:      string,
  body:       string,
  url:        string,
  publishedAt: string | null | undefined,
  topicId?:   string | null,
  topicName?: string | null,
): RawSearchResult | null {
  const cleanBody = body.trim()
  if (cleanBody.length < MIN_BODY_CHARS) return null

  return {
    title:            title.slice(0, 200),
    body:             cleanBody.slice(0, 3_000),
    url:              url || `corpus://${sourceType}/${sourceId}`,
    source:           'corpus',
    publishedAt:      publishedAt ?? undefined,
    // Lineage
    corpusSourceId:   sourceId,
    corpusSourceType: sourceType,
    ...(topicId   && { corpusTopicId:   topicId   }),
    ...(topicName && { corpusTopicName: topicName }),
  }
}

// ─── Source adapters ──────────────────────────────────────────────────────────

/** Adapter A: bookmarked items (articles, videos, social posts). */
export function adaptSaves(
  saves: CorpusStoreSlice['saves'] = {},
): RawSearchResult[] {
  const out: RawSearchResult[] = []
  for (const [, entry] of Object.entries(saves)) {
    const item = entry?.item
    if (!item) continue

    const body = [
      item.summary ?? '',
      ...(item.keyPoints ?? []),
    ].join(' ').trim()

    const rec = makeRecord(
      'save',
      item.id,
      item.title ?? '',
      body,
      item.url ?? '',
      item.publishedAt,
      item.topicIds?.[0] ?? null,
    )
    if (rec) out.push(rec)
  }
  return out
}

/** Adapter B: uploaded / pasted documents. */
export function adaptDocuments(
  documents:       CorpusStoreSlice['documents']       = {},
  documentContents: CorpusStoreSlice['documentContents'] = {},
): RawSearchResult[] {
  const out: RawSearchResult[] = []
  for (const [id, doc] of Object.entries(documents)) {
    const content = documentContents[id]
    if (!content) continue

    // Prefer summary for extraction; fall back to first 2 000 chars of plainText
    const body = [
      doc.summary ?? '',
      content.plainText.slice(0, 2_000),
    ].join(' ').trim()

    const rec = makeRecord(
      'document',
      id,
      doc.title ?? `Document ${id}`,
      body,
      '',               // documents have no external URL
      doc.createdAt,
      doc.topics?.[0] ?? null,
    )
    if (rec) out.push(rec)
  }
  return out
}

/** Adapter C: user-added URLs (same ContentItem shape as saves). */
export function adaptManualContent(
  manualContent: CorpusStoreSlice['manualContent'] = {},
): RawSearchResult[] {
  const out: RawSearchResult[] = []
  for (const [, entry] of Object.entries(manualContent)) {
    const item = entry?.item
    if (!item) continue

    const body = [
      item.summary ?? '',
      ...(item.keyPoints ?? []),
    ].join(' ').trim()

    const rec = makeRecord(
      'manual_content',
      item.id,
      item.title ?? '',
      body,
      item.url ?? '',
      item.publishedAt,
      entry.topicId ?? item.topicIds?.[0] ?? null,
    )
    if (rec) out.push(rec)
  }
  return out
}

/** Adapter D: AI-generated topic overviews. */
export function adaptTopicSummaries(
  topicSummaries: CorpusStoreSlice['topicSummaries'] = {},
): RawSearchResult[] {
  const out: RawSearchResult[] = []
  for (const [topicId, entry] of Object.entries(topicSummaries)) {
    const body = [
      entry.overview ?? '',
      entry.report  ?? '',
    ].join(' ').trim()

    const rec = makeRecord(
      'topic_summary',
      topicId,
      `Topic summary: ${topicId}`,
      body,
      '',
      entry.generatedAt ? new Date(entry.generatedAt).toISOString() : null,
      topicId,
    )
    if (rec) out.push(rec)
  }
  return out
}

/** Extract text from a brief's sections into a single body string. */
function briefSectionsToText(sections: BriefSection[]): string {
  const parts: string[] = []
  for (const s of sections) {
    if (s.content) { parts.push(s.content); continue }
    if (Array.isArray(s.items)) {
      for (const item of s.items) {
        if (typeof item === 'string') parts.push(item)
        else if (item?.text)         parts.push(item.text)
      }
    }
  }
  return parts.join(' ').trim()
}

/** Adapter E: structured topic briefs. */
export function adaptBriefs(
  briefs: CorpusStoreSlice['briefs'] = {},
): RawSearchResult[] {
  const out: RawSearchResult[] = []
  for (const [, brief] of Object.entries(briefs)) {
    const body = briefSectionsToText(brief.sections ?? [])
    const rec  = makeRecord(
      'brief',
      brief.id,
      brief.title ?? `Brief ${brief.id}`,
      body,
      '',
      brief.generatedAt ? new Date(brief.generatedAt).toISOString() : null,
      brief.topicId ?? null,
    )
    if (rec) out.push(rec)
  }
  return out
}

/** Adapter F: static seed venture briefs bundled with the app.
 *  These items are NOT in localStorage — they survive resets and quota errors.
 *  Primary purpose: calibrate signal extraction and clustering with high-quality
 *  B2B/platform opportunity examples so the pipeline isn't biased toward
 *  solo-developer personal tools. */
export function adaptSeedCorpus(): RawSearchResult[] {
  return SEED_CORPUS_ITEMS.map((item) => ({
    title:            item.title.slice(0, 200),
    body:             item.body.slice(0, 3_000),
    url:              `corpus://seed/${item.id}`,
    source:           'corpus' as const,
    publishedAt:      item.publishedAt,
    corpusSourceId:   item.id,
    corpusSourceType: 'brief' as CorpusSourceType,
  }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read all five internal corpus sources and return RawSearchResult records
 * ready for the existing extraction pipeline.
 *
 * When `storeSlice` is omitted the function reads from `localStorage['flowmap.v1']`.
 * Pass a slice in tests to keep them pure and fast.
 *
 * Signal IDs are deterministic: re-ingesting the same item always yields the
 * same ID, so `appendSignals`'s dedup logic prevents duplicates on rescans.
 */
export function ingestCorpus(storeSlice?: CorpusStoreSlice): RawSearchResult[] {
  let slice: CorpusStoreSlice = storeSlice ?? {}

  if (!storeSlice) {
    try {
      const raw = typeof localStorage !== 'undefined'
        ? localStorage.getItem(FLOWMAP_STORE_KEY)
        : null
      if (raw) slice = JSON.parse(raw) as CorpusStoreSlice
    } catch {
      // localStorage unavailable (SSR / test env) — return empty
      return []
    }
  }

  const seen  = new Set<string>()
  const all   = [
    ...adaptSaves(slice.saves),
    ...adaptDocuments(slice.documents, slice.documentContents),
    ...adaptManualContent(slice.manualContent),
    ...adaptTopicSummaries(slice.topicSummaries),
    ...adaptBriefs(slice.briefs),
    // Adapter F: static seed briefs — always available, never in localStorage
    ...adaptSeedCorpus(),
  ]

  // Stable-ID dedupe: same content item mapped twice (e.g. save + manualContent) → keep first
  return all.filter((r) => {
    const id = corpusId(r.corpusSourceType as CorpusSourceType, r.corpusSourceId!)
    if (seen.has(id)) return false
    seen.add(id)
    // Rewrite the URL to the stable corpus ID so signalExtractor produces the same signal ID
    r.url = `corpus://${r.corpusSourceType}/${r.corpusSourceId}`
    return true
  })
}
