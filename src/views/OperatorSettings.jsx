import { Settings as SettingsIcon } from 'lucide-react'
import WorkspaceRootsPanel from '../components/operator/WorkspaceRootsPanel.jsx'

export default function OperatorSettings() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-1">
        <SettingsIcon size={18} className="text-[color:var(--color-text-tertiary)]" />
        <h1 className="text-xl font-semibold tracking-tight">Operator Settings</h1>
      </div>
      <p className="text-[13px] text-white/45 mb-6">
        Configure workspace roots, approval policy, and other daemon controls.
      </p>

      <div className="flex flex-col gap-4">
        <WorkspaceRootsPanel />
      </div>
    </div>
  )
}
