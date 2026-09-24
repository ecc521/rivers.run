import type { Env } from "../index";
import type { GaugeProvider, GaugeHistory } from "./provider";
import { logToD1 } from "../utils/logger";
import { normalizeGaugeId } from "../utils/formatting";
import { withTimeout } from "../utils/timeout";
import {
    resolveGaugeKeys,
    upsertReadings,
    readSyncState,
    writeSyncState,
    readSeries,
    readLatestAll,
    pruneSlice,
    currentPruneSlice,
    refreshObsCounts,
    findGapGauges,
    isStorableGaugeId,
    type GaugeDimension,
    type StoredReading,
} from "./flowStore";
import { ingestUsgsIncremental } from "./usgsIncremental";
import { pollUsgsRevisions, type RevisionPollResult } from "./usgsRevisions";

/**
 * The 15-minute ingest cycle, and the projection of sitedata.json from what it
 * stored.
 *
 * Two tiers, differing only in how they are kept fresh:
 *
 *  - **Tier A (linked, ~230 gauges)** — gauges attached to a curated river.
 *    USGS uses the `last_modified` cursor (gap-free and revision-aware, but it
 *    does not scale past ~10 sites per request); other providers use a short
 *    trailing history window.
 *  - **Tier B (registry, ~15.6k gauges)** — the existing bulk getLatest calls,
 *    ~60 requests total, already made every cycle today. The only change is
 *    that we now KEEP what comes back instead of discarding all but the newest
 *    reading. Extra fetch cost: zero.
 *
 * Tier B is gap-prone for latest-only providers (a missed cycle loses that
 * sample), which is what the obs_count_24h gap detection exists to repair.
 */

/** Trailing window for non-USGS tier-A gauges. */
const LINKED_WINDOW_MS = 3 * 60 * 60 * 1000;

/** How much history sitedata.json carries per linked gauge (matches prior behavior). */
const PROJECTION_WINDOW_MS = 3 * 60 * 60 * 1000;

const PROVIDER_TIMEOUT_MS = 900_000;

export interface SyncStats {
    linked: number;
    registry: number;
    readingsStored: number;
    cursorsAdvanced: number;
    capped: string[];
    deferred: number;
    pruned: number;
    errors: number;
}

/** Reads every gauge id referenced by a curated river. These are tier A. */
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

/** Flattens a provider's GaugeHistory map into store rows. */
export function historiesToReadings(
    prefix: string,
    histories: Record<string, GaugeHistory>
): StoredReading[] {
    const out: StoredReading[] = [];
    for (const [bareId, history] of Object.entries(histories)) {
        const gaugeId = `${prefix}:${bareId}`;
        if (!isStorableGaugeId(gaugeId)) continue;
        for (const r of history?.readings ?? []) {
            // Forecasts are not observations; they stay on the live path.
            if (r.isForecast) continue;
            if (typeof r.dateTime !== "number") continue;
            out.push({
                gaugeId,
                ts: r.dateTime,
                cfs: r.cfs, ft: r.ft, cms: r.cms, m: r.m,
                temp_f: r.temp_f, precip_in: r.precip_in,
                approved: r.approved === true,
                srcModified: r.srcModified,
            });
        }
    }
    return out;
}

/** Builds dimension rows from the registry plus the linked-gauge list. */
export function buildDimensions(
    registryMetadata: Record<string, any>,
    linkedIds: string[]
): GaugeDimension[] {
    const linked = new Set(linkedIds.map(normalizeGaugeId));
    const dims = new Map<string, GaugeDimension>();

    for (const [rawId, meta] of Object.entries(registryMetadata)) {
        const gaugeId = normalizeGaugeId(rawId);
        if (!isStorableGaugeId(gaugeId)) continue;
        dims.set(gaugeId, {
            gaugeId,
            provider: gaugeId.split(":")[0],
            tier: linked.has(gaugeId) ? "linked" : "registry",
            name: meta?.name || undefined,
            section: meta?.section || undefined,
            state: meta?.state || undefined,
            country: meta?.country || undefined,
            lat: sanitizeCoordinate(meta?.lat),
            lon: sanitizeCoordinate(meta?.lon),
        });
    }

    // A gauge can be linked to a river before it appears in the registry.
    for (const gaugeId of linked) {
        if (!isStorableGaugeId(gaugeId) || dims.has(gaugeId)) continue;
        dims.set(gaugeId, { gaugeId, provider: gaugeId.split(":")[0], tier: "linked" });
    }

    return [...dims.values()];
}

/**
 * Runs one ingest cycle against the store.
 *
 * Every provider is isolated: a failure logs and degrades that provider's
 * contribution to nothing rather than aborting the cycle. Because the store is
 * durable, a failed provider no longer loses readings — it just does not add
 * new ones, and the next successful cycle fills in.
 */
