import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1, type TestD1 } from "../../__tests__/helpers/d1Sqlite";
import {
    runIngestCycle,
    projectSitedata,
    buildDimensions,
    historiesToReadings,
} from "../flowSync";
import { countReadings, readSeries } from "../flowStore";
import type { GaugeProvider, GaugeHistory } from "../provider";

const NOW = 1_779_999_900_000;
const SNAP = 300_000;
const HOUR = 3_600_000;

let db: TestD1;
beforeEach(() => { db = createTestD1(); });
afterEach(() => { db.close(); });

/** Minimal Env stub: only the rivers query and logging are exercised. */
const makeEnv = (linkedGaugeIds: string[]) => ({
    DB: {
        prepare: (sql: string) => ({
            bind: () => ({ run: async () => ({}), all: async () => ({ results: [] }) }),
            all: async () => {
                if (sql.includes("FROM rivers")) {
                    return { results: [{ gauges: JSON.stringify(linkedGaugeIds.map(id => ({ id }))) }] };
                }
                return { results: [] };
            },
            run: async () => ({}),
            first: async () => null,
        }),
        batch: async () => [],
    },
} as any);

const history = (id: string, readings: any[]): GaugeHistory =>
    ({ id, name: `Gauge ${id}`, readings });

/** Provider stub recording which methods were called. */
function stubProvider(id: string, impl: Partial<GaugeProvider> = {}): GaugeProvider & { calls: string[] } {
    const calls: string[] = [];
    return {
        id,
        preferredUnits: "imperial",
        capabilities: { hasForecast: false, hasSiteListing: false },
        calls,
        async getLatest(codes: string[]) {
            calls.push("getLatest");
            return Object.fromEntries(codes.map((c: string) => [c, { dateTime: NOW, cfs: 10 }]));
        },
        async getHistory(codes: string[]) {
            calls.push("getHistory");
            return Object.fromEntries(codes.map((c: string) => [c, history(c, [{ dateTime: NOW, cfs: 20 }])]));
        },
        async getSiteListing() { return []; },
        ...impl,
    } as any;
}

describe("buildDimensions", () => {
    it("marks linked gauges tier A and everything else tier B", () => {
        const dims = buildDimensions(
            { "USGS:1": { name: "One" }, "USGS:2": { name: "Two" } },
            ["USGS:1"]
        );
        expect(dims.find(d => d.gaugeId === "USGS:1")!.tier).toBe("linked");
        expect(dims.find(d => d.gaugeId === "USGS:2")!.tier).toBe("registry");
    });

    it("includes a linked gauge that is not yet in the registry", () => {
        const dims = buildDimensions({}, ["USGS:999"]);
        expect(dims).toHaveLength(1);
        expect(dims[0]).toMatchObject({ gaugeId: "USGS:999", tier: "linked", provider: "USGS" });
    });

    it("normalizes casing so a lowercase link matches its registry entry", () => {
        const dims = buildDimensions({ "USGS:1": { name: "One" } }, ["usgs:1"]);
        expect(dims).toHaveLength(1);
        expect(dims[0].tier).toBe("linked");
    });

    it("excludes the removed streambeam and virtual prefixes", () => {
        const dims = buildDimensions(
            { "USGS:1": {}, "streambeam:1": {}, "VIRTUAL:1": {}, "virtual:2": {} },
            []
        );
        expect(dims.map(d => d.gaugeId)).toEqual(["USGS:1"]);
    });
});

describe("historiesToReadings", () => {
    it("prefixes ids and skips forecast rows", () => {
        const out = historiesToReadings("EC", {
            "05BB001": history("05BB001", [
                { dateTime: NOW, cms: 12 },
                { dateTime: NOW + HOUR, cmsForecast: 15, isForecast: true },
            ]),
        });
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ gaugeId: "EC:05BB001", ts: NOW, cms: 12 });
    });
});

