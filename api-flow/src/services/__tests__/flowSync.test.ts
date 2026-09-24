import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestD1, type TestD1 } from "../../__tests__/helpers/d1Sqlite";
import {
    runIngestCycle, projectSitedata, buildDimensions, historiesToReadings, nextCoverage,
    storeCovers, rowsWrittenByCycle, FRESH_INGEST_MS,
} from "../flowSync";
import { countReadings, readSeries, readProviderSyncState, resolveGaugeKeys, upsertSlots, slotStartOf } from "../flowStore";
import type { GaugeProvider, GaugeHistory } from "../provider";

const usgsCalls: any[] = [];
vi.mock("../usgsIngest", async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        runUsgsCycle: async (input: any) => {
            usgsCalls.push(input);
            return { requests: 0, rowsWritten: { window: 0, revision: 0, backfill: 0, state: 0 } };
        },
    };
});

const NOW = 1_780_002_000_000 + 20 * 60_000; // not an hourly cycle
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

let db: TestD1;
beforeEach(() => { db = createTestD1(); usgsCalls.length = 0; });
afterEach(() => { db.close(); });

const makeEnv = (linkedGaugeIds: string[]) => ({
    DB: {
        prepare: (sql: string) => ({
            bind: () => ({ run: async () => ({}), all: async () => ({ results: [] }) }),
            all: async () => sql.includes("FROM rivers")
                ? { results: [{ gauges: JSON.stringify(linkedGaugeIds.map(id => ({ id }))) }] }
                : { results: [] },
        }),
    },
} as any);

const history = (id: string, readings: any[]): GaugeHistory => ({ id, name: `Gauge ${id}`, readings });

function stubProvider(id: string, impl: Partial<GaugeProvider> = {}): GaugeProvider & { calls: any[] } {
    const calls: any[] = [];
    return {
        id, preferredUnits: "imperial", capabilities: { hasForecast: false, hasSiteListing: false }, calls,
        async getLatest(codes: string[]) {
            calls.push(["getLatest", codes]);
            return Object.fromEntries(codes.map(c => [c, { dateTime: NOW - 10 * MIN, cfs: 10 }]));
        },
        async getHistory(codes: string[], start: number, _end?: number, forecast?: boolean) {
            calls.push(["getHistory", codes, start, forecast]);
            return Object.fromEntries(codes.map(c => [c, history(c, [{ dateTime: NOW - 10 * MIN, cfs: 20 }])]));
        },
        async getSiteListing() { return []; },
        ...impl,
    } as any;
}

describe("buildDimensions", () => {
    it("merges registry and linked gauges and attaches NWM reach ids", () => {
        const dims = buildDimensions(
            { "USGS:1": { name: "One", lat: "35.1" }, "virtual:x": {} },
            ["usgs:1", "EC:2"],
            { "1": "12345" });
        expect(dims).toEqual([
            expect.objectContaining({ gaugeId: "USGS:1", name: "One", lat: 35.1, nwmReachId: "12345" }),
            expect.objectContaining({ gaugeId: "EC:2", provider: "EC" }),
        ]);
    });
});

describe("historiesToReadings", () => {
    it("splits forecast rows off instead of storing them", () => {
        const forecasts: Record<string, any[]> = {};
        const out = historiesToReadings("NWS", {
            ABC: history("ABC", [{ dateTime: NOW, ft: 1 }, { dateTime: NOW + HOUR, ft: 2, isForecast: true }]),
        }, forecasts);
        expect(out).toEqual([expect.objectContaining({ gaugeId: "NWS:ABC", ts: NOW, ft: 1 })]);
        expect(forecasts["NWS:ABC"]).toHaveLength(1);
    });
});

/** A bulk provider stub yielding the given units; `fail` lists units that fail. */
function bulkProvider(id: string, units: Record<string, Record<string, any[]>>, opts: { fail?: string[]; forecasts?: Record<string, any[]> } = {}) {
    return stubProvider(id, {
        async *getBulkHistories(codes: string[]) {
            for (const [unit, sites] of Object.entries(units)) {
                const siteCodes = Object.keys(sites).filter(c => codes.includes(c));
                if (opts.fail?.includes(unit)) { yield { unit, siteCodes, histories: null }; continue; }
                yield {
                    unit, siteCodes,
                    histories: Object.fromEntries(siteCodes.map(c => [c, history(c, sites[c])])),
                    forecasts: opts.forecasts,
                };
            }
        },
    } as any);
}

