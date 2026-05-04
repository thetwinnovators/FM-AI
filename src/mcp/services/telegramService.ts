import type { TelegramCommandMessage } from '../types.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import { realTelegramProvider } from '../providers/realTelegramProvider.js'
import { mockTelegramProvider } from '../providers/mockTelegramProvider.js'

function getTelegramConfig(): { token: string; chatId: string } | null {
  const integration = localMCPStorage.getIntegration('integ_telegram')
  const token = integration?.config?.['token'] ?? ''
  const chatId = integration?.config?.['chatId'] ?? ''
  return token && chatId ? { token, chatId } : null
}

export async function sendTelegramMessage(
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = getTelegramConfig()
  const provider = config ? realTelegramProvider : mockTelegramProvider
  const params = config
    ? { token: config.token, chatId: config.chatId, text }
    : { token: '', chatId: '', text }
  return provider.sendMessage(params)
}

export async function testTelegramConnection(): Promise<{
  success: boolean
  error?: string
}> {
  const config = getTelegramConfig()
  if (!config) return { success: false, error: 'No bot token or chat ID configured' }
  return realTelegramProvider.testConnection(config)
}

export function getTelegramMessages(): TelegramCommandMessage[] {
  return localMCPStorage.listTelegramMessages()
}

/** Calls getUpdates to find the chat ID of whoever last messaged the bot. */
export async function detectTelegramChatId(
  token: string,
): Promise<{ chatId: string | null; error?: string }> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=10`,
    )
    const data = (await res.json()) as {
      ok: boolean
      description?: string
      result?: Array<{
        update_id: number
        message?: { chat?: { id?: number }; from?: { first_name?: string } }
      }>
    }
    if (!data.ok) {
      return { chatId: null, error: data.description ?? 'Telegram API error' }
    }
    const update = (data.result ?? []).find((u) => u.message?.chat?.id)
    if (!update?.message?.chat?.id) {
      return {
        chatId: null,
        error:
          'No messages found. Open Telegram, find your bot, and send it any message — then click Detect again.',
      }
    }
    return { chatId: String(update.message.chat.id) }
  } catch (e) {
    return { chatId: null, error: (e as Error).message }
  }
}
