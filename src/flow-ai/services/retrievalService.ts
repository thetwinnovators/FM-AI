/**
 * Retrieval service — main orchestration for the Flow AI pipeline.
 *
 * Architecture:
 *   Input (query + FlowMap data)
 *     → analyseQuery         — classify intent, choose priority types
 *     → buildCandidates      — turn FlowMap content into SearchCandidates
 *     → scoreKeywords        — BM25-inspired keyword scoring
 *     → embedAndScoreSemantic — Ollama embedding + cosine similarity (optional)
 *     → reciprocalRankFusion — merge keyword + semantic rankings
 *     → rerankCandidates     — six-factor final reranking
 *     → output (RankedResult[])
 *
 * Everything degrades gracefully: if Ollama is off the semantic branch is
 * skipped and the pipeline runs as pure keyword retrieval.
 */

import { getEmbedding, hashText, embeddableText } from '../utils/embeddings.js'
import { embeddingStore }                          from '../storage/embeddingStore.js'
import { chunkDocument, CHUNK_THRESHOLD_CHARS }    from './chunkingService.js'
import {
  type SearchCandidate,
  scoreKeyword,
  tokenise,
  attachSemanticScores,
  reciprocalRankFusion,
} from '../utils/hybridSearch.js'
import { rerankCandidates, type RankedResult }     from './rerankingService.js'
import { analyseQuery, type QueryAnalysis }        from './queryAnalysisService.js'

// ─── input / output types ─────────────────────────────────────────────────────

export interface RetrievalInput {
  query:            string

  // FlowMap store slices
  documents:        Record<string, any>  // useStore.documents
  documentContents: Record<string, any>  // useStore.documentContents
  memoryEntries:    Record<string, any>  // useStore.memoryEntries
  saves:            Record<string, any>  // useStore.saves
  views:            Record<string, any>  // useStore.views
  userTopics:       Record<string, any>  // useStore.userTopics

  // Additional sources
  seedTopics?:      any[]                // useSeed().topics
  signals?:         any[]                // localSignalsStorage.listSignals()
  userNotes?:       Record<string, any>  // useStore.userNotes

  // Tuning (optional — defaults from rerankingService)
  maxResults?:      number
  scoreThreshold?:  number
}

export interface RetrievalOutput {
  results:  RankedResult[]
  analysis: QueryAnalysis
  /** true if semantic embeddings were used this call */
  usedEmbeddings: boolean
}

// ─── main entry point ─────────────────────────────────────────────────────────

export async function retrieve(
  input: RetrievalInput,
  signal?: AbortSignal,
): Promise<RetrievalOutput> {
  const analysis = analyseQuery(input.query)

  // Casual chat: skip retrieval entirely
  if (analysis.intent === 'casual_chat' || analysis.maxResults === 0) {
    return { results: [], analysis, usedEmbeddings: false }
  }

  // 1. Build candidate pool from all FlowMap sources
  const candidates = buildCandidates(input)

  if (candidates.length === 0) {
    return { results: [], analysis, usedEmbeddings: false }
  }

  // 2. Keyword scoring (synchronous — always runs)
  const tokens = tokenise(input.query)
  const withKeyword = candidates.map((c) => ({
    ...c,
    keywordScore: scoreKeyword(tokens, c),
  }))

  // 3. Semantic scoring (async — only when Ollama is available)
  let withSemantic = withKeyword
  let usedEmbeddings = false

  const queryVector = await getEmbedding(input.query, signal)
  if (queryVector) {
    // Embed each candidate (with caching)
    const withVectors = await attachVectors(withKeyword, signal)
    withSemantic      = attachSemanticScores(withVectors, queryVector)
    usedEmbeddings    = true
  }

  // 4. RRF fusion
  const fused = reciprocalRankFusion(withSemantic)

  // 5. Rerank with multi-signal scoring
  const results = rerankCandidates(
    fused,
    input.saves,
    input.views,
    input.maxResults ?? analysis.maxResults,
    input.scoreThreshold,
  )

  // 6. Re-order by analysis priority types
  const prioritised = prioritiseByType(results, analysis.priorityTypes)

  return { results: prioritised, analysis, usedEmbeddings }
}

// ─── candidate builders ───────────────────────────────────────────────────────

