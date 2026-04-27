import { describe, it, expect } from 'vitest'
import { classify, CATEGORIES, scoreCategories } from './classify.js'

function item(title, summary = '') {
  return { title, summary }
}

describe('CATEGORIES', () => {
  it('exports an ordered list of 10 category ids', () => {
    expect(Array.isArray(CATEGORIES)).toBe(true)
    expect(CATEGORIES.length).toBe(10)
    expect(CATEGORIES.includes('mcp')).toBe(true)
    expect(CATEGORIES.includes('claude')).toBe(true)
    expect(CATEGORIES.includes('vibe_coding')).toBe(true)
    expect(CATEGORIES.includes('ai_agents')).toBe(true)
    expect(CATEGORIES.includes('ide')).toBe(true)
    expect(CATEGORIES.includes('ux')).toBe(true)
    expect(CATEGORIES.includes('design')).toBe(true)
    expect(CATEGORIES.includes('automation')).toBe(true)
    expect(CATEGORIES.includes('generative_ai')).toBe(true)
    expect(CATEGORIES.includes('education')).toBe(true)
  })
})

describe('classify', () => {
  it('returns Claude for Claude-named items', () => {
    expect(classify(item('Claude Sonnet update'))).toBe('claude')
    expect(classify(item('Anthropic launches Claude 4.7'))).toBe('claude')
  })

  it('returns MCP for protocol-named items', () => {
    expect(classify(item('Model Context Protocol intro'))).toBe('mcp')
    expect(classify(item('How to build an MCP server'))).toBe('mcp')
  })

  it('Claude beats generative_ai when both keywords present', () => {
    expect(classify(item('Claude vs GPT for code generation'))).toBe('claude')
  })

  it('MCP beats Claude when MCP is the focus', () => {
    expect(classify(item('Claude MCP server walkthrough'), 'model context protocol mcp tool')).toBe('mcp')
  })

  it('classifies vibe coding posts', () => {
    expect(classify(item('My vibecoding setup with Cursor'))).toBe('vibe_coding')
  })

  it('classifies AI Agents posts', () => {
    expect(classify(item('Building an autonomous agent loop'))).toBe('ai_agents')
    expect(classify(item('LangGraph multi-agent example'))).toBe('ai_agents')
  })

  it('classifies IDE posts', () => {
    expect(classify(item('VS Code keybindings to know'))).toBe('ide')
    expect(classify(item('Switching from JetBrains to Neovim'))).toBe('ide')
  })

  it('classifies UX posts', () => {
    expect(classify(item('UX research methods'))).toBe('ux')
    expect(classify(item('Wireframing and user flows'))).toBe('ux')
  })

  it('classifies Design posts', () => {
    expect(classify(item('Typography systems for product teams'))).toBe('design')
    expect(classify(item('Visual branding case study'))).toBe('design')
  })

  it('classifies Automation posts', () => {
    expect(classify(item('CI/CD pipeline with GitHub Actions'))).toBe('automation')
    expect(classify(item('Workflow automation with n8n'))).toBe('automation')
  })

  it('classifies Generative AI posts', () => {
    expect(classify(item('GPT-5 benchmark roundup'))).toBe('generative_ai')
    expect(classify(item('Stable Diffusion XL release notes'))).toBe('generative_ai')
  })

  it('classifies Education posts', () => {
    expect(classify(item('Beginner tutorial: learn TypeScript in a weekend'))).toBe('education')
  })

  it('returns "uncategorized" when no keywords match', () => {
    expect(classify(item('Random update with no keywords'))).toBe('uncategorized')
  })

  it('uses summary as well as title for matching', () => {
    expect(classify(item('Untitled', 'A quick guide to Claude tool use'))).toBe('claude')
  })
})

describe('scoreCategories', () => {
  it('returns a numeric score per category', () => {
    const scores = scoreCategories(item('Claude code agent'))
    expect(typeof scores.claude).toBe('number')
    expect(scores.claude).toBeGreaterThan(0)
  })
  it('scores zero for non-matching categories', () => {
    const scores = scoreCategories(item('Claude code agent'))
    expect(scores.design).toBe(0)
  })
})
