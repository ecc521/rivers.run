import type { GaugeHistory, GaugeReading } from "./provider";
import { normalizeGaugeId } from "../utils/formatting";

/**
 * Persistence layer for the flow history store (the `FLOW_DB` D1 database).
 *
 * Two constraints drive nearly every choice in this file:
 *
 * 1. **D1 caps a query at 100 bound parameters.** A naive multi-row INSERT
 *    manages ~10 rows per statement, which is useless when a sync cycle writes
 *    ~15k readings. Every bulk operation here therefore passes its payload as a
 *    *single* JSON parameter and unpacks it with `json_each`. The bound value
 *    is not part of the SQL text, so the 100KB statement limit does not apply to
 *    it — but we still chunk (see MAX_JSON_BYTES) to stay well under D1's 2MB
 *    maximum value size.
 *
 * 2. **`gauge_readings` is WITHOUT ROWID, clustered on (gauge_key, ts).** Reads
 *    ("30 days for one gauge") are sequential range scans, but writes land at
 *    ~15k scattered insertion points. Sorting each batch by (gauge_key, ts)
 *    before insert makes the B-tree traversal monotonic instead of thrashing
 *    pages, and is the single most important write-path detail here.
 */

/** Rolling retention horizon. 30 days is for inference, not training. */
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Pruning is spread across this many cycles (96 = one 15-minute cycle per
 * 24h). A bulk `DELETE WHERE ts < ?` would need a secondary index on ts —
 * which on a WITHOUT ROWID table duplicates the full primary key — and would
 * still scan ~40M rows against D1's 30-second query limit. Deleting a rotating
 * slice of gauges instead rides the primary key and needs no extra index.
 */
export const PRUNE_SLICES = 96;

/** Chunk size for json_each payloads. Well under D1's 2MB max value size. */
const MAX_JSON_BYTES = 400_000;

/** Readings are snapped to 5-minute buckets so providers agree on timestamps. */
export const SNAP_MS = 300_000;

export type GaugeTier = "linked" | "registry";

export interface GaugeDimension {
    gaugeId: string;
    provider: string;
    tier: GaugeTier;
    name?: string;
    section?: string;
    state?: string;
    country?: string;
    lat?: number;
    lon?: number;
    nwmReachId?: string;
}

export interface StoredReading {
    gaugeId: string;
    ts: number;
    cfs?: number;
    ft?: number;
    cms?: number;
    m?: number;
    temp_f?: number;
    precip_in?: number;
    approved?: boolean;
    srcModified?: number;
}

export interface SyncState {
    gaugeKey: number;
    cursorModified: number | null;
    lastObsTs: number | null;
    coverageStart: number | null;
    obsCount24h: number | null;
    lastSuccessAt: number | null;
    failCount: number;
}

/** Providers whose gauges we deliberately never store. */
const DEAD_PREFIXES = new Set(["streambeam", "virtual"]);

/**
 * `streambeam:` gauges were removed and `virtual:` gauges are gone (future
 * custom gauges will be model-derived rather than scraped) — but both still
 * appear in the live sitedata.json, so this filter is load-bearing today.
 */
export function isStorableGaugeId(gaugeId: string): boolean {
    if (typeof gaugeId !== "string" || !gaugeId.includes(":")) return false;
    const prefix = gaugeId.split(":")[0].toLowerCase();
    return !DEAD_PREFIXES.has(prefix) && prefix.length > 0;
}

export function snapTimestamp(ts: number): number {
    return Math.round(ts / SNAP_MS) * SNAP_MS;
}

const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Splits `items` into chunks whose JSON serialization stays under
 * MAX_JSON_BYTES, returning the serialized string for each chunk.
 */
function chunkAsJson<T>(items: T[]): string[] {
    const out: string[] = [];
    let current: string[] = [];
    let size = 2; // enclosing brackets

    for (const item of items) {
        const encoded = JSON.stringify(item);
        // +1 for the separating comma
        if (current.length > 0 && size + encoded.length + 1 > MAX_JSON_BYTES) {
            out.push(`[${current.join(",")}]`);
            current = [];
            size = 2;
        }
        current.push(encoded);
        size += encoded.length + 1;
    }

    if (current.length > 0) out.push(`[${current.join(",")}]`);
    return out;
}

