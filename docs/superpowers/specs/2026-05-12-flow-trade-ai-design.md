# Flow Trade AI — Design Spec

**Date:** 2026-05-12
**Status:** Approved

---

## Goal

Build a paper day-trading workspace inside FlowMap that uses deterministic rules to detect intraday setups (Momentum Breakout, VWAP Reclaim, Opening Range Breakout), enforces hard daily risk limits, and produces structured template-based rationale cards — with all live state owned by the daemon and the frontend acting as a pure display layer.

## Architecture

Flow Trade is a daemon-first module. The daemon owns the Alpaca WebSocket connection, all signal detection logic, risk enforcement, and SQLite persistence. The React frontend subscribes to daemon Server-Sent Events (SSE) for live updates and reads state via REST. The frontend never detects signals or manages positions directly.

## Tech Stack

- **Market data / paper fills:** Alpaca paper trading API (WebSocket streaming + REST)
- **Signal detection:** Deterministic TypeScript rules in the daemon
- **Persistence:** SQLite via `better-sqlite3` (existing daemon dependency)
- **Frontend transport:** SSE (`/flow-trade/events`) + REST endpoints on the existing Fastify daemon
- **Rationale cards:** Structured template strings built from rule output — no AI model dependency in v1
- **Framework:** React/JSX, Tailwind CSS (existing FlowMap patterns)

---

## Foundational Decisions

| # | Decision |
|---|----------|
| 1 | **Alpaca paper API** — market data + fills; daemon hosts the client; API key + secret stored in `~/.flowmap/alpaca-paper.json` |
| 2 | **Day trading only** — all positions close by market end; no overnight holds |
| 3 | **Deterministic rules detect + structured template explains** — no AI model in v1; rationale built from exact trigger values |
| 4 | **Hybrid watchlist** — curated 10-symbol default (SPY, QQQ, AAPL, NVDA, TSLA, MSFT, AMD, AMZN, META, GOOGL) + manual add/pin/unpin |
| 5 | **Three setup types** — Momentum Breakout, VWAP Reclaim, Opening Range Breakout; each independent with own rules and signal cards |
| 6 | **SQLite via daemon** — positions, signals, watchlist, daily risk, account snapshots; all writes go through daemon |
| 7 | **Hard limits + daily reset** — daily loss limit enforced; new signals blocked when limit hit; reset at 9:30 AM EST; force-close sweep at 3:55 PM EST |

---

## Daemon Modules

All new code lives under `daemon/src/flow-trade/`.

### AlpacaBridge

- WebSocket client: `wss://stream.data.alpaca.markets/v2/iex`
- Subscribes to trades + quotes for all active watchlist symbols
- Emits normalized tick events internally: `{ symbol, price, volume, timestamp, vwap }`
- Reconnects with exponential backoff: 1s → 2s → 4s → max 30s
- Stale feed detection: if no quote update received for 15 seconds, emits `feed_stale` event internally (and via SSE to frontend)
- Credentials loaded from `~/.flowmap/alpaca-paper.json` (`{ key: string, secret: string }`)
- If credentials file missing or invalid, AlpacaBridge does not start; daemon surfaces `setup_required` state

### Scanner

Consumes tick stream from AlpacaBridge. Runs three independent rule evaluators on every tick.

#### MomentumBreakout rule
- Fires when: price exceeds rolling 5-bar high AND volume ≥ 1.5× 20-bar average
- Direction: long (breakout above) or short (breakdown below)
- Cooldown: 30 minutes per symbol
- Minimum ADV filter: symbol must have average daily volume > 1M shares
- Duplicate suppression: same symbol + same setup type blocked until cooldown expires

#### VWAPReclaim rule
- Fires when: price was below VWAP for at least 3 consecutive bars, then crosses above VWAP with volume ≥ 1.3× prior bar
- Direction: long only (reclaim = bullish bias signal)
- VWAP calculated from 9:30 AM EST using cumulative tick data
- Cooldown: 30 minutes per symbol
- Same minimum ADV and duplicate suppression as above

