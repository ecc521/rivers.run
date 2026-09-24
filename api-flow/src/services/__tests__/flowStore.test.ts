import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1, type TestD1 } from "../../__tests__/helpers/d1Sqlite";
import {
    resolveGaugeKeys, lookupGaugeKeys, upsertSlots, reduceToSlots, readSeries, readLatest,
    readHourlySums, readSyncState, readProviderSyncState, extendCoverage,
    markRepair, markProviderRepair, clearRepair, getMeta, setMeta,
    writeCoverage, recordBackfillFailure, clearBackfillFailures,
    countReadings, slotRanges, slotIndexOf, isStorableGaugeId, LATEST_SQL,
    SLOT_MS, SLOTS, RETENTION_MS, FUTURE_SKEW_MS,
    type GaugeDimension, type ObservedReading, type SlotRow,
} from "../flowStore";

// Hour-aligned so slot and hour expectations can be written against NOW.
const NOW = 1_780_002_000_000;
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

let db: TestD1;
beforeEach(() => { db = createTestD1(); });
afterEach(() => { db.close(); });

const dim = (gaugeId: string, over: Partial<GaugeDimension> = {}): GaugeDimension =>
    ({ gaugeId, provider: gaugeId.split(":")[0], ...over });

const row = (gaugeId: string, ts: number, over: Partial<SlotRow> = {}): SlotRow => ({
    gaugeId, ts, off: 0, cfs: null, ft: null, cms: null, m: null, temp_f: null, precip_in: null,
    approved: false, ...over,
});

async function keysFor(...ids: string[]) {
    return (await resolveGaugeKeys(db, ids.map(id => dim(id)))).keys;
}

const stored = () => db.query("SELECT slot, ts, off, cfs, ft FROM gauge_readings ORDER BY gauge_key, slot");

describe("gauge id filtering", () => {
    it("rejects dead prefixes and ids without a provider", () => {
        expect(isStorableGaugeId("streambeam:1")).toBe(false);
        expect(isStorableGaugeId("VIRTUAL:1")).toBe(false);
        expect(isStorableGaugeId("03451500")).toBe(false);
        expect(isStorableGaugeId("USGS:03451500")).toBe(true);
    });
});

describe("slotRanges", () => {
    it("returns one range inside the ring", () => {
        const [[a, b]] = slotRanges(NOW - HOUR, NOW);
        expect(b - a).toBe(4);
        expect(b).toBe(slotIndexOf(NOW));
    });

    it("splits a range that wraps past slot 0", () => {
        const base = Math.ceil(NOW / SLOT_MS / SLOTS) * SLOTS * SLOT_MS; // slot 0
        expect(slotRanges(base - 2 * SLOT_MS, base + SLOT_MS)).toEqual([[SLOTS - 2, SLOTS - 1], [0, 1]]);
    });

    it("covers the whole ring for spans of a ring or more", () => {
        expect(slotRanges(NOW - 40 * DAY, NOW)).toEqual([[0, SLOTS - 1]]);
    });
});

describe("reduceToSlots", () => {
    const r = (ts: number, over: Partial<ObservedReading> = {}): ObservedReading =>
        ({ gaugeId: "EC:1", ts, cms: 1, ...over });

    it("keeps the reading closest to the slot start", () => {
        const rows = reduceToSlots([r(NOW + 10 * MIN, { cms: 3 }), r(NOW + 5 * MIN, { cms: 2 }), r(NOW - 5 * MIN)], { now: NOW + HOUR });
        const slot = rows.find(x => x.ts === NOW)!;
        expect(slot).toMatchObject({ off: 300, cms: 2 });
        expect(rows).toHaveLength(2);
    });

    it("keeps a parameter reported at a different offset in the same slot", () => {
        const rows = reduceToSlots([
            { gaugeId: "USGS:1", ts: NOW + 7 * MIN, cfs: 100 },
            { gaugeId: "USGS:1", ts: NOW, ft: 3 },
            { gaugeId: "USGS:1", ts: NOW + 9 * MIN, cfs: 999, ft: 9 },
        ], { now: NOW + HOUR });
        expect(rows).toEqual([expect.objectContaining({ ts: NOW, off: 0, ft: 3, cfs: 100 })]);
    });

    it("merges parameters reported at the same timestamp", () => {
        const rows = reduceToSlots([r(NOW, { cms: 5, m: undefined }), r(NOW, { cms: undefined, m: 1.5 })], { now: NOW });
        expect(rows).toEqual([expect.objectContaining({ ts: NOW, cms: 5, m: 1.5 })]);
    });

    it("drops future, expired, empty and leading partial-slot readings", () => {
        const rows = reduceToSlots([
            r(NOW + FUTURE_SKEW_MS + MIN),
            r(NOW - RETENTION_MS - SLOT_MS),
            r(NOW, { cms: undefined }),
            r(NOW - 2 * HOUR + 7 * MIN),   // slot starts before the window
            r(NOW - HOUR),
        ], { now: NOW, windowStart: NOW - 2 * HOUR + 15 * MIN });
        expect(rows.map(x => x.ts)).toEqual([NOW - HOUR]);
    });
});

