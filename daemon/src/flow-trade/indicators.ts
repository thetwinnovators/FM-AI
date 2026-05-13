export class VwapCalc {
  private cumPV = 0
  private cumVol = 0

  update(price: number, volume: number): number {
    this.cumPV += price * volume
    this.cumVol += volume
    return this.cumVol === 0 ? price : this.cumPV / this.cumVol
  }

  get(): number {
    return this.cumVol === 0 ? 0 : this.cumPV / this.cumVol
  }

  reset(): void {
    this.cumPV = 0
    this.cumVol = 0
  }
}

export interface Bar {
  symbol: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  timestamp: number // ms, floored to minute
}

export class BarAggregator {
  private readonly maxBars = 25
  private completed = new Map<string, Bar[]>()
  private current = new Map<string, Bar>()

  tick(symbol: string, price: number, volume: number, ts: number): void {
    const barTs = Math.floor(ts / 60_000) * 60_000
    const cur = this.current.get(symbol)

    if (!cur || cur.timestamp !== barTs) {
      if (cur) {
        const list = this.completed.get(symbol) ?? []
        list.push(cur)
        if (list.length > this.maxBars) list.shift()
        this.completed.set(symbol, list)
      }
      this.current.set(symbol, {
        symbol, open: price, high: price, low: price, close: price, volume, timestamp: barTs,
      })
    } else {
      cur.high = Math.max(cur.high, price)
      cur.low = Math.min(cur.low, price)
      cur.close = price
      cur.volume += volume
    }
  }

  getBars(symbol: string): Bar[] {
    return this.completed.get(symbol) ?? []
  }

  reset(symbol?: string): void {
    if (symbol) {
      this.completed.delete(symbol)
      this.current.delete(symbol)
    } else {
      this.completed.clear()
      this.current.clear()
    }
  }
}
