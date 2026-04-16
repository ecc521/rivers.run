import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { formatGaugeName } from '../utils/formatting';

const states = [
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "dc", "fl", "ga",
  "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma",
  "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny",
  "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx",
  "ut", "vt", "va", "wa", "wv", "wi", "wy", "pr", "vi"
];


// Parses the USGS output back into legacy formatting/GaugeHistory
export function processUSGSResponse(obj: any): Record<string, GaugeHistory> {
  const timeSeries = obj.value.timeSeries || [];
  const usgsSites: Record<string, GaugeHistory> = {};

  for (let i = 0; i < timeSeries.length; i++) {
    const seriesItem = timeSeries[i];
    const sourceInfo = seriesItem.sourceInfo;
    const siteCode = sourceInfo.siteCode[0].value;

    if (!usgsSites[siteCode]) {
      const formatted = formatGaugeName(sourceInfo.siteName);
      usgsSites[siteCode] = {
        id: siteCode,
        name: formatted.name,
        section: formatted.section,
        readings: [],
      };
      
      // Attempt to populate lat/lon if present
      if (sourceInfo.geoLocation?.geogLocation) {
        usgsSites[siteCode].lat = sourceInfo.geoLocation.geogLocation.latitude;
        usgsSites[siteCode].lon = sourceInfo.geoLocation.geogLocation.longitude;
      }
    }
    const siteObj = usgsSites[siteCode];
    let values = seriesItem.values[0].value || [];

    const rawNoDataValue = seriesItem.variable?.noDataValue;
    if (rawNoDataValue !== null && rawNoDataValue !== undefined && rawNoDataValue !== "") {
      const noDataValue = Number(rawNoDataValue);
      values = values.filter((val: any) => Number(val.value) !== noDataValue);
    }

    let property: keyof GaugeReading | undefined;
    const unitCode = seriesItem.variable.unit.unitCode;
    
    switch (unitCode) {
      case "deg C":
        values.forEach((val: any) => {
          const tempInF = Number(val.value) * 1.8 + 32;
          val.value = Math.round(tempInF * 100) / 100;
        });
      // Fall through intentional (legacy logic mapped deg C -> F and logged as temp)
      case "deg F":
        property = "temp_f";
        break;
      case "ft3/s":
        property = "cfs";
        break;
      case "ft":
        property = "ft";
        break;
      case "in":
        property = "precip_in";
        break;
      default:
        continue;
    }

    if (property) {
      // Build a map of dateTime matched to values
      // Note: we'll augment readings array efficiently.
      // But we need to group by time (snapped to 5 mins).
      // Let's use a temporary map per site.
      (siteObj as any)._readingMap = (siteObj as any)._readingMap || new Map<number, GaugeReading>();
      const readingMap = (siteObj as any)._readingMap;

      values.forEach((val: any) => {
        const rawTime = new Date(val.dateTime).getTime();
        const snappedTime = Math.round(rawTime / 300000) * 300000;
        
        let currentReading = readingMap.get(snappedTime);
        if (!currentReading) {
          currentReading = { dateTime: snappedTime };
          readingMap.set(snappedTime, currentReading);
        }
        if (isValidReadingValue(val.value, property)) {
          (currentReading as any)[property] = Number(val.value);
        }
      });
    }
  }

  // Combine and sort timestamps
  for (const gaugeID in usgsSites) {
    const site = usgsSites[gaugeID];
    if ((site as any)._readingMap) {
        const readingMap = (site as any)._readingMap as Map<number, GaugeReading>;
        const timestamps = Array.from(readingMap.keys()).sort((a, b) => a - b);
        site.readings = timestamps
            .map(ts => readingMap.get(ts)!)
            .filter(r => {
                // Keep if it has at least one property other than dateTime and isForecast
                const keys = Object.keys(r);
                return keys.some(k => k !== 'dateTime' && k !== 'isForecast');
            });
        delete (site as any)._readingMap;
    }
  }

  return usgsSites;
}

