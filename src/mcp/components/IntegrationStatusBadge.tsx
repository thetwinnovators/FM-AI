import type { IntegrationStatus } from '../types.js'

const CONFIG: Record<IntegrationStatus, { label: string; color: string; dot: string }> = {
  connected: { label: 'Connected', color: 'text-teal-300', dot: 'bg-teal-400' },
  disconnected: { label: 'Disconnected', color: 'text-white/40', dot: 'bg-white/30' },
  error: { label: 'Error', color: 'text-rose-300', dot: 'bg-rose-400' },
  pending: { label: 'Pending', color: 'text-amber-300', dot: 'bg-amber-400 animate-pulse' },
}

export function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  const c = CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}