// --- DIMENSION ---

/**
 * Upserts gauge dimension rows and returns a gauge_id -> gauge_key map for
 * every gauge requested.
 *
 * Metadata is only overwritten when the incoming value is non-null, so a
 * provider that returns a reading without a name cannot blank out a name we
 * already resolved from the registry.
 */
export async function resolveGaugeKeys(
    db: D1Database,
    gauges: GaugeDimension[]
): Promise<Map<string, number>> {
    const wanted = gauges.filter(g => isStorableGaugeId(g.gaugeId));
    const keys = new Map<string, number>();
    if (wanted.length === 0) return keys;

    const payload = wanted.map(g => ({
        i: normalizeGaugeId(g.gaugeId),
        p: g.provider,
        tr: g.tier,
        n: g.name ?? null,
        sc: g.section ?? null,
        st: g.state ?? null,
        c: g.country ?? null,
        la: num(g.lat),
        lo: num(g.lon),
        r: g.nwmReachId ?? null,
    }));

    const now = Date.now();
    for (const chunk of chunkAsJson(payload)) {
        await db.prepare(`
            INSERT INTO gauges (gauge_id, provider, tier, name, section, state,
                                country, lat, lon, nwm_reach_id, updated_at)
            SELECT j.value->>'$.i', j.value->>'$.p', j.value->>'$.tr',
                   j.value->>'$.n', j.value->>'$.sc', j.value->>'$.st',
                   j.value->>'$.c', j.value->>'$.la', j.value->>'$.lo',
                   j.value->>'$.r', ?2
              FROM json_each(?1) j
             WHERE true   -- disambiguates ON CONFLICT from a JOIN..ON for the parser
            ON CONFLICT(gauge_id) DO UPDATE SET
                provider     = excluded.provider,
                -- never demote a linked gauge back to registry
                tier         = CASE WHEN gauges.tier = 'linked' THEN 'linked'
                                    ELSE excluded.tier END,
                name         = COALESCE(excluded.name, gauges.name),
                section      = COALESCE(excluded.section, gauges.section),
                state        = COALESCE(excluded.state, gauges.state),
                country      = COALESCE(excluded.country, gauges.country),
                lat          = COALESCE(excluded.lat, gauges.lat),
                lon          = COALESCE(excluded.lon, gauges.lon),
                nwm_reach_id = COALESCE(excluded.nwm_reach_id, gauges.nwm_reach_id),
                updated_at   = excluded.updated_at
        `).bind(chunk, now).run();
    }

    const ids = wanted.map(g => normalizeGaugeId(g.gaugeId));
    for (const chunk of chunkAsJson(ids)) {
        const { results } = await db.prepare(`
            SELECT g.gauge_key AS k, g.gauge_id AS i
              FROM gauges g
              JOIN json_each(?1) j ON g.gauge_id = j.value
        `).bind(chunk).all<{ k: number; i: string }>();
        for (const row of results ?? []) keys.set(row.i, row.k);
    }

    return keys;
}

/** Looks up existing keys without writing. Unknown gauges are simply absent. */
export async function lookupGaugeKeys(
    db: D1Database,
    gaugeIds: string[]
): Promise<Map<string, number>> {
    const keys = new Map<string, number>();
    const ids = gaugeIds.filter(isStorableGaugeId).map(normalizeGaugeId);
    if (ids.length === 0) return keys;

    for (const chunk of chunkAsJson(ids)) {
        const { results } = await db.prepare(`
            SELECT g.gauge_key AS k, g.gauge_id AS i
              FROM gauges g
              JOIN json_each(?1) j ON g.gauge_id = j.value
        `).bind(chunk).all<{ k: number; i: string }>();
        for (const row of results ?? []) keys.set(row.i, row.k);
    }
    return keys;
}

// --- READINGS ---

/**
 * Upserts readings. Idempotent by construction: the (gauge_key, ts) primary key
 * plus ON CONFLICT DO UPDATE means re-polling costs nothing and a *revised*
 * reading simply overwrites the value we held. That is what makes the whole
 * ingest design safe to re-run.
 *
 * Readings outside the retention horizon, or for gauges with no dimension row,
 * are dropped rather than silently creating orphans.
 *
 * @returns the number of readings actually submitted.
 */
