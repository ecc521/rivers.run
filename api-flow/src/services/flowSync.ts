import type { Env } from "../index";
import type { GaugeProvider, GaugeHistory, GaugeReading, BulkUnit } from "./provider";
import { logToD1 } from "../utils/logger";
import { normalizeGaugeId } from "../utils/formatting";
import { withTimeout } from "../utils/timeout";
import {
    resolveGaugeKeys, upsertSlots, reduceToSlots, readSeries, readLatest, readSyncState,
    markRepair, writeCoverage, getMeta, setMeta, slotStartOf, servedTime, isStorableGaugeId, rowToReading,
    SLOT_MS, type GaugeDimension, type ObservedReading, type CoverageUpdate, type SlotRow,
} from "./flowStore";
import { runUsgsCycle, isHourlyCycle, META_WINDOW_OK, type UsgsCycleStats } from "./usgsIngest";

/**
 * The 15-minute ingest cycle, and the projection of sitedata.json from the
 * store. USGS has its own sweeps (usgsIngest.ts). The other providers:
 *
 *  - EC, NWS: every observation in each province file or gauge series, one
 *    unit at a time. Coverage is tracked per gauge, and a failed unit marks
 *    its gauges for repair. NWS forecast rows go to sitedata.json only.
 *  - UK, IE: latest-only bulk calls; linked gauges also get a 3h history.
 *    UK is fetched every cycle but stored only on the hourly cycle, one
 *    reading per gauge per hour; sitedata.json uses the fetch directly.
 */

const LINKED_HISTORY_MS = 3 * 60 * 60 * 1000;
/** sitedata.json carries this much history for river-linked gauges. */
const PROJECTION_WINDOW_MS = 3 * 60 * 60 * 1000;
/** Latest reading lookback for sitedata.json; older gauges keep their previous entry. */
const LATEST_WINDOW_MS = 12 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 600_000;
const HOUR_MS = 60 * 60 * 1000;
/** /history trusts the store only if its provider ingested this recently. */
export const FRESH_INGEST_MS = 45 * 60 * 1000;

/** Providers ingested unit by unit with coverage tracking. */
export const BULK_PROVIDERS = new Set(["EC", "NWS"]);

/** Latest-only providers stored only on the hourly cycle, one reading per gauge per hour. */
export const HOURLY_STORE_PROVIDERS = new Set(["UK"]);

/** The sync_meta key holding a provider's last successful ingest. */
export const ingestMetaKey = (prefix: string) => prefix === "USGS" ? META_WINDOW_OK : `ok_at:${prefix}`;

/**
 * True when the store holds a complete, fresh series for `gaugeId` from
 * `start` to now: coverage reaches `start`, no repair is pending, and the
 * provider ingested within FRESH_INGEST_MS. UK and IE never qualify.
 */
export function storeCovers(
    gaugeId: string,
    state: { coverageStart: number | null; repairFrom: number | null } | undefined,
    start: number,
    ingestedAt: number | null,
    now: number
): boolean {
    const prefix = gaugeId.split(":")[0];
    if (prefix !== "USGS" && !BULK_PROVIDERS.has(prefix)) return false;
    if (ingestedAt === null || now - ingestedAt > FRESH_INGEST_MS) return false;
    if (!state || state.coverageStart === null || state.repairFrom !== null) return false;
    return state.coverageStart <= slotStartOf(start);
}

export interface SyncStats {
    gauges: number;
    linked: number;
    rowsWritten: { dimensions: number; providers: number; state: number };
    providerRows: Record<string, number>;
    usgs: UsgsCycleStats | null;
    errors: number;
    forecasts: Record<string, GaugeReading[]>;
    /** Newest reading fetched this cycle per gauge id, for sitedata.json. */
    latest: Map<string, ObservedReading>;
    /** Linked-gauge history fetched this cycle for HOURLY_STORE_PROVIDERS, for sitedata.json. */
    fetched: ObservedReading[];
}

