import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestD1, type TestD1 } from "./helpers/d1Sqlite";
import { resolveGaugeKeys, upsertReadings } from "../services/flowStore";

const NOW = 1_779_999_900_000;
const SNAP = 300_000;

let db: TestD1;
let app: any;
let liveCalls: string[];

/**
 * The live provider path is stubbed at the module boundary so these tests can
 * assert *which* source answered — the whole point of the change is that a
 * river-detail view stops hitting USGS.
 */
vi.mock("../services/usgs", async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        usgsProvider: {
            ...actual.usgsProvider,
            async getHistory(ids: string[], startTs: number, _e?: number, forecast?: boolean) {
                liveCalls.push(`USGS:${ids.join(",")}${forecast ? ":forecast" : ""}`);
                return Object.fromEntries(ids.map(id => [id, {
                    id, name: `Live ${id}`,
                    readings: forecast
                        ? [{ dateTime: NOW + SNAP, cfs: 500, isForecast: true }]
                        : [{ dateTime: NOW, cfs: 999 }],
                }]));
            },
        },
    };
});

beforeEach(async () => {
    // The route derives its window from Date.now(); pin it so the fixed
    // timestamps below fall inside the requested range.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    liveCalls = [];
    db = createTestD1();
    vi.resetModules();
    app = (await import("../index")).default;
});
afterEach(() => { db.close(); vi.useRealTimers(); vi.clearAllMocks(); });

const env = () => ({ FLOW_DB: db, DB: db, FLOW_STORAGE: {} } as any);

const get = (path: string, headers: Record<string, string> = {}) =>
    app.fetch(new Request(`https://flow.rivers.run${path}`, {
        headers: { Origin: "https://rivers.run", ...headers },
    }), env());

async function seed(gaugeId: string, readings: Array<{ ts: number; cfs: number }>) {
    const keys = await resolveGaugeKeys(db, [{
        gaugeId, provider: gaugeId.split(":")[0], tier: "linked", name: "Stored Gauge",
    }]);
    await upsertReadings(db, readings.map(r => ({ gaugeId, ts: r.ts, cfs: r.cfs })), keys, NOW);
}

