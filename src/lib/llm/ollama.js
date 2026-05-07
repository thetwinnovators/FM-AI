// Ollama LLM adapter. Calls the local Vite proxy at `/api/ollama` which
// forwards to the Docker container. Never throws — every failure path returns
// null so the caller can fall back gracefully (e.g. show "Summary pending").
//
// Dev-only `console.warn` output is throttled like the SearXNG adapter so a
// stopped container doesn't spam the console.

import { OLLAMA_CONFIG, addTokenUsage } from './ollamaConfig.js'

let lastErrorAt = 0
const ERROR_LOG_INTERVAL_MS = 30_000

function devWarn(message, detail) {
  if (!import.meta.env?.DEV) return
  const now = Date.now()
  if (now - lastErrorAt < ERROR_LOG_INTERVAL_MS) return
  lastErrorAt = now
  console.warn('[Ollama]', message, detail ?? '')
}

async function postJson(path, body, signal) {
  const url = `${OLLAMA_CONFIG.baseUrl}${path}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), OLLAMA_CONFIG.timeoutMs)
  const onCallerAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onCallerAbort)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      devWarn(
        `Ollama returned HTTP ${res.status}. ` +
        (res.status === 404 ? `Model "${body.model}" probably isn't pulled — try \`docker exec ollama ollama pull ${body.model}\`.` :
         res.status >= 500 ? 'Container is having problems; check `docker logs ollama`.' :
         'Unexpected status.'),
        url,
      )
      return null
    }
    return await res.json()
  } catch (err) {
    if (signal?.aborted || err?.name === 'AbortError') return null
    devWarn(
      'Network error reaching Ollama. Is the container running? `docker ps` should list `ollama`.',
      err?.message,
    )
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onCallerAbort)
  }
}

// Generate a 2-3 sentence factual summary of `text`. Returns null on any
// failure (Ollama off, instance down, model missing, etc.). Caller decides
// what to do with null — typically: leave the document's `summary` field
// empty so the UI shows the existing excerpt fallback.
export async function generateSummary(text, opts = {}) {
  if (!OLLAMA_CONFIG.enabled) return null
  const trimmed = String(text || '').trim()
  // Don't waste a model call on near-empty pastes.
  if (trimmed.length < 80) return null

  const prompt =
    `Summarize the following text in 2 to 3 sentences. Be concise and factual. ` +
    `Return only the summary itself with no preamble, headers, or commentary.\n\n` +
    `TEXT:\n${trimmed.slice(0, 8000)}\n\nSUMMARY:`

  const json = await postJson('/api/generate', {
    model: OLLAMA_CONFIG.model,
    prompt,
    stream: false,
    keep_alive: '15m',
    options: { temperature: 0.2 },
  }, opts.signal)

  if (!json?.response) return null
  addTokenUsage(OLLAMA_CONFIG.model, (json.prompt_eval_count ?? 0) + (json.eval_count ?? 0))
  return String(json.response).trim() || null
}

// Generic response — takes a pre-built prompt and calls /api/generate without
// any wrapper. Used by the Telegram bot responder and other callers that need
// a conversational answer rather than a document summary.
export async function generateResponse(prompt, opts = {}) {
  if (!OLLAMA_CONFIG.enabled) return null
  const trimmed = String(prompt || '').trim()
  if (!trimmed) return null

  const json = await postJson('/api/generate', {
    model: OLLAMA_CONFIG.model,
    prompt: trimmed,
    stream: false,
    keep_alive: '-1',  // keep model loaded indefinitely — used by Telegram bot, cold-start adds ~15s delay
    options: { temperature: opts.temperature ?? 0.7 },
  }, opts.signal)

  if (!json?.response) return null
  addTokenUsage(OLLAMA_CONFIG.model, (json.prompt_eval_count ?? 0) + (json.eval_count ?? 0))
  return String(json.response).trim() || null
}