/** Every gauge id referenced by a curated river. */
export async function readLinkedGaugeIds(env: Env): Promise<string[]> {
    try {
        const { results } = await env.DB.prepare("SELECT gauges FROM rivers").all();
        return (results || []).flatMap((row: any) => {
            try {
                const gauges = typeof row.gauges === "string" ? JSON.parse(row.gauges) : (row.gauges || []);
                return gauges
                    .map((g: any) => (typeof g.id === "string" ? normalizeGaugeId(g.id) : ""))
                    .filter(Boolean);
            } catch (e) {
                console.warn("Failed to parse gauges for row, skipping.", e);
                return [];
            }
        });
    } catch (err) {
        console.warn("Modern 'gauges' column not found, falling back to legacy 'river_gauges'...", err);
        try {
            const { results } = await env.DB.prepare("SELECT gauge_id FROM river_gauges").all();
            return (results || [])
                .map((row: any) => (typeof row.gauge_id === "string" ? normalizeGaugeId(row.gauge_id) : ""))
                .filter(Boolean);
        } catch (legacyErr) {
            console.error("FATAL: Could not read gauges from any schema.", legacyErr);
            return [];
        }
    }
}

const sanitizeCoordinate = (val: any): number | undefined => {
    if (val === undefined || val === null) return undefined;
    const base = Array.isArray(val) ? val[0] : val;
    const parsed = parseFloat(base);
    return isNaN(parsed) ? undefined : parsed;
};

/** Flattens provider histories into observations, splitting off forecast rows. */
export function historiesToReadings(
    prefix: string,
    histories: Record<string, GaugeHistory>,
    forecasts?: Record<string, GaugeReading[]>
): ObservedReading[] {
    const out: ObservedReading[] = [];
    for (const [bareId, history] of Object.entries(histories)) {
        const gaugeId = `${prefix}:${bareId}`;
        if (!isStorableGaugeId(gaugeId)) continue;
        for (const r of history?.readings ?? []) {
            if (typeof r.dateTime !== "number") continue;
            if (r.isForecast) {
                if (forecasts) {
                    if (!forecasts[gaugeId]) forecasts[gaugeId] = [];
                    forecasts[gaugeId].push(r);
                }
                continue;
            }
            out.push({
                gaugeId, ts: r.dateTime,
                cfs: r.cfs, ft: r.ft, cms: r.cms, m: r.m, temp_f: r.temp_f, precip_in: r.precip_in,
            });
        }
    }
    return out;
}

/** Dimension rows from the registry plus linked gauges, with NWM reach ids. */
export function buildDimensions(
    registryMetadata: Record<string, any>,
    linkedIds: string[],
    reaches: Record<string, string> = {}
): GaugeDimension[] {
    const dims = new Map<string, GaugeDimension>();
    const reachFor = (gaugeId: string) =>
        gaugeId.startsWith("USGS:") ? reaches[gaugeId.slice(5)] : undefined;

    for (const [rawId, meta] of Object.entries(registryMetadata)) {
        const gaugeId = normalizeGaugeId(rawId);
        if (!isStorableGaugeId(gaugeId)) continue;
        dims.set(gaugeId, {
            gaugeId,
            provider: gaugeId.split(":")[0],
            name: meta?.name || undefined,
            section: meta?.section || undefined,
            state: meta?.state || undefined,
            country: meta?.country || undefined,
            lat: sanitizeCoordinate(meta?.lat),
            lon: sanitizeCoordinate(meta?.lon),
            nwmReachId: reachFor(gaugeId),
        });
    }
    for (const raw of linkedIds) {
        const gaugeId = normalizeGaugeId(raw);
        if (!isStorableGaugeId(gaugeId) || dims.has(gaugeId)) continue;
        dims.set(gaugeId, { gaugeId, provider: gaugeId.split(":")[0], nwmReachId: reachFor(gaugeId) });
    }
    return [...dims.values()];
}

async function loadReaches(env: Env): Promise<Record<string, string>> {
    try {
        const obj = await env.FLOW_STORAGE?.get("usgs_reaches.json");
        return obj ? await obj.json() as Record<string, string> : {};
    } catch {
        return {};
    }
}

type IngestCtx = { env: Env; db: D1Database; keys: Map<string, number>; now: number; stats: SyncStats };

function noteLatest(latest: Map<string, ObservedReading>, readings: ObservedReading[], now: number): void {
    for (const r of readings) {
        const prev = latest.get(r.gaugeId);
        if (r.ts <= now && (!prev || r.ts > prev.ts)) latest.set(r.gaugeId, r);
    }
}

/** First slot fully inside the data: the earliest slot may be partial. */
const coveredFromTs = (earliest: number) =>
    earliest % SLOT_MS === 0 ? earliest : slotStartOf(earliest) + SLOT_MS;

