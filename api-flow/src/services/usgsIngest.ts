import { fetchOGCPages, USGS_API_BASE, PARAMETER_CODES } from "./usgs";
import { isValidReadingValue } from "./provider";
import {
    reduceToSlots, upsertSlots, slotStartOf,
    readProviderSyncState, extendCoverage, markRepair, markProviderRepair, clearRepair,
    recordBackfillFailure, clearBackfillFailures,
    getMeta, setMeta, SLOT_MS, RETENTION_MS,
    type ObservedReading, type SyncState,
} from "./flowStore";

/**
 * USGS ingest for every registry gauge, in three parts:
 *
 *  1. Window sweep, every cycle: `datetime=<now-6h>/..`, 200 sites a request.
 *     Re-reading 6h makes a few missed cycles harmless.
 *  2. Revision sweep, hourly: `last_modified=<cursor>/..` bounded by
 *     `datetime=<now-30d>/..`. One global cursor, advanced only when every
 *     batch completed.
 *  3. Backfill: repair of failed windows, then cold gauges to 7 days (the
 *     model's hindcast), then to 30 days. Chunked by site-days and capped per
 *     cycle and by the API's remaining rate budget.
 *
 * All of it goes through the guarded ring-buffer upsert, so re-reading
 * unchanged data costs requests but no D1 writes.
 */

export const SITES_PER_REQUEST = 200;
export const WINDOW_MS = 6 * 60 * 60 * 1000;
/** Longest window the sweep widens to after missed cycles; beyond it, repair. */
export const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
export const REVISION_OVERLAP_MS = 15 * 60 * 1000;
export const PRIORITY_BACKFILL_MS = 7 * 24 * 60 * 60 * 1000;
/** ~26k features (~10MB) a request at ~260 records per site-day. */
export const SITE_DAYS_PER_REQUEST = 100;
export const PAGE_LIMIT = 20_000;
export const REQUEST_TIMEOUT_MS = 90_000;
export const DEFAULT_BACKFILL_REQUESTS = 100;
/** Page cap per revision sweep; an unfinished sweep holds the cursor. */
export const MAX_REVISION_PAGES = 120;
/** A cursor older than this is abandoned for datetime repair of the gap. */
export const MAX_REVISION_LAG_MS = 24 * 60 * 60 * 1000;
/** Backfill and revision work stop when X-RateLimit-Remaining falls below this. */
export const RATE_RESERVE = 300;

const WINDOW_CONCURRENCY = 4;
const REVISION_CONCURRENCY = 4;
const BACKFILL_CONCURRENCY = 2;
const DAY_MS = 86_400_000;

const PROPERTIES = "monitoring_location_id,parameter_code,time,value,approval_status,time_series_id";

export const META_WINDOW_OK = "usgs_window_ok_at";
export const META_REVISION_CURSOR = "usgs_revision_cursor";

const toISO = (ts: number) => new Date(ts).toISOString().replace(/\.\d{3}Z$/, "Z");

export function buildContinuousUrl(
    bareIds: string[],
    q: { from: number; to?: number; lastModifiedFrom?: number }
): string {
    const ids = bareIds.map(id => `USGS-${id}`).join(",");
    let url = `${USGS_API_BASE}/continuous/items?f=json&monitoring_location_id=${ids}` +
        `&parameter_code=${PARAMETER_CODES}&datetime=${toISO(q.from)}/${q.to ? toISO(q.to) : ".."}` +
        `&skipGeometry=true&properties=${PROPERTIES}&limit=${PAGE_LIMIT}`;
    if (q.lastModifiedFrom !== undefined) url += `&last_modified=${toISO(q.lastModifiedFrom)}/..`;
    return url;
}

const PARAM_COLUMN: Record<string, "cfs" | "ft" | "temp_c" | "temp_f" | "precip_in"> = {
    "00060": "cfs", "00065": "ft", "00010": "temp_c", "00011": "temp_f", "00045": "precip_in",
};

