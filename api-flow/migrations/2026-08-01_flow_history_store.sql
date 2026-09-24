-- Flow history store (flow-db), a D1 database separate from rivers-db.
--
-- gauge_readings is a per-gauge ring buffer of 15-minute slots, so retention
-- needs no DELETEs (D1 bills deleted rows as writes). All reads filter on ts.
-- Idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS gauges (
    gauge_key    INTEGER PRIMARY KEY AUTOINCREMENT,
    gauge_id     TEXT NOT NULL UNIQUE,   -- normalized, e.g. 'USGS:03451500'
    provider     TEXT NOT NULL,
    name         TEXT,
    section      TEXT,
    state        TEXT,
    country      TEXT,
    lat          REAL,
    lon          REAL,
    nwm_reach_id TEXT
);

-- slot = floor(ts / 15 min) mod 3072 (32 days). ts is the slot start in ms;
-- off is the source reading's offset from it in seconds. A slot holds one
-- reading: the one closest to its start.
CREATE TABLE IF NOT EXISTS gauge_readings (
    gauge_key  INTEGER NOT NULL,
    slot       INTEGER NOT NULL,
    ts         INTEGER NOT NULL,
    off        INTEGER NOT NULL DEFAULT 0,
    cfs        REAL,
    ft         REAL,
    cms        REAL,
    m          REAL,
    temp_f     REAL,
    precip_in  REAL,
    approved   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (gauge_key, slot)
) WITHOUT ROWID;

-- Written only when something changes, never per cycle.
CREATE TABLE IF NOT EXISTS gauge_sync_state (
    gauge_key      INTEGER PRIMARY KEY,
    coverage_start INTEGER,   -- readings are complete from here to now
    repair_from    INTEGER    -- a window fetch failed; refetch from here
);

-- Small global state: sweep cursors and last-success times.
CREATE TABLE IF NOT EXISTS sync_meta (
    k TEXT PRIMARY KEY,
    v INTEGER
);
