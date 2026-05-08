import { useState, useEffect, useCallback } from 'react'
import { Radar, Trash2, Play, Loader2 } from 'lucide-react'
import RadarTopCard    from '../components/opportunity/RadarTopCard.jsx'
import PatternTable    from '../components/opportunity/PatternTable.jsx'
import ConceptView     from '../components/opportunity/ConceptView.jsx'
import EvidencePanel   from '../components/opportunity/EvidencePanel.jsx'
import MarketTab       from '../components/opportunity/MarketTab.jsx'
import radarStorage    from '../opportunity-radar/storage/radarStorage.js'
import { runPainSearch }    from '../opportunity-radar/services/painSearchService.js'
import { extractSignals }   from '../opportunity-radar/services/signalExtractor.js'
import { KeywordClusterer } from '../opportunity-radar/services/clusterService.js'
import { applyBuildabilityFilter, scoreOpportunity } from '../opportunity-radar/services/opportunityScorer.js'
import { aiValidateClusters }  from '../opportunity-radar/services/aiOpportunityFilter.js'
import { generateConcept }     from '../opportunity-radar/services/conceptGenerator.js'
import { getTop3 }             from '../opportunity-radar/services/opportunityScorer.js'
import { ALL_SOURCES, SOURCE_LABELS } from '../opportunity-radar/services/painSearchService.js'

const SCAN_STALE_MS = 6 * 60 * 60 * 1000