describe("upsertSlots (ring buffer)", () => {
    it("writes nothing when an identical batch is replayed", async () => {
        const keys = await keysFor("USGS:1", "USGS:2");
        const rows = Array.from({ length: 40 }, (_, i) => row(i % 2 ? "USGS:1" : "USGS:2", NOW - i * SLOT_MS, { cfs: 100 + i, ft: 2 }));
        expect(await upsertSlots(db, rows, keys)).toBe(40);
        expect(await upsertSlots(db, rows, keys)).toBe(0);
    });

    it("never lets an older generation overwrite a newer one", async () => {
        const keys = await keysFor("USGS:1");
        await upsertSlots(db, [row("USGS:1", NOW, { cfs: 10 })], keys);
        const stale = NOW - SLOTS * SLOT_MS; // same slot, previous lap
        expect(await upsertSlots(db, [row("USGS:1", stale, { cfs: 99 })], keys)).toBe(0);
        expect(stored()).toEqual([expect.objectContaining({ ts: NOW, cfs: 10 })]);
    });

    it("overwrites a slot on wrap without leaking old columns", async () => {
        const keys = await keysFor("USGS:1");
        const old = NOW - SLOTS * SLOT_MS;
        await upsertSlots(db, [row("USGS:1", old, { cfs: 10, ft: 3 })], keys);
        expect(await upsertSlots(db, [row("USGS:1", NOW, { cfs: 20 })], keys)).toBe(1);
        expect(stored()).toEqual([{ slot: slotIndexOf(NOW), ts: NOW, off: 0, cfs: 20, ft: null }]);
        expect(await countReadings(db)).toBe(1);
    });

    it("replaces a slot with a reading closer to its start, and ignores farther ones", async () => {
        const keys = await keysFor("USGS:1");
        await upsertSlots(db, [row("USGS:1", NOW, { off: 300, cfs: 5 })], keys);
        expect(await upsertSlots(db, [row("USGS:1", NOW, { off: 600, cfs: 6 })], keys)).toBe(0);
        expect(await upsertSlots(db, [row("USGS:1", NOW, { off: 0, cfs: 4 })], keys)).toBe(1);
        expect(stored()[0]).toMatchObject({ off: 0, cfs: 4 });
    });

    it("keeps parameters the closer reading lacks, and fills gaps from farther ones", async () => {
        const keys = await keysFor("USGS:1");
        await upsertSlots(db, [row("USGS:1", NOW, { off: 300, cfs: 100, ft: 3 })], keys);
        expect(await upsertSlots(db, [row("USGS:1", NOW, { off: 0, cfs: 101 })], keys)).toBe(1);
        expect(stored()[0]).toMatchObject({ off: 0, cfs: 101, ft: 3 });

        const other = await keysFor("USGS:2");
        await upsertSlots(db, [row("USGS:2", NOW, { off: 0, ft: 3 })], other);
        expect(await upsertSlots(db, [row("USGS:2", NOW, { off: 420, cfs: 100, ft: 9 })], other)).toBe(1);
        expect(await upsertSlots(db, [row("USGS:2", NOW, { off: 420, cfs: 100, ft: 9 })], other)).toBe(0);
        expect(stored()[1]).toMatchObject({ off: 0, cfs: 100, ft: 3 });
    });

    it("merges a partial revision of the same reading and writes once", async () => {
        const keys = await keysFor("USGS:1");
        await upsertSlots(db, [row("USGS:1", NOW, { cfs: 5, ft: 1 })], keys);
        expect(await upsertSlots(db, [row("USGS:1", NOW, { cfs: 7 })], keys)).toBe(1);
        expect(stored()[0]).toMatchObject({ cfs: 7, ft: 1 });
        expect(await upsertSlots(db, [row("USGS:1", NOW, { cfs: 7 })], keys)).toBe(0);
    });

    it("writes when approval flips, and not when it would flip back", async () => {
        const keys = await keysFor("USGS:1");
        await upsertSlots(db, [row("USGS:1", NOW, { cfs: 5 })], keys);
        expect(await upsertSlots(db, [row("USGS:1", NOW, { cfs: 5, approved: true })], keys)).toBe(1);
        expect(await upsertSlots(db, [row("USGS:1", NOW, { cfs: 5, approved: false })], keys)).toBe(0);
    });

    it("skips gauges without a key", async () => {
        expect(await upsertSlots(db, [row("USGS:404", NOW, { cfs: 1 })], new Map())).toBe(0);
    });

    it("stays within D1's 100-parameter limit for a large batch", async () => {
        const ids = Array.from({ length: 500 }, (_, i) => `USGS:${i}`);
        const keys = await keysFor(...ids);
        const rows = ids.flatMap(id => Array.from({ length: 24 }, (_, i) => row(id, NOW - i * SLOT_MS, { cfs: i })));
        expect(await upsertSlots(db, rows, keys)).toBe(12_000);
    });
});

