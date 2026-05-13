export type RationaleInput =
  | { type: 'momentum_breakout'; symbol: string; direction: 'long' | 'short'; triggerPrice: number; refLevel: number; volumeMultiple: number }
  | { type: 'vwap_reclaim';     symbol: string; triggerPrice: number; vwap: number; volumeMultiple: number; barsBelowVwap: number }
  | { type: 'orb';              symbol: string; direction: 'long' | 'short'; triggerPrice: number; orbHigh: number; orbLow: number; volumeMultiple: number }

function fmt(n: number) { return n.toFixed(2) }
function fmtX(n: number) { return n.toFixed(1) }

export function buildRationale(input: RationaleInput): string {
  switch (input.type) {
    case 'momentum_breakout': {
      const dir = input.direction === 'long' ? 'broke above' : 'broke below'
      return `${input.symbol} $${fmt(input.triggerPrice)} ${dir} 5-bar high of $${fmt(input.refLevel)} on volume ${fmtX(input.volumeMultiple)}× avg`
    }
    case 'vwap_reclaim':
      return `${input.symbol} reclaimed VWAP ($${fmt(input.vwap)}) at $${fmt(input.triggerPrice)} after ${input.barsBelowVwap} bars below — volume ${fmtX(input.volumeMultiple)}× prior bar`
    case 'orb': {
      const level = input.direction === 'long'
        ? `ORB high $${fmt(input.orbHigh)}`
        : `ORB low $${fmt(input.orbLow)}`
      const dir = input.direction === 'long' ? 'above' : 'below'
      return `${input.symbol} broke ${dir} ${level} at $${fmt(input.triggerPrice)} — volume ${fmtX(input.volumeMultiple)}× avg`
    }
  }
}