#### ORBDetector rule
- Tracks first 15-minute range per symbol (9:30–9:45 AM EST): records `orb_high` and `orb_low`
- Fires on breakout above `orb_high` (long signal) or breakdown below `orb_low` (short signal)
- Volume confirmation: breakout bar volume ≥ 1.5× average
- ORB range resets each trading day at 9:30 AM EST
- Cooldown: 60 minutes per symbol (ORB is a once-per-session setup type)
- Same duplicate suppression

### RiskEngine

Stateful per-day gate. Reads and writes `daily_risk` table.

- Tracks per day: realized P&L, unrealized exposure, open position count
- Hard blocks:
  - Daily loss ≥ 2% of paper account balance → `blocked: true`; all new signals suppressed until next day reset
  - Max open positions: 3 simultaneous
  - Max single-position size: 10% of paper account balance
- Reset at 9:30 AM EST:
  - Clears `blocked` flag
  - Resets daily P&L counter
  - Clears per-symbol signal cooldowns
  - Any positions still open from prior session: marked `force_closed` in `positions` table, event written to signal journal, SSE `positions_reset` event pushed to frontend
- Force-close sweep at 3:55 PM EST:
  - All open positions marked `force_closed`
  - Written to `positions` table and signal journal
  - SSE `market_close_sweep` event pushed to frontend

### SQLite Schema

**`watchlist`**
```sql
CREATE TABLE watchlist (
  symbol TEXT PRIMARY KEY,
  pinned INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  added_at TEXT NOT NULL
);
```

**`signals`**
```sql
CREATE TABLE signals (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  setup_type TEXT NOT NULL,       -- 'momentum_breakout' | 'vwap_reclaim' | 'orb'
  direction TEXT NOT NULL,        -- 'long' | 'short'
  trigger_price REAL NOT NULL,
  trigger_volume REAL NOT NULL,
  entry_zone_low REAL NOT NULL,
  entry_zone_high REAL NOT NULL,
  stop_level REAL NOT NULL,
  target_level REAL NOT NULL,
  risk_reward REAL NOT NULL,
  rationale TEXT NOT NULL,        -- structured template string
  status TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'expired' | 'risk_blocked'
  fired_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
```

**`positions`**
```sql
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  signal_id TEXT REFERENCES signals(id),
  symbol TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry_price REAL NOT NULL,
  stop_level REAL NOT NULL,
  target_level REAL NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'closed' | 'force_closed'
  close_price REAL,
  pnl REAL,
  opened_at TEXT NOT NULL,
  closed_at TEXT
);
```

**`daily_risk`**
```sql
CREATE TABLE daily_risk (
  trade_date TEXT PRIMARY KEY,
  realized_pnl REAL DEFAULT 0,
  open_position_count INTEGER DEFAULT 0,
  blocked INTEGER DEFAULT 0,
  reset_at TEXT,
  force_closed_at TEXT
);
```

**`account_snapshots`**
```sql
CREATE TABLE account_snapshots (
  id TEXT PRIMARY KEY,
  balance REAL NOT NULL,
  buying_power REAL NOT NULL,
  snapshotted_at TEXT NOT NULL
);
```

---

## REST + SSE Endpoints

