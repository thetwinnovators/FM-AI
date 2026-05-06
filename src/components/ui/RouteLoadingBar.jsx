import { useEffect, useState } from 'react'

/**
 * Slim top-of-viewport progress bar shown while a lazy route chunk is being
 * fetched. Used as the <Suspense> fallback in App.jsx.
 *
 * The bar animates 0 → 85% over 1.5s then stalls. Suspense unmounts it the
 * moment the chunk resolves, so there is no need to drive it to 100% manually.
 */
export default function RouteLoadingBar() {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    // One rAF delay so the browser paints width=0 before the CSS transition runs.
    const id = requestAnimationFrame(() => setWidth(85))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <>
      {/* Thin progress stripe */}
      <div
        className="fixed inset-x-0 top-0 z-[999] pointer-events-none"
        aria-hidden="true"
      >
        <div
          style={{
            height: 2,
            width: `${width}%`,
            background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #14b8a6 100%)',
            transition: 'width 1.5s cubic-bezier(0.05, 0.9, 0.25, 1)',
            boxShadow: '0 0 10px rgba(99,102,241,0.5), 0 0 4px rgba(168,85,247,0.4)',
          }}
        />
      </div>

      {/* Subtle content-area placeholder so the glass-panel doesn't look empty */}
      <div className="min-h-[200px] flex items-start justify-start p-8 gap-3 opacity-30">
        <div className="w-32 h-4 rounded-md bg-white/10 animate-pulse" />
        <div className="w-20 h-4 rounded-md bg-white/10 animate-pulse [animation-delay:150ms]" />
      </div>
    </>
  )
}
