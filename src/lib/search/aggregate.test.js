import { describe, it, expect } from 'vitest'
import { groupByCategory, sortCategoryGroups } from './aggregate.js'

const items = [
  { id: 'a', title: 'Claude tool use deep dive', summary: '' },
  { id: 'b', title: 'How to build an MCP server', summary: '' },
  { id: 'c', title: 'Beginner tutorial: TypeScript', summary: '' },
  { id: 'd', title: 'GPT-4 benchmark roundup', summary: '' },
  { id: 'e', title: 'Random unrelated post', summary: '' },
]

describe('groupByCategory', () => {
  it('classifies and groups items by category', () => {
    const grouped = groupByCategory(items)
    expect(grouped.claude.find((x) => x.id === 'a')).toBeDefined()
    expect(grouped.mcp.find((x) => x.id === 'b')).toBeDefined()
    expect(grouped.education.find((x) => x.id === 'c')).toBeDefined()
    expect(grouped.generative_ai.find((x) => x.id === 'd')).toBeDefined()
    expect(grouped.uncategorized.find((x) => x.id === 'e')).toBeDefined()
  })
  it('attaches the category onto each item', () => {
    const grouped = groupByCategory(items)
    const claudeItem = grouped.claude[0]
    expect(claudeItem.category).toBe('claude')
  })
})

describe('sortCategoryGroups', () => {
  it('returns categories ordered by item count desc, with uncategorized last', () => {
    const grouped = {
      claude: [{ id: '1' }, { id: '2' }],
      mcp: [{ id: '3' }],
      uncategorized: [{ id: '4' }, { id: '5' }, { id: '6' }],
      design: [],
    }
    const sorted = sortCategoryGroups(grouped)
    expect(sorted[0].category).toBe('claude')
    expect(sorted[1].category).toBe('mcp')
    expect(sorted[sorted.length - 1].category).toBe('uncategorized')
    expect(sorted.every((g) => g.items.length > 0)).toBe(true)
  })
})
