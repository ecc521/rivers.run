import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestD1, type TestD1 } from "../../__tests__/helpers/d1Sqlite";
import {
    runIngestCycle, projectSitedata, buildDimensions, historiesToReadings, providerWindow,
    storeCovers, rowsWrittenByCycle,
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

describe("providerWindow", () => {
    it("widens after misses and flags a gap past 24h", () => {
        expect(providerWindow(null, NOW)).toEqual({ from: slotStartOf(NOW - 3 * HOUR), gap: false });
        expect(providerWindow(NOW - 5 * HOUR, NOW).from).toBe(slotStartOf(NOW - 5 * HOUR - 15 * MIN));
        expect(providerWindow(NOW - 2 * DAY, NOW)).toEqual({ from: slotStartOf(NOW - DAY), gap: true });
    });
});

describe("runIngestCycle", () => {
    it("stores a windowed provider, records coverage, and writes nothing on replay", async () => {
        const ec = stubProvider("EC", {
            async getLatestHistories(codes: string[], _env?: any, since?: number) {
                ec.calls.push(["getLatestHistories", codes, since]);
                return Object.fromEntries(codes.map(c => [c, history(c, [
                    { dateTime: NOW - 30 * MIN, cms: 1 }, { dateTime: NOW - 25 * MIN, cms: 1.1 }, { dateTime: NOW - 10 * MIN, cms: 2 },
                ])]));
            },
        });
        const registry = { "EC:A": { name: "A" }, "EC:B": { name: "B" } };

        const first = await runIngestCycle(makeEnv([]), db, registry, { EC: ec }, NOW);
        expect(ec.calls[0][2]).toBe(slotStartOf(NOW - 3 * HOUR));
        expect(await countReadings(db)).toBe(4); // 5-min readings collapse to 15-min slots
        expect(rowsWrittenByCycle(first)).toMatchObject({ dimensions: 2, providers: 4 });

        const cov = await readProviderSyncState(db, "EC");
        expect(cov.get("EC:A")!.coverageStart).toBe(slotStartOf(NOW - 3 * HOUR));

        const again = await runIngestCycle(makeEnv([]), db, registry, { EC: ec }, NOW);
        expect(rowsWrittenByCycle(again)).toEqual({
            dimensions: 0, providers: 0, state: 0, usgsWindow: 0, usgsRevision: 0, usgsBackfill: 0,
        });
    });

    it("keeps NWS forecasts in memory and stores only observations", async () => {
        const nws = stubProvider("NWS", {
            async getHistory(codes: string[], _s: number, _e?: number, forecast?: boolean) {
                nws.calls.push(["getHistory", forecast]);
                return Object.fromEntries(codes.map(c => [c, history(c, [
                    { dateTime: NOW - 10 * MIN, ft: 3 }, { dateTime: NOW + HOUR, ft: 4, isForecast: true },
                ])]));
            },
        });
        const stats = await runIngestCycle(makeEnv(["NWS:XYZ"]), db, {}, { NWS: nws }, NOW);
        expect(nws.calls).toEqual([["getHistory", true]]);
        expect(stats.forecasts["NWS:XYZ"]).toEqual([{ dateTime: NOW + HOUR, ft: 4, isForecast: true }]);
        expect(await countReadings(db)).toBe(1);
    });

    it("uses history for linked latest-only gauges and getLatest for the rest", async () => {
        const uk = stubProvider("UK");
        await runIngestCycle(makeEnv(["UK:L"]), db, { "UK:L": {}, "UK:R": {} }, { UK: uk }, NOW);
        expect(uk.calls.map(c => [c[0], c[1]])).toEqual([["getHistory", ["L"]], ["getLatest", ["R"]]]);
        expect(await countReadings(db)).toBe(2);
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
    it("builds latest, linked windows, forecasts and falls back to the previous entry", async () => {
        const { keys } = await resolveGaugeKeys(db, ["USGS:1", "USGS:2", "UK:9"].map(id => ({ gaugeId: id, provider: id.split(":")[0] })));
        const row = (gaugeId: string, ts: number, cfs: number) =>
            ({ gaugeId, ts, off: 0, cfs, ft: null, cms: null, m: null, temp_f: null, precip_in: null, approved: false });
        const t = slotStartOf(NOW);
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
});

describe("storeCovers", () => {
    const start = NOW - 7 * DAY;
    it("requires coverage back to the start and no pending repair", () => {
        expect(storeCovers("USGS:1", { coverageStart: start - DAY, repairFrom: null }, start)).toBe(true);
        expect(storeCovers("USGS:1", { coverageStart: start + DAY, repairFrom: null }, start)).toBe(false);
        expect(storeCovers("USGS:1", { coverageStart: start - DAY, repairFrom: NOW - HOUR }, start)).toBe(false);
        expect(storeCovers("USGS:1", undefined, start)).toBe(false);
    });

    it("never serves latest-only providers from the store", () => {
        expect(storeCovers("UK:1", { coverageStart: 0, repairFrom: null }, start)).toBe(false);
        expect(storeCovers("EC:1", { coverageStart: 0, repairFrom: null }, start)).toBe(true);
    });
});

describe("readSeries integration", () => {
    it("returns stored EC readings after a cycle", async () => {
        const ec = stubProvider("EC", {
            async getLatestHistories(codes: string[]) {
                return Object.fromEntries(codes.map(c => [c, history(c, [{ dateTime: NOW - 10 * MIN, cms: 2 }])]));
            },
        });
        await runIngestCycle(makeEnv([]), db, { "EC:A": {} }, { EC: ec }, NOW);
        const series = await readSeries(db, ["EC:A"], NOW - HOUR, NOW, NOW);
        expect(series["EC:A"].readings).toEqual([{ dateTime: NOW - 10 * MIN, cms: 2 }]);
    });
});
