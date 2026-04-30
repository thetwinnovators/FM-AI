# FlowMap SQLite Migration Plan

> Companion to `flowmap-persistence-strategy.md`. This document plans the move from
> the current localStorage-only state to a SQLite canonical store, and how to keep
> the schema portable for an eventual Postgres migration.

## Goals

1. Treat SQL as the canonical source of truth for durable knowledge (topics, saved
   content, manual ingest, memory evidence, follows, signals, provenance).
2. Keep all derived state — graph projections, search indices, caches — outside SQL
   and rebuildable from canonical rows.
3. Ship without breaking the current app: existing localStorage state migrates in
   on first run, then is retired.
4. Keep the schema portable to Postgres so Phase 2/3 doesn't require a rewrite.

Non-goals for this migration: multi-user, server-hosted operation, full-text search
over content bodies, embeddings, AI ranking. Those land later.

## Packaging decision: Tauri vs Electron vs sql.js

FlowMap today is a frontend-only Vite + React app. SQLite needs a host process or
embedded compile target. Three viable options:

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Tauri 2** | Rust backend, ~5-10 MB binary, modern, `tauri-plugin-sql` ships SQLite, Vite-native frontend keeps current code | Requires Rust toolchain to develop and build; Windows code-signing is per-platform | **Recommended** |
| **Electron** | Mature, huge ecosystem, easy npm-only dev, `better-sqlite3` is excellent | ~150 MB binary, heavy memory, slower cold start, security model more permissive | Acceptable fallback |
| **sql.js (WASM)** | Stays browser-only, no packaging change | "SQLite" in localStorage / OPFS isn't a real durability win — same blast radius as today, awkward backup story, no point relative to current state | Reject |
| Hosted Postgres | Skips Phase 1 entirely | Adds an always-on backend for a single-user tool; over-built per `flowmap_personal_tool.md` | Reject (premature) |

**Pick Tauri 2.** It matches the personal-tool brief (small download, fast launch),
the Vite + React frontend ports across unchanged, and `tauri-plugin-sql` exposes
SQLite to the renderer with a thin `invoke()` wrapper. Electron stays as the
backup option if Rust setup becomes a blocker.

### What Tauri changes for development

- `src-tauri/` (Rust crate) owns SQLite, file-system access, scheduled backup runs.
- Frontend code stays in `src/`; build output is loaded as the Tauri webview.
- `pnpm tauri dev` replaces `vite dev` for the desktop build; `vite dev` still works
  for browser-only iteration where SQL access is stubbed.

## Schema

Canonical tables map to entities listed in `flowmap-persistence-strategy.md` §"What
must be stored in SQL". v1 covers what currently lives in `flowmap.v1`
localStorage plus enough to support search/feedback signals. Type names use
SQLite syntax with Postgres-portable choices (TEXT, INTEGER, REAL, no
SQLite-only hacks).

