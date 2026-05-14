# Globe View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/globe` route with a 3D wireframe globe (react-globe.gl), an AI chat panel that calls Google Maps MCP tools via the daemon, and real-time globe updates driven by `<globe-pins>` / `<globe-arcs>` blocks parsed from AI responses.

**Architecture:** `GlobeView.jsx` is the page root with a two-panel layout (globe left, chat right). `FlowGlobe.jsx` wraps react-globe.gl and is entirely prop-driven. `GlobeChat.jsx` streams to Ollama, executes daemon tool calls, parses globe update blocks, and pushes coordinates to shared state via callbacks. `useGlobeState.js` owns all globe data. Route + nav are wired last.

**Tech Stack:** React 18, react-globe.gl ^2.x (Three.js WebGL), Tailwind CSS, existing `daemonTools.js` + `mcpTools.js` bridge, `streamChat` from `src/lib/llm/ollama.js`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/flow-globe/useGlobeState.js` | Create | Pins / arcs / labels / viewpoint state and mutators |
| `src/flow-globe/FlowGlobe.jsx` | Create | react-globe.gl renderer, wireframe texture, auto-rotate |
| `src/flow-globe/GlobeChat.jsx` | Create | AI chat, tool calls, globe-pins / globe-arcs protocol |
| `src/views/GlobeView.jsx` | Create | Page root, two-panel layout, click-to-query wiring |
| `src/App.jsx` | Modify | Add GlobeView lazy import, /globe route, WORKSPACE_ROUTES |
| `src/components/layout/LeftRail.jsx` | Modify | Add Globe nav entry below Flow Trade |

---

### Task 1: Install react-globe.gl

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the packages**

Run from `C:\Users\JenoU\Desktop\FlowMap`:

```bash
npm install react-globe.gl three
```

Expected: `added N packages` with no peer-dependency errors. Both `react-globe.gl` and `three` appear in `package.json` under `dependencies`.

- [ ] **Step 2: Verify the dev server still starts**

```bash
npm run dev
```

Expected: Vite starts on http://localhost:5173 with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(globe): install react-globe.gl + three"
```

---

### Task 2: Create useGlobeState.js

**Files:**
- Create: `src/flow-globe/useGlobeState.js`

- [ ] **Step 1: Create the file**

```javascript
// src/flow-globe/useGlobeState.js
import { useState, useCallback } from 'react'

const MAX_PINS = 200
const MAX_ARCS = 50

export function useGlobeState() {
  const [pins,       setPins]       = useState([])
  const [arcs,       setArcs]       = useState([])
  const [labels,     setLabels]     = useState([])
  const [viewpoint,  setViewpoint]  = useState(null)
  const [focusLabel, setFocusLabel] = useState('')

  const addPins = useCallback((newPins) => {
    setPins((prev)   => [...prev, ...newPins].slice(-MAX_PINS))
    setLabels((prev) => [
      ...prev,
      ...newPins.map((p) => ({ lat: p.lat, lng: p.lng, text: p.label ?? '' })),
    ].slice(-MAX_PINS))
  }, [])

  const addArcs = useCallback((newArcs) => {
    setArcs((prev) => [...prev, ...newArcs].slice(-MAX_ARCS))
  }, [])

  const clearAll = useCallback(() => {
    setPins([])
    setArcs([])
    setLabels([])
    setViewpoint(null)
    setFocusLabel('')
  }, [])

  const flyTo = useCallback(({ lat, lng, altitude = 1.8, label = '' }) => {
    setViewpoint({ lat, lng, altitude })
    if (label) setFocusLabel(label)
  }, [])

  return { pins, arcs, labels, viewpoint, focusLabel, addPins, addArcs, clearAll, flyTo }
}
```

- [ ] **Step 2: Verify dev server**

```bash
npm run dev
```

