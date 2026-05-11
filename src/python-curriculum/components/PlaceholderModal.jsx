import { createPortal } from 'react-dom'

export default function PlaceholderModal({ language, onClose, onContinueWithPython }) {
  if (!language) return null
  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-8 max-w-sm w-full mx-4"
        style={{ background: '#0f1221', border: '1px solid rgba(255,255,255,0.1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-2" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {language} is coming soon.
        </h2>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Python is the first live Code Academy track. More languages will be added later.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onContinueWithPython}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#0d9488', color: '#fff' }}
          >
            Continue with Python
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
          >
            Back
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
