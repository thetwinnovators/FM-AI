import { LayoutGrid, List, Activity } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const SUB_NAV = [
  { to: '/connections', label: 'Integrations', Icon: LayoutGrid, end: true },
  { to: '/connections/tools', label: 'Tools', Icon: List },
  { to: '/connections/log', label: 'Log', Icon: Activity },
]

export function ConnectionsSubNav() {
  return (
    <div className="flex items-center gap-1 mb-6 border-b border-white/[0.07]">
      {SUB_NAV.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-[color:var(--color-topic)] text-white'
                : 'border-transparent text-white/50 hover:text-white'
            }`
          }
        >
          <Icon size={14} />
          {label}
        </NavLink>
      ))}
    </div>
  )
}
