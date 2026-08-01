-- Flow history store (flow-db).
--
-- Lives in its OWN D1 database, separate from rivers-db: a D1 database is
-- single-threaded, and a ~15k-row write burst every 15 minutes would contend
-- directly with live user CRUD from api/.
--
-- All statements are idempotent (IF NOT EXISTS), safe to re-run.

-- Dimension table. The integer surrogate key is not cosmetic: at ~40M readings,
-- carrying 'USGS:03451500' as TEXT on every row would cost ~500MB in the key
-- alone.
CREATE TABLE IF NOT EXISTS gauges (
    gauge_key    INTEGER PRIMARY KEY AUTOINCREMENT,
    gauge_id     TEXT NOT NULL UNIQUE,   -- normalized, e.g. 'USGS:03451500'
    provider     TEXT NOT NULL,
    tier         TEXT NOT NULL DEFAULT 'registry',  -- 'linked' | 'registry'
    name         TEXT,
    section      TEXT,
    state        TEXT,
    country      TEXT,
    lat          REAL,
    lon          REAL,
    nwm_reach_id TEXT,
    updated_at   INTEGER
);

-- Fact table. WITHOUT ROWID clusters rows physically by (gauge_key, ts), so
-- "30 days for one gauge" is a single sequential range scan rather than 2,880
-- scattered lookups. There is deliberately no secondary index on ts: pruning
-- runs per gauge and rides this primary key (see pruneSlice in flowStore.ts).
CREATE TABLE IF NOT EXISTS gauge_readings (
    gauge_key    INTEGER NOT NULL,
    ts           INTEGER NOT NULL,   -- ms epoch, snapped to 5-minute buckets
    cfs          REAL,
    ft           REAL,
    cms          REAL,
    m            REAL,
    temp_f       REAL,
    precip_in    REAL,
    approved     INTEGER NOT NULL DEFAULT 0,  -- 0 provisional, 1 approved
    src_modified INTEGER,            -- provider last_modified, ms
    PRIMARY KEY (gauge_key, ts)
) WITHOUT ROWID;

-- Per-gauge ingest bookkeeping.
CREATE TABLE IF NOT EXISTS gauge_sync_state (
    gauge_key       INTEGER PRIMARY KEY,
    cursor_modified INTEGER,   -- last_modified watermark (tier A USGS)
    last_obs_ts     INTEGER,   -- newest reading stored
    coverage_start  INTEGER,   -- oldest reading stored (backfill progress)
    obs_count_24h   INTEGER,   -- rolling count, drives gap detection
    last_success_at INTEGER,
    fail_count      INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT
);

-- Audit ledger for USGS formal revisions. There is no queryable for a
-- revision's publication date, so new ones are detected by tracking seen ids.
CREATE TABLE IF NOT EXISTS usgs_revisions_seen (
    revision_id   TEXT PRIMARY KEY,
    gauge_id      TEXT,
    begin_ts      INTEGER,
    end_ts        INTEGER,
    note          TEXT,
    first_seen_at INTEGER,
    applied_at    INTEGER
);
