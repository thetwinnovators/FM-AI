// Ollama local LLM configuration. Drives Phase 2 document summaries and
// (eventually) Phase 3 Ask FlowMap AI chat. Same shape and pattern as
// searchConfig.js — runtime toggle persisted in localStorage so the gear-icon
// menu choice survives reloads.
//
// To run Ollama locally:
//   docker run -d -p 11434:11434 -v ollama:/root/.ollama --name ollama ollama/ollama
//   docker exec -it ollama ollama pull llama3.2:3b
//
// To use a bigger / different model:
//   docker exec -it ollama ollama pull qwen2.5:7b   (or whatever)
//   then set the `model` field via setOllamaModel() — gear menu does this.
//
// To point at a remote / different Ollama instance:
//   1. Edit the `target:` URL in vite.config.js (`/api/ollama` block)
//   2. Restart `vite dev`
//
// To disable entirely (e.g. before you've spun up Docker):
//   toggle it off in the gear-icon menu, or change `enabled` default below.

const ENABLED_OVERRIDE_KEY = 'flowmap.ollama.enabled'
const MODEL_OVERRIDE_KEY = 'flowmap.ollama.model'

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

const _enabledOverride = readBoolOverride(ENABLED_OVERRIDE_KEY)
const _modelOverride = readStringOverride(MODEL_OVERRIDE_KEY)

export const OLLAMA_CONFIG = {
  // Default OFF — most users haven't spun up the container yet, and we don't
  // want spammy console warnings on first run. User flips on via the gear menu
  // once `docker run ollama/ollama` is happy.
  enabled: _enabledOverride !== null ? _enabledOverride : false,

  // Vite proxy path; not the actual Ollama URL. See vite.config.js for that.
  baseUrl: '/api/ollama',

  // Default model. llama3.2:3b is small (~2GB) and fast — fine for summaries.
  // For higher-quality chat answers later, qwen2.5:7b or llama3.1:8b are good
  // upgrades (~5GB each).
  model: _modelOverride || 'llama3.2:3b',

  // Per-request timeout. Raised to 5 min to allow long code-generation
  // responses to stream to completion without the abort timer firing.
  timeoutMs: 300_000,
}

export function setOllamaEnabled(enabled) {
  OLLAMA_CONFIG.enabled = !!enabled
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ENABLED_OVERRIDE_KEY, String(!!enabled))
    }
  } catch { /* runtime override still applies for this session */ }
}

export function setOllamaModel(model) {
  OLLAMA_CONFIG.model = String(model || 'llama3.2:3b')
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODEL_OVERRIDE_KEY, OLLAMA_CONFIG.model)
    }
  } catch { /* runtime override still applies for this session */ }
}
