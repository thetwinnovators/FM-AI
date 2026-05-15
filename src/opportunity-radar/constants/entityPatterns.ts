/**
 * Entity pattern constants for Schema v1 extraction.
 *
 * Three groups:
 *   KNOWN_* lists  — curated terms matched by presence in text (fast, high precision)
 *   *_CONTEXT_RE   — regex patterns that look for an entity in a specific context phrase
 *   WORKAROUND_RE  — explicit workaround / gap-signal patterns
 *
 * Confidence tiers:
 *   0.90 — explicit context pattern matched  ("as a developer", "using Slack")
 *   0.75 — known-list term found in relevant context window
 *   0.60 — known-list term found anywhere in text
 */

// ─── Personas ─────────────────────────────────────────────────────────────────
// Each entry is the canonical lowercase form used as the entity value.

export const KNOWN_PERSONAS: readonly string[] = [
  // Engineering
  'developer', 'software developer', 'software engineer', 'engineer',
  'frontend developer', 'backend developer', 'fullstack developer',
  'web developer', 'mobile developer', 'ios developer', 'android developer',
  'devops engineer', 'data engineer', 'data scientist', 'ml engineer',
  'ai engineer', 'security engineer', 'platform engineer',
  // Design
  'designer', 'ux designer', 'ui designer', 'product designer',
  'graphic designer', 'visual designer',
  // Product / management
  'product manager', 'pm', 'project manager', 'program manager',
  'engineering manager', 'tech lead',
  // Leadership
  'founder', 'co-founder', 'ceo', 'cto', 'cpo', 'vp engineering',
  // Independent
  'freelancer', 'consultant', 'contractor', 'indie hacker',
  'solopreneur', 'bootstrapper',
  // Marketing / growth
  'marketer', 'marketing manager', 'growth marketer', 'content marketer',
  'seo specialist', 'social media manager',
  // Data / analysis
  'analyst', 'business analyst', 'data analyst', 'financial analyst',
  'researcher', 'ux researcher',
  // Content
  'writer', 'content writer', 'copywriter', 'technical writer', 'blogger',
  // Business
  'small business owner', 'entrepreneur', 'operator',
  // Sales / CS
  'sales rep', 'account executive', 'account manager',
  'customer success', 'support engineer', 'support agent',
  // Finance / legal
  'accountant', 'bookkeeper', 'cfo', 'financial advisor',
  'lawyer', 'attorney', 'paralegal',
  // Education / health
  'student', 'teacher', 'professor', 'educator',
  'nurse', 'doctor', 'healthcare worker', 'clinician',
]

