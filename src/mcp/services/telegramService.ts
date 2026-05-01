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
