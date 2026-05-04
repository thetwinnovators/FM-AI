// Tier describes where each node type sits in the data-flow hierarchy:
//   structure  → the organising layer (what is tracked)
//   entity     → real-world actors that produce or are associated with content
//   content    → consumed artefacts that flow into the graph
//   intelligence → derived knowledge that FlowMap generates over time
export const NODE_TYPES = [
  { id: 'topic',         label: 'Topic',        color: '#d946ef', tier: 'structure'     },
  { id: 'concept',       label: 'Concept',      color: '#94a3b8', tier: 'structure'     },
  { id: 'tag',           label: 'Tag',          color: '#64748b', tier: 'structure'     },
  { id: 'creator',       label: 'Creator',      color: '#14b8a6', tier: 'entity'        },
  { id: 'company',       label: 'Company',      color: '#3b82f6', tier: 'entity'        },
  { id: 'video',         label: 'Video',        color: '#ec4899', tier: 'content'       },
  { id: 'article',       label: 'Article',      color: '#6366f1', tier: 'content'       },
  { id: 'social_post',   label: 'Social Post',  color: '#8b5cf6', tier: 'content'       },
  { id: 'document',      label: 'Document',     color: '#22d3ee', tier: 'content'       },
  { id: 'tool',          label: 'Tool',         color: '#06b6d4', tier: 'content'       },
  { id: 'memory',        label: 'Memory',       color: '#a855f7', tier: 'intelligence'  },
  { id: 'signal',        label: 'Signal',       color: '#f43f5e', tier: 'intelligence'  },
  { id: 'learning_path', label: 'Learning',     color: '#10b981', tier: 'intelligence'  },
]

export const TIERS = [
  { id: 'structure',    label: 'Structure',    description: 'What is tracked'          },
  { id: 'entity',       label: 'Entities',     description: 'Who produces content'     },
  { id: 'content',      label: 'Content',      description: 'What flows into the graph' },
  { id: 'intelligence', label: 'Intelligence', description: 'What FlowMap derives'     },
]

const BY_ID = Object.fromEntries(NODE_TYPES.map((t) => [t.id, t]))
const FALLBACK = { id: 'unknown', label: 'Unknown', color: '#94a3b8' }

export function getTypeMeta(id) {
  return BY_ID[id] || FALLBACK
}

function hexToRgb(hex) {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return [148, 163, 184]
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)]
}

export const RGB = Object.fromEntries(NODE_TYPES.map((t) => [t.id, hexToRgb(t.color)]))
