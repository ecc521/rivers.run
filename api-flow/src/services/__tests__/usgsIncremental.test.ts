import { describe, it, expect } from "vitest";
import {
    ingestUsgsIncremental,
    planBatchQuery,
    toStoredReadings,
    chunk,
    BATCH_SIZE,
    MAX_RECORDS_PER_GAUGE,
    CURSOR_OVERLAP_MS,
    CURSOR_SAFETY_LAG_MS,
    CURSOR_STALE_MS,
    batchSizeForWindow,
    MAX_SITE_DAYS,
    MAX_COLD_GAUGES_PER_CYCLE,
} from "../usgsIncremental";
import { RETENTION_MS } from "../flowStore";

const NOW = 1_779_999_900_000;
const SNAP = 300_000;
const HOUR = 3_600_000;

/** Builds an OGC feature the way api.waterdata.usgs.gov returns them. */
const feature = (
    site: string,
    time: number,
    value: number,
    over: Partial<Record<string, any>> = {}
) => ({
    geometry: { type: "Point", coordinates: [-82.6, 35.5] },
    properties: {
        monitoring_location_id: `USGS-${site}`,
        monitoring_location_name: "HOMINY CREEK AT CANDLER, NC",
        parameter_code: "00060",
        unit_of_measure: "ft^3/s",
        time: new Date(time).toISOString(),
        value: String(value),
        approval_status: "Provisional",
        last_modified: new Date(time + 60_000).toISOString(),
        ...over,
    },
});

describe("planBatchQuery", () => {
    it("uses the cursor with an overlap in steady state", () => {
        const cursor = NOW - 15 * 60 * 1000;
        expect(planBatchQuery([cursor, cursor + 1000], NOW))
            .toEqual({ mode: "cursor", since: cursor - CURSOR_OVERLAP_MS });
    });

    it("falls back to a datetime window when any gauge has never synced", () => {
        const plan = planBatchQuery([NOW - HOUR, null], NOW);
        expect(plan.mode).toBe("datetime");
        expect(plan.since).toBe(NOW - RETENTION_MS);
    });

    it("falls back to a datetime window when the cursor is stale", () => {
        // A stale cursor means we are recovering a gap, where the datetime form
        // is both ~4x faster and has a bounded result size.
        const stale = NOW - CURSOR_STALE_MS - HOUR;
        const plan = planBatchQuery([stale], NOW);
        expect(plan.mode).toBe("datetime");
        expect(plan.since).toBe(stale);
    });

    it("clamps a very old cursor to the retention horizon", () => {
        const ancient = NOW - 400 * 24 * HOUR;
        expect(planBatchQuery([ancient], NOW).since).toBe(NOW - RETENTION_MS);
    });

    it("takes the minimum cursor so no gauge in a batch is skipped", () => {
        const behind = NOW - 30 * 60 * 1000;
        const plan = planBatchQuery([NOW - 60_000, behind], NOW);
        expect(plan.since).toBe(behind - CURSOR_OVERLAP_MS);
    });
});

