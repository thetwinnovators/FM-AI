import { Loader2 } from 'lucide-react'

function intensityLabel(avg) {
  if (avg >= 7) return { label: 'HIGH',   cls: 'bg-red-400/10 text-red-400' }
  if (avg >= 4) return { label: 'MEDIUM', cls: 'bg-yellow-400/10 text-yellow-400' }
  return               { label: 'LOW',    cls: 'bg-green-400/10 text-green-400' }
}

function formatAge(isoDate) {
  if (!isoDate) return '—'
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const hours  = Math.floor(diffMs / 3_600_000)
  const days   = Math.floor(diffMs / 86_400_000)
  if (hours < 1)  return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export default function RadarTopCard({
  cluster,
  signals,
  rank,
  existingConcept,
  generating,
  onGenerateConcept,
  onViewConcept,
  onViewEvidence,
  evidenceOpen,
}) {
  const { label: intensityText, cls: intensityCls } = intensityLabel(cluster.avgIntensity)
  const topSignal = [...signals].sort((a, b) => b.intensityScore - a.intensityScore)[0]
  const sourceList = [...new Set(signals.map((s) => s.source))].join(', ')

  const scorePercent = Math.min(100, Math.round(cluster.opportunityScore))

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex flex-col gap-3 h-full">
      {/* Rank + buildable */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded-full">
          #{rank}
        </span>
        {cluster.isBuildable && (
          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            Claude-Code-buildable ✅
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium leading-snug capitalize">
        {cluster.clusterName}
      </h3>

      {/* Score bar */}
      <div>
        <div className="flex justify-between text-[10px] text-white/40 mb-1">
          <span>Opportunity score</span>
          <span>{scorePercent}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-teal-400 transition-all"
            style={{ width: `${scorePercent}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="text-white/50">{cluster.signalCount} signals</span>
        <span className="text-white/30">·</span>
        <span className="text-white/50">{cluster.sourceDiversity} sources: {sourceList}</span>
        <span className="text-white/30">·</span>
        <span className="text-white/50">Last: {formatAge(cluster.lastDetected)}</span>
      </div>

      {/* Intensity badge */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${intensityCls}`}>
        {intensityText} INTENSITY
      </span>

      {/* Top quote */}
      {topSignal && (
        <blockquote className="text-[11px] text-white/40 italic border-l-2 border-white/10 pl-2 line-clamp-2">
          "{topSignal.painText.slice(0, 120)}…"
        </blockquote>
      )}

      {/* CTAs */}
      <div className="flex gap-2 mt-auto pt-2">
        <button
          onClick={existingConcept ? onViewConcept : onGenerateConcept}
          disabled={generating}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg
            bg-teal-500/10 text-teal-400 border border-teal-400/20
            hover:bg-teal-500/20 disabled:opacity-40 transition-colors"
        >
          {generating
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
            : existingConcept ? 'View Concept' : 'Generate App Concept'
          }
        </button>
        <button
          onClick={onViewEvidence}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            evidenceOpen
              ? 'bg-white/10 border-white/20 text-white/80'
              : 'bg-white/[0.03] border-white/10 text-white/40 hover:bg-white/8'
          }`}
        >
          Evidence
        </button>
      </div>
    </div>
  )
}
