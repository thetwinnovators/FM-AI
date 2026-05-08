// src/components/opportunity/MarketTab.jsx
import ScoringStrip        from './ScoringStrip.jsx'
import CategoryChartsPanel from './CategoryChartsPanel.jsx'
import WinningAppsPanel    from './WinningAppsPanel.jsx'

/**
 * Market tab container. Layout: ScoringStrip on top, CategoryChartsPanel (3fr)
 * left and WinningAppsPanel (2fr) right. Responsive: single column on small screens.
 *
 * Props:
 *   clusters             — OpportunityCluster[] for the scoring strip
 *   onChartsUpdated(charts)    — bubbled from CategoryChartsPanel
 *   onWinningAppsUpdated(apps) — bubbled from WinningAppsPanel
 */
export default function MarketTab({ clusters = [], onChartsUpdated, onWinningAppsUpdated }) {
  return (
    <div className="flex flex-col gap-5">

      {/* Scoring summary strip */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2.5"
            style={{ color: 'var(--color-text-tertiary)' }}>
          Score Summary
        </h3>
        <ScoringStrip clusters={clusters} />
      </section>

      {/* Two-column panel row */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5 items-start">

        {/* Left: Apple top charts */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2.5"
              style={{ color: 'var(--color-text-tertiary)' }}>
            Apple Top Charts
          </h3>
          <CategoryChartsPanel onChartsUpdated={onChartsUpdated} />
        </section>

        {/* Right: Winning apps */}
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2.5"
              style={{ color: 'var(--color-text-tertiary)' }}>
            Winning Apps
          </h3>
          <WinningAppsPanel onWinningAppsUpdated={onWinningAppsUpdated} />
        </section>

      </div>
    </div>
  )
}
