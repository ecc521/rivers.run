import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { formatStateCode, formatGaugeName } from '../utils/formatting';
import { fetchWithTimeout, DEFAULT_HEADERS } from '../utils/timeout';

/**
 * Ireland (WaterLevel.ie / OPW) Gauge Data Service
 */

const normalizeStationId = (ref: string) => ref.slice(-5);

const REGION_MAP: Record<number, string> = {
    3: "Donegal",
    4: "Upper Barrow",
    5: "Lower Barrow",
    6: "Nore",
    9: "Suir",
    10: "North East",
    13: "Boyne Central",
    28: "South West"
};

export const irelandProvider: GaugeProvider = {
    id: "IE",
    preferredUnits: 'metric',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        const results: Record<string, GaugeReading> = {};
        const url = "https://waterlevel.ie/geojson/latest/";
        
        try {
            const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 90000); // Increased to 90s for Ireland latest readings
            if (!res.ok) return results;
            
            const data: any = await res.json();
            const features = data.features || [];
            
            const siteSet = new Set(siteCodes);
            
            for (const f of features) {
                const props = f.properties || {};
                const rawId = props.station_ref;
                if (!rawId) continue;

                const id = normalizeStationId(rawId);
                if (!siteSet.has(id)) continue;
                
                if (props.value !== undefined && isValidReadingValue(props.value, "m")) {
                    results[id] = {
                        dateTime: new Date(props.datetime).getTime(),
                        m: Number(props.value)
                    };
                }
            }
        } catch (e: unknown) {
            console.error("Ireland getLatest Failed:", e);
        }
        return results;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, _includeForecast?: boolean): Promise<Record<string, GaugeHistory>> {
        const maxTime = endTs ?? Date.now();
        const durationMs = maxTime - startTs;
        const period = durationMs > 1000 * 60 * 60 * 24 * 7 ? "month" : "week";
        const results: Record<string, GaugeHistory> = {};
        
        const CONCURRENCY_LIMIT = 3;
        let index = 0;

        const worker = async () => {
            while (index < siteCodes.length) {
                const stationId = siteCodes[index++];
                // We'll primarily fetch gauge 0001 (water level)
                const url = `https://waterlevel.ie/data/${period}/${stationId}_0001.csv`;
                
                try {
                    const res = await fetchWithTimeout(url, { headers: { ...DEFAULT_HEADERS, 'Accept': 'text/csv' } }, 60000); // Increased to 60s timeout per Ireland history CSV
                    if (!res.ok) continue;
                    
                    const text = await res.text();
                    const lines = text.split('\n');
                    if (lines.length < 2) continue;
                    
                    const readings: GaugeReading[] = [];
                    
                    // OPW CSV format: datetime,value (without headers in some cases, or has generic headers)
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line || line.startsWith("#") || line.startsWith("datetime")) continue;
                        
                        const [dtStr, valStr] = line.split(',');
                        const ts = new Date(dtStr).getTime();
                        if (isNaN(ts) || ts < startTs || ts > maxTime) continue;
                        
                        if (isValidReadingValue(valStr, "m")) {
                            readings.push({
                                dateTime: ts,
                                m: Number(valStr)
                            });
                        }
                    }
                    
                    results[stationId] = {
                        id: stationId,
                        name: `Ireland Gauge ${stationId}`,
                        readings: readings.toSorted((a, b) => a.dateTime - b.dateTime),
                        units: "m",
                        country: "IE"
                    };

                } catch (e) {
                    console.warn(`Ireland history fetch failed for ${stationId}`, e);
                }
            }
        };

        await Promise.all(Array(CONCURRENCY_LIMIT).fill(0).map(() => worker()));
        return results;
    },

    async getSiteListing(siteCodes: string[]): Promise<GaugeSite[]> {
        const fullListing = await this.getFullSiteListing!();
        const siteSet = new Set(siteCodes);
        return fullListing.filter(s => siteSet.has(s.id));
    },

    async getFullSiteListing(): Promise<GaugeSite[]> {
        console.log("Ireland Provider: Fetching full site listing...");
        const url = "https://waterlevel.ie/geojson/latest/";
        const results: GaugeSite[] = [];
        
        try {
            const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 90000); // Increased to 90s timeout for Ireland site listing
            if (!res.ok) throw new Error(`Ireland OPW API Error: ${res.status}`);
            
            const data: any = await res.json();
            const features = data.features || [];
            
            for (const f of features) {
                const props = f.properties || {};
                const rawId = props.station_ref;
                const coords = f.geometry?.coordinates || [0, 0];
                
                if (rawId && props.value !== undefined) {
                    const id = normalizeStationId(rawId);
                    const rawName = props.station_name || `Ireland Station ${id}`;
                    const formatted = formatGaugeName(rawName);
                    
                    // Map region_id or fallback to region/county name if present
                    const regionName = props.region_id ? REGION_MAP[props.region_id] : (props.region || props.county);

                    results.push({
                        id: id,
                        name: formatted.section ? `${formatted.name} ${formatted.section}` : formatted.name,
                        lat: coords[1],
                        lon: coords[0],
                        state: formatStateCode(regionName, "Ireland"),
                        country: "IE"
                    });
                }
            }
        } catch (e: unknown) {
            console.error("Ireland Provider: Full site listing failed", e);
            throw e;
        }
        
        return results;
    }
};