describe("toStoredReadings", () => {
    const history = (readings: any[]) => ({ "03451500": { id: "03451500", name: "x", readings } });

    it("flattens to prefixed gauge ids and tracks the newest last_modified", () => {
        const out = toStoredReadings(history([
            { dateTime: NOW - SNAP, cfs: 100, srcModified: 500 },
            { dateTime: NOW, cfs: 120, srcModified: 900 },
        ]), NOW - RETENTION_MS);

        expect(out.readings.map(r => r.gaugeId)).toEqual(["USGS:03451500", "USGS:03451500"]);
        expect(out.maxModified.get("USGS:03451500")).toBe(900);
        expect(out.capped).toEqual([]);
    });

    it("drops readings older than the retention horizon", () => {
        const out = toStoredReadings(history([
            { dateTime: NOW - RETENTION_MS - HOUR, cfs: 1 },
            { dateTime: NOW, cfs: 2 },
        ]), NOW - RETENTION_MS);

        expect(out.readings).toHaveLength(1);
        expect(out.readings[0].cfs).toBe(2);
    });

    it("caps a runaway rewrite and keeps the NEWEST records", () => {
        // The measured USGS-03451500 case: a last_modified sweep returned 6,999
        // records reaching back 70 days. Current data must not be starved by it.
        // (Spaced by 1ms purely to exceed the cap; real readings are snapped to
        // 5-minute buckets, which is why the cap is unreachable in practice.)
        const readings = [];
        for (let i = 0; i < MAX_RECORDS_PER_GAUGE + 500; i++) {
            readings.push({ dateTime: NOW - i, cfs: i, srcModified: 100 });
        }
        const out = toStoredReadings(history(readings), NOW - RETENTION_MS);

        expect(out.readings).toHaveLength(MAX_RECORDS_PER_GAUGE);
        expect(out.capped).toEqual(["USGS:03451500"]);
        // Newest kept
        expect(Math.max(...out.readings.map(r => r.ts))).toBe(NOW);
        // Oldest 500 dropped
        expect(Math.min(...out.readings.map(r => r.ts)))
            .toBe(NOW - (MAX_RECORDS_PER_GAUGE - 1));
    });

    it("marks approved readings", () => {
        const out = toStoredReadings(history([
            { dateTime: NOW, cfs: 1, approved: true },
            { dateTime: NOW - SNAP, cfs: 2 },
        ]), NOW - RETENTION_MS);

        expect(out.readings.find(r => r.ts === NOW)!.approved).toBe(true);
        expect(out.readings.find(r => r.ts === NOW - SNAP)!.approved).toBe(false);
    });
});

