CREATE TABLE IF NOT EXISTS admin_audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    target_id TEXT,
    reason TEXT,
    created_at INTEGER NOT NULL
);
