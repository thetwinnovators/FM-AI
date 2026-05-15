import ScoreBar from '../ScoreBar.jsx'
import ConfidenceBadge from '../ConfidenceBadge.jsx'

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

export default function CompareTab({ clusters }) {
  const scored = (clusters ?? [])
    .filter((c) => c.dimensionScores != null)
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
    .slice(0, 4) // compare top 4

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

  return (
    <div className="overflow-x-auto max-w-5xl">
      <table className="w-full min-w-[600px] text-sm border-collapse">
        <thead>
          <tr>
            <th className="text-left py-2 pr-4 text-[11px] uppercase tracking-widest text-[color:var(--color-text-tertiary)] w-36">
              Dimension
            </th>
            {scored.map((c) => (
              <th key={c.id} className="text-left py-2 px-3 text-[12px] font-medium min-w-[160px]">
                <div className="truncate" title={c.clusterName}>{c.clusterName}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-fuchsia-300/80 font-mono text-[11px]">{c.opportunityScore}</span>
                  {c.dimensionScores?.confidence != null && (
                    <ConfidenceBadge confidence={c.dimensionScores.confidence} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIMENSIONS.map(({ key, label }) => {
            const scores = scored.map((c) => c.dimensionScores?.[key] ?? 0)
            const maxScore = Math.max(...scores)
            return (
              <tr key={key} className="border-t border-white/5">
                <td className="py-2 pr-4 text-[11px] text-[color:var(--color-text-tertiary)]">{label}</td>
                {scored.map((c) => {
                  const score = c.dimensionScores?.[key] ?? 0
                  const isWinner = score === maxScore && score > 0
                  return (
                    <td key={c.id} className="py-2 px-3">
                      <ScoreBar
                        score={score}
                        color={isWinner ? 'fuchsia' : 'sky'}
                        showValue
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
