import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestD1, type TestD1 } from "../../__tests__/helpers/d1Sqlite";
import {
    resolveGaugeKeys,
    lookupGaugeKeys,
    upsertReadings,
    readSeries,
    readLatestAll,
    readSyncState,
    writeSyncState,
    pruneSlice,
    currentPruneSlice,
    refreshObsCounts,
    findGapGauges,
    countReadings,
    LATEST_ALL_SQL,
    isStorableGaugeId,
    snapTimestamp,
    RETENTION_MS,
    PRUNE_SLICES,
    type GaugeDimension,
    type StoredReading,
} from "../flowStore";

// Fixed clock, deliberately aligned to a 5-minute boundary so expectations can
// be written against NOW directly without snapTimestamp shifting them.
const NOW = 1_779_999_900_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

let db: TestD1;

const dim = (gaugeId: string, over: Partial<GaugeDimension> = {}): GaugeDimension => ({
    gaugeId,
    provider: gaugeId.split(":")[0],
    tier: "registry",
    ...over,
});

beforeEach(() => { db = createTestD1(); });
afterEach(() => { db.close(); });

describe("gauge id filtering", () => {
    it("rejects removed streambeam and virtual prefixes in either casing", () => {
        expect(isStorableGaugeId("streambeam:1")).toBe(false);
        expect(isStorableGaugeId("virtual:1")).toBe(false);
        expect(isStorableGaugeId("VIRTUAL:1")).toBe(false);
        expect(isStorableGaugeId("USGS:03451500")).toBe(true);
    });

    it("rejects ids without a provider prefix", () => {
        expect(isStorableGaugeId("03451500")).toBe(false);
        expect(isStorableGaugeId("")).toBe(false);
    });
});

describe("resolveGaugeKeys", () => {
    it("assigns stable keys and normalizes casing to one row", async () => {
        const first = await resolveGaugeKeys(db, [dim("USGS:03451500"), dim("EC:05BB001")]);
        expect(first.size).toBe(2);

        // 'usgs:' is the same gauge as 'USGS:' — must not create a second row.
        const second = await resolveGaugeKeys(db, [dim("usgs:03451500")]);
        expect(second.get("USGS:03451500")).toBe(first.get("USGS:03451500"));
        expect(db.query("SELECT COUNT(*) AS n FROM gauges")[0].n).toBe(2);
    });

    it("drops dead prefixes rather than storing them", async () => {
        const keys = await resolveGaugeKeys(db, [
            dim("USGS:1"), dim("streambeam:9"), dim("VIRTUAL:7"),
        ]);
        expect(keys.size).toBe(1);
        expect(db.query("SELECT COUNT(*) AS n FROM gauges")[0].n).toBe(1);
    });

    it("never blanks existing metadata with a null from a later poll", async () => {
        await resolveGaugeKeys(db, [dim("USGS:1", { name: "Nantahala", state: "NC", lat: 35.3 })]);
        await resolveGaugeKeys(db, [dim("USGS:1")]); // reading-only poll, no metadata

        const row = db.query("SELECT name, state, lat FROM gauges WHERE gauge_id='USGS:1'")[0];
        expect(row.name).toBe("Nantahala");
        expect(row.state).toBe("NC");
        expect(row.lat).toBeCloseTo(35.3);
    });

    it("promotes registry to linked but never demotes back", async () => {
        await resolveGaugeKeys(db, [dim("USGS:1", { tier: "registry" })]);
        await resolveGaugeKeys(db, [dim("USGS:1", { tier: "linked" })]);
        expect(db.query("SELECT tier FROM gauges WHERE gauge_id='USGS:1'")[0].tier).toBe("linked");

        await resolveGaugeKeys(db, [dim("USGS:1", { tier: "registry" })]);
        expect(db.query("SELECT tier FROM gauges WHERE gauge_id='USGS:1'")[0].tier).toBe("linked");
    });
});

