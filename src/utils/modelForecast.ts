import type { GaugeReading } from "../types/River";

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
    q10?: number[];
    q50: number[];
    q90?: number[];
    /** Stage (ft) by the gauge's USGS rating; null outside the rating's range. */
    ft10?: (number | null)[];
    ft50?: (number | null)[];
    ft90?: (number | null)[];
}

const CFS_TO_CMS = 0.0283168;
const FT_TO_M = 0.3048;

/** Gauge ids that can have a model forecast (USGS, and NWS points on a USGS gauge), chunked. */
export function modelForecastChunks(gaugeIds: string[]): string[][] {
    const ids = [...new Set(gaugeIds.filter(id => /^(USGS|NWS):/i.test(id)))];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += MODEL_FORECAST_BATCH) {
        chunks.push(ids.slice(i, i + MODEL_FORECAST_BATCH));
    }
    return chunks;
}

const FORECAST_KEYS = [["cfs", "cfsForecast"], ["ft", "ftForecast"], ["cms", "cmsForecast"], ["m", "mForecast"]] as const;

/**
 * Forecast rows that carry their values in the observed fields (sitedata.json's
 * NWS rows do) moved to the *Forecast fields, so charts never draw a forecast
 * as observed flow.
 */
export function forecastRowsAsForecast(readings: GaugeReading[]): GaugeReading[] {
    if (!readings.some(r => r.isForecast && FORECAST_KEYS.some(([k]) => r[k] != null))) return readings;
    return readings.map(r => {
        if (!r.isForecast) return r;
        const row: GaugeReading = { ...r };
        for (const [obs, fc] of FORECAST_KEYS) {
            if (row[obs] != null) {
                if (row[fc] == null) row[fc] = row[obs];
                delete row[obs];
            }
        }
        return row;
    });
}

const isNumArray = (v: unknown): v is number[] => Array.isArray(v);
const stageArray = (v: unknown) => isNumArray(v) ? v as (number | null)[] : undefined;

/** Validates one /forecast entry; anything malformed is dropped. */
export function parseModelForecast(raw: any): ModelForecast | null {
    if (!raw || typeof raw !== "object") return null;
    const { issueTime, start, stepMs, q10, q50, q90 } = raw;
    if (![issueTime, start, stepMs].every(n => typeof n === "number" && Number.isFinite(n))) return null;
    if (stepMs <= 0 || !isNumArray(q50) || q50.length === 0) return null;
    return {
        issueTime,
        start,
        stepMs,
        q10: isNumArray(q10) ? q10 : undefined,
        q50,
        q90: isNumArray(q90) ? q90 : undefined,
        ft10: stageArray(raw.ft10),
        ft50: stageArray(raw.ft50),
        ft90: stageArray(raw.ft90),
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

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Lays a forecast over one gauge's (unit-converted) readings as
 * cfsModel / cfsModelLow / cfsModelHigh and, where the gauge has a rating,
 * ftModel / ftModelLow / ftModelHigh, plus cms and m twins in metric mode.
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
        const row: GaugeReading = { ...(byTime.get(dateTime) ?? { dateTime, isForecast: true }) };
        setModel(row, "cfs", mid, forecast.q10?.[j], forecast.q90?.[j]);
        if (metric) setModel(row, "cms", mid, forecast.q10?.[j], forecast.q90?.[j], v => round3(v * CFS_TO_CMS));
        const stage = forecast.ft50?.[j];
        if (finite(stage)) {
            setModel(row, "ft", stage, forecast.ft10?.[j], forecast.ft90?.[j]);
            if (metric) setModel(row, "m", stage, forecast.ft10?.[j], forecast.ft90?.[j], v => round3(v * FT_TO_M));
        }
        byTime.set(dateTime, row);
    });
    return Array.from(byTime.values()).sort((a, b) => a.dateTime - b.dateTime);
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

function setModel(
    row: GaugeReading,
    unit: "cfs" | "cms" | "ft" | "m",
    mid: number,
    low: number | null | undefined,
    high: number | null | undefined,
    convert: (v: number) => number = v => v,
): void {
    row[`${unit}Model`] = convert(mid);
    if (finite(low) && finite(high)) {
        row[`${unit}ModelLow`] = convert(low);
        row[`${unit}ModelHigh`] = convert(high);
    }
}

/** Rounds to 3 significant figures with thousands separators, e.g. 1,040. */
export function formatModelFlow(v: number): string {
    if (!finite(v)) return "";
    const rounded = v === 0 ? 0 : Number(v.toPrecision(3));
    return rounded.toLocaleString("en-US", { maximumFractionDigits: 3 });
}

/** A model value in its unit: stage to 0.01, flow to 3 significant figures. */
export function formatModelValue(v: number, unit: string): string {
    if (!finite(v)) return "";
    if (unit === "ft" || unit === "m") return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return formatModelFlow(v);
}
