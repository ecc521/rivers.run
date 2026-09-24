import { describe, it, expect, vi } from "vitest";
import {
    forecastRowsAsForecast,
    MODEL_FORECAST_BATCH,
    modelForecastChunks,
    parseModelForecast,
    fetchModelForecasts,
    mergeModelForecast,
    formatModelFlow,
    formatModelValue,
    type ModelForecast,
} from "./modelForecast";
import type { GaugeReading } from "../types/River";

const HOUR = 3_600_000;
const ISSUE = 1_790_262_000_000;

const forecast = (overrides: Partial<ModelForecast> = {}): ModelForecast => ({
    issueTime: ISSUE,
    start: ISSUE + HOUR,
    stepMs: HOUR,
    q10: [900, 880, 860],
    q50: [1040, 1000, 960],
    q90: [1200, 1150, 1100],
    ...overrides,
});

const jsonResponse = (body: unknown, status = 200) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe("modelForecastChunks", () => {
    it("keeps only USGS ids, dedupes, and splits into batches of 20", () => {
        const usgs = Array.from({ length: 45 }, (_, i) => `USGS:${String(i).padStart(8, "0")}`);
        const chunks = modelForecastChunks([...usgs, "canada:01AB001", "NWS:ABCD1", usgs[0]]);
        expect(chunks.map(c => c.length)).toEqual([MODEL_FORECAST_BATCH, MODEL_FORECAST_BATCH, 6]);
        expect(chunks.flat()).toEqual([...usgs, "NWS:ABCD1"]);
    });

    it("returns no chunks when there are no USGS or NWS gauges", () => {
        expect(modelForecastChunks(["canada:01AB001"])).toEqual([]);
    });
});

describe("parseModelForecast", () => {
    it("accepts a well-formed entry, with stage where present", () => {
        const parsed = parseModelForecast({ ...forecast(), units: "cfs", reliability: "poor", ft50: [3.1, null, 3.0] });
        expect(parsed?.q50).toEqual([1040, 1000, 960]);
        expect(parsed?.ft50).toEqual([3.1, null, 3.0]);
        expect(parsed?.ft10).toBeUndefined();
        expect(parsed).not.toHaveProperty("reliability", "poor");
    });

    it("rejects malformed entries", () => {
        expect(parseModelForecast(null)).toBeNull();
        expect(parseModelForecast({ ...forecast(), q50: [] })).toBeNull();
        expect(parseModelForecast({ ...forecast(), start: "soon" })).toBeNull();
        expect(parseModelForecast({ ...forecast(), stepMs: 0 })).toBeNull();
    });
});

