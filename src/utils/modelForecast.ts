import type { GaugeReading, ModelReliability } from "../types/River";

/**
 * Rivers.run model flow forecasts from the flow API's /forecast route.
 *
 * Kept apart from the /history merge on purpose: the forecast is stored per
 * gauge and laid over the readings at render time, so delta fetches and NWS
 * forecasts never see (or drop) it.
 */

/** The /forecast route accepts at most this many gauge ids per request. */
export const MODEL_FORECAST_BATCH = 20;

export interface ModelForecast {
    issueTime: number;
    start: number;
    stepMs: number;
    reliability: ModelReliability;
    q10?: number[];
    q50: number[];
    q90?: number[];
}

const CFS_TO_CMS = 0.0283168;

/** USGS gauge ids split into request-sized chunks. */
export function modelForecastChunks(gaugeIds: string[]): string[][] {
    const usgs = [...new Set(gaugeIds.filter(id => id.toUpperCase().startsWith("USGS:")))];
    const chunks: string[][] = [];
    for (let i = 0; i < usgs.length; i += MODEL_FORECAST_BATCH) {
        chunks.push(usgs.slice(i, i + MODEL_FORECAST_BATCH));
    }
    return chunks;
}

const isNumArray = (v: unknown): v is number[] => Array.isArray(v);

/** Validates one /forecast entry; anything malformed is dropped. */
export function parseModelForecast(raw: any): ModelForecast | null {
    if (!raw || typeof raw !== "object") return null;
    const { issueTime, start, stepMs, q10, q50, q90 } = raw;
    if (![issueTime, start, stepMs].every(n => typeof n === "number" && Number.isFinite(n))) return null;
    if (stepMs <= 0 || !isNumArray(q50) || q50.length === 0) return null;
    const reliability = ["good", "fair", "poor", "unknown"].includes(raw.reliability) ? raw.reliability : null;
    return {
        issueTime,
        start,
        stepMs,
        reliability,
        q10: isNumArray(q10) ? q10 : undefined,
        q50,
        q90: isNumArray(q90) ? q90 : undefined,
    };
}

/**
 * Fetches forecasts for every USGS gauge in `gaugeIds`. Never throws: a chunk
 * that fails keeps whatever `previous` held for its gauges, so a flaky or
 * offline connection leaves the last good forecast on screen.
 */
export async function fetchModelForecasts(
    baseUrl: string,
    gaugeIds: string[],
    previous: Record<string, ModelForecast> = {},
    fetchFn: typeof fetch = fetch
): Promise<Record<string, ModelForecast>> {
    const results = await Promise.all(modelForecastChunks(gaugeIds).map(async (chunk) => {
        const out: Record<string, ModelForecast> = {};
        try {
            const res = await fetchFn(`${baseUrl}/forecast?gauges=${encodeURIComponent(chunk.join(","))}`);
            if (!res.ok) throw new Error(String(res.status));
            const data = await res.json();
            for (const id of chunk) {
                const parsed = parseModelForecast(data?.[id]);
                if (parsed) out[id] = parsed;
            }
        } catch {
            for (const id of chunk) {
                if (previous[id]) out[id] = previous[id];
            }
        }
        return out;
    }));
    return Object.assign({}, ...results);
}

const toCms = (cfs: number) => Math.round(cfs * CFS_TO_CMS * 1000) / 1000;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Lays a forecast over one gauge's (unit-converted) readings as
 * cfsModel / cfsModelLow / cfsModelHigh, plus cms twins in metric mode.
 * Hours with no reading become new forecast-only rows.
 */
export function mergeModelForecast(
    readings: GaugeReading[],
    forecast: ModelForecast | undefined,
    flowUnits?: string
): GaugeReading[] {
    if (!forecast) return readings;
    const byTime = new Map<number, GaugeReading>();
    for (const r of readings) byTime.set(r.dateTime, r);

    const metric = flowUnits === "metric";
    forecast.q50.forEach((mid, j) => {
        if (!finite(mid)) return;
        const dateTime = forecast.start + j * forecast.stepMs;
        const low = forecast.q10?.[j];
        const high = forecast.q90?.[j];
        const row: GaugeReading = { ...(byTime.get(dateTime) ?? { dateTime, isForecast: true }) };
        row.cfsModel = mid;
        if (finite(low) && finite(high)) {
            row.cfsModelLow = low;
            row.cfsModelHigh = high;
        }
        if (metric) {
            row.cmsModel = toCms(mid);
            if (finite(low) && finite(high)) {
                row.cmsModelLow = toCms(low);
                row.cmsModelHigh = toCms(high);
            }
        }
        byTime.set(dateTime, row);
    });
    return Array.from(byTime.values()).sort((a, b) => a.dateTime - b.dateTime);
}

/** Plain-language age, e.g. "3 hours ago". */
export function formatForecastAge(thenMs: number, nowMs: number = Date.now()): string {
    const mins = Math.max(0, Math.round((nowMs - thenMs) / 60000));
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins} minutes ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    const days = Math.round(hours / 24);
    return days === 1 ? "1 day ago" : `${days} days ago`;
}

/** Rounds to 3 significant figures with thousands separators, e.g. 1,040. */
export function formatModelFlow(v: number): string {
    if (!finite(v)) return "";
    const rounded = v === 0 ? 0 : Number(v.toPrecision(3));
    return rounded.toLocaleString("en-US", { maximumFractionDigits: 3 });
}