describe("reads", () => {
    it("exclude slots older than the retention horizon", async () => {
        const keys = await keysFor("USGS:1");
        const expired = NOW - RETENTION_MS - DAY; // still physically in the ring
        await upsertSlots(db, [row("USGS:1", expired, { cfs: 1 }), row("USGS:1", NOW, { cfs: 2 })], keys);
        expect(await countReadings(db)).toBe(2);

        const series = await readSeries(db, ["USGS:1"], NOW - 40 * DAY, NOW, NOW);
        expect(series["USGS:1"].readings.map(r => r.cfs)).toEqual([2]);

        const sums = await readHourlySums(db, ["USGS:1"], expired - HOUR, NOW + HOUR, NOW);
        expect([...sums.get("USGS:1")!.keys()]).toEqual([NOW]);
    });

    it("readSeries returns reading times, rounded to 5 minutes, in order across a wrap", async () => {
        const keys = await keysFor("USGS:1");
        const zero = Math.ceil(NOW / SLOT_MS / SLOTS) * SLOTS * SLOT_MS;
        await upsertSlots(db, [
            row("USGS:1", zero, { cfs: 3 }),
            row("USGS:1", zero - SLOT_MS, { off: 240, cfs: 2 }),
            row("USGS:1", zero - 2 * SLOT_MS, { cfs: 1 }),
        ], keys);
        const series = await readSeries(db, ["USGS:1"], zero - HOUR, zero, zero);
        expect(series["USGS:1"].readings).toEqual([
            { dateTime: zero - 2 * SLOT_MS, cfs: 1 },
            { dateTime: zero - SLOT_MS + 300_000, cfs: 2 },
            { dateTime: zero, cfs: 3 },
        ]);
    });

    it("readLatest returns the newest reading per gauge within the window", async () => {
        const keys = await keysFor("USGS:1", "USGS:2", "USGS:3");
        await upsertSlots(db, [
            row("USGS:1", NOW - SLOT_MS, { cfs: 1 }), row("USGS:1", NOW, { cfs: 2 }),
            row("USGS:2", NOW - 2 * HOUR, { cfs: 3 }),
            row("USGS:3", NOW - 13 * HOUR, { cfs: 4 }),
        ], keys);
        const latest = await readLatest(db, 12 * HOUR, NOW);
        expect(latest).toEqual({
            "USGS:1": { dateTime: NOW, cfs: 2 },
            "USGS:2": { dateTime: NOW - 2 * HOUR, cfs: 3 },
        });
    });

    it("readHourlySums sums per left-labelled hour and ignores sentinels", async () => {
        const keys = await keysFor("USGS:1");
        await upsertSlots(db, [
            row("USGS:1", NOW - HOUR, { cfs: 10, ft: 1 }),
            row("USGS:1", NOW - HOUR + SLOT_MS, { cfs: 20 }),
            row("USGS:1", NOW - HOUR + 2 * SLOT_MS, { cfs: -999999, ft: 3 }),
            row("USGS:1", NOW, { cfs: 5 }),
        ], keys);
        const sums = (await readHourlySums(db, ["USGS:1"], NOW - HOUR, NOW + HOUR, NOW)).get("USGS:1")!;
        expect(sums.get(NOW - HOUR)).toEqual({ cfsSum: 30, cfsN: 2, ftSum: 4, ftN: 2 });
        expect(sums.get(NOW)).toEqual({ cfsSum: 5, cfsN: 1, ftSum: 0, ftN: 0 });
    });
});

describe("query plans", () => {
    const plan = (sql: string, ...params: unknown[]) =>
        db.query(`EXPLAIN QUERY PLAN ${sql}`, ...params).map((r: any) => r.detail as string);

    it("latest-per-gauge seeks readings by primary key", () => {
        const details = plan(LATEST_SQL, 0, 10, 0);
        expect(details.some(d => /SEARCH r USING PRIMARY KEY/.test(d))).toBe(true);
        expect(details.some(d => /^SCAN r\b/.test(d))).toBe(false);
    });
});