All under existing Fastify daemon on port 7779.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/flow-trade/status` | Daemon status, feed state, market open/closed, blocked flag |
| GET | `/flow-trade/watchlist` | All watchlist symbols with live price snapshot |
| POST | `/flow-trade/watchlist` | Add symbol `{ symbol: string }` |
| DELETE | `/flow-trade/watchlist/:symbol` | Remove symbol |
| PATCH | `/flow-trade/watchlist/:symbol/pin` | Toggle pin |
| GET | `/flow-trade/signals` | Recent signal history (last 50) |
| GET | `/flow-trade/positions` | Open + today's closed positions |
| GET | `/flow-trade/daily-risk` | Today's risk state |
| GET | `/flow-trade/events` | SSE stream |

**SSE event types:**
- `signal` — new signal fired
- `signal_expired` — signal passed its validity window
- `signal_blocked` — signal suppressed by risk engine
- `position_opened` — fill confirmed from Alpaca
- `position_closed` — position closed (manual or sweep)
- `positions_reset` — force-close at daily reset
- `market_close_sweep` — 3:55 PM force-close
- `risk_blocked` — daily limit hit
- `risk_unblocked` — daily reset cleared the block
- `feed_stale` — no quote update in 15s
- `feed_reconnecting` — AlpacaBridge reconnect attempt
- `feed_connected` — WebSocket confirmed live

---

## Frontend View (`/flow-trade`)

Route added to the existing React app alongside `/operator`.

### Three-panel layout

**Left — Watchlist panel**
- Symbol list with: live price, day change %, VWAP relationship badge (ABOVE / BELOW)
- Pin/unpin control per symbol
- "Add symbol" text input at bottom
- Inactive symbols shown dimmed

**Center — Signal feed**
- Live cards pushed via SSE, newest at top
- Each card:
  - Setup type badge (color-coded: MOMENTUM / VWAP RECLAIM / ORB)
  - Symbol + direction arrow
  - Structured rationale text (exact trigger values — e.g. "Price $183.42 broke 5-bar high of $182.90 on volume 2.1× avg")
  - Entry zone, stop, target, risk/reward ratio
  - Timestamp + cooldown countdown
  - Status chip: ACTIVE / EXPIRED / RISK BLOCKED
- Red "Risk limit reached — no new entries" banner when `blocked: true`

**Right — Risk dashboard**
- Daily P&L bar (green/red) vs daily loss limit
- Open positions list with entry, stop, target, unrealized P&L
- Position count vs max (e.g. "2 / 3")
- Time to market close countdown
- Next daily reset countdown
- Account balance snapshot (from last Alpaca snapshot)

### UI states

| State | Display |
|-------|---------|
| Daemon not running | "Start the FlowMap daemon to use Flow Trade" (same pattern as Operator) |
| Setup required (no credentials) | One-time configuration prompt for Alpaca paper API key + secret |
| Market closed | "Market closed" state with next open time; watchlist still shown |
| Feed stale | Yellow "Feed stale" badge in header; signal cards frozen |
| Feed reconnecting | "Reconnecting…" badge; signal cards grayed |
| Risk blocked | Red banner across signal feed; dashboard shows limit hit |
| No signals yet today | Empty state with setup type descriptions |

---

## Data Flow

### Normal path
1. Daemon starts → AlpacaBridge opens WebSocket → subscribes to active watchlist symbols
2. Each tick → Scanner evaluates all three rule types per symbol
3. Signal fires → RiskEngine checks daily limits → approved signal written to SQLite `signals` table
4. SSE `signal` event pushed to all connected frontends
5. User or FlowMap places a paper trade in Alpaca → fill event returned via WebSocket → position written to `positions` table → SSE `position_opened` pushed
6. Position closes (manual, target, stop, or sweep) → `positions` updated → SSE `position_closed` pushed

### Daily reset (9:30 AM EST)
1. RiskEngine force-closes any residual open positions → writes `force_closed` status + close event to `positions` and signal journal
2. Pushes SSE `positions_reset`
3. Clears `daily_risk` counters and `blocked` flag
4. AlpacaBridge re-subscribes to updated watchlist
5. Scanner resets ORB ranges and all cooldown timers

### 3:55 PM EST sweep
1. RiskEngine closes all open positions → writes `force_closed` to each
2. Pushes SSE `market_close_sweep`

### Error paths
- **WebSocket disconnect** — exponential backoff retry; SSE `feed_reconnecting` on each attempt, `feed_connected` on success
- **No quote update for 15s** — `feed_stale` SSE event; UI shows stale badge; scanner pauses signal evaluation
- **Daily loss limit hit** — `daily_risk.blocked = 1`; SSE `risk_blocked`; signal feed shows red banner
- **Invalid/missing credentials** — AlpacaBridge does not start; daemon returns `setup_required` from `/flow-trade/status`
- **Market closed** — Scanner detects outside 9:30–4:00 PM EST; pauses tick processing; SSE `market_closed` state

---

## Out of Scope for v1

- Auto-execution of trades (v1 is paper + manual action only)
- AI-generated natural language rationale (structured templates only)
- FlowMap topic → watchlist auto-population (Phase 2)
- Docker MCP gateway profile support (separate Operator addition)
- Multiple paper accounts
- Backtesting
- Options or futures
- Alerts / push notifications
