-- Incremental migration: per-table edit counter + triggers for cheap /rivers ETag.
-- All statements are idempotent (IF NOT EXISTS / INSERT OR IGNORE), safe to re-run.
CREATE TABLE IF NOT EXISTS table_versions (
    name TEXT PRIMARY KEY,
    version INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO table_versions (name, version) VALUES ('rivers', 0);

CREATE TRIGGER IF NOT EXISTS rivers_version_insert AFTER INSERT ON rivers
BEGIN UPDATE table_versions SET version = version + 1 WHERE name = 'rivers'; END;

CREATE TRIGGER IF NOT EXISTS rivers_version_update AFTER UPDATE ON rivers
BEGIN UPDATE table_versions SET version = version + 1 WHERE name = 'rivers'; END;

CREATE TRIGGER IF NOT EXISTS rivers_version_delete AFTER DELETE ON rivers
BEGIN UPDATE table_versions SET version = version + 1 WHERE name = 'rivers'; END;
