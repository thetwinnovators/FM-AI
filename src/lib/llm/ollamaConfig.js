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

// ── Token usage tracking ─────────────────────────────────────────────────────
// Cumulative totals + per-day history (last 30 days) per model.

const TOKEN_USAGE_KEY   = 'flowmap.ollama.tokenUsage'
const TOKEN_HISTORY_KEY = 'flowmap.ollama.tokenHistory'

function todayKey() {
  // YYYY-MM-DD in local time
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getTokenUsage() {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(TOKEN_USAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// Returns { "YYYY-MM-DD": { modelName: tokenCount } }
export function getTokenHistory() {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(TOKEN_HISTORY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

// Returns array of 7 numbers, oldest→newest, for the given model.
export function get7DayUsage(model, history) {
  const h = history ?? getTokenHistory()
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    result.push(h[key]?.[model] ?? 0)
  }
  return result
}

export function addTokenUsage(model, tokens) {
  if (!model || !tokens || tokens <= 0) return
  try {
    if (typeof localStorage === 'undefined') return
    // Cumulative total
    const usage = getTokenUsage()
    usage[model] = (usage[model] ?? 0) + Math.round(tokens)
    localStorage.setItem(TOKEN_USAGE_KEY, JSON.stringify(usage))
    // Daily history
    const history = getTokenHistory()
    const today   = todayKey()
    if (!history[today]) history[today] = {}
    history[today][model] = (history[today][model] ?? 0) + Math.round(tokens)
    // Prune entries older than 30 days
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
    for (const key of Object.keys(history)) {
      if (key < cutoffKey) delete history[key]
    }
    localStorage.setItem(TOKEN_HISTORY_KEY, JSON.stringify(history))
  } catch {}
}
