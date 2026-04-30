export const NODE_TYPES = [
  { id: 'topic',         label: 'Topic',        color: '#d946ef' },
  { id: 'concept',       label: 'Concept',      color: '#94a3b8' },
  { id: 'tool',          label: 'Tool',         color: '#06b6d4' },
  { id: 'company',       label: 'Company',      color: '#3b82f6' },
  { id: 'creator',       label: 'Creator',      color: '#14b8a6' },
  { id: 'video',         label: 'Video',        color: '#ec4899' },
  { id: 'article',       label: 'Article',      color: '#6366f1' },
  { id: 'social_post',   label: 'Social Post',  color: '#8b5cf6' },
  { id: 'tag',           label: 'Tag',          color: '#64748b' },
  { id: 'learning_path', label: 'Learning',     color: '#10b981' },
  { id: 'memory',        label: 'Memory',       color: '#a855f7' },
  { id: 'signal',        label: 'Signal',       color: '#f43f5e' },
  { id: 'document',      label: 'Document',     color: '#22d3ee' },
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
