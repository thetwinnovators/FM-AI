import type { TelegramCommandMessage } from '../types.js'

// v2 stub — wire real webhook parsing and execution routing here.
// Called by a future webhook endpoint; signature is stable.
export async function routeIncomingCommand(
  _payload: unknown
): Promise<TelegramCommandMessage | null> {
  return null
}
