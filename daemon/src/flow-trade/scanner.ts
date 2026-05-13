import type { Tick, RawSignal } from './types.js'
import { BarAggregator, VwapCalc } from './indicators.js'
import { MomentumBreakoutRule } from './rules/momentumBreakout.js'
import { VwapReclaimRule } from './rules/vwapReclaim.js'
import { OrbDetectorRule } from './rules/orbDetector.js'
import { isMarketOpen } from './marketTime.js'

export class Scanner {
  private readonly bars     = new BarAggregator()
  private readonly vwapMap  = new Map<string, VwapCalc>()
  private readonly momentum = new MomentumBreakoutRule()
  private readonly vwap     = new VwapReclaimRule()
  private readonly orb      = new OrbDetectorRule()
  private paused = false

  onTick(tick: Tick): RawSignal[] {
    if (!isMarketOpen() || this.paused) return []

    this.bars.tick(tick.symbol, tick.price, tick.volume, tick.timestamp)

    let vc = this.vwapMap.get(tick.symbol)
    if (!vc) { vc = new VwapCalc(); this.vwapMap.set(tick.symbol, vc) }
    const enriched: Tick = { ...tick, vwap: vc.update(tick.price, tick.volume) }

    const bars    = this.bars.getBars(tick.symbol)
    const signals: RawSignal[] = []

    const m = this.momentum.evaluate(enriched, bars)
    if (m) signals.push(m)

    const v = this.vwap.evaluate(enriched, bars)
    if (v) signals.push(v)

    const o = this.orb.evaluate(enriched, bars)
    if (o) signals.push(o)

    return signals
  }

  pause():  void { this.paused = true  }
  resume(): void { this.paused = false }

  dailyReset(): void {
    this.bars.reset()
    this.vwapMap.clear()
    this.momentum.resetCooldowns()
    this.vwap.resetCooldowns()
    this.orb.resetCooldowns()
    this.paused = false
  }
}