describe("nextCoverage", () => {
    it("keeps coverage, starts it on first sight, and restarts it after an unrecoverable gap", () => {
        const from = NOW - DAY;
        expect(nextCoverage(undefined, from, null)).toEqual({ coverageStart: from, repairFrom: null });
        expect(nextCoverage({ coverageStart: NOW - 5 * DAY, repairFrom: null }, from, NOW - HOUR).coverageStart).toBe(NOW - 5 * DAY);
        expect(nextCoverage({ coverageStart: NOW - 5 * DAY, repairFrom: null }, from, NOW - 2 * DAY).coverageStart).toBe(from);
        expect(nextCoverage({ coverageStart: NOW - 5 * DAY, repairFrom: NOW - 3 * DAY }, from, null).coverageStart).toBe(from);
        expect(nextCoverage({ coverageStart: NOW - 5 * DAY, repairFrom: NOW - HOUR }, from, null))
            .toEqual({ coverageStart: NOW - 5 * DAY, repairFrom: null });
    });
});

describe("runIngestCycle", () => {
    const series = [
        { dateTime: NOW - 20 * HOUR - 7 * MIN, cms: 0.5 },
        { dateTime: NOW - 30 * MIN, cms: 1 }, { dateTime: NOW - 25 * MIN, cms: 1.1 }, { dateTime: NOW - 10 * MIN, cms: 2 },
    ];

    it("stores whole EC units, sets per-gauge coverage, and writes nothing on replay", async () => {
        const ec = bulkProvider("EC", { AB: { A: series }, BC: { B: series.slice(1) } });
        const registry = { "EC:A": { name: "A" }, "EC:B": { name: "B" } };

        const first = await runIngestCycle(makeEnv([]), db, registry, { EC: ec }, NOW);
        expect(await countReadings(db)).toBe(5); // 5-min readings collapse to 15-min slots
        expect(rowsWrittenByCycle(first)).toMatchObject({ dimensions: 2, providers: 5 });

        const cov = await readProviderSyncState(db, "EC");
        expect(cov.get("EC:A")!.coverageStart).toBe(slotStartOf(NOW - 20 * HOUR - 7 * MIN) + 15 * MIN);
        expect(cov.get("EC:B")!.coverageStart).toBe(slotStartOf(NOW - 30 * MIN) + 15 * MIN);

        const again = await runIngestCycle(makeEnv([]), db, registry, { EC: ec }, NOW);
        expect(rowsWrittenByCycle(again)).toEqual({
            dimensions: 0, providers: 0, state: 0, usgsWindow: 0, usgsRevision: 0, usgsBackfill: 0,
        });
    });

    it("marks a failed unit's gauges for repair and settles them on the next success", async () => {
        const registry = { "EC:A": {}, "EC:B": {} };
        await runIngestCycle(makeEnv([]), db, registry, { EC: bulkProvider("EC", { AB: { A: series }, BC: { B: series } }) }, NOW - HOUR);
        await runIngestCycle(makeEnv([]), db, registry, { EC: bulkProvider("EC", { AB: { A: series }, BC: { B: series } }, { fail: ["BC"] }) }, NOW - 30 * MIN);
        let state = await readProviderSyncState(db, "EC");
        expect(state.get("EC:A")!.repairFrom).toBeNull();
        expect(state.get("EC:B")!.repairFrom).toBe(NOW - HOUR);

        await runIngestCycle(makeEnv([]), db, registry, { EC: bulkProvider("EC", { AB: { A: series }, BC: { B: series } }) }, NOW);
        state = await readProviderSyncState(db, "EC");
        expect(state.get("EC:B")).toMatchObject({ repairFrom: null, coverageStart: slotStartOf(NOW - 20 * HOUR - 7 * MIN) + 15 * MIN });
    });

    it("keeps NWS forecasts apart from observations at the same time", async () => {
        const nws = bulkProvider("NWS", { XYZ: { XYZ: [{ dateTime: NOW - 10 * MIN, ft: 3 }] } },
            { forecasts: { XYZ: [{ dateTime: NOW - 10 * MIN, ft: 3.5, isForecast: true }, { dateTime: NOW + HOUR, ft: 4, isForecast: true }] } });
        const stats = await runIngestCycle(makeEnv(["NWS:XYZ"]), db, {}, { NWS: nws }, NOW);
        expect(stats.forecasts["NWS:XYZ"]).toHaveLength(2);
        const stored = await readSeries(db, ["NWS:XYZ"], NOW - HOUR, NOW, NOW);
        expect(stored["NWS:XYZ"].readings).toEqual([{ dateTime: NOW - 10 * MIN, ft: 3 }]);
    });

    it("uses history for linked latest-only gauges and getLatest for the rest", async () => {
        const ie = stubProvider("IE");
        await runIngestCycle(makeEnv(["IE:L"]), db, { "IE:L": {}, "IE:R": {} }, { IE: ie }, NOW);
        expect(ie.calls.map(c => [c[0], c[1]])).toEqual([["getHistory", ["L"]], ["getLatest", ["R"]]]);
        expect(await countReadings(db)).toBe(2);
    });

    it("fetches UK every cycle but stores it only on the hourly cycle, one reading per gauge per hour", async () => {
        const H = 1_780_002_000_000; // an hour boundary
        const quarterly = (from: number, to: number) => {
            const out = [];
            for (let ts = slotStartOf(from) + 15 * MIN; ts <= to; ts += 15 * MIN) out.push({ dateTime: ts, m: ts / MIN % 97 });
            return out;
        };
        let clock = 0;
        const uk = stubProvider("UK", {
            async getLatest(codes: string[]) {
                return Object.fromEntries(codes.map(c => [c, { dateTime: slotStartOf(clock), m: 1 }]));
            },
            async getHistory(codes: string[], start: number, end?: number) {
                return Object.fromEntries(codes.map(c => [c, history(c, quarterly(start, end!))]));
            },
        });
        const registry = { "UK:L": {}, "UK:R": {} };
        const cycle = (at: number) => { clock = at; return runIngestCycle(makeEnv(["UK:L"]), db, registry, { UK: uk }, at); };

        for (const at of [H + 20 * MIN, H + 35 * MIN, H + 50 * MIN]) {
            const stats = await cycle(at);
            expect(stats.providerRows.UK).toBe(0);
            expect(stats.latest.get("UK:R")!.ts).toBe(slotStartOf(at));
            expect(stats.fetched.at(-1)).toMatchObject({ gaugeId: "UK:L", ts: slotStartOf(at) });
        }
        expect(await countReadings(db)).toBe(0);

        const hourly = await cycle(H + HOUR + 5 * MIN);
        expect(hourly.providerRows.UK).toBe(5);
        const stored = await readSeries(db, ["UK:L", "UK:R"], H - 3 * HOUR, clock, clock);
        expect(stored["UK:L"].readings.map(r => r.dateTime)).toEqual([H - 105 * MIN, H - HOUR, H, H + HOUR]);
        expect(stored["UK:R"].readings.map(r => r.dateTime)).toEqual([H + HOUR]);

        expect((await cycle(H + HOUR + 5 * MIN)).providerRows.UK).toBe(0);
        expect((await cycle(H + HOUR + 20 * MIN)).providerRows.UK).toBe(0);
        expect(await countReadings(db)).toBe(5);
    });

    it("hands every USGS gauge to the USGS sweeps in one list", async () => {
        await runIngestCycle(makeEnv(["USGS:2"]), db, { "USGS:1": {}, "USGS:2": {} }, { USGS: stubProvider("USGS") }, NOW,
            { backfillRequests: 7 });
        expect(usgsCalls).toHaveLength(1);
        expect(usgsCalls[0].siteIds.sort()).toEqual(["1", "2"]);
        expect(usgsCalls[0]).toMatchObject({ runRevision: false, backfillRequests: 7 });
    });

    it("isolates a failing provider", async () => {
        const bad = stubProvider("UK", { async getLatest() { throw new Error("down"); } });
        const good = stubProvider("IE");
        const env = makeEnv([]);
        const stats = await runIngestCycle(env, db, { "UK:1": {}, "IE:1": {} }, { UK: bad, IE: good }, NOW);
        expect(stats.errors).toBe(1);
        expect(await countReadings(db)).toBe(1);
    });
});

