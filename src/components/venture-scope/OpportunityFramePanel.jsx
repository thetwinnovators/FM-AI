import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { SOURCE_TYPE_LABELS } from '../../venture-scope/utils/sourceResolver.js'

const REL_LABELS = {
  experiences:   'experiences',
  performs:      'performs',
  has_friction:  'has friction with',
  uses:          'uses',
  signals_gap:   'signals gap in',
  enables:       'enables',
  operates_in:   'operates in',
  substitutes:   'substitutes for',
}

const ENTITY_GROUPS = [
  { key: 'personas',          label: 'Personas',       accent: 'rgba(20,184,166,0.4)' },
  { key: 'workflows',         label: 'Workflows',       accent: null },
  { key: 'workarounds',       label: 'Workarounds',     accent: 'rgba(217,70,239,0.4)' },
  { key: 'technologies',      label: 'Technologies',    accent: null },
  { key: 'bottlenecks',       label: 'Bottlenecks',     accent: null },
  { key: 'emergingTech',      label: 'Emerging Tech',   accent: 'rgba(251,191,36,0.4)' },
  { key: 'platformShifts',    label: 'Market Shifts',   accent: 'rgba(251,191,36,0.4)' },
  { key: 'existingSolutions', label: 'Known Solutions', accent: null },
  { key: 'buyerRoles',        label: 'Buyer Roles',     accent: null },
  { key: 'industries',        label: 'Industries',      accent: null },
]

export default function OpportunityFramePanel({ frame }) {
  const [expanded, setExpanded] = useState(false)

  if (!frame) return null

  const {
    personas, workflows, workarounds, technologies, bottlenecks,
    platformShifts, emergingTech, buyerRoles, existingSolutions,
    industries, relationships, signals,
  } = frame

  const allGroups = {
    personas, workflows, workarounds, technologies, bottlenecks,
    platformShifts, emergingTech, buyerRoles, existingSolutions, industries,
  }

  const nonEmptyTypes = ENTITY_GROUPS.filter(g => (allGroups[g.key]?.length ?? 0) > 0)
  const totalEntities = nonEmptyTypes.reduce((sum, g) => sum + allGroups[g.key].length, 0)
  const cleanRels     = (relationships ?? []).filter(r => !r.contradicted)

  const hasAnyData = nonEmptyTypes.length > 0

  if (!hasAnyData) {
    return (
      <div className="glass-panel p-5">
        <p className="text-[11px] text-[color:var(--color-text-tertiary)]">
          No entity data yet — run a scan first.
        </p>
      </div>
    )
  }

  // Build entity lookup for relationship resolution
  const entityMap = new Map()
  for (const g of ENTITY_GROUPS) {
    for (const e of (allGroups[g.key] ?? [])) entityMap.set(e.id, e)
  }

  // Non-contradicted relationships with both endpoints resolvable, sorted by strength desc
  const visibleRels = cleanRels
    .filter(r => entityMap.has(r.fromId) && entityMap.has(r.toId))
    .sort((a, b) => b.strength - a.strength)

  // Source breakdown
  const sourceBreakdown = {}
  for (const s of (signals ?? [])) {
    const key = s.corpusSourceType ?? s.source ?? 'unknown'
    sourceBreakdown[key] = (sourceBreakdown[key] ?? 0) + 1
  }

  return (
    <div className="glass-panel overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)]">
          Graph Context
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[color:var(--color-text-secondary)]">
            {nonEmptyTypes.length} entity types · {totalEntities} entities · {cleanRels.length} relationships
          </span>
          <ChevronDown
            className="w-3.5 h-3.5 text-[color:var(--color-text-tertiary)] transition-transform"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/6 space-y-5 pt-4">

          {/* Section 1: Key Entities */}
          <div className="space-y-3">
            {nonEmptyTypes.map(({ key, label, accent }) => {
              const entities = allGroups[key]
              const shown    = entities.slice(0, 5)
              const extra    = entities.length - shown.length
              return (
                <div key={key} className="flex items-start gap-3 flex-wrap">
                  <span className="text-[10px] text-[color:var(--color-text-tertiary)] shrink-0 pt-0.5 w-24">
                    {label}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {shown.map(entity => (
                      <span
                        key={entity.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-white/5 border border-white/8"
                        style={accent ? { borderColor: accent } : undefined}
                        title={entity.value}
                      >
                        <span className="truncate max-w-[140px] capitalize">{entity.value}</span>
                        {entity.frequency > 1 && (
                          <span className="text-[9px] opacity-40">×{entity.frequency}</span>
                        )}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className="text-[10px] text-[color:var(--color-text-tertiary)] self-center">
                        +{extra} more
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Section 2: Entity Relationships */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-2">
              Entity relationships
            </p>
            {visibleRels.length < 2 ? (
              <p className="text-[11px] text-[color:var(--color-text-tertiary)] italic">
                Limited relationship data — more signals will build this over time.
              </p>
            ) : (
              <div className="space-y-1.5">
                {visibleRels.slice(0, 5).map((rel, i) => {
                  const fromEntity = entityMap.get(rel.fromId)
                  const toEntity   = entityMap.get(rel.toId)
                  const relLabel   = REL_LABELS[rel.relationshipType] ?? rel.relationshipType
                  return (
                    <div key={rel.id ?? i} className="flex items-baseline gap-1.5 text-[11px] flex-wrap">
                      <span className="text-[color:var(--color-text-primary)] capitalize">{fromEntity.value}</span>
                      <span className="text-[color:var(--color-text-tertiary)]">{relLabel}</span>
                      <span className="text-[color:var(--color-text-secondary)] capitalize">{toEntity.value}</span>
                      {rel.strength >= 0.7 && (
                        <span className="text-[9px] text-[color:var(--color-text-tertiary)] opacity-50 ml-auto shrink-0">strong</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Section 3: Source breakdown */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] mb-2">
              Source breakdown
            </p>
            {Object.keys(sourceBreakdown).length === 0 ? (
              <p className="text-[11px] text-[color:var(--color-text-tertiary)]">No signals</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(sourceBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <span key={type} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 text-[10px]">
                      <span className="text-[color:var(--color-text-secondary)]">{SOURCE_TYPE_LABELS[type] ?? type}</span>
                      <span className="text-[color:var(--color-text-tertiary)]">{count}</span>
                    </span>
                  ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