Expected: starts cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/flow-globe/useGlobeState.js
git commit -m "feat(globe): add useGlobeState shared state hook"
```

---

### Task 3: Create FlowGlobe.jsx

**Files:**
- Create: `src/flow-globe/FlowGlobe.jsx`

Context: `react-globe.gl` exports a default `Globe` component. String-key props (e.g. `pointLat="lat"`) tell it which field to read from data objects. `globeRef.current.pointOfView({lat,lng,altitude}, ms)` animates the camera. `globeRef.current.controls()` returns the Three.js OrbitControls instance. `showGraticules` draws lat/lng grid lines — the wireframe overlay.

- [ ] **Step 1: Create the file**

```jsx
// src/flow-globe/FlowGlobe.jsx
import { useEffect, useRef } from 'react'
import Globe from 'react-globe.gl'

const GLOBE_IMAGE = 'https://unpkg.com/three-globe/example/img/earth-natural.jpg'
const BUMP_IMAGE  = 'https://unpkg.com/three-globe/example/img/earth-topology.png'

export function FlowGlobe({ pins = [], arcs = [], labels = [], viewpoint, onGlobeClick }) {
  const globeRef = useRef(null)

  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    const controls = g.controls()
    controls.autoRotate      = !viewpoint
    controls.autoRotateSpeed = 0.3
    controls.enableDamping   = true
    controls.dampingFactor   = 0.1
  }, [viewpoint])

  useEffect(() => {
    if (!viewpoint || !globeRef.current) return
    globeRef.current.pointOfView(
      { lat: viewpoint.lat, lng: viewpoint.lng, altitude: viewpoint.altitude },
      1200,
    )
  }, [viewpoint])

  return (
    <Globe
      ref={globeRef}
      globeImageUrl={GLOBE_IMAGE}
      bumpImageUrl={BUMP_IMAGE}
      showGraticules
      showAtmosphere
      atmosphereColor="rgba(30,120,255,0.12)"
      atmosphereAltitude={0.15}
      backgroundColor="#05070f"
      pointsData={pins}
      pointLat="lat"
      pointLng="lng"
      pointLabel="label"
      pointColor={() => 'rgba(52,211,153,0.9)'}
      pointAltitude={0.015}
      pointRadius={0.4}
      pointsMerge={false}
      arcsData={arcs}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcLabel="label"
      arcColor={() => ['rgba(20,184,166,0.6)', 'rgba(99,102,241,0.6)']}
      arcAltitudeAutoScale={0.35}
      arcDashLength={0.4}
      arcDashGap={0.2}
      arcDashAnimateTime={1500}
      arcStroke={0.5}
      labelsData={labels}
      labelLat="lat"
      labelLng="lng"
      labelText="text"
      labelSize={1.2}
      labelColor={() => 'rgba(255,255,255,0.85)'}
      labelDotRadius={0.3}
      labelAltitude={0.018}
      labelResolution={3}
      onGlobeClick={({ lat, lng }) => onGlobeClick?.({ lat, lng })}
    />
  )
}
```

- [ ] **Step 2: Verify dev server**

```bash
npm run dev
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/flow-globe/FlowGlobe.jsx
git commit -m "feat(globe): add FlowGlobe WebGL renderer"
```

---

### Task 4: Create GlobeChat.jsx

**Files:**
- Create: `src/flow-globe/GlobeChat.jsx`

Context: Mirrors `src/flow-trade/FlowTradeChat.jsx`. Uses `streamChat` from `src/lib/llm/ollama.js`, daemon tool helpers from `src/lib/chat/daemonTools.js`, and `buildToolSystemBlock` + `processToolCalls` from `src/lib/chat/mcpTools.js`. The globe-pins/arcs blocks are stripped from displayed text. After a tool-call round, a custom follow-up prompt asks the AI to emit these blocks. `sendMessageRef` keeps the autoQuery effect from capturing stale closures.

- [ ] **Step 1: Create the file**

```jsx
// src/flow-globe/GlobeChat.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Globe, Loader2, Trash2 } from 'lucide-react'
import { streamChat } from '../lib/llm/ollama.js'
import {
  fetchDaemonTools,
  buildDaemonToolMap,
  daemonToolToMCPShape,
} from '../lib/chat/daemonTools.js'
import { buildToolSystemBlock, processToolCalls } from '../lib/chat/mcpTools.js'