// Reusable batch fetcher
async function fetchUSGSBatch(siteCodes: string[], timeQuery: string): Promise<Record<string, GaugeHistory>> {
    const BATCH_SIZE = 150;
    const allSites: Record<string, GaugeHistory> = {};

    const batches: string[][] = [];
    for (let i = 0; i < siteCodes.length; i += BATCH_SIZE) {
        batches.push(siteCodes.slice(i, i + BATCH_SIZE));
    }

    const CONCURRENCY_LIMIT = 3;
    let batchIndex = 0;

    const worker = async () => {
        while (batchIndex < batches.length) {
            const batch = batches[batchIndex++];
            const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${batch.join(",")}${timeQuery}&parameterCd=00060,00065,00010,00011,00045&siteStatus=all`;
            
            let success = false;
            let attempts = 0;
            const MAX_RETRIES = 2;

            while (!success && attempts <= MAX_RETRIES) {
                try {
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(`USGS HTTP Error: ${res.status}`);
                    
                    const data = await res.json();
                    const processedSites = processUSGSResponse(data);
                    Object.assign(allSites, processedSites);
                    success = true;
                } catch (e: unknown) {
                    attempts++;
                    const msg = e instanceof Error ? e.message : String(e);
                    if (attempts > MAX_RETRIES) {
                        console.error(`USGS Fetch failed completely for batch after ${attempts} attempts, skipping: ${msg}`);
                    } else {
                        console.warn(`USGS Fetch failed (Attempt ${attempts}/${MAX_RETRIES + 1}), backing off... Error: ${msg}`);
                        await new Promise(r => setTimeout(r, attempts * 3000));
                    }
                }
            }
        }
    };

    await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
    return allSites;
}

export const usgsProvider: GaugeProvider = {
    id: "USGS",
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        const histories = await fetchUSGSBatch(siteCodes, "&period=PT4H"); // fetch recent 4 hours
        const latest: Record<string, GaugeReading> = {};
        for (const [id, history] of Object.entries(histories)) {
            if (history.readings.length > 0) {
                // Return the last element
                latest[id] = history.readings[history.readings.length - 1];
            }
        }
        return latest;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, _includeForecast?: boolean): Promise<Record<string, GaugeHistory>> {
        const startIso = new Date(startTs).toISOString();
        const timeQuery = endTs 
            ? `&startDT=${startIso}&endDT=${new Date(endTs).toISOString()}`
            : `&startDT=${startIso}`;
            
        return fetchUSGSBatch(siteCodes, timeQuery);
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        if (siteCodes.length === 0) return [];
        // The IV endpoint returns geoLocation in the timeSeries sourceInfo payload if recent data exists.
        // Even if water data is missing, we grab a tiny timeframe just to get site metadata
        const histories = await fetchUSGSBatch(siteCodes, "&period=PT1H");
        const sites: GaugeSite[] = [];
        
        for (const id of siteCodes) {
            const hist = histories[id];
            if (hist && (hist as any).lat !== undefined) {
                sites.push({
                    id,
                    name: hist.name, // optionally format name
                    lat: (hist as any).lat,
                    lon: (hist as any).lon
                });
            }
        }
        return sites;
    },

    async getFullSiteListing(): Promise<GaugeSite[]> {
        console.log("USGS Provider: Starting full site discovery crawl...");
        const gaugeRegistry: Record<string, GaugeSite> = {};
        
        let stateIndex = 0;
        const CONCURRENCY_LIMIT = 5;
        
        const worker = async () => {
            while (stateIndex < states.length) {
                const state = states[stateIndex++];
                const url = `https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=${state}&siteStatus=active&siteType=ST&hasDataTypeCd=iv&siteOutput=expanded`;
                
                let success = false;
                let attempts = 0;
                const MAX_RETRIES = 2;
                
                while (!success && attempts <= MAX_RETRIES) {
                    try {
                        const res = await fetch(url);
                        if (!res.ok) throw new Error(`USGS HTTP Error: ${res.status}`);
                        const text = await res.text();
                        const lines = text.split('\n');
                        let headers: string[] = [];
                        
                        for (let line of lines) {
                            line = line.trimEnd();
                            if (!line || line.startsWith('#') || line.includes('5s') || line.includes('15s')) continue;
                            
                            if (line.includes('agency_cd')) {
                                headers = line.split('\t');
                                continue;
                            }

                            const tokens = line.split('\t');
                            if (tokens.length >= headers.length && headers.length > 0) {
                                const idIndex = headers.indexOf('site_no');
                                const nameIndex = headers.indexOf('station_nm');
                                const latIndex = headers.indexOf('dec_lat_va');
                                const lonIndex = headers.indexOf('dec_long_va');
                                
                                if (idIndex > -1 && nameIndex > -1 && latIndex > -1 && lonIndex > -1) {
                                    const rawId = tokens[idIndex];
                                    const fullName = formatGaugeName(tokens[nameIndex]);
                                    const lat = parseFloat(tokens[latIndex]);
                                    const lon = parseFloat(tokens[lonIndex]);
                                    if (!isNaN(lat) && !isNaN(lon)) {
                                        gaugeRegistry[rawId] = { 
                                            id: rawId, 
                                            name: fullName.name, 
                                            lat, 
                                            lon,
                                            state: state.toUpperCase()
                                        };
                                    }
                                }
                            }
                        }
                        success = true;
                    } catch (_e: unknown) {
                        attempts++;
                        if (attempts > MAX_RETRIES) {
                            console.error(`- Failed USGS discovery for state ${state}`, _e);
                        } else {
                            await new Promise(r => setTimeout(r, attempts * 1000));
                        }
                    }
                }
            }
        };

        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return Object.values(gaugeRegistry);
    }
};

