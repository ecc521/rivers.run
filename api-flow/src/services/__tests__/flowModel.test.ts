import { describe, it, expect, vi, beforeEach } from "vitest";
import { gzipSync } from "node:zlib";
import { clearNwsUsgsCache, handleModelStorage, readForecasts, readNwsUsgsMap, shardOf, shardKey, syncNwsUsgsMap, NWS_USGS_KEY } from "../flowModel";

/** In-memory R2 with the calls flowModel.ts makes; list pages 2 keys at a time. */
function memoryBucket() {
    const data = new Map<string, Uint8Array>();
    const bucket = {
        data,
        get: vi.fn(async (key: string) => {
            const v = data.get(key);
            return v ? { body: new Response(v).body, json: async () => JSON.parse(new TextDecoder().decode(v)) } : null;
        }),
        put: vi.fn(async (key: string, value: ArrayBuffer | Uint8Array | string) => {
            data.set(key, typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value as ArrayBuffer));
            return {};
        }),
        delete: vi.fn(async (key: string) => { data.delete(key); }),
        list: vi.fn(async ({ prefix, cursor }: { prefix: string; cursor?: string }) => {
            const keys = [...data.keys()].filter(k => k.startsWith(prefix)).sort((a, b) => a.localeCompare(b));
            const from = cursor ? Number(cursor) : 0;
            const page = keys.slice(from, from + 2);
            const truncated = from + 2 < keys.length;
            return { objects: page.map(key => ({ key })), truncated, cursor: truncated ? String(from + 2) : undefined };
        }),
    };
    return bucket;
}

const call = (bucket: any, method: string, path: string, body?: string) =>
    handleModelStorage(new Request(`http://flow.r2/${path}`, { method, body }), bucket as R2Bucket);

describe("shardOf", () => {
    it("matches serving/run.py shard_of (FNV-1a 32 mod 256)", () => {
        expect(shardOf("a")).toBe(0xe40c292c % 256);
        expect(shardOf("foobar")).toBe(0xbf9cf968 % 256);
        expect(shardOf("03451500")).toBe(69);
        expect(shardOf("0211139110")).toBe(138);
        expect(shardKey(69)).toBe("model/forecasts/shards/45.json.gz");
    });
});

describe("handleModelStorage", () => {
    let bucket: ReturnType<typeof memoryBucket>;
    beforeEach(() => { bucket = memoryBucket(); });

    it("round-trips writable keys and 404s missing ones", async () => {
        expect((await call(bucket, "PUT", "model/weather/days/20260924.npz", "abc")).status).toBe(204);
        const got = await call(bucket, "GET", "model/weather/days/20260924.npz");
        expect(await got.text()).toBe("abc");
        expect((await call(bucket, "GET", "model/weather/days/20260101.npz")).status).toBe(404);
        expect((await call(bucket, "DELETE", "model/weather/days/20260924.npz")).status).toBe(204);
        expect(bucket.data.size).toBe(0);
    });

    it("lists relative to the prefix across pages", async () => {
        for (const k of ["a.npz", "b.npz", "c.npz"]) bucket.data.set(`model/weather/cycles/${k}`, new Uint8Array());
        bucket.data.set("model/weather/days/x.npz", new Uint8Array());
        const res = await call(bucket, "GET", "model/?list=weather/cycles/");
        expect(await res.json()).toEqual({ keys: ["weather/cycles/a.npz", "weather/cycles/b.npz", "weather/cycles/c.npz"] });
    });

    it("lets the container write its ratings", async () => {
        expect((await call(bucket, "PUT", "model/ratings/ratings.json.gz", "x")).status).toBe(204);
    });

    it("keeps the container inside model/ and the snapshot read-only", async () => {
        bucket.data.set("sitedata.json", new Uint8Array([1]));
        bucket.data.set("model/usgs_hourly.json.gz", new Uint8Array([1]));
        expect((await call(bucket, "GET", "sitedata.json")).status).toBe(403);
        expect((await call(bucket, "GET", "model/../sitedata.json")).status).not.toBe(200);
        expect((await call(bucket, "GET", "model/usgs_hourly.json.gz")).status).toBe(200);
        expect((await call(bucket, "PUT", "model/usgs_hourly.json.gz", "x")).status).toBe(403);
        expect((await call(bucket, "DELETE", "model/usgs_hourly.json.gz")).status).toBe(403);
        expect((await call(bucket, "PUT", "gauge_registry.json", "x")).status).toBe(403);
        expect(bucket.put).not.toHaveBeenCalled();
    });
});

