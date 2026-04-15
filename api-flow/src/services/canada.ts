import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite } from './provider';

function reformatReadings(readingsArr: any[]) {
    for (let i = 0; i < readingsArr.length; i++) {
        const reading = readingsArr[i];
        reading.dateTime = new Date(reading.dateTime).getTime();
        
        if (reading.cms !== undefined && !isNaN(parseFloat(reading.cms))) {
            reading.cms = Number(reading.cms);
        }

        if (reading.m !== undefined && !isNaN(parseFloat(reading.m))) {
            reading.m = Number(reading.m);
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

        const trimmed = results.filter((r: any) => r.dateTime >= startTs && r.dateTime <= endTs);
        
        if (trimmed.length > 0) {
            outputGauges[gaugeID] = {
                id: gaugeID,
                name: `Canada Gauge ${gaugeID}`,
                readings: trimmed,
                units: "m",
            };
        }
    }

    return outputGauges;
}

const ALL_PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

async function fetchCanadianProvince(province: string, startTs: number, endTs: number): Promise<Record<string, GaugeHistory>> {
    const url = `https://dd.weather.gc.ca/today/hydrometric/csv/${province}/hourly/${province}_hourly_hydrometric.csv`;
    try {
        const res = await fetch(url);
        if (!res.ok) return {};
        const text = await res.text();
        return processCanadaCSV(text, startTs, endTs);
    } catch {
        return {};
    }
}

export const canadaProvider: GaugeProvider = {
    id: "canada", 
    preferredUnits: 'metric',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        const results: Record<string, GaugeReading> = {};
        
        // Try mapping known province prefixes (e.g. if code is BC08...) otherwise fallback to all
        const provincesToFetch = new Set<string>();
        siteCodes.forEach(code => {
             const prov = code.substring(0, 2).toUpperCase();
             if (ALL_PROVINCES.includes(prov)) {
                 provincesToFetch.add(prov);
             } else {
                 // Unknown province mapping; will require scanning all
                 ALL_PROVINCES.forEach(p => provincesToFetch.add(p));
             }
        });

        const startTs = Date.now() - (1000 * 60 * 60 * 6); // 6 hours
        const endTs = Date.now() + 1000 * 60 * 60 * 24; // buffer
        
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

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, includeForecast?: boolean): Promise<Record<string, GaugeHistory>> {
        const maxTime = endTs ?? Date.now();
        const provincesToFetch = new Set<string>();
        
        siteCodes.forEach(code => {
             const prov = code.substring(0, 2).toUpperCase();
             if (ALL_PROVINCES.includes(prov)) {
                 provincesToFetch.add(prov);
             } else {
                 ALL_PROVINCES.forEach(p => provincesToFetch.add(p));
             }
        });

        const results: Record<string, GaugeHistory> = {};
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
                     const res = await fetch(url);
                     if (res.ok) {
                         const data: any = await res.json();
                         if (data.features && data.features.length > 0) {
                             const feat = data.features[0];
                             results.push({
                                 id: site,
                                 name: feat.properties?.STATION_NAME || site,
                                 lon: feat.geometry?.coordinates?.[0] || 0,
                                 lat: feat.geometry?.coordinates?.[1] || 0
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

