import type { ContextFileReference } from '../types.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Content above this character count is offloaded to a file instead of inlined.
export const OFFLOAD_THRESHOLD_CHARS = 2000

// localStorage prefix for all stored context file bodies
const CTX_FILE_KEY_PREFIX = 'flowmap.mcp.ctxfile.'

// Index of all stored file references
const CTX_FILE_INDEX_KEY = 'flowmap.mcp.ctxfiles'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readIndex(): ContextFileReference[] {
  try {
    const raw = localStorage.getItem(CTX_FILE_INDEX_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ContextFileReference[]
  } catch {
    return []
  }
}

function writeIndex(refs: ContextFileReference[]): void {
  localStorage.setItem(CTX_FILE_INDEX_KEY, JSON.stringify(refs))
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Decides whether content should be offloaded.
 * Returns true if content.length > OFFLOAD_THRESHOLD_CHARS.
 */
export function shouldOffload(content: string): boolean {
  return content.length > OFFLOAD_THRESHOLD_CHARS
}

/**
 * Stores content in localStorage and returns a ContextFileReference.
 * The body is stored at key `${CTX_FILE_KEY_PREFIX}${fileId}`.
 * The reference is added to the index at CTX_FILE_INDEX_KEY.
 */
export function storeContextFile(
  content: string,
  opts: { title: string; contentType?: string; reasonIncluded: string }
): ContextFileReference {
  const random = Math.random().toString(36).slice(2, 8)
  const fileId = `ctxfile_${Date.now().toString(36)}_${random}`

  const ref: ContextFileReference = {
    fileId,
    title: opts.title,
    contentType: opts.contentType ?? 'text/plain',
    charCount: content.length,
    reasonIncluded: opts.reasonIncluded,
    createdAt: new Date().toISOString(),
  }

  // Store the body
  localStorage.setItem(`${CTX_FILE_KEY_PREFIX}${fileId}`, content)

  // Add to index
  const index = readIndex()
  index.push(ref)
  writeIndex(index)

  return ref
}

/**
 * Retrieves stored content for a file reference.
 * Returns null if not found.
 */
export function retrieveContextFile(fileId: string): string | null {
  return localStorage.getItem(`${CTX_FILE_KEY_PREFIX}${fileId}`)
}

/**
 * Deletes a stored file and removes it from the index.
 * No-op if not found.
 */
export function deleteContextFile(fileId: string): void {
  localStorage.removeItem(`${CTX_FILE_KEY_PREFIX}${fileId}`)

  const index = readIndex()
  const filtered = index.filter((ref) => ref.fileId !== fileId)
  writeIndex(filtered)
}

/**
 * Returns all stored ContextFileReference objects from the index.
 */
export function listContextFiles(): ContextFileReference[] {
  return readIndex()
}

/**
 * High-level helper: if content exceeds threshold, stores it and returns a reference.
 * If below threshold, returns null (caller should inline the content directly).
 */
export function maybeOffload(
  content: string,
  opts: { title: string; contentType?: string; reasonIncluded: string }
): ContextFileReference | null {
  if (!shouldOffload(content)) {
    return null
  }
  return storeContextFile(content, opts)
}

/**
 * Formats a ContextFileReference as a compact citation for prompt injection.
 * Used instead of embedding the full content.
 *
 * Returns: `[file:${ref.fileId}] ${ref.title} (${ref.charCount} chars) — ${ref.reasonIncluded}`
 */
export function formatReference(ref: ContextFileReference): string {
  return `[file:${ref.fileId}] ${ref.title} (${ref.charCount} chars) — ${ref.reasonIncluded}`
}
