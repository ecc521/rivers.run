import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchOGCPages } from "../usgs";

const page = (features: any[], next?: string, remaining = "900") =>
    new Response(JSON.stringify({ features, links: next ? [{ rel: "next", href: next }] : [] }), {
        status: 200, headers: { "x-ratelimit-remaining": remaining },
    });

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("fetchOGCPages", () => {
    it("follows next links and reports completeness and remaining budget", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(page([{ id: 1 }], "https://x/2", "900"))
            .mockResolvedValueOnce(page([{ id: 2 }], undefined, "899"));
        vi.stubGlobal("fetch", fetchMock);

        const seen: any[] = [];
        const res = await fetchOGCPages("https://x/1", 1000, null, f => { seen.push(...f); });
        expect(res).toEqual({ complete: true, pages: 2, rateRemaining: 899 });
        expect(seen.map(f => f.id)).toEqual([1, 2]);
    });

    it("reports incomplete when a later page fails, keeping what arrived", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(page([{ id: 1 }], "https://x/2"))
            .mockResolvedValue(new Response("err", { status: 503 }));
        vi.stubGlobal("fetch", fetchMock);

        const seen: any[] = [];
        const pending = fetchOGCPages("https://x/1", 1000, null, f => { seen.push(...f); });
        await vi.runAllTimersAsync();
        const res = await pending;
        expect(res.complete).toBe(false);
        expect(seen).toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(4); // page 1, then 3 attempts at page 2
    });

    it("does not retry a 429", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response("slow down", { status: 429, headers: { "x-ratelimit-remaining": "0" } }));
        vi.stubGlobal("fetch", fetchMock);
        const res = await fetchOGCPages("https://x/1", 1000, null, () => {});
        expect(res).toMatchObject({ complete: false, rateRemaining: 0, error: "USGS HTTP 429" });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
