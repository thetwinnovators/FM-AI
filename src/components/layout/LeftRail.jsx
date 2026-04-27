import { NavLink } from 'react-router-dom'
import { Home, Compass, BookOpen, Network, GraduationCap, Brain } from 'lucide-react'

const NAV = [
  { to: '/',          label: 'Home',       icon: Home          },
  { to: '/discover',  label: 'Discover',   icon: Compass       },
  { to: '/topics',    label: 'Topics',     icon: BookOpen      },
  { to: '/flow',      label: 'Flow Map',   icon: Network       },
  { to: '/education', label: 'Education',  icon: GraduationCap },
  { to: '/memory',    label: 'Memory',     icon: Brain         },
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

      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
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
      </nav>

      <div className="mt-auto px-2 pt-4 border-t border-[color:var(--color-border-subtle)]">
        <div className="flex items-center gap-3 py-2">
          <div className="w-8 h-8 rounded-full bg-[color:var(--color-topic)]/20 border border-[color:var(--color-topic)]/40 flex items-center justify-center text-xs font-semibold">
            JU
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">JenoU</div>
            <div className="text-[11px] text-[color:var(--color-text-tertiary)]">researcher</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
