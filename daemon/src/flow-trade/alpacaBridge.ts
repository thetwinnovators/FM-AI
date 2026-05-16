import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { Tick } from './types.js'
import type { SseHub } from './sseHub.js'

const CREDS_PATH    = join(homedir(), '.flowmap', 'alpaca-paper.json')
const WS_URL        = 'wss://stream.data.alpaca.markets/v2/iex'
const STALE_TIMEOUT = 15_000
const MAX_BACKOFF   = 30_000

interface Creds { key: string; secret: string }

export async function saveAlpacaCredentials(key: string, secret: string): Promise<void> {
  const dir = join(homedir(), '.flowmap')
  await mkdir(dir, { recursive: true })
  await writeFile(CREDS_PATH, JSON.stringify({ key, secret }, null, 2), 'utf-8')
}

export class AlpacaBridge {
  private ws: WebSocket | null = null
  private creds: Creds | null  = null
  private symbols = new Set<string>()
  private backoff = 1_000
  private running = false
  private staleTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly hub: SseHub,
    private readonly onTick: (tick: Tick) => void,
  ) {}

  getCredentials(): Creds | null { return this.creds }

  async loadCredentials(): Promise<boolean> {
    try {
      const raw  = (await readFile(CREDS_PATH, 'utf-8')).replace(/^﻿/, '')
      const json = JSON.parse(raw)
      if (!json.key || !json.secret) return false
      this.creds = json as Creds
      return true
    } catch { return false }
  }

  start(symbols: string[]): void {
    this.symbols = new Set(symbols)
    this.running = true
    this.connect()
  }

  stop(): void {
    this.running = false
    if (this.staleTimer) clearTimeout(this.staleTimer)
    this.ws?.close()
  }

  updateSymbols(symbols: string[]): void {
    this.symbols = new Set(symbols)
    if (this.ws?.readyState === WebSocket.OPEN) {
      const syms = [...this.symbols]
      this.ws.send(JSON.stringify({ action: 'subscribe', trades: syms, quotes: syms }))
    }
  }

  private connect(): void {
    if (!this.creds || !this.running) return

    const ws = new WebSocket(WS_URL)
    this.ws  = ws

    ws.addEventListener('open', () => {
      this.backoff = 1_000
      ws.send(JSON.stringify({ action: 'auth', key: this.creds!.key, secret: this.creds!.secret }))
    })

    ws.addEventListener('message', (ev: MessageEvent) => {
      this.resetStaleTimer()
      try {
        const msgs = JSON.parse(String(ev.data)) as Array<Record<string, unknown>>
        for (const msg of msgs) this.handleMsg(msg)
      } catch { /* ignore malformed */ }
    })

    ws.addEventListener('close', () => {
      if (!this.running) return
      this.hub.emit({ type: 'feed_reconnecting', data: { delayMs: this.backoff } })
      setTimeout(() => this.connect(), this.backoff)
      this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF)
    })

    ws.addEventListener('error', () => { /* always followed by close */ })
  }

  private handleMsg(msg: Record<string, unknown>): void {
    if (msg.T === 'success' && msg.msg === 'authenticated') {
      const syms = [...this.symbols]
      this.ws!.send(JSON.stringify({ action: 'subscribe', trades: syms, quotes: syms }))
      this.hub.emit({ type: 'feed_connected' })
    } else if (msg.T === 't') {
      this.onTick({
        symbol:    String(msg.S ?? ''),
        price:     Number(msg.p ?? 0),
        volume:    Number(msg.s ?? 0),
        timestamp: new Date(String(msg.t ?? Date.now())).getTime(),
        vwap:      Number(msg.vw ?? 0),
      })
    }
  }

  private resetStaleTimer(): void {
    if (this.staleTimer) clearTimeout(this.staleTimer)
    this.staleTimer = setTimeout(() => {
      this.hub.emit({ type: 'feed_stale' })
    }, STALE_TIMEOUT)
  }
}
