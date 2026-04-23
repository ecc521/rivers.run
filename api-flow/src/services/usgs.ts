import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { formatGaugeName } from '../utils/formatting';
import { fetchWithTimeout, DEFAULT_HEADERS } from '../utils/timeout';
import { logToD1 } from '../utils/logger';

const states = [
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "dc", "fl", "ga",
  "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md", "ma",
  "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj", "nm", "ny",
  "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx",
  "ut", "vt", "va", "wa", "wv", "wi", "wy", "pr", "vi"
];

// --- HELPERS FOR processUSGSResponse ---

function initializeSiteIfMissing(usgsSites: Record<string, GaugeHistory>, siteCode: string, sourceInfo: any) {
  if (!usgsSites[siteCode]) {
    const formatted = formatGaugeName(sourceInfo.siteName, "USGS");
    usgsSites[siteCode] = {
      id: siteCode,
      name: formatted.name,
      section: formatted.section,
      readings: [],
      country: "US"
    };
    
    // Attempt to populate lat/lon if present
    if (sourceInfo.geoLocation?.geogLocation) {
      usgsSites[siteCode].lat = sourceInfo.geoLocation.geogLocation.latitude;
      usgsSites[siteCode].lon = sourceInfo.geoLocation.geogLocation.longitude;
    }
  }
  return usgsSites[siteCode];
}

function processSiteTimeSeries(seriesItem: any, siteObj: any) {
  let values = seriesItem.values?.[0]?.value || [];
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
      property = "temp_f";
      break;
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
      return; // unsupported unit
  }

  if (!property) return;
  
  siteObj._readingMap = siteObj._readingMap || new Map<number, GaugeReading>();
  const readingMap = siteObj._readingMap;

  values.forEach((val: any) => {
    const rawTime = new Date(val.dateTime).getTime();
    const snappedTime = Math.round(rawTime / 300000) * 300000;
    
    let currentReading = readingMap.get(snappedTime);
    if (!currentReading) {
      currentReading = { dateTime: snappedTime };
      readingMap.set(snappedTime, currentReading);
    }
    if (isValidReadingValue(val.value, property!)) {
      (currentReading as any)[property!] = Number(val.value);
    }
  });
}

function finalizeSiteReadings(usgsSites: Record<string, GaugeHistory>) {
  for (const gaugeID in usgsSites) {
    const site = usgsSites[gaugeID];
    if ((site as any)._readingMap) {
        const readingMap = (site as any)._readingMap as Map<number, GaugeReading>;
        const timestamps = Array.from(readingMap.keys()).sort((a, b) => a - b);
        site.readings = timestamps
            .map(ts => readingMap.get(ts)!)
            .filter(r => {
                const keys = Object.keys(r);
                return keys.some(k => k !== 'dateTime' && k !== 'isForecast');
            });
        delete (site as any)._readingMap;
    }
  }
}

// Parses the USGS output back into legacy formatting/GaugeHistory
export function processUSGSResponse(obj: any): Record<string, GaugeHistory> {
  const timeSeries = obj.value.timeSeries || [];
  const usgsSites: Record<string, GaugeHistory> = {};

  for (let i = 0; i < timeSeries.length; i++) {
    const seriesItem = timeSeries[i];
    const sourceInfo = seriesItem.sourceInfo;
    const siteCode = sourceInfo.siteCode[0].value;
    
    const siteObj = initializeSiteIfMissing(usgsSites, siteCode, sourceInfo);
    processSiteTimeSeries(seriesItem, siteObj);
  }

  finalizeSiteReadings(usgsSites);
  return usgsSites;
}

// --- HELPERS FOR fetchUSGSBatch ---

