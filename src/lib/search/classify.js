// Categories listed from most-specific to most-general so the first match wins ties.
export const CATEGORIES = [
  'mcp',
  'claude',
  'vibe_coding',
  'ai_agents',
  'ide',
  'ux',
  'design',
  'automation',
  'generative_ai',
  'education',
]

export const CATEGORY_LABELS = {
  mcp: 'MCP',
  claude: 'Claude',
  vibe_coding: 'Vibe Coding',
  ai_agents: 'AI Agents',
  ide: 'IDE',
  ux: 'UX',
  design: 'Design',
  automation: 'Automation',
  generative_ai: 'Generative AI',
  education: 'Education',
}

// Each keyword can be a string (substring match) or a regex.
// Multi-word entries are quoted as phrases for substring match.
const KEYWORDS = {
  mcp: [
    'model context protocol', 'modelcontextprotocol', 'mcp server', 'mcp client',
    'mcp tool', 'mcp host', /\bmcp\b/i,
  ],
  claude: [
    'claude code', 'claude api', 'claude sonnet', 'claude opus', 'claude haiku',
    'anthropic', 'claude.com', /\bclaude\b/i,
  ],
  vibe_coding: [
    'vibe coding', 'vibecoding', 'vibe-coding', 'ai-assisted coding', 'ai pair programming',
    'ai-native coding', 'agentic coding',
  ],
  ai_agents: [
    'autonomous agent', 'agentic', 'agent loop', 'multi-agent', 'multi agent',
    'langgraph', 'langchain', 'autogen', 'crewai', 'agent framework', /\bagent\b/i,
  ],
  ide: [
    'vs code', 'vscode', 'visual studio code', 'jetbrains', 'intellij', 'pycharm',
    'webstorm', 'neovim', 'nvim', 'emacs', 'cursor editor', 'cursor ide',
    'github copilot', 'zed editor',
  ],
  ux: [
    'user experience', 'usability', 'user research', 'wireframe', 'prototype',
    'accessibility', /\ba11y\b/i, 'user flow', 'interaction design', /\bux\b/i,
  ],
  design: [
    'visual design', 'typography', 'branding', 'illustration', 'graphic design',
    'design system', 'figma', 'sketch app', /\bui\b/i, 'color palette',
  ],
  automation: [
    'workflow automation', 'ci/cd', 'github actions', 'gitlab ci', 'jenkins',
    'zapier', 'n8n', 'make.com', 'ifttt', 'rpa', 'robotic process automation',
    'pipeline', 'cron job', 'cron jobs',
  ],
  generative_ai: [
    'generative ai', 'gen ai', 'chatgpt', 'gpt-4', 'gpt-5', 'gpt5', 'openai',
    'gemini', 'llama 3', 'llama 4', 'mistral', 'stable diffusion', 'dall-e',
    'dalle', 'midjourney', 'sora', 'image generation', 'video generation',
    /\bllm\b/i, /\bllms\b/i, 'large language model',
  ],
  education: [
    'tutorial', 'beginner', 'crash course', 'walkthrough', 'how to', 'learn ',
    'introduction to', 'intro to', 'getting started', 'a guide to', /\bcourse\b/i,
    'mooc', 'lesson',
  ],
}

function matchCount(haystack, patterns) {
  let count = 0
  for (const p of patterns) {
    if (typeof p === 'string') {
      if (haystack.includes(p)) count += 1
    } else {
      const matches = haystack.match(p)
      if (matches) count += matches.length
    }
  }
  return count
}

export function scoreCategories(item) {
  const haystack = `${item.title || ''} ${item.summary || ''}`.toLowerCase()
  const scores = {}
  for (const cat of CATEGORIES) {
    scores[cat] = matchCount(haystack, KEYWORDS[cat])
  }
  return scores
}

export function classify(item) {
  const scores = scoreCategories(item)
  let best = null
  let bestScore = 0
  for (const cat of CATEGORIES) {
    if (scores[cat] > bestScore) {
      best = cat
      bestScore = scores[cat]
    }
  }
  return best || 'uncategorized'
}