const GLOBE_PINS_RE = /<globe-pins>([\s\S]*?)<\/globe-pins>/g
const GLOBE_ARCS_RE = /<globe-arcs>([\s\S]*?)<\/globe-arcs>/g

function parseGlobeBlocks(text) {
  const pins = []
  const arcs = []
  GLOBE_PINS_RE.lastIndex = 0
  GLOBE_ARCS_RE.lastIndex = 0
  let m
  while ((m = GLOBE_PINS_RE.exec(text)) !== null) {
    try { pins.push(...JSON.parse(m[1].trim())) } catch {}
  }
  while ((m = GLOBE_ARCS_RE.exec(text)) !== null) {
    try { arcs.push(...JSON.parse(m[1].trim())) } catch {}
  }
  GLOBE_PINS_RE.lastIndex = 0
  GLOBE_ARCS_RE.lastIndex = 0
  const cleaned = text
    .replace(GLOBE_PINS_RE, '')
    .replace(GLOBE_ARCS_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { pins, arcs, cleaned }
}

const SYSTEM = `You are Globe.AI, controlling an interactive 3D globe inside FlowMap.

When the user asks about places, routes, or anything geographic:
1. Call the appropriate Google Maps MCP tool to get location data.
2. After receiving results, emit a <globe-pins> or <globe-arcs> block so the globe updates.
3. Reply in 2-3 sentences summarising what you found.

Globe update formats (invisible to the user - never describe or mention these tags):
  <globe-pins>[{"lat":35.68,"lng":139.69,"label":"Tokyo"},{"lat":34.69,"lng":135.50,"label":"Osaka"}]</globe-pins>
  <globe-arcs>[{"startLat":51.5,"startLng":-0.12,"endLat":48.85,"endLng":2.35,"label":"London to Paris"}]</globe-arcs>

Rules:
- Always emit a <globe-pins> block whenever you have coordinates to show.
- Emit <globe-arcs> only when showing a route or connection between two points.
- Keep responses concise - 2-3 sentences max unless the user asks for more.
- Never use markdown code blocks or backticks.
- Never mention or describe the XML tags.`

function renderText(text) {
  return text.split('\n').map((line, i, arr) => (
    <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
  ))
}

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2 px-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center mt-0.5">
          <Globe size={11} className="text-teal-400" />
        </div>
      )}
      <div className={`max-w-[85%] text-[12px] leading-relaxed rounded-xl px-3 py-2 ${
        isUser
          ? 'bg-white/[0.08] text-white/80 rounded-br-sm'
          : 'bg-white/[0.04] text-white/70 rounded-bl-sm'
      }`}>
        {msg.content ? renderText(msg.content) : <span className="opacity-40">...</span>}
      </div>
    </div>
  )
}

