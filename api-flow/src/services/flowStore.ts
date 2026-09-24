import type { GaugeHistory, GaugeReading } from "./provider";
import { normalizeGaugeId } from "../utils/formatting";

/**
 * Persistence for the flow history store (`FLOW_DB`).
 *
 * `gauge_readings` is a ring buffer: each gauge has SLOTS fixed 15-minute
 * slots, and a new reading overwrites the slot's previous generation. Nothing
 * is ever deleted, and every read filters on `ts` so expired slots are
 * invisible.
 *
 * Bulk operations pass one JSON parameter unpacked with `json_each`, because
 * D1 caps a query at 100 bound parameters. Every upsert is guarded so an
 * unchanged row costs no write (D1 bills rows written).
 */

export const SLOT_MS = 15 * 60 * 1000;
/** 32 days of slots: two days of slack beyond RETENTION_MS. */
export const SLOTS = 32 * 96;
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** Readings further in the future than this are dropped as bad clocks. */
export const FUTURE_SKEW_MS = 5 * 60 * 1000;

const MAX_JSON_BYTES = 400_000;

export interface GaugeDimension {
    gaugeId: string;
    provider: string;
    name?: string;
    section?: string;
    state?: string;
    country?: string;
    lat?: number;
    lon?: number;
    nwmReachId?: string;
}

/** One observation at its real timestamp, before slotting. */
export interface ObservedReading {
    gaugeId: string;
    ts: number;
    cfs?: number;
    ft?: number;
    cms?: number;
    m?: number;
    temp_f?: number;
    precip_in?: number;
    approved?: boolean;
}

/** One ring-buffer row: the chosen reading for a (gauge, slot). */
export interface SlotRow {
    gaugeId: string;
    /** Slot start, ms. */
    ts: number;
    /** Offset of the source reading from the slot start, seconds. */
    off: number;
    cfs: number | null;
    ft: number | null;
    cms: number | null;
    m: number | null;
    temp_f: number | null;
    precip_in: number | null;
    approved: boolean;
}

const DEAD_PREFIXES = new Set(["streambeam", "virtual"]);

/** `streambeam:` and `virtual:` gauges still appear in sitedata but are never stored. */
export function isStorableGaugeId(gaugeId: string): boolean {
    if (typeof gaugeId !== "string" || !gaugeId.includes(":")) return false;
    const prefix = gaugeId.split(":")[0].toLowerCase();
    return !DEAD_PREFIXES.has(prefix) && prefix.length > 0;
}

export const slotStartOf = (ts: number): number => Math.floor(ts / SLOT_MS) * SLOT_MS;
export const slotIndexOf = (ts: number): number => Math.floor(ts / SLOT_MS) % SLOTS;

/**
 * Slot-index ranges covering slot starts in [start, end]. At most two, since
 * the ring wraps; a span of a full ring or more is the whole ring.
 */
export function slotRanges(start: number, end: number): Array<[number, number]> {
    const first = Math.floor(start / SLOT_MS);
    const last = Math.floor(end / SLOT_MS);
    if (last < first) return [];
    if (last - first + 1 >= SLOTS) return [[0, SLOTS - 1]];
    const a = first % SLOTS;
    const b = last % SLOTS;
    return a <= b ? [[a, b]] : [[a, SLOTS - 1], [0, b]];
}

const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

const VALUE_COLS = ["cfs", "ft", "cms", "m", "temp_f", "precip_in"] as const;

export interface ReduceOptions {
    now: number;
    /** Fetch window start. Slots starting before it are partial and dropped. */
    windowStart?: number;
}

/**
 * Collapses readings to one row per (gauge, slot). Each parameter comes from
 * the reading closest to the slot start that carries it; `off` and `approved`
 * follow the closest reading overall. Drops future, expired, empty and
 * leading-edge partial-slot readings.
 */