describe("upsertReadings", () => {
    const seed = async (ids: string[]) => resolveGaugeKeys(db, ids.map(i => dim(i)));

    it("stores readings and is idempotent on replay", async () => {
        const keys = await seed(["USGS:1"]);
        const readings: StoredReading[] = [
            { gaugeId: "USGS:1", ts: NOW - HOUR, cfs: 100, ft: 2.1 },
            { gaugeId: "USGS:1", ts: NOW, cfs: 120, ft: 2.4 },
        ];

        expect(await upsertReadings(db, readings, keys, NOW)).toBe(2);
        expect(await countReadings(db)).toBe(2);

        await upsertReadings(db, readings, keys, NOW);
        expect(await countReadings(db)).toBe(2);
    });

    it("overwrites a revised value at an existing timestamp", async () => {
        const keys = await seed(["USGS:1"]);
        await upsertReadings(db, [{ gaugeId: "USGS:1", ts: NOW, cfs: 100, srcModified: 1 }], keys, NOW);
        await upsertReadings(db, [{ gaugeId: "USGS:1", ts: NOW, cfs: 875, srcModified: 2 }], keys, NOW);

        const row = db.query("SELECT cfs, src_modified FROM gauge_readings")[0];
        expect(row.cfs).toBe(875);
        expect(row.src_modified).toBe(2);
        expect(await countReadings(db)).toBe(1);
    });

    it("merges partial parameter updates instead of nulling siblings", async () => {
        // USGS returns 00060 and 00065 as separate features; a later batch
        // carrying only temperature must not erase the flow already stored.
        const keys = await seed(["USGS:1"]);
        await upsertReadings(db, [{ gaugeId: "USGS:1", ts: NOW, cfs: 100, ft: 2.0 }], keys, NOW);
        await upsertReadings(db, [{ gaugeId: "USGS:1", ts: NOW, temp_f: 54.2 }], keys, NOW);

        const row = db.query("SELECT cfs, ft, temp_f FROM gauge_readings")[0];
        expect(row.cfs).toBe(100);
        expect(row.ft).toBe(2.0);
        expect(row.temp_f).toBeCloseTo(54.2);
    });

    it("snaps timestamps to 5-minute buckets so a gauge's parameters collide", async () => {
        // USGS reports 00060 and 00065 as separate features whose timestamps
        // can differ by a minute or two; they must land in one reading.
        const keys = await seed(["USGS:1"]);
        await upsertReadings(db, [
            { gaugeId: "USGS:1", ts: NOW, cfs: 1 },
            { gaugeId: "USGS:1", ts: NOW + 120_000, ft: 2 },
        ], keys, NOW);

        expect(await countReadings(db)).toBe(1);
        expect(snapTimestamp(NOW + 120_000)).toBe(NOW);

        const row = db.query("SELECT cfs, ft FROM gauge_readings")[0];
        expect(row.cfs).toBe(1);
        expect(row.ft).toBe(2);

        // Beyond half a bucket it is genuinely a different observation.
        expect(snapTimestamp(NOW + 180_000)).toBe(NOW + SNAP);
    });

    it("drops readings beyond the retention horizon", async () => {
        const keys = await seed(["USGS:1"]);
        const stored = await upsertReadings(db, [
            { gaugeId: "USGS:1", ts: NOW - RETENTION_MS - DAY, cfs: 1 },
            { gaugeId: "USGS:1", ts: NOW - DAY, cfs: 2 },
        ], keys, NOW);

        expect(stored).toBe(1);
        expect(await countReadings(db)).toBe(1);
    });

    it("drops readings for gauges that have no dimension row", async () => {
        const keys = await seed(["USGS:1"]);
        const stored = await upsertReadings(db, [{ gaugeId: "USGS:999", ts: NOW, cfs: 5 }], keys, NOW);
        expect(stored).toBe(0);
        expect(await countReadings(db)).toBe(0);
    });

    it("drops rows carrying no measurement at all", async () => {
        const keys = await seed(["USGS:1"]);
        expect(await upsertReadings(db, [{ gaugeId: "USGS:1", ts: NOW }], keys, NOW)).toBe(0);
    });

    it("stays within D1's 100-bound-parameter limit for a 15k-reading cycle", async () => {
        // The harness throws if any statement binds >100 params, so simply
        // completing this proves the json_each batching holds at real scale.
        const ids = Array.from({ length: 500 }, (_, i) => `USGS:${i}`);
        const keys = await seed(ids);

        const readings: StoredReading[] = [];
        for (const id of ids) {
            for (let t = 0; t < 30; t++) {
                readings.push({ gaugeId: id, ts: NOW - t * SNAP, cfs: 100 + t, ft: 2 + t / 100 });
            }
        }
        expect(readings.length).toBe(15_000);

        expect(await upsertReadings(db, readings, keys, NOW)).toBe(15_000);
        expect(await countReadings(db)).toBe(15_000);
    });

    it("emits batches sorted by (gauge_key, ts)", async () => {
        // Sorted insertion is what keeps the clustered B-tree from thrashing.
        const ids = ["USGS:3", "USGS:1", "USGS:2"];
        const keys = await seed(ids);

        const captured: string[] = [];
        const spy = {
            ...db,
            prepare(sql: string) {
                const stmt = db.prepare(sql);
                if (!sql.includes("INSERT INTO gauge_readings")) return stmt;
                return {
                    bind: (...args: unknown[]) => {
                        captured.push(args[0] as string);
                        return (stmt as any).bind(...args);
                    },
                } as any;
            },
        } as unknown as TestD1;

        await upsertReadings(spy, [
            { gaugeId: "USGS:2", ts: NOW, cfs: 1 },
            { gaugeId: "USGS:1", ts: NOW, cfs: 1 },
            { gaugeId: "USGS:3", ts: NOW - SNAP, cfs: 1 },
            { gaugeId: "USGS:1", ts: NOW - SNAP, cfs: 1 },
        ], keys, NOW);

        const rows = JSON.parse(captured[0]) as Array<{ k: number; t: number }>;
        const sorted = [...rows].sort((a, b) => (a.k - b.k) || (a.t - b.t));
        expect(rows).toEqual(sorted);
    });
});

