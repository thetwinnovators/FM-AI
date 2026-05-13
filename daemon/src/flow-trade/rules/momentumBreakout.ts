import { randomUUID } from 'node:crypto'
import type { Tick, RawSignal } from '../types.js'
import type { Bar } from '../indicators.js'
import { buildRationale } from '../rationaleBuilder.js'

const COOLDOWN_MS  = 30 * 60 * 1000
const VOL_FACTOR   = 1.5
const AVG_BARS     = 20
const HIGH_BARS    = 5
const EXPIRY_MS    = 30 * 60 * 1000

export class MomentumBreakoutRule {
  private cooldowns = new Map<string, number>()

  evaluate(tick: Tick, bars: Bar[]): RawSignal | null {
    if (bars.length < AVG_BARS) return null
    if ((this.cooldowns.get(tick.symbol) ?? 0) + COOLDOWN_MS > tick.timestamp) return null

    const avgVol = bars.slice(-AVG_BARS).reduce((s, b) => s + b.volume, 0) / AVG_BARS
    if (avgVol === 0) return null
    const volMult = tick.volume / avgVol
    if (volMult < VOL_FACTOR) return null

    const recent = bars.slice(-HIGH_BARS)
    const barHigh = Math.max(...recent.map((b) => b.high))
    const barLow  = Math.min(...recent.map((b) => b.low))

    let direction: 'long' | 'short' | null = null
    let refLevel = 0
    if (tick.price > barHigh)      { direction = 'long';  refLevel = barHigh }
    else if (tick.price < barLow)  { direction = 'short'; refLevel = barLow  }
    if (!direction) return null

    this.cooldowns.set(tick.symbol, tick.timestamp)

    const stop   = direction === 'long'  ? tick.price * 0.99  : tick.price * 1.01
    const target = direction === 'long'
      ? tick.price + (tick.price - stop) * 2
      : tick.price - (stop - tick.price) * 2
    const rr = Math.abs(target - tick.price) / Math.abs(tick.price - stop)

    return {
      id: randomUUID(),
      symbol: tick.symbol,
      setup_type: 'momentum_breakout',
      direction,
      trigger_price:   tick.price,
      trigger_volume:  tick.volume,
      entry_zone_low:  direction === 'long'  ? tick.price         : tick.price * 0.995,
      entry_zone_high: direction === 'long'  ? tick.price * 1.005 : tick.price,
      stop_level:      stop,
      target_level:    target,
      risk_reward:     Math.round(rr * 10) / 10,
      rationale: buildRationale({ type: 'momentum_breakout', symbol: tick.symbol, direction, triggerPrice: tick.price, refLevel, volumeMultiple: volMult }),
      fired_at:   new Date(tick.timestamp).toISOString(),
      expires_at: new Date(tick.timestamp + EXPIRY_MS).toISOString(),
    }
  }

  resetCooldowns(): void { this.cooldowns.clear() }
}
