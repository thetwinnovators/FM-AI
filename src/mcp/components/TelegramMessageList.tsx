import type { TelegramCommandMessage } from '../types.js'

const STATUS_CONFIG: Record<TelegramCommandMessage['status'], { label: string; color: string }> = {
  received: { label: 'Received', color: 'text-amber-300' },
  processed: { label: 'Processed', color: 'text-emerald-300' },
  failed: { label: 'Failed', color: 'text-rose-300' },
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

export function TelegramMessageList({ messages }: { messages: TelegramCommandMessage[] }) {
  if (messages.length === 0) {
    return (
      <p className="text-[12px] text-white/35 py-8 text-center">
        No inbound messages yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {messages.map((msg) => {
        const s = STATUS_CONFIG[msg.status]
        return (
          <div
            key={msg.id}
            className="px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] text-white/85 leading-snug flex-1">
                {msg.messageText}
              </p>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className={`text-[10px] font-semibold ${s.color}`}>{s.label}</span>
                <span className="text-[10px] text-white/30">{relativeTime(msg.receivedAt)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
