import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Maximize2, Minimize2 } from 'lucide-react'
import FlowGraph from '../components/flow/FlowGraph.jsx'
import PipelineStrip from '../components/flow/PipelineStrip.jsx'
import GlassSidebar from '../components/flow/GlassSidebar.jsx'
import KpiRow from '../components/flow/KpiRow.jsx'
import ConnectedSources from '../components/flow/ConnectedSources.jsx'
import DerivedSignals from '../components/flow/DerivedSignals.jsx'
import InterestMemoryPanel from '../components/flow/InterestMemoryPanel.jsx'
import VideoPlayerModal from '../components/content/VideoPlayerModal.jsx'
import ArticleReader from '../components/content/ArticleReader.jsx'
import { useGraph } from '../store/useGraph.js'
import { useLearning } from '../store/useLearning.js'
import { useSeed } from '../store/useSeed.js'
import { useStore } from '../store/useStore.js'

export default function FlowMap() {
  const navigate = useNavigate()
  const { nodes, edges } = useGraph()
  const patterns = useLearning()
  const { topics, content, contentById } = useSeed()
  const { saves, follows } = useStore()

  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [openVideo, setOpenVideo] = useState(null)
  const [openArticle, setOpenArticle] = useState(null)

  // Fullscreen state machine: idle → expanding → full → shrinking → idle
  const FS_DURATION = 420
  const networkRef = useRef(null)
  const [fsPhase, setFsPhase] = useState('idle')
  const [capturedRect, setCapturedRect] = useState(null)
  const isFs = fsPhase !== 'idle'

  function enterFullscreen() {
    if (fsPhase !== 'idle') return
    const el = networkRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCapturedRect({
      top: r.top,
      left: r.left,
      right: window.innerWidth - r.right,
      bottom: window.innerHeight - r.bottom,
    })
    setFsPhase('expanding')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFsPhase('full'))
    })
  }

  function exitFullscreen() {
    if (fsPhase !== 'full') return
    setFsPhase('shrinking')
    setTimeout(() => {
      setFsPhase('idle')
      setCapturedRect(null)
    }, FS_DURATION)
  }

  useEffect(() => {
    if (fsPhase !== 'full') return
    function onKey(e) { if (e.key === 'Escape') exitFullscreen() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fsPhase])

  const fsTransition = `top ${FS_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), left ${FS_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), right ${FS_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), bottom ${FS_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1), border-radius ${FS_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`

  const networkStyle = !isFs
    ? {
        position: 'relative',
        width: '100%',
        height: '100%',
        background: '#05070f',
        borderColor: 'rgba(255,255,255,0.07)',
        borderRadius: '1rem',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      }
    : {
        position: 'fixed',
        zIndex: 100,
        background: '#05070f',
        borderColor: 'rgba(255,255,255,0.07)',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        transition: fsTransition,
        ...(fsPhase === 'full'
          ? { top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 }
          : {
              top: capturedRect?.top ?? 0,
              left: capturedRect?.left ?? 0,
              right: capturedRect?.right ?? 0,
              bottom: capturedRect?.bottom ?? 0,
              borderRadius: '1rem',
            }),
      }

  function onNodeClick(id) {
    if (!id) { setSelectedNodeId(null); return }
    const node = nodes.find((n) => n.id === id)
    if (!node) return
    if (node.type === 'video') {
      setOpenVideo(contentById(id))
      return
    }
    if (node.type === 'article') {
      setOpenArticle(contentById(id))
      return
    }
    if (node.type === 'topic') {
      navigate(`/topic/${id.replace('topic_', '')}`)
      return
    }
    setSelectedNodeId(id)
  }

  const followedCount = Object.keys(follows).length
  const savedCount = Object.keys(saves).length
  const videos   = content.filter((c) => c.type === 'video').length
  const articles = content.filter((c) => c.type === 'article').length
  const posts    = content.filter((c) => c.type === 'social_post').length

  const kpis = [
    { label: 'Followed topics', value: followedCount, sub: `of ${topics.length}` },
    { label: 'Items this week', value: content.length, sub: 'in the seed' },
    { label: 'Saved items',     value: savedCount, live: savedCount > 0 },
    { label: 'Sources tracked', value: 1, sub: 'YouTube · v1.1 expands' },
    { label: 'Videos',          value: videos },
    { label: 'Articles',        value: articles },
    { label: 'Posts',           value: posts },
  ]

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flow Map</h1>
          <p className="text-sm text-[color:var(--color-text-secondary)] mt-1 max-w-2xl">
            The relational context network for your topic intelligence — typed, weighted, and learning from what you save and view.
          </p>
        </div>
        <span className="chip border-[color:var(--color-creator)]/40 bg-[color:var(--color-creator)]/10 text-[color:var(--color-creator)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-creator)] animate-pulse" />
          Live · seed
        </span>
      </header>

      <PipelineStrip counts={{ discover: 1, parse: content.length, classify: edges.length, retain: savedCount }} />

      <div className="relative" style={{ height: 640 }}>
        <div
          ref={networkRef}
          className="flex flex-col overflow-hidden border"
          style={networkStyle}
        >
          <GlassSidebar
            nodes={nodes}
            edges={edges}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
          />
          <div className="px-6 h-12 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
            <h2 className="text-[13px] font-semibold text-white/70 tracking-wide">Network</h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/30">Drag to rotate · Shift+drag to pan · Click a node to inspect</span>
              <button
                onClick={isFs ? exitFullscreen : enterFullscreen}
                className="text-white/40 hover:text-white/80 transition-colors p-1 rounded hover:bg-white/5"
                aria-label={isFs ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {fsPhase === 'full' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <FlowGraph
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              onNodeClick={onNodeClick}
            />
          </div>
        </div>
      </div>

      <KpiRow items={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConnectedSources />
        <DerivedSignals patterns={patterns} />
      </div>

      <InterestMemoryPanel />

      <VideoPlayerModal item={openVideo} onClose={() => setOpenVideo(null)} />
      <ArticleReader item={openArticle} onClose={() => setOpenArticle(null)} />
    </div>
  )
}
