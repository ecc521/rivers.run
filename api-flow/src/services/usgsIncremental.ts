import { processUSGSResponse, fetchOGCFeatures, USGS_API_BASE, PARAMETER_CODES } from "./usgs";
import type { StoredReading } from "./flowStore";
import { RETENTION_MS } from "./flowStore";

/**
 * Incremental USGS ingest driven by the OGC API's `last_modified` queryable.
 *
 * This is the only provider path that can detect *revisions*: `last_modified`
 * changes whenever USGS refreshes a record, including retroactive edits to
 * observations we already stored. A plain `datetime` window cannot see those.
 * Measured example: a single 24h `last_modified` sweep on USGS-03451500
 * returned 6,999 records reaching back 70 days, i.e. a bulk rewrite of already
 * published data.
 *
 * Two measured constraints shape everything here:
 *
 *  1. **It does not scale past a couple dozen sites per request.** Latency
 *     tracks site count, not payload: 10 sites ~2.6s, 25 sites ~48s, 50 sites
 *     ~50s, 100+ server-cancelled with `InvalidQuery: Long running query has
 *     been cancelled`. A global sweep with no site filter returns nothing.
 *     Hence BATCH_SIZE = 10 and tier A only.
 *  2. **It is slow and erratic even when it works** — the same 10-site query
 *     measured 2.6s and 13s minutes apart. Every call is wrapped in a timeout
 *     with a plain `datetime` fallback (~4x faster, predictable result size).
 *
 * USGS notes that `last_modified` also changes on routine refreshes, so it is a
 * superset of real revisions. That is the safe direction: we re-upsert, and the
 * (gauge_key, ts) primary key makes a redundant write a no-op.
 */

export const BATCH_SIZE = 10;
export const CONCURRENCY = 4;

/**
 * Request-size budget, in "site-days" (sites x days of window).
 *
 * Batch size cannot be a constant, because payload scales with sites *times*
 * window width. Measured: 10 sites over 24h is ~2,622 records / 2.2MB, and one
 * site over the full 30-day horizon is ~2,876 records / ~2.4MB in 2.2s. Both
 * sit near 10-30 site-days. Naively batching 10 cold-start gauges over 30 days
 * would be 300 site-days — roughly 78k features and ~66MB in a single Worker
 * request, which is exactly how you OOM a cron.
 */
export const MAX_SITE_DAYS = 30;

/**
 * How many never-synced gauges to backfill per cycle. This is what makes the
 * cursor mechanism double as a resumable backfill: cold gauges are drained a
 * few cycles at a time instead of monopolizing one, and no separate backfill
 * job is needed.
 */
export const MAX_COLD_GAUGES_PER_CYCLE = 40;

const DAY_MS = 86_400_000;

/** Sites per request such that sites x window stays within MAX_SITE_DAYS. */
export function batchSizeForWindow(windowMs: number): number {
    const days = Math.max(windowMs, 0) / DAY_MS;
    if (days <= 0) return BATCH_SIZE;
    return Math.max(1, Math.min(BATCH_SIZE, Math.floor(MAX_SITE_DAYS / days)));
}

/** Re-read this far behind the cursor to absorb clock skew and late writes. */
export const CURSOR_OVERLAP_MS = 5 * 60 * 1000;

/** Hold the cursor this far behind the newest last_modified seen. */
export const CURSOR_SAFETY_LAG_MS = 60 * 1000;

/** Beyond this staleness, a `datetime` window is cheaper than a cursor sweep. */
export const CURSOR_STALE_MS = 6 * 60 * 60 * 1000;

/**
 * Defensive ceiling on records accepted from one gauge in one cycle.
 *
 * In normal operation this cannot trip. Readings are snapped to 5-minute
 * buckets and filtered to the 30-day horizon, so a single gauge is
 * *structurally* bounded at 30d / 5min = 8,640 readings — which also covers the
 * 6,999-record revision rewrite observed on USGS-03451500. This exists only in
 * case that snapping or the horizon changes; the guard that actually protects
 * request size is MAX_SITE_DAYS.
 *
 * Sizing matters: an earlier 3,000 cap silently truncated the cold-start
 * backfill of USGS-01646500 (a 5-minute gauge, 288 readings/day) to its newest
 * 10 days.
 */
export const MAX_RECORDS_PER_GAUGE = 12_000;

export const REQUEST_TIMEOUT_MS = 25_000;