// Quick health check — does the proxy reach a running Ollama instance with the
// configured model available? Used by the gear menu to show a status hint.
// Returns one of: 'ok' | 'no-instance' | 'no-model' | 'disabled'.
export async function probeOllama() {
  if (!OLLAMA_CONFIG.enabled) return 'disabled'
  try {
    const res = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/tags`, { method: 'GET' })
    if (!res.ok) return 'no-instance'
    const json = await res.json()
    const models = (json?.models || []).map((m) => m.name)
    if (!models.some((n) => n === OLLAMA_CONFIG.model || n.startsWith(`${OLLAMA_CONFIG.model.split(':')[0]}:`))) {
      return 'no-model'
    }
    return 'ok'
  } catch {
    return 'no-instance'
  }
}

// Phase 3 chat: streaming chat completion. Yields content chunks as they
// arrive so the UI can paint the answer progressively. Returns silently on
// any failure (caller checks emitted text — empty means it failed).
export async function* streamChat(messages, opts = {}) {
  if (!OLLAMA_CONFIG.enabled) return
  if (!Array.isArray(messages) || messages.length === 0) return

  const url = `${OLLAMA_CONFIG.baseUrl}/api/chat`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), OLLAMA_CONFIG.timeoutMs)
  const onCallerAbort = () => ctrl.abort()
  opts.signal?.addEventListener('abort', onCallerAbort)

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/x-ndjson' },
      body: JSON.stringify({
        model: OLLAMA_CONFIG.model,
        messages,
        stream: true,
        keep_alive: '15m',  // keep model in RAM between messages — first call eats ~10s load, follow-ups are fast
        options: {
          temperature: opts.temperature ?? 0.3,
          // Expand the context window beyond Ollama's conservative 4096 default.
          // phi4-mini supports up to 128K; 32K is a practical sweet spot that keeps
          // VRAM usage reasonable while giving long code blocks plenty of room.
          // Callers can override via opts.num_ctx.
          num_ctx: opts.num_ctx ?? 32768,
          // -1 = no hard output cap; model runs to natural completion (or num_ctx).
          num_predict: opts.num_predict ?? -1,
        },
      }),
      signal: ctrl.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onCallerAbort)
    if (opts.signal?.aborted || err?.name === 'AbortError') return
    devWarn('Network error reaching Ollama for chat. Is the container running?', err?.message)
    return
  }

  if (!res.ok) {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onCallerAbort)
    devWarn(`Ollama chat returned HTTP ${res.status}.`, url)
    return
  }

  // Ollama streams NDJSON — one JSON object per line. Each chunk has
  // `message: { role, content }` and a final chunk with `done: true`.
  const reader = res.body?.getReader()
  if (!reader) { clearTimeout(timer); opts.signal?.removeEventListener('abort', onCallerAbort); return }
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        try {
          const json = JSON.parse(line)
          const content = json?.message?.content
          if (content) yield content
          if (json?.done) return
        } catch { /* malformed chunk — skip */ }
      }
    }
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onCallerAbort)
  }
}

// Non-streaming JSON-mode chat call for the agent loop.
// Uses /api/chat with format:'json' so the model is forced to return valid JSON.
// Returns the parsed JSON object, or null on any failure (Ollama off, network
// error, model returns non-JSON). Caller should validate the shape it receives.
export async function chatJson(messages, opts = {}) {
  if (!OLLAMA_CONFIG.enabled) return null
  if (!Array.isArray(messages) || messages.length === 0) return null

  const json = await postJson('/api/chat', {
    model: OLLAMA_CONFIG.model,
    messages,
    stream: false,
    format: 'json',
    keep_alive: '15m',
    options: { temperature: opts.temperature ?? 0.1 },
  }, opts.signal)

  if (!json?.message?.content) return null
  addTokenUsage(OLLAMA_CONFIG.model, (json.prompt_eval_count ?? 0) + (json.eval_count ?? 0))
  try {
    return JSON.parse(json.message.content)
  } catch {
    return null
  }
}
