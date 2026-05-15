import { useState, Fragment } from 'react'
import { Loader2, ArrowUpDown, Lightbulb, LightbulbOff, ChevronRight, Zap } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'score',     label: 'Score' },
  { value: 'signals',   label: 'Signals' },
  { value: 'recency',   label: 'Recency' },
  { value: 'diversity', label: 'Sources' },
]

const STATUS_COLORS = {
  emerging:          'text-blue-400 bg-blue-400/10',
  validated:         'text-teal-400 bg-teal-400/10',
  concept_generated: 'text-purple-400 bg-purple-400/10',
  archived:          'text-white/20 bg-white/5',
}

const SCORE_TOOLTIP =
  'Opportunity score (0–100) — 10-dimension model:\n' +
  '\nDemand:  pain severity, urgency, poor solution fit, willingness to pay' +
  '\nMarket:  audience breadth, signal frequency' +
  '\nSupply:  feasibility, why-now timing, defensibility, GTM clarity' +
  '\n\nRoll-ups: Gap 40% + Market 40% + Build 20%'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function EntityPill({ text, cls }) {
  const t = text.length > 22 ? text.slice(0, 20) + '…' : text
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full leading-none ${cls}`}>
      {t}
    </span>
  )
}

/** Inline expanded detail shown below a cluster row. */
function ClusterDetail({ cluster }) {
  const gapScore   = cluster.gapScore          ?? 0
  const mktScore   = cluster.marketScore        ?? 0
  const buildScore = cluster.buildabilityScore  ?? 0
  const es         = cluster.entitySummary

  const personas    = es?.personas?.slice(0, 4)    ?? []
  const workarounds = es?.workarounds?.slice(0, 3)  ?? []
  const techs       = es?.technologies?.slice(0, 3) ?? []
  const industries  = es?.industries?.slice(0, 2)   ?? []
  const hasEntities = personas.length + workarounds.length + techs.length + industries.length > 0

  return (
    <div className="space-y-2.5">
      {/* 3 sub-score bars */}
      <div className="flex gap-4 max-w-xs">
        {[
          { label: 'Gap',    val: gapScore,   color: 'bg-rose-400/60',   title: 'Demand: pain severity + urgency + poor solution fit + WTP' },
          { label: 'Market', val: mktScore,   color: 'bg-teal-400/70',   title: 'Market: breadth + frequency + chart validation' },
          { label: 'Build',  val: buildScore, color: 'bg-violet-400/60', title: 'Supply: feasibility + why now + defensibility + GTM' },
        ].map(({ label, val, color, title }) => (
          <div key={label} className="flex-1" title={title}>
            <div className="flex justify-between text-[9px] text-white/30 mb-0.5">
              <span>{label}</span>
              <span className="text-white/50">{val}</span>
            </div>
            <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full ${color}`} style={{ width: `${val}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Entity pills */}
      {hasEntities && (
        <div className="flex flex-wrap gap-1">
          {personas.map((p)    => <EntityPill key={p} text={p} cls="bg-teal-400/10 text-teal-300/80" />)}
          {workarounds.map((w) => <EntityPill key={w} text={w} cls="bg-amber-400/10 text-amber-300/80" />)}
          {techs.map((t)       => <EntityPill key={t} text={t} cls="bg-blue-400/10 text-blue-300/70" />)}
          {industries.map((i)  => <EntityPill key={i} text={i} cls="bg-green-400/10 text-green-300/70" />)}
        </div>
      )}

      {!hasEntities && (
        <p className="text-[10px] text-white/20 italic">No entity data — rescan to populate</p>
      )}
    </div>
  )
}

export default function PatternTable({
  clusters,
  signals,
  concepts,
  onGenerateConcept,
  onViewConcept,
  onViewEvidence,
  generatingFor,
}) {
  const [sortBy,       setSortBy]       = useState('score')
  const [filterSource, setFilterSource] = useState('')
  const [showRejected, setShowRejected] = useState(false)
  const [expandedId,   setExpandedId]   = useState(null)

  const sources = [...new Set(signals.map((s) => s.source))]

  const rejectedCount = clusters.filter((c) => c.aiValidated === false).length

  let rows = clusters.filter((c) => showRejected || c.aiValidated !== false)
  if (filterSource) rows = rows.filter((c) => {
    const clusterSignals = signals.filter((s) => c.signalIds.includes(s.id))
    return clusterSignals.some((s) => s.source === filterSource)
  })
  rows.sort((a, b) => {
    if (sortBy === 'score')     return b.opportunityScore - a.opportunityScore
    if (sortBy === 'signals')   return b.signalCount - a.signalCount
    if (sortBy === 'recency')   return new Date(b.lastDetected).getTime() - new Date(a.lastDetected).getTime()
    if (sortBy === 'diversity') return b.sourceDiversity - a.sourceDiversity
    return 0
  })

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-white/30 text-sm">
        No patterns match current filters.
      </div>
    )
  }

  const maxScore  = Math.max(...rows.map((c) => c.opportunityScore), 1)
  const meanScore = rows.reduce((s, c) => s + c.opportunityScore, 0) / (rows.length || 1)

  return (
    <div>
      {/* ── Filter + Sort bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-3 items-center">

        {rejectedCount > 0 && (
          <button
            onClick={() => setShowRejected((v) => !v)}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors ${
              showRejected
                ? 'bg-purple-400/10 text-purple-400 border-purple-400/20'
                : 'bg-white/[0.03] text-white/30 border-white/10 hover:text-white/50 hover:bg-white/[0.06]'
            }`}
            title={showRejected ? 'Hide AI-filtered patterns' : 'Show patterns AI flagged as non-software problems'}
          >
            {showRejected ? `✕ Hide AI-filtered (${rejectedCount})` : `⚠ AI filtered ${rejectedCount}`}
          </button>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-white/25 uppercase tracking-wide text-[10px]">Source</span>
          {sources.map((src) => (
            <button
              key={src}
              onClick={() => setFilterSource(filterSource === src ? '' : src)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filterSource === src
                  ? 'bg-blue-400/10 text-blue-400 border-blue-400/20'
                  : 'bg-white/[0.03] text-white/30 border-white/10 hover:text-white/60 hover:bg-white/[0.06]'
              }`}
            >
              {src}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 text-xs text-white/40">
          <ArrowUpDown className="w-3 h-3" />
          <span className="text-white/25 uppercase tracking-wide text-[10px] mr-0.5">Sort</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-2 py-0.5 rounded transition-colors ${
                sortBy === opt.value ? 'text-white/80 bg-white/[0.06]' : 'hover:text-white/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5 text-white/30 text-left">
              <th className="px-4 py-2.5 font-medium">Pattern</th>
              <th className="px-3 py-2.5 font-medium text-right">Signals</th>
              <th className="px-3 py-2.5 font-medium text-right">Sources</th>
              <th className="px-3 py-2.5 font-medium">Last seen</th>
              <th className="px-3 py-2.5 font-medium">
                <span className="cursor-help border-b border-dashed border-white/20" title={SCORE_TOOLTIP}>
                  Score
                </span>
              </th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cluster, i) => {
              const existingConcept = concepts.find((c) => c.clusterId === cluster.id)
              const isGenerating    = generatingFor === cluster.id
              const barPct          = Math.round((cluster.opportunityScore / maxScore) * 100)
              const isHighPotential = cluster.opportunityScore > meanScore
              const isRejected      = cluster.aiValidated === false
              const isExpanded      = expandedId === cluster.id
              const isWhyNow        = (cluster.dimensionScores?.whyNow ?? 0) >= 60

              return (
                <Fragment key={cluster.id}>
                  {/* ── Main row ─────────────────────────────────────────── */}
                  <tr
                    className={`border-b border-white/[0.03] transition-colors ${
                      isRejected
                        ? 'opacity-40 hover:opacity-60'
                        : `${i % 2 === 0 ? 'bg-white/[0.01]' : ''} hover:bg-white/[0.04]`
                    } ${isExpanded ? 'bg-white/[0.04]' : ''}`}
                    style={{ '--fm-delay': `${i * 30}ms` }}
                    title={isRejected ? `AI filtered: ${cluster.aiRejectionReason || 'not a software-solvable problem'}` : undefined}
                  >
                    {/* Pattern name + expand toggle */}
                    <td className="px-4 py-2.5 capitalize font-medium text-white/70 max-w-[200px]">
                      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : cluster.id)}
                          className="flex-shrink-0 text-white/25 hover:text-white/60 transition-colors"
                          title={isExpanded ? 'Collapse detail' : 'Expand detail (scores + entities)'}
                        >
                          <ChevronRight
                            className={`w-3 h-3 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </button>
                        {isHighPotential
                          ? <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 text-teal-400" style={{ filter: 'drop-shadow(0 0 4px rgb(45 212 191 / 0.8))' }} title="Above-average opportunity score" />
                          : <LightbulbOff className="w-3.5 h-3.5 flex-shrink-0 text-white/35" title="Below-average opportunity score" />
                        }
                        {isWhyNow && (
                          <Zap
                            className="w-3 h-3 flex-shrink-0 text-amber-400"
                            title={`Why Now: ${cluster.dimensionScores?.whyNow}/100 — strong recency or AI momentum`}
                          />
                        )}
                        <span className="truncate">{cluster.clusterName}</span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-right text-white/50">{cluster.signalCount}</td>
                    <td className="px-3 py-2.5 text-right text-white/50">{cluster.sourceDiversity}</td>
                    <td className="px-3 py-2.5 text-white/40">{formatDate(cluster.lastDetected)}</td>

                    {/* Score bar */}
                    <td className="px-3 py-2.5 min-w-[90px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal-400/70 transition-all"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="text-white/70 font-mono text-right w-6 flex-shrink-0">
                          {Math.round(cluster.opportunityScore)}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[cluster.status] ?? 'text-white/30'}`}>
                        {cluster.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-3 py-2.5">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => existingConcept ? onViewConcept(existingConcept.id) : onGenerateConcept(cluster.id)}
                          disabled={isGenerating}
                          className="text-teal-400 hover:text-teal-300 disabled:opacity-40"
                        >
                          {isGenerating
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : existingConcept ? 'View' : 'Generate'
                          }
                        </button>
                        <span className="text-white/20">·</span>
                        <button
                          onClick={() => onViewEvidence(cluster.id)}
                          className="text-white/40 hover:text-white/70"
                        >
                          Evidence
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* ── Expanded detail row ───────────────────────────────── */}
                  {isExpanded && (
                    <tr className="border-b border-white/[0.03] bg-white/[0.02]">
                      <td colSpan={7} className="px-8 py-3">
                        <ClusterDetail cluster={cluster} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