export interface IngestResult {
    readings: StoredReading[];
    /** New cursor per gauge id. Absent = do not advance. */
    cursors: Map<string, number>;
    /** Gauges whose per-cycle cap tripped; their cursor is deliberately held. */
    capped: string[];
    /** Gauges that fell back to a datetime window. */
    fellBack: string[];
    /** Cold gauges left for a later cycle by MAX_COLD_GAUGES_PER_CYCLE. */
    deferred: number;
    errors: Map<string, string>;
}

const toISO = (ts: number) => new Date(ts).toISOString().replace(/\.\d{3}Z$/, "Z");

export function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

/**
 * Converts parsed GaugeHistory records into flat StoredReading rows, capping
 * per-gauge volume and tracking the newest last_modified seen per gauge.
 */
export function toStoredReadings(
    histories: Record<string, any>,
    horizonTs: number
): { readings: StoredReading[]; maxModified: Map<string, number>; capped: string[] } {
    const readings: StoredReading[] = [];
    const maxModified = new Map<string, number>();
    const capped: string[] = [];

    for (const [bareId, history] of Object.entries(histories)) {
        const gaugeId = `USGS:${bareId}`;
        const all = (history?.readings ?? []) as Array<Record<string, any>>;

        // Keep the NEWEST records when capping — a runaway historical rewrite
        // must not starve us of current data.
        const inWindow = all.filter(r => typeof r.dateTime === "number" && r.dateTime >= horizonTs);
        const sorted = inWindow.toSorted((a, b) => a.dateTime - b.dateTime);
        const kept = sorted.length > MAX_RECORDS_PER_GAUGE
            ? sorted.slice(sorted.length - MAX_RECORDS_PER_GAUGE)
            : sorted;

        if (sorted.length > MAX_RECORDS_PER_GAUGE) capped.push(gaugeId);

        for (const r of kept) {
            readings.push({
                gaugeId,
                ts: r.dateTime,
                cfs: r.cfs,
                ft: r.ft,
                cms: r.cms,
                m: r.m,
                temp_f: r.temp_f,
                precip_in: r.precip_in,
                approved: r.approved === true,
                srcModified: typeof r.srcModified === "number" ? r.srcModified : undefined,
            });
            if (typeof r.srcModified === "number") {
                const prev = maxModified.get(gaugeId) ?? 0;
                if (r.srcModified > prev) maxModified.set(gaugeId, r.srcModified);
            }
        }
    }

    return { readings, maxModified, capped };
}

/**
 * Decides, per batch, whether to sweep by `last_modified` or fall back to a
 * plain `datetime` window.
 *
 * A null cursor (never synced) or one older than CURSOR_STALE_MS means we are
 * recovering a gap rather than doing steady-state incremental work, and the
 * datetime form is both faster and bounded.
 */
export function planBatchQuery(
    cursors: Array<number | null>,
    now: number
): { mode: "cursor" | "datetime"; since: number } {
    const usable = cursors.filter((c): c is number => typeof c === "number" && c > 0);

    if (usable.length !== cursors.length) {
        return { mode: "datetime", since: now - RETENTION_MS };
    }

    const min = Math.min(...usable);
    if (now - min > CURSOR_STALE_MS) {
        return { mode: "datetime", since: Math.max(min, now - RETENTION_MS) };
    }

    return { mode: "cursor", since: min - CURSOR_OVERLAP_MS };
}

function buildUrl(bareIds: string[], mode: "cursor" | "datetime", since: number, now: number): string {
    const ids = bareIds.map(id => `USGS-${id}`).join(",");
    const base = `${USGS_API_BASE}/continuous/items?f=json&monitoring_location_id=${ids}` +
                 `&parameter_code=${PARAMETER_CODES}&limit=10000`;

    return mode === "cursor"
        ? `${base}&last_modified=${toISO(since)}/..`
        : `${base}&datetime=${toISO(since)}/${toISO(now)}`;
}

type FetchOutcome =
    | { ok: true; features: any[]; usedMode: "cursor" | "datetime" }
    | { ok: false; error: string };

/**
 * Fetches one batch, retrying a stalled cursor query as a datetime window.
 *
 * The cursor form is the one that stalls and gets server-cancelled, and the
 * datetime form covers the same period ~4x faster with a predictable result
 * size — so a cursor failure is worth one immediate retry rather than losing
 * the batch for the cycle.
 */