function buildCandidates(input: RetrievalInput): SearchCandidate[] {
  return [
    ...buildDocumentCandidates(input),
    ...buildMemoryCandidates(input),
    ...buildSignalCandidates(input),
    ...buildTopicCandidates(input),
    ...buildSaveCandidates(input),
    ...buildNoteCandidates(input),
  ]
}

function buildDocumentCandidates(input: RetrievalInput): SearchCandidate[] {
  const candidates: SearchCandidate[] = []

  for (const doc of Object.values(input.documents)) {
    const content   = input.documentContents[doc.id]
    const plainText = (content?.plainText ?? '').trim()

    // ── Long documents: emit one candidate per chunk ───────────────────────
    if (plainText.length >= CHUNK_THRESHOLD_CHARS) {
      const chunks = chunkDocument(doc.id, plainText)
      for (const chunk of chunks) {
        candidates.push({
          id:          chunk.id,
          type:        'document' as const,
          title:       doc.title || 'Untitled document',
          snippet:     chunk.text.slice(0, 300),
          searchBody:  `${doc.title} ${chunk.text}`,
          date:        doc.updatedAt ?? doc.createdAt,
          hasSummary:  Boolean(doc.summary),
          wordCount:   chunk.wordCount,
          hasUrl:      Boolean(doc.url),
          url:         doc.url ?? undefined,
          sourceLabel: doc.sourceType ?? 'Document',
          topicTags:   doc.tags ?? [],
          docId:       doc.id,
        })
      }
      continue
    }

    // ── Short documents: single candidate (existing behaviour) ─────────────
    const body    = [doc.title, doc.summary, doc.excerpt, plainText].filter(Boolean).join(' ')
    const snippet = buildSnippet(
      doc.title,
      doc.summary ?? doc.excerpt ?? plainText.slice(0, 300),
    )
    candidates.push({
      id:          doc.id,
      type:        'document' as const,
      title:       doc.title || 'Untitled document',
      snippet,
      searchBody:  body,
      date:        doc.updatedAt ?? doc.createdAt,
      hasSummary:  Boolean(doc.summary),
      wordCount:   doc.wordCount ?? 0,
      hasUrl:      Boolean(doc.url),
      url:         doc.url ?? undefined,
      sourceLabel: doc.sourceType ?? 'Document',
      topicTags:   doc.tags ?? [],
      docId:       doc.id,
    })
  }

  return candidates
}

function buildMemoryCandidates(input: RetrievalInput): SearchCandidate[] {
  return Object.values(input.memoryEntries)
    .filter((m) => m.status !== 'dismissed' && m.isIdentityPinned !== true)
    .map((mem) => ({
      id:          mem.id,
      type:        'memory' as const,
      title:       mem.category ? `[${mem.category}] ${mem.content.slice(0, 60)}` : mem.content.slice(0, 60),
      snippet:     mem.content,
      searchBody:  `${mem.category ?? ''} ${mem.content}`,
      date:        mem.addedAt,
      hasSummary:  true,
      wordCount:   mem.content.split(/\s+/).length,
      sourceLabel: 'Memory',
    }))
}

function buildSignalCandidates(input: RetrievalInput): SearchCandidate[] {
  if (!input.signals?.length) return []
  return input.signals
    .filter((s) => !s.muted)
    .map((sig) => {
      const evidenceText = (sig.evidence ?? [])
        .map((e: any) => e.snippet ?? e.label ?? '')
        .filter(Boolean)
        .join(' ')
      const body = [sig.title, sig.summary, evidenceText].filter(Boolean).join(' ')
      return {
        id:           sig.id,
        type:         'signal' as const,
        title:        sig.title,
        snippet:      buildSnippet(sig.title, sig.summary),
        searchBody:   body,
        date:         sig.lastDetectedAt,
        pinned:       sig.pinned ?? false,
        hasSummary:   Boolean(sig.summary),
        hasKeyPoints: (sig.evidence?.length ?? 0) > 0,
        confidence:   sig.score,       // 0–100 signal confidence
        sourceLabel:  'Signal',
        topicTags:    sig.relatedTopicIds ?? [],
      }
    })
}

function buildTopicCandidates(input: RetrievalInput): SearchCandidate[] {
  const userTopicList  = Object.values(input.userTopics)
  const seedTopicList  = input.seedTopics ?? []
  const allTopics      = [...userTopicList, ...seedTopicList]

  return allTopics.map((t) => ({
    id:          t.id ?? t.slug,
    type:        'topic' as const,
    title:       t.name,
    snippet:     buildSnippet(t.name, t.summary),
    searchBody:  `${t.name} ${t.summary ?? ''} ${t.whyItMatters ?? ''}`,
    date:        t.addedAt,
    hasSummary:  Boolean(t.summary),
    sourceLabel: 'Topic',
  }))
}

