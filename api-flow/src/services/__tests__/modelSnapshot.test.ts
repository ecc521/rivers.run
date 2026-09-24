import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { gunzipSync } from "node:zlib";
import { createTestD1, type TestD1 } from "../../__tests__/helpers/d1Sqlite";
import { resolveGaugeKeys, upsertSlots } from "../flowStore";
import { buildUsgsHourlySnapshot, writeUsgsHourlySnapshot, round, SNAPSHOT_HOURS, SNAPSHOT_KEY } from "../modelSnapshot";

const HOUR = 3_600_000;
const SLOT = 900_000;
const NOW = 1_780_002_000_000 + 20 * 60_000; // 20 minutes into an hour
const CURRENT_HOUR = NOW - 20 * 60_000;

let db: TestD1;
beforeEach(() => { db = createTestD1(); });
afterEach(() => { db.close(); });

const row = (gaugeId: string, ts: number, over: { cfs?: number; ft?: number } = {}) => ({
    gaugeId, ts, off: 0, cfs: over.cfs ?? null, ft: over.ft ?? null, cms: null, m: null,
    temp_f: null, precip_in: null, approved: false,
});

describe("buildUsgsHourlySnapshot", () => {
    it("left-labels hourly means with counts and nulls where empty", async () => {
        const { keys } = await resolveGaugeKeys(db, [{ gaugeId: "USGS:1", provider: "USGS" }, { gaugeId: "USGS:2", provider: "USGS" }]);
        const h = CURRENT_HOUR - HOUR;
        await upsertSlots(db, [
            row("USGS:1", h, { cfs: 10, ft: 1 }), row("USGS:1", h + SLOT, { cfs: 20, ft: 2 }),
            row("USGS:1", h + 2 * SLOT, { cfs: 30 }), row("USGS:1", h + 3 * SLOT, { cfs: 40 }),
            row("USGS:1", CURRENT_HOUR, { cfs: 5 }),
            row("USGS:1", CURRENT_HOUR - 200 * HOUR, { cfs: 999 }), // outside the 192h window
        ], keys);

        const snap = await buildUsgsHourlySnapshot(db, ["2", "1"], NOW);
        expect(snap.sites).toEqual(["1", "2"]);
        expect(snap.hours).toBe(SNAPSHOT_HOURS);
        expect(snap.start).toBe(CURRENT_HOUR - (SNAPSHOT_HOURS - 1) * HOUR);

        const last = SNAPSHOT_HOURS - 1;
        expect(snap.discharge_cfs[0][last - 1]).toBe(25);
        expect(snap.discharge_n[0][last - 1]).toBe(4);
        expect(snap.stage_ft[0][last - 1]).toBe(1.5);
        expect(snap.stage_n[0][last - 1]).toBe(2);
        expect(snap.discharge_cfs[0][last]).toBe(5);
        expect(snap.discharge_n[0][last]).toBe(1);
        expect(snap.discharge_cfs[0].filter(v => v !== null)).toHaveLength(2);
        expect(snap.discharge_cfs[1].every(v => v === null)).toBe(true);
        expect(snap.discharge_n[1].every(v => v === 0)).toBe(true);
    });
});

describe("round", () => {
    it("keeps 5 significant figures at any magnitude", () => {
        expect(round(0.000123456)).toBe(0.00012346);
        expect(round(0.0123456)).toBe(0.012346);
        expect(round(12345.678)).toBe(12346);
        expect(round(1234567)).toBe(1234600);
        expect(round(-3.14159)).toBe(-3.1416);
        expect(round(0)).toBe(0);
    });

    it("keeps small-river means within 1e-4 in log1p space", () => {
        for (const v of [0.001, 0.0137, 0.5, 3.33333, 47.777777]) {
            expect(Math.abs(Math.log1p(round(v)) - Math.log1p(v))).toBeLessThan(1e-4);
        }
    });
});

describe("writeUsgsHourlySnapshot", () => {
    it("writes gzipped JSON to R2", async () => {
        let put: { key: string; body: ArrayBuffer; opts: any } | null = null;
        const env = { FLOW_STORAGE: { put: async (key: string, body: ArrayBuffer, opts: any) => { put = { key, body, opts }; } } } as any;
        const res = await writeUsgsHourlySnapshot(env, db, ["1"], NOW);
        expect(put!.key).toBe(SNAPSHOT_KEY);
        const parsed = JSON.parse(gunzipSync(Buffer.from(put!.body)).toString());
        expect(parsed.sites).toEqual(["1"]);
        expect(res.gzBytes).toBe(put!.body.byteLength);
        expect(put!.opts.httpMetadata.contentType).toBe("application/gzip");
    });
});