export async function upsertReadings(
    db: D1Database,
    readings: StoredReading[],
    keys: Map<string, number>,
    now: number = Date.now()
): Promise<number> {
    const horizon = now - RETENTION_MS;

    const rows: Array<{
        k: number; t: number;
        cfs: number | null; ft: number | null; cms: number | null; m: number | null;
        tf: number | null; pi: number | null; a: number; lm: number | null;
    }> = [];

    for (const r of readings) {
        const key = keys.get(normalizeGaugeId(r.gaugeId));
        if (key === undefined) continue;
        if (!Number.isFinite(r.ts)) continue;

        const ts = snapTimestamp(r.ts);
        if (ts < horizon) continue;

        const cfs = num(r.cfs), ft = num(r.ft), cms = num(r.cms), m = num(r.m);
        const tf = num(r.temp_f), pi = num(r.precip_in);
        // A row carrying no measurement at all is noise, not an observation.
        if (cfs === null && ft === null && cms === null && m === null && tf === null && pi === null) {
            continue;
        }

        rows.push({
            k: key, t: ts, cfs, ft, cms, m, tf, pi,
            a: r.approved ? 1 : 0,
            lm: num(r.srcModified),
        });
    }

    if (rows.length === 0) return 0;

    // Sort into primary-key order so the clustered B-tree is walked
    // monotonically rather than thrashed across ~15k scattered pages.
    rows.sort((a, b) => (a.k - b.k) || (a.t - b.t));

    const chunks = chunkAsJson(rows);
    const statements = chunks.map(chunk => db.prepare(`
        INSERT INTO gauge_readings
              (gauge_key, ts, cfs, ft, cms, m, temp_f, precip_in, approved, src_modified)
        SELECT j.value->>'$.k', j.value->>'$.t',
               j.value->>'$.cfs', j.value->>'$.ft', j.value->>'$.cms', j.value->>'$.m',
               j.value->>'$.tf', j.value->>'$.pi', j.value->>'$.a', j.value->>'$.lm'
          FROM json_each(?1) j
         WHERE true   -- disambiguates ON CONFLICT from a JOIN..ON for the parser
        ON CONFLICT(gauge_key, ts) DO UPDATE SET
               cfs          = COALESCE(excluded.cfs, gauge_readings.cfs),
               ft           = COALESCE(excluded.ft, gauge_readings.ft),
               cms          = COALESCE(excluded.cms, gauge_readings.cms),
               m            = COALESCE(excluded.m, gauge_readings.m),
               temp_f       = COALESCE(excluded.temp_f, gauge_readings.temp_f),
               precip_in    = COALESCE(excluded.precip_in, gauge_readings.precip_in),
               approved     = excluded.approved,
               src_modified = excluded.src_modified
    `).bind(chunk));

    await db.batch(statements);
    return rows.length;
}

/** Column list shared by the series and latest readers. */
const READING_COLS = `r.ts AS ts, r.cfs AS cfs, r.ft AS ft, r.cms AS cms,
                      r.m AS m, r.temp_f AS temp_f, r.precip_in AS precip_in,
                      r.approved AS approved`;

interface ReadingRow {
    gauge_id: string;
    ts: number;
    cfs: number | null;
    ft: number | null;
    cms: number | null;
    m: number | null;
    temp_f: number | null;
    precip_in: number | null;
    approved: number;
}

function rowToReading(row: ReadingRow): GaugeReading {
    const reading: GaugeReading = { dateTime: row.ts };
    if (row.cfs !== null) reading.cfs = row.cfs;
    if (row.ft !== null) reading.ft = row.ft;
    if (row.cms !== null) reading.cms = row.cms;
    if (row.m !== null) reading.m = row.m;
    if (row.temp_f !== null) reading.temp_f = row.temp_f;
    if (row.precip_in !== null) reading.precip_in = row.precip_in;
    return reading;
}

/**
 * Reads stored history for the given gauges, in the same
 * `{ [gaugeId]: GaugeHistory }` shape the live provider path returns — so the
 * serving layer can swap between them without the frontend noticing.
 *
 * Gauges with no dimension row are simply absent from the result; the caller
 * is expected to fall back to a live fetch for those.
 */
