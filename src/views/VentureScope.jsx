import { useState, useCallback, useRef } from 'react'
import { RefreshCw, Telescope } from 'lucide-react'
import { useStore } from '../store/useStore.js'
import { ingestCorpus } from '../opportunity-radar/services/corpusIngestor.js'
import { extractSignals } from '../opportunity-radar/services/signalExtractor.js'
import { KeywordClusterer } from '../opportunity-radar/services/clusterService.js'
import { scoreOpportunity, collectDimensionDrivers } from '../opportunity-radar/services/opportunityScorer.js'
import { buildEntityRegistry } from '../opportunity-radar/services/entityNormalizer.js'
import { buildEntityGraph } from '../opportunity-radar/services/entityGraphBuilder.js'
import { generateConcepts } from '../opportunity-radar/services/conceptGenerator.js'
import { buildOpportunityFrame } from '../venture-scope/services/opportunityFrameBuilder.js'
// VS uses its own isolated storage — never touches fm_radar_* keys which
// may contain externally-scraped signals from the old Opportunity Radar.
import {
  loadVsSignals, appendVsSignals,
  loadVsClusters, saveVsClusters,
  loadVsConcepts, saveVsConcept,
  loadVsMeta, saveVsMeta,
  loadVsEntityGraph, saveVsEntityGraph,
} from '../venture-scope/storage/ventureScopeStorage.js'

import OverviewTab from '../components/venture-scope/tabs/OverviewTab.jsx'
import SignalsTab  from '../components/venture-scope/tabs/SignalsTab.jsx'
import ScoresTab   from '../components/venture-scope/tabs/ScoresTab.jsx'
import EvidenceTab from '../components/venture-scope/tabs/EvidenceTab.jsx'
import BriefTab    from '../components/venture-scope/tabs/BriefTab.jsx'
import CompareTab  from '../components/venture-scope/tabs/CompareTab.jsx'

const TABS = ['Overview', 'Signals', 'Scores', 'Evidence', 'Brief', 'Compare']

