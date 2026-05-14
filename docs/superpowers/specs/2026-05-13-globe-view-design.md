# Globe View Design

**Date:** 2026-05-13
**Status:** Approved

---

## Goal

Add a `/globe` route to FlowMap — a full-screen interactive 3D globe with a wireframe-over-texture aesthetic, powered by `react-globe.gl`, where both the user and Flow AI can interact with it via Google Maps MCP tools.

## Architecture

Two-panel full-height layout:
- **Left 68%** — WebGL globe renderer (`FlowGlobe.jsx`)
- **Right 32%** — AI chat panel (`GlobeChat.jsx`)

Shared state lives in `useGlobeState.js` (a custom hook). `GlobeView.jsx` is the page root that wires them together.

```
src/
  views/
    GlobeView.jsx           ← page root, layout, LeftRail nav entry
  flow-globe/
    FlowGlobe.jsx           ← react-globe.gl renderer
    GlobeChat.jsx           ← AI chat panel (streaming + tool calls)
    useGlobeState.js        ← shared pins / arcs / labels / viewpoint state
```

---

## Section 1 — Page Layout & Navigation

- New route `/globe` registered in `src/App.jsx`
- New nav entry in `src/components/layout/LeftRail.jsx` (Globe icon, label "Globe", between Flow Trade and the bottom Connections group)
- Full-height two-panel layout — globe left, chat right
- Thin header bar above the globe shows current focus point: e.g. *"Tokyo, Japan"* or *"36.2° N, 137.1° E"* — updates as the AI flies the camera

---

## Section 2 — Globe Renderer (FlowGlobe.jsx)

**Library:** `react-globe.gl` — single `npm install react-globe.gl`.

**Visual configuration:**
- `globeImageUrl` → NASA Natural Earth II texture (public domain, no API key)
- `showGraticules={true}` → lat/lng grid lines in dim teal — the wireframe overlay
- `showAtmosphere={true}` → soft outer glow ring
- Background colour: `#05070f` (FlowMap deep canvas)
- Auto-rotation: `0.3°/sec`, pauses when a `focusPoint` is set, resumes after 10s idle

**Data layers (all prop-driven from `useGlobeState`):**

| Layer | Props | Visual |
|---|---|---|
| Points | `pointsData` | Emerald altitude spikes with dot cap |
| Arcs | `arcsData` | Animated teal arc with glow, dash animation |
| Labels | `labelsData` | White floating text above each pin |

**Interaction:**
- Click anywhere on the globe surface → emits `{ lat, lng }` to a `onGlobeClick` callback
- `GlobeView` intercepts this and pre-fills GlobeChat input with `"What's at [lat], [lng]?"`

**Focus animation:**
```js
globeRef.current.pointOfView({ lat, lng, altitude: 1.8 }, 1200)
```
Called whenever `useGlobeState.viewpoint` changes (AI sets it after geocoding a location).

---

## Section 3 — GlobeChat & AI Integration

**GlobeChat.jsx** mirrors `FlowTradeChat` in structure: local `messages` state, `streamChat` for token streaming, `fetchDaemonTools` + `buildDaemonToolMap` loaded on mount.

### System prompt

```
You control an interactive 3D globe inside FlowMap. When the user asks about
places, companies, routes, or anything geographic, call the appropriate
Google Maps MCP tool. After getting results, emit a <globe-pins> or
<globe-arcs> block so the globe updates automatically. Keep replies to 2–3
sentences unless the user asks for more detail. Never use markdown code blocks.
```

### `<globe-pins>` protocol

After a tool call returns location data, the AI emits a structured block alongside its reply:

```
<globe-pins>[{"lat":35.68,"lng":139.69,"label":"Tokyo","color":"emerald"}]</globe-pins>
```

`GlobeChat` post-processes every completed assistant message:
1. Extract all `<globe-pins>` blocks with a regex
2. Parse the JSON array
3. Call `addPins(parsed)` from `useGlobeState`
4. Strip the blocks from the displayed text (user never sees raw XML)

Same pattern for `<globe-arcs>` (directions tool results):
```
<globe-arcs>[{"startLat":51.5,"startLng":-0.12,"endLat":48.8,"endLng":2.35,"label":"London → Paris"}]</globe-arcs>
```

### Google Maps MCP tools

| Tool name | Triggered by |
|---|---|
| `maps_geocode` | "fly to X", "where is X", "show me X" |
| `maps_search_places` | "show airports / hotels / companies in X" |
| `maps_directions` | "route from X to Y", "how do I get from X to Y" |
| `maps_reverse_geocode` | user clicks globe → auto-query |
| `maps_place_details` | user clicks a pin |

### Click-to-query flow

1. User clicks globe surface → `onGlobeClick({ lat, lng })`
2. `GlobeView` calls `setChatInput("What's at [lat], [lng]?")` and auto-submits
3. AI calls `maps_reverse_geocode` → identifies location
4. AI replies with place info and emits `<globe-pins>` to drop a pin

---

## Section 4 — Globe State (useGlobeState.js)

```js
{
  pins:      [],   // [{ lat, lng, label, color, altitude? }]
  arcs:      [],   // [{ startLat, startLng, endLat, endLng, label, color? }]
  labels:    [],   // [{ lat, lng, text, size? }]
  viewpoint: null, // { lat, lng, altitude } — null = auto-rotate
  focusLabel: '',  // shown in header, e.g. "Tokyo, Japan"
}
```

**Actions:**
- `addPins(newPins)` — append, cap at 200 total
- `addArcs(newArcs)` — append, cap at 50 total
- `clearAll()` — reset pins/arcs/labels (clear button in chat header)
- `setViewpoint({ lat, lng, altitude, label })` — fly camera + update focus label

---

## Dependencies

```
react-globe.gl   ^2.x   (WebGL globe renderer)
```

No API key required for the renderer. Google Maps MCP tools require the existing daemon Google Maps MCP server (already enabled in user's setup).

---

## Non-goals

- No street-level tile rendering (MapLibre/Mapbox style)
- No user authentication or saved globe sessions
- No offline map tiles
- No GeoJSON polygon overlays (future enhancement)
