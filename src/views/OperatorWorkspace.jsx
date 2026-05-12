import { Link } from 'react-router-dom'
import { Code2, Terminal, Cpu } from 'lucide-react'

const MODULES = [
  {
    to: '/operator/coding',
    icon: Code2,
    title: 'AI Coding',
    description: 'Git-aware coding assistant. Inspect repos, read diffs, and run code in a sandbox via the operator daemon.',
    accent: 'rgba(99,102,241,0.20)',
  },
  {
    to: '/operator/terminal',
    icon: Terminal,
    title: 'Terminal Control',
    description: 'Execute allowlisted shell commands and inspect the filesystem with auditable history.',
    accent: 'rgba(16,185,129,0.18)',
  },
]

export default function OperatorWorkspace() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <Cpu size={20} className="text-[color:var(--color-creator)]" />
        <h1 className="text-2xl font-semibold tracking-tight">Operator</h1>
      </div>
      <p className="text-[13px] text-white/45 mb-8">
        Local AI-powered tools. Requires the FlowMap daemon running (<code className="font-mono text-white/60">npm run daemon</code>).
      </p>

      <div className="flex flex-col gap-4">
        {MODULES.map(({ to, icon: Icon, title, description, accent }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-4 p-5 rounded-xl border border-white/8 hover:border-white/15 transition-colors"
            style={{ background: accent }}
          >
            <div className="mt-0.5 p-2 rounded-lg bg-white/8">
              <Icon size={18} className="text-white/85" />
            </div>
            <div>
              <div className="text-[15px] font-medium text-white/90 mb-1">{title}</div>
              <div className="text-[13px] text-white/55">{description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