function formatAge(isoDate) {
  if (!isoDate) return 'Never scanned'
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const mins   = Math.floor(diffMs / 60_000)
  const hours  = Math.floor(diffMs / 3_600_000)
  const days   = Math.floor(diffMs / 86_400_000)
  if (mins < 2)   return 'Just now'
  if (mins < 60)  return `${mins} minutes ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  return `${days} day${days > 1 ? 's' : ''} ago`
}

const TABS = ['signals', 'market', 'ranked']
const TAB_LABELS = { signals: 'Signals', market: 'Market', ranked: 'Ranked Opportunities' }

export default function OpportunityRadar() {
  const [signals,          setSignals]          = useState(() => radarStorage.loadSignals())
  const [clusters,         setClusters]         = useState(() => radarStorage.loadClusters())
  const [concepts,         setConcepts]         = useState(() => radarStorage.loadConcepts())
  const [meta,             setMeta]             = useState(() => radarStorage.loadMeta())
  const [charts,           setCharts]           = useState(() => radarStorage.loadCharts())
  const [winningApps,      setWinningApps]      = useState(() => radarStorage.loadWinningApps())
  const [scanning,         setScanning]         = useState(false)
  const [aiValidating,     setAiValidating]     = useState(false)
  const [progress,         setProgress]         = useState([])
  const [activeConceptId,  setActiveConceptId]  = useState(null)
  const [evidenceClusterId, setEvidenceClusterId] = useState(null)
  const [generatingFor,    setGeneratingFor]    = useState(null)
  const [activeTab,        setActiveTab]        = useState('signals')

  const top3 = getTop3(clusters, signals)

  // Count distinct categories that have chart data
  const marketSyncedCategories = [...new Set(charts.map((c) => c.category))].length

  // ── Rescore all clusters with fresh market data ─────────────────────────────
  const rescoreClusters = useCallback((currentCharts, currentApps) => {
    const allSignals = radarStorage.loadSignals()
    if (allSignals.length === 0) return
    const updated = clusters.map((c) => {
      const scores = scoreOpportunity(c, allSignals, currentCharts, currentApps)
      return {
        ...c,
        isBuildable:       applyBuildabilityFilter(c, allSignals),
        opportunityScore:  scores.totalScore,
        gapScore:          scores.gapScore,
        marketScore:       scores.marketScore,
        buildabilityScore: scores.buildabilityScore,
        inferredCategory:  scores.inferredCategory,
      }
    })
    radarStorage.saveClusters(updated)
    setClusters(updated)
  }, [clusters])

  // ── Market data change callbacks ────────────────────────────────────────────
  const handleChartsUpdated = useCallback((newCharts) => {
    setCharts(newCharts)
    rescoreClusters(newCharts, winningApps)
  }, [rescoreClusters, winningApps])

  const handleWinningAppsUpdated = useCallback((newApps) => {
    setWinningApps(newApps)
    rescoreClusters(charts, newApps)
  }, [rescoreClusters, charts])

  // ── Scan pipeline ───────────────────────────────────────────────────────────
  const triggerScan = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setProgress([])
    const start = Date.now()

    try {
      const rawResults = await runPainSearch(
        ALL_SOURCES,
        (p) => setProgress((prev) => {
          const existing = prev.findIndex((x) => x.source === p.source)
          if (existing >= 0) { const next = [...prev]; next[existing] = p; return next }
          return [...prev, p]
        }),
      )

      const newSignals = extractSignals(rawResults, '')
      radarStorage.appendSignals(newSignals)
      const allSignals = radarStorage.loadSignals()

      const clusterer = new KeywordClusterer()
      const existingClusters = radarStorage.loadClusters()
      const newClusters = clusterer.cluster(allSignals, existingClusters)

      // Load latest market data from storage (may have been synced on Market tab)
      const currentCharts      = radarStorage.loadCharts()
      const currentWinningApps = radarStorage.loadWinningApps()

      const scored = newClusters.map((c) => {
        const isBuildable = applyBuildabilityFilter(c, allSignals)
        const withB = { ...c, isBuildable }
        const scores = scoreOpportunity(withB, allSignals, currentCharts, currentWinningApps)
        return {
          ...withB,
          opportunityScore:  scores.totalScore,
          gapScore:          scores.gapScore,
          marketScore:       scores.marketScore,
          buildabilityScore: scores.buildabilityScore,
          inferredCategory:  scores.inferredCategory,
        }
      })

      setAiValidating(true)
      let validated = scored
      try {
        const validations = await aiValidateClusters(scored, allSignals)
        const validationMap = new Map(validations.map((v) => [v.clusterId, v]))
        validated = scored.map((c) => {
          const v = validationMap.get(c.id)
          return {
            ...c,
            aiValidated:       v ? v.keep : undefined,
            aiRejectionReason: v && !v.keep ? v.reason : undefined,
          }
        })
      } catch (err) {
        console.warn('[OpportunityRadar] AI validation failed, keeping all clusters', err)
      } finally {
        setAiValidating(false)
      }

      radarStorage.saveClusters(validated)
      const newMeta = {
        lastScanAt:     new Date().toISOString(),
        totalSignals:   allSignals.length,
        totalClusters:  scored.length,
        scanDurationMs: Date.now() - start,
      }
      radarStorage.saveMeta(newMeta)

      setSignals(allSignals)
      setClusters(validated)
      setConcepts(radarStorage.loadConcepts())
      setMeta(newMeta)
      setCharts(currentCharts)
    } catch (err) {
      console.error('[OpportunityRadar] scan failed', err)
    } finally {
      setScanning(false)
    }
  }, [scanning])

  // ── On-load freshness check ─────────────────────────────────────────────────
  useEffect(() => {
    const lastScan = meta?.lastScanAt ? new Date(meta.lastScanAt).getTime() : 0
    const isStale  = !meta?.lastScanAt || (Date.now() - lastScan > SCAN_STALE_MS)
    if (isStale) triggerScan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reset ───────────────────────────────────────────────────────────────────
  function handleReset() {
    if (!window.confirm('Clear all signals, patterns, and concepts? Market data (charts + winning apps) is preserved.')) return
    radarStorage.clearAll()
    setSignals([])
    setClusters([])
    setConcepts([])
    setMeta(null)
    setProgress([])
    // Note: charts and winningApps are not cleared — they are market data, not scan data
  }

  // ── Concept generation ──────────────────────────────────────────────────────
  const handleGenerateConcept = useCallback(async (clusterId) => {
    const cluster = clusters.find((c) => c.id === clusterId)
    if (!cluster) return
    setGeneratingFor(clusterId)
    try {
      const concept = await generateConcept(cluster, signals)
      radarStorage.saveConcept(concept)
      const updatedClusters = clusters.map((c) =>
        c.id === clusterId ? { ...c, status: 'concept_generated' } : c,
      )
      radarStorage.saveClusters(updatedClusters)
      setClusters(updatedClusters)
      setConcepts(radarStorage.loadConcepts())
      setActiveConceptId(concept.id)
    } finally {
      setGeneratingFor(null)
    }
  }, [clusters, signals])

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] p-4 md:p-6 max-w-7xl mx-auto">

      {/* ── Shared page header ─────────────────────────────────────────────── */}
      <div className="mb-5">
        {/* Title row + controls */}
        <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Radar className="w-6 h-6 text-teal-400" />
            <h1 className="text-xl font-semibold">Opportunity Radar</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={scanning}
              title="Clears scan results, clusters, and ranking state"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] text-white/40 border border-white/10
                hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-400/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={triggerScan}
              disabled={scanning}
              title="Refreshes pain signals and updates opportunity scores"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-400/20
                hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {scanning ? 'Scanning…' : <><Play className="w-3.5 h-3.5" fill="currentColor" />Run Scan</>}
            </button>
          </div>
        </div>

        {/* Status line */}
        <p className="text-xs text-white/30">
          Last scan: {formatAge(meta?.lastScanAt)}
          {meta?.totalSignals > 0 && (
            <> · <span className="text-teal-400/70">{meta.totalSignals} signals · {meta.totalClusters} clusters</span></>
          )}
          {marketSyncedCategories > 0 && (
            <> · <span className="text-indigo-400/70">market synced for {marketSyncedCategories} {marketSyncedCategories === 1 ? 'category' : 'categories'}</span></>
          )}
        </p>
      </div>

      {/* ── Scan progress ──────────────────────────────────────────────────── */}
      {scanning && (
        <div className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-teal-400/70 transition-all duration-500"
                style={{
                  width: `${ALL_SOURCES.length === 0 ? 0 : Math.round(
                    (progress.filter(p => p.status === 'done' || p.status === 'error').length / ALL_SOURCES.length) * 100
                  )}%`
                }}
              />
            </div>
            <span className="text-xs text-white/40 flex-shrink-0">
              {progress.filter(p => p.status === 'done' || p.status === 'error').length} / {ALL_SOURCES.length} sources
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {ALL_SOURCES.map((src) => {
              const p = progress.find(x => x.source === src)
              const status = p?.status ?? 'pending'
              return (
                <span key={src} className={`text-xs px-2 py-1 rounded-full ${
                  status === 'done'    ? 'bg-green-400/10 text-green-400' :
                  status === 'error'  ? 'bg-red-400/10 text-red-400' :
                  status === 'running' ? 'bg-teal-400/10 text-teal-300 animate-pulse' :
                  'bg-white/5 text-white/20'
                }`}>
                  {SOURCE_LABELS[src] ?? src}
                  {status === 'done'    ? ` ✓${p?.resultCount ? ` ${p.resultCount}` : ''}` :
                   status === 'error'   ? ' ✗' :
                   status === 'running' ? ' …' : ''}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {aiValidating && (
        <div className="mb-5 flex items-center gap-2 text-xs text-purple-300/80">
          <Loader2 className="w-3 h-3 animate-spin" />
          AI reviewing patterns for software buildability…
        </div>
      )}

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b border-white/8">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-teal-400'
                : 'text-white/40 hover:text-white/65'
            }`}
            style={activeTab === tab ? { borderBottom: '2px solid #2dd4bf', marginBottom: -1 } : {}}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── Signals tab ────────────────────────────────────────────────────── */}
      {activeTab === 'signals' && (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-medium text-white/40 uppercase tracking-wide mb-3">
              Top Opportunities
            </h2>
            {top3.length === 0 ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-8 text-center text-white/30 text-sm">
                {scanning
                  ? 'Scanning for pain patterns…'
                  : `Not enough validated patterns yet. Need ≥ 10 signals, ≥ 2 sources per cluster. ${meta?.totalSignals ?? 0} signals collected so far.`}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3.map((cluster, i) => {
                  const existingConcept = concepts.find((c) => c.clusterId === cluster.id)
                  return (
                    <RadarTopCard
                      key={cluster.id}
                      cluster={cluster}
                      signals={signals.filter((s) => cluster.signalIds.includes(s.id))}
                      rank={i + 1}
                      existingConcept={existingConcept ?? null}
                      generating={generatingFor === cluster.id}
                      onGenerateConcept={() => handleGenerateConcept(cluster.id)}
                      onViewConcept={() => setActiveConceptId(existingConcept?.id ?? null)}
                      onViewEvidence={() => setEvidenceClusterId(
                        evidenceClusterId === cluster.id ? null : cluster.id,
                      )}
                      evidenceOpen={evidenceClusterId === cluster.id}
                    />
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium text-white/40 uppercase tracking-wide mb-3">
              All Pain Patterns
            </h2>
            <PatternTable
              clusters={clusters}
              signals={signals}
              concepts={concepts}
              onGenerateConcept={handleGenerateConcept}
              onViewConcept={(conceptId) => setActiveConceptId(conceptId)}
              onViewEvidence={(clusterId) => setEvidenceClusterId(clusterId)}
              generatingFor={generatingFor}
            />
          </section>
        </>
      )}

      {/* ── Market tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'market' && (
        <MarketTab
          clusters={clusters}
          onChartsUpdated={handleChartsUpdated}
          onWinningAppsUpdated={handleWinningAppsUpdated}
        />
      )}

      {/* ── Ranked Opportunities tab (placeholder) ─────────────────────────── */}
      {activeTab === 'ranked' && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-12 text-center text-white/25 text-sm">
          <p className="text-lg mb-2">🏆</p>
          <p className="font-medium mb-1">Ranked Opportunities</p>
          <p>Coming soon — activates once scoring is fully populated.</p>
        </div>
      )}

      {/* ── Modals (always rendered, not tab-scoped) ───────────────────────── */}
      {evidenceClusterId && (
        <EvidencePanel
          cluster={clusters.find((c) => c.id === evidenceClusterId)}
          signals={signals.filter((s) =>
            clusters.find((c) => c.id === evidenceClusterId)?.signalIds.includes(s.id),
          )}
          onClose={() => setEvidenceClusterId(null)}
        />
      )}

      {activeConceptId && (
        <ConceptView
          concept={concepts.find((c) => c.id === activeConceptId)}
          onClose={() => setActiveConceptId(null)}
        />
      )}
    </div>
  )
}
