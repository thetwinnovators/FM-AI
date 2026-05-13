import { randomUUID } from 'node:crypto'
import type { Tick, RawSignal } from '../types.js'
import type { Bar } from '../indicators.js'
import { buildRationale } from '../rationaleBuilder.js'
import { isOrbWindow } from '../marketTime.js'

const COOLDOWN_MS = 60 * 60 * 1000
const VOL_FACTOR  = 1.5
const EXPIRY_MS   = 60 * 60 * 1000

interface OrbRange { high: number; low: number; locked: boolean }

export class OrbDetectorRule {
  private ranges    = new Map<string, OrbRange>()
  private cooldowns = new Map<string, number>()

  evaluate(tick: Tick, bars: Bar[]): RawSignal | null {
    if ((this.cooldowns.get(tick.symbol) ?? 0) + COOLDOWN_MS > tick.timestamp) return null

    const inOrb = isOrbWindow()
    let range = this.ranges.get(tick.symbol)

    if (inOrb) {
      if (!range) {
        this.ranges.set(tick.symbol, { high: tick.price, low: tick.price, locked: false })
      } else if (!range.locked) {
        range.high = Math.max(range.high, tick.price)
        range.low  = Math.min(range.low,  tick.price)
      }
      return null
    }

    if (!range) return null
    range.locked = true

    const recent = bars.slice(-20)
    if (recent.length === 0) return null
    const avgVol = recent.reduce((s, b) => s + b.volume, 0) / recent.length
    if (avgVol === 0) return null
    const volMult = tick.volume / avgVol
    if (volMult < VOL_FACTOR) return null

    let direction: 'long' | 'short' | null = null
    if      (tick.price > range.high) direction = 'long'
    else if (tick.price < range.low)  direction = 'short'
    if (!direction) return null

    this.cooldowns.set(tick.symbol, tick.timestamp)

    const stop   = direction === 'long'  ? range.high * 0.995 : range.low * 1.005
    const target = direction === 'long'
      ? tick.price + (tick.price - stop) * 2
      : tick.price - (stop - tick.price) * 2
    const rr = Math.abs(target - tick.price) / Math.abs(tick.price - stop)

    return {
      id: randomUUID(),
      symbol: tick.symbol,
      setup_type: 'orb',
      direction,
      trigger_price:   tick.price,
      trigger_volume:  tick.volume,
      entry_zone_low:  direction === 'long'  ? tick.price         : tick.price * 0.995,
      entry_zone_high: direction === 'long'  ? tick.price * 1.005 : tick.price,
      stop_level:      stop,
      target_level:    target,
      risk_reward:     Math.round(rr * 10) / 10,
      rationale: buildRationale({ type: 'orb', symbol: tick.symbol, direction, triggerPrice: tick.price, orbHigh: range.high, orbLow: range.low, volumeMultiple: volMult }),
      fired_at:   new Date(tick.timestamp).toISOString(),
      expires_at: new Date(tick.timestamp + EXPIRY_MS).toISOString(),
    }
  }

  resetCooldowns(): void {
    this.cooldowns.clear()
    this.ranges.clear()
  }
}
