import { Loader2, Zap } from 'lucide-react'

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

function EntityPill({ text, cls }) {
  const t = text.length > 20 ? text.slice(0, 18) + '…' : text
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full leading-none ${cls}`}>
      {t}
    </span>
  )
}

const SUB_SCORES = [
  {
    key:   'gapScore',
    label: 'Gap',
    color: 'bg-rose-400/60',
    title: 'Demand-side: pain severity + urgency + poor solution fit + willingness to pay',
  },
  {
    key:   'marketScore',
    label: 'Market',
    color: 'bg-teal-400/70',
    title: 'Market-side: audience breadth + signal frequency + chart/app-store validation',
  },
  {
    key:   'buildabilityScore',
    label: 'Build',
    color: 'bg-violet-400/60',
    title: 'Supply-side: feasibility + why-now timing + defensibility + GTM clarity',
  },
]

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
  const topSignal  = [...signals].sort((a, b) => b.intensityScore - a.intensityScore)[0]
  const sourceList = [...new Set(signals.map((s) => s.source))].join(', ')

  const scorePercent = Math.min(100, Math.round(cluster.opportunityScore))
  const dim          = cluster.dimensionScores
  const es           = cluster.entitySummary

  // Entity pills — top 3 personas, 2 workarounds, 2 technologies
  const personas    = es?.personas?.slice(0, 3)    ?? []
  const workarounds = es?.workarounds?.slice(0, 2)  ?? []
  const techs       = es?.technologies?.slice(0, 2) ?? []
  const hasEntities = personas.length + workarounds.length + techs.length > 0

  // Badges
  const isWhyNow = (dim?.whyNow ?? 0) >= 60

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 flex flex-col gap-3 h-full">

      {/* ── Rank + badges ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-1.5">
        <span className="text-xs font-bold text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded-full">
          #{rank}
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {isWhyNow && (
            <span
              className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full flex items-center gap-1"
              title={`Why Now score: ${dim?.whyNow}/100 — strong recency or AI/automation momentum`}
            >
              <Zap className="w-2.5 h-2.5" />
              Why Now
            </span>
          )}
          {cluster.isBuildable && (
            <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
              buildable ✅
            </span>
          )}
        </div>
      </div>

      {/* ── Title ─────────────────────────────────────────────────────────── */}
      <h3 className="text-sm font-medium leading-snug capitalize">
        {cluster.clusterName}
      </h3>

      {/* ── 3-score breakdown ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {SUB_SCORES.map(({ key, label, color, title }) => {
          const val = cluster[key] ?? 0
          return (
            <div key={key} title={title}>
              <div className="flex justify-between text-[9px] text-white/30 mb-0.5">
                <span>{label}</span>
                <span className="text-white/50">{val}</span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${color} transition-all`}
                  style={{ width: `${val}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 text-[11px] items-center">
        <span className="text-white/70 font-mono font-semibold">{scorePercent}</span>
        <span className="text-white/20">·</span>
        <span className="text-white/40">{cluster.signalCount} signals</span>
        <span className="text-white/20">·</span>
        <span className="text-white/40">{sourceList}</span>
        <span className="text-white/20">·</span>
        <span className="text-white/30">{formatAge(cluster.lastDetected)}</span>
      </div>

      {/* ── Entity pills ──────────────────────────────────────────────────── */}
      {hasEntities && (
        <div className="flex flex-wrap gap-1">
          {personas.map((p) => (
            <EntityPill key={p} text={p} cls="bg-teal-400/10 text-teal-300/80" />
          ))}
          {workarounds.map((w) => (
            <EntityPill key={w} text={w} cls="bg-amber-400/10 text-amber-300/80" />
          ))}
          {techs.map((t) => (
            <EntityPill key={t} text={t} cls="bg-blue-400/10 text-blue-300/70" />
          ))}
        </div>
      )}

      {/* ── Intensity badge ───────────────────────────────────────────────── */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${intensityCls}`}>
        {intensityText} INTENSITY
      </span>

      {/* ── Top quote ─────────────────────────────────────────────────────── */}
      {topSignal && (
        <blockquote className="text-[11px] text-white/40 italic border-l-2 border-white/10 pl-2 line-clamp-2">
          "{topSignal.painText.slice(0, 120)}…"
        </blockquote>
      )}

      {/* ── CTAs ──────────────────────────────────────────────────────────── */}
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