describe("ingestUsgsIncremental", () => {
    const gauges = (ids: string[], cursor: number | null) =>
        ids.map(id => ({ id, cursor }));

    it("batches at 10 sites — the measured ceiling before USGS cancels the query", async () => {
        // 25 sites measured ~48s, 50 ~50s, 100+ returned
        // 'InvalidQuery: Long running query has been cancelled'.
        const seen: string[] = [];
        const ids = Array.from({ length: 34 }, (_, i) => String(10000000 + i));

        await ingestUsgsIncremental(gauges(ids, NOW - 60_000), {}, NOW, {
            fetchFeatures: async (url) => { seen.push(url); return []; },
        });

        expect(seen).toHaveLength(Math.ceil(34 / BATCH_SIZE));
        for (const url of seen) {
            const idCount = decodeURIComponent(url).split("monitoring_location_id=")[1]
                .split("&")[0].split(",").length;
            expect(idCount).toBeLessThanOrEqual(BATCH_SIZE);
        }
    });

    it("queries by last_modified in steady state", async () => {
        let url = "";
        await ingestUsgsIncremental(gauges(["03451500"], NOW - 60_000), {}, NOW, {
            fetchFeatures: async (u) => { url = u; return []; },
        });

        expect(url).toContain("last_modified=");
        expect(url).not.toContain("datetime=");
    });

    it("advances the cursor to max(last_modified) minus a safety lag", async () => {
        const modified = NOW - 120_000;
        const result = await ingestUsgsIncremental(gauges(["03451500"], NOW - HOUR), {}, NOW, {
            fetchFeatures: async () => [
                feature("03451500", NOW - SNAP, 100, { last_modified: new Date(modified - 5000).toISOString() }),
                feature("03451500", NOW, 120, { last_modified: new Date(modified).toISOString() }),
            ],
        });

        expect(result.cursors.get("USGS:03451500")).toBe(modified - CURSOR_SAFETY_LAG_MS);
        expect(result.readings).toHaveLength(2);
    });

    it("applies a revised value for an already-stored timestamp", async () => {
        const result = await ingestUsgsIncremental(gauges(["03451500"], NOW - HOUR), {}, NOW, {
            fetchFeatures: async () => [feature("03451500", NOW - 10 * SNAP, 875)],
        });

        // The cursor sweep surfaced an old timestamp — exactly the revision case
        // a plain datetime window would have missed.
        expect(result.readings).toHaveLength(1);
        expect(result.readings[0].ts).toBe(NOW - 10 * SNAP);
        expect(result.readings[0].cfs).toBe(875);
    });

    it("clears a full 30-day cold start for a 5-minute gauge", async () => {
        // Regression: an earlier 3,000 cap silently truncated USGS-01646500
        // (5-minute reporting, ~288 readings/day) to its newest 10 days.
        // 30 days at that cadence is ~8,640 readings and must survive intact.
        const thirtyDaysAt5Min = Array.from({ length: 8_640 }, (_, i) =>
            feature("01646500", NOW - i * SNAP, i));

        const result = await ingestUsgsIncremental([{ id: "01646500", cursor: null }], {}, NOW, {
            fetchFeatures: async () => thirtyDaysAt5Min,
        });

        expect(result.capped).toEqual([]);
        expect(result.readings.length).toBe(8_640);
        expect(result.cursors.get("USGS:01646500")).toBeDefined();
    });

    it("always advances the cursor after a cold start, so a gauge cannot stall", async () => {
        // Liveness: a datetime fetch covers the fixed cold-start window, so the
        // cursor must move even in the degenerate cases — otherwise the gauge
        // re-fetches 30 days every cycle forever and never reaches steady state.
        const first = await ingestUsgsIncremental([{ id: "01646500", cursor: null }], {}, NOW, {
            fetchFeatures: async () => [],
        });
        expect(first.cursors.get("USGS:01646500")).toBe(NOW - CURSOR_SAFETY_LAG_MS);

        let mode = "";
        await ingestUsgsIncremental(
            [{ id: "01646500", cursor: first.cursors.get("USGS:01646500")! }], {}, NOW + 60_000,
            { fetchFeatures: async (u) => { mode = u.includes("last_modified=") ? "cursor" : "datetime"; return []; } }
        );
        expect(mode).toBe("cursor");
    });

    it("falls back to a datetime window when the cursor query times out", async () => {
        // The measured failure: cursor queries stall and are server-cancelled.
        const urls: string[] = [];
        const result = await ingestUsgsIncremental(gauges(["03451500"], NOW - 60_000), {}, NOW, {
            fetchFeatures: async (u) => {
                urls.push(u);
                if (u.includes("last_modified=")) throw new Error("Long running query has been cancelled");
                return [feature("03451500", NOW, 100)];
            },
        });

        expect(urls).toHaveLength(2);
        expect(urls[0]).toContain("last_modified=");
        expect(urls[1]).toContain("datetime=");
        expect(result.fellBack).toEqual(["USGS:03451500"]);
        expect(result.readings).toHaveLength(1);
        expect(result.errors.size).toBe(0);
    });

    it("records an error and no readings when both forms fail", async () => {
        const result = await ingestUsgsIncremental(gauges(["03451500"], NOW - 60_000), {}, NOW, {
            fetchFeatures: async () => { throw new Error("USGS HTTP 503"); },
        });

        expect(result.readings).toHaveLength(0);
        expect(result.errors.get("USGS:03451500")).toContain("503");
        expect(result.cursors.size).toBe(0);
    });

    it("seeds a cursor after a cold-start datetime backfill", async () => {
        // Otherwise every cycle would repeat the expensive full-window fallback.
        const result = await ingestUsgsIncremental(gauges(["03451500"], null), {}, NOW, {
            fetchFeatures: async (u) => {
                expect(u).toContain("datetime=");
                return [feature("03451500", NOW, 100, { last_modified: "" })];
            },
        });

        expect(result.fellBack).toEqual(["USGS:03451500"]);
        expect(result.cursors.get("USGS:03451500")).toBe(NOW - CURSOR_SAFETY_LAG_MS);
    });

    it("isolates a failing batch from healthy ones", async () => {
        const ids = Array.from({ length: 20 }, (_, i) => String(10000000 + i));
        const result = await ingestUsgsIncremental(gauges(ids, NOW - 60_000), {}, NOW, {
            fetchFeatures: async (u) => {
                if (u.includes("10000000")) throw new Error("boom");
                return [feature("10000010", NOW, 42)];
            },
        });

        expect(result.errors.size).toBe(BATCH_SIZE);
        expect(result.readings.length).toBeGreaterThan(0);
    });

    it("ignores non-numeric site codes rather than sending them upstream", async () => {
        let called = false;
        const result = await ingestUsgsIncremental(
            [{ id: "not-a-site", cursor: NOW }], {}, NOW,
            { fetchFeatures: async () => { called = true; return []; } }
        );

        expect(called).toBe(false);
        expect(result.readings).toHaveLength(0);
    });
});

