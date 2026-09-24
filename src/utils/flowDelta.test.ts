import { describe, it, expect } from "vitest";
import {
    newestObservedTs,
    deltaSince,
    planHistoryRequest,
    DELTA_OVERLAP_MS,
    seedFromCache,
    isForecastReading,
    HISTORY_DAYS,
    DELTA_MAX_AGE_MS,
} from "./flowDelta";
import type { GaugeReading } from "../types/River";

const NOW = 1_779_999_900_000;
const SNAP = 300_000;
const HOUR = 3_600_000;

const r = (dateTime: number, extra: Record<string, unknown> = {}) =>
    ({ dateTime, ...extra }) as unknown as GaugeReading;

describe("isForecastReading", () => {
    it("recognizes every forecast shape the API emits", () => {
        expect(isForecastReading(r(NOW, { isForecast: true }))).toBe(true);
        expect(isForecastReading(r(NOW, { cfsForecast: 100 }))).toBe(true);
        expect(isForecastReading(r(NOW, { ftForecast: 2 }))).toBe(true);
        expect(isForecastReading(r(NOW, { cmsForecast: 3 }))).toBe(true);
        expect(isForecastReading(r(NOW, { mForecast: 1 }))).toBe(true);
        expect(isForecastReading(r(NOW, { cfs: 100 }))).toBe(false);
    });
});

describe("newestObservedTs", () => {
    it("returns one gauge's newest observation, ignoring forecasts", () => {
        expect(newestObservedTs([
            r(NOW - SNAP, { cfs: 1 }),
            r(NOW, { cfs: 2 }),
            r(NOW + 6 * HOUR, { cfsForecast: 500, isForecast: true }),
        ])).toBe(NOW);
    });

    it("returns 0 for empty, missing, malformed or forecast-only data", () => {
        expect(newestObservedTs([])).toBe(0);
        expect(newestObservedTs(undefined)).toBe(0);
        expect(newestObservedTs(null)).toBe(0);
        expect(newestObservedTs([r(NOW + HOUR, { cfsForecast: 1, isForecast: true })])).toBe(0);
    });
});

describe("deltaSince", () => {
    it("resumes from the most lagging gauge, minus the overlap", () => {
        expect(deltaSince({
            lastFetchedMs: NOW,
            gaugeData: {
                "USGS:1": [r(NOW, { cfs: 1 })],
                "EC:2": [r(NOW - 3 * HOUR, { cms: 1 })],
            },
        })).toBe(NOW - 3 * HOUR - DELTA_OVERLAP_MS);
    });

    it("never resumes after the last fetch", () => {
        expect(deltaSince({ lastFetchedMs: NOW - HOUR, gaugeData: { "USGS:1": [r(NOW, { cfs: 1 })] } }))
            .toBe(NOW - HOUR - DELTA_OVERLAP_MS);
    });

    it("returns 0 when no gauge holds observations", () => {
        expect(deltaSince({ lastFetchedMs: NOW, gaugeData: { "USGS:1": [] } })).toBe(0);
    });
});

describe("planHistoryRequest", () => {
    const gauges = ["USGS:03451500", "EC:05BB001"];

    it("requests the full window with no cache", () => {
        const plan = planHistoryRequest(gauges, undefined, NOW);
        expect(plan.resumeFrom).toBe(0);
        expect(plan.params).not.toContain("since=");
        expect(plan.params).toContain(`days=${HISTORY_DAYS}`);
        expect(plan.params).toContain("forecast=true");
    });

    it("requests only the delta when the cache is fresh", () => {
        const plan = planHistoryRequest(gauges, {
            lastFetchedMs: NOW - 20 * 60 * 1000,
            gaugeData: { "USGS:03451500": [r(NOW - HOUR, { cfs: 1 })] },
        }, NOW);

        expect(plan.resumeFrom).toBe(NOW - HOUR - DELTA_OVERLAP_MS);
        expect(plan.params).toContain(`since=${NOW - HOUR - DELTA_OVERLAP_MS}`);
    });

    it("re-fetches the full window when the cache is stale", () => {
        const plan = planHistoryRequest(gauges, {
            lastFetchedMs: NOW - DELTA_MAX_AGE_MS - 1,
            gaugeData: { "USGS:03451500": [r(NOW - SNAP, { cfs: 1 })] },
        }, NOW);

        expect(plan.resumeFrom).toBe(0);
        expect(plan.params).not.toContain("since=");
    });

    it("re-fetches the full window when the cache holds no observations", () => {
        const plan = planHistoryRequest(gauges, {
            lastFetchedMs: NOW - 60_000,
            gaugeData: { "USGS:03451500": [] },
        }, NOW);

        expect(plan.resumeFrom).toBe(0);
    });

    it("encodes the gauge list", () => {
        const plan = planHistoryRequest(gauges, undefined, NOW);
        expect(decodeURIComponent(plan.params)).toContain("gauges=USGS:03451500,EC:05BB001");
    });
});

describe("seedFromCache", () => {
    it("seeds observations so a delta response keeps its history", () => {
        const target: Record<string, Map<number, any>> = {};
        seedFromCache(target, {
            "USGS:1": [r(NOW - 2 * SNAP, { cfs: 1 }), r(NOW - SNAP, { cfs: 2 })],
        });

        expect([...target["USGS:1"].keys()]).toEqual([NOW - 2 * SNAP, NOW - SNAP]);
    });

    it("drops cached forecasts so no stale tail survives the refresh", () => {
        // The response always carries a fresh full forecast; keeping old rows
        // would leave points beyond the new horizon that nothing overwrites.
        const target: Record<string, Map<number, any>> = {};
        seedFromCache(target, {
            "USGS:1": [
                r(NOW, { cfs: 2 }),
                r(NOW + 6 * HOUR, { cfsForecast: 500, isForecast: true }),
            ],
        });

        expect([...target["USGS:1"].keys()]).toEqual([NOW]);
    });

    it("merges into an existing map without dropping entries", () => {
        const target: Record<string, Map<number, any>> = {
            "USGS:1": new Map([[NOW, { dateTime: NOW, cfs: 99 }]]),
        };
        seedFromCache(target, { "USGS:1": [r(NOW - SNAP, { cfs: 1 })] });

        expect(target["USGS:1"].size).toBe(2);
        // Live data already in the map wins over the cached copy.
        expect(target["USGS:1"].get(NOW).cfs).toBe(99);
    });

    it("tolerates malformed cached entries", () => {
        const target: Record<string, Map<number, any>> = {};
        seedFromCache(target, {
            "USGS:1": [null as any, { foo: 1 } as any, r(NOW, { cfs: 1 })],
        });
        expect([...target["USGS:1"].keys()]).toEqual([NOW]);
    });
});