/** Context phrases that precede a persona. Capture group 1 = the persona token. */
export const PERSONA_CONTEXT_RE = [
  /(?:i(?:'m| am) a|as a|for (?:a |any )?|if you(?:'re| are) a|we(?:'re| are) a?|our|most)\s+([a-z][a-z\s]{2,35}?)(?=\s*(?:,|\.|;|who|when|and|or|\n|$))/gi,
  /([a-z][a-z\s]{2,35}?)\s+(?:struggles?|complains?|hates?|finds? it hard|says?|reports?|can't|cannot)/gi,
]

// ─── Technologies ─────────────────────────────────────────────────────────────

export const KNOWN_TECHNOLOGIES: readonly string[] = [
  // Project / productivity
  'jira', 'linear', 'notion', 'confluence', 'trello', 'asana', 'monday',
  'clickup', 'basecamp', 'airtable', 'coda', 'roam', 'obsidian', 'todoist',
  // Communication
  'slack', 'teams', 'discord', 'zoom', 'loom', 'google meet', 'webex',
  'telegram', 'whatsapp',
  // Dev tools
  'github', 'gitlab', 'bitbucket', 'jenkins', 'github actions', 'circleci',
  'vercel', 'netlify', 'docker', 'kubernetes', 'terraform', 'ansible',
  'vs code', 'vscode', 'intellij', 'vim', 'neovim',
  // Cloud
  'aws', 'gcp', 'azure', 'cloudflare', 'heroku', 'railway', 'render',
  'supabase', 'firebase', 'planetscale',
  // Data
  'snowflake', 'databricks', 'dbt', 'airflow', 'spark', 'kafka',
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
  // CRM / sales
  'salesforce', 'hubspot', 'pipedrive', 'intercom', 'zendesk', 'freshdesk',
  'close', 'outreach', 'apollo',
  // Design
  'figma', 'sketch', 'adobe xd', 'canva', 'framer', 'webflow',
  // Analytics
  'mixpanel', 'amplitude', 'segment', 'google analytics', 'posthog',
  'hotjar', 'fullstory',
  // Automation
  'zapier', 'make', 'n8n', 'power automate',
  // AI / LLM
  'openai', 'chatgpt', 'claude', 'gemini', 'copilot', 'midjourney',
  'stable diffusion', 'ollama',
  // E-commerce / payments
  'shopify', 'woocommerce', 'stripe', 'square', 'paypal',
  // Languages / frameworks
  'react', 'vue', 'angular', 'next.js', 'nuxt', 'svelte', 'remix',
  'node.js', 'express', 'fastapi', 'django', 'rails',
  'python', 'typescript', 'javascript', 'rust', 'go', 'java', 'kotlin',
  'swift',
  // Finance / accounting
  'quickbooks', 'xero', 'freshbooks', 'wave',
  // Spreadsheets
  'excel', 'google sheets',
  // Email / marketing
  'gmail', 'outlook', 'mailchimp', 'sendgrid', 'convertkit', 'beehiiv',
  // HR
  'workday', 'bamboohr', 'greenhouse', 'lever',
]

/** Context phrases that precede or follow a technology mention. */
export const TECH_CONTEXT_RE = [
  /(?:using|use|tried?|migrated? (?:from|to)|switched? (?:from|to)|moved? (?:from|to)|integrat(?:e|ing|ed) with?|connect(?:ing)? to?|replac(?:e|ing|ed))\s+([a-zA-Z][a-zA-Z0-9.+\s]{1,30}?)(?=\s|,|;|\.|$)/g,
  /([a-zA-Z][a-zA-Z0-9.+\s]{1,30}?)\s+(?:doesn't|does not|can't|won't|fails? to|lacks?|missing)/g,
]

// ─── Industries ───────────────────────────────────────────────────────────────

export const KNOWN_INDUSTRIES: readonly string[] = [
  'healthcare', 'medical', 'health tech', 'medtech', 'biotech',
  'finance', 'fintech', 'banking', 'insurance', 'wealth management',
  'education', 'edtech', 'e-learning', 'higher education',
  'e-commerce', 'ecommerce', 'retail', 'd2c', 'direct to consumer',
  'real estate', 'proptech',
  'legal', 'legaltech', 'law',
  'marketing', 'adtech', 'martech', 'advertising',
  'logistics', 'supply chain', 'fulfillment',
  'manufacturing', 'industrial',
  'media', 'entertainment', 'streaming', 'publishing',
  'saas', 'b2b saas', 'enterprise software',
  'crypto', 'web3', 'blockchain', 'defi',
  'gaming', 'game development',
  'hospitality', 'restaurant', 'food tech', 'foodtech',
  'travel', 'traveltech',
  'hr', 'hrtech', 'recruiting', 'talent acquisition',
  'cybersecurity', 'infosec',
  'devtools', 'developer tools',
  'construction', 'proptech',
  'non-profit', 'ngo',
]

/** Context phrases for industry detection. */
export const INDUSTRY_CONTEXT_RE = [
  /(?:in (?:the )?|for (?:the )?|within (?:the )?)([a-z][a-z\s]{3,30}?)(?:\s+(?:industry|sector|space|market|field|vertical))/gi,
  /(?:industry|sector|space|market):\s+([a-z][a-z\s]{3,30})/gi,
]

// ─── Workarounds ─────────────────────────────────────────────────────────────
// These are the highest-value signals for unmet needs. Explicit workaround
// language is a near-certain indicator that no adequate solution exists.

export const WORKAROUND_RE: RegExp[] = [
  // "I built / made / wrote / hacked together..."
  /i\s+(?:built?|made|wrote|created?|hacked? together|cobbled? together|put together)\s+(?:a\s+)?(.{5,80}?)(?=\s*(?:[.!?]|$|\n))/gi,
  // "I use a spreadsheet / script / workaround..."
  /(?:i\s+)?(?:use|uses?|using)\s+(?:a\s+)?(?:spreadsheet|script|macro|hack|workaround|custom tool|google sheet|excel file|cron job|bash script|python script)\s+(?:to|for|because|instead)?\s*(.{0,60})/gi,
  // "manually [verb]ing..." / "by hand..."
  /\bmanually\s+([a-z][a-z\s]{3,50})/gi,
  /\bby hand\b/gi,
  // "copy-paste / copy and paste..."
  /copy.?(?:and.?)?paste\s*(?:between|from|into|across)?\s*(.{0,50})/gi,
  // "we resort to / end up / have to..."
  /(?:we|i)\s+(?:resort to|end up|have to|had to|need to)\s+([a-z][a-z\s]{3,60})/gi,
  // Explicit workaround vocabulary
  /\b(?:workaround|kludge|hack|duct-tape solution|band-aid|jerry-rig)\b/gi,
]

// ─── Existing solutions ───────────────────────────────────────────────────────
// Detect named products / services that people currently use for the job-to-be-done.

export const EXISTING_SOLUTION_RE: RegExp[] = [
  // "switched from X" / "migrated from X" / "moved away from X"
  /(?:switched?|migrated?|moved?) from\s+([A-Z][a-zA-Z0-9.\s]{1,30}?)(?=\s|,|;|\.|$)/g,
  // "tried X but" / "used X for years but"
  /(?:tried|used|using)\s+([A-Z][a-zA-Z0-9.\s]{1,30}?)\s+(?:but|however|until|before|and)/g,
  // "[X] doesn't have / lacks / is missing..."
  /([A-Z][a-zA-Z0-9.\s]{1,30}?)\s+(?:doesn't|does not|can't|won't|lacks?|is missing|has no)\s+/g,
  // "the [X] way" / "if [X] supported"
  /(?:if\s+)?([A-Z][a-zA-Z0-9.\s]{1,20}?)\s+(?:supported?|allowed?|had|would)\s+/g,
]

// ─── Workflow patterns ────────────────────────────────────────────────────────
// Gerund phrases and process nouns that describe the activity being performed.

export const WORKFLOW_RE: RegExp[] = [
  // "[verb]ing [noun]" — task descriptions
  /\b((?:manag|track|monitor|report|analyz|process|review|approv|deploy|onboard|schedul|automat|integrat|export|import|sync|migrat|document|generat|creat|updat|build|test|debug|deploy|ship|publish|design|plan|forecast|reconcil|invoic|bill|collect|hire|recruit|handl|escalat|prioritiz|collaborat|coordinat)\w+(?:\s+\w+){0,3})\b/gi,
  // "the process of [noun phrase]"
  /(?:the process of|workflow for|process for|steps? (?:to|for))\s+([a-z][a-z\s]{3,40})/gi,
]

// ─── Venture Scope v2: new entity pattern lists ───────────────────────────────

export const KNOWN_BUYER_ROLES: readonly string[] = [
  'cto', 'ceo', 'vp engineering', 'vp product', 'head of engineering',
  'head of product', 'engineering manager', 'product manager', 'procurement',
  'it manager', 'decision maker', 'budget owner', 'director of engineering',
  'vp of engineering', 'chief technology officer', 'chief executive officer',
]

export const KNOWN_COMPANY_TYPES: readonly string[] = [
  'smb', 'startup', 'enterprise', 'agency', 'freelancer', 'consultant',
  'mid-market', 'scale-up', 'solopreneur', 'saas company', 'service business',
  'small business', 'large enterprise', 'fortune 500', 'bootstrapped company',
]

export const KNOWN_EMERGING_TECHNOLOGIES: readonly string[] = [
  'llm', 'large language model', 'gpt', 'claude', 'gemini', 'vector database',
  'embeddings', 'rag', 'retrieval augmented generation', 'generative ai',
  'agentic ai', 'ai agent', 'computer vision', 'edge ai', 'webassembly',
  'wasm', 'edge computing', 'serverless', 'diffusion model',
]

export const KNOWN_PLATFORM_SHIFTS: readonly string[] = [
  'remote work', 'hybrid work', 'work from home', 'ai adoption',
  'cloud migration', 'digital transformation', 'no-code movement',
  'api economy', 'mobile first', 'shift to subscription',
  'consumerization of it', 'zero trust', 'decentralization',
]

// Bottleneck: phrases indicating a blocking step
export const BOTTLENECK_RE = new RegExp(
  '(?:' + [
    'bottleneck(?:s)?',
    'approval process',
    'manual review',
    'waiting for (?:approval|sign-?off|review)',
    'blocks? (?:us|the|our|every)',
    'slows? (?:down|everything|us|the)',
    'held up by',
    'stuck (?:in|on|at|waiting)',
    'single point of failure',
    'handoff delay',
  ].join('|') + ')',
  'gi',
)

// Trigger event: phrases indicating when a need arises
export const TRIGGER_EVENT_RE = new RegExp(
  '(?:' + [
    'every time (?:a |an |we |they |the )',
    'triggered by',
    'kicked off by',
    'onboarding',
    'new hire',
    'product launch',
    'quarterly review',
    'incident occurs',
    'deployment',
    'when a new',
    'when we',
  ].join('|') + ')',
  'gi',
)

export const BUYER_ROLE_CONTEXT_RE: RegExp[] = [
  /(?:the\s+|our\s+|their\s+)?(cto|ceo|vp\s+\w+|head of \w+|product manager|engineering manager|director of \w+)\b/gi,
  /\b(?:as a|as an)\s+(cto|ceo|vp\s+\w+|head of \w+|product manager|engineering manager)\b/gi,
]

export const COMPANY_TYPE_CONTEXT_RE: RegExp[] = [
  /\b(?:for|targeting|serving|at|in)\s+(smbs?|startups?|enterprises?|agencies|freelancers?|consultants?|mid-market)\b/gi,
  /\b(smb|startup|enterprise|agency|freelancer|saas company|small business)\b/gi,
]

export const EMERGING_TECH_CONTEXT_RE: RegExp[] = [
  /\b(?:using|with|via|powered by|built on|leveraging)\s+([A-Za-z0-9\s\-]{3,40})\b/gi,
  /\b(llm|gpt|claude|gemini|vector database|embeddings|rag|generative ai|ai agent|wasm|serverless)\b/gi,
]

export const PLATFORM_SHIFT_CONTEXT_RE: RegExp[] = [
  /\bshift (?:to|toward|towards|in)\s+([a-z\s]{4,35})\b/gi,
  /\b(remote work|hybrid work|cloud migration|ai adoption|digital transformation|no-code movement)\b/gi,
]
