import { describe, it, expect, vi, afterEach } from "vitest";
import { nwsProvider } from "../nws";
import { ecProvider } from "../canada";

afterEach(() => { vi.unstubAllGlobals(); });

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
    const out: T[] = [];
    for await (const x of it) out.push(x);
    return out;
}

describe("nwsProvider.getBulkHistories", () => {
    it("keeps an observation and a forecast at the same time apart", async () => {
        const t = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 - 3_600_000).toISOString();
        const later = new Date(Date.now() + 3_600_000).toISOString();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
            observed: { primaryUnits: "ft", data: [{ validTime: t, primary: 3 }] },
            forecast: { primaryUnits: "ft", data: [{ validTime: t, primary: 3.5 }, { validTime: later, primary: 4 }] },
        }), { status: 200 })));

        const [unit] = await collect(nwsProvider.getBulkHistories!(["ABCD1"]));
        expect(unit.histories!.ABCD1.readings).toEqual([{ dateTime: Date.parse(t), ft: 3 }]);
        expect(unit.forecasts!.ABCD1.map(r => r.ft)).toEqual([3.5, 4]);
        expect(unit.forecasts!.ABCD1.every(r => r.isForecast)).toBe(true);
    });

    it("yields null histories for a failed gauge", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("err", { status: 503 })));
        const pending = collect(nwsProvider.getBulkHistories!(["ABCD1"]));
        await vi.runAllTimersAsync();
        const [unit] = await pending;
        vi.useRealTimers();
        expect(unit).toMatchObject({ unit: "ABCD1", siteCodes: ["ABCD1"], histories: null });
    });
});

describe("ecProvider.getBulkHistories", () => {
    it("yields one unit per province, null when its download fails", async () => {
        const csv = "ID,Date,Water Level / Niveau d'eau (m),Discharge / Débit (cms)\n" +
            `05BB001,${new Date(Date.now() - 20 * 3_600_000).toISOString()},1.5,10\n` +
            `05BB001,${new Date(Date.now() - 600_000).toISOString()},1.6,11\n`;
        vi.stubGlobal("fetch", vi.fn(async (url: string) =>
            url.includes("/AB/") ? new Response(csv, { status: 200 }) : new Response("no", { status: 500 })));

        const units = await collect(ecProvider.getBulkHistories!(["05BB001"]));
        const ab = units.find(u => u.unit === "AB")!;
        expect(ab.histories!["05BB001"].readings).toHaveLength(2); // whole file, not a trailing window
        expect(units.filter(u => u.unit !== "AB").every(u => u.histories === null)).toBe(true);
        expect(units.every(u => u.siteCodes.includes("05BB001"))).toBe(true);
    });
});
