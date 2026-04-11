// NWS/NWPS data fetcher
export async function loadSitesFromNWS(siteCodes: string[], timeInPastMs = 1000 * 60 * 60 * 3): Promise<any> {
    const nwsSites: any = {};
    const CONCURRENCY_LIMIT = 5;
    let index = 0;

    const worker = async () => {
        while (index < siteCodes.length) {
            const site = siteCodes[index++];
            const url = `https://api.water.noaa.gov/nwps/v1/gauges/${site}/stageflow`;
            let success = false;
            let attempts = 0;
            const MAX_RETRIES = 2;
            
            while (!success && attempts <= MAX_RETRIES) {
                try {
                    const res = await fetch(url);
                    if (!res.ok) {
                        // 404 means gauge might not have stageflow data, skip gracefully
                        if (res.status === 404) {
                            break;
                        }
                        throw new Error(`NWPS HTTP Error: ${res.status}`);
                    }
                    
                    const data: any = await res.json();
                    
                    if (!nwsSites[site]) {
                        nwsSites[site] = {
                            name: `NWS Gauge ${site}`, // Name gets mapped over in index.ts via gaugeRegistry
                            readings: []
                        };
                    }
                    
                    const minTime = Date.now() - timeInPastMs;
                    const primaryIsStage = data.observed?.primaryUnits === "ft";
                    const secondaryIsStage = data.observed?.secondaryUnits === "ft";
                    const primaryIsFlow = data.observed?.primaryUnits === "kcfs" || data.observed?.primaryUnits === "cfs";
                    const secondaryIsFlow = data.observed?.secondaryUnits === "kcfs" || data.observed?.secondaryUnits === "cfs";

                    const observations = data.observed?.data || [];
                    const siteObj = nwsSites[site];
                    const readingMap = new Map();

                    observations.forEach((obs: any) => {
                        const rawTime = new Date(obs.validTime).getTime();
                        if (rawTime < minTime) return;
                        
                        // Align timestamps like USGS to Nearest 5 minutes
                        const snappedTime = Math.round(rawTime / 300000) * 300000;
                        if (!readingMap.has(snappedTime)) {
                            readingMap.set(snappedTime, { dateTime: snappedTime });
                        }
                        
                        const reading = readingMap.get(snappedTime);
                        
                        if (primaryIsStage && obs.primary != null) reading.ft = Number(obs.primary);
                        else if (secondaryIsStage && obs.secondary != null) reading.ft = Number(obs.secondary);
                        
                        let flowVal = null;
                        if (primaryIsFlow && obs.primary != null) flowVal = obs.primary;
                        else if (secondaryIsFlow && obs.secondary != null) flowVal = obs.secondary;
                        
                        if (flowVal != null) {
                            // If kcfs, multiply by 1000
                            if (data.observed?.primaryUnits === "kcfs" || data.observed?.secondaryUnits === "kcfs") {
                                reading.cfs = Number(flowVal) * 1000;
                            } else {
                                reading.cfs = Number(flowVal);
                            }
                        }
                    });

                    const timestamps = Array.from(readingMap.keys()).sort((a: any, b: any) => a - b);
                    timestamps.forEach(ts => {
                        siteObj.readings.push(readingMap.get(ts));
                    });

                    success = true;
                } catch (e: unknown) {
                    attempts++;
                    const msg = e instanceof Error ? e.message : String(e);
                    if (attempts > MAX_RETRIES) {
                        console.error(`NWPS Fetch failed heavily for ${site}, skipping: ${msg}`);
                    } else {
                        await new Promise(r => setTimeout(r, attempts * 2000));
                    }
                }
            }
        }
    };

    await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
    return nwsSites;
}