/**
 * Coverage after a successful unit fetch, per gauge seen with readings
 * complete from `from`: a gap longer than the unit holds (previous success
 * before `from`) or an unrepairable pending repair restarts coverage at
 * `from`; otherwise coverage is kept, or starts at `from` on first sight.
 */
export function nextCoverage(
    state: { coverageStart: number | null; repairFrom: number | null } | undefined,
    from: number,
    previousOkAt: number | null
): { coverageStart: number; repairFrom: null } {
    const cov = state?.coverageStart ?? null;
    const gap = previousOkAt !== null && previousOkAt < from;
    const lostRepair = state?.repairFrom != null && state.repairFrom < from;
    return { coverageStart: cov === null || gap || lostRepair ? from : cov, repairFrom: null };
}

async function ingestUnit(ctx: IngestCtx, prefix: string, u: BulkUnit): Promise<boolean> {
    const { db, keys, now, stats } = ctx;
    const unitKeys = u.siteCodes.map(c => keys.get(`${prefix}:${c}`)).filter((k): k is number => k !== undefined);
    const metaKey = `ok_at:${prefix}:${u.unit}`;
    const previousOkAt = await getMeta(db, metaKey);
    if (u.histories === null) {
        // Unfetched since the last success: not servable until it is back.
        stats.rowsWritten.state += await markRepair(db, unitKeys, previousOkAt ?? now);
        return false;
    }
    for (const [site, rows] of Object.entries(u.forecasts ?? {})) stats.forecasts[`${prefix}:${site}`] = rows;

    const readings = historiesToReadings(prefix, u.histories);
    noteLatest(stats.latest, readings, now);
    const rows = reduceToSlots(readings, { now });
    const written = await upsertSlots(db, rows, keys);
    stats.providerRows[prefix] = (stats.providerRows[prefix] ?? 0) + written;
    stats.rowsWritten.providers += written;

    const earliest = new Map<string, number>();
    for (const r of readings) {
        if (!keys.has(r.gaugeId)) continue;
        const prev = earliest.get(r.gaugeId);
        if (prev === undefined || r.ts < prev) earliest.set(r.gaugeId, r.ts);
    }
    const state = await readSyncState(db, [...earliest.keys()]);
    const updates: CoverageUpdate[] = [];
    for (const [gaugeId, ts] of earliest) {
        const s = state.get(gaugeId);
        const next = nextCoverage(s, coveredFromTs(ts), previousOkAt);
        if (s?.coverageStart !== next.coverageStart || s?.repairFrom !== null) {
            updates.push({ gaugeKey: keys.get(gaugeId)!, ...next });
        }
    }
    stats.rowsWritten.state += await writeCoverage(db, updates);
    stats.rowsWritten.state += await setMeta(db, metaKey, now);
    return true;
}

async function ingestBulkProvider(ctx: IngestCtx, prefix: string, provider: GaugeProvider, siteCodes: string[]): Promise<void> {
    let anyOk = false;
    for await (const unit of provider.getBulkHistories!(siteCodes, ctx.env)) {
        if (await ingestUnit(ctx, prefix, unit)) anyOk = true;
    }
    if (anyOk) ctx.stats.rowsWritten.state += await setMeta(ctx.db, ingestMetaKey(prefix), ctx.now);
}

/** Per gauge and hour, the row closest to the hour start. */
function oneRowPerHour(rows: SlotRow[]): SlotRow[] {
    const best = new Map<string, SlotRow>();
    for (const r of rows) {
        const key = `${r.gaugeId}|${Math.floor(r.ts / HOUR_MS)}`;
        const prev = best.get(key);
        if (!prev || r.ts + r.off * 1000 < prev.ts + prev.off * 1000) best.set(key, r);
    }
    return [...best.values()];
}

/**
 * Latest-only providers: bulk latest for all, plus 3h of history for linked
 * gauges. HOURLY_STORE_PROVIDERS fetch every cycle but write only hourly.
 */