export async function readSeries(
    db: D1Database,
    gaugeIds: string[],
    startTs: number,
    endTs?: number
): Promise<Record<string, GaugeHistory>> {
    const ids = gaugeIds.filter(isStorableGaugeId).map(normalizeGaugeId);
    if (ids.length === 0) return {};

    const idJson = JSON.stringify(ids);
    const end = endTs ?? Number.MAX_SAFE_INTEGER;

    const { results } = await db.prepare(`
        SELECT g.gauge_id AS gauge_id, ${READING_COLS}
          FROM gauges g
          JOIN json_each(?1) j ON g.gauge_id = j.value
          JOIN gauge_readings r ON r.gauge_key = g.gauge_key
         WHERE r.ts >= ?2 AND r.ts <= ?3
         ORDER BY g.gauge_key, r.ts
    `).bind(idJson, startTs, end).all<ReadingRow>();

    const meta = await readGaugeMeta(db, ids);
    const out: Record<string, GaugeHistory> = {};

    for (const row of results ?? []) {
        let history = out[row.gauge_id];
        if (!history) {
            const m = meta.get(row.gauge_id);
            history = {
                id: row.gauge_id.split(":")[1] ?? row.gauge_id,
                name: m?.name ?? "",
                readings: [],
            };
            if (m?.section) history.section = m.section;
            if (m?.state) history.state = m.state;
            if (m?.country) history.country = m.country;
            if (m?.lat != null) history.lat = m.lat;
            if (m?.lon != null) history.lon = m.lon;
            if (m?.nwmReachId) history.nwmReachId = m.nwmReachId;
            out[row.gauge_id] = history;
        }
        history.readings.push(rowToReading(row));
    }

    return out;
}

interface MetaRow {
    gauge_id: string; name: string | null; section: string | null;
    state: string | null; country: string | null;
    lat: number | null; lon: number | null; nwm_reach_id: string | null;
}

export async function readGaugeMeta(
    db: D1Database,
    gaugeIds: string[]
): Promise<Map<string, {
    name?: string; section?: string; state?: string; country?: string;
    lat?: number; lon?: number; nwmReachId?: string;
}>> {
    const out = new Map<string, any>();
    const ids = gaugeIds.filter(isStorableGaugeId).map(normalizeGaugeId);
    if (ids.length === 0) return out;

    for (const chunk of chunkAsJson(ids)) {
        const { results } = await db.prepare(`
            SELECT g.gauge_id, g.name, g.section, g.state, g.country,
                   g.lat, g.lon, g.nwm_reach_id
              FROM gauges g
              JOIN json_each(?1) j ON g.gauge_id = j.value
        `).bind(chunk).all<MetaRow>();

        for (const r of results ?? []) {
            out.set(r.gauge_id, {
                name: r.name ?? undefined,
                section: r.section ?? undefined,
                state: r.state ?? undefined,
                country: r.country ?? undefined,
                lat: r.lat ?? undefined,
                lon: r.lon ?? undefined,
                nwmReachId: r.nwm_reach_id ?? undefined,
            });
        }
    }
    return out;
}

/**
 * Latest stored reading for every gauge, used to project sitedata.json every
 * cycle.
 *
 * `CROSS JOIN` here is load-bearing and must not be "simplified" to a plain
 * JOIN. It is SQLite's documented way to pin the join order, forcing `gauges`
 * (~15k rows) to be the outer loop with an index seek into `gauge_readings`.
 * Left to its own devices the planner drives from `gauge_readings` instead and
 * does a full `SCAN r` over the whole fact table. Measured on 500k rows:
 * 166ms scanning vs 2.5ms seeking — and the scan grows with total readings, so
 * at ~40M rows it would be ~11s every 15 minutes, against D1's 30s query limit.
 *
 * The correlated MAX is preferred over joining `gauge_sync_state.last_obs_ts`
 * (equally fast) because it stays correct if that bookkeeping ever drifts.
 *
 * There is a regression test asserting this query plan contains no table scan.
 */
export const LATEST_ALL_SQL = `
        SELECT g.gauge_id AS gauge_id, ${READING_COLS}
          FROM gauges g
          CROSS JOIN gauge_readings r ON r.gauge_key = g.gauge_key
           AND r.ts = (SELECT MAX(ts) FROM gauge_readings WHERE gauge_key = g.gauge_key)
`;

