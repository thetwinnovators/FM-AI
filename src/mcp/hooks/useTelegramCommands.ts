import { useCallback, useEffect, useRef, useState } from 'react'
import type { TelegramCommandMessage } from '../types.js'
import {
  getTelegramMessages,
  sendTelegramMessage,
  testTelegramConnection,
} from '../services/telegramService.js'
import { localMCPStorage } from '../storage/localMCPStorage.js'
import {
  startPolling,
  stopPolling,
  isPolling,
} from '../services/telegramPollingService.js'
import { processTelegramCommand } from '../services/telegramBotResponder.js'

function getTelegramConfig(): { token: string; chatId: string } | null {
  const integration = localMCPStorage.getIntegration('integ_telegram')
  const token = integration?.config?.['token'] ?? ''
  const chatId = integration?.config?.['chatId'] ?? ''
  return token && chatId ? { token, chatId } : null
}

export function useTelegramCommands() {
  const [messages, setMessages] = useState<TelegramCommandMessage[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const pollingRef = useRef(false)

  const reload = useCallback(() => {
    setMessages(getTelegramMessages())
  }, [])

  // Reload messages on mount and whenever an inbound message arrives
  useEffect(() => {
    reload()
    function onInbound() { reload() }
    window.addEventListener('fm-telegram-inbound', onInbound)
    return () => window.removeEventListener('fm-telegram-inbound', onInbound)
  }, [reload])

  // Start polling when connected, stop on unmount
  useEffect(() => {
    const config = getTelegramConfig()
    const integration = localMCPStorage.getIntegration('integ_telegram')
    if (!config || integration?.status !== 'connected') return

    if (pollingRef.current) return
    pollingRef.current = true
    setPolling(true)

    startPolling(config.token, config.chatId, async (text, fromName) => {
      // Save inbound message to local log
      localMCPStorage.saveTelegramMessage({
        id: `tcm_in_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        chatId: config.chatId,
        messageText: `${fromName}: ${text}`,
        receivedAt: new Date().toISOString(),
        status: 'received',
      })
      window.dispatchEvent(new CustomEvent('fm-telegram-inbound'))

      const reply = await processTelegramCommand(text, fromName)

      // Save bot reply to local log too
      localMCPStorage.saveTelegramMessage({
        id: `tcm_out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        chatId: config.chatId,
        messageText: `FlowMap AI: ${reply.replace(/<[^>]+>/g, '')}`,
        receivedAt: new Date().toISOString(),
        status: 'processed',
      })
      window.dispatchEvent(new CustomEvent('fm-telegram-inbound'))

      return reply
    })

    return () => {
      stopPolling()
      pollingRef.current = false
      setPolling(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return {
    messages,
    sending,
    sendError,
    send,
    testConnection,
    reload,
    polling: polling || isPolling(),
  }
}