describe("fetchModelForecasts", () => {
    it("requests each chunk and collects the gauges that came back", async () => {
        const ids = Array.from({ length: 21 }, (_, i) => `USGS:${String(i).padStart(8, "0")}`);
        const fetchFn = vi.fn(async (url: string) => {
            const requested = decodeURIComponent(url.split("gauges=")[1]).split(",");
            return jsonResponse({ [requested[0]]: forecast() });
        });
        const out = await fetchModelForecasts("https://flow.test", ids, {}, fetchFn as unknown as typeof fetch);
        expect(fetchFn).toHaveBeenCalledTimes(2);
        expect(fetchFn.mock.calls[0][0]).toMatch(/^https:\/\/flow\.test\/forecast\?gauges=/);
        expect(Object.keys(out).sort((a, b) => a.localeCompare(b))).toEqual([ids[0], ids[20]]);
    });

    it("skips the request entirely without USGS gauges", async () => {
        const fetchFn = vi.fn();
        const out = await fetchModelForecasts("https://flow.test", ["canada:01AB001"], {}, fetchFn as unknown as typeof fetch);
        expect(out).toEqual({});
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it("drops a gauge the server no longer returns", async () => {
        const previous = { "USGS:1": forecast() };
        const out = await fetchModelForecasts("x", ["USGS:1"], previous, (async () => jsonResponse({})) as unknown as typeof fetch);
        expect(out).toEqual({});
    });

    it("keeps the previous forecast when the request fails or errors", async () => {
        const previous = { "USGS:1": forecast() };
        const offline = (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch;
        const serverError = (async () => jsonResponse({ error: "x" }, 500)) as unknown as typeof fetch;
        expect(await fetchModelForecasts("x", ["USGS:1", "USGS:2"], previous, offline)).toEqual(previous);
        expect(await fetchModelForecasts("x", ["USGS:1"], previous, serverError)).toEqual(previous);
        expect(await fetchModelForecasts("x", ["USGS:1"], undefined, offline)).toEqual({});
    });
});

describe("mergeModelForecast", () => {
    const readings: GaugeReading[] = [
        { dateTime: ISSUE, cfs: 1050, ft: 3.1 },
        { dateTime: ISSUE + HOUR, cfs: 1045 },
        { dateTime: ISSUE + 6 * HOUR, cfsForecast: 990, isForecast: true, forecastSource: "NWS" },
    ];

    it("returns the readings untouched without a forecast", () => {
        expect(mergeModelForecast(readings, undefined)).toBe(readings);
    });

    it("places value j at start + j * stepMs, sorted, without disturbing other fields", () => {
        const out = mergeModelForecast(readings, forecast());
        expect(out.map(r => r.dateTime)).toEqual([ISSUE, ISSUE + HOUR, ISSUE + 2 * HOUR, ISSUE + 3 * HOUR, ISSUE + 6 * HOUR]);
        expect(out[0]).toEqual(readings[0]);
        expect(out[1]).toMatchObject({ cfs: 1045, cfsModel: 1040, cfsModelLow: 900, cfsModelHigh: 1200 });
        expect(out[1].isForecast).toBeUndefined();
        expect(out[3]).toEqual({ dateTime: ISSUE + 3 * HOUR, isForecast: true, cfsModel: 960, cfsModelLow: 860, cfsModelHigh: 1100 });
        expect(out[4]).toEqual(readings[2]);
    });

    it("does not mutate the input readings", () => {
        const before = JSON.stringify(readings);
        mergeModelForecast(readings, forecast());
        expect(JSON.stringify(readings)).toBe(before);
    });

    it("adds cms values in metric mode only", () => {
        const [, row] = mergeModelForecast(readings, forecast(), "metric");
        expect(row.cmsModel).toBeCloseTo(29.449, 3);
        expect(row.cmsModelLow).toBeCloseTo(25.485, 3);
        expect(row.cmsModelHigh).toBeCloseTo(33.98, 3);
        expect(mergeModelForecast(readings, forecast(), "imperial")[1].cmsModel).toBeUndefined();
    });

    it("adds stage where the forecast has it, and m twins in metric mode", () => {
        const f = forecast({ ft10: [2.9, 2.8, null], ft50: [3.12, 3.05, null], ft90: [3.4, 3.3, null] });
        const out = mergeModelForecast(readings, f, "metric");
        expect(out[1]).toMatchObject({ ftModel: 3.12, ftModelLow: 2.9, ftModelHigh: 3.4 });
        expect(out[1].mModel).toBeCloseTo(0.951, 3);
        expect(out[3].ftModel).toBeUndefined();
        expect(out[3].cfsModel).toBe(960);
        expect(mergeModelForecast(readings, f)[1].mModel).toBeUndefined();
    });

    it("omits the range where bounds are missing and skips non-numeric values", () => {
        const out = mergeModelForecast([], forecast({ q10: undefined, q50: [100, null as unknown as number, 80] }));
        expect(out.map(r => r.cfsModel)).toEqual([100, 80]);
        expect(out[0].cfsModelLow).toBeUndefined();
        expect(out[0].cfsModelHigh).toBeUndefined();
    });
});


describe("formatModelFlow", () => {
    it("rounds to 3 significant figures with separators", () => {
        expect(formatModelFlow(1040)).toBe("1,040");
        expect(formatModelFlow(12_345)).toBe("12,300");
        expect(formatModelFlow(29.449)).toBe("29.4");
        expect(formatModelFlow(0)).toBe("0");
    });
});

describe("formatModelValue", () => {
    it("keeps stage to hundredths, even for elevation-datum gauges", () => {
        expect(formatModelValue(3.1, "ft")).toBe("3.10");
        expect(formatModelValue(1523.456, "ft")).toBe("1,523.46");
        expect(formatModelValue(1040, "cfs")).toBe("1,040");
    });
});

describe("forecastRowsAsForecast", () => {
    it("moves values off forecast rows so they never draw as observed", () => {
        const rows: GaugeReading[] = [
            { dateTime: 1, cfs: 100, ft: 2 },
            { dateTime: 2, isForecast: true, forecastSource: "NWS", cfs: 120, ft: 2.2, cfsModel: 110 },
            { dateTime: 3, isForecast: true, cfsForecast: 130, ftForecast: 2.4 },
        ];
        expect(forecastRowsAsForecast(rows)).toEqual([
            { dateTime: 1, cfs: 100, ft: 2 },
            { dateTime: 2, isForecast: true, forecastSource: "NWS", cfsForecast: 120, ftForecast: 2.2, cfsModel: 110 },
            { dateTime: 3, isForecast: true, cfsForecast: 130, ftForecast: 2.4 },
        ]);
    });

    it("returns the same array when there is nothing to move", () => {
        const rows: GaugeReading[] = [{ dateTime: 1, cfs: 100 }, { dateTime: 2, isForecast: true, cfsModel: 90 }];
        expect(forecastRowsAsForecast(rows)).toBe(rows);
    });
});
