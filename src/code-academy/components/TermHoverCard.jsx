import { useState } from 'react'

/**
 * Wraps a term in a dashed underline. Shows a definition card on hover.
 */
export default function TermHoverCard({ term, definition }) {
  const [visible, setVisible] = useState(false)
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="border-b border-dashed border-teal-500/60 cursor-help text-teal-700 font-medium">
        {term}
      </span>
      {visible && definition && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-80 p-3.5 rounded-xl text-xs text-slate-800 leading-relaxed z-50 pointer-events-none shadow-xl"
          style={{ background: '#fff', border: '1px solid rgba(13,148,136,0.2)' }}
        >
          <span className="block font-bold text-teal-700 mb-1.5">{definition.term}</span>
          <span className="block mb-2">{definition.plainMeaning}</span>
          {definition.example && (
            <code className="block mt-1 px-2.5 py-1.5 rounded-lg bg-slate-100 font-mono text-[11px] text-slate-700 break-all">
              {definition.example}
            </code>
          )}
          {definition.whyItMatters && (
            <span className="block mt-1 text-slate-500 italic">{definition.whyItMatters}</span>
          )}
          {/* border caret */}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid rgba(13,148,136,0.2)' }}
          />
          {/* fill caret */}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0"
            style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #fff', marginTop: '-1px' }}
          />
        </span>
      )}
    </span>
  )
}
