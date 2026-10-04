import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, BulkUnit, isValidReadingValue, isRiverStageFt } from './provider';
import { formatStateCode, formatGaugeName } from '../utils/formatting';
import { fetchWithTimeout, DEFAULT_HEADERS } from '../utils/timeout';
import { logToD1 } from '../utils/logger';
import { edgeCachedJson } from '../utils/edgeCache';
import { forEachLimited } from '../utils/concurrency';

// Internal helper for mapping NWPS data arrays to GaugeReadings (exported for testing)
export function parseNWSeries(data: any, observations: any[], minTime: number, maxTime: number, isForecast: boolean): Map<number, GaugeReading> {
    const primaryIsStage = data.primaryUnits === "ft";
    const secondaryIsStage = data.secondaryUnits === "ft";
    const primaryIsFlow = data.primaryUnits === "kcfs" || data.primaryUnits === "cfs";
    const secondaryIsFlow = data.secondaryUnits === "kcfs" || data.secondaryUnits === "cfs";

    const readingMap = new Map<number, GaugeReading>();

    observations.forEach((obs: any) => {
        const rawTime = new Date(obs.validTime).getTime();
        if (rawTime < minTime || (!isForecast && rawTime > maxTime)) return;
        
        // Align timestamps like USGS to Nearest 5 minutes
        const snappedTime = Math.round(rawTime / 300000) * 300000;
        if (!readingMap.has(snappedTime)) {
            readingMap.set(snappedTime, { dateTime: snappedTime, ...(isForecast && { isForecast: true, forecastSource: "NWS" }) });
        }
        
        const reading = readingMap.get(snappedTime)!;
        
        if (primaryIsStage && obs.primary != null && isValidReadingValue(obs.primary, "ft")) {
            reading.ft = Number(obs.primary);
        } else if (secondaryIsStage && obs.secondary != null && isValidReadingValue(obs.secondary, "ft")) {
            reading.ft = Number(obs.secondary);
        }
        
        let flowVal = null;
        if (primaryIsFlow && obs.primary != null && obs.primary !== "") flowVal = obs.primary;
        else if (secondaryIsFlow && obs.secondary != null && obs.secondary !== "") flowVal = obs.secondary;
        
        if (flowVal != null) {
            let finalFlow = Number(flowVal);
            if (data.primaryUnits === "kcfs" || data.secondaryUnits === "kcfs") {
                finalFlow *= 1000;
            }

            if (isValidReadingValue(finalFlow, "cfs")) {
                reading.cfs = finalFlow;
            }
        }
    });

    return readingMap;
}

const NWS_CONCURRENCY = 5;

const forEachSite = (siteCodes: string[], fn: (site: string) => Promise<void>) => forEachLimited(siteCodes, NWS_CONCURRENCY, fn);

/** Stageflow JSON; undefined when the gauge has none (404); null when the fetch failed. */
async function fetchStageflow(site: string, env?: any): Promise<any | null | undefined> {
    const url = `https://api.water.noaa.gov/nwps/v1/gauges/${site}/stageflow`;
    for (let attempts = 1; attempts <= 3; attempts++) {
        try {
            const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 60000);
            if (res.status === 404) return undefined;
            if (!res.ok) throw new Error(`NWPS HTTP Error: ${res.status}`);
            return await res.json();
        } catch (e: unknown) {
            if (attempts === 3) {
                const errorMsg = `NWPS Fetch failed for ${site}`;
                if (env) await logToD1(env, "WARN", "nws", errorMsg, e);
                else console.error(errorMsg, e);
                return null;
            }
            await new Promise(r => setTimeout(r, attempts * 2000));
        }
    }
    return null;
}

function toHistory(site: string, readingMap: Map<number, GaugeReading>): GaugeHistory {
    const readings = [...readingMap.keys()].sort((a, b) => a - b)
        .map(ts => readingMap.get(ts)!)
        .filter(r => Object.keys(r).some(k => k !== 'dateTime' && k !== 'isForecast'));
    const formatted = formatGaugeName(site, "NWS");
    return { id: site, name: formatted.name, section: formatted.section, readings, country: "US" };
}

