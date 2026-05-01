import type { TelegramProvider } from './types.js'
import type { TelegramCommandMessage } from '../types.js'

export const mockTelegramProvider: TelegramProvider = {
  async sendMessage({ text }) {
    console.log('[MockTelegram] sendMessage:', text)
    return { success: true, messageId: `mock_${Date.now()}` }
  },
  async testConnection() {
    return { success: true }
  },
  async handleIncomingWebhook(payload): Promise<TelegramCommandMessage> {
    return {
      id: `tcm_${Date.now()}`,
      chatId: 'mock',
      messageText: String((payload as Record<string, unknown>)?.['text'] ?? ''),
      receivedAt: new Date().toISOString(),
      status: 'received',
    }
  },
}
