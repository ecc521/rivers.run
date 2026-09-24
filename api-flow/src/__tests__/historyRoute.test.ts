import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestD1, type TestD1 } from "./helpers/d1Sqlite";
import { resolveGaugeKeys, upsertSlots, extendCoverage, markRepair, setMeta, slotStartOf } from "../services/flowStore";
import { ingestMetaKey } from "../services/flowSync";

const NOW = 1_780_002_000_000;
const SLOT = 900_000;
const DAY = 86_400_000;

let db: TestD1;
let app: any;
let liveCalls: string[];

// Stub the live providers at the module boundary so tests can see which source answered.
vi.mock("../services/usgs", async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        usgsProvider: {
            ...actual.usgsProvider,
            async getHistory(ids: string[], _s: number, _e?: number, forecast?: boolean) {
                liveCalls.push(`USGS:${ids.join(",")}${forecast ? ":forecast" : ""}`);
                return Object.fromEntries(ids.map(id => [id, { id, name: `Live ${id}`, readings: [{ dateTime: NOW, cfs: 999 }] }]));
            },
        },
    };
});
vi.mock("../services/uk", async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        ukProvider: {
            ...actual.ukProvider,
            async getHistory(ids: string[]) {
                liveCalls.push(`UK:${ids.join(",")}`);
                return {};
            },
        },
    };
});
vi.mock("../services/nws", async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        nwsProvider: {
            ...actual.nwsProvider,
            async getHistory(ids: string[]) {
                liveCalls.push(`NWS:${ids.join(",")}:history`);
                return {};
            },
            async getForecast(ids: string[]) {
                liveCalls.push(`NWS:${ids.join(",")}:forecast-only`);
                return Object.fromEntries(ids.map(id => [id, { id, name: id, readings: [{ dateTime: NOW + 6 * SLOT, ft: 9, isForecast: true }] }]));
            },
        },
    };
});

beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    liveCalls = [];
    db = createTestD1();
    vi.resetModules();
    app = (await import("../index")).default;
});
afterEach(() => { db.close(); vi.useRealTimers(); vi.clearAllMocks(); });

const env = () => ({ FLOW_DB: db, DB: db, FLOW_STORAGE: {} } as any);

const get = (path: string, headers: Record<string, string> = {}, host = "https://flow.rivers.run") =>
    app.fetch(new Request(`${host}${path}`, { headers: { Origin: "https://rivers.run", ...headers } }), env());

/** Stores readings and marks the gauge covered for 30 days unless told otherwise. */
async function seed(gaugeId: string, readings: Array<{ ts: number; cfs?: number; ft?: number }>, covered = true) {
    const { keys } = await resolveGaugeKeys(db, [{ gaugeId, provider: gaugeId.split(":")[0], name: "Stored Gauge" }]);
    await upsertSlots(db, readings.map(r => ({
        gaugeId, ts: r.ts, off: 0, cfs: r.cfs ?? null, ft: r.ft ?? null, cms: null, m: null,
        temp_f: null, precip_in: null, approved: false,
    })), keys);
    if (covered) await extendCoverage(db, [keys.get(gaugeId)!], slotStartOf(NOW - 30 * DAY));
    await setMeta(db, ingestMetaKey(gaugeId.split(":")[0]), NOW - 5 * 60_000);
    return keys.get(gaugeId)!;
}

