import type { GaugeReading } from "../types/River";

/**
 * Delta-request logic for the flow history API.
 *
 * The server now stores 28 days per gauge, so a river-detail view that already
 * holds a recent window only needs what landed since — previously every view
 * re-pulled the full 28 days.
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

/**
 * Newest *observed* timestamp across cached gauges — where a delta resumes.
 *
 * Forecast rows are excluded deliberately: they sit in the future, so counting
 * them would ask the server for readings after the forecast horizon and skip
 * every real observation in between.
 */
export function newestObservedTs(gaugeData: Record<string, GaugeReading[]>): number {
    let newest = 0;
    for (const readings of Object.values(gaugeData ?? {})) {
        if (!Array.isArray(readings)) continue;
        for (let i = readings.length - 1; i >= 0; i--) {
            const reading = readings[i];
            if (!reading || typeof reading.dateTime !== "number") continue;
            if (isForecastReading(reading)) continue;
            if (reading.dateTime > newest) newest = reading.dateTime;
            break;
        }
    }
    return newest;
}

export interface DeltaPlan {
    /** Query string for /history. */
    params: string;
    /** 0 when requesting the full window. */
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
    const resumeFrom = fresh ? newestObservedTs(cached!.gaugeData) : 0;

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