describe("readForecasts", () => {
    it("reads each site from its gzipped shard and omits the rest", async () => {
        const bucket = memoryBucket();
        const head = { issue_time: 1, cycle: 2, start: 3, step_ms: 3_600_000, hours: 168, units: "cfs", calibrated: true, model: { epoch: 3 } };
        const gauge = { reliability: "good", obs_cfs: 1050, q10: [900], q50: [1000], q90: [1100] };
        bucket.data.set(shardKey(shardOf("03451500")), gzipSync(JSON.stringify({ ...head, shard: 69, gauges: { "03451500": gauge } })));

        const out = await readForecasts(bucket as unknown as R2Bucket, ["03451500", "0211139110", "99999999"]);
        expect(Object.keys(out)).toEqual(["03451500"]);
        expect(out["03451500"]).toMatchObject({ issueTime: 1, stepMs: 3_600_000, reliability: "good", obsCfs: 1050, q50: [1000] });
    });

    it("passes stage through only where the gauge has a rating", async () => {
        const bucket = memoryBucket();
        const head = { issue_time: 1, cycle: 2, start: 3, step_ms: 3_600_000, hours: 168, units: "cfs", calibrated: true, model: {} };
        const rated = { reliability: "good", obs_cfs: 1, q10: [9], q50: [10], q90: [11], ft10: [1.1], ft50: [1.2], ft90: [null] };
        const plain = { reliability: "good", obs_cfs: 1, q10: [9], q50: [10], q90: [11] };
        for (const [site, g] of [["03451500", rated], ["0211139110", plain]] as const) {
            bucket.data.set(shardKey(shardOf(site)), gzipSync(JSON.stringify({ ...head, gauges: { [site]: g } })));
        }
        const out = await readForecasts(bucket as unknown as R2Bucket, ["03451500", "0211139110"]);
        expect(out["03451500"]).toMatchObject({ ft10: [1.1], ft50: [1.2], ft90: [null] });
        expect(out["0211139110"]).not.toHaveProperty("ft50");
    });
});

describe("syncNwsUsgsMap", () => {
    beforeEach(() => { clearNwsUsgsCache(); });
    const read = (bucket: ReturnType<typeof memoryBucket>) => JSON.parse(new TextDecoder().decode(bucket.data.get(NWS_USGS_KEY)));

    it("takes usgsId from the registry, else the previous map, else a lookup, including newly linked gauges", async () => {
        const bucket = memoryBucket();
        bucket.data.set(NWS_USGS_KEY, new TextEncoder().encode(JSON.stringify({ OLDX1: "01234567", GONE1: "07654321" })));
        const registry = {
            "NWS:MARN7": { usgsId: "03453500" },
            "NWS:NOUS1": { usgsId: null },
            "NWS:OLDX1": {},
            "NWS:NEWX1": {},
            "NWS:DOWN1": {},
            "USGS:03451500": {},
        };
        const listSites = vi.fn(async (ids: string[]) =>
            ids.filter(id => id !== "DOWN1").map(id => ({ id, name: id, lat: 0, lon: 0, usgsId: "02222222" })));

        expect(await syncNwsUsgsMap(bucket as unknown as R2Bucket, registry, ["NWS:MARN7", "NWS:LINK1", "USGS:1"], listSites)).toBe(4);
        expect(listSites).toHaveBeenCalledWith(["NEWX1", "DOWN1", "LINK1"]);
        expect(read(bucket)).toEqual({ LINK1: "02222222", MARN7: "03453500", NEWX1: "02222222", NOUS1: null, OLDX1: "01234567" });
        expect(await readNwsUsgsMap(bucket as unknown as R2Bucket)).toEqual(read(bucket));
    });

    it("writes only on change", async () => {
        const bucket = memoryBucket();
        const registry = { "NWS:MARN7": { usgsId: "03453500" } };
        await syncNwsUsgsMap(bucket as unknown as R2Bucket, registry, [], async () => []);
        await syncNwsUsgsMap(bucket as unknown as R2Bucket, registry, [], async () => []);
        expect(bucket.put).toHaveBeenCalledTimes(1);
    });
});
