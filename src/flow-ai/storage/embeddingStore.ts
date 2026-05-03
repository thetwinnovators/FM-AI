/**
 * IndexedDB-backed embedding cache.
 *
 * Embeddings are expensive (one Ollama round-trip each), so we cache them
 * keyed by content ID.  A content hash (FNV-1a) tracks whether the underlying
 * text has changed; if it has the stored vector is evicted and re-generated.
 *
 * The store degrades silently: if IndexedDB is unavailable (private browsing,
 * quota exceeded, etc.) all reads return null and writes are no-ops.
 */

const DB_NAME    = 'flowmap-embeddings'
const STORE_NAME = 'embeddings'
const DB_VERSION = 1

// ─── types ────────────────────────────────────────────────────────────────────

export interface EmbeddingRecord {
  id:          string    // content ID (document id, signal id, etc.)
  vector:      number[]
  textHash:    string    // FNV-1a hash of the text that was embedded
  indexedAt:   string    // ISO timestamp
}

// ─── store ────────────────────────────────────────────────────────────────────

class EmbeddingStore {
  private db: IDBDatabase | null = null
  private opening: Promise<IDBDatabase> | null = null

  // ── lifecycle ──────────────────────────────────────────────────────────────

  private open(): Promise<IDBDatabase> {
    if (this.db)      return Promise.resolve(this.db)
    if (this.opening) return this.opening

    this.opening = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)

      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      }
      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result
        this.opening = null
        resolve(this.db)
      }
      req.onerror = () => {
        this.opening = null
        reject(req.error)
      }
    })
    return this.opening
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async get(id: string): Promise<EmbeddingRecord | null> {
    try {
      const db = await this.open()
      return new Promise((resolve) => {
        const tx  = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(id)
        req.onsuccess = () => resolve((req.result as EmbeddingRecord) ?? null)
        req.onerror   = () => resolve(null)
      })
    } catch {
      return null
    }
  }

  async set(record: EmbeddingRecord): Promise<void> {
    try {
      const db = await this.open()
      await new Promise<void>((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, 'readwrite')
        const req = tx.objectStore(STORE_NAME).put(record)
        req.onsuccess = () => resolve()
        req.onerror   = () => reject(req.error)
      })
    } catch { /* silent — non-fatal */ }
  }

  async delete(id: string): Promise<void> {
    try {
      const db = await this.open()
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror    = () => resolve()
      })
    } catch { /* silent */ }
  }

  /** Wipe all stored embeddings (useful after a model change). */
  async clear(): Promise<void> {
    try {
      const db = await this.open()
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).clear()
        tx.oncomplete = () => resolve()
        tx.onerror    = () => resolve()
      })
    } catch { /* silent */ }
  }

  // ── helper: get-or-embed ───────────────────────────────────────────────────

  /**
   * Return a cached vector for `id` if its `textHash` still matches.
   * Returns null if the content has changed or was never embedded.
   */
  async getIfFresh(id: string, currentHash: string): Promise<number[] | null> {
    const record = await this.get(id)
    if (!record) return null
    return record.textHash === currentHash ? record.vector : null
  }
}

export const embeddingStore = new EmbeddingStore()