async function fetchAndProcessSingleBatch(batch: string[], timeQuery: string, allSites: Record<string, GaugeHistory>, env?: any) {
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${batch.join(",")}${timeQuery}&parameterCd=00060,00065,00010,00011,00045&siteStatus=all`;
    let success = false;
    let attempts = 0;
    const MAX_RETRIES = 2;

    while (!success && attempts <= MAX_RETRIES) {
        try {
            const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 90000); // 90s timeout for batches
            if (!res.ok) throw new Error(`USGS HTTP Error: ${res.status}`);
            
            const data = await res.json();
            const processedSites = processUSGSResponse(data);
            Object.assign(allSites, processedSites);
            success = true;
        } catch (e: unknown) {
            attempts++;
            const msg = e instanceof Error ? e.message : String(e);
            if (attempts > MAX_RETRIES) {
                const errorMsg = `USGS Fetch failed completely for batch (${batch.length} sites) after ${attempts} attempts: ${msg}`;
                if (env) {
                    await logToD1(env, "WARN", "usgs", errorMsg, { url });
                } else {
                    console.warn(errorMsg);
                }
            } else {
                console.warn(`USGS Fetch failed (Attempt ${attempts}/${MAX_RETRIES + 1}), backing off... Error: ${msg}`);
                await new Promise(r => setTimeout(r, attempts * 3000));
            }
        }
    }
}

async function fetchUSGSBatch(siteCodes: string[], timeQuery: string, env?: any): Promise<Record<string, GaugeHistory>> {
    const BATCH_SIZE = 200;
    const allSites: Record<string, GaugeHistory> = {};
    const batches: string[][] = [];
    
    // Filter out any IDs that contain non-digits. Valid USGS site IDs are strictly 8-15 digits.
    // If a non-digit ID is passed to the USGS API, it returns 400 Bad Request for the entire batch,
    // which completely drops data for all 150 gauges in that bucket.
    const validSiteCodes = siteCodes.filter(id => /^\d+$/.test(id));
    
    for (let i = 0; i < validSiteCodes.length; i += BATCH_SIZE) {
        batches.push(validSiteCodes.slice(i, i + BATCH_SIZE));
    }

    const CONCURRENCY_LIMIT = 4;
    let batchIndex = 0;

    const worker = async () => {
        while (batchIndex < batches.length) {
            const batch = batches[batchIndex++];
            await fetchAndProcessSingleBatch(batch, timeQuery, allSites, env);
        }
    };

    await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
    return allSites;
}

// --- HELPERS FOR getFullSiteListing ---

function parseRDBLines(text: string, state: string, gaugeRegistry: Record<string, GaugeSite>) {
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
                const fullName = formatGaugeName(tokens[nameIndex], "USGS");
                const lat = parseFloat(tokens[latIndex]);
                const lon = parseFloat(tokens[lonIndex]);
                if (!isNaN(lat) && !isNaN(lon)) {
                    gaugeRegistry[rawId] = { 
                        id: rawId, 
                        name: fullName.name, 
                        lat, 
                        lon,
                        state: state.toUpperCase(),
                        country: "US"
                    };
                }
            }
        }
    }
}

async function fetchStateSites(state: string, gaugeRegistry: Record<string, GaugeSite>) {
    const url = `https://waterservices.usgs.gov/nwis/site/?format=rdb&stateCd=${state}&siteStatus=active&siteType=ST&hasDataTypeCd=iv&parameterCd=00060&siteOutput=expanded`;
    let success = false;
    let attempts = 0;
    const MAX_RETRIES = 2;
    
    while (!success && attempts <= MAX_RETRIES) {
        try {
            // Increased to 120s for large USGS site listings
            const res = await fetchWithTimeout(url, { headers: { ...DEFAULT_HEADERS, 'Accept': 'text/plain' } }, 120000);
            if (!res.ok) throw new Error(`USGS HTTP Error: ${res.status}`);
            
            const text = await res.text();
            parseRDBLines(text, state, gaugeRegistry);
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

export const usgsProvider: GaugeProvider = {
    id: "USGS",
    preferredUnits: 'imperial',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[], env?: any): Promise<Record<string, GaugeReading>> {
        const histories = await fetchUSGSBatch(siteCodes, "&period=PT3H", env); // fetch recent 3 hours
        const latest: Record<string, GaugeReading> = {};
        for (const [id, history] of Object.entries(histories)) {
            if (history.readings.length > 0) {
                latest[id] = history.readings[history.readings.length - 1];
            }
        }
        return latest;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, _includeForecast?: boolean, env?: any): Promise<Record<string, GaugeHistory>> {
        const now = Date.now();
        // If the request is for the last 30 days and ends "now" (within 10 mins), use period.
        // USGS period is much more robust and faster for recent data.
        const isUntilNow = !endTs || Math.abs(endTs - now) < 600000;
        const durationMs = (endTs || now) - startTs;
        
        if (isUntilNow && durationMs > 0 && durationMs < 30 * 24 * 60 * 60 * 1000) {
            const hours = Math.ceil(durationMs / 3600000);
            return fetchUSGSBatch(siteCodes, `&period=PT${hours}H`, env);
        }

        // Standard formatting for older historical queries. 
        // USGS NWIS prefers YYYY-MM-DDTHH:mm:ss (no millis, no Z if offset not specified).
        const toUSGSDate = (ts: number) => new Date(ts).toISOString().split('.')[0];
        
        const timeQuery = endTs 
            ? `&startDT=${toUSGSDate(startTs)}&endDT=${toUSGSDate(endTs)}`
            : `&startDT=${toUSGSDate(startTs)}`;
            
        return fetchUSGSBatch(siteCodes, timeQuery, env);
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        if (siteCodes.length === 0) return [];
        const histories = await fetchUSGSBatch(siteCodes, "&period=PT1H");
        const sites: GaugeSite[] = [];
        
        for (const id of siteCodes) {
            const hist = histories[id];
            if (hist && (hist as any).lat !== undefined) {
                sites.push({
                    id,
                    name: hist.name,
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
        
        // USGS allows multiple states in one request. We batch them (5 at a time) 
        // to reduce the total number of subrequests while avoiding URI length issues.
        const stateBatches: string[] = [];
        const STATE_BATCH_SIZE = 5;
        for (let i = 0; i < states.length; i += STATE_BATCH_SIZE) {
            stateBatches.push(states.slice(i, i + STATE_BATCH_SIZE).join(","));
        }

        let batchIndex = 0;
        const CONCURRENCY_LIMIT = 3; // Keep it modest for registry crawls
        
        const worker = async () => {
            while (batchIndex < stateBatches.length) {
                const batch = stateBatches[batchIndex++];
                await fetchStateSites(batch, gaugeRegistry);
            }
        };

        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return Object.values(gaugeRegistry);
    }
};
