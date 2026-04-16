import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { formatStateCode } from '../utils/formatting';
import { formatGaugeName } from '../utils/formatting';

// Internal helper for mapping NWPS data arrays to GaugeReadings (exported for testing)
export function parseNWSeries(data: any, observations: any[], minTime: number, maxTime: number, isForecast: boolean): Map<number, GaugeReading> {
    const primaryIsStage = data.primaryUnits === "ft";
    const secondaryIsStage = data.secondaryUnits === "ft";
    const primaryIsFlow = data.primaryUnits === "kcfs" || data.primaryUnits === "cfs";
    const secondaryIsFlow = data.secondaryUnits === "kcfs" || data.secondaryUnits === "cfs";

    const readingMap = new Map<number, GaugeReading>();

    observations.forEach((obs: any) => {
        const rawTime = new Date(obs.validTime).getTime();
        if (rawTime < minTime || rawTime > maxTime) return;
        
        // Align timestamps like USGS to Nearest 5 minutes
        const snappedTime = Math.round(rawTime / 300000) * 300000;
        if (!readingMap.has(snappedTime)) {
            readingMap.set(snappedTime, { dateTime: snappedTime, ...(isForecast && { isForecast: true }) });
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

export const nwsProvider: GaugeProvider = {
    id: "NWS",
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: true,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        // Fetch 3 hours to ensure we get at least one recent reading
        const histories = await this.getHistory(siteCodes, Date.now() - 10800000, Date.now(), false);
        const results: Record<string, GaugeReading> = {};
        
        Object.entries(histories).forEach(([id, history]) => {
            if (history.readings.length > 0) {
                results[id] = history.readings[history.readings.length - 1];
            }
        });
        
        return results;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, includeForecast?: boolean): Promise<Record<string, GaugeHistory>> {
        const maxTime = endTs ?? Date.now();
        const results: Record<string, GaugeHistory> = {};
        
        const CONCURRENCY_LIMIT = 5;
        let index = 0;

        const worker = async () => {
            while (index < siteCodes.length) {
                const site = siteCodes[index++];
                const url = `https://api.water.noaa.gov/nwps/v1/gauges/${site}/stageflow`;
                let attempts = 0;
                let success = false;
                while (!success && attempts <= 2) {
                    try {
                        const res = await fetch(url);
                        if (!res.ok) {
                            if (res.status === 404) break;
                            throw new Error(`NWPS HTTP Error: ${res.status}`);
                        }
                        
                        const data: any = await res.json();
                        
                        const readingMap = new Map<number, GaugeReading>();
                        
                        // Parse Observed
                        if (data.observed?.data) {
                           const parsedObs = parseNWSeries(data.observed, data.observed.data, startTs, maxTime, false);
                           parsedObs.forEach((v, k) => readingMap.set(k, v));
                        }

                        // Parse Forecast
                        if (includeForecast && data.forecast?.data) {
                           const parsedFcst = parseNWSeries(data.forecast, data.forecast.data, startTs, maxTime, true);
                           parsedFcst.forEach((v, k) => {
                               // Overwrite or append forecast
                               readingMap.set(k, { ...readingMap.get(k), ...v, isForecast: true });
                           });
                        }

                        const timestamps = Array.from(readingMap.keys()).sort((a, b) => a - b);
                        const readings = timestamps
                            .map(ts => readingMap.get(ts)!)
                            .filter(r => {
                                const keys = Object.keys(r);
                                return keys.some(k => k !== 'dateTime' && k !== 'isForecast');
                            });

                        const formatted = formatGaugeName(site);
                        results[site] = {
                            id: site,
                            name: formatted.name,
                            section: formatted.section,
                            readings
                        };
                        success = true;
                    } catch (_e: unknown) {
                        attempts++;
                        if (attempts > 2) {
                            console.error(`NWPS Fetch failed for ${site}`, _e);
                        } else {
                            await new Promise(r => setTimeout(r, attempts * 2000));
                        }
                    }
                }
            }
        };

        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return results;
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        const results: GaugeSite[] = [];
        const CONCURRENCY_LIMIT = 5;
        let index = 0;

        const worker = async () => {
             while (index < siteCodes.length) {
                 const site = siteCodes[index++];
                 try {
                     const res = await fetch(`https://api.water.noaa.gov/nwps/v1/gauges/${site}`);
                         if (res.ok) {
                             const data: any = await res.json();
                             if (data.latitude !== undefined && data.longitude !== undefined) {
                                 const formatted = formatGaugeName(data.name || site);
                                 results.push({
                                     id: site,
                                     name: formatted.section ? `${formatted.name} ${formatted.section}` : formatted.name,
                                     lat: data.latitude,
                                     lon: data.longitude
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
             const res = await fetch(url);
             if (!res.ok) throw new Error(`NWS NWPS API Error: ${res.status}`);
             
             const data: any = await res.json();
             const items = data.gauges || [];
             
             for (const item of items) {
                 if (item.identifier && item.latitude !== undefined && item.longitude !== undefined) {
                     const formatted = formatGaugeName(item.name || item.identifier);
                     results.push({
                         id: item.identifier,
                         name: formatted.section ? `${formatted.name} ${formatted.section}` : formatted.name,
                         lat: item.latitude,
                         lon: item.longitude,
                         state: formatStateCode(item.state?.abbreviation, "NWS")
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

