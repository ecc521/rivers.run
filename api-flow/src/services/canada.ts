import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { formatStateCode } from '../utils/formatting';

function reformatReadings(readingsArr: any[]) {
    for (let i = 0; i < readingsArr.length; i++) {
        const reading = readingsArr[i];
        const date = new Date(reading.dateTime);
        reading.dateTime = date.getTime();
        
        if (isNaN(reading.dateTime)) {
            // Defensive fall-back for parsing issues
            continue;
        }
        
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
    readingsArr.sort((a, b) => a.dateTime - b.dateTime);
}

export function processCanadaCSV(text: string, startTs: number, endTs: number): Record<string, GaugeHistory> {
    const lines = text.split('\n');
    if (lines.length < 2) return {};

    const headers = lines[0].split(',').map(h => h.replace(/["\r]/g, '').trim());
    const idIdx = headers.indexOf('ID') !== -1 ? headers.indexOf('ID') : 0;
    const dateIdx = headers.indexOf('Date');
    const levelIdx = headers.indexOf("Water Level / Niveau d'eau (m)");
    const cmsIdx = headers.indexOf("Discharge / Débit (cms)");

    if (dateIdx === -1) return {}; 

    const gaugeReadingsBySite: Record<string, any[]> = {};

    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.replace(/["\r]/g, '').trim());
        if (row.length < headers.length - 1) continue;

        const id = row[idIdx];
        if (!id) continue;

        if (!gaugeReadingsBySite[id]) gaugeReadingsBySite[id] = [];
        
        gaugeReadingsBySite[id].push({
            dateTime: row[dateIdx],
            m: levelIdx !== -1 ? row[levelIdx] : undefined,
            cms: cmsIdx !== -1 ? row[cmsIdx] : undefined
        });
    }

    const outputGauges: Record<string, GaugeHistory> = {};

    for (const gaugeID in gaugeReadingsBySite) {
        const results = gaugeReadingsBySite[gaugeID];
        reformatReadings(results);

        const trimmed = results.filter((r: any) => {
            if (isNaN(r.dateTime) || r.dateTime < startTs || r.dateTime > endTs) return false;
            // Keep if it has at least one data property
            const keys = Object.keys(r);
            return keys.some(k => k !== 'dateTime' && k !== 'isForecast');
        });
        
        if (trimmed.length > 0) {
            const hasCms = trimmed.some(r => r.cms !== undefined);
            outputGauges[gaugeID] = {
                id: gaugeID,
                name: `Canada Gauge ${gaugeID}`,
                readings: trimmed,
                units: hasCms ? "cms" : "m",
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
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Rivers.run Flow Bot (https://rivers.run)',
                'Accept': 'text/csv, application/csv'
            }
        });
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
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Rivers.run Flow Bot (https://rivers.run)',
                'Accept': 'text/csv, application/csv'
            }
        });
        if (!res.ok) return null;
        const text = await res.text();
        const data = processCanadaCSV(text, startTs, endTs);
        return data[stationID] || null;
    } catch {
        return null;
    }
}

export const canadaProvider: GaugeProvider = {
    id: "EC", 
    preferredUnits: 'metric',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
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

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, _includeForecast?: boolean): Promise<Record<string, GaugeHistory>> {
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
                     const res = await fetch(url, {
                         headers: {
                             'User-Agent': 'Rivers.run Flow Bot (https://rivers.run)',
                             'Accept': 'application/json'
                         }
                     });
                     if (res.ok) {
                         const data: any = await res.json();
                         if (data.features && data.features.length > 0) {
                             const feat = data.features[0];
                             results.push({
                                 id: site,
                                 name: feat.properties?.STATION_NAME || site,
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
        console.log("Canada Provider: Fetching full site metadata...");
        const results: GaugeSite[] = [];
        try {
            const res = await fetch("https://wateroffice.ec.gc.ca/services/map_data", {
                headers: {
                    'User-Agent': 'Rivers.run Flow Bot (https://rivers.run)',
                    'Accept': 'application/json'
                }
            });
            if (!res.ok) throw new Error(`Canada WaterOffice API Error: ${res.status}`);
            
            const data = await res.json() as any[];
            if (!Array.isArray(data)) {
                console.error("Canada Provider: Expected array from map_data, got", typeof data);
                return [];
            }
            
            for (const site of data) {
                // Use station_id as the primary identifier
                const id = site.station_id || site.station_number;
                if (!id) continue;

                const lat = parseFloat(site.latitude || site.lat);
                const lon = parseFloat(site.longitude || site.lon || site.long);
                
                if (!isNaN(lat) && !isNaN(lon)) {
                    results.push({
                        id,
                        name: site.station_name || site.name || `Canada Gauge ${id}`,
                        lat,
                        lon,
                        state: formatStateCode(site.province, "Canada")
                    });
                }
            }
        } catch (e) {
            console.error("Canada Provider: Failed to fetch site listing", e);
        }
        return results;
    }
};

