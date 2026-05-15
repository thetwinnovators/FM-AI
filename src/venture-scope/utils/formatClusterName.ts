/**
 * Converts a machine-generated cluster name into a human-readable display label.
 *
 * Handles two formats produced by the clustering algorithm:
 *
 *   NEW (sentence format) — no pipe separator:
 *     "Developers struggle with AI agent governance"
 *     "CTOs face tooling friction in legal ops"
 *     → returned as-is with acronym correction (ai → AI, llm → LLM)
 *
 *   LEGACY (pipe format) — from clusters stored before the sentence upgrade:
 *     "ProductManager | AutomationWorkflow"
 *     "workflow_improvement | saas_tools"
 *     → title-cased parts joined with · separator
 *     → "Product Manager · Automation Workflow"
 *     → "Workflow Improvement · SaaS Tools"
 */

// Acronyms that should always be fully uppercased
const ALWAYS_UPPER = new Set([
  'ai', 'ml', 'api', 'saas', 'b2b', 'b2c', 'crm', 'erp', 'llm',
  'ui', 'ux', 'hr', 'it', 'b2g', 'ipo', 'roi', 'kpi', 'sdk', 'mvp',
])

function titleWord(word: string): string {
  const lower = word.toLowerCase()
  if (ALWAYS_UPPER.has(lower)) return lower.toUpperCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/** Fix acronym casing in a sentence without capitalising every word. */
function fixAcronyms(sentence: string): string {
  return sentence
    .split(' ')
    .map((w) => {
      const lower = w.toLowerCase()
      if (ALWAYS_UPPER.has(lower)) return lower.toUpperCase()
      return w   // keep original casing — don't capitalise "struggle", "with", etc.
    })
    .join(' ')
}

export function formatClusterName(raw: string | undefined | null): string {
  if (!raw?.trim()) return ''

  // Sentence format (no | separator): apply acronym correction only
  if (!raw.includes('|')) {
    const trimmed = raw.trim()
    // Ensure first character is capitalised (guards against edge cases)
    const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    return fixAcronyms(capitalised)
  }

  // Legacy pipe format: title-case each part and join with ·
  return raw
    .split(/\s*\|\s*/)
    .map((part) =>
      part
        .replace(/([a-z])([A-Z])/g, '$1 $2')   // camelCase → spaced
        .replace(/[_-]+/g, ' ')                  // snake/kebab → spaced
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(titleWord)
        .join(' '),
    )
    .filter(Boolean)
    .join(' · ')
}
