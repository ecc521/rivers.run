/* Apply before deploying the hourly-store Worker. The old table is retained
 * untouched for rollback; new writes go only to gauge_reading_hours.
 * Each quarter is [off, cfs, ft, cms, m, temp_f, precip_in], or SQL NULL.
 * 768 hourly ring slots retain 32 days; reads still expose 15-minute slots.
 */
CREATE TABLE IF NOT EXISTS gauge_reading_hours (
    gauge_key INTEGER NOT NULL,
    slot INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    q0 TEXT,
    q1 TEXT,
    q2 TEXT,
    q3 TEXT,
    PRIMARY KEY (gauge_key, slot)
) WITHOUT ROWID;

/* Freeze the eight-day seed boundary for resumable, repeatable copies. Older
 * requests fall back to the provider; the legacy table is not copied in full.
 */
INSERT OR IGNORE INTO sync_meta (k, v)
VALUES ('hourly_seed_from', (unixepoch('now') * 1000 / 900000) * 900000 - 691200000);

/* A partially overwritten old ring hour may contain two laps. Keep only the
 * newest lap, so old quarters cannot leak into an incoming partial hour.
 * INSERT OR IGNORE makes rerunning the migration safe after new ingest.
 */
-- BEGIN COPY
WITH latest AS (
    SELECT gauge_key, slot / 4 AS slot, MAX(ts / 3600000) * 3600000 AS ts
    FROM gauge_readings WHERE ts >= (SELECT v FROM sync_meta WHERE k = 'hourly_seed_from') GROUP BY gauge_key, slot / 4
)
INSERT OR IGNORE INTO gauge_reading_hours (gauge_key, slot, ts, q0, q1, q2, q3)
SELECT h.gauge_key, h.slot, h.ts,
       MAX(CASE WHEN r.slot % 4 = 0 THEN json_array(r.off, r.cfs, r.ft, r.cms, r.m, r.temp_f, r.precip_in) END),
       MAX(CASE WHEN r.slot % 4 = 1 THEN json_array(r.off, r.cfs, r.ft, r.cms, r.m, r.temp_f, r.precip_in) END),
       MAX(CASE WHEN r.slot % 4 = 2 THEN json_array(r.off, r.cfs, r.ft, r.cms, r.m, r.temp_f, r.precip_in) END),
       MAX(CASE WHEN r.slot % 4 = 3 THEN json_array(r.off, r.cfs, r.ft, r.cms, r.m, r.temp_f, r.precip_in) END)
FROM latest h JOIN gauge_readings r
  ON r.gauge_key = h.gauge_key AND r.slot BETWEEN h.slot * 4 AND h.slot * 4 + 3
 AND r.ts >= h.ts AND r.ts < h.ts + 3600000
 AND r.ts >= (SELECT v FROM sync_meta WHERE k = 'hourly_seed_from')
GROUP BY h.gauge_key, h.slot;
-- END COPY

/* Match the coverage promise to the rows seeded. Preserve newer boundaries
 * and outstanding repairs within the seeded history.
 */
-- BEGIN COVERAGE
UPDATE gauge_sync_state
SET coverage_start = CASE WHEN coverage_start IS NULL THEN NULL
                          ELSE MAX(coverage_start, (SELECT v FROM sync_meta WHERE k = 'hourly_seed_from')) END,
    repair_from = CASE WHEN repair_from IS NULL THEN NULL
                       ELSE MAX(repair_from, (SELECT v FROM sync_meta WHERE k = 'hourly_seed_from')) END
WHERE coverage_start < (SELECT v FROM sync_meta WHERE k = 'hourly_seed_from')
   OR repair_from < (SELECT v FROM sync_meta WHERE k = 'hourly_seed_from');
-- END COVERAGE

/* Read-only expansion. hour_slot is a direct physical key, allowing readers
 * to seek the hour's primary key before expanding up to four quarters.
 */
CREATE VIEW IF NOT EXISTS gauge_reading_slots AS
SELECT h.gauge_key, h.slot AS hour_slot,
       h.slot * 4 + CAST(q.key AS INTEGER) AS slot,
       h.ts + CAST(q.key AS INTEGER) * 900000 AS ts,
       json_extract(q.value, '$[0]') AS off,
       json_extract(q.value, '$[1]') AS cfs,
       json_extract(q.value, '$[2]') AS ft,
       json_extract(q.value, '$[3]') AS cms,
       json_extract(q.value, '$[4]') AS m,
       json_extract(q.value, '$[5]') AS temp_f,
       json_extract(q.value, '$[6]') AS precip_in
FROM gauge_reading_hours h
CROSS JOIN json_each(json_array(json(h.q0), json(h.q1), json(h.q2), json(h.q3))) q
WHERE q.type = 'array';
