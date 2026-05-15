import ScoreBar from './ScoreBar.jsx'
import ConfidenceBadge from './ConfidenceBadge.jsx'

const DIMENSION_ORDER = [
  { key: 'painSeverity',     label: 'Pain Severity',      color: 'rose'    },
  { key: 'frequency',        label: 'Frequency',          color: 'fuchsia' },
  { key: 'urgency',          label: 'Urgency',            color: 'amber'   },
  { key: 'willingnessToPay', label: 'Willingness to Pay', color: 'emerald' },
  { key: 'marketBreadth',    label: 'Market Breadth',     color: 'sky'     },
  { key: 'poorSolutionFit',  label: 'Weak Solution Fit',  color: 'amber'   },
  { key: 'feasibility',      label: 'Feasibility',        color: 'emerald' },
  { key: 'whyNow',           label: 'Why Now',            color: 'sky'     },
  { key: 'defensibility',    label: 'Defensibility',      color: 'fuchsia' },
  { key: 'gtmClarity',       label: 'GTM Clarity',        color: 'emerald' },
]

/**
 * dimensionScores: DimensionScores object
 * explanations: array of { dimension, score, explanation, confidence } — optional
 */
export default function DimensionScoreGrid({ dimensionScores, explanations = [] }) {
  if (!dimensionScores) return null
  const explMap = Object.fromEntries((explanations ?? []).map((e) => [e.dimension, e]))

  return (
    <div className="space-y-2.5">
      {DIMENSION_ORDER.map(({ key, label, color }) => {
        const score = dimensionScores[key] ?? 0
        const expl = explMap[label]
        return (
          <div key={key} className="group">
            <ScoreBar label={label} score={score} color={color} />
            {expl?.explanation && (
              <p className="mt-0.5 text-[11px] text-[color:var(--color-text-tertiary)] pl-[124px] leading-relaxed hidden group-hover:block">
                {expl.explanation}
              </p>
            )}
          </div>
        )
      })}
      {dimensionScores.confidence != null && (
        <div className="pt-1 flex justify-end">
          <ConfidenceBadge confidence={dimensionScores.confidence} />
        </div>
      )}
    </div>
  )
}
