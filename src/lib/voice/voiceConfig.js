// Voice / TTS configuration. Same shape and persistence pattern as
// ollamaConfig.js — a runtime-mutable config object with localStorage-backed
// overrides so the gear-menu toggle survives reloads.
//
// To enable in the app:
//   1. Set ELEVENLABS_API_KEY in your environment (see vite-plugin-elevenlabs.js).
//   2. Restart `vite dev` so the plugin can read the env var.
//   3. Flip "Voice responses" on in the gear-menu.
//
// To change the voice (browse voices at https://elevenlabs.io/app/voice-library):
//   - Either edit the default `voiceId` below, or
//   - Call `setVoiceId('<voice-id>')` from the console / settings UI.
//
// Voice IDs are public ElevenLabs identifiers. The default below is "Rachel"
// (one of ElevenLabs' built-in legacy voices) — pick whatever fits your tone.

const ENABLED_KEY = 'flowmap.voice.enabled'
const VOICE_ID_KEY = 'flowmap.voice.voiceId'
const MODEL_ID_KEY = 'flowmap.voice.modelId'

function readBoolOverride(key) {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return raw === 'true'
  } catch { return null }
}

function readStringOverride(key) {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch { return null }
}

const _enabledOverride = readBoolOverride(ENABLED_KEY)
const _voiceIdOverride = readStringOverride(VOICE_ID_KEY)
const _modelIdOverride = readStringOverride(MODEL_ID_KEY)

export const VOICE_CONFIG = {
  // Default OFF — speaking aloud is opt-in. User flips on in the gear menu
  // once ELEVENLABS_API_KEY is set on the dev server.
  enabled: _enabledOverride !== null ? _enabledOverride : false,

  // Default voice — "Rachel" (calm, neutral). Replace with any ElevenLabs voice id.
  voiceId: _voiceIdOverride || 'JBFqnCBsd6RMkjVDRZzb',

  // Low-latency multilingual model. Cheaper + faster than v3; quality is fine
  // for chat-length replies. Override via setVoiceModel('eleven_turbo_v2_5')
  // or 'eleven_multilingual_v2' for higher fidelity.
  modelId: _modelIdOverride || 'eleven_flash_v2_5',
}

export function setVoiceEnabled(enabled) {
  VOICE_CONFIG.enabled = !!enabled
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ENABLED_KEY, String(!!enabled))
    }
  } catch { /* runtime override still applies for this session */ }
}

export function setVoiceId(voiceId) {
  VOICE_CONFIG.voiceId = String(voiceId || 'JBFqnCBsd6RMkjVDRZzb')
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOICE_ID_KEY, VOICE_CONFIG.voiceId)
    }
  } catch {}
}

export function setVoiceModel(modelId) {
  VOICE_CONFIG.modelId = String(modelId || 'eleven_flash_v2_5')
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODEL_ID_KEY, VOICE_CONFIG.modelId)
    }
  } catch {}
}
