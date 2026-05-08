import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const PAD = 12   // min distance from viewport edge
const GAP = 10   // gap between term and tooltip

/**
 * Wraps a term in a dashed underline. Shows a definition card on hover.
 * Tooltip is portal-rendered at document.body with fixed positioning so it
 * is never clipped by overflow:hidden ancestors.
 */
export default function TermHoverCard({ term, definition }) {
  const [pos, setPos]         = useState(null) // { top, left } in fixed coords
  const [above, setAbove]     = useState(true)
  const triggerRef            = useRef(null)
  const tooltipRef            = useRef(null)

  function show() {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    // We don't know tooltip height yet — default to above, flip below if needed
    setPos({ anchorMid: r.left + r.width / 2, anchorTop: r.top, anchorBottom: r.bottom })
    setAbove(true)
  }

  function hide() { setPos(null) }

  // After tooltip renders, clamp its position so it stays on-screen
  useEffect(() => {
    if (!pos || !tooltipRef.current) return
    const tw = tooltipRef.current.offsetWidth
    const th = tooltipRef.current.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Horizontal: center on anchor, then clamp
    let left = pos.anchorMid - tw / 2
    left = Math.max(PAD, Math.min(left, vw - tw - PAD))

    // Vertical: prefer above, flip below if not enough room
    const spaceAbove = pos.anchorTop - GAP - PAD
    const spaceBelow = vh - pos.anchorBottom - GAP - PAD
    const fits = th <= spaceAbove
    const top  = fits
      ? pos.anchorTop  - th - GAP
      : pos.anchorBottom + GAP

    setAbove(fits)
    tooltipRef.current.style.left = `${left}px`
    tooltipRef.current.style.top  = `${top}px`
  }, [pos])

  return (
    <span ref={triggerRef} className="relative inline-block">
      <span
        className="border-b border-dashed border-teal-500/60 cursor-help text-teal-700 font-medium"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {term}
      </span>

      {pos && definition && createPortal(
        <span
          ref={tooltipRef}
          onMouseLeave={hide}
          className="fixed z-[9999] w-80 p-3.5 rounded-xl text-xs text-slate-800 leading-relaxed shadow-xl pointer-events-none"
          style={{
            background: '#fff',
            border: '1px solid rgba(13,148,136,0.2)',
            // start invisible at 0,0; useEffect will place it correctly
            top: 0, left: 0,
          }}
        >
          <span className="block font-bold text-teal-700 mb-1.5">{definition.term}</span>
          <span className="block mb-2">{definition.plainMeaning}</span>
          {definition.example && (
            <code className="block mt-1 px-2.5 py-1.5 rounded-lg bg-slate-100 font-mono text-[11px] text-slate-700 break-all whitespace-pre-wrap">
              {definition.example}
            </code>
          )}
          {definition.whyItMatters && (
            <span className="block mt-1.5 text-slate-500 italic">{definition.whyItMatters}</span>
          )}
          {/* caret */}
          <span
            className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
            style={above
              ? { top: '100%', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid rgba(13,148,136,0.2)' }
              : { bottom: '100%', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '6px solid rgba(13,148,136,0.2)' }
            }
          />
          <span
            className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
            style={above
              ? { top: '100%', marginTop: '-1px', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #fff' }
              : { bottom: '100%', marginBottom: '-1px', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid #fff' }
            }
          />
        </span>,
        document.body,
      )}
    </span>
  )
}