describe("projectSitedata", () => {
    const row = (gaugeId: string, ts: number, cfs: number) =>
        ({ gaugeId, ts, off: 0, cfs, ft: null, cms: null, m: null, temp_f: null, precip_in: null, approved: false });
    const t = slotStartOf(NOW);

    it("builds latest, linked windows, forecasts and falls back to the previous entry", async () => {
        const { keys } = await resolveGaugeKeys(db, ["USGS:1", "USGS:2", "UK:9"].map(id => ({ gaugeId: id, provider: id.split(":")[0] })));
        await upsertSlots(db, [row("USGS:1", t - 30 * MIN, 1), row("USGS:1", t - 15 * MIN, 2), row("USGS:1", t, 3), row("USGS:2", t, 5)], keys);

        const out = await projectSitedata(db,
            { "USGS:1": { name: "One" }, "USGS:2": { name: "Two" }, "UK:9": { name: "Nine" } },
            ["USGS:1"],
            { "USGS:1": [{ dateTime: t + HOUR, cfs: 9, isForecast: true }] },
            { "UK:9": { readings: [{ dateTime: t - DAY, cfs: 7 }, { dateTime: t + HOUR, cfs: 8, isForecast: true }] } },
            NOW);

        expect(out["USGS:1"].readings.map((r: any) => r.cfs)).toEqual([1, 2, 3, 9]);
        expect(out["USGS:2"].readings).toEqual([{ dateTime: t, cfs: 5 }]);
        expect(out["UK:9"].readings).toEqual([{ dateTime: t - DAY, cfs: 7 }]);
        expect(out["USGS:1"].name).toBe("One");
    });

    it("uses the newest fetched reading when the store's slot holds an earlier one", async () => {
        const { keys } = await resolveGaugeKeys(db, [{ gaugeId: "USGS:1", provider: "USGS" }, { gaugeId: "USGS:2", provider: "USGS" }]);
        await upsertSlots(db, [row("USGS:1", t, 3), row("USGS:2", t, 5)], keys);
        const fetched = new Map([["USGS:1", { gaugeId: "USGS:1", ts: t + 10 * MIN, cfs: 4 }]]);
        const out = await projectSitedata(db, { "USGS:1": {}, "USGS:2": {} }, ["USGS:2"], {}, null, NOW, fetched);
        expect(out["USGS:1"].readings).toEqual([{ dateTime: t + 10 * MIN, cfs: 4 }]);
        expect(out["USGS:2"].readings).toEqual([{ dateTime: t, cfs: 5 }]);
    });

    it("takes a linked gauge's window from fetched readings over the store", async () => {
        const { keys } = await resolveGaugeKeys(db, [{ gaugeId: "UK:9", provider: "UK" }]);
        await upsertSlots(db, [row("UK:9", t - HOUR, 1)], keys);
        const fetched = [30, 15, 0].map((m, i) => ({ gaugeId: "UK:9", ts: t - m * MIN, m: i }));
        const out = await projectSitedata(db, { "UK:9": {} }, ["UK:9"], {}, null, NOW, new Map(), fetched);
        expect(out["UK:9"].readings).toEqual([
            { dateTime: t - 30 * MIN, m: 0 }, { dateTime: t - 15 * MIN, m: 1 }, { dateTime: t, m: 2 },
        ]);
    });

    it("keeps dead-prefix linked gauges with their previous readings and skips store-only gauges", async () => {
        const { keys } = await resolveGaugeKeys(db, [{ gaugeId: "UK:9", provider: "UK" }]);
        await upsertSlots(db, [row("UK:9", t - HOUR, 1)], keys);
        const previous = { "virtual:abc": { id: "abc", name: "V", readings: [{ dateTime: 1, cfs: 5 }] } };
        const out = await projectSitedata(db, { "virtual:abc": { name: "V" } }, ["virtual:abc", "streambeam:x"], {}, previous, NOW);
        expect(out["virtual:abc"].readings).toEqual([{ dateTime: 1, cfs: 5 }]);
        expect(out["streambeam:x"]).toBeDefined();
        expect(out["UK:9"]).toBeUndefined();
    });
});