```sql
-- Migration 0001_init.sql

CREATE TABLE topics (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  summary       TEXT,
  why_matters   TEXT,
  source        TEXT NOT NULL CHECK (source IN ('seed', 'user_query', 'user_category')),
  query         TEXT,                 -- for user-created topics
  category      TEXT,                 -- for category-derived user topics
  followed      INTEGER NOT NULL DEFAULT 0,
  added_at      TEXT NOT NULL,        -- ISO 8601
  followed_at   TEXT
);

CREATE TABLE content_items (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('video', 'article', 'social_post')),
  title           TEXT NOT NULL,
  url             TEXT NOT NULL,
  source_label    TEXT,                -- e.g. "YouTube · UI Collective", "Web · arstechnica.com"
  creator_id      TEXT,
  published_at    TEXT,
  summary         TEXT,
  thumbnail       TEXT,
  youtube_id      TEXT,
  raw_json        TEXT NOT NULL,       -- full normalized item blob, future-proof for fields not promoted to columns
  first_seen_at   TEXT NOT NULL
);

CREATE INDEX content_items_url_idx ON content_items(url);

CREATE TABLE topic_content (
  topic_id   TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  PRIMARY KEY (topic_id, content_id)
);

CREATE TABLE saves (
  content_id TEXT PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
  saved_at   TEXT NOT NULL
);

CREATE TABLE manual_ingest (
  id              TEXT PRIMARY KEY,    -- manual_yt_<id> | manual_art_<host>_<slug>
  content_id      TEXT NOT NULL UNIQUE REFERENCES content_items(id) ON DELETE CASCADE,
  topic_ids       TEXT NOT NULL,       -- JSON array; eventually a join table once we allow multi-topic
  tags            TEXT NOT NULL,       -- JSON array
  relevance_note  TEXT,
  saved_at        TEXT NOT NULL,
  ingestion_method TEXT NOT NULL DEFAULT 'manual_url'
);

CREATE TABLE views (
  content_id TEXT PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
  count      INTEGER NOT NULL DEFAULT 0,
  last_at    TEXT NOT NULL
);

CREATE TABLE dismisses (
  content_id  TEXT PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
  dismissed_at TEXT NOT NULL
);

CREATE TABLE searches (
  query       TEXT PRIMARY KEY,        -- normalized
  count       INTEGER NOT NULL DEFAULT 0,
  last_at     TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE memory_entries (
  id          TEXT PRIMARY KEY,
  category    TEXT NOT NULL,
  content     TEXT NOT NULL,
  confidence  REAL NOT NULL DEFAULT 1.0,
  status      TEXT NOT NULL DEFAULT 'active',
  added_at    TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'manual'
);

CREATE TABLE memory_dismisses (
  memory_id   TEXT PRIMARY KEY,        -- seed memory ids; not FK since seed lives in JSON
  dismissed_at TEXT NOT NULL
);

CREATE TABLE content_provenance (
  content_id  TEXT PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
  origin      TEXT NOT NULL,           -- 'seed' | 'search:<source>' | 'manual_url' | 'crawler'
  fetched_at  TEXT NOT NULL,
  raw_meta    TEXT                     -- JSON blob (microlink response, oembed payload, etc.)
);

CREATE TABLE schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO schema_meta(key, value) VALUES ('schema_version', '1');
INSERT INTO schema_meta(key, value) VALUES ('app_version', '0.1.0');
```

### Postgres portability notes

- All types (TEXT, INTEGER, REAL) survive a 1:1 promotion to Postgres `text`,
  `bigint`, `double precision`. No SQLite affinity tricks.
- `topic_ids` and `tags` are JSON arrays in TEXT for v1; on the Postgres move,
  promote `manual_ingest.topic_ids` to a `manual_ingest_topics` join table and
  `manual_ingest.tags` to `jsonb` (or a tags table if filtering volume warrants).
- ISO 8601 strings instead of native datetimes — keeps SQLite simple and is
  trivially castable to Postgres `timestamptz`.
- Avoid `WITHOUT ROWID`, `STRICT`, FTS5, and other SQLite-only modifiers in core
  tables. (Exception: a separate FTS5 index for content body search is fine *as
  a derived layer* later — it rebuilds from `content_items`.)

## One-time localStorage → SQL migration

On first launch with the SQLite layer present, run a one-shot migration:

1. Detect: SQLite store has `schema_meta.schema_version = '1'` AND no rows in
   `topics`, `saves`, `manual_ingest`, `memory_entries`. If state already exists,
   skip.
2. Read the latest snapshot — preferentially the live `flowmap.v1` localStorage
   payload from the bundled webview's localStorage. If unavailable, prompt for a
   JSON snapshot file (the format from `src/lib/snapshot.js`).
3. In a single transaction:
   - Insert `userTopics` rows into `topics` with `source='user_query'` or
     `'user_category'`.
   - Insert each `manualContent[*].item` into `content_items` and
     `manual_ingest`; populate `topic_content` from `topicIds`.
   - Insert each `saves[*].item` (when present — saves with no item snapshot are
     seed-only and rebuild from JSON seed) into `content_items` + `saves`.
   - Insert `views`, `searches`, `dismisses`, `memoryEntries`, `memoryDismisses`.
4. Write a `migrated_from_localstorage` row to `schema_meta` with the timestamp.
5. Keep the localStorage payload in place for one app version as a safety net,
   then clear on the next migration.

Tests:
- Round-trip: snapshot → import → SQL → export → equal envelope.
- Idempotency: running migration twice is a no-op.
- Partial failure: a bad row aborts the transaction and leaves SQL empty.