describe("resolveGaugeKeys", () => {
    it("assigns stable keys and writes nothing when metadata is unchanged", async () => {
        const dims = [dim("USGS:1", { name: "A", lat: 1.5 }), dim("EC:05BB001", { name: "B" })];
        const first = await resolveGaugeKeys(db, dims);
        expect(first.written).toBe(2);
        const again = await resolveGaugeKeys(db, dims);
        expect(again.written).toBe(0);
        expect([...again.keys]).toEqual([...first.keys]);
    });

    it("writes only on a real change and never blanks with null", async () => {
        await resolveGaugeKeys(db, [dim("USGS:1", { name: "A" })]);
        expect((await resolveGaugeKeys(db, [dim("USGS:1")])).written).toBe(0);
        expect((await resolveGaugeKeys(db, [dim("USGS:1", { name: "B" })])).written).toBe(1);
        expect(db.query("SELECT name FROM gauges")).toEqual([{ name: "B" }]);
    });

    it("drops dead prefixes and normalizes casing", async () => {
        const { keys } = await resolveGaugeKeys(db, [dim("usgs:1"), dim("virtual:x")]);
        expect([...keys.keys()]).toEqual(["USGS:1"]);
        expect((await lookupGaugeKeys(db, ["USGS:1", "USGS:2"])).size).toBe(1);
    });
});

describe("sync state", () => {
    it("extendCoverage only moves backward and skips no-ops", async () => {
        const keys = await keysFor("USGS:1");
        const k = keys.get("USGS:1")!;
        expect(await extendCoverage(db, [k], NOW - DAY)).toBe(1);
        expect(await extendCoverage(db, [k], NOW)).toBe(0);
        expect(await extendCoverage(db, [k], NOW - DAY)).toBe(0);
        expect(await extendCoverage(db, [k], NOW - 2 * DAY)).toBe(1);
        expect((await readSyncState(db, ["USGS:1"])).get("USGS:1")!.coverageStart).toBe(NOW - 2 * DAY);
    });

    it("writeCoverage sets exact values and skips unchanged rows", async () => {
        const keys = await keysFor("EC:1", "EC:2");
        const [k1, k2] = [keys.get("EC:1")!, keys.get("EC:2")!];
        const updates = [
            { gaugeKey: k1, coverageStart: NOW - DAY, repairFrom: null },
            { gaugeKey: k2, coverageStart: NOW - HOUR, repairFrom: NOW - MIN },
        ];
        expect(await writeCoverage(db, updates)).toBe(2);
        expect(await writeCoverage(db, updates)).toBe(0);
        expect(await writeCoverage(db, [{ gaugeKey: k2, coverageStart: NOW - HOUR, repairFrom: null }])).toBe(1);
        const state = await readProviderSyncState(db, "EC");
        expect(state.get("EC:2")).toMatchObject({ coverageStart: NOW - HOUR, repairFrom: null });
    });

    it("markRepair keeps the earliest point and clearRepair needs covering", async () => {
        const keys = await keysFor("USGS:1", "USGS:2");
        const [k1, k2] = [keys.get("USGS:1")!, keys.get("USGS:2")!];
        expect(await markRepair(db, [k1], NOW - HOUR)).toBe(1);
        expect(await markRepair(db, [k1], NOW)).toBe(0);
        expect(await markProviderRepair(db, "USGS", NOW - 2 * HOUR)).toBe(2);
        expect(await clearRepair(db, [k1, k2], NOW - HOUR)).toBe(0);
        expect(await clearRepair(db, [k1], NOW - 3 * HOUR)).toBe(1);
        const state = await readProviderSyncState(db, "USGS");
        expect(state.get("USGS:1")!.repairFrom).toBeNull();
        expect(state.get("USGS:2")!.repairFrom).toBe(NOW - 2 * HOUR);
    });

    it("backs off backfill failures exponentially and clears them once", async () => {
        const keys = await keysFor("USGS:1");
        const k = keys.get("USGS:1")!;
        await recordBackfillFailure(db, k, NOW);
        await recordBackfillFailure(db, k, NOW);
        const s = (await readProviderSyncState(db, "USGS")).get("USGS:1")!;
        expect(s).toMatchObject({ failCount: 2, retryAt: NOW + 4 * 15 * MIN });
        expect(await clearBackfillFailures(db, [k])).toBe(1);
        expect(await clearBackfillFailures(db, [k])).toBe(0);
    });

    it("setMeta writes only when the value changes", async () => {
        expect(await getMeta(db, "x")).toBeNull();
        expect(await setMeta(db, "x", 5)).toBe(1);
        expect(await setMeta(db, "x", 5)).toBe(0);
        expect(await setMeta(db, "x", 6)).toBe(1);
        expect(await getMeta(db, "x")).toBe(6);
    });
});
