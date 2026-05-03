/**
 * Deduplication utilities for the retrieval pipeline.
 *
 * Three levels of deduplication are applied before results reach the prompt:
 *  1. Exact ID deduplication (same item retrieved via multiple paths)
 *  2. Title deduplication (exact string match after normalisation)
 *  3. Near-duplicate detection via Jaccard word-set overlap
 */

// ─── exact id ─────────────────────────────────────────────────────────────────

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

// ─── exact title ─────────────────────────────────────────────────────────────

export function dedupeByTitle<T extends { title: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.title.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ─── near-duplicate ───────────────────────────────────────────────────────────

/**
 * Remove items whose title is very similar to one already kept, using Jaccard
 * similarity on the bag of words.  Default threshold 0.75 catches obvious
 * reformulations ("AI Agents Explained" vs "Explained: AI Agents") while
 * keeping genuinely different pieces with overlapping vocabulary.
 */
export function dedupeNearDuplicates<T extends { id: string; title: string }>(
  items: T[],
  threshold = 0.75,
): T[] {
  const kept: T[] = []
  const keptSets: Set<string>[] = []

  for (const item of items) {
    const words = titleWords(item.title)
    let isDup = false
    for (const existing of keptSets) {
      if (jaccardSimilarity(words, existing) >= threshold) {
        isDup = true
        break
      }
    }
    if (!isDup) {
      kept.push(item)
      keptSets.push(words)
    }
  }
  return kept
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1),
  )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const w of a) if (b.has(w)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}