async function ingestLatestOnly(
    ctx: IngestCtx, prefix: string, provider: GaugeProvider, group: { linked: string[]; registry: string[] }
): Promise<void> {
    const { env, db, keys, now, stats } = ctx;
    const readings: ObservedReading[] = [];
    const push = (histories: Record<string, GaugeHistory>) => {
        for (const r of historiesToReadings(prefix, histories)) readings.push(r);
    };
    if (group.linked.length > 0) push(await provider.getHistory(group.linked, now - LINKED_HISTORY_MS, now, false, env));
    const linkedReadings = readings.length;
    if (group.registry.length > 0) {
        const latest = await provider.getLatest(group.registry, env);
        push(Object.fromEntries(Object.entries(latest).map(([id, reading]) =>
            [id, { id, name: "", readings: [reading] } as GaugeHistory])));
    }
    noteLatest(stats.latest, readings, now);
    let rows = reduceToSlots(readings, { now });
    if (HOURLY_STORE_PROVIDERS.has(prefix)) {
        for (let i = 0; i < linkedReadings; i++) stats.fetched.push(readings[i]);
        rows = isHourlyCycle(now) ? oneRowPerHour(rows) : [];
    }
    const written = await upsertSlots(db, rows, keys);
    stats.providerRows[prefix] = written;
    stats.rowsWritten.providers += written;
}

/**
 * Runs one ingest cycle. Each provider is isolated: a failure logs and adds
 * nothing, and the stored history is untouched.
 */
export async function runIngestCycle(
    env: Env,
    db: D1Database,
    registryMetadata: Record<string, any>,
    providers: Record<string, GaugeProvider>,
    now: number = Date.now(),
    opts: { linkedIds?: string[]; backfillRequests?: number } = {}
): Promise<SyncStats> {
    const linkedIds = opts.linkedIds ?? await readLinkedGaugeIds(env);
    const dimensions = buildDimensions(registryMetadata, linkedIds, await loadReaches(env));
    const { keys, written } = await resolveGaugeKeys(db, dimensions);
    const linkedSet = new Set(linkedIds.map(normalizeGaugeId));

    const stats: SyncStats = {
        gauges: dimensions.length, linked: linkedSet.size,
        rowsWritten: { dimensions: written, providers: 0, state: 0 },
        providerRows: {}, usgs: null, errors: 0, forecasts: {}, latest: new Map(), fetched: [],
    };

    const groups: Record<string, { linked: string[]; registry: string[] }> = {};
    for (const d of dimensions) {
        const [prefix, bareId] = d.gaugeId.split(":");
        if (!providers[prefix]) continue;
        if (!groups[prefix]) groups[prefix] = { linked: [], registry: [] };
        groups[prefix][linkedSet.has(d.gaugeId) ? "linked" : "registry"].push(bareId);
    }

    const ctx = { env, db, keys, now, stats };
    await Promise.all(Object.entries(groups).map(async ([prefix, group]) => {
        try {
            await withTimeout((async () => {
                if (prefix === "USGS") {
                    stats.usgs = await runUsgsCycle({
                        db, env, keys, now,
                        siteIds: [...group.linked, ...group.registry],
                        runRevision: isHourlyCycle(now),
                        backfillRequests: opts.backfillRequests,
                        latest: stats.latest,
                    });
                } else if (providers[prefix].getBulkHistories) {
                    await ingestBulkProvider(ctx, prefix, providers[prefix], [...group.linked, ...group.registry]);
                } else {
                    await ingestLatestOnly(ctx, prefix, providers[prefix], group);
                }
            })(), PROVIDER_TIMEOUT_MS, `Provider ${prefix} ingest timed out`);
        } catch (e: any) {
            stats.errors++;
            await logToD1(env, "ERROR", "sync", `Provider ${prefix} ingest failed: ${e?.message || e}`);
        }
    }));

    return stats;
}

/** Total D1 rows written by a cycle, by source. */
export function rowsWrittenByCycle(stats: SyncStats): Record<string, number> {
    const u = stats.usgs?.rowsWritten;
    return {
        dimensions: stats.rowsWritten.dimensions,
        providers: stats.rowsWritten.providers,
        state: stats.rowsWritten.state + (u?.state ?? 0),
        usgsWindow: u?.window ?? 0,
        usgsRevision: u?.revision ?? 0,
        usgsBackfill: u?.backfill ?? 0,
    };
}

function toServedReading(r: ObservedReading): GaugeReading {
    const out: GaugeReading = { dateTime: servedTime(r.ts) };
    for (const c of ["cfs", "ft", "cms", "m", "temp_f", "precip_in"] as const) {
        if (typeof r[c] === "number") out[c] = r[c];
    }
    return out;
}

