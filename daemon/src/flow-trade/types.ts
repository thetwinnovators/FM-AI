export interface Tick {
  symbol: string
  price: number
  volume: number
  timestamp: number // ms epoch
  vwap: number
}

export type SetupType = 'momentum_breakout' | 'vwap_reclaim' | 'orb'
export type Direction = 'long' | 'short'
export type SignalStatus = 'active' | 'expired' | 'risk_blocked'
export type PositionStatus = 'open' | 'closed' | 'force_closed'

export interface RawSignal {
  id: string
  symbol: string
  setup_type: SetupType
  direction: Direction
  trigger_price: number
  trigger_volume: number
  entry_zone_low: number
  entry_zone_high: number
  stop_level: number
  target_level: number
  risk_reward: number
  rationale: string
  fired_at: string
  expires_at: string
}

export interface Signal extends RawSignal {
  status: SignalStatus
}

export interface Position {
  id: string
  signal_id: string | null
  symbol: string
  direction: Direction
  entry_price: number
  stop_level: number
  target_level: number
  quantity: number
  status: PositionStatus
  close_price: number | null
  pnl: number | null
  opened_at: string
  closed_at: string | null
}

export interface DailyRisk {
  trade_date: string
  realized_pnl: number
  open_position_count: number
  blocked: number
  reset_at: string | null
  force_closed_at: string | null
}

export interface AccountSnapshot {
  id: string
  balance: number
  buying_power: number
  snapshotted_at: string
}

export interface WatchlistEntry {
  symbol: string
  pinned: number
  active: number
  added_at: string
}