const SNAP = 300_000;

describe("readSeries", () => {
    it("returns the live-provider payload shape with readings ascending", async () => {
        const keys = await resolveGaugeKeys(db, [
            dim("USGS:03451500", { name: "Hominy Creek", section: "Lower", state: "NC", lat: 35.5, lon: -82.6 }),
        ]);
        await upsertReadings(db, [
            { gaugeId: "USGS:03451500", ts: NOW, cfs: 300 },
            { gaugeId: "USGS:03451500", ts: NOW - 2 * SNAP, cfs: 100 },
            { gaugeId: "USGS:03451500", ts: NOW - SNAP, cfs: 200 },
        ], keys, NOW);

        const out = await readSeries(db, ["USGS:03451500"], NOW - DAY);
        const hist = out["USGS:03451500"];

        expect(hist.id).toBe("03451500");
        expect(hist.name).toBe("Hominy Creek");
        expect(hist.section).toBe("Lower");
        expect(hist.state).toBe("NC");
        expect(hist.lat).toBeCloseTo(35.5);
        expect(hist.readings.map(r => r.cfs)).toEqual([100, 200, 300]);
        expect(hist.readings.map(r => r.dateTime)).toEqual([NOW - 2 * SNAP, NOW - SNAP, NOW]);
    });

    it("honors the start bound so ?since= returns only the delta", async () => {
        const keys = await resolveGaugeKeys(db, [dim("USGS:1")]);
        await upsertReadings(db, [
            { gaugeId: "USGS:1", ts: NOW - 3 * HOUR, cfs: 1 },
            { gaugeId: "USGS:1", ts: NOW - 2 * HOUR, cfs: 2 },
            { gaugeId: "USGS:1", ts: NOW, cfs: 3 },
        ], keys, NOW);

        const delta = await readSeries(db, ["USGS:1"], NOW - HOUR);
        expect(delta["USGS:1"].readings.map(r => r.cfs)).toEqual([3]);
    });

    it("omits unknown gauges so the caller can fall back to a live fetch", async () => {
        const keys = await resolveGaugeKeys(db, [dim("USGS:1")]);
        await upsertReadings(db, [{ gaugeId: "USGS:1", ts: NOW, cfs: 1 }], keys, NOW);

        const out = await readSeries(db, ["USGS:1", "UK:9999"], NOW - DAY);
        expect(Object.keys(out)).toEqual(["USGS:1"]);
    });

    it("omits null measurements rather than emitting undefined keys", async () => {
        const keys = await resolveGaugeKeys(db, [dim("EC:05BB001")]);
        await upsertReadings(db, [{ gaugeId: "EC:05BB001", ts: NOW, cms: 12.5, m: 1.2 }], keys, NOW);

        const reading = (await readSeries(db, ["EC:05BB001"], NOW - DAY))["EC:05BB001"].readings[0];
        expect(reading).toEqual({ dateTime: NOW, cms: 12.5, m: 1.2 });
        expect("cfs" in reading).toBe(false);
    });
});

