import type { MCPIntegrationProvider } from './types.js'
import type { MCPToolDefinition } from '../types.js'

const TOOLS: Omit<MCPToolDefinition, 'integrationId'>[] = [
  // ── Topics ─────────────────────────────────────────────────────────────
  {
    id: 'flowmap_get_topics',
    toolName: 'get_topics',
    displayName: 'Get Followed Topics',
    description: 'List all topics you follow with their summaries and signal counts.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      limit: { type: 'number', description: 'Max topics to return (default 20)' },
    },
    tags: ['flowmap', 'topics', 'read'],
  },
  {
    id: 'flowmap_create_topic',
    toolName: 'create_topic',
    displayName: 'Create Topic',
    description: 'Create a new custom topic and optionally follow it immediately.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      name:        { type: 'string', description: 'Topic name' },
      summary:     { type: 'string', description: 'Short description of what this topic covers (optional)' },
      followAfter: { type: 'boolean', description: 'Automatically follow the topic after creation (default true)' },
    },
    tags: ['flowmap', 'topics', 'write'],
  },
  {
    id: 'flowmap_follow_topic',
    toolName: 'follow_topic',
    displayName: 'Follow Topic',
    description: 'Follow a topic by name so it appears in your research graph.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      name: { type: 'string', description: 'Topic name to follow' },
    },
    tags: ['flowmap', 'topics', 'write'],
  },
  {
    id: 'flowmap_trigger_research',
    toolName: 'trigger_research',
    displayName: 'Trigger Topic Research',
    description: 'Queue a fresh research sweep for a topic to pull in new signals.',
    riskLevel: 'write',
    permissionMode: 'approval_required',
    inputSchema: {
      topicId:  { type: 'string', description: 'Topic ID to research' },
      topicName: { type: 'string', description: 'Topic name (used if topicId is omitted)' },
    },
    tags: ['flowmap', 'topics', 'research', 'write'],
  },
  // ── Knowledge search ───────────────────────────────────────────────────
  {
    id: 'flowmap_search_content',
    toolName: 'search_content',
    displayName: 'Search Knowledge Base',
    description: 'Full-text search across saved articles, documents, and notes.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      query:  { type: 'string', description: 'Search query' },
      limit:  { type: 'number', description: 'Max results (default 10)' },
      filter: { type: 'string', description: 'Optional filter: "articles" | "documents" | "notes"' },
    },
    tags: ['flowmap', 'search', 'read'],
  },
  {
    id: 'flowmap_get_saved_items',
    toolName: 'get_saved_items',
    displayName: 'Get Saved Items',
    description: 'Retrieve articles and resources saved to your FlowMap library.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      topicId: { type: 'string', description: 'Filter by topic ID (optional)' },
      limit:   { type: 'number', description: 'Max items to return (default 20)' },
    },
    tags: ['flowmap', 'saves', 'read'],
  },
  {
    id: 'flowmap_save_article',
    toolName: 'save_article',
    displayName: 'Save Article',
    description: 'Save a URL to your FlowMap library and optionally attach it to a topic.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      url:     { type: 'string', description: 'Article URL to save' },
      title:   { type: 'string', description: 'Title override (optional — inferred from URL if omitted)' },
      topicId: { type: 'string', description: 'Topic ID to attach the article to (optional)' },
    },
    tags: ['flowmap', 'saves', 'write'],
  },
  // ── Memory ─────────────────────────────────────────────────────────────
  {
    id: 'flowmap_get_memory',
    toolName: 'get_memory',
    displayName: 'Get Memory Entries',
    description: 'Read memory entries from your knowledge base, optionally filtered by category.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      category: {
        type: 'string',
        description: 'Optional category filter: "topic_rule" | "source_pref" | "research_focus" | "personal_stack" | "personal_rule" | "preference" | "behavior" | "personal_fact"',
      },
      limit: { type: 'number', description: 'Max entries to return (default 20)' },
    },
    tags: ['flowmap', 'memory', 'read'],
  },
  {
    id: 'flowmap_add_memory',
    toolName: 'add_memory',
    displayName: 'Add Memory Entry',
    description: 'Create a new memory entry to shape future AI context and research behaviour.',
    riskLevel: 'write',
    permissionMode: 'approval_required',
    inputSchema: {
      content: { type: 'string', description: 'The memory to store (plain text)' },
      category: {
        type: 'string',
        description: 'Category: "topic_rule" | "source_pref" | "research_focus" | "personal_stack" | "personal_rule" | "preference" | "behavior" | "personal_fact"',
      },
    },
    tags: ['flowmap', 'memory', 'write'],
  },
  // ── Documents ──────────────────────────────────────────────────────────
  {
    id: 'flowmap_add_document',
    toolName: 'add_document',
    displayName: 'Add to My Documents',
    description: 'Save content as a Markdown (.md) document to your FlowMap document library.',
    riskLevel: 'write',
    permissionMode: 'auto',
    inputSchema: {
      title:    { type: 'string', description: 'Document title (used as filename and heading)' },
      content:  { type: 'string', description: 'Markdown content to save' },
      folderId: { type: 'string', description: 'Target folder ID in the document library (optional)' },
      topicId:  { type: 'string', description: 'Associate the document with a topic (optional)' },
    },
    tags: ['flowmap', 'documents', 'write'],
  },
  // ── Export ─────────────────────────────────────────────────────────────
  {
    id: 'flowmap_export_summary',
    toolName: 'export_summary',
    displayName: 'Export Topic Summary',
    description: 'Generate a markdown summary for a topic including top signals and saved articles.',
    riskLevel: 'read',
    permissionMode: 'read_only',
    inputSchema: {
      topicId:  { type: 'string', description: 'Topic ID to summarise' },
      maxItems: { type: 'number', description: 'Max signals/articles to include (default 10)' },
    },
    tags: ['flowmap', 'topics', 'export', 'read'],
  },
]

export const flowmapProvider: MCPIntegrationProvider = {
  async listTools(integration) {
    return TOOLS.map((t) => ({ ...t, integrationId: integration.id }))
  },

  async executeTool({ tool }) {
    // FlowMap is always "connected" (it's the app itself).
    // Real execution routes through the app's own store — wired in Phase 2.
    return {
      success: false,
      error: `FlowMap tool "${tool.displayName}" execution will be wired in Phase 2 (direct store bridge).`,
    }
  },

  async testConnection() {
    // The FlowMap integration is always available — it's the app itself.
    return { success: true }
  },
}