describe("GET /history", () => {
    it("serves a stored gauge without touching the provider", async () => {
        await seed("USGS:03451500", [
            { ts: NOW - 2 * SNAP, cfs: 100 },
            { ts: NOW - SNAP, cfs: 110 },
            { ts: NOW, cfs: 120 },
        ]);

        const res = await get("/history?gauges=USGS:03451500&days=28");
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body["USGS:03451500"].readings.map((r: any) => r.cfs)).toEqual([100, 110, 120]);
        expect(liveCalls).toEqual([]);
    });

    it("preserves the legacy payload shape", async () => {
        await seed("USGS:03451500", [{ ts: NOW, cfs: 120 }]);
        const body = await (await get("/history?gauges=USGS:03451500")).json();

        expect(body["USGS:03451500"]).toMatchObject({ id: "03451500", name: "Stored Gauge" });
        expect(Array.isArray(body["USGS:03451500"].readings)).toBe(true);
        expect(body["USGS:03451500"].readings[0]).toEqual({ dateTime: NOW, cfs: 120 });
    });

    it("falls back to the provider for an unknown gauge", async () => {
        const body = await (await get("/history?gauges=USGS:99999999")).json();

        expect(liveCalls).toEqual(["USGS:99999999"]);
        expect(body["USGS:99999999"].readings[0].cfs).toBe(999);
    });

    it("mixes stored and live gauges in one response", async () => {
        await seed("USGS:03451500", [{ ts: NOW, cfs: 120 }]);
        const body = await (await get("/history?gauges=USGS:03451500,USGS:99999999")).json();

        expect(liveCalls).toEqual(["USGS:99999999"]);
        expect(body["USGS:03451500"].readings[0].cfs).toBe(120);
        expect(body["USGS:99999999"].readings[0].cfs).toBe(999);
    });

    it("keeps stored observations when forecasts are requested", async () => {
        // Forecasts must be fresh, so they stay on the live path — but asking
        // for them must not discard the stored history.
        await seed("USGS:03451500", [{ ts: NOW - SNAP, cfs: 100 }, { ts: NOW, cfs: 120 }]);
        const body = await (await get("/history?gauges=USGS:03451500&forecast=true")).json();

        expect(liveCalls).toEqual(["USGS:03451500:forecast"]);
        const readings = body["USGS:03451500"].readings;
        expect(readings.filter((r: any) => !r.isForecast).map((r: any) => r.cfs)).toEqual([100, 120]);
        expect(readings.some((r: any) => r.isForecast)).toBe(true);
    });

    it("returns only the delta for ?since=", async () => {
        await seed("USGS:03451500", [
            { ts: NOW - 3 * SNAP, cfs: 1 },
            { ts: NOW - 2 * SNAP, cfs: 2 },
            { ts: NOW - SNAP, cfs: 3 },
            { ts: NOW, cfs: 4 },
        ]);

        const body = await (await get(`/history?gauges=USGS:03451500&since=${NOW - 2 * SNAP}`)).json();
        expect(body["USGS:03451500"].readings.map((r: any) => r.cfs)).toEqual([3, 4]);
    });

    it("ignores a ?since= older than the requested window", async () => {
        await seed("USGS:03451500", [{ ts: NOW, cfs: 4 }]);
        const res = await get(`/history?gauges=USGS:03451500&days=1&since=${NOW - 400 * 86400000}`);
        expect(res.status).toBe(200);
        expect((await res.json())["USGS:03451500"].readings).toHaveLength(1);
    });

    it("304s when the ETag matches", async () => {
        await seed("USGS:03451500", [{ ts: NOW, cfs: 120 }]);

        const first = await get("/history?gauges=USGS:03451500");
        const etag = first.headers.get("ETag");
        expect(etag).toBeTruthy();

        const second = await get("/history?gauges=USGS:03451500", { "If-None-Match": etag! });
        expect(second.status).toBe(304);
        expect(await second.text()).toBe("");
    });

    it("changes the ETag when a new reading lands", async () => {
        await seed("USGS:03451500", [{ ts: NOW - SNAP, cfs: 100 }]);
        const before = (await get("/history?gauges=USGS:03451500")).headers.get("ETag");

        await seed("USGS:03451500", [{ ts: NOW, cfs: 120 }]);
        const after = (await get("/history?gauges=USGS:03451500")).headers.get("ETag");

        expect(after).not.toBe(before);
    });

    it("still enforces the existing safety limits", async () => {
        const many = Array.from({ length: 11 }, (_, i) => `USGS:${i}`).join(",");
        expect((await get(`/history?gauges=${many}`)).status).toBe(400);
        expect((await get("/history?gauges=USGS:1&days=45")).status).toBe(400);
    });

    it("falls back to live when the store read throws", async () => {
        const broken = {
            prepare: () => { throw new Error("D1 unavailable"); },
            batch: async () => [],
        } as any;

        const res = await app.fetch(
            new Request("https://flow.rivers.run/history?gauges=USGS:03451500", {
                headers: { Origin: "https://rivers.run" },
            }),
            { FLOW_DB: broken, DB: db, FLOW_STORAGE: {} } as any
        );

        expect(res.status).toBe(200);
        expect(liveCalls).toEqual(["USGS:03451500"]);
    });

    it("works with no FLOW_DB bound at all", async () => {
        const res = await app.fetch(
            new Request("https://flow.rivers.run/history?gauges=USGS:03451500", {
                headers: { Origin: "https://rivers.run" },
            }),
            { DB: db, FLOW_STORAGE: {} } as any
        );

        expect(res.status).toBe(200);
        expect(liveCalls).toEqual(["USGS:03451500"]);
    });
});
