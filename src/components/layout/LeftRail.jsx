import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BookOpen, LayoutDashboard, Brain, FileText, Bot, Compass,
  Plug, Activity, Radar, GraduationCap, Code2,
  TrendingUp, Globe, ChevronLeft, ChevronRight,
} from 'lucide-react'

const NAV_GROUPS = [
  [
    { to: '/',         label: 'Dashboard',        icon: LayoutDashboard },
    { to: '/memory',   label: 'Knowledge Base',   icon: Brain           },
  ],
  [
    { to: '/discover', label: 'Discover',          icon: Compass         },
    { to: '/signals',  label: 'Latest Signals',    icon: Activity        },
    { to: '/radar',    label: 'Opportunity Radar', icon: Radar           },
  ],
  [
    { to: '/topics',    label: 'My Topics',    icon: BookOpen  },
    { to: '/documents', label: 'My Documents', icon: FileText  },
  ],
  [
    { to: '/education',    label: 'Flow Academy', icon: GraduationCap },
    { to: '/code-academy', label: 'Code Academy', icon: Code2          },
    { to: '/chat',         label: 'Ask Flow.AI',  icon: Bot            },
  ],
  [
    { to: '/flow-trade', label: 'Flow Trade', icon: TrendingUp },
    { to: '/globe',      label: 'Globe',      icon: Globe      },
  ],
]

function NavItem({ to, label, icon: Icon, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'flex items-center rounded-lg text-sm transition-colors',
          collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2',
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
      <Icon size={17} className="flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  )
}

export default function LeftRail() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('fm_nav_collapsed') === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('fm_nav_collapsed', collapsed ? '1' : '0') } catch {}
  }, [collapsed])

  const toggleBtn = (
    <button
      onClick={() => setCollapsed((v) => !v)}
      className="flex-shrink-0 p-1 rounded-md text-[color:var(--color-text-tertiary)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-bg-glass)] transition-colors"
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
    </button>
  )

  return (
    <aside
      className={`glass-panel m-3 mr-0 flex-shrink-0 flex flex-col gap-1 overflow-hidden transition-[width] duration-200 ease-out ${
        collapsed ? 'w-[56px] px-2 py-4' : 'w-[240px] p-4'
      }`}
    >
      {/* Header */}
      <div className={`flex items-start pb-4 ${collapsed ? 'justify-center' : 'px-2 pt-1'}`}>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold tracking-tight text-[color:var(--color-text-primary)]">
              FlowMap
            </div>
            <div className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">
              topic intelligence
            </div>
          </div>
        )}
        {toggleBtn}
      </div>

      {/* Navigation groups */}
      <nav className="flex flex-col flex-1 min-h-0">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {gi > 0 && (
              <div className={`my-2 border-t border-[color:var(--color-border-subtle)] ${collapsed ? 'mx-0' : ''}`} />
            )}
            <div className="flex flex-col gap-1">
              {group.map(({ to, label, icon }) => (
                <NavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom links */}
      <div className="mt-auto flex flex-col gap-1">
        <div className="my-2 border-t border-[color:var(--color-border-subtle)]" />
        <NavItem to="/connections" label="Connections" icon={Plug} collapsed={collapsed} />
      </div>
    </aside>
  )
}
