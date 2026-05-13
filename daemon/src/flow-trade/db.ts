import Database from 'better-sqlite3'

const DEFAULT_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMD', 'AMZN', 'META', 'GOOGL']

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS watchlist (
    symbol   TEXT PRIMARY KEY,
    pinned   INTEGER DEFAULT 0,
    active   INTEGER DEFAULT 1,
    added_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS signals (
    id              TEXT PRIMARY KEY,
    symbol          TEXT NOT NULL,
    setup_type      TEXT NOT NULL,
    direction       TEXT NOT NULL,
    trigger_price   REAL NOT NULL,
    trigger_volume  REAL NOT NULL,
    entry_zone_low  REAL NOT NULL,
    entry_zone_high REAL NOT NULL,
    stop_level      REAL NOT NULL,
    target_level    REAL NOT NULL,
    risk_reward     REAL NOT NULL,
    rationale       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    fired_at        TEXT NOT NULL,
    expires_at      TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS positions (
    id           TEXT PRIMARY KEY,
    signal_id    TEXT REFERENCES signals(id),
    symbol       TEXT NOT NULL,
    direction    TEXT NOT NULL,
    entry_price  REAL NOT NULL,
    stop_level   REAL NOT NULL,
    target_level REAL NOT NULL,
    quantity     INTEGER NOT NULL,
    status       TEXT NOT NULL DEFAULT 'open',
    close_price  REAL,
    pnl          REAL,
    opened_at    TEXT NOT NULL,
    closed_at    TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS daily_risk (
    trade_date          TEXT PRIMARY KEY,
    realized_pnl        REAL DEFAULT 0,
    open_position_count INTEGER DEFAULT 0,
    blocked             INTEGER DEFAULT 0,
    reset_at            TEXT,
    force_closed_at     TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS account_snapshots (
    id             TEXT PRIMARY KEY,
    balance        REAL NOT NULL,
    buying_power   REAL NOT NULL,
    snapshotted_at TEXT NOT NULL
  )`,
]

export function openFlowTradeDb(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  for (const stmt of SCHEMA) db.prepare(stmt).run()

  const { c } = db.prepare('SELECT COUNT(*) as c FROM watchlist').get() as { c: number }
  if (c === 0) {
    const ins = db.prepare(
      'INSERT OR IGNORE INTO watchlist (symbol, pinned, active, added_at) VALUES (?, 0, 1, ?)',
    )
    const now = new Date().toISOString()
    for (const sym of DEFAULT_SYMBOLS) ins.run(sym, now)
  }

  return db
}