describe("readLatestAll", () => {
    it("returns exactly the newest reading per gauge", async () => {
        const keys = await resolveGaugeKeys(db, [dim("USGS:1"), dim("USGS:2")]);
        await upsertReadings(db, [
            { gaugeId: "USGS:1", ts: NOW - HOUR, cfs: 10 },
            { gaugeId: "USGS:1", ts: NOW, cfs: 99 },
            { gaugeId: "USGS:2", ts: NOW - 2 * HOUR, cfs: 5 },
        ], keys, NOW);

        const latest = await readLatestAll(db);
        expect(latest["USGS:1"].cfs).toBe(99);
        expect(latest["USGS:1"].dateTime).toBe(NOW);
        expect(latest["USGS:2"].cfs).toBe(5);
    });

    it("omits gauges that have no readings yet", async () => {
        await resolveGaugeKeys(db, [dim("USGS:1")]);
        expect(await readLatestAll(db)).toEqual({});
    });
});

describe("query plans", () => {
    const planOf = (sql: string, ...params: unknown[]): string[] =>
        db.query<{ detail: string }>("EXPLAIN QUERY PLAN " + sql, ...params).map(r => r.detail);

    it("never full-scans gauge_readings when projecting latest-per-gauge", async () => {
        // This runs every 15 minutes over the whole fact table. Without the
        // CROSS JOIN pinning the join order, SQLite drives from gauge_readings
        // and scans it: 166ms vs 2.5ms at 500k rows, and it grows with total
        // readings rather than gauge count. At ~40M rows that is ~11s against
        // D1's 30-second query limit.
        await resolveGaugeKeys(db, [dim("USGS:1")]);
        const plan = planOf(LATEST_ALL_SQL);

        expect(plan.some(d => /SEARCH r USING PRIMARY KEY/.test(d))).toBe(true);
        expect(plan.some(d => /^SCAN r\b/.test(d))).toBe(false);
    });

    it("seeks rather than scans when reading one gauge's window", async () => {
        await resolveGaugeKeys(db, [dim("USGS:1")]);
        const plan = planOf(`
            SELECT g.gauge_id AS gauge_id, r.ts, r.cfs
              FROM gauges g
              JOIN json_each(?1) j ON g.gauge_id = j.value
              JOIN gauge_readings r ON r.gauge_key = g.gauge_key
             WHERE r.ts >= ?2 AND r.ts <= ?3
             ORDER BY g.gauge_key, r.ts
        `, JSON.stringify(["USGS:1"]), 0, NOW);

        expect(plan.some(d => /SEARCH r USING PRIMARY KEY \(gauge_key=\? AND ts>\? AND ts<\?\)/.test(d))).toBe(true);
    });

    it("prunes by primary key, which is why no index on ts is needed", async () => {
        await resolveGaugeKeys(db, [dim("USGS:1")]);
        const plan = planOf(`
            DELETE FROM gauge_readings
             WHERE gauge_key IN (SELECT gauge_key FROM gauges WHERE gauge_key % ?1 = ?2)
               AND ts < ?3
        `, PRUNE_SLICES, 0, NOW);

        expect(plan.some(d => /SEARCH gauge_readings USING PRIMARY KEY/.test(d))).toBe(true);
        expect(plan.some(d => /^SCAN gauge_readings\b/.test(d))).toBe(false);
    });
});