describe("runIngestCycle", () => {
    it("keeps EVERY reading a bulk endpoint returns, not just the newest", async () => {
        // Environment Canada's hourly province CSVs already contain many hours
        // per station; getLatest threw all but one row away.
        const ec = stubProvider("EC", {
            async getLatestHistories(codes: string[]) {
                return Object.fromEntries(codes.map(c => [c, history(c, [
                    { dateTime: NOW - 2 * HOUR, cms: 10 },
                    { dateTime: NOW - HOUR, cms: 11 },
                    { dateTime: NOW, cms: 12 },
                ])]));
            },
        });

        await runIngestCycle(makeEnv([]), db, { "EC:05BB001": { name: "Bow" } }, { EC: ec }, NOW);

        expect(await countReadings(db)).toBe(3);
        const series = await readSeries(db, ["EC:05BB001"], 0);
        expect(series["EC:05BB001"].readings.map(r => r.cms)).toEqual([10, 11, 12]);
    });

    it("falls back to wrapping getLatest for latest-only providers", async () => {
        // UK's readings?latest=true genuinely returns one value per station.
        const uk = stubProvider("UK");
        await runIngestCycle(makeEnv([]), db, { "UK:1234": { name: "Dee" } }, { UK: uk }, NOW);

        expect(uk.calls).toContain("getLatest");
        expect(await countReadings(db)).toBe(1);
    });

    it("accumulates history across cycles without re-fetching it", async () => {
        // This is the core of the design: poll latest, append, and 30 days
        // builds itself with no backfill for tier B.
        const uk = stubProvider("UK", {
            async getLatest(codes: string[]) {
                return Object.fromEntries(codes.map(c => [c, { dateTime: tick, m: 1 }]));
            },
        });

        let tick = NOW - 3 * SNAP;
        const registry = { "UK:1234": { name: "Dee" } };
        for (let i = 0; i < 4; i++) {
            await runIngestCycle(makeEnv([]), db, registry, { UK: uk }, NOW);
            tick += SNAP;
        }

        expect(await countReadings(db)).toBe(4);
        const series = await readSeries(db, ["UK:1234"], 0);
        expect(series["UK:1234"].readings.map(r => r.dateTime))
            .toEqual([NOW - 3 * SNAP, NOW - 2 * SNAP, NOW - SNAP, NOW]);
    });

    it("routes linked gauges through getHistory and registry gauges through getLatest", async () => {
        const uk = stubProvider("UK");
        await runIngestCycle(
            makeEnv(["UK:linked"]), db,
            { "UK:linked": { name: "A" }, "UK:other": { name: "B" } },
            { UK: uk }, NOW
        );

        expect(uk.calls).toContain("getHistory");
        expect(uk.calls).toContain("getLatest");

        const linked = await readSeries(db, ["UK:linked"], 0);
        expect(linked["UK:linked"].readings[0].cfs).toBe(20); // getHistory value
    });

    it("isolates a failing provider without losing the others", async () => {
        const broken = stubProvider("UK", {
            async getLatest() { throw new Error("EA outage"); },
        });
        const healthy = stubProvider("IE");

        const stats = await runIngestCycle(
            makeEnv([]), db,
            { "UK:1": {}, "IE:2": {} },
            { UK: broken, IE: healthy }, NOW
        );

        expect(stats.errors).toBeGreaterThan(0);
        expect(await countReadings(db)).toBe(1);
        expect((await readSeries(db, ["IE:2"], 0))["IE:2"]).toBeTruthy();
    });

    it("retains stored readings through a total provider outage", async () => {
        // The durability win: the legacy path had to recover readings from the
        // previous sitedata.json because nothing persisted them.
        const uk = stubProvider("UK");
        const registry = { "UK:1234": {} };
        await runIngestCycle(makeEnv([]), db, registry, { UK: uk }, NOW);
        expect(await countReadings(db)).toBe(1);

        const dead = stubProvider("UK", {
            async getLatest() { throw new Error("total outage"); },
        });
        await runIngestCycle(makeEnv([]), db, registry, { UK: dead }, NOW + SNAP);

        expect(await countReadings(db)).toBe(1);
        const projected = await projectSitedata(db, registry, [], NOW + SNAP);
        expect(projected["UK:1234"].readings).toHaveLength(1);
    });

    it("records sync state so the next cycle can run incrementally", async () => {
        const uk = stubProvider("UK");
        await runIngestCycle(makeEnv([]), db, { "UK:1234": {} }, { UK: uk }, NOW);

        const row = db.query(
            "SELECT s.last_obs_ts, s.fail_count FROM gauge_sync_state s")[0];
        expect(row.last_obs_ts).toBe(NOW);
        expect(row.fail_count).toBe(0);
    });

    it("ignores gauges whose provider is not registered", async () => {
        const stats = await runIngestCycle(
            makeEnv([]), db, { "NOPE:1": {}, "UK:2": {} }, { UK: stubProvider("UK") }, NOW);

        expect(stats.errors).toBe(0);
        expect(await countReadings(db)).toBe(1);
    });
});

describe("projectSitedata", () => {
    it("preserves the legacy payload shape", async () => {
        const uk = stubProvider("UK");
        const registry = {
            "UK:1234": { name: "Dee", lat: 53.1, lon: -3.2, state: "Wales", country: "UK", section: "Upper" },
        };
        await runIngestCycle(makeEnv([]), db, registry, { UK: uk }, NOW);

        const out = await projectSitedata(db, registry, [], NOW);
        expect(out["UK:1234"]).toMatchObject({
            id: "1234", name: "Dee", lat: 53.1, lon: -3.2,
            state: "Wales", country: "UK", section: "Upper",
        });
        expect(out["UK:1234"].readings).toEqual([{ dateTime: NOW, cfs: 10 }]);
    });

    it("gives registry gauges latest-only and linked gauges a recent window", async () => {
        // sitedata.json is the offline bootstrap; putting 30 days in it would
        // balloon a 3.4MB artifact. The full history lives behind /history.
        const uk = stubProvider("UK", {
            async getHistory(codes: string[]) {
                return Object.fromEntries(codes.map(c => [c, history(c, [
                    { dateTime: NOW - 2 * SNAP, cfs: 1 },
                    { dateTime: NOW - SNAP, cfs: 2 },
                    { dateTime: NOW, cfs: 3 },
                ])]));
            },
        });

        const registry = { "UK:linked": {}, "UK:reg": {} };
        await runIngestCycle(makeEnv(["UK:linked"]), db, registry, { UK: uk }, NOW);

        const out = await projectSitedata(db, registry, ["UK:linked"], NOW);
        expect(out["UK:linked"].readings).toHaveLength(3);
        expect(out["UK:reg"].readings).toHaveLength(1);
    });

    it("emits registry gauges with an empty readings array when unseen", async () => {
        const out = await projectSitedata(db, { "UK:never": { name: "X" } }, [], NOW);
        expect(out["UK:never"].readings).toEqual([]);
    });

    it("excludes dead prefixes that still appear in the registry", async () => {
        const out = await projectSitedata(
            db, { "UK:1": {}, "streambeam:1": {}, "VIRTUAL:1": {} }, [], NOW);
        expect(Object.keys(out)).toEqual(["UK:1"]);
    });
});
