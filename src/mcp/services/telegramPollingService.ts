/**
 * Browser-side long-polling for Telegram bot updates.
 * No backend required — calls Telegram's getUpdates endpoint directly.
 * Polls continuously while running; each call waits up to 10s for new updates.
 */

const BASE = 'https://api.telegram.org'
const OFFSET_KEY = 'fm_telegram_poll_offset'

let looping = false
let abortController: AbortController | null = null

export type InboundHandler = (
  text: string,
  fromName: string,
  chatId: string,
) => Promise<string>

function getOffset(): number {
  return parseInt(localStorage.getItem(OFFSET_KEY) ?? '-1', 10)
}
function saveOffset(n: number): void {
  localStorage.setItem(OFFSET_KEY, String(n))
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

interface TelegramUpdate {
  update_id: number
  message?: {
    text?: string
    from?: { first_name?: string; username?: string }
    chat?: { id?: number }
  }
}

async function fetchUpdates(
  token: string,
  offset: number,
  signal: AbortSignal,
): Promise<{ ok: boolean; result: TelegramUpdate[] }> {
  const url = `${BASE}/bot${token}/getUpdates?offset=${offset}&timeout=25&allowed_updates=${encodeURIComponent('["message"]')}`
  const res = await fetch(url, { signal })
  return res.json()
}

export async function startPolling(
  token: string,
  chatId: string,
  onMessage: InboundHandler,
): Promise<void> {
  if (looping) return
  looping = true
  abortController = new AbortController()
  const { signal } = abortController

  while (looping && !signal.aborted) {
    try {
      const offset = getOffset() + 1
      const data = await fetchUpdates(token, offset, signal)

      if (!data.ok) {
        await sleep(5000)
        continue
      }

      for (const update of data.result ?? []) {
        saveOffset(update.update_id)

        const text = update.message?.text
        const fromName =
          update.message?.from?.first_name ??
          update.message?.from?.username ??
          'User'
        const incomingChatId = String(update.message?.chat?.id ?? '')

        if (!text || incomingChatId !== chatId) continue

        // Process the command and send a reply
        const reply = await onMessage(text, fromName, incomingChatId)
        await fetch(`${BASE}/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: reply,
            parse_mode: 'HTML',
          }),
          signal,
        })

        // Notify UI that a new inbound message arrived
        window.dispatchEvent(new CustomEvent('fm-telegram-inbound'))
      }
    } catch (err: unknown) {
      if (signal.aborted) break
      if ((err as Error)?.name === 'AbortError') break
      // Network / parse error — back off before retrying
      await sleep(5000)
    }
  }

  looping = false
}

export function stopPolling(): void {
  looping = false
  abortController?.abort()
  abortController = null
}

export function isPolling(): boolean {
  return looping
}
