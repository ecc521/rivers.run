import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1, type TestD1 } from "../../__tests__/helpers/d1Sqlite";
import {
    FeatureAccumulator, RateBudget, buildContinuousUrl, planWindow, planBackfill, groupTasks,
    runUsgsCycle, isHourlyCycle, META_REVISION_CURSOR, META_WINDOW_OK,
    WINDOW_MS, MAX_WINDOW_MS, RATE_RESERVE, SITE_DAYS_PER_REQUEST, SITES_PER_REQUEST, MAX_REVISION_PAGES,
    type UsgsCycleInput,
} from "../usgsIngest";
import {
    resolveGaugeKeys, readProviderSyncState, readSeries, getMeta, setMeta, extendCoverage,
    slotStartOf, RETENTION_MS,
} from "../flowStore";
import type { OGCPagesResult } from "../usgs";

const NOW = 1_780_002_000_000; // hour-aligned
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();

const feature = (site: string, t: number, param: string, value: string | number, extra: Record<string, unknown> = {}) => ({
    properties: {
        monitoring_location_id: `USGS-${site}`, parameter_code: param, time: iso(t),
        value: String(value), approval_status: "Provisional", time_series_id: "a", ...extra,
    },
});

describe("FeatureAccumulator", () => {
    it("groups parameters by site and timestamp", () => {
        const acc = new FeatureAccumulator();
        acc.add([feature("1", NOW, "00060", 100), feature("1", NOW, "00065", 2.5), feature("1", NOW, "00010", 10)]);
        expect(acc.readings()).toEqual([{ gaugeId: "USGS:1", ts: NOW, cfs: 100, ft: 2.5, temp_f: 50, approved: false }]);
    });

    it("drops sentinels and invalid values", () => {
        const acc = new FeatureAccumulator();
        acc.add([feature("1", NOW, "00060", -999999), feature("1", NOW, "00065", "abc"), feature("1", NOW, "99999", 1)]);
        expect(acc.readings()).toEqual([]);
    });

    it("picks the lowest time_series_id regardless of page order", () => {
        const a = feature("1", NOW, "00065", 1.0, { time_series_id: "bbb" });
        const b = feature("1", NOW, "00065", 2.0, { time_series_id: "aaa" });
        for (const order of [[a, b], [b, a]]) {
            const acc = new FeatureAccumulator();
            acc.add(order.slice(0, 1));
            acc.add(order.slice(1));
            expect(acc.readings()[0].ft).toBe(2.0);
        }
    });

    it("prefers native degF over converted degC", () => {
        const acc = new FeatureAccumulator();
        acc.add([feature("1", NOW, "00010", 10, { time_series_id: "0" }), feature("1", NOW, "00011", 55, { time_series_id: "z" })]);
        expect(acc.readings()[0].temp_f).toBe(55);
    });

    it("marks a reading approved only when every record is", () => {
        const acc = new FeatureAccumulator();
        acc.add([feature("1", NOW, "00060", 1, { approval_status: "Approved" }), feature("2", NOW, "00060", 1, { approval_status: "Approved" }),
            feature("2", NOW, "00065", 1)]);
        const byId = Object.fromEntries(acc.readings().map(r => [r.gaugeId, r.approved]));
        expect(byId).toEqual({ "USGS:1": true, "USGS:2": false });
    });
});

describe("RateBudget", () => {
    it("is optimistic until the API reports, then keeps the reserve", () => {
        const b = new RateBudget();
        expect(b.allows(1000)).toBe(true);
        b.record(2, RATE_RESERVE + 10);
        expect(b.requests).toBe(2);
        expect(b.allows(10)).toBe(true);
        expect(b.allows(11)).toBe(false);
    });
});

describe("buildContinuousUrl", () => {
    it("limits properties, skips geometry and bounds revision sweeps by datetime", () => {
        const url = buildContinuousUrl(["1", "2"], { from: NOW - DAY, lastModifiedFrom: NOW - HOUR });
        expect(url).toContain("monitoring_location_id=USGS-1,USGS-2");
        expect(url).toContain("skipGeometry=true");
        expect(url).toContain("properties=monitoring_location_id,parameter_code,time,value,approval_status,time_series_id");
        expect(url).toContain(`datetime=${iso(NOW - DAY).replace(".000", "")}/..`);
        expect(url).toContain(`last_modified=${iso(NOW - HOUR).replace(".000", "")}/..`);
    });
});

