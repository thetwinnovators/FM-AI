// src/components/opportunity/ScoringStrip.jsx

function truncate(str, maxLen) {
  if (!str) return ''
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '…'
}

function MiniScoreRow({ label, value, color }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'var(--color-border-subtle)' }}>
        <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

/**
 * Horizontal strip showing per-cluster score breakdowns for the top 5 clusters.
 * Props:
 *   clusters — OpportunityCluster[] (all clusters; component picks top 5 by opportunityScore)
 */
export default function ScoringStrip({ clusters = [] }) {
  const top5 = [...clusters]
    .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
    .slice(0, 5)

  if (top5.length === 0) {
    return (
      <div className="glass-panel p-4 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
        Add market data to start seeing scores.
      </div>
    )
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1">
      {top5.map((c) => {
        const total = c.opportunityScore  ?? 0
        const gap   = c.gapScore          ?? 0
        const mkt   = c.marketScore       ?? 0
        const bld   = c.buildabilityScore ?? 0

        const tier =
          total >= 80 ? { label: 'Strong',    color: '#10b981' } :
          total >= 65 ? { label: 'Promising', color: '#6366f1' } :
          total >= 50 ? { label: 'Watchlist', color: '#f59e0b' } :
                        { label: 'Weak',      color: 'var(--color-text-tertiary)' }

        return (
          <div
            key={c.id}
            className="glass-panel p-3 flex-shrink-0"
            style={{ width: 180 }}
          >
            {/* Cluster name + total */}
            <div className="flex items-start justify-between gap-1.5 mb-2.5">
              <p className="text-[11px] font-semibold leading-snug flex-1 mr-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                {truncate(c.clusterName, 28)}
              </p>
              <span style={{ flexShrink: 0, fontSize: 18, fontWeight: 700, color: tier.color, lineHeight: 1 }}>
                {total}
              </span>
            </div>

            {/* Tier badge */}
            <div className="mb-2.5">
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                color: tier.color,
                background: `${tier.color}18`,
                border: `1px solid ${tier.color}30`,
                borderRadius: 4, padding: '2px 5px',
              }}>
                {tier.label}
              </span>
            </div>

            {/* Score bars */}
            <div className="flex flex-col gap-1.5">
              <MiniScoreRow label="Market" value={mkt} color="#0d9488" />
              <MiniScoreRow label="Gap"    value={gap} color="#6366f1" />
              <MiniScoreRow label="Build"  value={bld} color="#f59e0b" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
