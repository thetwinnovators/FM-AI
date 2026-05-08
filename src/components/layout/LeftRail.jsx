import { NavLink } from 'react-router-dom'
import { BookOpen, LayoutDashboard, Brain, FileText, Bot, Compass, Plug, Activity, Radar, GraduationCap, Code2 } from 'lucide-react'

// Nav is grouped into sections separated by hairline dividers in the rail.
// Order: workspace shortcuts → broad exploration → personal collections → AI assistant.
const NAV_GROUPS = [
  [
    { to: '/',         label: 'Dashboard',      icon: LayoutDashboard },
    { to: '/memory',   label: 'Knowledge Base', icon: Brain           },
  ],
  [
    { to: '/discover', label: 'Discover',       icon: Compass         },
    { to: '/signals',  label: 'Latest Signals',    icon: Activity        },
    { to: '/radar',    label: 'Opportunity Radar', icon: Radar           },
  ],
  [
    { to: '/topics',    label: 'My Topics',     icon: BookOpen        },
    { to: '/documents', label: 'My Documents',  icon: FileText        },
  ],
  [
    { to: '/education',    label: 'Flow Academy',  icon: GraduationCap   },
    { to: '/code-academy', label: 'Code Academy',  icon: Code2           },
    { to: '/chat',         label: 'Ask Flow.AI',   icon: Bot             },
  ],
]

export default function LeftRail() {
  return (
    <aside className="glass-panel m-3 mr-0 w-[240px] flex-shrink-0 flex flex-col p-4 gap-1">
      <div className="px-2 pt-1 pb-4">
        <div className="text-[15px] font-semibold tracking-tight text-[color:var(--color-text-primary)]">
          FlowMap
        </div>
        <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">
          topic intelligence
        </div>
      </div>

      <nav className="flex flex-col">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {gi > 0 ? <div className="my-2 border-t border-[color:var(--color-border-subtle)]" /> : null}
            <div className="flex flex-col gap-1">
              {group.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'text-[color:var(--color-text-primary)]'
                        : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-glass)] hover:text-[color:var(--color-text-primary)]',
                    ].join(' ')
                  }
                  style={({ isActive }) => isActive ? {
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(217,70,239,0.22) 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                  } : undefined}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto">
        <NavLink
          to="/connections"
          className={({ isActive }) =>
            [
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              isActive
                ? 'text-[color:var(--color-text-primary)]'
                : 'text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-bg-glass)] hover:text-[color:var(--color-text-primary)]',
            ].join(' ')
          }
          style={({ isActive }) => isActive ? {
            background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(217,70,239,0.22) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
          } : undefined}
        >
          <Plug size={17} />
          <span>Connections</span>
        </NavLink>

      </div>
    </aside>
  )
}