describe("GET /history", () => {
    it("serves a covered gauge from the store without touching the provider", async () => {
        await seed("USGS:03451500", [{ ts: NOW - 2 * SLOT, cfs: 100 }, { ts: NOW - SLOT, cfs: 110 }, { ts: NOW, cfs: 120 }]);
        const res = await get("/history?gauges=USGS:03451500&days=28");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body["USGS:03451500"]).toMatchObject({ id: "03451500", name: "Stored Gauge" });
        expect(body["USGS:03451500"].readings.map((r: any) => r.cfs)).toEqual([100, 110, 120]);
        expect(liveCalls).toEqual([]);
    });

    it("goes live when stored coverage does not span the request", async () => {
        const key = await seed("USGS:03451500", [{ ts: NOW, cfs: 120 }], false);
        await extendCoverage(db, [key], NOW - 2 * DAY);
        await get("/history?gauges=USGS:03451500&days=7");
        expect(liveCalls).toEqual(["USGS:03451500"]);

        liveCalls = [];
        await get("/history?gauges=USGS:03451500&days=1");
        expect(liveCalls).toEqual([]);
    });

    it("goes live when the provider has not ingested recently", async () => {
        await seed("USGS:03451500", [{ ts: NOW, cfs: 120 }]);
        await setMeta(db, ingestMetaKey("USGS"), NOW - 2 * 3_600_000);
        await get("/history?gauges=USGS:03451500");
        expect(liveCalls).toEqual(["USGS:03451500"]);
    });

    it("goes live while a repair is pending", async () => {
        const key = await seed("USGS:03451500", [{ ts: NOW, cfs: 120 }]);
        await markRepair(db, [key], NOW - DAY);
        await get("/history?gauges=USGS:03451500");
        expect(liveCalls).toEqual(["USGS:03451500"]);
    });

    it("never serves latest-only providers from the store", async () => {
        await seed("UK:123", [{ ts: NOW, cfs: 1 }]);
        const res = await get("/history?gauges=UK:123&days=1");
        expect(res.status).toBe(200);
        expect(liveCalls).toEqual(["UK:123"]);
    });

    it("with forecast=true fetches only forecasts live for stored gauges", async () => {
        await seed("USGS:03451500", [{ ts: NOW, cfs: 120 }]);
        await seed("NWS:ABCD1", [{ ts: NOW - SLOT, ft: 2 }, { ts: NOW, ft: 3 }]);
        const body = await (await get("/history?gauges=USGS:03451500,NWS:ABCD1&forecast=true")).json();

        expect(liveCalls).toEqual(["NWS:ABCD1:forecast-only"]);
        expect(body["USGS:03451500"].readings).toEqual([{ dateTime: NOW, cfs: 120 }]);
        expect(body["NWS:ABCD1"].readings.map((r: any) => [r.ft ?? r.ftForecast, !!r.isForecast])).toEqual([[2, false], [3, false], [9, true]]);
    });

    it("returns readings from ?since= inclusive", async () => {
        await seed("USGS:03451500", [1, 2, 3, 4].map(i => ({ ts: NOW - (4 - i) * SLOT, cfs: i })));
        const body = await (await get(`/history?gauges=USGS:03451500&since=${NOW - 2 * SLOT}`)).json();
        expect(body["USGS:03451500"].readings.map((r: any) => r.cfs)).toEqual([2, 3, 4]);
    });

    it("ignores a ?since= older than the requested window", async () => {
        await seed("USGS:03451500", [{ ts: NOW - 2 * DAY, cfs: 3 }, { ts: NOW, cfs: 4 }]);
        const res = await get(`/history?gauges=USGS:03451500&days=1&since=${NOW - 400 * DAY}`);
        expect((await res.json())["USGS:03451500"].readings).toHaveLength(1);
    });

    it("304s on a matching ETag and changes it when a value is revised", async () => {
        await seed("USGS:03451500", [{ ts: NOW, cfs: 120 }]);
        const first = await get("/history?gauges=USGS:03451500");
        const etag = first.headers.get("ETag")!;
        const second = await get("/history?gauges=USGS:03451500", { "If-None-Match": etag });
        expect(second.status).toBe(304);
        expect(await second.text()).toBe("");

        await seed("USGS:03451500", [{ ts: NOW, cfs: 125 }]);
        const revised = await get("/history?gauges=USGS:03451500", { "If-None-Match": etag });
        expect(revised.status).toBe(200);
        expect(revised.headers.get("ETag")).not.toBe(etag);
    });

    it("still enforces the safety limits", async () => {
        const many = Array.from({ length: 11 }, (_, i) => `USGS:${i}`).join(",");
        expect((await get(`/history?gauges=${many}`)).status).toBe(400);
        expect((await get("/history?gauges=USGS:1&days=45")).status).toBe(400);
    });

    it("falls back to live when the store read throws", async () => {
        const broken = { prepare: () => { throw new Error("D1 unavailable"); }, batch: async () => [] } as any;
        const res = await app.fetch(new Request("https://flow.rivers.run/history?gauges=USGS:03451500", {
            headers: { Origin: "https://rivers.run" },
        }), { FLOW_DB: broken, DB: db, FLOW_STORAGE: {} } as any);
        expect(res.status).toBe(200);
        expect(liveCalls).toEqual(["USGS:03451500"]);
    });

    it("works with no FLOW_DB bound at all", async () => {
        const res = await app.fetch(new Request("https://flow.rivers.run/history?gauges=USGS:03451500", {
            headers: { Origin: "https://rivers.run" },
        }), { DB: db, FLOW_STORAGE: {} } as any);
        expect(res.status).toBe(200);
        expect(liveCalls).toEqual(["USGS:03451500"]);
    });
});

describe("GET /gauge/{prefix}/{id}", () => {
    it("uses the store only when covered", async () => {
        await seed("USGS:03451500", [{ ts: NOW, cfs: 120 }]);
        const res = await get("/gauge/USGS/03451500");
        expect((await res.json()).readings).toEqual([{ dateTime: NOW, cfs: 120 }]);
        expect(liveCalls).toEqual([]);
    });
});

describe("local dev routes", () => {
    const withFlag = (path: string, host: string) =>
        app.fetch(new Request(`${host}${path}`), { ...env(), LOCAL_DEV_ROUTES: "1", FLOW_STORAGE: { get: async () => null } });

    it("are not available outside localhost", async () => {
        expect((await get("/seed-local-r2")).status).toBe(404);
        expect((await withFlag("/__model-storage/model/usgs_hourly.json.gz", "https://flow.rivers.run")).status).toBe(404);
    });

    it("need LOCAL_DEV_ROUTES even on localhost", async () => {
        expect((await get("/__model-storage/model/usgs_hourly.json.gz", {}, "http://localhost:8787")).status).toBe(404);
        expect((await withFlag("/__model-storage/model/usgs_hourly.json.gz", "http://localhost:8787")).status).toBe(404);
        expect((await withFlag("/__model-storage/sitedata.json", "http://localhost:8787")).status).toBe(403);
    });
});