describe("planWindow", () => {
    it("uses the normal window after a recent success", () => {
        expect(planWindow(NOW - 15 * MIN, NOW)).toEqual({ from: NOW - WINDOW_MS, repairFrom: null });
    });

    it("widens after missed cycles, and falls back to repair past the cap", () => {
        expect(planWindow(NOW - 10 * HOUR, NOW)).toEqual({ from: NOW - 10 * HOUR - 15 * MIN, repairFrom: null });
        expect(planWindow(NOW - 3 * DAY, NOW)).toEqual({ from: NOW - MAX_WINDOW_MS, repairFrom: NOW - 3 * DAY - 15 * MIN });
    });
});

describe("backfill planning", () => {
    const state = (coverageStart: number | null, repairFrom: number | null = null, gaugeKey = 1) =>
        ({ gaugeKey, coverageStart, repairFrom });

    it("orders repair, then the 7-day hindcast, then the rest of 30 days", () => {
        const tasks = planBackfill(new Map([
            ["USGS:full", state(NOW - 10 * DAY, null, 1)],
            ["USGS:cold", state(null, null, 2)],
            ["USGS:rep", state(NOW - 40 * DAY, NOW - DAY, 3)],
            ["USGS:done", state(NOW - 31 * DAY, null, 4)],
        ]), ["full", "cold", "rep", "done"], NOW - WINDOW_MS, NOW);
        expect(tasks.map(t => `${t.kind}:${t.siteId}`)).toEqual(["repair:rep", "recent:cold", "full:full"]);
        expect(tasks[1]).toMatchObject({ from: slotStartOf(NOW - 7 * DAY), to: NOW });
        expect(tasks[2]).toMatchObject({ from: slotStartOf(NOW - RETENTION_MS), to: NOW - 10 * DAY });
    });

    it("groups tasks by kind within the site-day budget", () => {
        const recent = Array.from({ length: 40 }, (_, i) => ({ siteId: `${i}`, gaugeKey: i, kind: "recent" as const, from: NOW - 7 * DAY, to: NOW }));
        const full = [{ siteId: "x", gaugeKey: 99, kind: "full" as const, from: NOW - 30 * DAY, to: NOW - 7 * DAY }];
        const groups = groupTasks([...recent, ...full]);
        const perGroup = Math.floor(SITE_DAYS_PER_REQUEST / 7);
        expect(groups[0]).toHaveLength(perGroup);
        expect(groups.at(-1)).toEqual(full);
        expect(groups.flat()).toHaveLength(41);
    });

    it("never puts more than SITES_PER_REQUEST sites in one request", () => {
        const tiny = Array.from({ length: 450 }, (_, i) => ({ siteId: `${i}`, gaugeKey: i, kind: "repair" as const, from: NOW - HOUR, to: NOW - HOUR + 15 * MIN }));
        expect(Math.max(...groupTasks(tiny).map(g => g.length))).toBeLessThanOrEqual(SITES_PER_REQUEST);
    });
});

describe("isHourlyCycle", () => {
    it("is true only in the first quarter hour", () => {
        expect(isHourlyCycle(NOW + 5 * MIN)).toBe(true);
        expect(isHourlyCycle(NOW + 20 * MIN)).toBe(false);
    });
});

