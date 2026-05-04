/**
 * Ingestion pipeline — pre-embeds documents so runtime retrieval only needs to
 * embed the incoming query, not the full corpus.
 *
 * Architecture:
 *   ingestDocument(doc)
 *     → chunkDocument(doc.id, plainText)       — split into ~300-word chunks
 *     → for each chunk: embeddableText(title, chunkText)  — compact embed string
 *     → hashText(embedText)                    — stable FNV-1a content hash
 *     → embeddingStore.getIfFresh(chunkId, hash) — cache check
 *     → if stale/missing: getEmbedding(embedText) → embeddingStore.set(...)
 *
 * Key design decisions:
 *   - Sequential per-document, not concurrent — avoids flooding Ollama with
 *     parallel requests from a batch ingest.
 *   - Abort-signal aware at every embedding call so the user can cancel a
 *     long ingest without leaving dangling fetches.
 *   - Fully silent on failure — individual chunk embedding failures are
 *     counted but do not abort the document.  The pipeline runs in the
 *     background; errors should never surface to the UI.
 *   - Idempotent — re-running on an already-indexed document is cheap
 *     (all cache hits) and safe.
 */

import { chunkDocument }                        from './chunkingService.js'
import { getEmbedding, hashText, embeddableText } from '../utils/embeddings.js'
import { embeddingStore }                        from '../storage/embeddingStore.js'
import { OLLAMA_CONFIG }                         from '../../lib/llm/ollamaConfig.js'

// ─── types ────────────────────────────────────────────────────────────────────

export interface IngestableDocument {
  id:        string
  title:     string
  plainText: string
}

export interface IngestionResult {
  docId:          string
  chunksTotal:    number
  chunksEmbedded: number   // newly embedded (Ollama call was made)
  chunksSkipped:  number   // cache hit (no Ollama call needed)
  chunksFailed:   number   // Ollama unavailable or returned null
  durationMs:     number
}

// ─── single document ─────────────────────────────────────────────────────────

/**
 * Chunk and embed one document.  Returns an ingestion summary.
 *
 * If Ollama is disabled, all chunks are counted as failed (graceful degradation
 * — keyword retrieval still works without embeddings).
 */
export async function ingestDocument(
  doc:    IngestableDocument,
  signal?: AbortSignal,
): Promise<IngestionResult> {
  const t0 = Date.now()

  const chunks = chunkDocument(doc.id, doc.plainText)

  let embedded = 0
  let skipped  = 0
  let failed   = 0

  for (const chunk of chunks) {
    if (signal?.aborted) break

    const embedText = embeddableText(doc.title, chunk.text)
    const hash      = hashText(embedText)

    // Fast path: cache hit
    const cached = await embeddingStore.getIfFresh(chunk.id, hash)
    if (cached) {
      skipped++
      continue
    }

    // Ollama unavailable → count as failed, keep going
    if (!OLLAMA_CONFIG.enabled) {
      failed++
      continue
    }

    // Embed and persist
    const vector = await getEmbedding(embedText, signal)
    if (vector) {
      await embeddingStore.set({
        id:        chunk.id,
        vector,
        textHash:  hash,
        indexedAt: new Date().toISOString(),
      })
      embedded++
    } else {
      failed++
    }
  }

  return {
    docId:          doc.id,
    chunksTotal:    chunks.length,
    chunksEmbedded: embedded,
    chunksSkipped:  skipped,
    chunksFailed:   failed,
    durationMs:     Date.now() - t0,
  }
}

// ─── batch ingestion ─────────────────────────────────────────────────────────

/**
 * Ingest a collection of documents in sequence.
 *
 * @param docs        Documents to ingest (those with no plainText are skipped).
 * @param signal      Optional AbortSignal — cancels mid-batch.
 * @param onProgress  Called after each document with (completed, total).
 */
export async function ingestDocuments(
  docs:        IngestableDocument[],
  signal?:     AbortSignal,
  onProgress?: (completed: number, total: number) => void,
): Promise<IngestionResult[]> {
  const validDocs = docs.filter((d) => d.plainText && d.plainText.trim().length > 0)
  const results: IngestionResult[] = []

  for (let i = 0; i < validDocs.length; i++) {
    if (signal?.aborted) break
    const result = await ingestDocument(validDocs[i], signal)
    results.push(result)
    onProgress?.(i + 1, validDocs.length)
  }

  return results
}

// ─── eviction ─────────────────────────────────────────────────────────────────

/**
 * Remove all cached chunk embeddings for a document.
 * Called when a document is deleted so the embedding store doesn't accumulate
 * orphaned vectors.
 */
export async function evictDocument(docId: string, chunkCount: number): Promise<void> {
  const deletions: Promise<void>[] = []
  for (let i = 0; i < chunkCount; i++) {
    deletions.push(embeddingStore.delete(`${docId}_c${i}`))
  }
  // Also evict the whole-doc entry that older versions of the pipeline created
  deletions.push(embeddingStore.delete(docId))
  await Promise.all(deletions)
}
