import { useCallback, useEffect, useRef, useState } from 'react'
import { startRecording, transcribeBlob } from './stt.js'

// React hook that wraps the local-Whisper STT pipeline (MediaRecorder + the
// /api/stt proxy) and exposes a draft-aware mic for any composer.
//
// Usage:
//   const { listening, transcribing, error, supported, toggleMic } =
//     useMicTranscription({ getDraft: () => text, setDraft: setText })
//
// Behavior:
//   - Click toggle → starts recording. Click again → stops + transcribes.
//   - Transcript appends to the current draft (a space is inserted if the
//     existing draft doesn't already end in whitespace).
//   - If the user types while recording, the new typed text becomes the
//     "base" the next transcription appends to (we re-snapshot in `setDraft`).
//   - On unmount or browser-level mic loss, the recorder is canceled cleanly.

export function useMicTranscription({ getDraft, setDraft }) {
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState(null)
  const recorderRef = useRef(null)
  const baseTextRef = useRef('')         // draft contents at recording start
  const transcribingRef = useRef(false)  // sync guard against double-stop

  const supported = typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined'
    && !!navigator?.mediaDevices?.getUserMedia

  const startMic = useCallback(async () => {
    if (!supported || listening || transcribingRef.current) return
    setError(null)
    baseTextRef.current = String(getDraft() || '')
    try {
      const ctl = await startRecording()
      recorderRef.current = ctl
      setListening(true)
    } catch (err) {
      const msg = /denied|not allowed/i.test(String(err?.message))
        ? 'Mic permission denied — allow it in the browser.'
        : (err?.message || 'mic init failed')
      setError(msg)
    }
  }, [supported, listening, getDraft])

  const stopMic = useCallback(async () => {
    const ctl = recorderRef.current
    if (!ctl) { setListening(false); return }
    recorderRef.current = null
    setListening(false)
    transcribingRef.current = true
    setTranscribing(true)
    setError(null)
    try {
      const blob = await ctl.stop()
      const text = await transcribeBlob(blob)
      if (text) {
        const base = baseTextRef.current
        const sep = base && !/\s$/.test(base) ? ' ' : ''
        const next = base + sep + text
        setDraft(next)
        baseTextRef.current = next
      }
    } catch (err) {
      const msg = err?.status === 502 || err?.status === 503
        ? 'Whisper container unreachable. Is it running on :9000?'
        : `Transcription failed: ${err?.message || err}`
      setError(msg)
    } finally {
      transcribingRef.current = false
      setTranscribing(false)
    }
  }, [setDraft])

  const cancelMic = useCallback(() => {
    const ctl = recorderRef.current
    if (ctl) {
      try { ctl.cancel() } catch {}
      recorderRef.current = null
    }
    setListening(false)
  }, [])

  const toggleMic = useCallback(() => {
    if (listening) stopMic()
    else startMic()
  }, [listening, stopMic, startMic])

  // Release the mic on unmount.
  useEffect(() => () => cancelMic(), [cancelMic])

  // Allow the host to update the base text (e.g. when the user types during
  // recording, the typed text replaces the previous "base").
  const rebase = useCallback((next) => { baseTextRef.current = String(next || '') }, [])

  return { listening, transcribing, error, supported, toggleMic, startMic, stopMic, cancelMic, rebase }
}
