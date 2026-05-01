import type { TelegramProvider } from './types.js'
import type { TelegramCommandMessage } from '../types.js'

const BASE = 'https://api.telegram.org'

export const realTelegramProvider: TelegramProvider = {
  async sendMessage({ token, chatId, text }) {
    try {
      const res = await fetch(`${BASE}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      })
      const data = (await res.json()) as {
        ok: boolean
        description?: string
        result?: { message_id?: number }
      }
      if (!data.ok) {
        return { success: false, error: data.description ?? 'Telegram API error' }
      }
      return { success: true, messageId: String(data.result?.message_id ?? '') }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },

  async testConnection({ token }) {
    try {
      const res = await fetch(`${BASE}/bot${token}/getMe`)
      const data = (await res.json()) as { ok: boolean; description?: string }
      if (!data.ok) {
        return { success: false, error: data.description ?? 'Invalid bot token' }
      }
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  },

  async handleIncomingWebhook(payload): Promise<TelegramCommandMessage> {
    const p = payload as {
      message?: { message_id?: number; chat?: { id?: number }; text?: string }
    }
    return {
      id: `tcm_${p.message?.message_id ?? Date.now()}`,
      chatId: String(p.message?.chat?.id ?? ''),
      messageText: p.message?.text ?? '',
      receivedAt: new Date().toISOString(),
      status: 'received',
    }
  },
}
