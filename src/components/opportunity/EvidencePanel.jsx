import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const LIQUID_GLASS = {
  background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.06) 100%)',
  backdropFilter: 'blur(40px) saturate(180%)',
  WebkitBackdropFilter: 'blur(40px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow:
    '0 30px 80px rgba(0,0,0,0.65),' +
    '0 8px 24px rgba(0,0,0,0.35),' +
    'inset 0 1px 0 rgba(255,255,255,0.12),' +
    'inset 0 -1px 0 rgba(255,255,255,0.04)',
}

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

  useEffect(() => {
    if (!cluster) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cluster, onClose])

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

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
        style={LIQUID_GLASS}
      >
        {/* Top shimmer line */}
        <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none z-10" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div>
            <h2 className="text-sm font-semibold capitalize">{cluster.clusterName}</h2>
            <p className="text-[11px] text-white/30 mt-0.5">{signals.length} signals</p>
          </div>
          <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-5 py-2.5 border-b border-white/[0.06] flex-wrap">
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
              <div key={src} className="border-b border-white/[0.05] last:border-0">
                <div className="px-5 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-wide sticky top-0 bg-black/20 backdrop-blur-sm">
                  {src} — {group.length}
                </div>
                {group.map((signal) => (
                  <div key={signal.id} className="px-5 py-3 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors">
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
            <div className="p-8 text-center text-white/30 text-xs">No signals match current filters.</div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