export async function readLatestAll(
    db: D1Database
): Promise<Record<string, GaugeReading & { gaugeId: string }>> {
    const { results } = await db.prepare(LATEST_ALL_SQL).all<ReadingRow>();

    const out: Record<string, GaugeReading & { gaugeId: string }> = {};
    for (const row of results ?? []) {
        out[row.gauge_id] = { ...rowToReading(row), gaugeId: row.gauge_id };
    }
    return out;
}

// --- SYNC STATE ---

export async function readSyncState(
    db: D1Database,
    gaugeIds: string[]
): Promise<Map<string, SyncState>> {
    const out = new Map<string, SyncState>();
    const ids = gaugeIds.filter(isStorableGaugeId).map(normalizeGaugeId);
    if (ids.length === 0) return out;

    for (const chunk of chunkAsJson(ids)) {
        const { results } = await db.prepare(`
            SELECT g.gauge_id AS gauge_id, s.*
              FROM gauges g
              JOIN json_each(?1) j ON g.gauge_id = j.value
              LEFT JOIN gauge_sync_state s ON s.gauge_key = g.gauge_key
        `).bind(chunk).all<any>();

        for (const r of results ?? []) {
            if (r.gauge_key == null) continue;
            out.set(r.gauge_id, {
                gaugeKey: r.gauge_key,
                cursorModified: r.cursor_modified ?? null,
                lastObsTs: r.last_obs_ts ?? null,
                coverageStart: r.coverage_start ?? null,
                obsCount24h: r.obs_count_24h ?? null,
                lastSuccessAt: r.last_success_at ?? null,
                failCount: r.fail_count ?? 0,
            });
        }
    }
    return out;
}

export interface SyncStateUpdate {
    gaugeId: string;
    cursorModified?: number | null;
    lastObsTs?: number | null;
    coverageStart?: number | null;
    obsCount24h?: number | null;
    lastSuccessAt?: number | null;
    failCount?: number;
    lastError?: string | null;
}

/**
 * Upserts sync bookkeeping.
 *
 * A field left `undefined` on the update is encoded as SQL NULL and preserved
 * by COALESCE, so a cursor advance and a coverage advance can be issued
 * independently without clobbering each other. Two fields have directional
 * semantics rather than last-write-wins:
 *
 *  - `last_obs_ts` only ever moves *forward* (newest reading seen).
 *  - `coverage_start` only ever moves *backward* (backfill reaching further
 *    into the past).
 *
 * `last_error` is the exception: it is written verbatim, so a successful cycle
 * passing `lastError: null` clears a stale error.
 */
