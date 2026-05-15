import EvidenceChip from '../EvidenceChip.jsx'

const ENTITY_GROUP_CONFIG = [
  { type: 'persona',             label: 'Personas',              color: 'text-sky-300/80'     },
  { type: 'buyer_role',          label: 'Buyer Roles',           color: 'text-violet-300/80'  },
  { type: 'pain_point',          label: 'Pain Points',           color: 'text-rose-300/80'    },
  { type: 'bottleneck',          label: 'Bottlenecks',           color: 'text-amber-300/80'   },
  { type: 'workflow',            label: 'Workflows',             color: 'text-emerald-300/80' },
  { type: 'trigger_event',       label: 'Trigger Events',        color: 'text-[color:var(--color-topic)]' },
  { type: 'technology',          label: 'Technologies',          color: 'text-sky-300/80'     },
  { type: 'emerging_technology', label: 'Emerging Technologies', color: 'text-[color:var(--color-topic)]' },
  { type: 'platform_shift',      label: 'Platform Shifts',       color: 'text-amber-300/80'   },
  { type: 'existing_solution',   label: 'Existing Solutions',    color: 'text-white/50'       },
  { type: 'workaround',          label: 'Workarounds',           color: 'text-rose-300/70'    },
  { type: 'industry',            label: 'Industries',            color: 'text-emerald-300/80' },
  { type: 'company_type',        label: 'Company Types',         color: 'text-sky-300/70'     },
]

export default function SignalsTab({ entityGraph }) {
  const entities = entityGraph?.entities ?? {}
  const allEntities = Object.values(entities)

  // Group by type, sort each group by frequency
  const grouped = {}
  for (const e of allEntities) {
    if (!grouped[e.type]) grouped[e.type] = []
    grouped[e.type].push(e)
  }
  for (const type of Object.keys(grouped)) {
    grouped[type].sort((a, b) => b.frequency - a.frequency)
  }

  if (!allEntities.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-[color:var(--color-text-secondary)]">No signals extracted yet.</p>
        <p className="text-xs text-[color:var(--color-text-tertiary)] mt-1">
          Run a scan to populate the signal graph.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-4xl">
      {ENTITY_GROUP_CONFIG.map(({ type, label, color }) => {
        const items = grouped[type]
        if (!items?.length) return null
        return (
          <div key={type} className="glass-panel p-4">
            <h3 className={`text-[11px] uppercase tracking-widest mb-3 ${color}`}>{label}</h3>
            <div className="flex flex-wrap gap-2">
              {items.slice(0, 20).map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full bg-white/5 border border-white/8 hover:bg-white/8 transition-colors cursor-default"
                  title={`Mentioned ${e.frequency}× | First: ${e.firstSeen?.slice(0, 10)}`}
                >
                  <span>{e.value}</span>
                  <span className="text-[10px] text-[color:var(--color-text-tertiary)]">{e.frequency}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
