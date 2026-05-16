import { useMemo } from 'react'
import { Hash } from 'lucide-react'

/**
 * Shared tool-mention picker dropdown for all Flow.AI chat surfaces.
 *
 * Props:
 *   tools     – full array from localMCPStorage.listTools()
 *   query     – current filter string (text after the '#' trigger)
 *   activeIdx – keyboard-highlighted row index
 *   onSelect  – called with the chosen tool object
 */
export default function ToolMentionPicker({ tools, query, activeIdx, onSelect }) {
  const filtered = useMemo(() => {
    const q = (query ?? '').toLowerCase()
    return tools
      .filter(
        (t) =>
          !q ||
          t.toolName.toLowerCase().includes(q) ||
          t.displayName.toLowerCase().includes(q),
      )
      .slice(0, 9)
  }, [tools, query])

  const isEmpty = !filtered.length

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-white/[0.10] overflow-hidden z-50 shadow-2xl"
      style={{ background: 'rgba(10,12,22,0.97)', backdropFilter: 'blur(24px)' }}
    >
      <div className="px-3 py-1.5 border-b border-white/[0.06] flex items-center gap-1.5">
        <Hash size={10} className="text-indigo-400" />
        <span className="text-[10px] text-white/35 uppercase tracking-wider">Pin a tool</span>
        {query && <span className="text-[10px] text-indigo-400/70 font-mono">#{query}</span>}
      </div>
      {isEmpty ? (
        <div className="px-3 py-3 text-center">
          <p className="text-[12px] text-white/40">
            {query
              ? <>No tools match <span className="font-mono text-indigo-400/70">#{query}</span></>
              : 'No tools connected'}
          </p>
          <p className="text-[11px] text-white/25 mt-0.5">
            Go to <span className="text-white/40">Connections → Docker MCP</span> to add tools
          </p>
        </div>
      ) : null}
      {filtered.map((tool, idx) => {
        const source = tool.displayName.replace(tool.toolName, '').replace(/[()]/g, '').trim()
        return (
          <button
            key={tool.id}
            onClick={() => onSelect(tool)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
              idx === activeIdx ? 'bg-indigo-500/20' : 'hover:bg-white/[0.04]'
            }`}
          >
            <Hash size={10} className="text-indigo-400/60 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-medium text-white/85">{tool.toolName}</span>
              {source && (
                <span className="text-[11px] text-white/35 ml-1.5">{source}</span>
              )}
            </div>
            <span
              className={`text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                tool.riskLevel === 'write' || tool.riskLevel === 'publish'
                  ? 'text-teal-300 bg-teal-400/10'
                  : 'text-emerald-300 bg-emerald-400/10'
              }`}
            >
              {tool.riskLevel ?? 'read'}
            </span>
          </button>
        )
      })}
      {!isEmpty && (
        <div className="px-3 py-1 border-t border-white/[0.06] text-[10px] text-white/20">
          ↑↓ navigate · Enter select · Esc close
        </div>
      )}
    </div>
  )
}
