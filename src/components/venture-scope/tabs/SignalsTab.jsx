import {
  Users, Briefcase, AlertTriangle, Gauge, GitBranch, Zap,
  Cpu, Sparkles, TrendingUp, Package, Wrench, Building2, Building,
} from 'lucide-react'

const ENTITY_GROUP_CONFIG = [
  { type: 'persona',             label: 'Personas',              Icon: Users          },
  { type: 'buyer_role',          label: 'Buyer Roles',           Icon: Briefcase      },
  { type: 'pain_point',          label: 'Pain Points',           Icon: AlertTriangle  },
  { type: 'bottleneck',          label: 'Bottlenecks',           Icon: Gauge          },
  { type: 'workflow',            label: 'Workflows',             Icon: GitBranch      },
  { type: 'trigger_event',       label: 'Trigger Events',        Icon: Zap            },
  { type: 'technology',          label: 'Technologies',          Icon: Cpu            },
  { type: 'emerging_technology', label: 'Emerging Technologies', Icon: Sparkles       },
  { type: 'platform_shift',      label: 'Platform Shifts',       Icon: TrendingUp     },
  { type: 'existing_solution',   label: 'Existing Solutions',    Icon: Package        },
  { type: 'workaround',          label: 'Workarounds',           Icon: Wrench         },
  { type: 'industry',            label: 'Industries',            Icon: Building2      },
  { type: 'company_type',        label: 'Company Types',         Icon: Building       },
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

  const visibleGroups = ENTITY_GROUP_CONFIG.filter(({ type }) => grouped[type]?.length)

  return (
    <div className="max-w-4xl">
      <div className="glass-panel divide-y divide-white/[0.06]">
        {visibleGroups.map(({ type, label, Icon }) => {
          const items = grouped[type]
          return (
            <div key={type} className="p-4">
              {/* Section header */}
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-3.5 h-3.5 text-[color:var(--color-text-secondary)]" />
                <span className="text-xs font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wide">
                  {label}
                </span>
                <span className="text-xs text-[color:var(--color-text-tertiary)]">
                  {Math.min(items.length, 20)}
                </span>
              </div>
              {/* Static chips — each entity is a node in the main knowledge graph */}
              <div className="flex flex-wrap gap-1.5">
                {items.slice(0, 20).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full bg-white/5 border border-white/8"
                    title={`Mentioned ${e.frequency}× · First seen ${e.firstSeen?.slice(0, 10) ?? '—'}`}
                  >
                    <span className="text-[color:var(--color-text-primary)]">{e.value}</span>
                    <span className="text-xs text-[color:var(--color-text-tertiary)] tabular-nums">
                      {e.frequency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