## Backup & export (Phase 1 → SQLite)

The current `src/lib/snapshot.js` JSON envelope stays the canonical export
format. Once SQL is the source of truth, `buildSnapshot()` reads from SQL
instead of localStorage and produces the same envelope shape (just bumped
`schemaVersion` if the data model has changed). Two new automated layers land
once we're on Tauri:

- **Rolling local backup**: every N hours, copy the SQLite file to
  `<appdata>/FlowMap/backups/flowmap-YYYYMMDD-HHMM.db`. Keep last 24 + last 30
  daily. Prune on schedule.
- **Off-device export**: optional setting to write a snapshot JSON to a
  user-chosen folder (Dropbox / iCloud / OneDrive sync target). Off by default.

Restore is a button in the same panel: pick a `.db` snapshot or a `.json`
envelope, confirm, the app restarts.

## Implementation phases

Ordered for incremental shipping. Each phase ends with a working app.

### Phase A — Tauri shell (no SQL behavior change yet)
- Add `src-tauri/`, `tauri.conf.json`, Cargo deps for `tauri-plugin-sql`,
  `serde`, `serde_json`.
- Build runs both `vite dev` (web) and `tauri dev` (desktop).
- App still uses localStorage; nothing changes for the user.
- Acceptance: desktop build runs, opens the existing app, all features work.

### Phase B — SQLite store + migration
- Apply migration `0001_init.sql` on first launch.
- Add a `db.js` module wrapping `tauri-plugin-sql` with the same selector
  shape `useStore` exposes today (so call sites don't change).
- Run the localStorage → SQL migration (above).
- Behind a feature flag: `useStore` reads from SQL instead of localStorage.
  Writes still go to both for one version (dual-write safety net).
- Acceptance: existing test data round-trips; toggling the flag is reversible.

### Phase C — Cut over
- Remove the dual-write. localStorage becomes a derived/disposable cache (UI
  preferences only — current tab, last-opened topic).
- Update `snapshot.js` to read from SQL.
- Update the Memory > Sources panel: surface the actual `.db` path, last
  rolling-backup timestamp, and an "Open backups folder" button.
- Acceptance: clearing localStorage doesn't lose user data.

### Phase D — Rolling backups + scheduled export
- Background job in Rust copies the live DB on a schedule.
- Pruning policy applied.
- UI shows last successful backup + a "Verify restore" action that opens the
  most recent backup in a sandboxed read-only mode.
- Acceptance: simulated device-loss test (move app data dir aside) recovers
  fully from the most recent rolling backup.

### Phase E — Derived layers
- Move the search cache to a separate SQLite file (or kept-as-is in
  localStorage since it's fully rebuildable — no functional difference).
- Optional: FTS5 index over `content_items.title + summary` for instant
  keyword search across saved content. Rebuildable; not part of canonical
  schema.

## Open questions

- **Tauri build target**: do we ship a single Windows installer first, or also
  macOS/Linux? Personal-tool brief implies Windows-only initially. Confirm.
- **Code signing**: Tauri Windows builds without a signing cert get a SmartScreen
  warning. Is signing in scope for v1, or do we accept the warning?
- **Schema migrations after v1**: pick a tooling story now (raw SQL files in
  `src-tauri/migrations/` applied in numeric order is the simplest; alternative
  is `refinery` crate). Recommendation: raw SQL files until the schema settles.
- **Where does the seed JSON live**: today it ships in the bundle. Continue
  bundling, or write seed rows into SQL on first run? Bundling stays simpler;
  SQL-first lets the user edit seed entries. Recommendation: keep bundled until
  there's a real need to edit seed.
- **Multi-topic for manual ingest**: today `manualContent.topicIds` is an array
  but the UI only saves to one topic. Promote to the join table now or keep
  the JSON array column and migrate later? Recommendation: keep JSON in v1,
  promote when the UI actually supports multi-select.

## What this plan deliberately defers

- AI/LLM features (embeddings, classification, summarization). Hooks into
  `content_items.raw_json` later without schema change.
- Multi-user / server / sync. Postgres migration plan is out of scope until
  there's a second user.
- Full HTML body fetching. Requires either a Tauri HTTP command (CORS-free) or
  a backend; design once, but not part of this migration.