export default function VentureScope() {
  const store = useStore()

  const storeSlice = {
    saves:          store.saves          ?? {},
    documents:      store.documents      ?? {},
    manualContent:  store.manualContent  ?? {},
    topicSummaries: store.topicSummaries ?? {},
    userTopics:     store.userTopics     ?? {},
    briefs:         store.briefs         ?? {},
  }

  const [signals,     setSignals]     = useState(() => loadVsSignals())
  const [clusters,    setClusters]    = useState(() => loadVsClusters())
  const [entityGraph, setEntityGraph] = useState(() => loadVsEntityGraph())
  const [vsConcepts,  setVsConcepts]  = useState(() => loadVsConcepts())
  const [meta,        setMeta]        = useState(() => loadVsMeta())
  const [activeTab,   setActiveTab]   = useState('Overview')
  const [scanning,    setScanning]    = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [scanMsg,     setScanMsg]     = useState(null)
  const [selectedClusterId, setSelectedClusterId] = useState(null)
  const [selectedCandidate, setSelectedCandidate] = useState(null)

  const scanRef = useRef(false)

  const handleRegenerateConcept = useCallback(async (clusterId) => {
    if (regenerating) return
    if (!entityGraph) return
    const cluster = clusters.find((c) => c.id === clusterId)
    if (!cluster) return
    setRegenerating(true)
    try {
      const frame = buildOpportunityFrame(cluster, signals, entityGraph)
      const candidates = await generateConcepts(frame, 3)
      for (const candidate of candidates) {
        saveVsConcept(candidate)
      }
      const allConcepts = loadVsConcepts()
      setVsConcepts(allConcepts)
      setSelectedCandidate(null)  // reset to rank-1 so the regenerated brief shows
    } catch (err) {
      console.error('[VentureScope] regenerate failed', err)
    } finally {
      setRegenerating(false)
    }
  }, [regenerating, clusters, signals, entityGraph])

  const runScan = useCallback(async () => {
    if (scanRef.current) return
    scanRef.current = true
    setScanning(true)
    setScanMsg('Ingesting corpus…')

    try {
      // Step 1: Ingest corpus — pass the store slice so it reads live state
      const ingestSlice = {
        saves:            store.saves,
        documents:        store.documents,
        documentContents: store.documentContents,
        manualContent:    store.manualContent,
        topicSummaries:   store.topicSummaries,
        briefs:           store.briefs,
      }
      const rawItems = ingestCorpus(ingestSlice)

      // Step 2: Convert corpus items to signals.
      // Corpus signals bypass the intensity-3 threshold (they're curated research,
      // not raw social posts). All signals here have source='corpus'.
      setScanMsg(`Extracting signals from ${rawItems.length} corpus items…`)
      const newSignals = extractSignals(rawItems, 'corpus_scan')

      // Merge into VS-only signal store (fm_vs_signals) — never touches fm_radar_signals
      appendVsSignals(newSignals)
      const allSignals = loadVsSignals()
      setSignals(allSignals)

      // Step 3: Cluster signals (incremental — preserves existing VS clusters)
      setScanMsg('Clustering signals…')
      const existingClusters = loadVsClusters()
      const clusterer = new KeywordClusterer()
      const updatedClusters = clusterer.cluster(allSignals, existingClusters)

      // Step 4: Score each cluster
      setScanMsg('Scoring opportunities…')
      const scoredClusters = updatedClusters.map((cluster) => {
        const result  = scoreOpportunity(cluster, allSignals, [], [])
        const drivers = collectDimensionDrivers(cluster, allSignals)
        return {
          ...cluster,
          opportunityScore:  result.totalScore,
          gapScore:          result.gapScore,
          marketScore:       result.marketScore,
          buildabilityScore: result.buildabilityScore,
          inferredCategory:  result.inferredCategory,
          dimensionScores:   result.dimensionScores,
          isBuildable:       result.isBuildable,
          dimensionDrivers:  drivers,
        }
      })
      saveVsClusters(scoredClusters)
      setClusters(scoredClusters)

      // Step 5: Build entity graph from corpus signals only
      setScanMsg('Building entity graph…')
      const registry = buildEntityRegistry(allSignals)
      const graph = buildEntityGraph(registry)
      saveVsEntityGraph(graph)
      setEntityGraph(graph)

      // Step 6: Generate VentureConceptCandidates for top 5 clusters.
      // Each cluster gets an OpportunityFrame built from the entity graph so
      // candidates reason over structured graph context, not raw signal text.
      const top5 = [...scoredClusters]
        .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
        .slice(0, 5)

      setScanMsg(`Generating concepts for ${top5.length} opportunities…`)
      let generatedCount = 0
      for (const cluster of top5) {
        const frame = buildOpportunityFrame(cluster, allSignals, graph)
        const candidates = await generateConcepts(frame, 3)
        for (const candidate of candidates) {
          saveVsConcept(candidate)
          generatedCount++
        }
      }

      // Reload all concepts after generation
      const allConcepts = loadVsConcepts()
      setVsConcepts(allConcepts)

      // Step 7: Save meta
      const newMeta = {
        lastScanAt:    new Date().toISOString(),
        totalSignals:  allSignals.length,
        totalClusters: scoredClusters.length,
        totalConcepts: generatedCount,
      }
      saveVsMeta(newMeta)
      setMeta(newMeta)

      setScanMsg(`Done — ${allSignals.length} signals, ${scoredClusters.length} clusters, ${generatedCount} concepts`)
    } catch (err) {
      console.error('[VentureScope] scan failed', err)
      setScanMsg(`Scan error: ${err?.message ?? 'unknown error'}`)
    } finally {
      setScanning(false)
      scanRef.current = false
    }
  }, [store])

  // Derived state
  const selectedCluster = clusters.find((c) => c.id === selectedClusterId) ?? clusters[0] ?? null
  const leadingConcept = selectedCandidate
    ?? vsConcepts.find((c) => c.clusterId === selectedCluster?.id && c.rank === 1)
    ?? null
  const clusterCandidates = selectedCluster
    ? vsConcepts.filter((c) => c.clusterId === selectedCluster.id)
    : []

  const lastScanLabel = meta?.lastScanAt
    ? new Date(meta.lastScanAt).toLocaleString()
    : 'Never'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
        <div className="flex items-center gap-3">
          <Telescope className="w-5 h-5 text-[color:var(--color-creator)]" />
          <div>
            <h1 className="text-base font-semibold leading-tight">Venture Scope</h1>
            <p className="text-xs text-[color:var(--color-text-tertiary)]">
              Venture intelligence workspace
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[color:var(--color-text-tertiary)]">
            Last scan: {lastScanLabel}
          </span>
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning…' : 'Run scan'}
          </button>
        </div>
      </div>

      {/* Scan status message */}
      {scanMsg && (
        <div className="px-6 py-2 text-xs text-[color:var(--color-text-secondary)] bg-white/4 border-b border-white/6">
          {scanMsg}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 border-b border-white/8">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-3 py-2.5 text-xs font-medium transition-colors relative',
              activeTab === tab
                ? 'text-white'
                : 'text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]',
            ].join(' ')}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t" style={{ backgroundColor: 'var(--color-topic)' }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'Overview' && (
          <OverviewTab
            clusters={clusters}
            signals={signals}
            concepts={vsConcepts}
            meta={meta}
            entityGraph={entityGraph}
            onSelectCluster={setSelectedClusterId}
            onNavigateToTab={setActiveTab}
            onGenerateConcept={handleRegenerateConcept}
            isGenerating={regenerating}
            selectedClusterId={selectedClusterId}
          />
        )}
        {activeTab === 'Signals' && (
          <SignalsTab entityGraph={entityGraph} />
        )}
        {activeTab === 'Scores' && (
          <ScoresTab
            clusters={clusters}
            onSelectCluster={setSelectedClusterId}
            selectedClusterId={selectedClusterId}
          />
        )}
        {activeTab === 'Evidence' && (
          <EvidenceTab
            signals={signals}
            clusters={clusters}
            selectedClusterId={selectedClusterId}
            storeSlice={storeSlice}
          />
        )}
        {activeTab === 'Brief' && (
          <BriefTab
            concepts={vsConcepts}
            clusters={clusters}
            storeSlice={storeSlice}
            onRegenerateConcept={handleRegenerateConcept}
            isRegenerating={regenerating}
          />
        )}
        {activeTab === 'Compare' && (
          <CompareTab clusters={clusters} />
        )}
      </div>
    </div>
  )
}
