-- SQLite Schema for Rivers.run (Cloudflare D1)

DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS user_subscriptions;
DROP TABLE IF EXISTS community_list_rivers;
DROP TABLE IF EXISTS community_lists;
DROP TABLE IF EXISTS river_suggestions;
DROP TABLE IF EXISTS river_audit_log;
DROP TABLE IF EXISTS river_audit_log;
DROP TABLE IF EXISTS rivers;
DROP TABLE IF EXISTS admin_audit_log;


-- ==========================================
-- 1. RIVERS CORE
-- ==========================================
CREATE TABLE rivers (
    id TEXT PRIMARY KEY, 
    name TEXT NOT NULL,
    section TEXT NOT NULL,
    states TEXT,                 -- Comma separated (e.g. "VA, MD")
    class TEXT NOT NULL,         -- e.g. "III-IV"
    skill INTEGER CHECK (skill >= 1 AND skill <= 8), -- Mapping to the 8 finite skill levels
    writeup TEXT,                -- HTML/Markdown blob
    tags TEXT,                   -- JSON Array (e.g. '["creeking", "playboating"]')
    
    average_gradient REAL,
    max_gradient REAL,
    dam_released BOOLEAN DEFAULT 0,
    aw_id TEXT,                  -- American Whitewater numerical ID string
    
    -- Embedded Flow Thresholds (since a river has exactly 1 "flow" object in Types)
    flow_unit TEXT,              -- 'cfs', 'ft', 'cms', 'm'
    flow_min REAL,
    flow_low REAL,
    flow_mid REAL,
    flow_high REAL,
    flow_max REAL,
    
    gauges TEXT,                 -- JSON Array of GaugeMapping objects
    accessPoints TEXT,           -- JSON Array of AccessPoint objects
    
    updated_at INTEGER NOT NULL  -- Unix timestamp
);

-- ==========================================
-- 2. AUDIT HISTORY (Strict Diff-Based History)
-- ==========================================
CREATE TABLE river_audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    river_id TEXT NOT NULL,
    action_type TEXT NOT NULL,   -- 'INSERT', 'UPDATE', 'DELETE'
    changed_by TEXT NOT NULL,    -- User Auth UID
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    diff_patch JSON NOT NULL     -- Tracks the delta/diff of what actually changed
);
CREATE INDEX idx_audit_log_river_id ON river_audit_log(river_id);

-- Note: Because we want strictly minimized DIFFs to save DB Storage limits, 
-- calculating the delta happens natively at the API/Cloudflare Worker layer rather 
-- than a dumb SQLite trigger blindly copying the entire row payload.

-- ==========================================
-- 4. COMMUNITY LISTS & SUBSCRIPTIONS
-- ==========================================
CREATE TABLE community_lists (
    id TEXT PRIMARY KEY,         -- UUID
    title TEXT NOT NULL,
    description TEXT,
    author TEXT NOT NULL,        -- Display Name
    owner_id TEXT NOT NULL,      -- User Auth UID
    is_published BOOLEAN DEFAULT 0,
    subscribes INTEGER DEFAULT 0,
    notifications_enabled BOOLEAN DEFAULT 0
);

CREATE TABLE community_list_rivers (
    list_id TEXT NOT NULL,
    river_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    -- Pinned threshold overrides per list
    gauge_id TEXT,
    min_val REAL,
    max_val REAL,
    units TEXT,

    -- Custom notification overrides
    custom_min REAL,
    custom_max REAL,
    custom_units TEXT,
    
    FOREIGN KEY(list_id) REFERENCES community_lists(id) ON DELETE CASCADE,
    PRIMARY KEY(list_id, river_id)
);

CREATE TABLE user_subscriptions (
    user_id TEXT NOT NULL,       -- Auth UID
    list_id TEXT NOT NULL,
    FOREIGN KEY(list_id) REFERENCES community_lists(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, list_id)
);

-- ==========================================
-- 5. REVIEW QUEUE (Community Suggestions)
-- ==========================================
CREATE TABLE river_suggestions (
    suggestion_id INTEGER PRIMARY KEY AUTOINCREMENT,
    river_id TEXT NOT NULL,
    suggested_by TEXT NOT NULL,      -- Auth UID
    proposed_changes JSON NOT NULL,  -- The full River object delta or new state
    status TEXT DEFAULT 'pending',   -- 'pending', 'resolved', 'rejected'
    created_at INTEGER NOT NULL,     -- Unix timestamp
    FOREIGN KEY(river_id) REFERENCES rivers(id) ON DELETE CASCADE
);
CREATE INDEX idx_suggestions_river_id ON river_suggestions(river_id);

-- ==========================================
-- 6. USER PROFILES & SETTINGS
-- ==========================================
CREATE TABLE users (
    user_id TEXT PRIMARY KEY,        -- Firebase Auth UID
    display_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user',
    settings_json JSON,              -- Additional settings (for frontend)
    notifications_enabled INTEGER DEFAULT 1,
    notifications_none_until INTEGER DEFAULT 0,
    notifications_time_of_day TEXT DEFAULT '08:00',
    alerts_review_queue INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL
);

-- ==========================================
-- 7. ADMIN AUDIT TRAIL
-- ==========================================
CREATE TABLE admin_audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,   -- e.g., 'BAN_USER', 'UNBAN_USER'
    admin_id TEXT NOT NULL,      -- Auth UID of admin
    target_id TEXT,              -- Auth UID of the affected user
    reason TEXT,
    created_at INTEGER NOT NULL
);

-- ==========================================
-- 8. USER REPORTS (UGC Flagging)
-- ==========================================
CREATE TABLE user_reports (
    report_id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id TEXT NOT NULL,
    type TEXT NOT NULL,
    reason TEXT NOT NULL,
    reported_by TEXT,
    reporter_email TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_user_reports_status ON user_reports(status);


-- ==========================================
-- 9. BACKGROUND WORKER OBSERVABILITY
-- ==========================================
CREATE TABLE IF NOT EXISTS worker_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    level TEXT NOT NULL,
    component TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT
);
CREATE INDEX IF NOT EXISTS idx_worker_logs_timestamp ON worker_logs(timestamp);

