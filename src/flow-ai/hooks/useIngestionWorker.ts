/**
 * useIngestionWorker — background embedding hook.
 *
 * Indexes two data types into the vector store so Flow AI can find them:
 *
 *   1. Documents (pasted text / uploaded files)
 *      - Watches documentContents for new / changed plainText
 *      - Chunks each doc and embeds via Ollama
 *      - Evicts stale chunk vectors when a document is deleted
 *
 *   2. Manual content (user-saved URLs with title + description)
 *      - Watches manualContent for new / changed items
 *      - Embeds title + description as a single short record keyed "manual_<id>"
 *
 * Design:
 *   - Content hash per item → re-renders and unchanged items are no-ops.
 *   - Each item is queued independently — one failure never blocks others.
 *   - Abort controller tied to hook lifetime cancels in-flight Ollama calls.
 *   - Fully silent — never throws or logs in production.
 */

import { useEffect, useRef }             from 'react'
import { ingestDocument, evictDocument } from '../services/ingestionPipeline.js'
import { getEmbedding, hashText }        from '../utils/embeddings.js'
import { embeddingStore }                from '../storage/embeddingStore.js'
import { OLLAMA_CONFIG }                 from '../../lib/llm/ollamaConfig.js'

// ─── types ────────────────────────────────────────────────────────────────────

interface ContentEntry {
  plainText?: string
}

interface ManualItem {
  id?:          string
  title?:       string
  description?: string
  body?:        string
  excerpt?:     string
}

interface ManualContentEntry {
  item?: ManualItem
}

// ─── hook ─────────────────────────────────────────────────────────────────────

/**
 * Mount at the App root so it runs for the lifetime of the session.
 *
 * @param documents        useStore().documents         — doc metadata
 * @param documentContents useStore().documentContents  — doc text content
 * @param manualContent    useStore().manualContent      — user-saved URLs
 */
export function useIngestionWorker(
  documents:        Record<string, { id: string; title: string }>,
  documentContents: Record<string, ContentEntry>,
  manualContent:    Record<string, ManualContentEntry> = {},
): void {

  // docId → hash of last-dispatched plainText
  const docHashRef    = useRef<Map<string, string>>(new Map())
  // Set of docIds seen last run — used to detect deletions
  const prevDocIdsRef = useRef<Set<string>>(new Set())
  // itemId → hash of last-dispatched manual content text
  const manualHashRef = useRef<Map<string, string>>(new Map())

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current = new AbortController()
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  // ── 1. Document embedding + eviction on delete ───────────────────────────
  useEffect(() => {
    if (!documentContents || !documents) return
    const ctrl = abortRef.current
    if (!ctrl || ctrl.signal.aborted) return

    const currentDocIds = new Set(Object.keys(documentContents))

    // Detect deleted documents and evict their vectors
    for (const oldId of prevDocIdsRef.current) {
      if (!currentDocIds.has(oldId)) {
        docHashRef.current.delete(oldId)
        evictDocument(oldId).catch(() => { /* silent */ })
      }
    }
    prevDocIdsRef.current = currentDocIds

    // Embed new / changed documents
    for (const [docId, content] of Object.entries(documentContents)) {
      const plainText = content?.plainText?.trim()
      if (!plainText) continue

      const meta = documents[docId]
      if (!meta) continue

      const contentHash = hashText(plainText)
      if (docHashRef.current.get(docId) === contentHash) continue

      docHashRef.current.set(docId, contentHash)

      ingestDocument(
        { id: docId, title: meta.title || '', plainText },
        ctrl.signal,
      ).catch(() => {
        docHashRef.current.delete(docId)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentContents])

  // ── 2. Manual content embedding ──────────────────────────────────────────
  useEffect(() => {
    if (!manualContent) return
    const ctrl = abortRef.current
    if (!ctrl || ctrl.signal.aborted) return

    for (const [entryId, entry] of Object.entries(manualContent)) {
      const item = entry?.item
      if (!item) continue

      // Build the embeddable text from available fields
      const title = item.title?.trim() ?? ''
      const body  = (item.description ?? item.excerpt ?? item.body ?? '').trim()
      const text  = [title, body].filter(Boolean).join('\n')
      if (!text) continue

      const contentHash = hashText(text)
      const storeId     = `manual_${entryId}`

      if (manualHashRef.current.get(storeId) === contentHash) continue
      manualHashRef.current.set(storeId, contentHash)

      if (!OLLAMA_CONFIG.enabled) continue

      // Single-record embed — no chunking needed for short snippets
      ;(async () => {
        try {
          if (ctrl.signal.aborted) return
          const vector = await getEmbedding(text, ctrl.signal)
          if (vector) {
            await embeddingStore.set({
              id:        storeId,
              vector,
              textHash:  contentHash,
              indexedAt: new Date().toISOString(),
            })
          }
        } catch {
          manualHashRef.current.delete(storeId)
        }
      })()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualContent])
}
