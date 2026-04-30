// ElevenLabs TTS bridge — a tiny Vite middleware plugin that exposes
// /api/tts to the browser.
//
// Why a Vite plugin and not a Vite proxy?
// Because we need to keep the API key on the server side. A plain proxy would
// leak ELEVENLABS_API_KEY to the browser; this middleware injects it from the
// dev-server environment at request time.
//
// Setup:
//   1. Set the env var. Easiest: drop a line into a `.env.local` next to
//      package.json (gitignored by Vite by default):
//        ELEVENLABS_API_KEY=sk_your_key_here
//      Then restart `vite dev`. The plugin's `config` hook calls Vite's
//      loadEnv() so .env.local values reach the server side (Vite only
//      auto-exposes them to client code via import.meta.env).
//      Or set it inline: `ELEVENLABS_API_KEY=sk_xxx npm run dev`
//   2. Wire this plugin into vite.config.js:
//        import elevenlabs from './vite-plugin-elevenlabs.js'
//        plugins: [react(), tailwindcss(), flowmapSync(), elevenlabs()],
//   3. Toggle "Voice responses" on in the gear menu.
//
// Request shape (from src/lib/voice/player.js):
//   POST /api/tts
//   { text, voiceId?, modelId? }
//   ->  audio/mpeg bytes (MP3)
//   or  { error } JSON on failure
//
// Notes:
//   - This is dev-only (Vite middleware); for production you'd want a real
//     server function (Express/Next/Cloudflare Worker/etc.) implementing the
//     same contract. The browser code in player.js is unchanged either way.
//   - Body capped at 5KB so a runaway request can't pin the dev server.

import { loadEnv } from 'vite'

const MAX_BODY_BYTES = 5 * 1024
const MAX_TEXT_CHARS = 4500
const DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb' // Rachel
const DEFAULT_MODEL = 'eleven_flash_v2_5'

// Server-side TTS call. Exported so other server code (a future Express route
// in production) can reuse the same logic.
//
// When `withTimestamps` is true, hits ElevenLabs' /with-timestamps endpoint
// which returns JSON containing both the audio (base64) and a character-level
// alignment array. Used by the FlowMap node-voice panel to render closed
// captions that highlight along with the audio. Returns either:
//   { audio: ArrayBuffer }                                  // when false
//   { audio: ArrayBuffer, alignment: {...}, raw: {...} }    // when true
export async function synthesizeSpeech({ text, voiceId, modelId, withTimestamps }, apiKey) {
  if (!apiKey) {
    const err = new Error('ELEVENLABS_API_KEY is not set on the server')
    err.status = 500
    throw err
  }
  const t = String(text || '').slice(0, MAX_TEXT_CHARS)
  if (!t.trim()) {
    const err = new Error('text is required')
    err.status = 400
    throw err
  }
  const v = String(voiceId || DEFAULT_VOICE)
  const m = String(modelId || DEFAULT_MODEL)

  if (withTimestamps) {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v)}/with-timestamps`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({ text: t, model_id: m, output_format: 'mp3_44100_128' }),
      }
    )
    if (!upstream.ok) {
      let detail = ''
      try { detail = await upstream.text() } catch {}
      const err = new Error(`elevenlabs ${upstream.status}: ${detail.slice(0, 400)}`)
      err.status = upstream.status
      throw err
    }
    const json = await upstream.json()
    // Decode base64 audio into a Buffer that we can stream to the browser as
    // bytes alongside the alignment data. The browser receives the JSON as-is.
    return { json }
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(v)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text: t, model_id: m }),
    }
  )

  if (!upstream.ok) {
    let detail = ''
    try { detail = await upstream.text() } catch {}
    const err = new Error(`elevenlabs ${upstream.status}: ${detail.slice(0, 400)}`)
    err.status = upstream.status
    throw err
  }
  // Return as ArrayBuffer for symmetry with the README example.
  return await upstream.arrayBuffer()
}

export default function elevenlabsPlugin() {
  // Captured during the `config` hook so it's available before configureServer
  // runs. We accept any prefix ('') because ELEVENLABS_API_KEY doesn't carry
  // the VITE_ prefix and shouldn't — it must NEVER reach the client bundle.
  let apiKey = ''

  return {
    name: 'flowmap-elevenlabs',
    config(_userConfig, { mode }) {
      const env = loadEnv(mode, process.cwd(), '')
      apiKey = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || ''
    },
    configureServer(server) {
      server.middlewares.use('/api/tts', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('allow', 'POST')
          res.end('Method Not Allowed')
          return
        }

        // Read JSON body with a size cap.
        let received = 0
        const chunks = []
        try {
          for await (const chunk of req) {
            received += chunk.length
            if (received > MAX_BODY_BYTES) {
              res.statusCode = 413
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ error: 'request body too large' }))
              return
            }
            chunks.push(chunk)
          }
        } catch (err) {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: err?.message || 'failed to read body' }))
          return
        }

        let body
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
        } catch {
          res.statusCode = 400
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'body must be valid JSON' }))
          return
        }

        try {
          const result = await synthesizeSpeech(body, apiKey)
          if (result && result.json) {
            // withTimestamps mode — return the ElevenLabs JSON envelope
            // (audio_base64 + alignment) so the browser can drive captions.
            res.statusCode = 200
            res.setHeader('content-type', 'application/json')
            res.setHeader('cache-control', 'no-store')
            res.end(JSON.stringify(result.json))
          } else {
            // Plain audio mode — raw MP3 bytes.
            res.statusCode = 200
            res.setHeader('content-type', 'audio/mpeg')
            res.setHeader('cache-control', 'no-store')
            res.end(Buffer.from(result))
          }
        } catch (err) {
          const status = Number(err?.status) || 502
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: err?.message || 'tts failed' }))
        }
      })
    },
  }
}
