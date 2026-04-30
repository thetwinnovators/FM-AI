import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

const LIQUID_GLASS = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.07) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.15)',
  boxShadow:
    '0 30px 80px rgba(0,0,0,0.65),' +
    '0 8px 24px rgba(0,0,0,0.35),' +
    'inset 0 1px 0 rgba(255,255,255,0.20),' +
    'inset 0 -1px 0 rgba(255,255,255,0.05)',
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onCancel?.()
      if (e.key === 'Enter') onConfirm?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  return createPortal(
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[110] bg-black/65 backdrop-blur-md flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] rounded-3xl overflow-hidden"
        style={LIQUID_GLASS}
      >
        <div className="absolute top-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none z-10" />

        <div className="px-6 py-5">
          <div className="flex items-start gap-3">
            {danger ? (
              <div className="w-9 h-9 rounded-full bg-rose-500/15 border border-rose-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle size={16} className="text-rose-300" />
              </div>
            ) : null}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-white">{title}</h2>
              {message ? (
                <p className="mt-2 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{message}</p>
              ) : null}
            </div>
          </div>
        </div>

        <footer className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-2">
          <button onClick={onCancel} className="btn text-sm">{cancelLabel}</button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`btn text-sm ${
              danger
                ? 'text-rose-200 border-rose-400/50 hover:border-rose-300/70 hover:bg-rose-500/10 hover:text-rose-100'
                : 'btn-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
