import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite } from './provider';

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
        
        if (primaryIsStage && obs.primary != null) reading.ft = Number(obs.primary);
        else if (secondaryIsStage && obs.secondary != null) reading.ft = Number(obs.secondary);
        
        let flowVal = null;
        if (primaryIsFlow && obs.primary != null) flowVal = obs.primary;
        else if (secondaryIsFlow && obs.secondary != null) flowVal = obs.secondary;
        
        if (flowVal != null) {
            // If kcfs, multiply by 1000
            if (data.primaryUnits === "kcfs" || data.secondaryUnits === "kcfs") {
                reading.cfs = Number(flowVal) * 1000;
            } else {
                reading.cfs = Number(flowVal);
            }
        }
    });

    return readingMap;
}

export const nwsProvider: GaugeProvider = {
    id: "NWS",
    capabilities: {
        hasForecast: true,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        // NWS NWPS API does not support time-bound filters on stageflow. 
        // Fetching "latest" returns a 1.34MB payload per gauge. 
        // Disabled per user request to prevent excessive bandwidth polling. Use USGS instead.
        console.warn("NWS /latest is disabled due to excessive API bandwidth. Please use USGS or getHistory.");
        return {};
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
                        const readings = timestamps.map(ts => readingMap.get(ts)!);

                        results[site] = {
                            id: site,
                            name: `NWS Gauge ${site}`, // Registry typically handles renaming
                            readings
                        };
                        success = true;
                    } catch (e: unknown) {
                        attempts++;
                        if (attempts > 2) {
                            console.error(`NWPS Fetch failed for ${site}`);
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
                             results.push({
                                 id: site,
                                 name: data.name || site,
                                 lat: data.latitude,
                                 lon: data.longitude
                             });
                         }
                     }
                 } catch (e) {}
             }
        };
        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return results;
    }
};

