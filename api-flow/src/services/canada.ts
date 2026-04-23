import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { formatStateCode, formatGaugeName } from '../utils/formatting';

import { fetchWithTimeout, DEFAULT_HEADERS } from '../utils/timeout';



export function processCanadaCSV(text: string, startTs: number, endTs: number): Record<string, GaugeHistory> {
    if (!text || text.length < 10) return {};

    const gaugeReadingsBySite: Record<string, any[]> = {};
    
    let pos = 0;
    const endPos = text.length;
    let lineCount = 0;
    
    let idIdx = -1;
    let dateIdx = -1;
    let levelIdx = -1;
    let cmsIdx = -1;

    while (pos < endPos) {
        let nextNewline = text.indexOf('\n', pos);
        if (nextNewline === -1) nextNewline = endPos;
        
        const line = text.substring(pos, nextNewline).trim();
        pos = nextNewline + 1;
        
        if (!line) continue;
        lineCount++;
        
        // Manual split to avoid creating too many temporary strings
        const row = line.split(',').map(c => c.replace(/["\r]/g, '').trim());
        
        if (lineCount === 1) {
            const headers = row;
            idIdx = headers.indexOf('ID') !== -1 ? headers.indexOf('ID') : 0;
            dateIdx = headers.indexOf('Date');
            levelIdx = headers.indexOf("Water Level / Niveau d'eau (m)");
            cmsIdx = headers.indexOf("Discharge / Débit (cms)");
            if (dateIdx === -1) return {}; 
            continue;
        }

        if (row.length < 2) continue;
        
        const id = row[idIdx];
        if (!id) continue;
        
        const rawDateStr = row[dateIdx];
        if (!rawDateStr) continue;

        // Parse date and filter early to save memory
        const dt = new Date(rawDateStr).getTime();
        if (isNaN(dt) || dt < startTs || dt > endTs) continue;

        if (!gaugeReadingsBySite[id]) gaugeReadingsBySite[id] = [];
        
        gaugeReadingsBySite[id].push({
            dateTime: dt,
            m: levelIdx !== -1 ? row[levelIdx] : undefined,
            cms: cmsIdx !== -1 ? row[cmsIdx] : undefined
        });
    }

    const outputGauges: Record<string, GaugeHistory> = {};

    for (const gaugeID in gaugeReadingsBySite) {
        const results = gaugeReadingsBySite[gaugeID];
        
        // Re-use reformat logic but skip the Date parsing part since we did it above
        for (let i = 0; i < results.length; i++) {
            const reading = results[i];
            if (reading.cms !== undefined) {
                const val = parseFloat(reading.cms);
                if (!isNaN(val) && val !== -999 && isValidReadingValue(val, "cms")) {
                    reading.cms = val;
                } else {
                    delete reading.cms;
                }
            }
            if (reading.m !== undefined) {
                const val = parseFloat(reading.m);
                if (!isNaN(val) && val !== -999 && isValidReadingValue(val, "m")) {
                    reading.m = val;
                } else {
                    delete reading.m;
                }
            }
        }
        results.sort((a, b) => a.dateTime - b.dateTime);

        const trimmed = results.filter((r: any) => {
            // Keep if it has at least one data property
            const keys = Object.keys(r);
            return keys.some(k => k !== 'dateTime' && k !== 'isForecast');
        });
        
        if (trimmed.length > 0) {
            const hasCms = trimmed.some(r => r.cms !== undefined);
            outputGauges[gaugeID] = {
                id: gaugeID,
                name: `EC Gauge ${gaugeID}`,
                readings: trimmed,
                units: hasCms ? "cms" : "m",
                country: "CA"
            };
        }
    }

    return outputGauges;
}

const ALL_PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

const PREFIX_TO_PROVINCES: Record<string, string[]> = {
    "01": ["NB", "NS", "PE"],
    "02": ["QC", "ON", "NL"],
    "03": ["NL"],
    "04": ["ON", "MB"],
    "05": ["AB", "SK", "MB", "ON"],
    "06": ["MB", "SK", "AB", "NT", "NU"],
    "07": ["BC", "AB", "SK", "NT"],
    "08": ["BC", "YT"],
    "09": ["BC", "YT"],
    "10": ["NT", "NU", "BC", "YT"],
    "11": ["SK", "AB"]
};

function getProvincesForSite(siteID: string): string[] {
    const provPrefix = siteID.substring(0, 2).toUpperCase();
    if (ALL_PROVINCES.includes(provPrefix)) return [provPrefix];
    return PREFIX_TO_PROVINCES[provPrefix] || ALL_PROVINCES;
}

async function fetchCanadianProvince(province: string, startTs: number, endTs: number): Promise<Record<string, GaugeHistory>> {
    const url = `https://dd.weather.gc.ca/today/hydrometric/csv/${province}/hourly/${province}_hourly_hydrometric.csv`;
    try {
        const res = await fetchWithTimeout(url, {
            headers: {
                ...DEFAULT_HEADERS,
                'Accept': 'text/csv, application/csv'
            }
        }, 90000);
        if (!res.ok) return {};
        const text = await res.text();
        return processCanadaCSV(text, startTs, endTs);
    } catch {
        return {};
    }
}

async function fetchIndividualCanadaGauge(stationID: string, province: string, startTs: number, endTs: number): Promise<GaugeHistory | null> {
    const url = `https://dd.weather.gc.ca/today/hydrometric/csv/${province}/hourly/${province}_${stationID}_hourly_hydrometric.csv`;
    try {
        const res = await fetchWithTimeout(url, {
            headers: {
                ...DEFAULT_HEADERS,
                'Accept': 'text/csv, application/csv'
            }
        }, 60000);
        if (!res.ok) return null;
        const text = await res.text();
        const data = processCanadaCSV(text, startTs, endTs);
        return data[stationID] || null;
    } catch {
        return null;
    }
}

export const ecProvider: GaugeProvider = {
    id: "EC", 
    preferredUnits: 'metric',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[], _env?: any): Promise<Record<string, GaugeReading>> {
        const results: Record<string, GaugeReading> = {};
        const startTs = Date.now() - (1000 * 60 * 60 * 6); // 6 hours
        const endTs = Date.now() + 1000 * 60 * 60 * 24; // buffer

        // If a small number of sites, fetch individually
        if (siteCodes.length <= 10) {
            const fetches = siteCodes.flatMap(site => {
                const provs = getProvincesForSite(site);
                return provs.map(p => fetchIndividualCanadaGauge(site, p, startTs, endTs));
            });
            const arr = await Promise.all(fetches);
            arr.forEach(hist => {
                if (hist && hist.readings.length > 0) {
                    results[hist.id] = hist.readings[hist.readings.length - 1];
                }
            });
            return results;
        }

        const provincesToFetch = new Set<string>();
        siteCodes.forEach(code => {
             const provs = getProvincesForSite(code);
             provs.forEach(p => provincesToFetch.add(p));
        });

        const fetches = Array.from(provincesToFetch).map(p => fetchCanadianProvince(p, startTs, endTs));
        const arr = await Promise.all(fetches);

        for (const provData of arr) {
            for (const siteCode of siteCodes) {
                if (provData[siteCode] && provData[siteCode].readings.length > 0) {
                    const rdgs = provData[siteCode].readings;
                    results[siteCode] = rdgs[rdgs.length - 1]; // latest
                }
            }
        }
        return results;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, _includeForecast?: boolean, _env?: any): Promise<Record<string, GaugeHistory>> {
        const maxTime = endTs ?? Date.now();
        const results: Record<string, GaugeHistory> = {};

        // If a small number of sites, fetch individually
        if (siteCodes.length <= 5) {
            const fetches = siteCodes.flatMap(site => {
                const provs = getProvincesForSite(site);
                return provs.map(p => fetchIndividualCanadaGauge(site, p, startTs, maxTime));
            });
            const arr = await Promise.all(fetches);
            arr.forEach(hist => {
                if (hist) {
                    results[hist.id] = hist;
                }
            });
            return results;
        }

        const provincesToFetch = new Set<string>();
        siteCodes.forEach(code => {
             const provs = getProvincesForSite(code);
             provs.forEach(p => provincesToFetch.add(p));
        });

        const fetches = Array.from(provincesToFetch).map(p => fetchCanadianProvince(p, startTs, maxTime));
        const arr = await Promise.all(fetches);

        for (const provData of arr) {
            for (const siteCode of siteCodes) {
                if (provData[siteCode]) {
                    results[siteCode] = provData[siteCode];
                }
            }
        }
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
                     const url = `https://api.weather.gc.ca/collections/hydrometric-stations/items?STATION_NUMBER=${site}&f=json`;
                     const res = await fetchWithTimeout(url, {
                         headers: DEFAULT_HEADERS
                     }, 60000);
                     if (res.ok) {
                         const data: any = await res.json();
                         if (data.features && data.features.length > 0) {
                             const feat = data.features[0];
                             const formatted = formatGaugeName(feat.properties?.STATION_NAME || site, "EC");
                             results.push({
                                 id: site,
                                 name: formatted.section ? `${formatted.name} ${formatted.section}` : formatted.name,
                                 lon: feat.geometry?.coordinates?.[0] || 0,
                                 lat: feat.geometry?.coordinates?.[1] || 0,
                                 state: feat.properties?.PROVINCE_TERRITORY_CODE || getProvincesForSite(site)[0]
                             });
                         }
                     }
                 } catch (_e) {
                    console.warn(`Canada history fetch failed for ${site}`, _e);
                }
             }
        };
        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return results;
    },

    async getFullSiteListing(): Promise<GaugeSite[]> {
        console.log("Canada Provider: Fetching real-time site metadata...");
        const results: GaugeSite[] = [];
        try {
            // Using the OGC API with REAL_TIME=1 filter to prune manual/historical stations
            const url = "https://api.weather.gc.ca/collections/hydrometric-stations/items?REAL_TIME=1&f=json&limit=5000";
            const res = await fetchWithTimeout(url, {
                headers: {
                    'User-Agent': 'Rivers.run Flow Bot (https://rivers.run)',
                    'Accept': 'application/json'
                }
            }, 60000);
            
            if (!res.ok) throw new Error(`Canada OGC API Error: ${res.status}`);
            
            const data = await res.json() as any;
            if (!data.features || !Array.isArray(data.features)) {
                console.error("Canada Provider: Expected features array from OGC API");
                return [];
            }
            
            for (const feat of data.features) {
                const props = feat.properties;
                const id = props?.STATION_NUMBER;
                if (!id) continue;

                const coords = feat.geometry?.coordinates;
                if (!coords || coords.length < 2) continue;

                const lat = coords[1];
                const lon = coords[0];
                
                if (!isNaN(lat) && !isNaN(lon)) {
                    const formatted = formatGaugeName(props.STATION_NAME || `EC Gauge ${id}`, "EC");
                    results.push({
                        id,
                        name: formatted.section ? `${formatted.name} ${formatted.section}` : formatted.name,
                        lat,
                        lon,
                        state: formatStateCode(props.PROVINCE_TERRITORY_CODE, "EC"),
                        country: "CA"
                    });
                }
            }
            console.log(`EC Provider: Discovered ${results.length} real-time stations.`);
        } catch (e) {
            console.error("EC Provider: Failed to fetch real-time site listing", e);
        }
        return results;
    }
};