export function GlobeChat({
  onPins, onArcs, onFlyTo, onClearAll,
  autoQuery, onAutoQueryConsumed,
}) {
  const [messages,    setMessages]    = useState([])
  const [input,       setInput]       = useState('')
  const [streaming,   setStreaming]   = useState(false)
  const [daemonTools, setDaemonTools] = useState([])
  const daemonToolMapRef = useRef(new Map())
  const sendMessageRef   = useRef(null)
  const bottomRef        = useRef(null)
  const abortRef         = useRef(null)

  useEffect(() => {
    fetchDaemonTools().then((tools) => {
      setDaemonTools(tools)
      daemonToolMapRef.current = buildDaemonToolMap(tools)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!autoQuery) return
    sendMessageRef.current?.(autoQuery, true)
    onAutoQueryConsumed?.()
  }, [autoQuery, onAutoQueryConsumed])

  const sendMessage = useCallback(async (text, auto = false) => {
    const content = (text ?? input).trim()
    if (!content || streaming) return
    if (!auto) setInput('')

    const mcpTools = daemonTools.map(daemonToolToMCPShape)
    const toolBlock = buildToolSystemBlock(mcpTools)
    const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant')
    const llmMessages = [
      { role: 'system', content: toolBlock ? `${SYSTEM}\n\n${toolBlock}` : SYSTEM },
      ...history,
      { role: 'user', content },
    ]

    setMessages((prev) => [...prev, { role: 'user', content }])
    setStreaming(true)
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    const ctrl = new AbortController()
    abortRef.current = ctrl
    let assistantText = ''

    try {
      for await (const token of streamChat(llmMessages, { signal: ctrl.signal, temperature: 0.3, num_ctx: 8192 })) {
        if (ctrl.signal.aborted) break
        assistantText += token
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantText }
          return updated
        })
      }

      if (mcpTools.length > 0 && assistantText.includes('<tool_call>') && !ctrl.signal.aborted) {
        try {
          const { hasToolCalls, processedText, toolResultBlock } = await processToolCalls(
            assistantText,
            daemonToolMapRef.current,
          )
          if (hasToolCalls && !ctrl.signal.aborted) {
            const ctrl2 = new AbortController()
            abortRef.current = ctrl2
            const followUp = [
              ...llmMessages,
              { role: 'assistant', content: processedText },
              {
                role: 'user',
                content: `${toolResultBlock}\n\nUsing the above data, reply in 2-3 sentences. Emit <globe-pins> or <globe-arcs> blocks for any coordinates found.`,
              },
            ]
            let followText = ''
            try {
              for await (const token of streamChat(followUp, { signal: ctrl2.signal, temperature: 0.3, num_ctx: 8192 })) {
                if (ctrl2.signal.aborted) break
                followText += token
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: followText }
                  return updated
                })
              }
            } catch {}
            if (followText) assistantText = followText
          }
        } catch {}
      }

      const { pins, arcs, cleaned } = parseGlobeBlocks(assistantText)

      if (pins.length > 0) {
        onPins?.(pins)
        onFlyTo?.({
          lat:      pins[0].lat,
          lng:      pins[0].lng,
          altitude: pins.length > 3 ? 2.5 : 1.8,
          label:    pins[0].label ?? '',
        })
      }
      if (arcs.length > 0) onArcs?.(arcs)

      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: cleaned }
        return updated
      })
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [input, streaming, messages, daemonTools, onPins, onArcs, onFlyTo])

  sendMessageRef.current = sendMessage

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Globe size={12} className="text-teal-400" />
          <span className="text-[12px] font-medium text-white/60">Globe.AI</span>
        </div>
        <button
          onClick={() => { setMessages([]); onClearAll?.() }}
          className="p-1 rounded text-white/20 hover:text-rose-400 transition-colors"
          title="Clear globe and chat"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center px-4">
            <Globe size={22} className="text-white/15" />
            <div className="text-[11px] text-white/25 leading-relaxed">
              Ask about places, routes, or companies - or click anywhere on the globe to identify it.
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <Message key={i} msg={msg} />)
        )}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex gap-2 px-2">
            <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center mt-0.5 flex-shrink-0">
              <Loader2 size={11} className="text-teal-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.06] p-2 flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          placeholder="Ask about any place, route, or location..."
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[12px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-white/20 disabled:opacity-40"
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || streaming}
          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-white/50 hover:text-white/80 disabled:opacity-30 transition-colors"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify dev server**

```bash
npm run dev
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/flow-globe/GlobeChat.jsx
git commit -m "feat(globe): add GlobeChat with globe-pins/arcs protocol"
```

---

### Task 5: Create GlobeView.jsx

