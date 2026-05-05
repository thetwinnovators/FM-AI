import { useState } from 'react'
import { Loader2, ArrowUpDown, Lightbulb, LightbulbOff } from 'lucide-react'

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

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
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
  const [sortBy,         setSortBy]         = useState('score')
  const [filterSource,   setFilterSource]   = useState('')
  const [showRejected,   setShowRejected]   = useState(false)

  const sources = [...new Set(signals.map((s) => s.source))]

  // Split AI-rejected clusters out so the table defaults to showing only
  // patterns the AI considers software-buildable opportunities.
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

  return (
    <div>
      {/* Filter + Sort bar */}
      <div className="flex flex-wrap gap-3 mb-3 items-center">

        {/* AI-filtered toggle — only appears when the AI has rejected some clusters */}
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

        {/* Source filter chips */}
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

        {/* Sort */}
        <div className="ml-auto flex items-center gap-1.5 text-xs text-white/40">
          <ArrowUpDown className="w-3 h-3" />
          <span className="text-white/25 uppercase tracking-wide text-[10px] mr-0.5">Sort</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-2 py-0.5 rounded transition-colors ${
                sortBy === opt.value
                  ? 'text-white/80 bg-white/[0.06]'
                  : 'hover:text-white/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/5 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5 text-white/30 text-left">
              <th className="px-4 py-2.5 font-medium">Pattern</th>
              <th className="px-3 py-2.5 font-medium text-right">Signals</th>
              <th className="px-3 py-2.5 font-medium text-right">Sources</th>
              <th className="px-3 py-2.5 font-medium">Last seen</th>
              <th className="px-3 py-2.5 font-medium">
                <span
                  className="cursor-help border-b border-dashed border-white/20"
                  title={
                    'Opportunity score — composite of:\n' +
                    '• Signal count × 2\n' +
                    '• Source diversity (+1 per unique source)\n' +
                    '• Recency (+5 if <7 days, +2 if <30 days)\n' +
                    '• Avg emotional intensity × 1.5\n' +
                    '• +3 if 3+ high-intensity signals\n' +
                    '• +5 buildability bonus\n' +
                    '• −10 saturation penalty (Notion, Slack, etc.)'
                  }
                >
                  Score
                </span>
              </th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const maxScore  = Math.max(...rows.map((c) => c.opportunityScore), 1)
              const meanScore = rows.reduce((s, c) => s + c.opportunityScore, 0) / (rows.length || 1)
              return rows.map((cluster, i) => {
              const existingConcept = concepts.find((c) => c.clusterId === cluster.id)
              const isGenerating    = generatingFor === cluster.id
              const barPct          = Math.round((cluster.opportunityScore / maxScore) * 100)
              const isHighPotential = cluster.opportunityScore > meanScore
              const isRejected = cluster.aiValidated === false
              return (
                <tr
                  key={cluster.id}
                  className={`fm-fade-up border-b border-white/[0.03] transition-colors ${
                    isRejected
                      ? 'opacity-40 hover:opacity-60'
                      : `${i % 2 === 0 ? 'bg-white/[0.01]' : ''} hover:bg-white/[0.04]`
                  }`}
                  style={{ '--fm-delay': `${i * 30}ms` }}
                  title={isRejected ? `AI filtered: ${cluster.aiRejectionReason || 'not a software-solvable problem'}` : undefined}
                >
                  <td className="px-4 py-2.5 capitalize font-medium text-white/70 max-w-[200px]">
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                      {isHighPotential
                        ? <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 text-teal-400" style={{ filter: 'drop-shadow(0 0 4px rgb(45 212 191 / 0.8))' }} title="Above-average opportunity score" />
                        : <LightbulbOff className="w-3.5 h-3.5 flex-shrink-0 text-white/35" title="Below-average opportunity score" />
                      }
                      <span className="truncate">{cluster.clusterName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/50">{cluster.signalCount}</td>
                  <td className="px-3 py-2.5 text-right text-white/50">{cluster.sourceDiversity}</td>
                  <td className="px-3 py-2.5 text-white/40">{formatDate(cluster.lastDetected)}</td>
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
              )
            })
            })()}
          </tbody>
        </table>
      </div>
    </div>
  )
}
