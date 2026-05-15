import ScoreBar from './ScoreBar.jsx'
import ConfidenceBadge from './ConfidenceBadge.jsx'

const DIMENSION_ORDER = [
  { key: 'painSeverity',     label: 'Pain Severity',      color: 'rose'    },
  { key: 'frequency',        label: 'Frequency',          color: 'topic'   },
  { key: 'urgency',          label: 'Urgency',            color: 'amber'   },
  { key: 'willingnessToPay', label: 'Willingness to Pay', color: 'emerald' },
  { key: 'marketBreadth',    label: 'Market Breadth',     color: 'sky'     },
  { key: 'poorSolutionFit',  label: 'Weak Solution Fit',  color: 'amber'   },
  { key: 'feasibility',      label: 'Feasibility',        color: 'emerald' },
  { key: 'whyNow',           label: 'Why Now',            color: 'sky'     },
  { key: 'defensibility',    label: 'Defensibility',      color: 'topic'   },
  { key: 'gtmClarity',       label: 'GTM Clarity',        color: 'emerald' },
]

function DriverPill({ driver }) {
  let accent
  if (driver.type === 'signal')  accent = 'rgba(20,184,166,0.5)'   // teal
  if (driver.type === 'entity')  accent = 'rgba(217,70,239,0.5)'   // magenta
  if (driver.type === 'flag')    accent = null                      // no accent

  const pillClass = [
    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] leading-tight',
    driver.contribution === 'negative' ? 'opacity-50' : '',
    driver.type === 'flag' ? 'bg-white/5' : 'bg-transparent border',
  ].filter(Boolean).join(' ')

  return (
    <span
      className={pillClass}
      style={accent ? { borderColor: accent, color: accent } : { color: 'var(--color-text-tertiary)' }}
      title={driver.signalSnippet ?? driver.label}
    >
      {driver.type === 'entity' && (
        <span className="opacity-60 font-mono text-[9px]">{driver.entityType}:</span>
      )}
      <span className={driver.type === 'signal' ? 'truncate max-w-[160px]' : ''}>
        {driver.type === 'signal'
          ? (driver.signalSnippet ? driver.signalSnippet.slice(0, 60) + (driver.signalSnippet.length > 60 ? '…' : '') : driver.label)
          : (driver.entityValue ?? driver.label)}
      </span>
      {driver.pointValue != null && Math.abs(driver.pointValue) > 0 && (
        <span className="opacity-50">+{Math.abs(driver.pointValue)}</span>
      )}
    </span>
  )
}

/**
 * dimensionScores: DimensionScores object
 * explanations: array of { dimension, score, explanation, confidence } — optional
 * drivers: DimensionDriverMap — optional; undefined on legacy clusters
 */
export default function DimensionScoreGrid({ dimensionScores, explanations = [], drivers }) {
  if (!dimensionScores) return null
  const explMap = Object.fromEntries((explanations ?? []).map((e) => [e.dimension, e]))

  return (
    <div className="space-y-2.5">
      {DIMENSION_ORDER.map(({ key, label, color }) => {
        const score      = dimensionScores[key] ?? 0
        const expl       = explMap[label]
        const dimDrivers = drivers?.[key]
        return (
          <div key={key}>
            <ScoreBar label={label} score={score} color={color} />
            {expl?.explanation && (
              <p className="mt-0.5 text-[11px] text-[color:var(--color-text-tertiary)] pl-[124px] leading-relaxed">
                {expl.explanation}
              </p>
            )}
            {dimDrivers?.length > 0 && (
              <div className="mt-1 pl-[124px] flex flex-wrap gap-1 min-h-0">
                {dimDrivers.slice(0, 3).map((d, i) => <DriverPill key={`${d.type}-${d.flagKey ?? d.signalId ?? d.entityValue ?? i}`} driver={d} />)}
                {dimDrivers.length > 3 && (
                  <span className="text-[10px] text-[color:var(--color-text-tertiary)] self-center">
                    +{dimDrivers.length - 3} more
                  </span>
                )}
              </div>
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