**Files:**
- Create: `src/views/GlobeView.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/views/GlobeView.jsx
import { useState } from 'react'
import { Globe as GlobeIcon } from 'lucide-react'
import { FlowGlobe } from '../flow-globe/FlowGlobe.jsx'
import { GlobeChat } from '../flow-globe/GlobeChat.jsx'
import { useGlobeState } from '../flow-globe/useGlobeState.js'

export default function GlobeView() {
  const {
    pins, arcs, labels, viewpoint, focusLabel,
    addPins, addArcs, clearAll, flyTo,
  } = useGlobeState()

  const [autoQuery, setAutoQuery] = useState(null)

  function handleGlobeClick({ lat, lng }) {
    setAutoQuery(`What's at ${lat.toFixed(4)}, ${lng.toFixed(4)}?`)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
        <GlobeIcon size={18} className="text-teal-400" />
        <div>
          <div className="text-[15px] font-semibold text-white/85 leading-none">Globe</div>
          <div className="text-[11px] text-white/35 mt-0.5">
            {focusLabel || 'interactive world map'}
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <FlowGlobe
            pins={pins}
            arcs={arcs}
            labels={labels}
            viewpoint={viewpoint}
            onGlobeClick={handleGlobeClick}
          />
        </div>

        <div
          className="w-[280px] flex-shrink-0 border-l border-white/[0.05] flex flex-col"
          style={{ background: 'rgba(0,0,0,0.28)' }}
        >
          <GlobeChat
            onPins={addPins}
            onArcs={addArcs}
            onFlyTo={flyTo}
            onClearAll={clearAll}
            autoQuery={autoQuery}
            onAutoQueryConsumed={() => setAutoQuery(null)}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify dev server**

```bash
npm run dev
```

Expected: no errors. Page not reachable yet.

- [ ] **Step 3: Commit**

```bash
git add src/views/GlobeView.jsx
git commit -m "feat(globe): add GlobeView page layout"
```

---

### Task 6: Register route, WORKSPACE_ROUTES, and nav entry

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/components/layout/LeftRail.jsx`

- [ ] **Step 1: Add lazy import in App.jsx**

Find:
```js
const FlowTrade = lazy(() => import('./views/FlowTrade.jsx'))
```

Add immediately after:
```js
const GlobeView = lazy(() => import('./views/GlobeView.jsx'))
```

- [ ] **Step 2: Add /globe to WORKSPACE_ROUTES**

Find:
```js
const WORKSPACE_ROUTES = ['/flow-trade']
```

Replace with:
```js
const WORKSPACE_ROUTES = ['/flow-trade', '/globe']
```

This gives /globe the same `h-full overflow-hidden` treatment as Flow Trade — required so the globe fills its panel correctly.

- [ ] **Step 3: Add the Route**

Find:
```jsx
<Route path="/flow-trade" element={<FlowTrade />} />
```

Add immediately after:
```jsx
<Route path="/globe" element={<GlobeView />} />
```

- [ ] **Step 4: Add Globe to lucide imports in LeftRail.jsx**

Find:
```jsx
import {
  BookOpen, LayoutDashboard, Brain, FileText, Bot, Compass,
  Plug, Activity, Radar, GraduationCap, Code2,
  TrendingUp, ChevronLeft, ChevronRight,
} from 'lucide-react'
```

Replace with:
```jsx
import {
  BookOpen, LayoutDashboard, Brain, FileText, Bot, Compass,
  Plug, Activity, Radar, GraduationCap, Code2,
  TrendingUp, Globe, ChevronLeft, ChevronRight,
} from 'lucide-react'
```

- [ ] **Step 5: Add Globe nav entry**

Find:
```js
  [
    { to: '/flow-trade', label: 'Flow Trade', icon: TrendingUp },
  ],
```

Replace with:
```js
  [
    { to: '/flow-trade', label: 'Flow Trade', icon: TrendingUp },
    { to: '/globe',      label: 'Globe',      icon: Globe      },
  ],
```

- [ ] **Step 6: Verify in browser**

```bash
npm run dev
```

1. Open http://localhost:5173
2. Confirm "Globe" nav entry appears below "Flow Trade"
3. Click it — globe auto-rotates on the left, Globe.AI chat on the right
4. Header shows "interactive world map"
5. Click anywhere on the globe — chat auto-populates with "What's at X, Y?" and submits
6. (With daemon running) Type "show me airports in London" — globe flies to London, drops emerald pins

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/components/layout/LeftRail.jsx
git commit -m "feat(globe): register /globe route and nav entry"
```
