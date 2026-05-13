import { randomUUID } from 'node:crypto'
import type { Tick, RawSignal } from '../types.js'
import type { Bar } from '../indicators.js'
import { buildRationale } from '../rationaleBuilder.js'

const COOLDOWN_MS    = 30 * 60 * 1000
const VOL_FACTOR     = 1.3
const MIN_BARS_BELOW = 3
const EXPIRY_MS      = 30 * 60 * 1000

export class VwapReclaimRule {
  private cooldowns    = new Map<string, number>()
  private belowCount   = new Map<string, number>()
  private wasAbove     = new Map<string, boolean>()

  evaluate(tick: Tick, bars: Bar[]): RawSignal | null {
    if ((this.cooldowns.get(tick.symbol) ?? 0) + COOLDOWN_MS > tick.timestamp) return null

    const nowAbove  = tick.price >= tick.vwap
    const prevAbove = this.wasAbove.get(tick.symbol) ?? nowAbove

    if (!nowAbove) {
      this.belowCount.set(tick.symbol, (this.belowCount.get(tick.symbol) ?? 0) + 1)
      this.wasAbove.set(tick.symbol, false)
      return null
    }

    const count = this.belowCount.get(tick.symbol) ?? 0
    this.wasAbove.set(tick.symbol, true)
    this.belowCount.set(tick.symbol, 0)

    if (prevAbove || count < MIN_BARS_BELOW) return null

    // Volume confirmation vs prior bar
    const prevBarVol = bars.at(-1)?.volume ?? 1
    const volMult    = prevBarVol > 0 ? tick.volume / prevBarVol : 0
    if (volMult < VOL_FACTOR) return null

    this.cooldowns.set(tick.symbol, tick.timestamp)

    const stop   = tick.vwap * 0.995
    const target = tick.price + (tick.price - stop) * 2
    const rr     = Math.abs(target - tick.price) / Math.abs(tick.price - stop)

    return {
      id: randomUUID(),
      symbol: tick.symbol,
      setup_type: 'vwap_reclaim',
      direction: 'long',
      trigger_price:   tick.price,
      trigger_volume:  tick.volume,
      entry_zone_low:  tick.price,
      entry_zone_high: tick.price * 1.005,
      stop_level:      stop,
      target_level:    target,
      risk_reward:     Math.round(rr * 10) / 10,
      rationale: buildRationale({ type: 'vwap_reclaim', symbol: tick.symbol, triggerPrice: tick.price, vwap: tick.vwap, volumeMultiple: volMult, barsBelowVwap: count }),
      fired_at:   new Date(tick.timestamp).toISOString(),
      expires_at: new Date(tick.timestamp + EXPIRY_MS).toISOString(),
    }
  }

  resetCooldowns(): void {
    this.cooldowns.clear()
    this.belowCount.clear()
    this.wasAbove.clear()
  }
}
