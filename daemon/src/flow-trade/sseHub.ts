export type SseEventType =
  | 'signal' | 'signal_expired' | 'signal_blocked'
  | 'position_opened' | 'position_closed'
  | 'positions_reset' | 'market_close_sweep'
  | 'risk_blocked' | 'risk_unblocked'
  | 'feed_stale' | 'feed_reconnecting' | 'feed_connected'
  | 'connected'

export interface SseEvent { type: SseEventType; data?: unknown }

type SendFn = (event: SseEvent) => void

export class SseHub {
  private clients = new Set<SendFn>()

  add(sendFn: SendFn): () => void {
    this.clients.add(sendFn)
    return () => this.clients.delete(sendFn)
  }

  emit(event: SseEvent): void {
    for (const send of this.clients) {
      try { send(event) } catch { /* client disconnected */ }
    }
  }

  get size(): number { return this.clients.size }
}