async function fetchBatch(
    fetchFeatures: typeof fetchOGCFeatures,
    ids: string[],
    plan: { mode: "cursor" | "datetime"; since: number },
    horizonTs: number,
    now: number,
    env: any
): Promise<FetchOutcome> {
    try {
        const features = await fetchFeatures(
            buildUrl(ids, plan.mode, plan.since, now), REQUEST_TIMEOUT_MS, env);
        return { ok: true, features, usedMode: plan.mode };
    } catch (e) {
        if (plan.mode !== "cursor") {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    }

    try {
        const features = await fetchFeatures(
            buildUrl(ids, "datetime", Math.max(plan.since, horizonTs), now),
            REQUEST_TIMEOUT_MS, env);
        return { ok: true, features, usedMode: "datetime" };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}

/**
 * Runs one incremental pass over the given tier-A USGS gauges.
 *
 * @param bareIdsWithCursors bare site ids (no 'USGS:' prefix) with their stored cursor
 */
export async function ingestUsgsIncremental(
    bareIdsWithCursors: Array<{ id: string; cursor: number | null }>,
    env: any,
    now: number = Date.now(),
    deps: { fetchFeatures?: typeof fetchOGCFeatures } = {}
): Promise<IngestResult> {
    const fetchFeatures = deps.fetchFeatures ?? fetchOGCFeatures;

    const result: IngestResult = {
        readings: [],
        cursors: new Map(),
        capped: [],
        fellBack: [],
        deferred: 0,
        errors: new Map(),
    };

    const valid = bareIdsWithCursors.filter(g => /^\d+$/.test(g.id));
    const horizonTs = now - RETENTION_MS;

    // Partition BEFORE batching. Batch size depends on the query window, and a
    // cold gauge's window is the full 30-day horizon while a warm one's is
    // minutes — mixing them into one batch would size the request for the
    // narrow window and then request the wide one.
    const warm: typeof valid = [];
    const cold: typeof valid = [];
    for (const g of valid) {
        (planBatchQuery([g.cursor], now).mode === "cursor" ? warm : cold).push(g);
    }

    // Drain cold gauges gradually; the rest are picked up next cycle.
    const coldThisCycle = cold.slice(0, MAX_COLD_GAUGES_PER_CYCLE);
    result.deferred = cold.length - coldThisCycle.length;

    const batches: Array<{ items: typeof valid; mode: "cursor" | "datetime"; since: number }> = [];

    for (const batch of chunk(warm, BATCH_SIZE)) {
        batches.push({ items: batch, ...planBatchQuery(batch.map(g => g.cursor), now) });
    }
    for (const g of coldThisCycle) {
        const plan = planBatchQuery([g.cursor], now);
        batches.push({ items: [g], ...plan });
    }
    // Cold batches are sized by window: 30 days -> 1 site, 6h -> the full 10.
    const sized: typeof batches = [];
    for (const b of batches) {
        const size = b.mode === "cursor" ? BATCH_SIZE : batchSizeForWindow(now - b.since);
        for (const part of chunk(b.items, size)) sized.push({ ...b, items: part });
    }

    let index = 0;
    const worker = async () => {
        while (index < sized.length) {
            const { items: batch, ...plan } = sized[index++];
            const ids = batch.map(g => g.id);

            const fetched = await fetchBatch(fetchFeatures, ids, plan, horizonTs, now, env);

            if (!fetched.ok) {
                for (const g of batch) result.errors.set(`USGS:${g.id}`, fetched.error);
                continue;
            }

            if (fetched.usedMode === "datetime") {
                for (const g of batch) result.fellBack.push(`USGS:${g.id}`);
            }

            const histories = processUSGSResponse(fetched.features);
            const { readings, maxModified, capped } = toStoredReadings(histories, horizonTs);

            result.readings.push(...readings);
            result.capped.push(...capped);

            const cappedSet = new Set(capped);
            for (const g of batch) {
                const gaugeId = `USGS:${g.id}`;
                const wasCapped = cappedSet.has(gaugeId);

                // The cursor is deliberately NOT held when the cap trips.
                //
                // Holding it only makes sense for a cursor sweep, where
                // re-reading the same window drains a large rewrite. On a
                // datetime fetch the window is the fixed cold-start range, so
                // holding it would re-fetch the same 30 days every cycle, keep
                // the newest N, and never go warm — the gauge would never reach
                // steady state. Since the cap is defensive and effectively
                // unreachable (see MAX_RECORDS_PER_GAUGE), always advancing is
                // both simpler and the safe choice for liveness.
                const seen = maxModified.get(gaugeId);
                if (seen && !wasCapped) {
                    result.cursors.set(gaugeId, seen - CURSOR_SAFETY_LAG_MS);
                } else if (fetched.usedMode === "datetime" || wasCapped) {
                    // Either nothing to learn a cursor from, or we truncated —
                    // the recent window is covered either way, so start the
                    // cursor here rather than repeating the full fallback.
                    result.cursors.set(gaugeId, now - CURSOR_SAFETY_LAG_MS);
                }
            }
        }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    return result;
}
