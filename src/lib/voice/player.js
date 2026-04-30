// Browser-side TTS player. Talks to /api/tts (the ElevenLabs Vite middleware
// plugin), gets back MP3 bytes, and plays them via HTMLAudioElement. Keeps a
// single "current" audio + AbortController so a new reply cancels any
// in-flight request and any audio still playing — no overlapping voices.

import { VOICE_CONFIG } from './voiceConfig.js'

let currentAudio = null
let currentUrl = null
let currentAbort = null

// Tiny pub/sub so other parts of the UI (e.g. the FlowGraph edge pulse) can
// react to "voice is currently speaking" without polling. Mirrors the
// subscribeSyncStatus pattern in useStore.js.
const playingListeners = new Set()
let _isPlaying = false
function setPlaying(next) {
  if (next === _isPlaying) return
  _isPlaying = next
  for (const fn of playingListeners) {
    try { fn(_isPlaying) } catch {}
  }
}
export function subscribeVoicePlaying(fn) {
  playingListeners.add(fn)
  // Push current state immediately so subscribers don't have to handle
  // "what's the value before the first event?" themselves.
  try { fn(_isPlaying) } catch {}
  return () => playingListeners.delete(fn)
}

function devWarn(...args) {
  if (typeof console !== 'undefined') console.warn('[voice]', ...args)
}

// Replace any in-flight playback / fetch with this new one.
function cancelCurrent() {
  if (currentAbort) {
    try { currentAbort.abort() } catch {}
    currentAbort = null
  }
  if (currentAudio) {
    try { currentAudio.pause() } catch {}
    currentAudio.src = ''
    currentAudio = null
  }
  if (currentUrl) {
    try { URL.revokeObjectURL(currentUrl) } catch {}
    currentUrl = null
  }
  setPlaying(false)
}

// Fetch TTS bytes for `text` and play them. Returns the Audio element so the
// caller can listen for `ended` / `error` if it wants finer control.
//
// Plays through a Blob URL fed to <audio>, which is the simplest path that
// also works under autoplay restrictions IF the call is initiated by a recent
// user gesture (sending a chat message counts; FlowMap chat input qualifies).
export async function playTtsForReply(text, opts = {}) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null

  cancelCurrent()
  const ctrl = new AbortController()
  currentAbort = ctrl

  let res
  try {
    res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        // ElevenLabs hard-caps a single TTS call around ~5000 chars; clip
        // generously below that to leave room for normalization on their end.
        text: trimmed.slice(0, 4500),
        voiceId: opts.voiceId || VOICE_CONFIG.voiceId,
        modelId: opts.modelId || VOICE_CONFIG.modelId,
      }),
      signal: ctrl.signal,
    })
  } catch (err) {
    if (err?.name !== 'AbortError') devWarn('tts fetch failed:', err?.message || err)
    return null
  }

  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.error || '' } catch { /* ignore */ }
    devWarn(`tts ${res.status}: ${detail || res.statusText}`)
    return null
  }

  const blob = await res.blob()
  if (ctrl.signal.aborted) return null

  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  currentAudio = audio
  currentUrl = url

  audio.addEventListener('play',  () => { if (currentAudio === audio) setPlaying(true) })
  audio.addEventListener('pause', () => { if (currentAudio === audio && audio.ended) setPlaying(false) })
  audio.addEventListener('ended', () => {
    if (currentAudio === audio) {
      currentAudio = null
      try { URL.revokeObjectURL(url) } catch {}
      if (currentUrl === url) currentUrl = null
    }
    setPlaying(false)
  })
  audio.addEventListener('error', () => {
    devWarn('audio playback error')
    if (currentAudio === audio) {
      currentAudio = null
      try { URL.revokeObjectURL(url) } catch {}
      if (currentUrl === url) currentUrl = null
    }
    setPlaying(false)
  })

  try {
    await audio.play()
    setPlaying(true)
  } catch (err) {
    // Browsers block play() if there's no recent user gesture. Surface this
    // so the chat UI can fall back to a "click to play" affordance later.
    devWarn('play() blocked:', err?.message || err)
  }
  return audio
}