export async function writeSyncState(
    db: D1Database,
    updates: SyncStateUpdate[],
    keys: Map<string, number>
): Promise<void> {
    const rows = updates
        .map(u => {
            const key = keys.get(normalizeGaugeId(u.gaugeId));
            if (key === undefined) return null;
            return {
                k: key,
                cm: u.cursorModified ?? null,
                lo: u.lastObsTs ?? null,
                cs: u.coverageStart ?? null,
                oc: u.obsCount24h ?? null,
                ls: u.lastSuccessAt ?? null,
                fc: u.failCount ?? null,
                er: u.lastError ?? null,
            };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length === 0) return;
    rows.sort((a, b) => a.k - b.k);

    const statements = chunkAsJson(rows).map(chunk => db.prepare(`
        INSERT INTO gauge_sync_state
              (gauge_key, cursor_modified, last_obs_ts, coverage_start,
               obs_count_24h, last_success_at, fail_count, last_error)
        SELECT j.value->>'$.k', j.value->>'$.cm', j.value->>'$.lo',
               j.value->>'$.cs', j.value->>'$.oc', j.value->>'$.ls',
               COALESCE(j.value->>'$.fc', 0), j.value->>'$.er'
          FROM json_each(?1) j
         WHERE true   -- disambiguates ON CONFLICT from a JOIN..ON for the parser
        ON CONFLICT(gauge_key) DO UPDATE SET
            cursor_modified = COALESCE(excluded.cursor_modified,
                                       gauge_sync_state.cursor_modified),
            last_obs_ts     = CASE
                                WHEN excluded.last_obs_ts IS NULL
                                    THEN gauge_sync_state.last_obs_ts
                                WHEN gauge_sync_state.last_obs_ts IS NULL
                                    THEN excluded.last_obs_ts
                                ELSE MAX(gauge_sync_state.last_obs_ts,
                                         excluded.last_obs_ts)
                              END,
            coverage_start  = CASE
                                WHEN excluded.coverage_start IS NULL
                                    THEN gauge_sync_state.coverage_start
                                WHEN gauge_sync_state.coverage_start IS NULL
                                    THEN excluded.coverage_start
                                ELSE MIN(gauge_sync_state.coverage_start,
                                         excluded.coverage_start)
                              END,
            obs_count_24h   = COALESCE(excluded.obs_count_24h,
                                       gauge_sync_state.obs_count_24h),
            last_success_at = COALESCE(excluded.last_success_at,
                                       gauge_sync_state.last_success_at),
            fail_count      = COALESCE(excluded.fail_count,
                                       gauge_sync_state.fail_count),
            last_error      = excluded.last_error
    `).bind(chunk));

    await db.batch(statements);
}

// --- MAINTENANCE ---

/**
 * Deletes readings beyond the retention horizon for one rotating slice of
 * gauges. Called once per cycle with an advancing sliceIndex so every gauge is
 * pruned once per day.
 *
 * `gauge_key IN (subquery)` on the *leading* primary-key column compiles to a
 * seek per gauge rather than a table scan, which is why this needs no index on
 * ts.
 */
export async function pruneSlice(
    db: D1Database,
    sliceIndex: number,
    now: number = Date.now()
): Promise<number> {
    const horizon = now - RETENTION_MS;
    const slice = ((sliceIndex % PRUNE_SLICES) + PRUNE_SLICES) % PRUNE_SLICES;

    const res = await db.prepare(`
        DELETE FROM gauge_readings
         WHERE gauge_key IN (SELECT gauge_key FROM gauges WHERE gauge_key % ?1 = ?2)
           AND ts < ?3
    `).bind(PRUNE_SLICES, slice, horizon).run();

    return res.meta?.changes ?? 0;
}

/** Slice index derived from wall-clock time, so it advances on its own. */
export function currentPruneSlice(now: number = Date.now()): number {
    return Math.floor(now / (15 * 60 * 1000)) % PRUNE_SLICES;
}

/**
 * Recomputes the rolling 24h observation count per gauge. A count well below
 * the gauge's own norm is the signal that a cycle was missed, which drives
 * selective repair — the counterweight to tier B's latest-only ingest.
 */
export async function refreshObsCounts(
    db: D1Database,
    now: number = Date.now()
): Promise<void> {
    await db.prepare(`
        INSERT INTO gauge_sync_state (gauge_key, obs_count_24h, fail_count)
        SELECT r.gauge_key, COUNT(*), 0
          FROM gauge_readings r
         WHERE r.ts >= ?1
         GROUP BY r.gauge_key
        ON CONFLICT(gauge_key) DO UPDATE SET obs_count_24h = excluded.obs_count_24h
    `).bind(now - 24 * 60 * 60 * 1000).run();
}

/**
 * Gauges whose last 24h of observations fall below `threshold`, oldest-synced
 * first. These get a targeted datetime re-fetch rather than a blanket backfill.
 */
export async function findGapGauges(
    db: D1Database,
    threshold: number,
    limit: number
): Promise<Array<{ gaugeId: string; provider: string; lastObsTs: number | null }>> {
    const { results } = await db.prepare(`
        SELECT g.gauge_id AS gaugeId, g.provider AS provider, s.last_obs_ts AS lastObsTs
          FROM gauge_sync_state s
          JOIN gauges g ON g.gauge_key = s.gauge_key
         WHERE COALESCE(s.obs_count_24h, 0) < ?1
         ORDER BY COALESCE(s.last_success_at, 0) ASC
         LIMIT ?2
    `).bind(threshold, limit).all<{ gaugeId: string; provider: string; lastObsTs: number | null }>();

    return results ?? [];
}

export async function countReadings(db: D1Database): Promise<number> {
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM gauge_readings`).first<{ n: number }>();
    return row?.n ?? 0;
}