function buildSaveCandidates(input: RetrievalInput): SearchCandidate[] {
  return Object.values(input.saves)
    .filter((s: any) => s.item)
    .map((s: any) => {
      const item = s.item
      return {
        id:          item.id,
        type:        'save' as const,
        title:       item.title ?? 'Saved item',
        snippet:     buildSnippet(item.title ?? '', item.summary ?? item.excerpt ?? ''),
        searchBody:  [item.title, item.summary, item.excerpt].filter(Boolean).join(' '),
        date:        s.savedAt,
        saved:       true,
        hasSummary:  Boolean(item.summary),
        hasUrl:      Boolean(item.url),
        url:         item.url ?? undefined,
        sourceLabel: item.source ?? 'Saved',
      }
    })
}

export function buildNoteCandidates(input: RetrievalInput): SearchCandidate[] {
  const notes = input.userNotes
  if (!notes || Object.keys(notes).length === 0) return []
  const candidates: SearchCandidate[] = []
  for (const [itemId, raw] of Object.entries(notes)) {
    const isArray = Array.isArray(raw)
    const entries: any[] = isArray
      ? raw
      : (raw !== null && typeof raw === 'object' && 'content' in raw ? [raw] : [])
    entries.forEach((n, idx) => {
      const text = String(n?.content ?? '').trim()
      if (!text) return
      const id = isArray ? `note_${itemId}_${idx}` : `note_${itemId}_flat`
      const titleStr = String(n?.title ?? '').trim() || `note: ${text.slice(0, 50)}`
      candidates.push({
        id,
        type:        'note' as const,
        title:       titleStr,
        snippet:     text.slice(0, 300),
        searchBody:  text,
        date:        n.updatedAt ?? n.addedAt,
        hasSummary:  true,
        wordCount:   text.split(/\s+/).length,
        sourceLabel: 'Note',
      })
    })
  }
  return candidates
}

// ─── vector attachment ────────────────────────────────────────────────────────

/** Attach cached or freshly-computed vectors to each candidate. */
async function attachVectors(
  candidates: SearchCandidate[],
  signal?: AbortSignal,
): Promise<SearchCandidate[]> {
  const result: SearchCandidate[] = []

  for (const c of candidates) {
    if (signal?.aborted) { result.push(c); continue }

    const text = embeddableText(c.title, c.snippet)
    const hash = hashText(text)

    // Try cache first
    const cached = await embeddingStore.getIfFresh(c.id, hash)
    if (cached) {
      result.push({ ...c, vector: cached })
      continue
    }

    // Embed and cache
    const vector = await getEmbedding(text, signal)
    if (vector) {
      await embeddingStore.set({ id: c.id, vector, textHash: hash, indexedAt: new Date().toISOString() })
      result.push({ ...c, vector })
    } else {
      result.push(c)
    }
  }

  return result
}

// ─── priority reordering ──────────────────────────────────────────────────────

/**
 * Within the top half of results (by score), elevate items matching the
 * priority type order from the query analysis.  This ensures e.g. a signal
 * query surfaces signals above equally-scored documents.
 */
function prioritiseByType(
  results: RankedResult[],
  priorityTypes: string[],
): RankedResult[] {
  if (results.length <= 1 || priorityTypes.length === 0) return results

  const pivot   = Math.ceil(results.length / 2)
  const top     = results.slice(0, pivot)
  const rest    = results.slice(pivot)

  top.sort((a, b) => {
    const ai = priorityTypes.indexOf(a.type)
    const bi = priorityTypes.indexOf(b.type)
    const aRank = ai === -1 ? priorityTypes.length : ai
    const bRank = bi === -1 ? priorityTypes.length : bi
    if (aRank !== bRank) return aRank - bRank
    return b.relevanceScore - a.relevanceScore
  })

  return [...top, ...rest]
}

// ─── snippet helper ───────────────────────────────────────────────────────────

function buildSnippet(title: string, body: string): string {
  if (!body) return title.slice(0, 200)
  const combined = body.trim()
  return combined.length > 300 ? combined.slice(0, 297) + '…' : combined
}
