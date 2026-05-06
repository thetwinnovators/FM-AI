/**
 * Processes inbound Telegram commands and returns reply text (HTML-safe).
 * Reads from the local FlowMap store + signal storage; falls back to Ollama.
 */

import { generateResponse } from '../../lib/llm/ollama.js'
import { OLLAMA_CONFIG } from '../../lib/llm/ollamaConfig.js'
import { localSignalsStorage } from '../../signals/storage/localSignalsStorage.js'
import { STORAGE_KEY } from '../../store/useStore.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'

interface StoredTopic {
  id: string
  name: string
  query?: string
}

function getStoredTopics(): StoredTopic[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const state = raw ? JSON.parse(raw) : {}
    return Object.values(state.userTopics ?? {}) as StoredTopic[]
  } catch {
    return []
  }
}

function getTopSignals(n: number) {
  return localSignalsStorage
    .listSignals()
    .filter((s) => !s.muted)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, n)
}

export async function processTelegramCommand(
  text: string,
  fromName: string,
): Promise<string> {
  const cmd = text.trim().toLowerCase()

  // ── /help ───────────────────────────────────────────────────────────────
  if (cmd === '/help') {
    return [
      '<b>FlowMap AI — Commands</b>',
      '',
      '/summary — top signals briefing',
      '/topics — list your tracked topics',
      '/scan — how to trigger a scan',
      '/help — show this message',
      '',
      'Or just ask me anything about your research.',
    ].join('\n')
  }

  // ── /topics ──────────────────────────────────────────────────────────────
  if (cmd === '/topics') {
    const topics = getStoredTopics()
    if (!topics.length) {
      return '📭 No topics tracked yet. Add some on the <b>My Topics</b> page.'
    }
    const list = topics.map((t) => `• ${t.name}`).join('\n')
    return `<b>Your tracked topics (${topics.length})</b>\n\n${list}`
  }

  // ── /summary ─────────────────────────────────────────────────────────────
  if (cmd === '/summary' || cmd.startsWith('/summary ')) {
    const signals = getTopSignals(7)
    if (!signals.length) {
      return '📭 No signals yet. Open the <b>Signals</b> page and run a scan first.'
    }
    const lines = signals
      .map((s, i) => `${i + 1}. <b>${s.title}</b> — score ${s.score ?? '?'}`)
      .join('\n')
    return `<b>Top signals</b>\n\n${lines}`
  }

  // ── /scan ────────────────────────────────────────────────────────────────
  if (cmd === '/scan') {
    return (
      '⚡ Signal scans run in the FlowMap app.\n' +
      'Open the <b>Signals</b> page and tap <b>Run scan now</b>.'
    )
  }

  // ── free-text → Ollama ───────────────────────────────────────────────────
  if (!OLLAMA_CONFIG.enabled) {
    return (
      '⚙️ AI responses are turned off.\n' +
      'Open FlowMap, click the ⚙ gear icon (top-right), and enable Ollama — ' +
      'then send your message again.'
    )
  }

  const topics = getStoredTopics()
  const signals = getTopSignals(5)
  const ctx = [
    topics.length ? `Tracked topics: ${topics.map((t) => t.name).join(', ')}.` : '',
    signals.length ? `Top signals: ${signals.map((s) => s.title).join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const prompt =
    `You are FlowMap AI, a concise personal research assistant for a solo creator. ` +
    (ctx ? `Context — ${ctx} ` : '') +
    `${fromName} asks: "${text}"\n\n` +
    `Reply in 1–3 sentences. Plain text only, no markdown.`

  const reply = await generateResponse(prompt)

  if (!reply?.trim()) {
    return (
      '🤖 Ollama isn\'t responding.\n' +
      'Make sure Docker is running: `docker ps` should list an `ollama` container. ' +
      'If not: `docker run -d -p 11434:11434 --name ollama ollama/ollama`'
    )
  }

  // Save to local message log so the UI picks it up
  localMCPStorage.saveTelegramMessage({
    id: `tcm_in_${Date.now()}`,
    chatId: 'inbound',
    messageText: `${fromName}: ${text}`,
    receivedAt: new Date().toISOString(),
    status: 'processed',
  })

  return reply.trim()
}
