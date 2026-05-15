// src/components/opportunity/ScoringStrip.jsx

function truncate(str, maxLen) {
  if (!str) return ''
  return str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '…'
}

function MiniScoreRow({ label, value, color }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.4s ease' }} />
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
      <div style={{
        padding: '12px 16px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        color: 'rgba(255,255,255,0.30)',
        fontSize: 13,
        textAlign: 'center',
      }}>
        Add market data to start seeing scores.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
      {top5.map((c) => {
        const total = c.opportunityScore  ?? 0
        const gap   = c.gapScore          ?? 0
        const mkt   = c.marketScore       ?? 0
        const bld   = c.buildabilityScore ?? 0

        // Tier label
        const tier =
          total >= 80 ? { label: 'Strong',    color: '#10b981' } :
          total >= 65 ? { label: 'Promising', color: '#6366f1' } :
          total >= 50 ? { label: 'Watchlist', color: '#f59e0b' } :
                        { label: 'Weak',      color: 'rgba(255,255,255,0.25)' }

        return (
          <div
            key={c.id}
            style={{
              flexShrink: 0,
              width: 180,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            {/* Cluster name + total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3, flex: 1, marginRight: 6 }}>
                {truncate(c.clusterName, 28)}
              </p>
              <span style={{
                flexShrink: 0,
                fontSize: 18,
                fontWeight: 700,
                color: tier.color,
                lineHeight: 1,
              }}>
                {total}
              </span>
            </div>

            {/* Tier badge */}
            <div style={{ marginBottom: 10 }}>
              <span style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: tier.color,
                background: `${tier.color}18`,
                border: `1px solid ${tier.color}30`,
                borderRadius: 4,
                padding: '2px 5px',
              }}>
                {tier.label}
              </span>
            </div>

            {/* Score bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
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