describe("request sizing", () => {
    const idsIn = (url: string) =>
        decodeURIComponent(url).split("monitoring_location_id=")[1].split("&")[0].split(",").length;
    const windowDays = (url: string) => {
        const [from, to] = decodeURIComponent(url).split("datetime=")[1].split("&")[0].split("/");
        return (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
    };

    it("scales batch size down as the window widens", () => {
        expect(batchSizeForWindow(15 * 60 * 1000)).toBe(BATCH_SIZE);   // steady state
        expect(batchSizeForWindow(6 * HOUR)).toBe(BATCH_SIZE);         // gap recovery
        expect(batchSizeForWindow(3 * 86_400_000)).toBe(10);
        expect(batchSizeForWindow(30 * 86_400_000)).toBe(1);           // cold start
    });

    it("keeps every request within the site-day budget on a cold start", async () => {
        // Regression: batching 10 never-synced gauges over the 30-day horizon
        // is ~300 site-days, roughly 78k features and ~66MB in one Worker
        // request. A live cold start returned 2,876 records for ONE site.
        const ids = Array.from({ length: 25 }, (_, i) => String(10000000 + i));
        const urls: string[] = [];

        await ingestUsgsIncremental(ids.map(id => ({ id, cursor: null })), {}, NOW, {
            fetchFeatures: async (u) => { urls.push(u); return []; },
        });

        for (const url of urls) {
            expect(url).toContain("datetime=");
            expect(idsIn(url) * windowDays(url)).toBeLessThanOrEqual(MAX_SITE_DAYS + 0.01);
        }
    });

    it("defers cold gauges beyond the per-cycle budget instead of stalling", async () => {
        const ids = Array.from({ length: MAX_COLD_GAUGES_PER_CYCLE + 15 }, (_, i) => String(10000000 + i));
        const result = await ingestUsgsIncremental(
            ids.map(id => ({ id, cursor: null })), {}, NOW,
            { fetchFeatures: async () => [] }
        );

        expect(result.deferred).toBe(15);
    });

    it("still batches warm gauges 10-wide when cold ones are present", async () => {
        const warm = Array.from({ length: 20 }, (_, i) => ({ id: String(20000000 + i), cursor: NOW - 60_000 }));
        const cold = [{ id: "30000000", cursor: null }];
        const urls: string[] = [];

        await ingestUsgsIncremental([...warm, ...cold], {}, NOW, {
            fetchFeatures: async (u) => { urls.push(u); return []; },
        });

        const cursorUrls = urls.filter(u => u.includes("last_modified="));
        const dtUrls = urls.filter(u => u.includes("datetime="));

        expect(cursorUrls).toHaveLength(2);
        expect(cursorUrls.every(u => idsIn(u) === BATCH_SIZE)).toBe(true);
        expect(dtUrls).toHaveLength(1);
        expect(idsIn(dtUrls[0])).toBe(1);
    });
});

describe("chunk", () => {
    it("splits evenly and keeps the remainder", () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(chunk([], 10)).toEqual([]);
    });
});