interface Pending {
    reading: ObservedReading;
    /** Winning time_series_id per column, for a deterministic pick among duplicate series. */
    series: Map<string, string>;
    tempFromF: boolean;
}

/**
 * Turns OGC features into one ObservedReading per (site, timestamp). When a
 * site has several series for one parameter, the lowest time_series_id wins,
 * so the result never depends on page order.
 */
export class FeatureAccumulator {
    private byKey = new Map<string, Pending>();

    add(features: any[]): void {
        for (const f of features) {
            const p = f?.properties ?? {};
            const site = String(p.monitoring_location_id ?? "").replace(/^USGS-/i, "");
            const column = PARAM_COLUMN[p.parameter_code];
            if (!site || !column || p.value === null || p.value === undefined || p.value === "") continue;

            const raw = Number(p.value);
            if (!Number.isFinite(raw) || raw <= -999999) continue;
            const ts = new Date(p.time).getTime();
            if (!Number.isFinite(ts)) continue;

            const target = column === "temp_c" ? "temp_f" : column;
            const value = column === "temp_c" ? Math.round((raw * 1.8 + 32) * 100) / 100 : raw;
            if (!isValidReadingValue(value, target)) continue;

            const key = `${site}|${ts}`;
            let pending = this.byKey.get(key);
            if (!pending) {
                pending = { reading: { gaugeId: `USGS:${site}`, ts, approved: true }, series: new Map(), tempFromF: false };
                this.byKey.set(key, pending);
            }

            // A native degF series beats a converted degC one.
            if (target === "temp_f") {
                const isF = column === "temp_f";
                if (pending.tempFromF && !isF) continue;
                if (isF && !pending.tempFromF) { pending.tempFromF = true; pending.series.delete("temp_f"); }
            }

            const sid = String(p.time_series_id ?? "");
            const prevSid = pending.series.get(target);
            if (prevSid !== undefined && prevSid <= sid) continue;
            pending.series.set(target, sid);
            (pending.reading as any)[target] = value;
            if (p.approval_status !== "Approved") pending.reading.approved = false;
        }
    }

    readings(): ObservedReading[] {
        const out: ObservedReading[] = [];
        for (const p of this.byKey.values()) out.push(p.reading);
        return out;
    }
}

/** Tracks request spend and the API's reported remaining budget. */
export class RateBudget {
    requests = 0;
    remaining: number | null = null;

    record(pages: number, remaining: number | null): void {
        this.requests += pages;
        if (remaining !== null) this.remaining = remaining;
    }

    /** True if `n` more requests leave at least RATE_RESERVE. Unknown is optimistic. */
    allows(n: number): boolean {
        return this.remaining === null || this.remaining - n >= RATE_RESERVE;
    }
}

export interface UsgsDeps {
    fetchPages?: typeof fetchOGCPages;
}

export interface UsgsCycleStats {
    requests: number;
    windowBatches: number;
    windowFailed: number;
    windowFrom: number;
    revision: "ran" | "incomplete" | "skipped-budget" | "initialized" | "not-due" | "lagged-to-repair";
    revisionBatches: number;
    backfillRequests: number;
    backfillStopped: "done" | "request-cap" | "rate-budget" | null;
    rowsWritten: { window: number; revision: number; backfill: number; state: number };
    rateRemaining: number | null;
}

export interface UsgsCycleInput {
    db: D1Database;
    env: any;
    /** Bare USGS site ids. */
    siteIds: string[];
    keys: Map<string, number>;
    now: number;
    runRevision: boolean;
    backfillRequests?: number;
    deps?: UsgsDeps;
    /** Filled with the newest reading seen per gauge id, for sitedata.json. */
    latest?: Map<string, ObservedReading>;
}