describe("storeCovers", () => {
    const start = NOW - 7 * DAY;
    const fresh = NOW - 10 * MIN;
    it("requires coverage back to the start and no pending repair", () => {
        expect(storeCovers("USGS:1", { coverageStart: start - DAY, repairFrom: null }, start, fresh, NOW)).toBe(true);
        expect(storeCovers("USGS:1", { coverageStart: start + DAY, repairFrom: null }, start, fresh, NOW)).toBe(false);
        expect(storeCovers("USGS:1", { coverageStart: start - DAY, repairFrom: NOW - HOUR }, start, fresh, NOW)).toBe(false);
        expect(storeCovers("USGS:1", undefined, start, fresh, NOW)).toBe(false);
    });

    it("requires a fresh ingest", () => {
        const s = { coverageStart: start - DAY, repairFrom: null };
        expect(storeCovers("USGS:1", s, start, NOW - FRESH_INGEST_MS - 1, NOW)).toBe(false);
        expect(storeCovers("USGS:1", s, start, null, NOW)).toBe(false);
    });

    it("never serves latest-only providers from the store", () => {
        expect(storeCovers("UK:1", { coverageStart: 0, repairFrom: null }, start, fresh, NOW)).toBe(false);
        expect(storeCovers("EC:1", { coverageStart: 0, repairFrom: null }, start, fresh, NOW)).toBe(true);
    });
});

describe("readSeries integration", () => {
    it("returns stored EC readings after a cycle", async () => {
        const ec = bulkProvider("EC", { AB: { A: [{ dateTime: NOW - 10 * MIN, cms: 2 }] } });
        await runIngestCycle(makeEnv([]), db, { "EC:A": {} }, { EC: ec }, NOW);
        const series = await readSeries(db, ["EC:A"], NOW - HOUR, NOW, NOW);
        expect(series["EC:A"].readings).toEqual([{ dateTime: NOW - 10 * MIN, cms: 2 }]);
    });
});
