import { describe, it, expect } from 'vitest'
import { parseBlocks } from '../ChatMessage.jsx'

describe('parseBlocks', () => {
  it('returns empty array for empty input', () => {
    expect(parseBlocks('')).toEqual([])
    expect(parseBlocks(null)).toEqual([])
  })

  it('parses a plain paragraph', () => {
    const blocks = parseBlocks('Hello world')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'paragraph', text: 'Hello world' })
  })

  it('parses a level-1 heading', () => {
    const blocks = parseBlocks('# My Title')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'My Title' })
  })

  it('parses a level-2 heading', () => {
    const blocks = parseBlocks('## Sub Title')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'heading', level: 2, text: 'Sub Title' })
  })

  it('parses an unordered list', () => {
    const blocks = parseBlocks('- Alpha\n- Beta\n- Gamma')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({
      type: 'list',
      ordered: false,
      items: ['Alpha', 'Beta', 'Gamma'],
    })
  })

  it('parses an ordered list', () => {
    const blocks = parseBlocks('1. First\n2. Second\n3. Third')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({
      type: 'list',
      ordered: true,
      items: ['First', 'Second', 'Third'],
    })
  })

  it('parses a code fence with language', () => {
    const blocks = parseBlocks('```html\n<h1>Hi</h1>\n```')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'code', lang: 'html', code: '<h1>Hi</h1>' })
  })

  it('parses a code fence with no language', () => {
    const blocks = parseBlocks('```\nconst x = 1\n```')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ type: 'code', lang: '', code: 'const x = 1' })
  })

  it('treats unclosed code fence as a code block to end of content', () => {
    const blocks = parseBlocks('```js\nconst x = 1')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('code')
    expect(blocks[0].code).toBe('const x = 1')
  })

  it('parses multiple blocks separated by blank lines', () => {
    const content = '# Heading\n\nFirst paragraph.\n\n- item one\n- item two'
    const blocks = parseBlocks(content)
    expect(blocks).toHaveLength(3)
    expect(blocks[0].type).toBe('heading')
    expect(blocks[1].type).toBe('paragraph')
    expect(blocks[2].type).toBe('list')
  })

  it('joins consecutive non-blank paragraph lines', () => {
    const blocks = parseBlocks('Line one\nLine two\nLine three')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].text).toBe('Line one Line two Line three')
  })
})
