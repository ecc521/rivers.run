-- Soft-bounce backoff for digest email (see api-flow/src/services/emailEvents.ts).
-- ALTER TABLE ADD COLUMN is not idempotent in SQLite: apply this once.
ALTER TABLE users ADD COLUMN soft_bounce_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN soft_bounce_at INTEGER NOT NULL DEFAULT 0;