function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    let index = 0;
    const worker = async () => {
        while (index < items.length) await fn(items[index++]);
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

interface FetchOutcome { complete: boolean; stopped: boolean; pages: number; written: number }

/**
 * Fetches one request and upserts each page as it arrives, so memory is one
 * page. `shouldStop` is checked after every page. The guarded upsert makes
 * the result independent of page order, except which of two duplicate
 * series wins when they straddle a page boundary.
 */
async function fetchAndStore(
    url: string,
    input: UsgsCycleInput,
    budget: RateBudget,
    windowStart: number,
    shouldStop?: () => boolean
): Promise<FetchOutcome> {
    const fetchPages = input.deps?.fetchPages ?? fetchOGCPages;
    let written = 0;
    const res = await fetchPages(url, REQUEST_TIMEOUT_MS, input.env, async (page, info) => {
        if (info.rateRemaining !== null) budget.remaining = info.rateRemaining;
        const acc = new FeatureAccumulator();
        acc.add(page);
        const readings = acc.readings();
        if (input.latest) {
            for (const r of readings) {
                const prev = input.latest.get(r.gaugeId);
                if (r.ts <= input.now && (!prev || r.ts > prev.ts)) input.latest.set(r.gaugeId, r);
            }
        }
        written += await upsertSlots(input.db, reduceToSlots(readings, { now: input.now, windowStart }), input.keys);
        return shouldStop ? !shouldStop() : undefined;
    });
    budget.record(res.pages, res.rateRemaining);
    return { complete: res.complete, stopped: res.stopped === true, pages: res.pages, written };
}

const keysFor = (ids: string[], keys: Map<string, number>) =>
    ids.map(id => keys.get(`USGS:${id}`)).filter((k): k is number => k !== undefined);

/** Picks the window start, widening it after missed cycles. */
export function planWindow(okAt: number | null, now: number): { from: number; repairFrom: number | null } {
    const normal = slotStartOf(now - WINDOW_MS);
    if (okAt === null) return { from: normal, repairFrom: null };
    const resume = slotStartOf(okAt - REVISION_OVERLAP_MS);
    if (resume >= normal) return { from: normal, repairFrom: null };
    const floor = slotStartOf(now - MAX_WINDOW_MS);
    if (resume >= floor) return { from: resume, repairFrom: null };
    return { from: floor, repairFrom: Math.max(resume, slotStartOf(now - RETENTION_MS)) };
}

async function windowSweep(input: UsgsCycleInput, budget: RateBudget, stats: UsgsCycleStats): Promise<void> {
    const { db, now, keys } = input;
    const plan = planWindow(await getMeta(db, META_WINDOW_OK), now);
    stats.windowFrom = plan.from;
    if (plan.repairFrom !== null) {
        stats.rowsWritten.state += await markProviderRepair(db, "USGS", plan.repairFrom);
    }

    const batches = chunk(input.siteIds, SITES_PER_REQUEST);
    stats.windowBatches = batches.length;

    await runPool(batches, WINDOW_CONCURRENCY, async ids => {
        const out = await fetchAndStore(buildContinuousUrl(ids, { from: plan.from }), input, budget, plan.from);
        stats.rowsWritten.window += out.written;
        const batchKeys = keysFor(ids, keys);
        if (out.complete) {
            stats.rowsWritten.state += await clearRepair(db, batchKeys, plan.from);
        } else {
            stats.windowFailed++;
            stats.rowsWritten.state += await markRepair(db, batchKeys, plan.from);
        }
    });

    stats.rowsWritten.state += await setMeta(db, META_WINDOW_OK, now);
}

async function revisionSweep(input: UsgsCycleInput, budget: RateBudget, stats: UsgsCycleStats): Promise<void> {
    const { db, now } = input;
    const cursor = await getMeta(db, META_REVISION_CURSOR);
    if (cursor === null) {
        // Backfill loads history; revisions matter from here on.
        stats.rowsWritten.state += await setMeta(db, META_REVISION_CURSOR, now);
        stats.revision = "initialized";
        return;
    }
    if (now - cursor > MAX_REVISION_LAG_MS) {
        // Too far behind to catch up by last_modified: refetch the gap by
        // datetime instead (backfill repairs) and restart the cursor.
        const from = Math.max(slotStartOf(cursor - REVISION_OVERLAP_MS), slotStartOf(now - RETENTION_MS));
        stats.rowsWritten.state += await markProviderRepair(db, "USGS", from);
        stats.rowsWritten.state += await setMeta(db, META_REVISION_CURSOR, now);
        stats.revision = "lagged-to-repair";
        return;
    }

    const batches = chunk(input.siteIds, SITES_PER_REQUEST);
    if (!budget.allows(batches.length)) {
        stats.revision = "skipped-budget";
        return;
    }

    const from = slotStartOf(now - RETENTION_MS);
    const lastModifiedFrom = cursor - REVISION_OVERLAP_MS;
    let allComplete = true;
    let pages = 0;
    const overBudget = () => pages >= MAX_REVISION_PAGES || !budget.allows(1);
    const afterPage = () => { pages++; return overBudget(); };
    stats.revisionBatches = batches.length;

    await runPool(batches, REVISION_CONCURRENCY, async ids => {
        if (overBudget()) { allComplete = false; return; }
        const out = await fetchAndStore(buildContinuousUrl(ids, { from, lastModifiedFrom }), input, budget, from, afterPage);
        if (!out.complete) allComplete = false;
        stats.rowsWritten.revision += out.written;
    });

    if (allComplete) {
        stats.rowsWritten.state += await setMeta(db, META_REVISION_CURSOR, now);
        stats.revision = "ran";
    } else {
        stats.revision = "incomplete";
    }
}

export interface BackfillTask {
    siteId: string;
    gaugeKey: number;
    kind: "repair" | "recent" | "full";
    from: number;
    to: number;
}

/** Work still owed, most urgent first: repairs, then 7 days, then 30 days. */
export function planBackfill(
    state: Map<string, Pick<SyncState, "gaugeKey" | "coverageStart" | "repairFrom"> & { retryAt?: number | null }>,
    siteIds: string[],
    windowFrom: number,
    now: number
): BackfillTask[] {
    const recentTarget = slotStartOf(now - PRIORITY_BACKFILL_MS);
    const fullTarget = slotStartOf(now - RETENTION_MS);
    const repair: BackfillTask[] = [], recent: BackfillTask[] = [], full: BackfillTask[] = [];

    for (const siteId of siteIds) {
        const s = state.get(`USGS:${siteId}`);
        if (!s || (s.retryAt != null && s.retryAt > now)) continue;
        const base = { siteId, gaugeKey: s.gaugeKey };
        if (s.repairFrom !== null && s.repairFrom < windowFrom) {
            repair.push({ ...base, kind: "repair", from: s.repairFrom, to: windowFrom });
        }
        const cov = s.coverageStart;
        if (cov === null || cov > recentTarget) {
            recent.push({ ...base, kind: "recent", from: recentTarget, to: cov ?? now });
        } else if (cov > fullTarget) {
            full.push({ ...base, kind: "full", from: fullTarget, to: cov });
        }
    }

    const byTo = (a: BackfillTask, b: BackfillTask) => (b.to - a.to) || (a.from - b.from);
    return [...repair.sort(byTo), ...recent.sort(byTo), ...full.sort(byTo)];
}

/** Groups tasks of one kind into requests of at most SITE_DAYS_PER_REQUEST. */
export function groupTasks(tasks: BackfillTask[]): BackfillTask[][] {
    const groups: BackfillTask[][] = [];
    let current: BackfillTask[] = [];
    let from = Infinity, to = -Infinity;

    for (const t of tasks) {
        const nf = Math.min(from, t.from), nt = Math.max(to, t.to);
        const siteDays = (current.length + 1) * Math.max((nt - nf) / DAY_MS, 1 / 24);
        const sameKind = current.length === 0 || current[0].kind === t.kind;
        if (current.length > 0 && (!sameKind || current.length >= SITES_PER_REQUEST || siteDays > SITE_DAYS_PER_REQUEST)) {
            groups.push(current);
            current = [];
            from = t.from; to = t.to;
        } else {
            from = nf; to = nt;
        }
        current.push(t);
    }
    if (current.length > 0) groups.push(current);
    return groups;
}

async function backfill(input: UsgsCycleInput, budget: RateBudget, stats: UsgsCycleStats): Promise<void> {
    const { db, now } = input;
    const cap = input.backfillRequests ?? DEFAULT_BACKFILL_REQUESTS;
    const state = await readProviderSyncState(db, "USGS");
    const queue = groupTasks(planBackfill(state, input.siteIds, stats.windowFrom, now));
    if (queue.length === 0) { stats.backfillStopped = "done"; return; }

    let spent = 0;
    const worker = async () => {
        while (queue.length > 0) {
            if (spent >= cap) { stats.backfillStopped ??= "request-cap"; return; }
            if (!budget.allows(1)) { stats.backfillStopped = "rate-budget"; return; }
            const group = queue.shift()!;

            const from = Math.min(...group.map(t => t.from));
            const to = Math.max(...group.map(t => t.to));
            const out = await fetchAndStore(buildContinuousUrl(group.map(t => t.siteId), { from, to }),
                input, budget, from, () => !budget.allows(1));
            spent += out.pages;
            stats.backfillRequests += out.pages;
            stats.rowsWritten.backfill += out.written;

            const groupKeys = group.map(t => t.gaugeKey);
            if (out.complete) {
                stats.rowsWritten.state += group[0].kind === "repair"
                    ? await clearRepair(db, groupKeys, from)
                    : await extendCoverage(db, groupKeys, from);
                const failed = group.filter(t => (state.get(`USGS:${t.siteId}`)?.failCount ?? 0) > 0);
                stats.rowsWritten.state += await clearBackfillFailures(db, failed.map(t => t.gaugeKey));
            } else if (!out.stopped) {
                // Isolate a bad site: retry halves now, back off a lone failure.
                if (group.length > 1) {
                    const mid = Math.ceil(group.length / 2);
                    queue.unshift(group.slice(0, mid), group.slice(mid));
                } else {
                    stats.rowsWritten.state += await recordBackfillFailure(db, group[0].gaugeKey, now);
                }
            }
        }
    };
    await Promise.all(Array.from({ length: BACKFILL_CONCURRENCY }, worker));
    stats.backfillStopped ??= queue.length === 0 ? "done" : "request-cap";
}

/** True for the cycle in the first quarter hour of each UTC hour. */
export function isHourlyCycle(now: number): boolean {
    return Math.floor(now / SLOT_MS) % 4 === 0;
}

export async function runUsgsCycle(input: UsgsCycleInput): Promise<UsgsCycleStats> {
    const budget = new RateBudget();
    const stats: UsgsCycleStats = {
        requests: 0, windowBatches: 0, windowFailed: 0, windowFrom: 0,
        revision: "not-due", revisionBatches: 0,
        backfillRequests: 0, backfillStopped: null,
        rowsWritten: { window: 0, revision: 0, backfill: 0, state: 0 },
        rateRemaining: null,
    };
    const siteIds = input.siteIds.filter(id => /^\d+$/.test(id));
    const run = { ...input, siteIds };

    if (siteIds.length > 0) {
        await windowSweep(run, budget, stats);
        if (input.runRevision) await revisionSweep(run, budget, stats);
        await backfill(run, budget, stats);
    }

    stats.requests = budget.requests;
    stats.rateRemaining = budget.remaining;
    return stats;
}