export async function runIngestCycle(
    env: Env,
    db: D1Database,
    registryMetadata: Record<string, any>,
    providers: Record<string, GaugeProvider>,
    now: number = Date.now()
): Promise<SyncStats> {
    const stats: SyncStats = {
        linked: 0, registry: 0, readingsStored: 0, cursorsAdvanced: 0,
        capped: [], deferred: 0, pruned: 0, errors: 0,
    };

    const linkedIds = await readLinkedGaugeIds(env);
    const dimensions = buildDimensions(registryMetadata, linkedIds);
    const keys = await resolveGaugeKeys(db, dimensions);

    const linkedSet = new Set(dimensions.filter(d => d.tier === "linked").map(d => d.gaugeId));
    stats.linked = linkedSet.size;
    stats.registry = dimensions.length - linkedSet.size;

    // Group by provider, split by tier.
    const groups: Record<string, { linked: string[]; registry: string[] }> = {};
    for (const d of dimensions) {
        const [prefix, bareId] = d.gaugeId.split(":");
        if (!providers[prefix]) continue;
        if (!groups[prefix]) groups[prefix] = { linked: [], registry: [] };
        groups[prefix][d.tier === "linked" ? "linked" : "registry"].push(bareId);
    }

    const allReadings: StoredReading[] = [];
    const stateUpdates: Parameters<typeof writeSyncState>[1] = [];

    await Promise.all(Object.entries(groups).map(async ([prefix, group]) => {
        const provider = providers[prefix];
        try {
            await withTimeout((async () => {
                // --- Tier A ---
                if (group.linked.length > 0) {
                    if (prefix === "USGS") {
                        const syncState = await readSyncState(
                            db, group.linked.map(id => `USGS:${id}`));
                        const withCursors = group.linked.map(id => ({
                            id,
                            cursor: syncState.get(`USGS:${id}`)?.cursorModified ?? null,
                        }));

                        const result = await ingestUsgsIncremental(withCursors, env, now);
                        allReadings.push(...result.readings);
                        stats.capped.push(...result.capped);
                        stats.deferred += result.deferred;
                        stats.errors += result.errors.size;

                        for (const [gaugeId, cursor] of result.cursors) {
                            stateUpdates.push({
                                gaugeId, cursorModified: cursor,
                                lastSuccessAt: now, failCount: 0, lastError: null,
                            });
                            stats.cursorsAdvanced++;
                        }
                        for (const [gaugeId, message] of result.errors) {
                            stateUpdates.push({ gaugeId, failCount: 1, lastError: message.slice(0, 300) });
                        }
                    } else {
                        const histories = await provider.getHistory(
                            group.linked, now - LINKED_WINDOW_MS, now, false, env);
                        allReadings.push(...historiesToReadings(prefix, histories));
                        for (const bareId of Object.keys(histories)) {
                            stateUpdates.push({
                                gaugeId: `${prefix}:${bareId}`,
                                lastSuccessAt: now, failCount: 0, lastError: null,
                            });
                        }
                    }
                }

                // --- Tier B: the requests we already make, now retained ---
                if (group.registry.length > 0) {
                    if (provider.getLatestHistories) {
                        const histories = await provider.getLatestHistories(group.registry, env);
                        allReadings.push(...historiesToReadings(prefix, histories));
                    } else {
                        const latest = await provider.getLatest(group.registry, env);
                        allReadings.push(...historiesToReadings(
                            prefix,
                            Object.fromEntries(Object.entries(latest).map(([id, reading]) =>
                                [id, { id, name: "", readings: [reading] } as GaugeHistory])),
                        ));
                    }
                }
            })(), PROVIDER_TIMEOUT_MS, `Provider ${prefix} ingest timed out`);
        } catch (e: any) {
            stats.errors++;
            await logToD1(env, "ERROR", "sync",
                `Provider ${prefix} ingest failed: ${e?.message || e}`);
        }
    }));

    // Advance last_obs_ts alongside the readings themselves.
    const newestPerGauge = new Map<string, number>();
    for (const r of allReadings) {
        const prev = newestPerGauge.get(r.gaugeId) ?? 0;
        if (r.ts > prev) newestPerGauge.set(r.gaugeId, r.ts);
    }
    for (const [gaugeId, ts] of newestPerGauge) {
        stateUpdates.push({ gaugeId, lastObsTs: ts });
    }

    stats.readingsStored = await upsertReadings(db, allReadings, keys, now);
    await writeSyncState(db, stateUpdates, keys);

    // Prune one rotating slice; every gauge is covered once per day.
    try {
        stats.pruned = await pruneSlice(db, currentPruneSlice(now), now);
    } catch (e) {
        console.warn("Prune slice failed", e);
    }

    return stats;
}