/** Fetched readings slotted like the store, per gauge, over the projection window. */
function servedWindows(readings: ObservedReading[], now: number): Map<string, GaugeReading[]> {
    const out = new Map<string, GaugeReading[]>();
    const windowStart = slotStartOf(now - PROJECTION_WINDOW_MS);
    for (const row of reduceToSlots(readings, { now, windowStart }).sort((a, b) => a.ts - b.ts)) {
        const list = out.get(row.gaugeId);
        if (list) list.push(rowToReading(row));
        else out.set(row.gaugeId, [rowToReading(row)]);
    }
    return out;
}

/**
 * Projects sitedata.json: every registry and river-linked gauge (including
 * dead prefixes, which keep their previous readings), each with its newest
 * reading, linked gauges with 3h of history plus live forecast rows. The
 * newest reading prefers what this cycle fetched, since the store keeps the
 * reading closest to each slot start. Linked gauges with `fetchedSeries`
 * readings take their window from those instead of the store (UK is stored
 * hourly). A gauge with nothing recent keeps its entry from the previous
 * sitedata.json. Gauges known only to the store are left out.
 */
export async function projectSitedata(
    db: D1Database,
    registryMetadata: Record<string, any>,
    linkedIds: string[],
    forecasts: Record<string, GaugeReading[]>,
    previous: Record<string, any> | null,
    now: number = Date.now(),
    fetchedLatest: Map<string, ObservedReading> = new Map(),
    fetchedSeries: ObservedReading[] = []
): Promise<Record<string, any>> {
    const merged: Record<string, any> = {};

    for (const [rawId, meta] of Object.entries(registryMetadata)) {
        const gaugeId = normalizeGaugeId(rawId);
        merged[gaugeId] = {
            id: gaugeId.includes(":") ? gaugeId.split(":")[1] : gaugeId,
            name: meta?.name,
            lat: sanitizeCoordinate(meta?.lat),
            lon: sanitizeCoordinate(meta?.lon),
            state: meta?.state,
            country: meta?.country,
            section: meta?.section,
            readings: [],
        };
    }
    const linked = [...new Set(linkedIds.map(normalizeGaugeId))];
    for (const gaugeId of linked) {
        merged[gaugeId] ??= { id: gaugeId.includes(":") ? gaugeId.split(":")[1] : gaugeId, name: "", readings: [] };
    }

    const newest = await readLatest(db, LATEST_WINDOW_MS, now);
    for (const [gaugeId, r] of fetchedLatest) {
        const served = toServedReading(r);
        if (!newest[gaugeId] || served.dateTime >= newest[gaugeId].dateTime) newest[gaugeId] = served;
    }
    for (const [gaugeId, reading] of Object.entries(newest)) {
        if (merged[gaugeId]) merged[gaugeId].readings = [reading];
    }

    const storable = linked.filter(isStorableGaugeId);
    if (storable.length > 0) {
        const series = await readSeries(db, storable, now - PROJECTION_WINDOW_MS, now, now);
        const fetched = servedWindows(fetchedSeries, now);
        for (const gaugeId of storable) {
            const e = merged[gaugeId];
            const history = series[gaugeId];
            if (history) {
                e.name = e.name || history.name;
                e.section ??= history.section;
                e.state ??= history.state;
                e.lat ??= history.lat;
                e.lon ??= history.lon;
                if (history.nwmReachId) e.nwmReachId = history.nwmReachId;
            }
            const readings = fetched.get(gaugeId) ?? history?.readings ?? [];
            if (readings.length === 0) continue;
            const latest = newest[gaugeId];
            if (latest && latest.dateTime > readings[readings.length - 1].dateTime) readings.push(latest);
            e.readings = readings;
        }
    }

    if (previous) {
        for (const [gaugeId, e] of Object.entries(merged)) {
            const old = previous[gaugeId]?.readings;
            if (e.readings.length === 0 && Array.isArray(old)) {
                e.readings = old.filter((r: any) => r && !r.isForecast);
            }
        }
    }

    for (const gaugeId of linked) {
        const future = forecasts[gaugeId];
        if (!future || future.length === 0) continue;
        const e = merged[gaugeId];
        e.readings = [...e.readings, ...future].sort((a: any, b: any) => a.dateTime - b.dateTime);
    }

    return merged;
}
