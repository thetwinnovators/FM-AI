import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { openFlowTradeDb } from './db.js'
import { SseHub } from './sseHub.js'
import { Scheduler } from './scheduler.js'
import { AlpacaBridge, saveAlpacaCredentials } from './alpacaBridge.js'
import { Scanner } from './scanner.js'
import { RiskEngine } from './riskEngine.js'
import { getNextResetMs, getNextSweepMs, getTradeDateNY, isMarketOpen } from './marketTime.js'
import type { RawSignal, Signal, Position } from './types.js'

export class FlowTradeModule {
  private readonly db:          Database.Database
  private readonly hub:         SseHub
  private readonly scheduler:   Scheduler
  private readonly scanner:     Scanner
  private readonly riskEngine:  RiskEngine
  private bridge:               AlpacaBridge | null = null
  private setupRequired = false
  private accountBalance = 100_000

  constructor(dbPath: string) {
    this.db         = openFlowTradeDb(dbPath)
    this.hub        = new SseHub()
    this.scheduler  = new Scheduler()
    this.scanner    = new Scanner()
    this.riskEngine = new RiskEngine(this.db)
  }

  async start(): Promise<void> {
    const bridge = new AlpacaBridge(this.hub, (tick) => this.handleTick(tick))
    const ok     = await bridge.loadCredentials()
    if (!ok) { this.setupRequired = true; return }

    this.bridge = bridge
    bridge.start(this.activeSymbols())
    this.scheduleReset()
    this.scheduleSweep()
  }

  stop(): void {
    this.bridge?.stop()
    this.scheduler.clear()
  }

