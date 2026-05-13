import type Database from 'better-sqlite3'
import type { DailyRisk } from './types.js'
import { getTradeDateNY } from './marketTime.js'

const MAX_POSITIONS    = 3
const MAX_POS_PCT      = 0.10
const DAILY_LOSS_PCT   = 0.02

export class RiskEngine {
  constructor(private readonly db: Database.Database) {}

  private ensureToday(): DailyRisk {
    const date = getTradeDateNY()
    let row = this.db.prepare('SELECT * FROM daily_risk WHERE trade_date = ?').get(date) as DailyRisk | undefined
    if (!row) {
      this.db.prepare(
        'INSERT INTO daily_risk (trade_date, realized_pnl, open_position_count, blocked) VALUES (?, 0, 0, 0)',
      ).run(date)
      row = this.db.prepare('SELECT * FROM daily_risk WHERE trade_date = ?').get(date) as DailyRisk
    }
    return row
  }

  canOpenSignal(accountBalance: number): { allowed: boolean; reason?: string } {
    const today = this.ensureToday()
    if (today.blocked) return { allowed: false, reason: 'Daily loss limit reached' }
    if (today.open_position_count >= MAX_POSITIONS) return { allowed: false, reason: 'Max positions reached' }
    if (today.realized_pnl <= -(accountBalance * DAILY_LOSS_PCT)) {
      this.setBlocked(true)
      return { allowed: false, reason: 'Daily loss limit reached' }
    }
    return { allowed: true }
  }

  setBlocked(blocked: boolean): void {
    this.db.prepare('UPDATE daily_risk SET blocked = ? WHERE trade_date = ?')
      .run(blocked ? 1 : 0, getTradeDateNY())
  }

  recordPnl(pnl: number): void {
    const date = getTradeDateNY()
    this.db.prepare('UPDATE daily_risk SET realized_pnl = realized_pnl + ? WHERE trade_date = ?').run(pnl, date)
  }

  incrementPositions(): void {
    this.db.prepare('UPDATE daily_risk SET open_position_count = open_position_count + 1 WHERE trade_date = ?').run(getTradeDateNY())
  }

  decrementPositions(): void {
    this.db.prepare('UPDATE daily_risk SET open_position_count = MAX(0, open_position_count - 1) WHERE trade_date = ?').run(getTradeDateNY())
  }

  dailyReset(): void {
    const date = getTradeDateNY()
    const now  = new Date().toISOString()
    this.db.prepare(`
      INSERT INTO daily_risk (trade_date, realized_pnl, open_position_count, blocked, reset_at)
      VALUES (?, 0, 0, 0, ?)
      ON CONFLICT(trade_date) DO UPDATE SET
        realized_pnl = 0, open_position_count = 0, blocked = 0, reset_at = ?
    `).run(date, now, now)
  }

  getDailyRisk(): DailyRisk { return this.ensureToday() }

  maxPositionSize(accountBalance: number): number { return accountBalance * MAX_POS_PCT }
}