export function reduceToSlots(readings: Iterable<ObservedReading>, opts: ReduceOptions): SlotRow[] {
    const horizon = opts.now - RETENTION_MS;
    const maxTs = opts.now + FUTURE_SKEW_MS;
    const best = new Map<string, SlotRow>();

    for (const r of readings) {
        if (!Number.isFinite(r.ts) || r.ts > maxTs) continue;
        const ts = slotStartOf(r.ts);
        if (ts < horizon) continue;
        if (opts.windowStart !== undefined && ts < opts.windowStart) continue;

        const values = {
            cfs: num(r.cfs), ft: num(r.ft), cms: num(r.cms), m: num(r.m),
            temp_f: num(r.temp_f), precip_in: num(r.precip_in),
        };
        if (VALUE_COLS.every(c => values[c] === null)) continue;

        const off = Math.round((r.ts - ts) / 1000);
        const key = `${r.gaugeId}|${ts}`;
        const prev = best.get(key);

        if (!prev) {
            best.set(key, { gaugeId: r.gaugeId, ts, off, ...values, approved: r.approved === true });
        } else if (off < prev.off) {
            const next: SlotRow = { gaugeId: r.gaugeId, ts, off, ...values, approved: r.approved === true };
            for (const c of VALUE_COLS) if (next[c] === null) next[c] = prev[c];
            best.set(key, next);
        } else {
            for (const c of VALUE_COLS) if (prev[c] === null) prev[c] = values[c];
            if (off === prev.off) prev.approved = prev.approved && r.approved === true;
        }
    }

    return [...best.values()];
}

