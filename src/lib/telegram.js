/**
 * telegram.js — shared Telegram Bot API utility
 *
 * Credentials are read from localStorage key `fm_mcp_integrations`,
 * the same storage used by the MCP integrations panel (integ_telegram).
 */

function getTelegramCreds() {
  try {
    const integrations = JSON.parse(localStorage.getItem('fm_mcp_integrations') || '[]')
    const tg = integrations.find((i) => i.id === 'integ_telegram')
    const token  = tg?.config?.token  ?? ''
    const chatId = tg?.config?.chatId ?? ''
    return { token, chatId, configured: Boolean(token && chatId) }
  } catch {
    return { token: '', chatId: '', configured: false }
  }
}

/**
 * Send a plain-text (or HTML) message to the configured Telegram bot.
 * Returns { success: boolean, error?: string }
 */
export async function sendTelegramMessage(text) {
  const { token, chatId, configured } = getTelegramCreds()
  if (!configured) return { success: false, error: 'Telegram not configured' }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    const data = await res.json()
    return data.ok ? { success: true } : { success: false, error: data.description ?? 'Telegram error' }
  } catch (err) {
    return { success: false, error: err?.message ?? 'Network error' }
  }
}

/**
 * Format a brief object into a Telegram-readable HTML message.
 */
export function formatBriefForTelegram(brief) {
  const isNews = brief.type === 'news_digest'
  const emoji  = isNews ? '📰' : '🧠'
  const kind   = isNews ? 'AI News Digest' : 'Topic Brief'

  const lines = [
    `${emoji} <b>${kind}: ${escapeHtml(brief.title)}</b>`,
    '',
  ]

  // Overview
  for (const section of brief.sections ?? []) {
    if (section.type === 'overview' && section.content) {
      lines.push(escapeHtml(section.content))
      lines.push('')
      break
    }
  }

  // Highlights or what_changed
  for (const section of brief.sections ?? []) {
    if (section.type === 'highlights' && Array.isArray(section.items) && section.items.length) {
      lines.push('<b>Highlights</b>')
      section.items.slice(0, 3).forEach((item) => {
        const text = typeof item === 'string' ? item : (item?.text ?? '')
        if (text) lines.push(`• ${escapeHtml(text)}`)
      })
      lines.push('')
      break
    }
    if (section.type === 'what_changed' && Array.isArray(section.items) && section.items.length) {
      lines.push('<b>What Changed</b>')
      section.items.slice(0, 3).forEach((item) => {
        const text = item?.text ?? ''
        if (text) lines.push(`• ${escapeHtml(text)}`)
      })
      lines.push('')
      break
    }
  }

  // Top signal
  for (const section of brief.sections ?? []) {
    if (section.type === 'top_signal' && section.content) {
      lines.push(`⚡️ ${escapeHtml(section.content)}`)
      lines.push('')
      break
    }
  }

  if (brief.sourceCount > 0) {
    lines.push(`<i>${brief.sourceCount} source${brief.sourceCount !== 1 ? 's' : ''}</i>`)
  }

  return lines.join('\n').trim()
}

/**
 * Format a stock report snapshot into a Telegram HTML message.
 */
export function formatStockReport({ account, positions = [], risk }) {
  const equity  = account ? parseFloat(account.equity) : null
  const lastEq  = account ? parseFloat(account.last_equity) : null
  const pnl     = equity != null && lastEq != null ? equity - lastEq : (risk?.realized_pnl ?? null)
  const balance = lastEq ?? 100_000

  const dateStr = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long', month: 'short', day: 'numeric',
  })

  const lines = [
    `📊 <b>FlowMap Daily Trade Report</b>`,
    `<i>${dateStr}</i>`,
    '',
  ]

  if (pnl != null) {
    const pnlPct = balance > 0 ? (pnl / balance) * 100 : 0
    const sign   = pnl >= 0 ? '+' : ''
    lines.push(`Daily P&L: <b>${sign}$${pnl.toFixed(2)} (${sign}${pnlPct.toFixed(2)}%)</b>`)
  }

  if (equity != null) {
    lines.push(`Paper balance: $${equity.toLocaleString('en-US', { maximumFractionDigits: 2 })}`)
  }

  lines.push('')

  if (positions.length > 0) {
    lines.push(`<b>Open Positions (${positions.length})</b>`)
    positions.forEach((pos) => {
      const upl  = parseFloat(pos.unrealized_pl ?? 0)
      const qty  = parseFloat(pos.qty ?? 1)
      const sign = upl >= 0 ? '+' : ''
      lines.push(`  ${pos.symbol} ${(pos.side ?? 'long').toUpperCase()} ×${qty.toFixed(4)} → ${sign}$${upl.toFixed(2)}`)
    })
  } else {
    lines.push('No open positions.')
  }

  if (risk?.blocked === 1) {
    lines.push('')
    lines.push('⛔ Daily loss limit hit — trading was blocked today.')
  }

  return lines.join('\n')
}

// ── internal ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
