import { GaugeProvider, GaugeReading, GaugeHistory, GaugeSite, isValidReadingValue } from './provider';
import { formatStateCode, formatGaugeName } from '../utils/formatting';
import { fetchWithTimeout, DEFAULT_HEADERS } from '../utils/timeout';

/**
 * UK Environment Agency (EA) Gauge Data Service
 */

export const ukProvider: GaugeProvider = {
    id: "UK",
    preferredUnits: 'metric',
    capabilities: {
        hasForecast: false,
        hasSiteListing: true
    },

    async getLatest(siteCodes: string[]): Promise<Record<string, GaugeReading>> {
        const results: Record<string, GaugeReading> = {};
        const url = "https://environment.data.gov.uk/flood-monitoring/data/readings?latest=true";
        
        try {
            const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 90000); // Increased to 90s for large UK latest readings fetch
            if (!res.ok) return results;
            
            const data: any = await res.json();
            const items = data.items || [];
            
            const siteSet = new Set(siteCodes);
            const wantAll = siteCodes.length === 0;
            
            for (const item of items) {
                // measure e.g. "http://environment.data.gov.uk/flood-monitoring/id/measures/1234-level-..."
                const measureUrl = typeof item.measure === "string" ? item.measure : (item.measure?.["@id"] || "");
                const parts = measureUrl.split("/measures/")[1]?.split("-") || [];
                
                if (parts.length > 0) {
                    const stationId = parts[0];
                    if (wantAll || siteSet.has(stationId)) {
                        const val = Number(item.value);
                        if (!isNaN(val)) {
                            const isFlow = measureUrl.includes("flow") || measureUrl.includes("m3/s");
                            const ts = new Date(item.dateTime).getTime();
                            
                            if (!results[stationId]) {
                                results[stationId] = { dateTime: ts };
                            }
                            
                            // Keep the latest timestamp across multiple measures for the same station
                            if (ts > results[stationId].dateTime) {
                                results[stationId].dateTime = ts;
                            }
                            
                            if (isFlow) {
                                if (isValidReadingValue(item.value, "cms")) {
                                    results[stationId].cms = Number(item.value);
                                }
                            } else {
                                if (isValidReadingValue(item.value, "m")) {
                                    results[stationId].m = Number(item.value);
                                }
                            }
                        }
                    }
                }
            }
        } catch (e: unknown) {
             console.error("UK getLatest Failed:", e);
        }
        
        return results;
    },

    async getHistory(siteCodes: string[], startTs: number, endTs?: number, _includeForecast?: boolean): Promise<Record<string, GaugeHistory>> {
        const results: Record<string, GaugeHistory> = {};
        const maxTime = endTs ?? Date.now();
        const durationMs = maxTime - startTs;
        const limit = Math.max(100, Math.ceil(durationMs / (1000 * 60 * 15)));

        const CONCURRENCY_LIMIT = 5;
        let index = 0;

        const worker = async () => {
            while (index < siteCodes.length) {
                const stationId = siteCodes[index++];
                const url = `https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}/readings?_sorted&_limit=${limit}`;
                
                try {
                    const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 60000); // 60s timeout per UK station history
                    if (!res.ok) continue;
                    
                    const data: any = await res.json();
                    const items = data.items || [];
                    const readings: GaugeReading[] = [];
                    
                    for (const item of items) {
                        const ts = new Date(item.dateTime).getTime();
                        if (isNaN(ts) || ts < startTs || ts > maxTime) continue;
                        
                        const val = Number(item.value);
                        if (isNaN(val)) continue;
                        
                        const isFlow = item.measure?.includes("flow") || item.measure?.includes("m3/s");
                        
                        if (isFlow) {
                            if (isValidReadingValue(item.value, "cms")) {
                                readings.push({ dateTime: ts, cms: Number(item.value) });
                            }
                        } else {
                            if (isValidReadingValue(item.value, "m")) {
                                readings.push({ dateTime: ts, m: Number(item.value) });
                            }
                        }
                    }
                    
                    results[stationId] = {
                        id: stationId,
                        name: `UK Gauge ${stationId}`,
                        readings: readings.toSorted((a, b) => a.dateTime - b.dateTime),
                        units: "m",
                        country: "GB"
                    };

                } catch (_e) {
                    console.warn(`UK history fetch failed for ${stationId}`, _e);
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
        console.log("UK Provider: Fetching full site listing...");
        const url = "https://environment.data.gov.uk/flood-monitoring/id/stations?parameter=level&parameter=flow";
        const results: GaugeSite[] = [];
        
        try {
            const res = await fetchWithTimeout(url, { headers: DEFAULT_HEADERS }, 90000); // 90s timeout for UK full list
            if (!res.ok) throw new Error(`UK EA API Error: ${res.status}`);
            
            const data: any = await res.json();
            const items = data.items || [];
            
            for (const item of items) {
                if (item.notation && item.lat && item.long) {
                    let lat: number;
                    let lon: number;
                    let label: string;

                    // Handle potential array responses for metadata (Common in UK EA API for historical/aggregated stations)
                    if (Array.isArray(item.lat)) {
                        const statusArray = Array.isArray(item.status) ? item.status : [item.status];
                        const activeIndices = statusArray
                            .map((s: any, i: number) => (String(s).includes("statusActive") ? i : -1))
                            .filter((i: number) => i !== -1);

                        if (activeIndices.length > 1) {
                            console.warn(`UK Provider: Multiple active locations found for station ${item.notation}. Picking first.`);
                        }

                        // Prioritize active index, fallback to first
                        const targetIndex = activeIndices.length > 0 ? activeIndices[0] : 0;
                        lat = parseFloat(item.lat[targetIndex]);
                        lon = parseFloat(item.long[targetIndex]);
                        
                        const labels = Array.isArray(item.label) ? item.label : [item.label];
                        label = String(labels[targetIndex] || labels[0] || "");
                    } else {
                        lat = parseFloat(item.lat);
                        lon = parseFloat(item.long);
                        label = Array.isArray(item.label) ? item.label[0] : String(item.label || "");
                    }

                    if (isNaN(lat) || isNaN(lon)) continue;

                    const formatted = formatGaugeName(label || `UK Station ${item.notation}`, "UK");
                    results.push({
                        id: item.notation,
                        name: formatted.section ? `${formatted.name} ${formatted.section}` : formatted.name,
                        lat,
                        lon,
                        state: formatStateCode(item.areaName, "UK"),
                        country: "GB"
                    });
                }
            }
        } catch (e) {
            console.error("UK Provider: Full site listing failed", e);
            throw e; // Bubble up to orchestrator
        }
        
        return results;
    }
};
