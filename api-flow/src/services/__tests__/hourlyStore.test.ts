import { describe, it, expect, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTestD1, type TestD1 } from "../../__tests__/helpers/d1Sqlite";
import { upsertSlots, resolveGaugeKeys, readSeries, readLatest, hourSlotRanges, HOUR_MS, HOUR_SLOTS, SLOT_MS, type SlotRow } from "../flowStore";

const NOW = 1_780_002_000_000;
const row = (ts: number, values: Partial<SlotRow> = {}): SlotRow => ({
    gaugeId: "USGS:1", ts, off: 0, cfs: 10, ft: null, cms: null, m: null, temp_f: null, precip_in: null, ...values,
});
const databases: TestD1[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
async function setup() {
    const db = createTestD1();
    databases.push(db);
    const { keys } = await resolveGaugeKeys(db, [{ gaugeId: "USGS:1", provider: "USGS" }]);
    return { db, keys };
}

describe("hourly packed readings", () => {
    it("writes four observations and four revisions as one row each, and replays for zero writes", async () => {
        const { db, keys } = await setup();
        const readings = Array.from({ length: 4 }, (_, i) => row(NOW + i * SLOT_MS, { cfs: 10 + i, ft: 1 + i, off: i * 60 }));
        expect(await upsertSlots(db, readings, keys)).toBe(1);
        expect(db.query("SELECT * FROM gauge_reading_hours")).toHaveLength(1);
        const history = await readSeries(db, ["USGS:1"], NOW, NOW + HOUR_MS, NOW + HOUR_MS);
        expect(history["USGS:1"].readings).toHaveLength(4);
        expect(history["USGS:1"].readings.map(r => r.cfs)).toEqual([10, 11, 12, 13]);
        expect(db.query("SELECT off FROM gauge_reading_slots ORDER BY ts").map(r => r.off)).toEqual([0, 60, 120, 180]);
        const revised = readings.map(r => ({ ...r, cfs: r.cfs! + 5 }));
        expect(await upsertSlots(db, revised, keys)).toBe(1);
        expect(await upsertSlots(db, revised, keys)).toBe(0);
        expect(db.query("SELECT cfs, ft FROM gauge_reading_slots ORDER BY ts")).toEqual(
            [0, 1, 2, 3].map(i => ({ cfs: 15 + i, ft: 1 + i })));
    });

    it("merges pages, partial quarters and mixed offsets without losing neighboring values", async () => {
        const { db, keys } = await setup();
        await upsertSlots(db, [row(NOW, { ft: 2 }), row(NOW + SLOT_MS, { cfs: 20, off: 300 })], keys);
        expect(await upsertSlots(db, [row(NOW + SLOT_MS, { cfs: 21, off: 0 }), row(NOW + 2 * SLOT_MS, { cfs: 30 })], keys)).toBe(1);
        expect(await upsertSlots(db, [row(NOW, { cfs: 99, ft: 3, off: 600 })], keys)).toBe(0);
        expect(db.query("SELECT cfs, ft, off FROM gauge_reading_slots ORDER BY ts")).toEqual([
            { cfs: 10, ft: 2, off: 0 }, { cfs: 21, ft: null, off: 0 }, { cfs: 30, ft: null, off: 0 },
        ]);
        expect(await upsertSlots(db, [row(NOW, { cfs: 99, temp_f: 50, off: 600 })], keys)).toBe(1);
        expect(db.query("SELECT cfs,temp_f FROM gauge_reading_slots WHERE ts = ?", NOW)[0]).toEqual({ cfs: 10, temp_f: 50 });
    });

    it("clears old-lap quarters, rejects stale hours, and counts later updates to the same hour separately", async () => {
        const { db, keys } = await setup();
        const old = NOW - HOUR_MS * HOUR_SLOTS;
        await upsertSlots(db, [row(old), row(old + SLOT_MS, { ft: 2 })], keys);
        expect(await upsertSlots(db, [row(NOW + 2 * SLOT_MS, { cfs: 30 })], keys)).toBe(1);
        expect(db.query("SELECT ts,cfs,ft FROM gauge_reading_slots")).toEqual([{ ts: NOW + 2 * SLOT_MS, cfs: 30, ft: null }]);
        expect(await upsertSlots(db, [row(old + SLOT_MS)], keys)).toBe(0);
        expect(await upsertSlots(db, [row(NOW + 3 * SLOT_MS)], keys)).toBe(1);
    });

    it("keeps a numerically identical migrated JSON value a no-op", async () => {
        const { db, keys } = await setup();
        await upsertSlots(db, [row(NOW)], keys);
        db.exec_("UPDATE gauge_reading_hours SET q0 = '[0,10.0,null,null,null,null,null]'");
        expect(await upsertSlots(db, [row(NOW)], keys)).toBe(0);
    });

    it("does not serve future quarters and splits physical hour ranges across the ring", async () => {
        const { db, keys } = await setup();
        await upsertSlots(db, [row(NOW), row(NOW + SLOT_MS, { cfs: 20 })], keys);
        expect((await readLatest(db, HOUR_MS, NOW))["USGS:1"].cfs).toBe(10);
        const base = Math.ceil(NOW / HOUR_MS / HOUR_SLOTS) * HOUR_SLOTS * HOUR_MS;
        expect(hourSlotRanges(base - HOUR_MS, base + HOUR_MS)).toEqual([[HOUR_SLOTS - 1, HOUR_SLOTS - 1], [0, 1]]);
    });
});

describe("hourly migration", () => {
    it("preserves fields and gaps, selects the newest lap, and never overwrites new hourly data on replay", () => {
        const sql = new DatabaseSync(":memory:");
        try {
            sql.exec(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../migrations/2026-08-01_flow_history_store.sql"), "utf8"));
            const insert = sql.prepare("INSERT INTO gauge_readings (gauge_key,slot,ts,off,cfs,ft,temp_f,precip_in) VALUES (1,?,?,?,?,?,?,?)");
            const start = Math.floor(NOW / HOUR_MS) * HOUR_MS;
            const physical = Math.floor(start / SLOT_MS) % (HOUR_SLOTS * 4);
            insert.run(physical, start, 60, 1.5, null, 50, 0.2);
            insert.run(physical + 2, start + 2 * SLOT_MS, 0, 3, 2, null, null);
            insert.run(physical + 1, start + SLOT_MS - HOUR_SLOTS * HOUR_MS, 0, 99, 99, 99, 99);
            const old = start - 10 * 86400000;
            insert.run(Math.floor(old / SLOT_MS) % (HOUR_SLOTS * 4), old, 0, 42, null, null, null);
            sql.prepare("INSERT INTO sync_meta(k,v) VALUES ('hourly_seed_from',?)").run(NOW - 8 * 86400000);
            sql.exec(`INSERT INTO gauge_sync_state(gauge_key,coverage_start,repair_from) VALUES (1,${NOW - 30 * 86400000},${NOW - 10 * 86400000})`);
            const migration = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../migrations/2026-10-02_hourly_flow_history.sql"), "utf8");
            sql.exec(migration);
            expect(sql.prepare("SELECT ts,off,cfs,ft,temp_f,precip_in FROM gauge_reading_slots ORDER BY ts").all()).toEqual([
                { ts: start, off: 60, cfs: 1.5, ft: null, temp_f: 50, precip_in: 0.2 },
                { ts: start + 2 * SLOT_MS, off: 0, cfs: 3, ft: 2, temp_f: null, precip_in: null },
            ]);
            expect(sql.prepare("SELECT coverage_start,repair_from FROM gauge_sync_state").get()).toEqual({ coverage_start: NOW - 8 * 86400000, repair_from: NOW - 8 * 86400000 });
            expect(sql.prepare("SELECT COUNT(*) AS n FROM gauge_readings").get()).toEqual({ n: 4 });
            sql.exec("UPDATE gauge_reading_hours SET q0 = '[0,7,null,null,null,null,null]'");
            sql.exec(migration);
            expect(sql.prepare("SELECT cfs FROM gauge_reading_slots WHERE ts = ?").get(start)).toEqual({ cfs: 7 });
        } finally { sql.close(); }
    });
});