describe("sync state", () => {
    it("preserves fields omitted from a partial update", async () => {
        const keys = await resolveGaugeKeys(db, [dim("USGS:1")]);

        await writeSyncState(db, [{ gaugeId: "USGS:1", cursorModified: 5000, lastObsTs: NOW }], keys);
        await writeSyncState(db, [{ gaugeId: "USGS:1", obsCount24h: 90 }], keys);

        const state = (await readSyncState(db, ["USGS:1"])).get("USGS:1")!;
        expect(state.cursorModified).toBe(5000);
        expect(state.lastObsTs).toBe(NOW);
        expect(state.obsCount24h).toBe(90);
    });

    it("moves last_obs_ts forward only, and coverage_start backward only", async () => {
        const keys = await resolveGaugeKeys(db, [dim("USGS:1")]);

        await writeSyncState(db, [{ gaugeId: "USGS:1", lastObsTs: NOW, coverageStart: NOW - DAY }], keys);
        // A late/out-of-order batch must not rewind progress.
        await writeSyncState(db, [{ gaugeId: "USGS:1", lastObsTs: NOW - HOUR, coverageStart: NOW }], keys);

        const state = (await readSyncState(db, ["USGS:1"])).get("USGS:1")!;
        expect(state.lastObsTs).toBe(NOW);
        expect(state.coverageStart).toBe(NOW - DAY);

        // Backfill reaching further into the past does move coverage_start.
        await writeSyncState(db, [{ gaugeId: "USGS:1", coverageStart: NOW - 10 * DAY }], keys);
        expect((await readSyncState(db, ["USGS:1"])).get("USGS:1")!.coverageStart).toBe(NOW - 10 * DAY);
    });

    it("clears a stale error on a successful cycle", async () => {
        const keys = await resolveGaugeKeys(db, [dim("USGS:1")]);
        await writeSyncState(db, [{ gaugeId: "USGS:1", failCount: 3, lastError: "timeout" }], keys);
        expect(db.query("SELECT last_error FROM gauge_sync_state")[0].last_error).toBe("timeout");

        await writeSyncState(db, [{ gaugeId: "USGS:1", failCount: 0, lastError: null, lastSuccessAt: NOW }], keys);
        const row = db.query("SELECT last_error, fail_count FROM gauge_sync_state")[0];
        expect(row.last_error).toBe(null);
        expect(row.fail_count).toBe(0);
    });
});