  async reconnect(): Promise<{ connected: boolean; error?: string }> {
    this.bridge?.stop()
    this.bridge = null

    const bridge = new AlpacaBridge(this.hub, (tick) => this.handleTick(tick))
    const ok     = await bridge.loadCredentials()
    if (!ok) {
      this.setupRequired = true
      return { connected: false, error: 'Credentials not found or invalid at ~/.flowmap/alpaca-paper.json' }
    }

    this.setupRequired = false
    this.bridge = bridge
    bridge.start(this.activeSymbols())
    return { connected: true }
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  private activeSymbols(): string[] {
    return (this.db.prepare('SELECT symbol FROM watchlist WHERE active = 1').all() as { symbol: string }[])
      .map((r) => r.symbol)
  }

  private handleTick(tick: any): void {
    const signals = this.scanner.onTick(tick)
    for (const raw of signals) {
      const check = this.riskEngine.canOpenSignal(this.accountBalance)
      const status = check.allowed ? 'active' : 'risk_blocked'
      this.writeSignal(raw, status)
      this.hub.emit({ type: check.allowed ? 'signal' : 'signal_blocked', data: { ...raw, status } })
    }
  }

  private writeSignal(raw: RawSignal, status: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO signals
        (id, symbol, setup_type, direction, trigger_price, trigger_volume,
         entry_zone_low, entry_zone_high, stop_level, target_level,
         risk_reward, rationale, status, fired_at, expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      raw.id, raw.symbol, raw.setup_type, raw.direction,
      raw.trigger_price, raw.trigger_volume,
      raw.entry_zone_low, raw.entry_zone_high,
      raw.stop_level, raw.target_level,
      raw.risk_reward, raw.rationale,
      status, raw.fired_at, raw.expires_at,
    )
  }

  private scheduleReset(): void {
    this.scheduler.scheduleReset(getNextResetMs(), () => this.dailyReset())
  }

  private scheduleSweep(): void {
    this.scheduler.scheduleSweep(getNextSweepMs(), () => this.eodSweep())
  }

  private dailyReset(): void {
    const now = new Date().toISOString()
    const open = this.db.prepare("SELECT * FROM positions WHERE status = 'open'").all() as Position[]
    for (const pos of open) {
      this.db.prepare("UPDATE positions SET status = 'force_closed', closed_at = ? WHERE id = ?").run(now, pos.id)
      this.riskEngine.decrementPositions()
    }
    if (open.length > 0) this.hub.emit({ type: 'positions_reset', data: { count: open.length } })

    this.riskEngine.dailyReset()
    this.scanner.dailyReset()
    this.hub.emit({ type: 'risk_unblocked' })
    this.bridge?.updateSymbols(this.activeSymbols())
    this.scheduleReset()
    this.scheduleSweep()
  }

  private eodSweep(): void {
    const now  = new Date().toISOString()
    const open = this.db.prepare("SELECT * FROM positions WHERE status = 'open'").all() as Position[]
    for (const pos of open) {
      this.db.prepare("UPDATE positions SET status = 'force_closed', closed_at = ? WHERE id = ?").run(now, pos.id)
      this.riskEngine.decrementPositions()
    }
    if (open.length > 0) this.hub.emit({ type: 'market_close_sweep', data: { count: open.length } })
  }

  // ─── Alpaca REST ─────────────────────────────────────────────────────────

  private async alpacaFetch(
    path: string,
    options: { method?: string; body?: unknown; base?: string } = {},
  ): Promise<any> {
    const creds = this.bridge?.getCredentials()
    if (!creds) throw new Error('Alpaca credentials not configured')
    const { method = 'GET', body, base = 'https://paper-api.alpaca.markets' } = options
    const headers: Record<string, string> = {
      'APCA-API-KEY-ID':     creds.key,
      'APCA-API-SECRET-KEY': creds.secret,
    }
    if (body) headers['Content-Type'] = 'application/json'
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Alpaca API ${res.status}: ${text}`)
    }
    if (res.status === 204) return null
    return res.json()
  }

  // ─── Routes ──────────────────────────────────────────────────────────────

  registerRoutes(app: FastifyInstance, requireAuth: (req: any, reply: any) => boolean): void {

    app.get('/flow-trade/status', (req, reply) => {
      if (!requireAuth(req, reply)) return
      return {
        setupRequired:  this.setupRequired,
        feedConnected:  !!this.bridge && !this.setupRequired,
        marketOpen:     isMarketOpen(),
        riskBlocked:    this.riskEngine.getDailyRisk().blocked === 1,
        tradeDate:      getTradeDateNY(),
      }
    })

    app.get('/flow-trade/credentials', (req, reply) => {
      if (!requireAuth(req, reply)) return
      const creds = this.bridge?.getCredentials()
      return {
        configured: !this.setupRequired,
        keyHint: creds?.key ? `${creds.key.slice(0, 4)}…` : null,
      }
    })

    app.post('/flow-trade/credentials', async (req, reply) => {
      if (!requireAuth(req, reply)) return
      const { key, secret } = (req.body ?? {}) as { key?: string; secret?: string }
      if (!key?.trim() || !secret?.trim())
        return reply.code(400).send({ error: 'key and secret required' })
      try {
        await saveAlpacaCredentials(key.trim(), secret.trim())
        const result = await this.reconnect()
        return { saved: true, connected: result.connected }
      } catch (e: any) {
        return reply.code(500).send({ error: e.message })
      }
    })

    app.post('/flow-trade/reconnect', async (req, reply) => {
      if (!requireAuth(req, reply)) return
      try {
        const result = await this.reconnect()
        return reply.code(result.connected ? 200 : 503).send(result)
      } catch (e: any) {
        return reply.code(500).send({ connected: false, error: e.message })
      }
    })

    app.get('/flow-trade/watchlist', (req, reply) => {
      if (!requireAuth(req, reply)) return
      return this.db.prepare('SELECT * FROM watchlist ORDER BY pinned DESC, symbol ASC').all()
    })

    app.post('/flow-trade/watchlist', (req, reply) => {
      if (!requireAuth(req, reply)) return
      const { symbol } = req.body as { symbol?: string }
      if (!symbol) return reply.code(400).send({ error: 'symbol required' })
      const sym = symbol.toUpperCase().trim()
      this.db.prepare('INSERT OR IGNORE INTO watchlist (symbol, pinned, active, added_at) VALUES (?, 0, 1, ?)').run(sym, new Date().toISOString())
      this.bridge?.updateSymbols(this.activeSymbols())
      return reply.code(201).send({ symbol: sym })
    })

    app.delete('/flow-trade/watchlist/:symbol', (req, reply) => {
      if (!requireAuth(req, reply)) return
      const { symbol } = req.params as { symbol: string }
      this.db.prepare('UPDATE watchlist SET active = 0 WHERE symbol = ?').run(symbol.toUpperCase())
      return reply.code(204).send()
    })

    app.patch('/flow-trade/watchlist/:symbol/pin', (req, reply) => {
      if (!requireAuth(req, reply)) return
      const { symbol } = req.params as { symbol: string }
      const row = this.db.prepare('SELECT pinned FROM watchlist WHERE symbol = ?').get(symbol.toUpperCase()) as { pinned: number } | undefined
      if (!row) return reply.code(404).send({ error: 'not found' })
      const pinned = row.pinned === 1 ? 0 : 1
      this.db.prepare('UPDATE watchlist SET pinned = ? WHERE symbol = ?').run(pinned, symbol.toUpperCase())
      return { symbol: symbol.toUpperCase(), pinned: pinned === 1 }
    })

    app.get('/flow-trade/signals', (req, reply) => {
      if (!requireAuth(req, reply)) return
      return this.db.prepare('SELECT * FROM signals ORDER BY fired_at DESC LIMIT 50').all()
    })

    app.get('/flow-trade/positions', (req, reply) => {
      if (!requireAuth(req, reply)) return
      const today = getTradeDateNY()
      return this.db.prepare(
        "SELECT * FROM positions WHERE status = 'open' OR DATE(opened_at) = ? ORDER BY opened_at DESC",
      ).all(today)
    })

    app.get('/flow-trade/alpaca/positions', async (req, reply) => {
      if (!requireAuth(req, reply)) return
      if (this.setupRequired) return reply.code(503).send({ error: 'Alpaca not configured' })
      try { return await this.alpacaFetch('/v2/positions') }
      catch (e: any) { return reply.code(502).send({ error: e.message }) }
    })

    app.get('/flow-trade/alpaca/account', async (req, reply) => {
      if (!requireAuth(req, reply)) return
      if (this.setupRequired) return reply.code(503).send({ error: 'Alpaca not configured' })
      try { return await this.alpacaFetch('/v2/account') }
      catch (e: any) { return reply.code(502).send({ error: e.message }) }
    })

    app.get('/flow-trade/alpaca/orders', async (req, reply) => {
      if (!requireAuth(req, reply)) return
      if (this.setupRequired) return reply.code(503).send({ error: 'Alpaca not configured' })
      try { return await this.alpacaFetch('/v2/orders?status=open&limit=50') }
      catch (e: any) { return reply.code(502).send({ error: e.message }) }
    })

    app.delete('/flow-trade/alpaca/orders/:orderId', async (req, reply) => {
      if (!requireAuth(req, reply)) return
      if (this.setupRequired) return reply.code(503).send({ error: 'Alpaca not configured' })
      const { orderId } = req.params as { orderId: string }
      try {
        await this.alpacaFetch(`/v2/orders/${orderId}`, { method: 'DELETE' })
        return reply.code(204).send()
      } catch (e: any) { return reply.code(502).send({ error: e.message }) }
    })

    app.get('/flow-trade/alpaca/bars/:symbol', async (req, reply) => {
      if (!requireAuth(req, reply)) return
      if (this.setupRequired) return reply.code(503).send({ error: 'Alpaca not configured' })
      try {
        const { symbol } = req.params as { symbol: string }
        const { timeframe = '5Min' } = req.query as { timeframe?: string }
        const nyDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
        const start  = encodeURIComponent(`${nyDate}T00:00:00-04:00`)
        return await this.alpacaFetch(
          `/v2/stocks/${symbol.toUpperCase()}/bars?timeframe=${timeframe}&start=${start}&limit=100&feed=iex`,
          { base: 'https://data.alpaca.markets' },
        )
      } catch (e: any) { return reply.code(502).send({ error: e.message }) }
    })

    // ── Place a bracket order from a signal ───────────────────────────────
    app.post('/flow-trade/orders', async (req, reply) => {
      if (!requireAuth(req, reply)) return
      if (this.setupRequired) return reply.code(503).send({ error: 'Alpaca not configured' })

      const { signalId, qty = 1 } = (req.body ?? {}) as { signalId?: string; qty?: number }
      if (!signalId) return reply.code(400).send({ error: 'signalId required' })

      const signal = this.db.prepare('SELECT * FROM signals WHERE id = ?').get(signalId) as Signal | undefined
      if (!signal) return reply.code(404).send({ error: 'Signal not found' })
      if (signal.status !== 'active') return reply.code(400).send({ error: 'Signal is no longer active' })

      const check = this.riskEngine.canOpenSignal(this.accountBalance)
      if (!check.allowed) return reply.code(400).send({ error: check.reason })

      const shares    = Math.max(1, Math.floor(Number(qty) || 1))
      const entryPrice = ((signal.entry_zone_low + signal.entry_zone_high) / 2).toFixed(2)
      const isLong     = signal.direction === 'long'

      const orderBody = {
        symbol:         signal.symbol,
        qty:            String(shares),
        side:           isLong ? 'buy' : 'sell',
        type:           'limit',
        time_in_force:  'day',
        limit_price:    entryPrice,
        order_class:    'bracket',
        stop_loss:      { stop_price:   signal.stop_level.toFixed(2) },
        take_profit:    { limit_price:  signal.target_level.toFixed(2) },
      }

      try {
        const order = await this.alpacaFetch('/v2/orders', { method: 'POST', body: orderBody })

        const posId = `pos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        this.db.prepare(`
          INSERT INTO positions
            (id, signal_id, symbol, direction, entry_price, stop_level, target_level, quantity, status, opened_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
        `).run(
          posId, signalId, signal.symbol, signal.direction,
          parseFloat(entryPrice), signal.stop_level, signal.target_level,
          shares, new Date().toISOString(),
        )

        this.riskEngine.incrementPositions()
        this.hub.emit({ type: 'position_opened', data: { symbol: signal.symbol, direction: signal.direction, qty: shares } })

        return reply.code(201).send({
          orderId:     order.id,
          positionId:  posId,
          symbol:      signal.symbol,
          qty:         shares,
          entryPrice:  parseFloat(entryPrice),
          stopLevel:   signal.stop_level,
          targetLevel: signal.target_level,
        })
      } catch (e: any) {
        return reply.code(502).send({ error: e.message })
      }
    })

    app.get('/flow-trade/daily-risk', (req, reply) => {
      if (!requireAuth(req, reply)) return
      return this.riskEngine.getDailyRisk()
    })

    app.get('/flow-trade/events', (req, reply) => {
      if (!requireAuth(req, reply)) return
      reply.raw.writeHead(200, {
        'Content-Type':    'text/event-stream',
        'Cache-Control':   'no-cache',
        'Connection':      'keep-alive',
        'X-Accel-Buffering': 'no',
      })
      reply.raw.write('data: {"type":"connected"}\n\n')

      const remove = this.hub.add((event) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      })

      req.raw.on('close', remove)
    })
  }
}