describe("runUsgsCycle", () => {
    let db: TestD1;
    beforeEach(() => { db = createTestD1(); });
    afterEach(() => { db.close(); });

    /** Serves features for each requested site across the requested datetime range. */
    function fakeApi(opts: { fail?: (url: string) => boolean; remaining?: number } = {}) {
        const urls: string[] = [];
        const fetchPages = async (url: string, _t: number, _e: any, onPage: (f: any[], i: any) => any): Promise<OGCPagesResult> => {
            urls.push(url);
            if (opts.fail?.(url)) return { complete: false, pages: 1, rateRemaining: opts.remaining ?? null, error: "boom" };
            const params = new URL(url).searchParams;
            const sites = params.get("monitoring_location_id")!.split(",").map(s => s.replace("USGS-", ""));
            const [fromIso, toIso] = params.get("datetime")!.split("/");
            const from = Date.parse(fromIso);
            const to = toIso === ".." ? NOW : Date.parse(toIso);
            const features: any[] = [];
            for (const site of sites) {
                for (let t = from; t <= to; t += 15 * MIN) features.push(feature(site, t, "00060", 100));
            }
            // Serve in pages of 50 features, like the real paginated API.
            let pages = 0;
            for (let i = 0; i < features.length || i === 0; i += 50) {
                pages++;
                const more = i + 50 < features.length;
                if (await onPage(features.slice(i, i + 50), { rateRemaining: opts.remaining ?? null }) === false && more) {
                    return { complete: false, stopped: true, pages, rateRemaining: opts.remaining ?? null };
                }
            }
            return { complete: true, pages, rateRemaining: opts.remaining ?? null };
        };
        return { urls, fetchPages };
    }

    async function setup(siteIds: string[]) {
        const { keys } = await resolveGaugeKeys(db, siteIds.map(id => ({ gaugeId: `USGS:${id}`, provider: "USGS" })));
        return (over: Partial<UsgsCycleInput> & { api: ReturnType<typeof fakeApi> }) => runUsgsCycle({
            db, env: {}, siteIds, keys, now: NOW, runRevision: false, backfillRequests: 1000,
            deps: { fetchPages: over.api.fetchPages as any }, ...over,
        });
    }

    it("fills the window, backfills cold gauges, and is a no-op on replay", async () => {
        const run = await setup(["1", "2"]);
        const first = await run({ api: fakeApi() });
        expect(first.windowBatches).toBe(1);
        expect(first.rowsWritten.window).toBe(2 * (WINDOW_MS / (15 * MIN) + 1));
        // The 7-day hindcast comes first; the rest of 30 days next cycle.
        let state = await readProviderSyncState(db, "USGS");
        expect(state.get("USGS:1")!.coverageStart).toBe(slotStartOf(NOW - 7 * DAY));
        await run({ api: fakeApi() });
        state = await readProviderSyncState(db, "USGS");
        expect(state.get("USGS:1")!.coverageStart).toBe(slotStartOf(NOW - RETENTION_MS));

        const replay = await run({ api: fakeApi() });
        expect(replay.rowsWritten).toEqual({ window: 0, revision: 0, backfill: 0, state: 0 });
        expect(replay.backfillStopped).toBe("done");
    });

    it("marks failed window batches for repair and does not extend coverage", async () => {
        const run = await setup(["1"]);
        await setMeta(db, META_WINDOW_OK, NOW - 15 * MIN);
        const stats = await run({ api: fakeApi({ fail: () => true }) });
        expect(stats.windowFailed).toBe(1);
        const s = (await readProviderSyncState(db, "USGS")).get("USGS:1")!;
        expect(s.repairFrom).toBe(NOW - WINDOW_MS);
        expect(s.coverageStart).toBeNull();
    });

    it("clears a pending repair once a window covers it", async () => {
        const run = await setup(["1"]);
        await run({ api: fakeApi({ fail: () => true }), backfillRequests: 0 });
        const stats = await run({ api: fakeApi(), backfillRequests: 0 });
        expect(stats.windowFailed).toBe(0);
        expect((await readProviderSyncState(db, "USGS")).get("USGS:1")!.repairFrom).toBeNull();
    });

    it("stops backfill when the API's remaining budget is low", async () => {
        const run = await setup(["1"]);
        const stats = await run({ api: fakeApi({ remaining: RATE_RESERVE }) });
        expect(stats.backfillStopped).toBe("rate-budget");
        expect(stats.backfillRequests).toBe(0);
    });

    it("advances the revision cursor only when every batch completes", async () => {
        const run = await setup(["1"]);
        const first = await run({ api: fakeApi(), runRevision: true, backfillRequests: 0 });
        expect(first.revision).toBe("initialized");
        expect(await getMeta(db, META_REVISION_CURSOR)).toBe(NOW);

        await setMeta(db, META_REVISION_CURSOR, NOW - HOUR);
        const failing = await run({ api: fakeApi({ fail: u => u.includes("last_modified") }), runRevision: true, backfillRequests: 0 });
        expect(failing.revision).toBe("incomplete");
        expect(await getMeta(db, META_REVISION_CURSOR)).toBe(NOW - HOUR);

        const api = fakeApi();
        const ok = await run({ api, runRevision: true, backfillRequests: 0 });
        expect(ok.revision).toBe("ran");
        expect(await getMeta(db, META_REVISION_CURSOR)).toBe(NOW);
        const revUrl = api.urls.find(u => u.includes("last_modified"))!;
        expect(decodeURIComponent(revUrl)).toContain(`last_modified=${iso(NOW - HOUR - 15 * MIN).replace(".000", "")}/..`);
        expect(decodeURIComponent(revUrl)).toContain(`datetime=${iso(slotStartOf(NOW - RETENTION_MS)).replace(".000", "")}/..`);
    });

    it("skips the revision sweep when the budget cannot cover it", async () => {
        const run = await setup(["1"]);
        await setMeta(db, META_REVISION_CURSOR, NOW - HOUR);
        const stats = await run({ api: fakeApi({ remaining: RATE_RESERVE }), runRevision: true, backfillRequests: 0 });
        expect(stats.revision).toBe("skipped-budget");
    });

    it("caps revision sweep pages, keeps what it stored, and holds the cursor", async () => {
        const run = await setup(["1", "2", "3"]);
        await setMeta(db, META_REVISION_CURSOR, NOW - HOUR);
        const api = fakeApi();
        const stats = await run({ api, runRevision: true, backfillRequests: 0 });
        expect(stats.revision).toBe("incomplete");
        expect(stats.rowsWritten.revision).toBeGreaterThan(0);
        expect(stats.requests - stats.windowBatches).toBeLessThanOrEqual(MAX_REVISION_PAGES + 4);
        expect(await getMeta(db, META_REVISION_CURSOR)).toBe(NOW - HOUR);
    });

    it("abandons a cursor older than a day for datetime repair", async () => {
        const run = await setup(["1", "2"]);
        await setMeta(db, META_REVISION_CURSOR, NOW - 3 * DAY);
        const api = fakeApi();
        const stats = await run({ api, runRevision: true, backfillRequests: 0 });
        expect(stats.revision).toBe("lagged-to-repair");
        expect(api.urls.some(u => u.includes("last_modified"))).toBe(false);
        expect(await getMeta(db, META_REVISION_CURSOR)).toBe(NOW);
        const state = await readProviderSyncState(db, "USGS");
        expect(state.get("USGS:1")!.repairFrom).toBe(NOW - 3 * DAY - 15 * MIN);
    });

    it("splits a failing backfill group and backs off only the bad site", async () => {
        const sites = ["1", "2", "3", "4", "5", "6"];
        const run = await setup(sites);
        const api = fakeApi({ fail: u => u.includes("USGS-4") && !u.includes(`datetime=${iso(NOW - WINDOW_MS).replace(".000", "")}/..`) });
        await run({ api });
        const state = await readProviderSyncState(db, "USGS");
        for (const id of ["1", "2", "3", "5", "6"]) expect(state.get(`USGS:${id}`)!.coverageStart).not.toBeNull();
        expect(state.get("USGS:4")).toMatchObject({ coverageStart: null, failCount: 1 });
        expect(state.get("USGS:4")!.retryAt).toBeGreaterThan(NOW);

        const next = fakeApi();
        await run({ api: next });
        expect(next.urls.filter(u => u.includes("USGS-4"))).toHaveLength(1); // window sweep only
    });

    it("stores a readable series", async () => {
        const run = await setup(["1"]);
        await extendCoverage(db, [1], slotStartOf(NOW - RETENTION_MS));
        await run({ api: fakeApi(), backfillRequests: 0 });
        const series = await readSeries(db, ["USGS:1"], NOW - HOUR, NOW, NOW);
        expect(series["USGS:1"].readings.map(r => r.dateTime)).toEqual([0, 1, 2, 3, 4].map(i => NOW - HOUR + i * 15 * MIN));
    });
});
