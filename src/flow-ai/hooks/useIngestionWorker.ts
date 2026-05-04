/**
 * useIngestionWorker — background document embedding hook.
 *
 * Watches the document store for new or updated documents and automatically
 * triggers chunk embedding via the ingestion pipeline.  This is the mechanism
 * that turns the pipeline from lazy (cold-start O(N × 80ms)) into pre-indexed
 * (query time only embeds the incoming query).
 *
 * Design:
 *   - Tracks a hash per document so re-renders don't retrigger ingestion.
 *   - Each document is queued independently — one document's failure doesn't
 *     block others.
 *   - Uses a stable abort controller tied to the hook lifetime so Ollama
 *     requests are cancelled on unmount.
 *   - Fully silent — never throws or logs to the console in production.
 */

import { useEffect, useRef } from 'react'
import { ingestDocument }    from '../services/ingestionPipeline.js'
import { hashText }          from '../utils/embeddings.js'

interface DocEntry {
  id:        string
  title:     string
  plainText: string
}

interface ContentEntry {
  plainText?: string
}

/**
 * Mount this hook at the App root so it runs for the lifetime of the session.
 *
 * @param documents        useStore().documents   — record of doc metadata
 * @param documentContents useStore().documentContents — record of doc content
 */
export function useIngestionWorker(
  documents:        Record<string, { id: string; title: string }>,
  documentContents: Record<string, ContentEntry>,
): void {
  // Map of docId → hash of the last plainText we successfully dispatched for
  // ingestion.  Persists across re-renders via ref so we never re-queue a doc
  // whose content hasn't changed.
  const ingestedHashRef = useRef<Map<string, string>>(new Map())

  // Abort controller for in-flight embedding requests — cancelled on unmount.
  const abortRef = useRef<AbortController | null>(null)

  // Cancel any pending embeddings when the component unmounts (e.g. hot-reload
  // or user closes the tab before a batch completes).
  useEffect(() => {
    abortRef.current = new AbortController()
    return () => {
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!documentContents || !documents) return

    const ctrl = abortRef.current
    if (!ctrl || ctrl.signal.aborted) return

    for (const [docId, content] of Object.entries(documentContents)) {
      const plainText = content?.plainText?.trim()
      if (!plainText) continue

      const meta = documents[docId]
      if (!meta) continue

      // Cheap change detection — skip if we already dispatched this exact text.
      const contentHash = hashText(plainText)
      if (ingestedHashRef.current.get(docId) === contentHash) continue

      // Mark as dispatched before firing so concurrent effect invocations
      // (React StrictMode double-invoke) don't queue the same doc twice.
      ingestedHashRef.current.set(docId, contentHash)

      const doc: DocEntry = { id: docId, title: meta.title || '', plainText }

      // Fire and forget — errors are caught inside ingestDocument and counted
      // but never re-thrown.
      ingestDocument(doc, ctrl.signal).catch(() => {
        // If ingestion fails (e.g. Ollama stopped), clear the hash so the
        // next effect run will retry when the document hasn't changed.
        ingestedHashRef.current.delete(docId)
      })
    }
  // We intentionally only re-run when content changes, not on every render.
  // documents is stable enough for our purposes (title changes are rare).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentContents])
}
