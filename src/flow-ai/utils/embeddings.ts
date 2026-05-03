/**
 * Ollama embedding utilities.
 *
 * Generates float-vector embeddings for arbitrary text via the local Ollama
 * instance.  Everything degrades gracefully: if Ollama is off or the model
 * doesn't support embeddings the functions return null and callers fall back
 * to keyword-only search.
 */

import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'

// ─── embed ────────────────────────────────────────────────────────────────────

/**
 * Embed a single piece of text.  Returns null when Ollama is unavailable or
 * the request fails.  Text is truncated to 3 000 chars before sending to stay
 * comfortably within context windows.
 */
export async function getEmbedding(
  text: string,
  signal?: AbortSignal,
): Promise<number[] | null> {
  if (!OLLAMA_CONFIG.enabled) return null
  const trimmed = text.trim().slice(0, 3000)
  if (!trimmed) return null
  try {
    const res = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_CONFIG.model, prompt: trimmed }),
      signal,
    })
    if (!res.ok) return null
    const json = await res.json() as { embedding?: number[] }
    return Array.isArray(json.embedding) && json.embedding.length > 0
      ? json.embedding
      : null
  } catch {
    return null
  }
}

/**
 * Embed multiple texts in series.  Returns an array of the same length with
 * null entries where embedding failed.
 */
export async function getEmbeddings(
  texts: string[],
  signal?: AbortSignal,
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = []
  for (const text of texts) {
    if (signal?.aborted) {
      results.push(null)
    } else {
      results.push(await getEmbedding(text, signal))
    }
  }
  return results
}

// ─── similarity ───────────────────────────────────────────────────────────────

/**
 * Cosine similarity between two vectors, returning a value in [–1, 1].
 * Returns 0 when either vector is zero-length or the dimensions differ.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ─── hashing ─────────────────────────────────────────────────────────────────

/**
 * Fast FNV-1a 32-bit hash of a string, returned as a hex string.
 * Used to detect whether content has changed since it was last embedded.
 */
export function hashText(text: string): string {
  let h = 2166136261 >>> 0
  for (let i = 0; i < Math.min(text.length, 8000); i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h.toString(16)
}

// ─── text prep ────────────────────────────────────────────────────────────────

/**
 * Build the canonical text that gets embedded for a given item.
 * Keeps it short and high-signal: title + summary/excerpt only.
 */
export function embeddableText(
  title: string,
  body?: string | null,
): string {
  const parts = [title.trim()]
  if (body) parts.push(body.trim().slice(0, 800))
  return parts.join(' — ')
}
