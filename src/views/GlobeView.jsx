import { useState, useCallback } from 'react'
import FlowGlobe from '../flow-globe/FlowGlobe.jsx'
import { GlobeChat } from '../flow-globe/GlobeChat.jsx'
import { useGlobeState } from '../flow-globe/useGlobeState.js'

export default function GlobeView() {
  const { pins, arcs, labels, viewpoint, focusLabel, addPins, addArcs, flyTo } = useGlobeState()
  const [autoQuery, setAutoQuery] = useState(null)

  function handleGlobeClick({ lat, lng }) {
    const text = `What's at ${lat.toFixed(4)}, ${lng.toFixed(4)}?`
    setAutoQuery({ text, id: Date.now() })
  }

  const handleAutoQueryConsumed = useCallback(() => setAutoQuery(null), [])

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: '#05070f' }}>
      {/* Globe panel — 68% */}
      <div className="flex flex-col" style={{ width: '68%', minWidth: 0 }}>
        {/* Focus header */}
        <div
          className="flex-shrink-0 px-4 py-2 text-[12px] text-white/40 font-mono border-b border-white/[0.06] truncate"
          style={{ background: 'rgba(0,0,0,0.3)' }}
        >
          {focusLabel || 'Globe — click anywhere to explore'}
        </div>
        {/* Globe renderer */}
        <div className="flex-1 relative">
          <FlowGlobe
            pins={pins}
            arcs={arcs}
            labels={labels}
            viewpoint={viewpoint}
            onGlobeClick={handleGlobeClick}
          />
        </div>
      </div>

      {/* Chat panel — 32% */}
      <div
        className="flex flex-col border-l border-white/[0.07]"
        style={{ width: '32%', minWidth: '280px' }}
      >
        <GlobeChat
          addPins={addPins}
          addArcs={addArcs}
          flyTo={flyTo}
          autoQuery={autoQuery?.text ?? ''}
          onAutoQueryConsumed={handleAutoQueryConsumed}
        />
      </div>
    </div>
  )
}
