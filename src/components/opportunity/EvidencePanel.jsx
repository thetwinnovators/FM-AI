import { useState } from 'react'
import { X } from 'lucide-react'

function IntensityBadge({ score }) {
  const cls =
    score >= 7 ? 'bg-red-400/10 text-red-400' :
    score >= 4 ? 'bg-yellow-400/10 text-yellow-400' :
    'bg-green-400/10 text-green-400'
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cls}`}>
      {score}/10
    </span>
  )
}

export default function EvidencePanel({ cluster, signals = [], onClose }) {
  const [filterSource,    setFilterSource]    = useState('')
  const [filterIntensity, setFilterIntensity] = useState(0)

  if (!cluster) return null

  const sources = [...new Set(signals.map((s) => s.source))]

  let shown = [...signals]
  if (filterSource)         shown = shown.filter((s) => s.source === filterSource)
  if (filterIntensity > 0)  shown = shown.filter((s) => s.intensityScore >= filterIntensity)
  shown.sort((a, b) => b.intensityScore - a.intensityScore)

  const bySource = sources.reduce((acc, src) => {
    acc[src] = shown.filter((s) => s.source === src)
    return acc
  }, {})

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--color-bg)] border-l border-white/8 z-40 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div>
          <h2 className="text-sm font-semibold capitalize">{cluster.clusterName}</h2>
          <p className="text-[11px] text-white/30 mt-0.5">{signals.length} signals</p>
        </div>
        <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-4 py-2.5 border-b border-white/5 flex-wrap">
        {sources.map((src) => (
          <button
            key={src}
            onClick={() => setFilterSource(filterSource === src ? '' : src)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              filterSource === src
                ? 'bg-teal-400/10 text-teal-400 border-teal-400/20'
                : 'bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/8'
            }`}
          >
            {src}
          </button>
        ))}
        <button
          onClick={() => setFilterIntensity(filterIntensity === 7 ? 0 : 7)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            filterIntensity === 7
              ? 'bg-red-400/10 text-red-400 border-red-400/20'
              : 'bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/8'
          }`}
        >
          High intensity only
        </button>
      </div>

      {/* Signal list */}
      <div className="flex-1 overflow-y-auto">
        {sources.map((src) => {
          const group = bySource[src]
          if (!group || group.length === 0) return null
          return (
            <div key={src} className="border-b border-white/5 last:border-0">
              <div className="px-4 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-wide sticky top-0 bg-[var(--color-bg)]">
                {src} — {group.length}
              </div>
              {group.map((signal) => (
                <div key={signal.id} className="px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs text-white/70 leading-relaxed flex-1">{signal.painText.slice(0, 300)}</p>
                    <IntensityBadge score={signal.intensityScore} />
                  </div>
                  <div className="flex gap-3 text-[10px] text-white/30 mt-1">
                    {signal.author && <span>@{signal.author}</span>}
                    {signal.detectedAt && (
                      <span>{new Date(signal.detectedAt).toLocaleDateString()}</span>
                    )}
                    <a
                      href={signal.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400/60 hover:text-teal-400 transition-colors"
                    >
                      View source ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {shown.length === 0 && (
          <div className="p-6 text-center text-white/30 text-xs">No signals match current filters.</div>
        )}
      </div>
    </div>
  )
}