/** Splits items into JSON arrays that each serialize under MAX_JSON_BYTES. */
function chunkAsJson<T>(items: T[]): string[] {
    const out: string[] = [];
    let current: string[] = [];
    let size = 2;

    for (const item of items) {
        const encoded = JSON.stringify(item);
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

/** Rows written according to D1's meta; the test harness reports `changes`. */
function writtenOf(res: { meta?: any } | undefined): number {
    const meta = res?.meta ?? {};
    return Number(meta.rows_written ?? meta.changes ?? 0);
}

async function runBatch(db: D1Database, statements: D1PreparedStatement[]): Promise<number> {
    if (statements.length === 0) return 0;
    const results = await db.batch(statements);
    return results.reduce((sum, r) => sum + writtenOf(r), 0);
}

async function selectKeys(db: D1Database, ids: string[]): Promise<Map<string, number>> {
    const keys = new Map<string, number>();
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

// --- DIMENSION ---

/**
 * Upserts gauge rows and returns gauge_id -> gauge_key for every storable
 * gauge. A row is rewritten only when a non-null incoming value differs, so a
 * provider that omits a name cannot blank one, and an unchanged registry
 * costs nothing.
 */
export async function resolveGaugeKeys(
    db: D1Database,
    gauges: GaugeDimension[]
): Promise<{ keys: Map<string, number>; written: number }> {
    const wanted = gauges.filter(g => isStorableGaugeId(g.gaugeId));
    if (wanted.length === 0) return { keys: new Map(), written: 0 };

    const payload = wanted.map(g => ({
        i: normalizeGaugeId(g.gaugeId),
        p: g.provider,
        n: g.name || null,
        sc: g.section || null,
        st: g.state || null,
        c: g.country || null,
        la: num(g.lat),
        lo: num(g.lon),
        r: g.nwmReachId || null,
    }));

    const changed = (col: string) =>
        `(excluded.${col} IS NOT NULL AND excluded.${col} IS NOT gauges.${col})`;

    const statements = chunkAsJson(payload).map(chunk => db.prepare(`
        INSERT INTO gauges (gauge_id, provider, name, section, state, country, lat, lon, nwm_reach_id)
        SELECT j.value->>'$.i', j.value->>'$.p', j.value->>'$.n', j.value->>'$.sc',
               j.value->>'$.st', j.value->>'$.c', j.value->>'$.la', j.value->>'$.lo',
               j.value->>'$.r'
          FROM json_each(?1) j
         WHERE true
        ON CONFLICT(gauge_id) DO UPDATE SET
            provider     = excluded.provider,
            name         = COALESCE(excluded.name, gauges.name),
            section      = COALESCE(excluded.section, gauges.section),
            state        = COALESCE(excluded.state, gauges.state),
            country      = COALESCE(excluded.country, gauges.country),
            lat          = COALESCE(excluded.lat, gauges.lat),
            lon          = COALESCE(excluded.lon, gauges.lon),
            nwm_reach_id = COALESCE(excluded.nwm_reach_id, gauges.nwm_reach_id)
        WHERE excluded.provider IS NOT gauges.provider
           OR ${["name", "section", "state", "country", "lat", "lon", "nwm_reach_id"].map(changed).join(" OR ")}
    `).bind(chunk));

    const written = await runBatch(db, statements);
    const keys = await selectKeys(db, payload.map(p => p.i));
    return { keys, written };
}

/** Looks up existing keys without writing. Unknown gauges are absent. */
export async function lookupGaugeKeys(db: D1Database, gaugeIds: string[]): Promise<Map<string, number>> {
    const ids = gaugeIds.filter(isStorableGaugeId).map(normalizeGaugeId);
    return ids.length === 0 ? new Map() : selectKeys(db, ids);
}

// --- READINGS ---

const newer = "excluded.ts > gauge_readings.ts";
/** New lap: take the incoming row. Same slot: fill gaps from the other reading, preferring the closer one. */
const mergeCol = (col: string) =>
    `${col} = CASE WHEN ${newer} THEN excluded.${col}
                   WHEN excluded.off <= gauge_readings.off THEN COALESCE(excluded.${col}, gauge_readings.${col})
                   ELSE COALESCE(gauge_readings.${col}, excluded.${col}) END`;
const colDiffers = (col: string) =>
    `(excluded.${col} IS NOT NULL AND excluded.${col} IS NOT gauge_readings.${col})`;
const colFills = (col: string) =>
    `(gauge_readings.${col} IS NULL AND excluded.${col} IS NOT NULL)`;

/**
 * The ring-buffer upsert. A slot is rewritten by a newer lap (larger ts), by a
 * reading closer to the slot start (smaller off, keeping parameters it lacks),
 * by changed values for the same reading, or by a farther reading that fills
 * a missing parameter. Anything else is a no-op and writes nothing.
 */
export const UPSERT_READINGS_SQL = `
    INSERT INTO gauge_readings
          (gauge_key, slot, ts, off, cfs, ft, cms, m, temp_f, precip_in, approved)
    SELECT j.value->>'$.k', j.value->>'$.s', j.value->>'$.t', j.value->>'$.o',
           j.value->>'$.cfs', j.value->>'$.ft', j.value->>'$.cms', j.value->>'$.m',
           j.value->>'$.tf', j.value->>'$.pi', j.value->>'$.a'
      FROM json_each(?1) j
     WHERE true
    ON CONFLICT(gauge_key, slot) DO UPDATE SET
        ${VALUE_COLS.map(mergeCol).join(",\n        ")},
        approved = CASE WHEN ${newer} OR excluded.off < gauge_readings.off THEN excluded.approved
                        WHEN excluded.off = gauge_readings.off
                        THEN MAX(excluded.approved, gauge_readings.approved)
                        ELSE gauge_readings.approved END,
        off = CASE WHEN ${newer} THEN excluded.off ELSE MIN(excluded.off, gauge_readings.off) END,
        ts  = excluded.ts
    WHERE ${newer}
       OR (excluded.ts = gauge_readings.ts AND (
              excluded.off < gauge_readings.off
           OR (excluded.off = gauge_readings.off AND (
                  ${VALUE_COLS.map(colDiffers).join("\n               OR ")}
               OR excluded.approved > gauge_readings.approved))
           OR (excluded.off > gauge_readings.off AND (
                  ${VALUE_COLS.map(colFills).join("\n               OR ")}))))
`;

/**
 * Writes slot rows. Rows for gauges without a key are skipped.
 * @returns rows D1 reports as written (0 for a pure replay).
 */
export async function upsertSlots(
    db: D1Database,
    rows: SlotRow[],
    keys: Map<string, number>
): Promise<number> {
    const payload: Array<Record<string, number | null>> = [];
    for (const r of rows) {
        const k = keys.get(normalizeGaugeId(r.gaugeId));
        if (k === undefined) continue;
        payload.push({
            k, s: slotIndexOf(r.ts), t: r.ts, o: r.off,
            cfs: r.cfs, ft: r.ft, cms: r.cms, m: r.m, tf: r.temp_f, pi: r.precip_in,
            a: r.approved ? 1 : 0,
        });
    }
    if (payload.length === 0) return 0;

    // Primary-key order keeps the clustered B-tree walk monotonic.
    payload.sort((a, b) => (a.k! - b.k!) || (a.s! - b.s!));
    return runBatch(db, chunkAsJson(payload).map(chunk => db.prepare(UPSERT_READINGS_SQL).bind(chunk)));
}

interface ReadingRow {
    gauge_id: string;
    ts: number;
    off: number;
    cfs: number | null;
    ft: number | null;
    cms: number | null;
    m: number | null;
    temp_f: number | null;
    precip_in: number | null;
}

const READING_COLS = `g.gauge_id AS gauge_id, r.ts AS ts, r.off AS off, r.cfs AS cfs,
                      r.ft AS ft, r.cms AS cms, r.m AS m, r.temp_f AS temp_f,
                      r.precip_in AS precip_in`;

/** Served timestamps are rounded to 5 minutes, like the live USGS and NWS parsers. */
export const SERVED_SNAP_MS = 300_000;
export const servedTime = (ts: number): number => Math.round(ts / SERVED_SNAP_MS) * SERVED_SNAP_MS;

/** A stored or slotted row as a served reading. */
export function rowToReading(row: Pick<ReadingRow, "ts" | "off" | (typeof VALUE_COLS)[number]>): GaugeReading {
    const reading: GaugeReading = { dateTime: servedTime(row.ts + row.off * 1000) };
    for (const c of VALUE_COLS) if (row[c] !== null) (reading as any)[c] = row[c];
    return reading;
}

/**
 * Stored readings for the given gauges with slot starts in [startTs, endTs],
 * clipped to the retention horizon, in the live providers' GaugeHistory shape.
 * Gauges with no readings in range are absent.
 */
export async function readSeries(
    db: D1Database,
    gaugeIds: string[],
    startTs: number,
    endTs: number,
    now: number = Date.now()
): Promise<Record<string, GaugeHistory>> {
    const ids = gaugeIds.filter(isStorableGaugeId).map(normalizeGaugeId);
    if (ids.length === 0) return {};

    const start = slotStartOf(Math.max(startTs, now - RETENTION_MS));
    const rows: ReadingRow[] = [];
    for (const chunk of chunkAsJson(ids)) {
        for (const [a, b] of slotRanges(start, endTs)) {
            // CROSS JOIN pins gauges as the outer loop so readings are a
            // primary-key seek per gauge, never a table scan.
            const { results } = await db.prepare(`
                SELECT ${READING_COLS}
                  FROM gauges g
                  JOIN json_each(?1) j ON g.gauge_id = j.value
                 CROSS JOIN gauge_readings r
                    ON r.gauge_key = g.gauge_key AND r.slot BETWEEN ?2 AND ?3
                 WHERE r.ts >= ?4 AND r.ts <= ?5
            `).bind(chunk, a, b, start, endTs).all<ReadingRow>();
            for (const row of results ?? []) rows.push(row);
        }
    }
    rows.sort((x, y) => x.ts - y.ts);

    const meta = rows.length > 0 ? await readGaugeMeta(db, ids) : new Map();
    const out: Record<string, GaugeHistory> = {};
    for (const row of rows) {
        let history = out[row.gauge_id];
        if (!history) {
            const m = meta.get(row.gauge_id);
            history = { id: row.gauge_id.split(":")[1] ?? row.gauge_id, name: m?.name ?? "", readings: [] };
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

export interface GaugeMeta {
    name?: string; section?: string; state?: string; country?: string;
    lat?: number; lon?: number; nwmReachId?: string;
}

export async function readGaugeMeta(db: D1Database, gaugeIds: string[]): Promise<Map<string, GaugeMeta>> {
    const out = new Map<string, GaugeMeta>();
    const ids = gaugeIds.filter(isStorableGaugeId).map(normalizeGaugeId);
    for (const chunk of chunkAsJson(ids)) {
        const { results } = await db.prepare(`
            SELECT g.gauge_id, g.name, g.section, g.state, g.country, g.lat, g.lon, g.nwm_reach_id
              FROM gauges g
              JOIN json_each(?1) j ON g.gauge_id = j.value
        `).bind(chunk).all<any>();
        for (const r of results ?? []) {
            out.set(r.gauge_id, {
                name: r.name ?? undefined, section: r.section ?? undefined,
                state: r.state ?? undefined, country: r.country ?? undefined,
                lat: r.lat ?? undefined, lon: r.lon ?? undefined,
                nwmReachId: r.nwm_reach_id ?? undefined,
            });
        }
    }
    return out;
}

/**
 * Newest stored reading per gauge within the last `windowMs`, for every
 * gauge. Uses SQLite's bare-column MAX() so each row is read once.
 */
export const LATEST_SQL = `
    SELECT g.gauge_id AS gauge_id, MAX(r.ts) AS ts, r.off AS off, r.cfs AS cfs,
           r.ft AS ft, r.cms AS cms, r.m AS m, r.temp_f AS temp_f, r.precip_in AS precip_in
      FROM gauges g
     CROSS JOIN gauge_readings r
        ON r.gauge_key = g.gauge_key AND r.slot BETWEEN ?1 AND ?2
     WHERE r.ts >= ?3
     GROUP BY g.gauge_key
`;

export async function readLatest(
    db: D1Database,
    windowMs: number,
    now: number = Date.now()
): Promise<Record<string, GaugeReading>> {
    const start = slotStartOf(now - windowMs);
    const best = new Map<string, ReadingRow>();
    for (const [a, b] of slotRanges(start, now)) {
        const { results } = await db.prepare(LATEST_SQL).bind(a, b, start).all<ReadingRow>();
        for (const row of results ?? []) {
            const prev = best.get(row.gauge_id);
            if (!prev || row.ts > prev.ts) best.set(row.gauge_id, row);
        }
    }
    const out: Record<string, GaugeReading> = {};
    for (const [id, row] of best) out[id] = rowToReading(row);
    return out;
}

export interface HourlySums {
    cfsSum: number; cfsN: number; ftSum: number; ftN: number;
}

/**
 * Per-hour sums and counts of cfs and ft for hours in [startHourTs, endHourTs).
 * Keyed by gauge id, then by hour start (ms). USGS sentinels are excluded.
 */
export async function readHourlySums(
    db: D1Database,
    gaugeIds: string[],
    startHourTs: number,
    endHourTs: number,
    now: number = Date.now()
): Promise<Map<string, Map<number, HourlySums>>> {
    const out = new Map<string, Map<number, HourlySums>>();
    const ids = gaugeIds.map(normalizeGaugeId);
    // Clip to retention; a partially clipped hour still reports its count.
    startHourTs = Math.max(startHourTs, slotStartOf(now - RETENTION_MS));
    for (const chunk of chunkAsJson(ids)) {
        for (const [a, b] of slotRanges(startHourTs, endHourTs - 1)) {
            const { results } = await db.prepare(`
                SELECT g.gauge_id AS gauge_id, r.ts / 3600000 AS h,
                       SUM(CASE WHEN r.cfs > -999999 THEN r.cfs END) AS cfs_sum,
                       COUNT(CASE WHEN r.cfs > -999999 THEN r.cfs END) AS cfs_n,
                       SUM(CASE WHEN r.ft > -999999 THEN r.ft END) AS ft_sum,
                       COUNT(CASE WHEN r.ft > -999999 THEN r.ft END) AS ft_n
                  FROM gauges g
                  JOIN json_each(?1) j ON g.gauge_id = j.value
                 CROSS JOIN gauge_readings r
                    ON r.gauge_key = g.gauge_key AND r.slot BETWEEN ?2 AND ?3
                 WHERE r.ts >= ?4 AND r.ts < ?5
                 GROUP BY g.gauge_id, h
            `).bind(chunk, a, b, startHourTs, endHourTs).all<any>();
            for (const row of results ?? []) {
                let perHour = out.get(row.gauge_id);
                if (!perHour) {
                    perHour = new Map();
                    out.set(row.gauge_id, perHour);
                }
                const hourTs = Number(row.h) * 3_600_000;
                const prev = perHour.get(hourTs) ?? { cfsSum: 0, cfsN: 0, ftSum: 0, ftN: 0 };
                prev.cfsSum += row.cfs_sum ?? 0;
                prev.cfsN += row.cfs_n ?? 0;
                prev.ftSum += row.ft_sum ?? 0;
                prev.ftN += row.ft_n ?? 0;
                perHour.set(hourTs, prev);
            }
        }
    }
    return out;
}

// --- SYNC STATE ---

export interface SyncState {
    gaugeKey: number;
    coverageStart: number | null;
    repairFrom: number | null;
    failCount: number;
    retryAt: number | null;
}

const toSyncState = (r: any): SyncState => ({
    gaugeKey: r.gauge_key,
    coverageStart: r.coverage_start ?? null,
    repairFrom: r.repair_from ?? null,
    failCount: r.fail_count ?? 0,
    retryAt: r.retry_at ?? null,
});

const SYNC_COLS = `g.gauge_id AS gauge_id, g.gauge_key AS gauge_key,
                   s.coverage_start AS coverage_start, s.repair_from AS repair_from,
                   s.fail_count AS fail_count, s.retry_at AS retry_at`;

/** Sync state for every gauge of one provider, keyed by gauge id. */
export async function readProviderSyncState(db: D1Database, provider: string): Promise<Map<string, SyncState>> {
    const { results } = await db.prepare(`
        SELECT ${SYNC_COLS}
          FROM gauges g
          LEFT JOIN gauge_sync_state s ON s.gauge_key = g.gauge_key
         WHERE g.provider = ?1
    `).bind(provider).all<any>();
    const out = new Map<string, SyncState>();
    for (const r of results ?? []) {
        out.set(r.gauge_id, toSyncState(r));
    }
    return out;
}

/** Sync state for specific gauges. Gauges without a gauges row are absent. */
export async function readSyncState(db: D1Database, gaugeIds: string[]): Promise<Map<string, SyncState>> {
    const out = new Map<string, SyncState>();
    const ids = gaugeIds.filter(isStorableGaugeId).map(normalizeGaugeId);
    for (const chunk of chunkAsJson(ids)) {
        const { results } = await db.prepare(`
            SELECT ${SYNC_COLS}
              FROM gauges g
              JOIN json_each(?1) j ON g.gauge_id = j.value
              LEFT JOIN gauge_sync_state s ON s.gauge_key = g.gauge_key
        `).bind(chunk).all<any>();
        for (const r of results ?? []) {
            out.set(r.gauge_id, toSyncState(r));
        }
    }
    return out;
}

/**
 * Moves coverage_start back to `from` (never forward). Used when a backfill
 * fetch completes. Writes only rows that actually change.
 */
export async function extendCoverage(db: D1Database, gaugeKeys: number[], from: number): Promise<number> {
    if (gaugeKeys.length === 0) return 0;
    return runBatch(db, chunkAsJson(gaugeKeys).map(chunk => db.prepare(`
        INSERT INTO gauge_sync_state (gauge_key, coverage_start)
        SELECT j.value, ?2 FROM json_each(?1) j WHERE true
        ON CONFLICT(gauge_key) DO UPDATE SET coverage_start = excluded.coverage_start
        WHERE gauge_sync_state.coverage_start IS NULL
           OR gauge_sync_state.coverage_start > excluded.coverage_start
    `).bind(chunk, from)));
}

/** Records that readings from `from` onward need a refetch. Keeps the earliest. */
export async function markRepair(db: D1Database, gaugeKeys: number[], from: number): Promise<number> {
    if (gaugeKeys.length === 0) return 0;
    return runBatch(db, chunkAsJson(gaugeKeys).map(chunk => db.prepare(`
        INSERT INTO gauge_sync_state (gauge_key, repair_from)
        SELECT j.value, ?2 FROM json_each(?1) j WHERE true
        ON CONFLICT(gauge_key) DO UPDATE SET repair_from = excluded.repair_from
        WHERE gauge_sync_state.repair_from IS NULL
           OR gauge_sync_state.repair_from > excluded.repair_from
    `).bind(chunk, from)));
}

/** Same as markRepair for every gauge of a provider. */
export async function markProviderRepair(db: D1Database, provider: string, from: number): Promise<number> {
    const res = await db.prepare(`
        INSERT INTO gauge_sync_state (gauge_key, repair_from)
        SELECT gauge_key, ?2 FROM gauges WHERE provider = ?1
        ON CONFLICT(gauge_key) DO UPDATE SET repair_from = excluded.repair_from
        WHERE gauge_sync_state.repair_from IS NULL
           OR gauge_sync_state.repair_from > excluded.repair_from
    `).bind(provider, from).run();
    return writtenOf(res);
}

/** Clears repair_from where a completed fetch starting at `coveredFrom` covers it. */
export async function clearRepair(db: D1Database, gaugeKeys: number[], coveredFrom: number): Promise<number> {
    if (gaugeKeys.length === 0) return 0;
    return runBatch(db, chunkAsJson(gaugeKeys).map(chunk => db.prepare(`
        UPDATE gauge_sync_state SET repair_from = NULL
         WHERE repair_from IS NOT NULL AND repair_from >= ?2
           AND gauge_key IN (SELECT value FROM json_each(?1))
    `).bind(chunk, coveredFrom)));
}

export interface CoverageUpdate {
    gaugeKey: number;
    coverageStart: number | null;
    repairFrom: number | null;
}

/** Sets coverage_start and repair_from exactly; writes only rows that change. */
export async function writeCoverage(db: D1Database, updates: CoverageUpdate[]): Promise<number> {
    if (updates.length === 0) return 0;
    const payload = updates.map(u => ({ k: u.gaugeKey, c: u.coverageStart, r: u.repairFrom }));
    return runBatch(db, chunkAsJson(payload).map(chunk => db.prepare(`
        INSERT INTO gauge_sync_state (gauge_key, coverage_start, repair_from)
        SELECT j.value->>'$.k', j.value->>'$.c', j.value->>'$.r' FROM json_each(?1) j WHERE true
        ON CONFLICT(gauge_key) DO UPDATE SET
            coverage_start = excluded.coverage_start, repair_from = excluded.repair_from
        WHERE gauge_sync_state.coverage_start IS NOT excluded.coverage_start
           OR gauge_sync_state.repair_from IS NOT excluded.repair_from
    `).bind(chunk)));
}

/** A lone backfill fetch for this gauge failed: back off exponentially, capped at a day. */
export async function recordBackfillFailure(db: D1Database, gaugeKey: number, now: number): Promise<number> {
    const res = await db.prepare(`
        INSERT INTO gauge_sync_state (gauge_key, fail_count, retry_at) VALUES (?1, 1, ?2 + 900000)
        ON CONFLICT(gauge_key) DO UPDATE SET
            fail_count = gauge_sync_state.fail_count + 1,
            retry_at = ?2 + MIN(86400000, 900000 * (1 << MIN(gauge_sync_state.fail_count + 1, 7)))
    `).bind(gaugeKey, now).run();
    return writtenOf(res);
}

/** Clears backfill failure state; writes only rows that had any. */
export async function clearBackfillFailures(db: D1Database, gaugeKeys: number[]): Promise<number> {
    if (gaugeKeys.length === 0) return 0;
    return runBatch(db, chunkAsJson(gaugeKeys).map(chunk => db.prepare(`
        UPDATE gauge_sync_state SET fail_count = 0, retry_at = NULL
         WHERE (fail_count <> 0 OR retry_at IS NOT NULL)
           AND gauge_key IN (SELECT value FROM json_each(?1))
    `).bind(chunk)));
}

// --- META ---

export async function getMeta(db: D1Database, key: string): Promise<number | null> {
    const row = await db.prepare(`SELECT v FROM sync_meta WHERE k = ?1`).bind(key).first<{ v: number | null }>();
    return row?.v ?? null;
}

export async function setMeta(db: D1Database, key: string, value: number): Promise<number> {
    const res = await db.prepare(`
        INSERT INTO sync_meta (k, v) VALUES (?1, ?2)
        ON CONFLICT(k) DO UPDATE SET v = excluded.v WHERE sync_meta.v IS NOT excluded.v
    `).bind(key, value).run();
    return writtenOf(res);
}

export async function countReadings(db: D1Database): Promise<number> {
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM gauge_readings`).first<{ n: number }>();
    return row?.n ?? 0;
}
