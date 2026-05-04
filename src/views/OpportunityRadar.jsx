import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Radar } from 'lucide-react'
import RadarTopCard  from '../components/opportunity/RadarTopCard.jsx'
import PatternTable  from '../components/opportunity/PatternTable.jsx'
import ConceptView   from '../components/opportunity/ConceptView.jsx'
import EvidencePanel from '../components/opportunity/EvidencePanel.jsx'
import radarStorage  from '../opportunity-radar/storage/radarStorage.js'
import { runPainSearch }  from '../opportunity-radar/services/painSearchService.js'
import { extractSignals } from '../opportunity-radar/services/signalExtractor.js'
import { KeywordClusterer } from '../opportunity-radar/services/clusterService.js'
import { getTop3, scoreCluster, applyBuildabilityFilter } from '../opportunity-radar/services/opportunityScorer.js'
import { generateConcept } from '../opportunity-radar/services/conceptGenerator.js'

const SCAN_STALE_MS = 6 * 60 * 60 * 1000   // 6 hours

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

export default function OpportunityRadar() {
  const [signals,        setSignals]        = useState(() => radarStorage.loadSignals())
  const [clusters,       setClusters]       = useState(() => radarStorage.loadClusters())
  const [concepts,       setConcepts]       = useState(() => radarStorage.loadConcepts())
  const [meta,           setMeta]           = useState(() => radarStorage.loadMeta())
  const [scanning,       setScanning]       = useState(false)
  const [progress,       setProgress]       = useState([])
  const [activeConceptId, setActiveConceptId] = useState(null)
  const [evidenceClusterId, setEvidenceClusterId] = useState(null)
  const [generatingFor,  setGeneratingFor]  = useState(null)

  const top3 = getTop3(clusters, signals)

  // ── Scan pipeline ───────────────────────────────────────────────────────────

  const triggerScan = useCallback(async () => {
    if (scanning) return
    setScanning(true)
    setProgress([])
    const start = Date.now()

    try {
      const rawResults = await runPainSearch(
        ['reddit', 'hackernews', 'youtube'],
        (p) => setProgress((prev) => {
          const existing = prev.findIndex((x) => x.source === p.source)
          if (existing >= 0) { const next = [...prev]; next[existing] = p; return next }
          return [...prev, p]
        }),
      )

      // queryUsed is not part of RawSearchResult — pass all results at once with empty query
      const newSignals = extractSignals(rawResults, '')

      radarStorage.appendSignals(newSignals)
      const allSignals = radarStorage.loadSignals()

      const clusterer    = new KeywordClusterer()
      const existingClusters = radarStorage.loadClusters()
      const newClusters  = clusterer.cluster(allSignals, existingClusters)

      const scored = newClusters.map((c) => {
        const isBuildable = applyBuildabilityFilter(c, allSignals)
        const withB = { ...c, isBuildable }
        return { ...withB, opportunityScore: scoreCluster(withB, allSignals) }
      })

      radarStorage.saveClusters(scored)
      const newMeta = {
        lastScanAt:     new Date().toISOString(),
        totalSignals:   allSignals.length,
        totalClusters:  scored.length,
        scanDurationMs: Date.now() - start,
      }
      radarStorage.saveMeta(newMeta)

      setSignals(allSignals)
      setClusters(scored)
      setConcepts(radarStorage.loadConcepts())
      setMeta(newMeta)
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

      {/* Zone 1: Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Radar className="w-6 h-6 text-teal-400" />
          <h1 className="text-xl font-semibold">Opportunity Radar</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40">
            Last scan: {formatAge(meta?.lastScanAt)}
          </span>
          {meta?.totalSignals > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-400/10 text-teal-400">
              {meta.totalSignals} signals · {meta.totalClusters} patterns
            </span>
          )}
        </div>
        <button
          onClick={triggerScan}
          disabled={scanning}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-400/20
            hover:bg-teal-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning…' : '↻ Run Scan'}
        </button>
      </div>

      {/* Scan progress */}
      {scanning && progress.length > 0 && (
        <div className="flex gap-3 mb-4 flex-wrap">
          {progress.map((p) => (
            <span key={p.source} className={`text-xs px-2 py-1 rounded-full ${
              p.status === 'done'    ? 'bg-green-400/10 text-green-400' :
              p.status === 'error'  ? 'bg-red-400/10 text-red-400' :
              'bg-white/5 text-white/40'
            }`}>
              {p.source} {p.status === 'done' ? `✓ ${p.resultCount}` : p.status === 'error' ? '✗' : '…'}
            </span>
          ))}
        </div>
      )}

      {/* Zone 2: Top 3 */}
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

      {/* Evidence modal */}
      {evidenceClusterId && (
        <EvidencePanel
          cluster={clusters.find((c) => c.id === evidenceClusterId)}
          signals={signals.filter((s) =>
            clusters.find((c) => c.id === evidenceClusterId)?.signalIds.includes(s.id),
          )}
          onClose={() => setEvidenceClusterId(null)}
        />
      )}

      {/* Concept modal — covers top-3 and PatternTable clicks */}
      {activeConceptId && (
        <ConceptView
          concept={concepts.find((c) => c.id === activeConceptId)}
          onClose={() => setActiveConceptId(null)}
        />
      )}

      {/* Zone 3: All patterns */}
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
    </div>
  )
}
