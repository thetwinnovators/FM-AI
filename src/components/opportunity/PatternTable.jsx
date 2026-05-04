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
  const [sortBy,        setSortBy]        = useState('score')
  const [buildableOnly, setBuildableOnly] = useState(true)
  const [filterSource,  setFilterSource]  = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')

  const sources = [...new Set(signals.map((s) => s.source))]

  let rows = [...clusters]
  if (buildableOnly)  rows = rows.filter((c) => c.isBuildable)
  if (filterSource)   rows = rows.filter((c) => {
    const clusterSignals = signals.filter((s) => c.signalIds.includes(s.id))
    return clusterSignals.some((s) => s.source === filterSource)
  })
  if (filterStatus) rows = rows.filter((c) => c.status === filterStatus)

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
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <button
          onClick={() => setBuildableOnly(!buildableOnly)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            buildableOnly
              ? 'bg-teal-400/10 text-teal-400 border-teal-400/20'
              : 'bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/8'
          }`}
        >
          Buildable only
        </button>

        {sources.map((src) => (
          <button
            key={src}
            onClick={() => setFilterSource(filterSource === src ? '' : src)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filterSource === src
                ? 'bg-blue-400/10 text-blue-400 border-blue-400/20'
                : 'bg-white/[0.03] text-white/40 border-white/10 hover:bg-white/8'
            }`}
          >
            {src}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-white/40">
          <ArrowUpDown className="w-3 h-3" />
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={`px-2 py-0.5 rounded ${sortBy === opt.value ? 'text-white/80' : 'hover:text-white/60'}`}
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
              <th className="px-3 py-2.5 font-medium">Score</th>
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
              return (
                <tr
                  key={cluster.id}
                  className={`border-b border-white/[0.03] ${i % 2 === 0 ? 'bg-white/[0.01]' : ''} hover:bg-white/[0.04] transition-colors`}
                >
                  <td className="px-4 py-2.5 capitalize font-medium text-white/70 max-w-[200px] truncate">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isHighPotential
                        ? <Lightbulb className="w-3.5 h-3.5 flex-shrink-0 text-teal-400" style={{ filter: 'drop-shadow(0 0 4px rgb(45 212 191 / 0.8))' }} title="Above-average opportunity score" />
                        : <LightbulbOff className="w-3.5 h-3.5 text-white/15 flex-shrink-0"   title="Below-average opportunity score" />
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
              )
            })
            })()}
          </tbody>
        </table>
      </div>
    </div>
  )
}
