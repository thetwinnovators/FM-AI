// src/components/opportunity/CategoryChartsPanel.jsx
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { fetchCharts } from '../../opportunity-radar/services/appleChartService.js'
import radarStorage from '../../opportunity-radar/storage/radarStorage.js'

const CATEGORIES = [
  'games', 'productivity', 'finance', 'entertainment',
  'shopping', 'social', 'health-fitness', 'utilities',
]
const CATEGORY_LABELS = {
  'games': 'Games', 'productivity': 'Productivity', 'finance': 'Finance',
  'entertainment': 'Entertainment', 'shopping': 'Shopping', 'social': 'Social',
  'health-fitness': 'Health & Fitness', 'utilities': 'Utilities',
}
const STALE_MS = 6 * 60 * 60 * 1000  // 6 hours

function formatSyncAge(isoTs) {
  if (!isoTs) return null
  const diffMs = Date.now() - new Date(isoTs).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`
  const hrs = Math.floor(diffMs / 3_600_000)
  return `${hrs} hour${hrs > 1 ? 's' : ''} ago`
}

/**
 * Left panel of the Market tab: category pill selector + ranked app list.
 * Props:
 *   onChartsUpdated(charts) — called after a successful sync
 */
export default function CategoryChartsPanel({ onChartsUpdated }) {
  const [activeCategory, setActiveCategory] = useState('productivity')
  const [chartType,      setChartType]      = useState('top_free')
  const [allCharts,      setAllCharts]      = useState(() => radarStorage.loadCharts())
  const [syncing,        setSyncing]        = useState(false)
  const [syncError,      setSyncError]      = useState(false)

  const activeChart = allCharts.find(
    (c) => c.category === activeCategory && c.chartType === chartType,
  )
  const isStale = !activeChart || (Date.now() - new Date(activeChart.fetchedAt).getTime() > STALE_MS)

  // Auto-fetch on first visit if no data for this category + chartType
  useEffect(() => {
    if (!activeChart && !syncing) { doSync(activeCategory, chartType) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, chartType])

  const doSync = useCallback(async (category, type) => {
    if (syncing) return
    setSyncing(true)
    setSyncError(false)
    try {
      const fetched = await fetchCharts([{ category, chartType: type }])
      if (fetched.length > 0) {
        setAllCharts((prev) => {
          const merged = [
            ...prev.filter((c) => !(c.category === category && c.chartType === type)),
            ...fetched,
          ]
          radarStorage.saveCharts(merged)
          onChartsUpdated?.(merged)
          return merged
        })
      } else {
        setSyncError(true)
      }
    } catch {
      setSyncError(true)
    } finally {
      setSyncing(false)
    }
  }, [syncing, onChartsUpdated])

  return (
    <div className="flex flex-col gap-3.5">

      {/* Chart type toggle — segmented control */}
      <div className="inline-flex items-center gap-0.5 self-start rounded-lg p-0.5"
           style={{ background: 'var(--color-bg-glass)' }}>
        {['top_free', 'top_grossing'].map((type) => (
          <button
            key={type}
            onClick={() => setChartType(type)}
            className="btn text-xs py-1 px-2.5"
            style={chartType === type
              ? { background: 'var(--color-bg-glass-strong)', color: 'var(--color-text-primary)' }
              : { background: 'transparent', color: 'var(--color-text-tertiary)' }
            }
          >
            {type === 'top_free' ? 'Top Free' : 'Top Grossing'}
          </button>
        ))}
      </div>

      {/* Category pills */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className="chip cursor-pointer border transition-all"
            style={cat === activeCategory
              ? { background: 'rgba(13,148,136,0.15)', color: '#5eead4', borderColor: 'rgba(13,148,136,0.35)' }
              : { borderColor: 'var(--color-border-subtle)' }
            }
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Sync status row */}
      <div className="flex items-center gap-2 text-[11px]">
        {syncError ? (
          <span className="flex items-center gap-1" style={{ color: '#f87171' }}>
            <AlertTriangle size={11} /> Last sync failed — showing cached data
          </span>
        ) : activeChart ? (
          <span style={{ color: isStale ? '#fbbf24' : 'var(--color-text-tertiary)' }}>
            {isStale && '⚠ '}Synced {formatSyncAge(activeChart.fetchedAt)}
          </span>
        ) : (
          <span style={{ color: 'var(--color-text-tertiary)' }}>No data yet</span>
        )}
        <button
          onClick={() => doSync(activeCategory, chartType)}
          disabled={syncing}
          className="btn-teal flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md"
          style={{ background: 'transparent', opacity: syncing ? 0.4 : 1, cursor: syncing ? 'default' : 'pointer' }}
        >
          <RefreshCw size={10} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {/* App list */}
      {activeChart ? (
        <div className="glass-panel overflow-hidden" style={{ maxHeight: 420, overflowY: 'auto', scrollbarWidth: 'thin' }}>
          {activeChart.apps.slice(0, 50).map((app) => (
            <div
              key={app.appId}
              className="flex items-center gap-2.5 px-3.5 py-2"
              style={{
                borderBottom: `1px solid var(--color-border-subtle)`,
                background: app.rank % 2 === 0 ? 'var(--color-bg-glass)' : 'transparent',
              }}
            >
              <span className="w-6 text-right text-[11px] flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                {app.rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate m-0" style={{ color: 'var(--color-text-secondary)' }}>
                  {app.name}
                </p>
                <p className="text-[10px] m-0" style={{ color: 'var(--color-text-tertiary)' }}>
                  {app.publisher}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel p-8 text-center text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
          {syncing ? 'Fetching chart data…' : 'No chart data — click Sync now to load.'}
        </div>
      )}
    </div>
  )
}
