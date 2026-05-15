/**
 * Converts a machine-generated cluster name into a human-readable, title-cased
 * display label.
 *
 * The clustering algorithm produces names in several raw formats:
 *   • Keyword fallback:   "ai automation workflow"
 *   • camelCase entity:   "ProductManager | AutomationWorkflow"
 *   • snake_case entity:  "workflow_improvement | saas_tools"
 *   • Mixed:              "ProductManager | ai_tools b2b"
 *
 * Output examples:
 *   "ai automation workflow"          → "AI Automation Workflow"
 *   "ProductManager | AutomationWorkflow" → "Product Manager · Automation Workflow"
 *   "workflow_improvement | saas_tools"   → "Workflow Improvement · SaaS Tools"
 */

// Words that should be fully uppercased regardless of position
const ALWAYS_UPPER = new Set([
  'ai', 'ml', 'api', 'saas', 'b2b', 'b2c', 'crm', 'erp', 'llm',
  'ui', 'ux', 'hr', 'it', 'b2g', 'ipo', 'roi', 'kpi', 'sdk', 'mvp',
])

function titleWord(word: string): string {
  const lower = word.toLowerCase()
  if (ALWAYS_UPPER.has(lower)) return lower.toUpperCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function formatClusterName(raw: string | undefined | null): string {
  if (!raw?.trim()) return ''

  return raw
    // Split on pipe separator used in entity-pattern names
    .split(/\s*\|\s*/)
    .map((part) =>
      part
        // Split camelCase:  "ProductManager" → "Product Manager"
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Underscores and hyphens → spaces
        .replace(/[_-]+/g, ' ')
        // Collapse whitespace
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(titleWord)
        .join(' '),
    )
    .filter(Boolean)
    // Use · as the visual separator instead of the raw |
    .join(' · ')
}
