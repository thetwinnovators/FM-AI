// src/components/opportunity/MarketTab.jsx
import ScoringStrip        from './ScoringStrip.jsx'
import CategoryChartsPanel from './CategoryChartsPanel.jsx'
import WinningAppsPanel    from './WinningAppsPanel.jsx'

/**
 * Market tab container. Layout: ScoringStrip on top, CategoryChartsPanel (60%)
 * left and WinningAppsPanel (40%) right.
 *
 * Props:
 *   clusters                       — OpportunityCluster[] for the scoring strip
 *   onChartsUpdated(charts)        — bubbled from CategoryChartsPanel
 *   onWinningAppsUpdated(apps)     — bubbled from WinningAppsPanel
 */
export default function MarketTab({ clusters = [], onChartsUpdated, onWinningAppsUpdated }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Scoring summary strip */}
      <section>
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
          Score Summary
        </h3>
        <ScoringStrip clusters={clusters} />
      </section>

      {/* Two-column panel row */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20, alignItems: 'start' }}>

        {/* Left: Apple top charts */}
        <section>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
            Apple Top Charts
          </h3>
          <CategoryChartsPanel onChartsUpdated={onChartsUpdated} />
        </section>

        {/* Right: Winning apps */}
        <section>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
            Winning Apps
          </h3>
          <WinningAppsPanel onWinningAppsUpdated={onWinningAppsUpdated} />
        </section>

      </div>
    </div>
  )
}
