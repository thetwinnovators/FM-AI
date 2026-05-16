/**
 * useDailyStockReport.js
 *
 * Once per day, after 4 PM ET (market close), compile the Risk Dashboard
 * snapshot and send it to the user's configured Telegram bot.
 *
 * The sent-date is stored in localStorage so we only fire once per calendar
 * day even if the user reloads the app multiple times.
 */
import { useEffect } from 'react'
import { flowTradeApi } from './api.js'
import { sendTelegramMessage, formatStockReport } from '../lib/telegram.js'

const STORAGE_KEY = 'fm_daily_stock_report_sent'
const CHECK_INTERVAL_MS = 5 * 60 * 1000 // re-check every 5 min

/** True when local clock in ET is at or past 4:00 PM (market close). */
function isPastMarketClose() {
  const etStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
  const etDate = new Date(etStr)
  return etDate.getHours() >= 16
}

/** Today's date string in ET timezone — "YYYY-MM-DD". */
function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

async function maybeSendReport() {
  if (!isPastMarketClose()) return
  const today = todayET()
  if (localStorage.getItem(STORAGE_KEY) === today) return

  try {
    const [accountRes, positionsRes, riskRes] = await Promise.allSettled([
      flowTradeApi.getAlpacaAccount(),
      flowTradeApi.getAlpacaPositions(),
      flowTradeApi.getDailyRisk(),
    ])
    const account   = accountRes.status   === 'fulfilled' ? accountRes.value      : null
    const positions = positionsRes.status === 'fulfilled' ? (positionsRes.value ?? []) : []
    const risk      = riskRes.status      === 'fulfilled' ? riskRes.value          : null

    const text   = formatStockReport({ account, positions, risk })
    const result = await sendTelegramMessage(text)
    if (result.success) {
      localStorage.setItem(STORAGE_KEY, today)
    }
  } catch {
    // Daemon offline or Telegram not configured — silent fail.
  }
}

export function useDailyStockReport() {
  useEffect(() => {
    maybeSendReport()
    const id = setInterval(maybeSendReport, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
