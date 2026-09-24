import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestD1 } from "./helpers/d1Sqlite";

const HOURLY = 1_780_002_000_000 + 5 * 60_000; // first quarter of an hour

function makeEnv() {
    const puts: string[] = [];
    const storage = {
        get: vi.fn(async (key: string) => key === "gauge_registry.json"
            ? { json: async () => ({ "EC:A": { name: "A" } }) }
            : null),
        head: vi.fn(async () => null),
        put: vi.fn(async (key: string) => { puts.push(key); return {}; }),
    };
    const db = createTestD1();
    return { puts, env: { FLOW_DB: db, DB: db, FLOW_STORAGE: storage } as any };
}

let app: any;
beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(HOURLY);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    vi.resetModules();
    app = (await import("../index")).default;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("scheduled handler", () => {
    it("writes sitedata.json before the model snapshot", async () => {
        const { puts, env } = makeEnv();
        await app.scheduled({ cron: "*/15 * * * *" }, env, {});
        expect(puts).toContain("sitedata.json");
        expect(puts).toContain("model/usgs_hourly.json.gz");
        expect(puts.indexOf("sitedata.json")).toBeLessThan(puts.indexOf("model/usgs_hourly.json.gz"));
    });

    it("does not ingest on the daily cron that fires alongside */15", async () => {
        const { puts, env } = makeEnv();
        await app.scheduled({ cron: "0 0 * * *" }, env, {});
        expect(puts).not.toContain("sitedata.json");
    });
});
