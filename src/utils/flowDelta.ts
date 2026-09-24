import type { GaugeReading } from "../types/River";

/**
 * Delta-request logic for the flow history API.
 *
 * A river-detail view that already holds a recent window only asks the server
 * for what landed since, with an overlap for late or revised readings.
 *
 * Kept separate from the hook so the fiddly parts (forecast exclusion,
 * staleness bounds) are testable without React.
 */

/** Days of history the detail charts request. */
export const HISTORY_DAYS = 28;

/**
 * Only request a delta if the cached window is at least this fresh. Beyond it,
 * a full re-fetch is simpler and no more expensive than stitching.
 */
export const DELTA_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** True for rows that represent a forecast rather than an observation. */
export function isForecastReading(reading: Partial<GaugeReading>): boolean {
    const r = reading as any;
    return Boolean(r.isForecast) || r.cfsForecast != null || r.ftForecast != null
        || r.cmsForecast != null || r.mForecast != null;
}

/** Newest observed timestamp in one gauge's readings, or 0. Forecasts are ignored. */
export function newestObservedTs(readings: GaugeReading[] | null | undefined): number {
    if (!Array.isArray(readings)) return 0;
    let newest = 0;
    for (const reading of readings) {
        if (!reading || typeof reading.dateTime !== "number" || isForecastReading(reading)) continue;
        if (reading.dateTime > newest) newest = reading.dateTime;
    }
    return newest;
}

/**
 * Re-request this much before the resume point, so late-arriving readings and
 * revised values near the edge are picked up.
 */
export const DELTA_OVERLAP_MS = 2 * 60 * 60 * 1000;

/**
 * Where a delta resumes: the oldest of each cached gauge's newest observation
 * (so a lagging gauge is not skipped), never later than the last fetch, minus
 * the overlap. Gauges absent from the cache had nothing at lastFetchedMs.
 */
export function deltaSince(cached: { lastFetchedMs: number; gaugeData: Record<string, GaugeReading[]> }): number {
    let oldestNewest = cached.lastFetchedMs;
    let any = false;
    for (const readings of Object.values(cached.gaugeData ?? {})) {
        const newest = newestObservedTs(readings);
        if (newest === 0) continue;
        any = true;
        oldestNewest = Math.min(oldestNewest, newest);
    }
    return any ? oldestNewest - DELTA_OVERLAP_MS : 0;
}

export interface DeltaPlan {
    /** Query string for /history. */
    params: string;
    /** The `since` sent, or 0 when requesting the full window. */
    resumeFrom: number;
}

/**
 * Builds the /history request, using ?since= when a fresh cached window exists.
 */
export function planHistoryRequest(
    gaugeIds: string[],
    cached: { lastFetchedMs: number; gaugeData: Record<string, GaugeReading[]> } | undefined,
    now: number = Date.now()
): DeltaPlan {
    const fresh = cached && (now - cached.lastFetchedMs) < DELTA_MAX_AGE_MS;
    const resumeFrom = fresh ? deltaSince(cached!) : 0;

    const params = new URLSearchParams({
        gauges: gaugeIds.join(","),
        days: String(HISTORY_DAYS),
        forecast: "true",
    });
    // Forecasts always come back in full; `since` only trims observations.
    if (resumeFrom > 0) params.set("since", String(resumeFrom));

    return { params: params.toString(), resumeFrom };
}

/**
 * Seeds a merge map with cached readings ahead of applying a delta response.
 *
 * Cached *forecast* rows are dropped: the response always carries a fresh full
 * forecast, and keeping the stale ones would leave a tail beyond the new
 * horizon that nothing overwrites.
 */
export function seedFromCache(
    target: Record<string, Map<number, any>>,
    gaugeData: Record<string, GaugeReading[]>
): void {
    for (const [gaugeId, readings] of Object.entries(gaugeData ?? {})) {
        if (!Array.isArray(readings)) continue;
        if (!target[gaugeId]) target[gaugeId] = new Map();
        for (const reading of readings) {
            if (!reading || typeof reading.dateTime !== "number") continue;
            if (isForecastReading(reading)) continue;
            target[gaugeId].set(reading.dateTime, { ...reading });
        }
    }
}

/** Drops observations older than the history window; forecasts are kept. */
export function trimToWindow(readings: GaugeReading[], now: number = Date.now()): GaugeReading[] {
    const cutoff = now - HISTORY_DAYS * 24 * 60 * 60 * 1000;
    return readings.filter(r => isForecastReading(r) || r.dateTime >= cutoff);
}

/**
 * NWM reach ids for every gauge we know one for: from this response, else
 * from the cache (a delta response omits gauges with nothing new).
 */
export function collectReachIds(
    cached: Record<string, string> | undefined,
    data: Record<string, { nwmReachId?: string }>
): Record<string, string> {
    const out: Record<string, string> = { ...(cached ?? {}) };
    for (const [gaugeId, info] of Object.entries(data ?? {})) {
        if (info?.nwmReachId) out[gaugeId] = info.nwmReachId;
    }
    return out;
}
