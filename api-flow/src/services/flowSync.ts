import type { Env } from "../index";
import type { GaugeProvider, GaugeHistory, GaugeReading } from "./provider";
import { logToD1 } from "../utils/logger";
import { normalizeGaugeId } from "../utils/formatting";
import { withTimeout } from "../utils/timeout";
import {
    resolveGaugeKeys, upsertSlots, reduceToSlots, readSeries, readLatest,
    initCoverage, resetProviderCoverage, getMeta, setMeta, slotStartOf, isStorableGaugeId,
    type GaugeDimension, type ObservedReading,
} from "./flowStore";
import { runUsgsCycle, isHourlyCycle, type UsgsCycleStats } from "./usgsIngest";

/**
 * The 15-minute ingest cycle, and the projection of sitedata.json from the
 * store. USGS has its own sweeps (usgsIngest.ts). The other providers:
 *
 *  - EC: province CSVs over a trailing window (3h, widened after misses).
 *  - NWS: stageflow over the same window; forecast rows are kept in memory
 *    for sitedata.json and never stored.
 *  - UK, IE: latest-only bulk calls; linked gauges also get a 3h history.
 */

const DEFAULT_WINDOW_MS = 3 * 60 * 60 * 1000;
/** EC files hold about a day; past this a gap cannot be recovered. */
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
const OVERLAP_MS = 15 * 60 * 1000;
/** sitedata.json carries this much history for river-linked gauges. */
const PROJECTION_WINDOW_MS = 3 * 60 * 60 * 1000;
/** Latest reading lookback for sitedata.json; older gauges keep their previous entry. */
const LATEST_WINDOW_MS = 12 * 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 600_000;

/** Providers whose stored series is complete from first sight, so /history may serve it. */
export const WINDOWED_PROVIDERS = new Set(["EC", "NWS"]);

/**
 * True when the store holds a complete series for `gaugeId` from `start` to
 * now: USGS once backfilled past `start` with no pending repair, EC and NWS
 * from first sight. Latest-only providers (UK, IE) never qualify.
 */
export function storeCovers(
    gaugeId: string,
    state: { coverageStart: number | null; repairFrom: number | null } | undefined,
    start: number
): boolean {
    const prefix = gaugeId.split(":")[0];
    if (prefix !== "USGS" && !WINDOWED_PROVIDERS.has(prefix)) return false;
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

/** Trailing window for a windowed provider, widened after missed cycles. */
export function providerWindow(okAt: number | null, now: number): { from: number; gap: boolean } {
    const normal = slotStartOf(now - DEFAULT_WINDOW_MS);
    if (okAt === null) return { from: normal, gap: false };
    const resume = slotStartOf(okAt - OVERLAP_MS);
    if (resume >= normal) return { from: normal, gap: false };
    const floor = slotStartOf(now - MAX_WINDOW_MS);
    return resume >= floor ? { from: resume, gap: false } : { from: floor, gap: true };
}

async function ingestProvider(
    ctx: { env: Env; db: D1Database; keys: Map<string, number>; now: number; stats: SyncStats },
    prefix: string,
    provider: GaugeProvider,
    group: { linked: string[]; registry: string[] }
): Promise<void> {
    const { env, db, keys, now, stats } = ctx;
    const all = [...group.linked, ...group.registry];
    const windowed = WINDOWED_PROVIDERS.has(prefix);
    const metaKey = `ok_at:${prefix}`;
    const win = providerWindow(windowed ? await getMeta(db, metaKey) : null, now);

    const readings: ObservedReading[] = [];
    const push = (histories: Record<string, GaugeHistory>, withForecasts = false) => {
        for (const r of historiesToReadings(prefix, histories, withForecasts ? stats.forecasts : undefined)) readings.push(r);
    };

    if (provider.getLatestHistories) {
        push(await provider.getLatestHistories(all, env, win.from));
    } else if (prefix === "NWS") {
        push(await provider.getHistory(all, win.from, now, true, env), true);
    } else {
        if (group.linked.length > 0) push(await provider.getHistory(group.linked, win.from, now, false, env));
        if (group.registry.length > 0) {
            const latest = await provider.getLatest(group.registry, env);
            push(Object.fromEntries(Object.entries(latest).map(([id, reading]) =>
                [id, { id, name: "", readings: [reading] } as GaugeHistory])));
        }
    }

    const rows = reduceToSlots(readings, { now, windowStart: windowed ? win.from : undefined });
    const written = await upsertSlots(db, rows, keys);
    stats.providerRows[prefix] = written;
    stats.rowsWritten.providers += written;

    if (windowed && rows.length > 0) {
        if (win.gap) stats.rowsWritten.state += await resetProviderCoverage(db, prefix, win.from);
        const seen = [...new Set(rows.map(r => keys.get(r.gaugeId)).filter((k): k is number => k !== undefined))];
        stats.rowsWritten.state += await initCoverage(db, seen, win.from);
        stats.rowsWritten.state += await setMeta(db, metaKey, now);
    }
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
        providerRows: {}, usgs: null, errors: 0, forecasts: {},
    };

    const groups: Record<string, { linked: string[]; registry: string[] }> = {};
    for (const d of dimensions) {
        const [prefix, bareId] = d.gaugeId.split(":");
        if (!providers[prefix]) continue;
        groups[prefix] ??= { linked: [], registry: [] };
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
                    });
                } else {
                    await ingestProvider(ctx, prefix, providers[prefix], group);
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

/**
 * Projects sitedata.json from the store: every registry gauge with its latest
 * reading, linked gauges with 3h of history plus live forecast rows. A gauge
 * with nothing recent keeps its entry from the previous sitedata.json.
 */
export async function projectSitedata(
    db: D1Database,
    registryMetadata: Record<string, any>,
    linkedIds: string[],
    forecasts: Record<string, GaugeReading[]>,
    previous: Record<string, any> | null,
    now: number = Date.now()
): Promise<Record<string, any>> {
    const merged: Record<string, any> = {};

    for (const [rawId, meta] of Object.entries(registryMetadata)) {
        const gaugeId = normalizeGaugeId(rawId);
        if (!isStorableGaugeId(gaugeId)) continue;
        merged[gaugeId] = {
            id: gaugeId.split(":")[1],
            name: meta?.name,
            lat: sanitizeCoordinate(meta?.lat),
            lon: sanitizeCoordinate(meta?.lon),
            state: meta?.state,
            country: meta?.country,
            section: meta?.section,
            readings: [],
        };
    }
    const entry = (gaugeId: string) =>
        merged[gaugeId] ??= { id: gaugeId.split(":")[1], name: "", readings: [] };

    for (const [gaugeId, reading] of Object.entries(await readLatest(db, LATEST_WINDOW_MS, now))) {
        entry(gaugeId).readings = [reading];
    }

    const linked = [...new Set(linkedIds.map(normalizeGaugeId).filter(isStorableGaugeId))];
    if (linked.length > 0) {
        const series = await readSeries(db, linked, now - PROJECTION_WINDOW_MS, now, now);
        for (const gaugeId of linked) {
            const e = entry(gaugeId);
            const history = series[gaugeId];
            if (history && history.readings.length > 0) {
                e.name = e.name || history.name;
                e.section ??= history.section;
                e.state ??= history.state;
                e.lat ??= history.lat;
                e.lon ??= history.lon;
                if (history.nwmReachId) e.nwmReachId = history.nwmReachId;
                e.readings = history.readings;
            }
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
        const e = entry(gaugeId);
        e.readings = [...e.readings, ...future].sort((a: any, b: any) => a.dateTime - b.dateTime);
    }

    return merged;
}
