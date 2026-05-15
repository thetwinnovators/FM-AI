import { Trophy } from 'lucide-react'
import { formatClusterName } from '../../../venture-scope/utils/formatClusterName.js'

const DIMENSIONS = [
  { key: 'painSeverity',     label: 'Pain Severity'      },
  { key: 'frequency',        label: 'Frequency'          },
  { key: 'urgency',          label: 'Urgency'            },
  { key: 'willingnessToPay', label: 'Willingness to Pay' },
  { key: 'marketBreadth',    label: 'Market Breadth'     },
  { key: 'poorSolutionFit',  label: 'Weak Solution Fit'  },
  { key: 'feasibility',      label: 'Feasibility'        },
  { key: 'whyNow',           label: 'Why Now'            },
  { key: 'defensibility',    label: 'Defensibility'      },
  { key: 'gtmClarity',       label: 'GTM Clarity'        },
]

// Stable accent per rank position
const RANK_ACCENT  = ['#f59e0b', '#94a3b8', '#b45309', '#64748b']  // gold, silver, bronze, slate
const CLUSTER_DOT  = [
  'rgba(217,70,239,0.9)',   // topic purple — 1st
  'rgba(56,189,248,0.9)',   // sky — 2nd
  'rgba(52,211,153,0.9)',   // emerald — 3rd
  'rgba(251,191,36,0.9)',   // amber — 4th
]

export default function CompareTab({ clusters }) {
  const scored = (clusters ?? [])
    .filter((c) => c.dimensionScores != null)
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
    .slice(0, 4)

  if (scored.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          Need at least 2 scored opportunities to compare.
        </p>
        <p className="text-xs text-[color:var(--color-text-tertiary)] mt-1">
          Run a scan with more diverse content first.
        </p>
      </div>
    )
  }

  // Count dimension wins per cluster (index in scored array)
  const winCounts = scored.map(() => 0)
  const dimensionLeaders = DIMENSIONS.map(({ key, label }) => {
    const byScore = scored
      .map((c, i) => ({ cluster: c, score: c.dimensionScores?.[key] ?? 0, idx: i }))
      .sort((a, b) => b.score - a.score)
    if (byScore[0].score > 0) winCounts[byScore[0].idx]++
    return { key, label, leader: byScore[0], runnerUp: byScore[1] ?? null }
  })

  const maxScore = Math.max(...scored.map((c) => c.opportunityScore ?? 0))

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Leaderboard ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-3.5 h-3.5 text-[color:var(--color-text-secondary)]" />
          <span className="text-[11px] font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wider">
            Overall Rankings
          </span>
        </div>
        <div className="glass-panel divide-y divide-white/[0.06]">
          {scored.map((cluster, i) => {
            const pct = maxScore > 0 ? ((cluster.opportunityScore ?? 0) / maxScore) * 100 : 0
            return (
              <div key={cluster.id} className="flex items-center gap-4 px-4 py-3">
                {/* Rank number */}
                <span
                  className="text-sm font-bold font-mono w-4 text-center flex-shrink-0"
                  style={{ color: RANK_ACCENT[i] }}
                >
                  {i + 1}
                </span>
                {/* Name + wins */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">
                    {formatClusterName(cluster.clusterName)}
                  </p>
                  <p className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">
                    Leads {winCounts[i]}/{DIMENSIONS.length} dimensions
                  </p>
                </div>
                {/* Score bar + value */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-24 h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: CLUSTER_DOT[i] }}
                    />
                  </div>
                  <span
                    className="text-xs font-mono tabular-nums w-6 text-right"
                    style={{ color: RANK_ACCENT[i] }}
                  >
                    {cluster.opportunityScore ?? '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Dimension Leaders ───────────────────────────────────── */}
      <div>
        <div className="mb-3">
          <span className="text-[11px] font-medium text-[color:var(--color-text-secondary)] uppercase tracking-wider">
            Dimension Leaders
          </span>
          <p className="text-[11px] text-[color:var(--color-text-tertiary)] mt-0.5">
            Which opportunity leads each scoring category
          </p>
        </div>
        <div className="glass-panel divide-y divide-white/[0.06]">
          {dimensionLeaders.map(({ key, label, leader, runnerUp }) => (
            <div key={key} className="flex items-center gap-3 px-4 py-2.5">
              {/* Dimension name */}
              <span className="text-[11px] text-[color:var(--color-text-tertiary)] w-36 flex-shrink-0">
                {label}
              </span>
              {/* Winner */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CLUSTER_DOT[leader.idx] }}
                />
                <span className="text-xs font-medium truncate">
                  {formatClusterName(leader.cluster.clusterName)}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-[color:var(--color-text-secondary)] flex-shrink-0">
                  {leader.score}
                </span>
              </div>
              {/* Runner-up (muted) */}
              {runnerUp && runnerUp.score > 0 && (
                <div className="flex items-center gap-1 flex-shrink-0 opacity-35">
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: CLUSTER_DOT[runnerUp.idx] }}
                  />
                  <span className="text-[10px] truncate max-w-[90px]">
                    {formatClusterName(runnerUp.cluster.clusterName)}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums">{runnerUp.score}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
