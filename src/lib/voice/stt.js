// Local speech-to-text via whisper-asr-webservice (Docker container at
// :9000, proxied through /api/stt). Replaces the browser's Web Speech API,
// which routes audio through Google's servers.
//
// Setup (one-time):
//   docker run -d --name whisper --gpus all -p 9000:9000 \
//     -e ASR_MODEL=base.en -e ASR_ENGINE=faster_whisper \
//     onerahmet/openai-whisper-asr-webservice:latest-gpu
//
// Available STT models (size / quality tradeoff):
//   tiny.en  / tiny     ~75MB    fastest, English-only / multilingual
//   base.en  / base    ~140MB    good default for chat dictation
//   small.en / small   ~460MB    noticeably better, slower on CPU
//   medium             ~1.5GB    diminishing returns above this for chat
//
// API contract (whisper-asr-webservice /asr):
//   POST multipart/form-data, field `audio_file`
//   ?task=transcribe&output=json&language=en
//   -> { text: '…', segments: [...], language: 'en' }

const ENDPOINT = '/api/stt/asr?task=transcribe&output=json&language=en'
// Cap recording length so a forgotten "stop" doesn't ship a giant blob to
// the Whisper container. 60s is plenty for a chat utterance.
const MAX_RECORD_MS = 60_000

function devWarn(...args) {
  if (typeof console !== 'undefined') console.warn('[stt]', ...args)
}

// Pick the best mime type the browser supports. webm/opus is the Chrome
// default; ogg/opus on Firefox. Whisper's ffmpeg pipeline handles both.
function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4']
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

// Capture mic audio. Returns a controller you can `.stop()` to get back the
// recorded Blob, or `.cancel()` to discard. The mic stream is closed in
// both cases so the OS-level "in use" indicator goes away.
export async function startRecording() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('mediaDevices.getUserMedia not available')
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })
  const mimeType = pickMimeType()
  const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  const chunks = []
  rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }

  // Auto-stop after MAX_RECORD_MS.
  const timeout = setTimeout(() => {
    if (rec.state !== 'inactive') {
      try { rec.stop() } catch {}
    }
  }, MAX_RECORD_MS)

  let onStopResolve
  const stopped = new Promise((resolve) => { onStopResolve = resolve })
  rec.onstop = () => {
    clearTimeout(timeout)
    for (const t of stream.getTracks()) t.stop()
    onStopResolve(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
  }

  rec.start()

  return {
    state: () => rec.state,
    stop: async () => {
      if (rec.state === 'inactive') return new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
      rec.stop()
      return await stopped
    },
    cancel: () => {
      clearTimeout(timeout)
      try { rec.stop() } catch {}
      for (const t of stream.getTracks()) t.stop()
    },
  }
}

// Send a recorded blob to the Whisper container and return its transcript.
// Throws on non-2xx responses so callers can surface the failure mode.
export async function transcribeBlob(blob, opts = {}) {
  if (!blob || blob.size === 0) return ''
  const form = new FormData()
  // Filename is informational; whisper-asr-webservice sniffs by content.
  form.append('audio_file', blob, opts.filename || 'utterance.webm')
  const res = await fetch(ENDPOINT, { method: 'POST', body: form, signal: opts.signal })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.text()).slice(0, 300) } catch {}
    const err = new Error(`stt ${res.status}: ${detail}`)
    err.status = res.status
    throw err
  }
  const data = await res.json()
  return String(data.text || '').trim()
}

// One-shot helper: record until the caller resolves the returned `done()`
// promise, then transcribe and return the text. Use this when the caller
// doesn't need fine-grained control over the recording lifecycle.
export async function recordAndTranscribe() {
  const ctl = await startRecording()
  return {
    cancel: () => ctl.cancel(),
    finish: async () => {
      const blob = await ctl.stop()
      try {
        return await transcribeBlob(blob)
      } catch (err) {
        devWarn('transcribe failed:', err?.message || err)
        return ''
      }
    },
  }
}
