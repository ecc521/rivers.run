import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, BulkUnit, isValidReadingValue } from './provider';
import { formatStateCode, formatGaugeName } from '../utils/formatting';
import { fetchWithTimeout, DEFAULT_HEADERS } from '../utils/timeout';
import { logToD1 } from '../utils/logger';

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

async function forEachSite(siteCodes: string[], fn: (site: string) => Promise<void>): Promise<void> {
    let index = 0;
    const worker = async () => {
        while (index < siteCodes.length) await fn(siteCodes[index++]);
    };
    await Promise.all(Array.from({ length: NWS_CONCURRENCY }, worker));
}

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

export const nwsProvider: GaugeProvider = {
    id: "NWS",
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: true,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[], env?: any): Promise<Record<string, GaugeReading>> {
        // Fetch 3 hours to ensure we get at least one recent reading
        const histories = await this.getHistory(siteCodes, Date.now() - 10800000, Date.now(), false, env);
        const results: Record<string, GaugeReading> = {};
        
        Object.entries(histories).forEach(([id, history]) => {
            if (history.readings.length > 0) {
                results[id] = history.readings[history.readings.length - 1];
            }
        });
        
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

     async getFullSiteListing(): Promise<GaugeSite[]> {
         console.log("NWS Provider: Fetching full site listing...");
         const url = "https://api.water.noaa.gov/nwps/v1/gauges";
         const results: GaugeSite[] = [];
         
         try {
             const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 90000); // 90s timeout for NWS full list
             if (!res.ok) throw new Error(`NWS NWPS API Error: ${res.status}`);
             
             const data: any = await res.json();
             const items = data.gauges || [];
             
             for (const item of items) {
                 if (item.identifier && item.latitude !== undefined && item.longitude !== undefined) {
                     const formatted = formatGaugeName(item.name || item.identifier, "NWS");
                     results.push({
                         id: item.identifier,
                         name: formatted.name,
                         section: formatted.section,
                         lat: item.latitude,
                         lon: item.longitude,
                         state: formatStateCode(item.state?.abbreviation, "NWS"),
                         country: "US"
                     });
                 }
             }
         } catch (e) {
             console.error("NWS Provider: Full site listing failed", e);
             throw e;
         }
         
         return results;
     }
 };