// Decode a base64 string to a Uint8Array. Used for the with-timestamps
// endpoint, which returns the audio body inline as base64.
function base64ToBytes(b64) {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

// Group character-level alignment into word-level chunks so callers can
// highlight progressively without strobing every glyph. Each word carries
// the start time of its first non-whitespace character and the end time of
// its last; whitespace is preserved as separate "tokens" so the rendered
// caption keeps natural spacing.
//
// Alignment shape from ElevenLabs:
//   { characters: ['H','i'], character_start_times_seconds:[0,0.05],
//     character_end_times_seconds:[0.05,0.1] }
//
// Returns: [{ text, start, end, isSpace }, ...]
export function tokenizeAlignment(alignment) {
  if (!alignment || !alignment.characters) return []
  const chars = alignment.characters
  const starts = alignment.character_start_times_seconds || []
  const ends = alignment.character_end_times_seconds || []
  const out = []
  let cur = null
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const s = starts[i] ?? 0
    const e = ends[i] ?? s
    const isWS = /\s/.test(c)
    if (isWS) {
      if (cur) { out.push(cur); cur = null }
      out.push({ text: c, start: s, end: e, isSpace: true })
    } else {
      if (!cur) cur = { text: '', start: s, end: e, isSpace: false }
      cur.text += c
      cur.end = e
    }
  }
  if (cur) out.push(cur)
  return out
}

// Speak `text` AND get back the alignment data so the caller can render
// closed captions. Resolves with:
//   { audio, alignment, tokens, abort } — abort() cancels playback + fetch.
// On failure (no key, network error, blocked autoplay), returns null and
// logs via [voice] so the UI can fall back to plain text without a TTS read.
export async function playTtsWithCaptions(text, opts = {}) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null

  cancelCurrent()
  const ctrl = new AbortController()
  currentAbort = ctrl

  let res
  try {
    res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: trimmed.slice(0, 4500),
        voiceId: opts.voiceId || VOICE_CONFIG.voiceId,
        modelId: opts.modelId || VOICE_CONFIG.modelId,
        withTimestamps: true,
      }),
      signal: ctrl.signal,
    })
  } catch (err) {
    if (err?.name !== 'AbortError') devWarn('captions fetch failed:', err?.message || err)
    return null
  }

  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.error || '' } catch {}
    devWarn(`captions ${res.status}: ${detail || res.statusText}`)
    return null
  }

  let payload
  try { payload = await res.json() } catch (err) {
    devWarn('captions json parse failed:', err?.message || err)
    return null
  }
  if (ctrl.signal.aborted) return null

  const audioBytes = base64ToBytes(payload.audio_base64 || '')
  const blob = new Blob([audioBytes], { type: 'audio/mpeg' })
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  currentAudio = audio
  currentUrl = url

  audio.addEventListener('play',  () => { if (currentAudio === audio) setPlaying(true) })
  audio.addEventListener('ended', () => {
    if (currentAudio === audio) {
      currentAudio = null
      try { URL.revokeObjectURL(url) } catch {}
      if (currentUrl === url) currentUrl = null
    }
    setPlaying(false)
  })
  audio.addEventListener('error', () => {
    devWarn('audio playback error')
    if (currentAudio === audio) {
      currentAudio = null
      try { URL.revokeObjectURL(url) } catch {}
      if (currentUrl === url) currentUrl = null
    }
    setPlaying(false)
  })

  try {
    await audio.play()
    setPlaying(true)
  } catch (err) {
    devWarn('play() blocked:', err?.message || err)
  }

  const alignment = payload.normalized_alignment || payload.alignment || null
  return {
    audio,
    alignment,
    tokens: tokenizeAlignment(alignment),
    abort: () => cancelCurrent(),
  }
}

// Public stop — used by chat when the user clicks "stop voice" or starts a
// new conversation.
export function stopVoice() {
  cancelCurrent()
}

// Read-only snapshot for UI ("is voice currently speaking?").
export function isVoicePlaying() {
  return !!currentAudio && !currentAudio.paused
}