const NWPS_BASE = 'https://api.water.noaa.gov/nwps/v1';
/**
 * Regions whose gauges are listed on the map without a river linking them. The unbounded
 * NWPS gauge list times out, so the list is fetched per box; a box returns every gauge in
 * it with its latest observation (about 1 MB for this one), and only MAP_STATES are kept.
 * To add a region, add its box and state.
 */
const MAP_BOXES = [{ xmin: -84.5, ymin: 33.7, xmax: -75.3, ymax: 36.7 }];
const MAP_STATES = new Set(['NC']);
const BULK_CACHE_SECONDS = 120;
/** A gauge not observed for this long is left off the map. */
const MAX_LISTING_AGE_MS = 3 * 24 * 60 * 60 * 1000;

/** Every gauge in the map regions, with its latest observation. One request per box, shared through the cache. */
async function fetchMapGauges(): Promise<any[]> {
    const byLid = new Map<string, any>();
    for (const box of MAP_BOXES) {
        const params = new URLSearchParams({
            'bbox.xmin': String(box.xmin), 'bbox.ymin': String(box.ymin),
            'bbox.xmax': String(box.xmax), 'bbox.ymax': String(box.ymax), srid: 'EPSG_4326',
        });
        const data = await edgeCachedJson(`${NWPS_BASE}/gauges?${params}`, { timeoutMs: 90000, ttlSeconds: BULK_CACHE_SECONDS, label: 'NWPS' });
        for (const g of data.gauges ?? []) {
            if (g?.lid && MAP_STATES.has(g.state?.abbreviation)) byLid.set(String(g.lid).toUpperCase(), g);
        }
    }
    return [...byLid.values()];
}

/** Tide gauges, which NWPS names by their water body or datum, are no use on a river map. */
const TIDAL_NAME = /\b(?:mllw|sound|atlantic coast|intracoastal|channel|bay|inlet|harbor)\b/i;

/** The latest observation NWPS carries on a gauge in the list, or null when it has none with a value. */
export function observedReading(gauge: any): GaugeReading | null {
    const o = gauge?.status?.observed;
    if (!o?.validTime || String(o.validTime).startsWith('0')) return null;
    const parsed = parseNWSeries({ primaryUnits: o.primaryUnit, secondaryUnits: o.secondaryUnit }, [o], 0, Date.now() + 3_600_000, false);
    const reading = [...parsed.values()][0];
    return reading && Object.keys(reading).some(k => k !== 'dateTime') ? reading : null;
}

