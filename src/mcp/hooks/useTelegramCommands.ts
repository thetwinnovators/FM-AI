import { useCallback, useEffect, useState } from 'react'
import type { TelegramCommandMessage } from '../types.js'
import {
  getTelegramMessages,
  sendTelegramMessage,
  testTelegramConnection,
} from '../services/telegramService.js'

export function useTelegramCommands() {
  const [messages, setMessages] = useState<TelegramCommandMessage[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setMessages(getTelegramMessages())
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function send(text: string): Promise<boolean> {
    setSending(true)
    setSendError(null)
    try {
      const result = await sendTelegramMessage(text)
      if (!result.success) setSendError(result.error ?? 'Failed to send')
      reload()
      return result.success
    } finally {
      setSending(false)
    }
  }

  async function testConnection(): Promise<{ success: boolean; error?: string }> {
    return testTelegramConnection()
  }

  return { messages, sending, sendError, send, testConnection, reload }
}