/**
 * Projects sitedata.json out of the store.
 *
 * Deliberately preserves the existing payload shape and size: registry gauges
 * carry their latest reading, linked gauges a short recent window. The full 30
 * days lives behind /history, not in the bulk offline bootstrap — putting it
 * here would balloon a 3.4MB artifact by orders of magnitude.
 */
export async function projectSitedata(
    db: D1Database,
    registryMetadata: Record<string, any>,
    linkedIds: string[],
    now: number = Date.now()
): Promise<Record<string, any>> {
    const merged: Record<string, any> = {};

    for (const [rawId, meta] of Object.entries(registryMetadata)) {
        const gaugeId = normalizeGaugeId(rawId);
        if (!isStorableGaugeId(gaugeId)) continue;
        const bare = gaugeId.split(":")[1];
        merged[gaugeId] = {
            id: bare,
            name: meta?.name,
            lat: sanitizeCoordinate(meta?.lat),
            lon: sanitizeCoordinate(meta?.lon),
            state: meta?.state,
            country: meta?.country,
            section: meta?.section,
            readings: [],
        };
    }

    const latest = await readLatestAll(db);
    for (const [gaugeId, reading] of Object.entries(latest)) {
        const bare: Record<string, unknown> = { ...reading };
        delete bare.gaugeId;
        if (!merged[gaugeId]) {
            merged[gaugeId] = { id: gaugeId.split(":")[1], name: "", readings: [] };
        }
        merged[gaugeId].readings = [bare];
    }

    // Linked gauges keep a short window so river cards render offline.
    const linked = linkedIds.map(normalizeGaugeId).filter(isStorableGaugeId);
    if (linked.length > 0) {
        const series = await readSeries(db, linked, now - PROJECTION_WINDOW_MS);
        for (const [gaugeId, history] of Object.entries(series)) {
            if (history.readings.length === 0) continue;
            const existing = merged[gaugeId] ?? { id: gaugeId.split(":")[1], name: "", readings: [] };
            merged[gaugeId] = {
                ...existing,
                name: existing.name || history.name,
                section: existing.section ?? history.section,
                state: existing.state ?? history.state,
                lat: existing.lat ?? history.lat,
                lon: existing.lon ?? history.lon,
                readings: history.readings,
            };
        }
    }

    return merged;
}

/**
 * Threshold below which a gauge's last 24h looks like it missed cycles.
 * A healthy 15-minute gauge lands ~90 observations/day (measured); anything
 * under a quarter of that is either genuinely low-cadence or has real gaps.
 */
const GAP_THRESHOLD_OBS = 24;

/** Bound on repair work per day so a bad day cannot monopolize a cycle. */
const MAX_REPAIRS_PER_DAY = 200;

/**
 * Daily maintenance.
 *
 * Tier B is ingested latest-only for most providers, so a missed cycle loses
 * that sample permanently unless something goes back for it. Because
 * getLatest returns each observation's own timestamp, we know exactly what we
 * hold — so rather than blanket-backfilling, we count and repair only the
 * gauges that actually look short.
 */
export async function runDailyMaintenance(
    env: Env,
    db: D1Database,
    providers: Record<string, GaugeProvider>,
    now: number = Date.now()
): Promise<{ repaired: number; revisions: RevisionPollResult | null }> {
    await refreshObsCounts(db, now);

    let repaired = 0;
    try {
        const gappy = await findGapGauges(db, GAP_THRESHOLD_OBS, MAX_REPAIRS_PER_DAY);
        const byProvider: Record<string, string[]> = {};
        for (const g of gappy) {
            const [prefix, bareId] = g.gaugeId.split(":");
            if (!providers[prefix]) continue;
            if (!byProvider[prefix]) byProvider[prefix] = [];
            byProvider[prefix].push(bareId);
        }

        const readings: StoredReading[] = [];
        await Promise.all(Object.entries(byProvider).map(async ([prefix, ids]) => {
            try {
                const histories = await withTimeout(
                    providers[prefix].getHistory(ids, now - 24 * 60 * 60 * 1000, now, false, env),
                    120_000, `Gap repair for ${prefix} timed out`);
                readings.push(...historiesToReadings(prefix, histories));
            } catch (e: any) {
                await logToD1(env, "WARN", "sync", `Gap repair failed for ${prefix}: ${e?.message || e}`);
            }
        }));

        if (readings.length > 0) {
            const keys = await resolveGaugeKeys(db, [...new Set(readings.map(r => r.gaugeId))].map(gaugeId => ({
                gaugeId, provider: gaugeId.split(":")[0], tier: "registry" as const,
            })));
            repaired = await upsertReadings(db, readings, keys, now);
        }
    } catch (e) {
        console.warn("Gap repair pass failed", e);
    }

    let revisions: RevisionPollResult | null = null;
    try {
        revisions = await pollUsgsRevisions(db, env, now);
    } catch (e) {
        console.warn("USGS revision poll failed", e);
    }

    return { repaired, revisions };
}
