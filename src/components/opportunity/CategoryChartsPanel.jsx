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

  // Derive the currently visible chart from allCharts
  const activeChart = allCharts.find(
    (c) => c.category === activeCategory && c.chartType === chartType,
  )
  const isStale = !activeChart || (Date.now() - new Date(activeChart.fetchedAt).getTime() > STALE_MS)

  const doSync = useCallback(async (category, type) => {
    if (syncing) return
    setSyncing(true)
    setSyncError(false)
    try {
      const fetched = await fetchCharts([{ category, chartType: type }])
      if (fetched.length > 0) {
        // Merge fetched chart into allCharts, replacing the same category+type entry
        const merged = [
          ...allCharts.filter((c) => !(c.category === category && c.chartType === type)),
          ...fetched,
        ]
        radarStorage.saveCharts(merged)
        setAllCharts(merged)
        onChartsUpdated?.(merged)
      } else {
        setSyncError(true)
      }
    } catch {
      setSyncError(true)
    } finally {
      setSyncing(false)
    }
  }, [syncing, allCharts, onChartsUpdated])

  // Auto-fetch on first visit if no data for this category + chartType
  useEffect(() => {
    if (!activeChart) { doSync(activeCategory, chartType) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, chartType])

  const pillStyle = (active) => ({
    padding: '4px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid',
    transition: 'all 0.15s',
    background:   active ? 'rgba(13,148,136,0.15)' : 'rgba(255,255,255,0.04)',
    color:        active ? '#5eead4' : 'rgba(255,255,255,0.45)',
    borderColor:  active ? 'rgba(13,148,136,0.35)' : 'rgba(255,255,255,0.09)',
  })

  const toggleStyle = (active) => ({
    padding: '3px 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background:  active ? 'rgba(255,255,255,0.12)' : 'transparent',
    color:       active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Chart type toggle */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        background: 'rgba(255,255,255,0.05)', borderRadius: 8,
        padding: 3, alignSelf: 'flex-start',
      }}>
        <button style={toggleStyle(chartType === 'top_free')}     onClick={() => setChartType('top_free')}>Top Free</button>
        <button style={toggleStyle(chartType === 'top_grossing')} onClick={() => setChartType('top_grossing')}>Top Grossing</button>
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button key={cat} style={pillStyle(cat === activeCategory)} onClick={() => setActiveCategory(cat)}>
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Sync status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
        {syncError ? (
          <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={11} /> Last sync failed — showing cached data
          </span>
        ) : activeChart ? (
          <span style={{ color: isStale ? '#fbbf24' : 'rgba(255,255,255,0.35)' }}>
            {isStale && '⚠ '}Synced {formatSyncAge(activeChart.fetchedAt)}
          </span>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.25)' }}>No data yet</span>
        )}
        <button
          onClick={() => doSync(activeCategory, chartType)}
          disabled={syncing}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: syncing ? 'default' : 'pointer',
            color: syncing ? 'rgba(255,255,255,0.25)' : '#5eead4',
            fontSize: 11, fontWeight: 600, padding: 0,
          }}
        >
          <RefreshCw size={10} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {/* App list */}
      {activeChart ? (
        <div style={{
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden',
          maxHeight: 420,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
        }}>
          {activeChart.apps.slice(0, 50).map((app) => (
            <div
              key={app.appId}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: app.rank % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
              }}
            >
              <span style={{ width: 26, textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>
                {app.rank}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.80)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {app.name}
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', margin: 0 }}>
                  {app.publisher}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)',
          padding: '32px 16px', textAlign: 'center',
          color: 'rgba(255,255,255,0.25)', fontSize: 13,
        }}>
          {syncing ? 'Fetching chart data…' : 'No chart data — click Sync now to load.'}
        </div>
      )}
    </div>
  )
}
