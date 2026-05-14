import { useState, useCallback } from 'react'

const MAX_PINS = 200
const MAX_ARCS = 50

export function useGlobeState() {
  const [pins, setPins] = useState([])       // [{ lat, lng, label, color, altitude? }]
  const [arcs, setArcs] = useState([])       // [{ startLat, startLng, endLat, endLng, label, color? }]
  const [labels, setLabels] = useState([])   // [{ lat, lng, text, size? }]
  const [viewpoint, setViewpointState] = useState(null)  // { lat, lng, altitude } | null
  const [focusLabel, setFocusLabel] = useState('')       // shown in header

  const addPins = useCallback((newPins) => {
    setPins((prev) => [...prev, ...newPins].slice(-MAX_PINS))
  }, [])

  const addArcs = useCallback((newArcs) => {
    setArcs((prev) => [...prev, ...newArcs].slice(-MAX_ARCS))
  }, [])

  const clearAll = useCallback(() => {
    setPins([])
    setArcs([])
    setLabels([])
    setViewpointState(null)
    setFocusLabel('')
  }, [])

  const flyTo = useCallback((coords) => {
    if (!coords) return
    const { lat, lng, altitude = 1.8, label = '' } = coords
    setViewpointState({ lat, lng, altitude })
    if (label) setFocusLabel(label)
  }, [])

  return { pins, arcs, labels, viewpoint, focusLabel, addPins, addArcs, clearAll, flyTo }
}