describe("pruning", () => {
    it("deletes only beyond the horizon, and only within its own slice", async () => {
        // Two gauges whose keys fall in different slices.
        const ids = Array.from({ length: PRUNE_SLICES + 1 }, (_, i) => `USGS:${i}`);
        const keys = await resolveGaugeKeys(db, ids.map(i => dim(i)));

        const first = ids[0];
        const other = ids[1];
        const readings: StoredReading[] = [];
        for (const id of [first, other]) {
            readings.push({ gaugeId: id, ts: NOW - RETENTION_MS + HOUR, cfs: 1 }); // inside
            readings.push({ gaugeId: id, ts: NOW, cfs: 2 });                        // inside
        }
        await upsertReadings(db, readings, keys, NOW);

        // Age the store forward so the older rows fall out of retention.
        const later = NOW + 2 * HOUR;
        const firstKey = keys.get(first)!;
        const deleted = await pruneSlice(db, firstKey % PRUNE_SLICES, later);

        expect(deleted).toBe(1);
        const remainingFirst = db.query(
            "SELECT COUNT(*) AS n FROM gauge_readings WHERE gauge_key = ?", firstKey)[0].n;
        const remainingOther = db.query(
            "SELECT COUNT(*) AS n FROM gauge_readings WHERE gauge_key = ?", keys.get(other)!)[0].n;

        expect(remainingFirst).toBe(1);   // pruned
        expect(remainingOther).toBe(2);   // different slice, untouched
    });

    it("covers every gauge exactly once per full rotation", async () => {
        const ids = Array.from({ length: 200 }, (_, i) => `USGS:${i}`);
        const keys = await resolveGaugeKeys(db, ids.map(i => dim(i)));

        const covered = new Set<number>();
        for (let slice = 0; slice < PRUNE_SLICES; slice++) {
            for (const key of keys.values()) {
                if (key % PRUNE_SLICES === slice) covered.add(key);
            }
        }
        expect(covered.size).toBe(ids.length);
    });

    it("advances the slice with wall-clock time and wraps", () => {
        const slice = currentPruneSlice(NOW);
        expect(slice).toBeGreaterThanOrEqual(0);
        expect(slice).toBeLessThan(PRUNE_SLICES);
        expect(currentPruneSlice(NOW + 15 * 60 * 1000)).toBe((slice + 1) % PRUNE_SLICES);
        expect(currentPruneSlice(NOW + PRUNE_SLICES * 15 * 60 * 1000)).toBe(slice);
    });
});

describe("gap detection", () => {
    it("flags gauges with depressed 24h counts and leaves healthy ones alone", async () => {
        const keys = await resolveGaugeKeys(db, [dim("USGS:healthy"), dim("USGS:gappy")]);

        const readings: StoredReading[] = [];
        for (let i = 0; i < 90; i++) {
            readings.push({ gaugeId: "USGS:healthy", ts: NOW - i * SNAP * 3, cfs: 1 });
        }
        for (let i = 0; i < 5; i++) {
            readings.push({ gaugeId: "USGS:gappy", ts: NOW - i * SNAP * 3, cfs: 1 });
        }
        await upsertReadings(db, readings, keys, NOW);
        await refreshObsCounts(db, NOW + SNAP);

        const gappy = await findGapGauges(db, 50, 10);
        expect(gappy.map(g => g.gaugeId)).toEqual(["USGS:gappy"]);
        expect(gappy[0].provider).toBe("USGS");
    });

    it("respects the limit so a bad day cannot queue unbounded repair work", async () => {
        const ids = Array.from({ length: 40 }, (_, i) => `USGS:${i}`);
        const keys = await resolveGaugeKeys(db, ids.map(i => dim(i)));
        await upsertReadings(db, ids.map(id => ({ gaugeId: id, ts: NOW, cfs: 1 })), keys, NOW);
        await refreshObsCounts(db, NOW);

        expect((await findGapGauges(db, 50, 10)).length).toBe(10);
    });
});

describe("lookupGaugeKeys", () => {
    it("returns only known gauges and does not create rows", async () => {
        await resolveGaugeKeys(db, [dim("USGS:1")]);
        const keys = await lookupGaugeKeys(db, ["USGS:1", "USGS:2"]);

        expect([...keys.keys()]).toEqual(["USGS:1"]);
        expect(db.query("SELECT COUNT(*) AS n FROM gauges")[0].n).toBe(1);
    });
});