export const nwsProvider: GaugeProvider = {
    id: "NWS",
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: true,
        hasSiteListing: true
    },

    /** Latest values for gauges in the map regions, from the bulk list (no per-gauge requests). */
    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        const requested = new Map(siteCodes.map(code => [code.toUpperCase(), code]));
        const results: Record<string, GaugeReading> = {};
        for (const gauge of await fetchMapGauges()) {
            const code = requested.get(String(gauge.lid).toUpperCase());
            const reading = code ? observedReading(gauge) : null;
            if (code && reading) results[code] = reading;
        }
        return results;
    },

    async getForecast(siteCodes: string[], env?: any): Promise<Record<string, GaugeHistory>> {
        const histories = await this.getHistory(siteCodes, Date.now(), undefined, true, env);
        for (const history of Object.values(histories)) {
            history.readings = history.readings.filter(r => r.isForecast);
        }
        return histories;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, includeForecast?: boolean, env?: any): Promise<Record<string, GaugeHistory>> {
        const maxTime = endTs ?? Date.now();
        const results: Record<string, GaugeHistory> = {};

        await forEachSite(siteCodes, async site => {
            const data = await fetchStageflow(site, env);
            if (!data) return;
            const readingMap = new Map<number, GaugeReading>();
            if (data.observed?.data) {
                parseNWSeries(data.observed, data.observed.data, startTs, maxTime, false)
                    .forEach((v, k) => readingMap.set(k, v));
            }
            if (includeForecast && data.forecast?.data) {
                parseNWSeries(data.forecast, data.forecast.data, startTs, maxTime, true)
                    .forEach((v, k) => readingMap.set(k, { ...readingMap.get(k), ...v, isForecast: true }));
            }
            results[site] = toHistory(site, readingMap);
        });
        return results;
    },

    /**
     * One unit per gauge: the whole observed series (null if the fetch
     * failed) and, separately, its forecast rows, so the two never collide.
     */
    async *getBulkHistories(siteCodes: string[], env?: any): AsyncGenerator<BulkUnit> {
        for (let i = 0; i < siteCodes.length; i += NWS_CONCURRENCY) {
            const batch = siteCodes.slice(i, i + NWS_CONCURRENCY);
            const fetched = await Promise.all(batch.map(site => fetchStageflow(site, env)));
            for (let j = 0; j < batch.length; j++) {
                const site = batch[j];
                const data = fetched[j];
                if (data === null) {
                    yield { unit: site, siteCodes: [site], histories: null };
                    continue;
                }
                const observed = data?.observed?.data
                    ? parseNWSeries(data.observed, data.observed.data, 0, Date.now(), false) : new Map();
                const forecast = data?.forecast?.data
                    ? [...parseNWSeries(data.forecast, data.forecast.data, 0, Date.now(), true).values()] : [];
                yield {
                    unit: site, siteCodes: [site],
                    histories: observed.size > 0 ? { [site]: toHistory(site, observed) } : {},
                    forecasts: forecast.length > 0 ? { [site]: forecast.toSorted((a, b) => a.dateTime - b.dateTime) } : undefined,
                };
            }
        }
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        const results: GaugeSite[] = [];
        const CONCURRENCY_LIMIT = 5;
        let index = 0;

        const worker = async () => {
             while (index < siteCodes.length) {
                 const site = siteCodes[index++];
                 try {
                     const res = await fetchWithTimeout(`https://api.water.noaa.gov/nwps/v1/gauges/${site}`, { headers: DEFAULT_HEADERS }, 60000);
                         if (res.ok) {
                             const data: any = await res.json();
                             if (data.latitude !== undefined && data.longitude !== undefined) {
                                  const formatted = formatGaugeName(data.name || site, "NWS");
                                  results.push({
                                      id: site,
                                      name: formatted.name,
                                      section: formatted.section,
                                      lat: data.latitude,
                                      lon: data.longitude,
                                      state: formatStateCode(data.state?.abbreviation, "NWS"),
                                      country: "US",
                                      usgsId: /^\d{8,15}$/.test(data.usgsId ?? "") ? data.usgsId : null,
                                  });
                             }
                         }
                 } catch (_e) {
                     console.warn(`NWS site listing failed for ${site}`, _e);
                 }
             }
        };
         await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
         return results;
     },

     /** River gauges in the map regions observed in the last few days: not tidal, and not a lake or dam elevation. */
     async getFullSiteListing(): Promise<GaugeSite[]> {
         const now = Date.now();
         return (await fetchMapGauges())
             .filter(g => now - Date.parse(g.status?.observed?.validTime ?? '') <= MAX_LISTING_AGE_MS)
             .filter(g => !TIDAL_NAME.test(g.name ?? ''))
             .filter(g => {
                 const ft = observedReading(g)?.ft;
                 return ft === undefined || isRiverStageFt(ft);
             })
             .map(g => {
                 const formatted = formatGaugeName(g.name || g.lid, "NWS");
                 return {
                     id: String(g.lid).toUpperCase(),
                     name: formatted.name,
                     section: formatted.section,
                     lat: g.latitude,
                     lon: g.longitude,
                     state: formatStateCode(g.state?.abbreviation, "NWS"),
                     country: "US",
                 };
             })
             .filter(site => typeof site.lat === 'number' && typeof site.lon === 'number');
     }
 };
