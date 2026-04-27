export const mockTopics = [
  { id: 't1', name: 'Claude', followers: 12400, trend: 'up' },
  { id: 't2', name: 'MCP (Model Context Protocol)', followers: 8300, trend: 'up' },
  { id: 't3', name: 'Vibecoding', followers: 4500, trend: 'stable' },
  { id: 't4', name: 'Agent Workflows', followers: 15200, trend: 'up' },
  { id: 't5', name: 'Browser Automation', followers: 6100, trend: 'stable' }
];

export const mockContent = [
  {
    id: 'c1',
    type: 'video',
    title: 'Building Claude MCP Servers in TypeScript',
    source: 'YouTube',
    author: 'CodeWithAI',
    date: '2h ago',
    topics: ['t1', 't2'],
    relevance: 'High signal: Direct implementation tutorial',
    saved: false,
    url: '#'
  },
  {
    id: 'c2',
    type: 'article',
    title: 'The Rise of Vibecoding: Programming with Natural Language',
    source: 'Substack',
    author: 'TechTrends',
    date: '5h ago',
    topics: ['t3'],
    relevance: 'Explains core concept you follow',
    saved: true,
    url: '#'
  },
  {
    id: 'c3',
    type: 'social',
    title: 'Thread: How we use Cursor and Claude to ship 5x faster',
    source: 'Twitter',
    author: '@dev_builder',
    date: '1d ago',
    topics: ['t1', 't3'],
    relevance: 'Trending among developers you follow',
    saved: false,
    url: '#'
  },
  {
    id: 'c4',
    type: 'article',
    title: 'Agentic Workflows vs Traditional Automation',
    source: 'Medium',
    author: 'AI Researcher',
    date: '2d ago',
    topics: ['t4', 't5'],
    relevance: 'Comparative analysis of your tracked topics',
    saved: false,
    url: '#'
  }
];

export const mockLearningCards = [
  {
    id: 'l1',
    topicId: 't2',
    concept: 'Model Context Protocol (MCP)',
    explanation: 'An open standard that enables AI models to securely access local and remote data sources using standard interfaces.',
    whyItMatters: 'It solves the problem of connecting LLMs to your actual tools and databases without writing custom integration code for every model.',
    example: 'A GitHub MCP server lets Claude read your repositories, while a SQLite MCP server lets it query your local database.'
  },
  {
    id: 'l2',
    topicId: 't3',
    concept: 'Vibecoding',
    explanation: 'Writing software by directing AI models through natural language conversations rather than manually typing syntax.',
    whyItMatters: 'Shifts the developer role from syntax-writer to architect and reviewer, drastically accelerating prototype speed.',
    example: 'Using Cursor to generate a React component by just describing its layout and behavior.'
  }
];

export const mockGraphData = {
  nodes: [
    { id: 'n1', data: { label: 'Claude', type: 'topic' }, position: { x: 250, y: 150 }, type: 'custom' },
    { id: 'n2', data: { label: 'Anthropic', type: 'company' }, position: { x: 100, y: 100 }, type: 'custom' },
    { id: 'n3', data: { label: 'MCP', type: 'concept' }, position: { x: 400, y: 100 }, type: 'custom' },
    { id: 'n4', data: { label: 'Agent Workflows', type: 'topic' }, position: { x: 300, y: 250 }, type: 'custom' },
    { id: 'n5', data: { label: 'Claude Code', type: 'tool' }, position: { x: 150, y: 250 }, type: 'custom' },
    { id: 'n6', data: { label: 'Vibecoding', type: 'topic' }, position: { x: 450, y: 200 }, type: 'custom' },
  ],
  edges: [
    { id: 'e1-2', source: 'n2', target: 'n1', animated: true },
    { id: 'e1-3', source: 'n1', target: 'n3', animated: true },
    { id: 'e1-4', source: 'n1', target: 'n4' },
    { id: 'e1-5', source: 'n1', target: 'n5' },
    { id: 'e4-6', source: 'n4', target: 'n6', animated: true },
  ]
};

export const mockMemory = {
  followedTopics: ['Claude', 'Agent Workflows', 'Vibecoding'],
  preferredSources: ['YouTube', 'Substack'],
  frequentTags: ['tutorial', 'implementation', 'architecture'],
  suggestions: [
    { topic: 'Prompt Chaining', reason: 'You saved 3 articles about Agent Workflows' },
    { topic: 'Cursor', reason: 'Highly correlated with Vibecoding' }
  ]
};
